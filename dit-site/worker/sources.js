// Research source adapters. Every adapter hits a documented public/authorised endpoint, honours a per-source rate limit,
// and returns normalised observations. None of them has been exercised against the live internet in the build environment:
// research_sources.verified_live only flips to true after a real successful response at runtime.
const UA = env => env.DIT_USER_AGENT || 'DeadInternetTheoryResearch/1.0 (+contact: set DIT_USER_AGENT)';
const iso = d => new Date(d).toISOString();
const pad = n => String(n).padStart(2, '0');

async function getJson(ctx, url, init = {}) {
  const r = await ctx.fetchImpl(url, { ...init, headers: { accept: 'application/json', 'user-agent': UA(ctx.env), ...(init.headers || {}) }, signal: ctx.signal ? AbortSignal.any([ctx.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} responded ${r.status}`);
  return r.json();
}
const NOISE = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Category:|Template:|Talk:|User:|-$)/;

export const SOURCES = {
  wikipedia_trending: { kind: 'culture', base_url: 'https://wikimedia.org/api/rest_v1', docs_url: 'https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews', rpm: 10,
    async fetch(ctx) { const d = new Date(ctx.now() - 86400_000 * 1.5); const j = await getJson(ctx, `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`);
      return (j.items?.[0]?.articles || []).filter(a => !NOISE.test(a.article)).slice(0, 25).map(a => ({ external_id: `wp:${a.article}:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`, title: a.article.replaceAll('_', ' '), url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(a.article), observed_at: iso(ctx.now()), metrics: { views: a.views, rank: a.rank }, engagement: a.views })); } },
  wikipedia_onthisday: { kind: 'culture', base_url: 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday', docs_url: 'https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day', rpm: 10,
    async fetch(ctx) { const d = new Date(ctx.now()); const j = await getJson(ctx, `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`);
      const on = /\b(internet|web|online|computer|video game|software|website|e-?mail|social|network|hacker|virus|browser|domain|search engine|chat)\b/i;
      return (j.events || []).filter(e => on.test(e.text)).slice(0, 12).map(e => ({ external_id: `otd:${e.year}:${e.text.slice(0, 40)}`, title: `${e.year}: ${e.text}`.slice(0, 220), url: e.pages?.[0]?.content_urls?.desktop?.page || null, observed_at: iso(ctx.now()), metrics: { year: e.year }, engagement: 1 })); } },
  dexscreener_profiles: { kind: 'market', base_url: 'https://api.dexscreener.com', docs_url: 'https://docs.dexscreener.com/api/reference', rpm: 30,
    async fetch(ctx) { const j = await getJson(ctx, 'https://api.dexscreener.com/token-profiles/latest/v1');
      return (Array.isArray(j) ? j : []).filter(p => p.chainId === 'solana').slice(0, 25).map(p => ({ external_id: `dsp:${p.tokenAddress}`, title: (p.description && !/^https?:\/\//i.test(p.description) ? p.description : `Solana token ${p.tokenAddress.slice(0,7)}…`).slice(0, 140), url: p.url || `https://dexscreener.com/solana/${p.tokenAddress}`, observed_at: iso(ctx.now()), metrics: { links: (p.links || []).length }, engagement: (p.links || []).length + 1, evidence: { token_address: p.tokenAddress } })); } },
  dexscreener_boosts: { kind: 'market', base_url: 'https://api.dexscreener.com', docs_url: 'https://docs.dexscreener.com/api/reference', rpm: 30,
    async fetch(ctx) { const j = await getJson(ctx, 'https://api.dexscreener.com/token-boosts/top/v1');
      // Boosts are PAID promotion. They are recorded but flagged so they are never presented as organic demand.
      return (Array.isArray(j) ? j : []).filter(p => p.chainId === 'solana').slice(0, 20).map(p => ({ external_id: `dsb:${p.tokenAddress}:${p.totalAmount}`, title: (p.description && !/^https?:\/\//i.test(p.description) ? p.description : `Promoted token ${p.tokenAddress.slice(0,7)}…`).slice(0, 140), url: p.url || `https://dexscreener.com/solana/${p.tokenAddress}`, observed_at: iso(ctx.now()), metrics: { boost_total: p.totalAmount }, engagement: Number(p.totalAmount) || 1, evidence: { paid_attention: true, token_address: p.tokenAddress } })); } },
  dexscreener_search: { kind: 'market', researchOnly: true, base_url: 'https://api.dexscreener.com', docs_url: 'https://docs.dexscreener.com/api/reference', rpm: 120,
    async search(ctx, q) { const j = await getJson(ctx, 'https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(q));
      const pairs = (j.pairs || []).filter(p => p.chainId === 'solana');
      return { query: q, pairs: pairs.length, volume24h: Math.round(pairs.reduce((n, p) => n + (p.volume?.h24 || 0), 0)), liquidityUsd: Math.round(pairs.reduce((n, p) => n + (p.liquidity?.usd || 0), 0)),
        tokens: pairs.slice(0, 30).map(p => ({ symbol: p.baseToken?.symbol || '', name: p.baseToken?.name || '', address: p.baseToken?.address, liquidityUsd: p.liquidity?.usd || 0, url: p.url })) }; } },
  solana_network: { kind: 'chain', base_url: 'configured SOLANA_RPC_URL', docs_url: 'https://solana.com/docs/rpc/http/getrecentperformancesamples', rpm: 6,
    async fetch(ctx) { const url = ctx.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const post = async (method, params) => { const r = await ctx.fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('Solana RPC responded ' + r.status); const j = await r.json(); if (j.error) throw new Error('Solana RPC error'); return j.result; };
      const [slot, perf] = await Promise.all([post('getSlot', [{ commitment: 'finalized' }]), post('getRecentPerformanceSamples', [4])]);
      const tps = perf.length ? Math.round(perf.reduce((n, p) => n + p.numTransactions / p.samplePeriodSecs, 0) / perf.length) : 0;
      return [{ external_id: `sol:${Math.floor(slot / 1000)}`, title: `Solana network throughput ~${tps} tx/s at slot ${slot}`, url: 'https://solscan.io/', observed_at: iso(ctx.now()), metrics: { slot, tps }, engagement: tps, evidence: { context_only: true } }]; } },
  hackernews: { kind: 'social', base_url: 'https://hacker-news.firebaseio.com/v0', docs_url: 'https://github.com/HackerNews/API', rpm: 60,
    async fetch(ctx) { const ids = (await getJson(ctx, 'https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 15);
      const items = await Promise.all(ids.map(id => getJson(ctx, `https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)));
      return items.filter(i => i && i.title && !i.dead && !i.deleted).map(i => ({ external_id: `hn:${i.id}`, title: i.title.slice(0, 200), url: i.url || `https://news.ycombinator.com/item?id=${i.id}`, observed_at: iso(ctx.now()), metrics: { score: i.score, comments: i.descendants || 0 }, engagement: (i.score || 0) + (i.descendants || 0) })); } },
  reddit: { kind: 'social', requiresCredentials: true, base_url: 'https://oauth.reddit.com', docs_url: 'https://www.reddit.com/dev/api', rpm: 20,
    configured: env => !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET),
    async fetch(ctx) { const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = ctx.env; const ua = UA(ctx.env);
      const tr = await ctx.fetchImpl('https://www.reddit.com/api/v1/access_token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'user-agent': ua, 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(12000) });
      if (!tr.ok) throw new Error('Reddit auth responded ' + tr.status); const { access_token: tok } = await tr.json();
      const subs = (ctx.env.REDDIT_SUBREDDITS || 'memes+dankmemes+OutOfTheLoop').replace(/[^A-Za-z0-9_+]/g, '');
      const j = await getJson(ctx, `https://oauth.reddit.com/r/${subs}/hot?limit=20`, { headers: { authorization: 'Bearer ' + tok, 'user-agent': ua } });
      return (j.data?.children || []).map(c => c.data).filter(d => d && !d.stickied && !d.over_18).map(d => ({ external_id: `rd:${d.id}`, title: d.title.slice(0, 200), url: 'https://www.reddit.com' + d.permalink, observed_at: iso(ctx.now()), metrics: { score: d.score, comments: d.num_comments, subreddit: d.subreddit }, engagement: d.score + d.num_comments })); } }
};
export const sourceRows = () => Object.entries(SOURCES).map(([id, s]) => ({ id, kind: s.kind, base_url: s.base_url, docs_url: s.docs_url, rate_limit_per_min: s.rpm, requires_credentials: !!s.requiresCredentials }));

// Per-source minimum spacing between calls (shared by all agents in this process).
export class SourceGate { constructor(clock = Date.now) { this.last = new Map(); this.clock = clock; }
  ok(id) { const gap = 60_000 / (SOURCES[id]?.rpm || 10); const now = this.clock(); if (now - (this.last.get(id) || 0) < gap) return false; this.last.set(id, now); return true; } }
