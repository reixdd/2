// Dead Internet Theory - bounded, read-only cultural evidence worker.
// Runs on Supabase Free: public-source observations only, no trades, token signing or LLM claims.
// Custom authentication uses a server-generated secret; never expose the bearer in the browser.
const projectUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WORKER_ID = "dit-edge-cultural-evidence";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});
const controller = ms => AbortSignal.timeout(ms);
async function db(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(projectUrl + "/rest/v1/" + path, {
    method, signal: controller(10000),
    headers: {
      apikey: serviceKey, authorization: "Bearer " + serviceKey,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error("Database " + path.split("?")[0] + " returned HTTP " + response.status + " " + raw.slice(0, 180));
  return raw ? JSON.parse(raw) : null;
}
function secureMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function getJson(url) {
  const response = await fetch(url, {
    signal: controller(10000),
    headers: { accept: "application/json", "user-agent": "DeadInternetTheoryResearch/1.0" }
  });
  if (!response.ok) throw new Error(new URL(url).hostname + " HTTP " + response.status);
  return response.json();
}
async function status(id, err = null) {
  const filter = "?id=eq." + encodeURIComponent(id);
  const patch = err
    ? { last_error: String(err).slice(0, 250), last_error_at: new Date().toISOString() }
    : { verified_live: true, last_success_at: new Date().toISOString(), last_error: null, last_error_at: null };
  await db("research_sources" + filter, { method: "PATCH", body: patch });
}
async function record(agent, source, item) {
  if (!item || !item.externalId || !item.title || !item.url) return false;
  const row = {
    agent_id: agent, source_id: source, external_id: item.externalId,
    title: item.title.slice(0, 200), url: item.url, observed_at: new Date().toISOString(),
    category: item.category || "general", classifier: "rules", confidence: null,
    metrics: item.metrics || {},
    evidence: { provider: source, url: item.url, recorded_by: WORKER_ID, ai_generated: false }
  };
  const inserted = await db("observations?on_conflict=agent_id%2Csource_id%2Cexternal_id&select=id", {
    method: "POST", body: row, prefer: "resolution=ignore-duplicates,return=representation"
  });
  if (!Array.isArray(inserted) || !inserted.length) return false;
  await db("agent_memories", {
    method: "POST",
    body: {
      agent_id: agent, kind: "episodic",
      content: "Public-source evidence, not a generated conclusion: " + row.title + " (" + source + ")",
      summary: row.title, tags: ["external_evidence", "uninterpreted"],
      importance: 0.5,
      source_refs: [{ source_id: source, external_id: row.external_id, url: row.url }]
    }
  });
  await db("activity_events", {
    method: "POST",
    body: {
      agent_id: agent, event_type: "observation", severity: "info",
      title: "Public source observation recorded",
      detail: "Attributed " + source + " evidence; no AI-generated conclusion.",
      payload: { source_id: source, external_id: row.external_id, url: row.url }
    }
  });
  await db("agents?id=eq." + encodeURIComponent(agent), {
    method: "PATCH", body: { last_active_at: new Date().toISOString() }
  });
  return true;
}
async function research() {
  const activeRows = await db("research_sources?enabled=eq.true&select=id");
  const active = new Set((activeRows || []).map(x => x.id));
  const results = [];
  // Legacy technology headlines are opt-in only. DIT now gets its meme research
  // from the existing local read-only JARVIS market pipeline instead.
  const generalNewsEnabled = Deno.env.get("DIT_GENERAL_NEWS_ENABLED") === "1";
  if (generalNewsEnabled && active.has("hackernews")) {
    try {
      const ids = (await getJson("https://hacker-news.firebaseio.com/v0/topstories.json")).slice(0, 8);
      const items = (await Promise.all(ids.slice(0, 4).map(id =>
        getJson("https://hacker-news.firebaseio.com/v0/item/" + id + ".json").catch(() => null))))
        .filter(x => x && x.title && !x.dead && !x.deleted);
      await status("hackernews");
      for (const [agent, item] of [["NULL_ENTITY", items[0]], ["ECHO.exe", items[1] || items[0]]]) {
        if (!item) continue;
        const inserted = await record(agent, "hackernews", {
          externalId: "hn:" + item.id, title: item.title,
          url: "https://news.ycombinator.com/item?id=" + item.id,
          metrics: { score: item.score || 0, comments: item.descendants || 0 }
        });
        if (inserted) results.push({ agent, source: "hackernews" });
      }
    } catch (err) {
      console.error("hackernews", String(err).slice(0, 200));
      await status("hackernews", err).catch(() => {});
    }
  }
  if (generalNewsEnabled && active.has("wikipedia_trending")) {
    try {
      const date = new Date(Date.now() - 36 * 3600 * 1000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const response = await getJson("https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/" + yyyy + "/" + mm + "/" + dd);
      const page = (response.items?.[0]?.articles || []).find(x =>
        x.article && !/^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Category:|Template:|Talk:|User:|-)/.test(x.article));
      if (!page) throw new Error("No eligible Wikipedia page returned");
      await status("wikipedia_trending");
      const inserted = await record("GHOST_001", "wikipedia_trending", {
        externalId: "wp:" + page.article + ":" + yyyy + mm + dd,
        title: page.article.replaceAll("_", " "),
        url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(page.article),
        metrics: { views: page.views, rank: page.rank }
      });
      if (inserted) results.push({ agent: "GHOST_001", source: "wikipedia_trending" });
    } catch (err) {
      console.error("wikipedia_trending", String(err).slice(0, 200));
      await status("wikipedia_trending", err).catch(() => {});
    }
  }
  return results;
}
Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!projectUrl || !serviceKey) return json({ error: "Host secrets not configured" }, 503);
  const offered = request.headers.get("x-dit-worker-key") || "";
  if (!offered) return json({ error: "Unauthorized" }, 401);
  try {
    const credentialRows = await db("dit_worker_auth?id=eq.1&select=token&limit=1");
    if (!secureMatch(offered, credentialRows?.[0]?.token)) return json({ error: "Unauthorized" }, 401);
    const now = new Date();
    await db("worker_heartbeats?on_conflict=worker_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        worker_id: WORKER_ID, started_at: now.toISOString(), last_seen_at: now.toISOString(),
        version: "cultural-evidence-1", info: {
          mode: "attributed_cultural_observations_only", llm_configured: false,
          tokens_launched: 0, signing_enabled: false, financial_feeds_enabled: false, store: "supabase"
        }
      }
    });
    const payload = await request.json().catch(() => ({}));
    const isResearchInterval = now.getUTCMinutes() < 2;
    const observations = (payload?.force === true || isResearchInterval) ? await research() : [];
    return json({ ok: true, mode: "read_only_cultural_evidence", observations, ai_generation: false });
  } catch (error) {
    console.error("DIT cultural evidence worker:", String(error).slice(0, 280));
    return json({ error: "Research worker failed" }, 500);
  }
});