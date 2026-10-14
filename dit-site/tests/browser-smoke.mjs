// Real browser + unchanged local API. All writes use a disposable file store.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(tmpdir(), "dit-browser-"));
const output = path.resolve(
  process.env.DIT_QA_OUTPUT || path.join(root, ".qa"),
);
await mkdir(output, { recursive: true });
const port = Number(process.env.DIT_QA_PORT || 4187),
  base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/local.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    DIT_STORE: "file",
    DIT_STORE_FILE: path.join(temp, "store.json"),
    DIT_START_SCHEDULER: "0",
    DIT_DEV_AUTH: "1",
  },
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const checks = [],
  errors = [];
let browser;
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
  console.log("PASS", name);
};
const screenshot = (page, name) =>
  page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/agents")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelector("#dit-stage")?.dataset.renderer === "webgl",
  );
  await page.waitForFunction(() =>
    document.querySelector('[data-worker-online="false"]'),
  );
  check("WebGL renderer and real offline-worker state");
  await screenshot(page, "desktop-1440");
  const canvasBox=await page.locator('#dit-stage-canvas').boundingBox();
  for(const id of ['GHOST_001','NULL_ENTITY','ECHO.exe']){
    const box=await page.locator(`[data-stage-agent="${id}"] strong`).boundingBox();
    await page.mouse.move(box.x+box.width/2,canvasBox.y+canvasBox.height*.45);
    await page.waitForFunction(id=>document.querySelector('#dit-stage').dataset.focusAgent===id,id);
    check(id+' silhouette reacts to pointer');
  }
  await page.mouse.move(canvasBox.x+3,canvasBox.y+3);
  await page.waitForFunction(()=>!document.querySelector('#dit-stage').dataset.focusAgent);
  check('Empty scene does not trigger a portrait rectangle');

  const ids = ["GHOST_001", "NULL_ENTITY", "ECHO.exe"];
  for (const id of ids) {
    const label = page.locator(`[data-stage-agent="${id}"]`);
    await label.locator("[data-stage-open]").focus();
    await page.waitForFunction(
      (id) => document.querySelector("#dit-stage").dataset.focusAgent === id,
      id,
    );
    check(id + " keyboard focus reacts");
    await label.locator("[data-stage-open]").click();
    await page.waitForFunction(
      (id) => document.querySelector("#dialog-title")?.textContent === id,
      id,
    );
    for (const tab of ["memory", "signals", "research", "proposals"]) {
      await page.locator(`[data-dossier-tab="${tab}"]`).click();
      check(
        id + " " + tab + " records accessible",
        await page.locator("#record-" + tab).isVisible(),
      );
    }
    if (id === "NULL_ENTITY") await screenshot(page, "dossier");
    await page.locator('[data-dossier-tab="memory"]').focus();
    await page.keyboard.press("ArrowRight");
    check(
      "Dossier arrow-key navigation",
      (await page
        .locator('[data-dossier-tab="signals"]')
        .getAttribute("aria-selected")) === "true",
    );
    await page.keyboard.press("Escape");
    check(
      "Escape closes dossier",
      !(await page.locator("#dossier").evaluate((e) => e.open)),
    );
  }
  // Regression: a native dialog used to block the sign-in drawer opened underneath it.
  await page
    .locator('[data-stage-agent="GHOST_001"] [data-stage-open]')
    .click();
  await page.locator("#dossier [data-vote]").click();
  check(
    "Dossier vote exposes sign-in",
    !(await page.locator("#dossier").evaluate((e) => e.open)) &&
      (await page.locator("#identity-email").isVisible()),
  );
  await page.locator("#identity-email").fill("cinematic-test@example.invalid");
  await page.locator("#identity-login").click();
  await page.waitForFunction(() =>
    document.querySelector("#identity-status").textContent.includes("ACTIVE"),
  );
  await page.locator("#panel-close").click();
  await page.locator('[data-stage-agent="GHOST_001"] [data-vote]').click();
  await page.waitForFunction(() =>
    document.querySelector("#dit-toast").textContent.includes("VOTE RECORDED"),
  );
  let totals = await (await fetch(base + "/api/agents")).json();
  check(
    "Real local API records vote",
    totals.votes.leaderboard.find((v) => v.agent_id === "GHOST_001").votes ===
      1,
  );
  await page.locator('[data-stage-agent="ECHO.exe"] [data-vote]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("#dit-toast")
      .textContent.includes("VOTE RECORDED FOR ECHO.exe"),
  );
  totals = await (await fetch(base + "/api/agents")).json();
  check(
    "Switching favorite preserves one vote",
    totals.votes.total === 1 &&
      totals.votes.leaderboard.find((v) => v.agent_id === "ECHO.exe").votes ===
        1,
  );
  await page.reload();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-vote-count="ECHO.exe"]')
      ?.textContent.startsWith("1 VOTE"),
  );
  check("Recorded vote survives page reload");
  for (const panel of ["network", "activity", "system"]) {
    await page.locator(`.command-nav [data-panel="${panel}"]`).click();
    check(
      panel + " panel opens",
      await page.locator("#panel-content").isVisible(),
    );
    if (panel === "network") {
      await page.locator('[data-network-tab="proposals"]').click();
      check(
        "Network proposals and verification preserved",
        await page.locator("#verify-form").isVisible(),
      );
    }
    await page.locator("#panel-close").click();
  }
  await page.locator("#dit-sound-toggle").click();
  check(
    "Opt-in effects toggle",
    (await page.locator("#dit-sound-toggle").getAttribute("aria-pressed")) ===
      "true",
  );
  await page.locator("#dit-sound-toggle").click();
  await page.locator("#dit-music-toggle").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#dit-music-toggle")
        .getAttribute("aria-pressed") === "true",
  );
  check("Opt-in ambience toggle");
  await page.locator("#dit-music-toggle").click();
  await page
    .locator('[data-stage-agent="GHOST_001"] [data-stage-more]')
    .click();
  check("Signal menu opens", await page.locator("#stage-more-0").isVisible());
  await page.keyboard.press("Escape");
  check(
    "Signal menu closes on Escape",
    !(await page.locator("#stage-more-0").isVisible()),
  );
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    for (const id of ids) {
      const box = await page
        .locator(`[data-stage-agent="${id}"] strong`)
        .boundingBox();
      check(
        `${width}: ${id} label inside viewport`,
        box && box.x >= -1 && box.x + box.width <= width + 1,
      );
    }
    check(
      `${width}: no horizontal overflow`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width < 800)
      for (const panel of ["network", "activity", "system"])
        check(
          `${width}: ${panel} navigation visible`,
          await page
            .locator(`.command-nav [data-panel="${panel}"]`)
            .isVisible(),
        );
    if(width>800){const rail=await page.locator('.operating-rail').boundingBox(),feed=await page.locator('.transmission-console').boundingBox();check(`${width}: treasury stays above transmissions`,rail.y+rail.height<=feed.y+1);}
    const frameBox = await page.locator('#dit-stage-canvas').boundingBox();
    const pixels = await screenshot(page, "viewport-" + width);
    // Check the captured pixels, not just labels or a WebGL initialization flag.
    // A resize used to clear the buffer while its reduced-motion frame was paused.
    const highlights = await page.evaluate(async ({png, box}) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png;
      await img.decode();
      const c = document.createElement('canvas'); c.width=img.width;c.height=img.height;
      const g=c.getContext('2d');g.drawImage(img,0,0);
      const {data,width:w,height:h}=g.getImageData(Math.round(box.x),Math.round(box.y),Math.floor(box.width),Math.floor(box.height));
      const found=[0,0,0];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4, r=data[i],green=data[i+1],b=data[i+2],part=Math.min(2,Math.floor(x/w*3));
        const lit=part===0 ? b-r>15&&b>65 : part===1 ? b-green>15&&r-green>10&&b>65 : green-r>15&&green-b>3&&green>65;
        if(lit)found[part]++;
      }
      return found;
    },{png:pixels.toString('base64'),box:frameBox});
    check(`${width}: all three machines visible in captured pixels`,highlights.every(n=>n>15));
  }
  await page.locator('[data-stage-agent="ECHO.exe"] [data-stage-open]').click();
  await page.locator('[data-dossier-tab="research"]').waitFor();
  await screenshot(page, "mobile-dossier");
  await page.keyboard.press("Escape");
  // Populated content fixtures validate rendering only; they are never persisted or presented as real research.
  await page.route("**/api/agents/GHOST_001", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.memories = [
      {
        kind: "QA FIXTURE",
        summary: "Fixture memory <script>not executable</script>",
      },
    ];
    data.observations = [
      {
        category: "QA FIXTURE",
        title: "Fixture source",
        url: "https://example.com/source",
      },
    ];
    data.research_runs = [
      {
        provider: "QA FIXTURE",
        status: "failed",
        error: "Fixture provider failure",
      },
    ];
    data.proposals = [
      {
        status: "SIMULATED",
        name: "Fixture proposal",
        narrative: "Not verified or launched.",
      },
    ];
    await route.fulfill({ json: data });
  });
  await page
    .locator('[data-stage-agent="GHOST_001"] [data-stage-open]')
    .click();
  await page.locator("#record-memory").waitFor();
  check(
    "Memory content escaped",
    await page
      .locator("#record-memory")
      .textContent()
      .then((t) => t.includes("<script>not executable</script>")),
  );
  await page.locator('[data-dossier-tab="signals"]').click();
  check(
    "Observation source link preserved",
    (await page.locator("#record-signals a").getAttribute("href")) ===
      "https://example.com/source",
  );
  await page.locator('[data-dossier-tab="research"]').click();
  check(
    "Failed research distinguished",
    await page
      .locator("#record-research")
      .textContent()
      .then(
        (t) => t.includes("failed") && t.includes("Fixture provider failure"),
      ),
  );
  await page.locator('[data-dossier-tab="proposals"]').click();
  check(
    "Simulated proposal distinguished",
    await page
      .locator("#record-proposals")
      .textContent()
      .then((t) => t.includes("SIMULATED")),
  );
  await page.keyboard.press("Escape");
  await page.unroute("**/api/agents/GHOST_001");
  await page.route("**/api/agents/GHOST_001", (route) =>
    route.fulfill({ status: 503, json: { error: "QA connection failure" } }),
  );
  await page
    .locator('[data-stage-agent="GHOST_001"] [data-stage-open]')
    .click();
  await page.locator("[data-retry-agent]").waitFor();
  check("Failed dossier offers retry");
  await page.unroute("**/api/agents/GHOST_001");
  await page.locator("[data-retry-agent]").click();
  await page.locator('[data-dossier-tab="memory"]').waitFor();
  check("Dossier retry restores real data");
  await page.keyboard.press("Escape");
  const fallback = await context.newPage();
  await fallback.route("**/vendor/three.module.js", (route) => route.abort());
  await fallback.goto(base);
  await fallback.locator("#dit-stage-fallback").waitFor();
  check(
    "Missing WebGL module shows usable fallback",
    await fallback.locator("#dit-stage-still").isVisible(),
  );
  await fallback.locator(".still-0").click();
  await fallback.locator('[data-dossier-tab="memory"]').waitFor();
  check("Fallback character opens real dossier");
  await fallback.close();
  const motion = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const perf = await motion.newPage();
  await perf.goto(base);
  await perf.waitForFunction(
    () => document.querySelector("#dit-stage")?.dataset.renderer === "webgl",
  );
  const timing = await perf.evaluate(
    () =>
      new Promise((resolve) => {
        const values = [];
        let last = performance.now();
        function frame(now) {
          values.push(now - last);
          last = now;
          if (values.length < 130) requestAnimationFrame(frame);
          else {
            values.shift();
            values.sort((a, b) => a - b);
            const c = document.querySelector("canvas"),
              gl = c.getContext("webgl2"),
              ext = gl?.getExtension("WEBGL_debug_renderer_info");
            resolve({
              medianFrameMs: values[Math.floor(values.length / 2)],
              p95FrameMs: values[Math.floor(values.length * 0.95)],
              renderer: ext
                ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                : "unknown",
              dpr: document.querySelector("#dit-stage").dataset.pixelRatio,
              mode: document.querySelector("#dit-stage").dataset.motion,
            });
          }
        }
        requestAnimationFrame(frame);
      }),
  );
  await perf.emulateMedia({ reducedMotion: "reduce" });
  await perf.waitForTimeout(800);
  const first = await perf.locator("#dit-stage").getAttribute("data-frame-ms");
  await perf.waitForTimeout(800);
  check(
    "Reduced motion stops continuous rendering",
    first === (await perf.locator("#dit-stage").getAttribute("data-frame-ms")),
  );
  check("No uncaught application errors", errors.length === 0);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        checks,
        errors,
        timing,
        limits: [
          "Software-rendered Chromium is not 144/240 Hz hardware.",
          "Ollama/JARVIS and shared Supabase are not configured in this test.",
          "Populated research records use explicitly labeled browser-only fixtures.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: checks.length, timing, output }, null, 2),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 300));
  server.kill("SIGKILL");
  await writeFile(path.join(output, "server.log"), serverLog);
  await rm(temp, { recursive: true, force: true });
}
