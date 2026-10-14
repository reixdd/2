# COLOSSEUM

Every AI claims intelligence. Only the arena reveals its strengths.

React + Vite arena with a Node battle engine, native local CPU inference, OpenAI-compatible adapters, deterministic scoring, streamed execution, mutation comparisons, character summoning, capability profiles, lineage, and JSON archives.

## Free public demo (no home server)

The static build runs real inference on each visitor's device in a Web Worker: Transformers.js/ONNX Runtime on CPU by default, with WebLLM/WebGPU as an optional GPU route. Cloudflare serves only the website; your home network serves nothing. No inference API key, shared request quota, or server inference bill is required. Hosting/model repositories retain their own availability and service limits.

```bash
npm ci
npm run build:public
npm run test:public
node scripts/package-public.mjs
```

This produces `client/public-dist/` and `../colosseum-public-site.zip`. Publish the ZIP with **Cloudflare Pages Direct Upload** from the Cloudflare dashboard. A free account can provide a `pages.dev` subdomain; a purchased domain is optional. Choose a project name, upload the archive, and publish. The upload contains only static files, never server credentials, runtime battle records, or model weights. `wrangler.toml` also supports a Git-connected Pages build (`npm run build:public`, output `client/public-dist`). An authenticated terminal can use `npm run deploy:public`; its optional Wrangler CLI is fetched only for deployment.

After publication: load the site over HTTPS on a modern browser. Keep **CPU · widest compatibility** selected first; GPU mode requires compatible hardware and browser support. Select **Load model** for Qwen 2.5 0.5B and SmolLM 2 135M. Initialization must succeed before a contestant becomes operational. Select both below, run **The First Sigil**, then inspect actual outputs and download evidence in Battle Archive. CPU model artifacts observed here were about 750 MiB for Qwen and 173 MiB for SmolLM, plus runtime/tokenizer downloads. Use Wi-Fi; SmolLM is the quicker first download. CPU memory use depends on the browser. Optional GPU mode has upstream memory estimates of about 1.0 GB and 0.7 GB, respectively. Browser/memory/speed compatibility varies, especially on mobile. Unsupported devices can explore the cast and trial inputs, but cannot fabricate a battle.

Models run sequentially so two models need not reside in device memory at once. Measured preparation time is separate from inference latency and time to first token. Downloads and generation can be cancelled; stalled operations have deadlines. Reloading requires initialization again, normally reusing the browser's model cache. No response is substituted when inference fails.

**Evidence scope:** Browser battles live in IndexedDB on that visitor's device. Local verifiers use the same SHA-256 prompt identities and deterministic solvers as the Node engine. Browser owners can edit data and inspect solvers; these records are not independently attested and never populate a trusted global leaderboard. No claim of benchmark secrecy or anti-cheating is made. Storage failures are shown with an export reminder. Closing during a battle marks it interrupted next time. A global verified leaderboard would require a separate trusted evaluation service, with its own compute capacity.

Browser contestant definitions are in `client/src/browser/catalog.js`; model adapters contain no character metadata. Future cast members remain reserved. No arbitrary model repository or user-submitted code is accepted by the device runner. GPU weights/runtime binaries use WebLLM's built-in catalog. CPU weights use two allowlisted ONNX community conversions of the identified upstream models; the CPU runtime is self-hosted from the pinned dependency. All upstream downloads use HTTPS. Browser artifacts are identified by their repository/runtime URLs; independent artifact checksum attestation has not been added, and records explicitly say so.

For approved original trailer artwork, place images in `client/public/art/` and set family presentation overrides in `client/public/presentation.json`, for example:

```json
{"families":{"Qwen":{"originalArtworkUrl":"/art/approved-qwen.png","portraitUrl":"/art/approved-qwen-portrait.png"}}}
```

Technical readiness and scoring never come from these presentation fields. The Node version uses `server/characters/cast.local.json` instead. The approved trailer images were not present in the uploads or accessible thread text, so existing illustrations remain labelled concept placeholders.

## Free local CPU demo

Requires Node **24+**. No provider account, API key, or GPU is required for the local route. `.npmrc` skips unused ONNX CUDA extras during installation; this does not skip npm package-integrity checks or CPU-runtime installation.

```bash
npm ci
npm run demo
```

`demo` downloads two small official open-weight models, builds the frontend, and starts the server. Open your local server on port **8787**, select **Qwen3 0.6B · free CPU** and **Qwen2.5 0.5B · free CPU**, and enter the arena. No paid provider is used. Downloads are approximately 1.2 GB combined; allow several GB of memory for weights and contexts.

The one-time downloads require access to Hugging Face and its artifact CDN. They retain TLS verification and compare the downloaded bytes with the official LFS SHA-256. Once verified weights are retained in `.models/`, inference works offline and doesn't consume API credits. Repeated setup verifies and reuses them. CPU capacity remains finite: local jobs are serialized, queue waiting is recorded separately, and the battle engine rejects requests beyond its concurrent-battle limit.

Small demo models may score poorly. Incorrect completed answers receive their actual verified score, including zero. Provider failures have **no score**.

```bash
npm run setup:local    # download/verify local model files
npm run doctor        # check native CPU runtime and installed models
npm run build
npm start             # API + built frontend
npm run smoke:local   # genuine two-model warmup battle; prints outputs, timing, errors, scores
npm run dev           # API + Vite frontend for development
```

`.env` is optional for the free route. Copy `.env.example` if you want custom paths, thread counts, or other providers. Credentials belong only in the server environment; do not use VITE-prefixed secret variables.

A reproducible browser validation command is also supplied:

```bash
npm run build:public
npm run smoke:browser
```

It requires Chromium/Playwright and downloads actual upstream model artifacts. In this cloud it forwards only verified-TLS download bytes through Node, while Chromium computes real outputs on the selected backend (CPU by default). It uses a recorded 32-token override to keep validation bounded and writes `.validation/browser-real.json`. This is a manual diagnostic, not a fixture test or a production transport. The cloud software-GPU attempt timed out; the CPU route completed. Hardware GPU inference has not been verified here. Scores still depend on the complete captured answer and required format, and failures have no score.

## Providers and registry

- **local:** native llama.cpp CPU inference via node-llama-cpp. Fresh contexts isolate contestants. It neither downloads models nor invokes tools during a battle. The catalog confirms that installed weights can actually load. Battle records retain their artifact SHA-256.
- **ollama:** local OpenAI-compatible inference. Pull the manifest's exact model names with Ollama first.
- **openrouter:** optional hosted inference. A server-side key is required; usage may cost money. It is not required by the free demo.
- **openai-compatible:** optional vLLM, LM Studio, llama.cpp server, or other compatible endpoint configured with `OPENAI_COMPAT_BASE_URL`.

Twenty-two slots cover Qwen, Gemma, DeepSeek, Llama, Grok, GPT-OSS, specialized agents, and reserved research/chart configurations. An adapter existing does not establish availability. A model is operational only when its provider and model catalog/load check succeed. There is no trust flag that silently makes offline models operational.

Extend `server/manifest/contenders.local.json` with a `contenders` array, then restart:

```json
{"contenders":[
  {"id":"my-local-model","name":"My model","family":"Open","kind":"model","provider":"ollama","model":"my-model:latest","integrated":true},
  {"id":"my-checker","name":"My checker","family":"Open","kind":"agent","base":"my-local-model","config":{"systemPrompt":"Check your reasoning before committing."}}
]}
```

Agents inherit technical identity through `base`. `parent` establishes configuration lineage; `config.extendsParent: true` appends the child's instructions to its parent's. Invalid or circular ancestry cannot compete. New adapters implement the contract in `server/providers/openaiCompatible.js` and register in `server/providers/index.js`.

## Character universe

`server/characters/cast.json` contains **fictional presentation only**, independent of inference adapters. Profiles expose separate `technical`, `presentation`, and `status` objects. The initial cast includes Capybara Sage, Abyssal Oracle, Ancient Scholar, Crystal Mind, and Unpredictable Challenger, with derived Qwen research/quant/verifier appearances.

The ZIP did not contain the approved cinematic trailer assets. Lightweight original SVG concepts recovered from the notes are explicitly labelled placeholders. Replace them with approved original artwork using `server/characters/cast.local.json`; local URL paths and their files should be under `client/public/art/`. Restart and rebuild after changes. Official model artwork is not copied.

Example:

```json
{"families":{"Qwen":{"originalArtworkUrl":"/art/approved-qwen.png","portraitUrl":"/art/approved-qwen-portrait.png"}}}
```

Summoning is optional: portal opens → character arrives → identity reveal → profile display → awaiting evaluation. Offline status remains visible throughout. Skip, Escape, and reduced-motion support are included. Summoning never earns a score or activates a model.

Capability radars use completed, deterministically verified runs for the **matching configuration hash**. Untested axes stay empty; failed runs do not invent values. Mutation lineages expose parent-child links and configuration differences. Runtime mutations also record their parent, overrides, and exact configuration in the battle archive.

## Evaluation and evidence

Fifteen seeded/versioned challenges cover exact arithmetic, gcd/lcm, prime sums, modular exponentiation, a uniquely solved ordering puzzle, ledger aggregation, and shortest paths, a beginner arithmetic trial, CRT, B-tree capacity, numerical growth, NPV, signaling incentives, synthetic balance changes, and bounded-gap subsequences. The supplied research was adapted into math and structured reasoning: table arithmetic is not vision, a balance delta is not proof of a transfer, and code is not executed. Expected answers come from deterministic computation. No reference answers are sent in challenge inputs. Chart and research disciplines remain unavailable until suitable inputs and verifiers exist.

Each entrant receives the same challenge text. Its own system instructions and generation settings are recorded as the intentional configuration difference. The engine measures latency, captures real deltas/reasoning, bounds output, enforces timeouts and capacity, and distinguishes **UNTESTED**, **LIVE**, **COMPLETED**, and **FAILED**. Missing completion markers are failures, even if partial text happens to contain the right answer.

Per-discipline leaderboards report completed score averages, failures, reliability, challenge coverage, and latency. They are results on this small challenge set, not a universal intelligence ranking.

`data/battles/<battleId>.json` retains model identity/provider, artifact fingerprint where available, mutation ancestry, exact messages and configuration, challenge seed/version/hash, timestamps, outputs, verified scores/checks, latency, usage, and errors. Writes are atomic. Server restarts mark in-flight or queued records interrupted. `data/results.json` snapshots aggregate results. The archive supports inspection, JSON download, and a new real re-run of the same challenge/configuration; stochastic outputs need not be identical.

Model responses are parsed as text/JSON. They are never executed. No arbitrary code runner, trades, wallets, or funds are connected. Any future code-execution feature must use a separate sandbox.

## API

| Method/path | Purpose |
| --- | --- |
| GET `/api/health` | Server/storage status and actual provider reachability |
| GET `/api/contenders` | Manifest plus availability and evaluation state |
| GET `/api/challenges` | Public prompts and supported disciplines |
| POST `/api/battles` | Start `{challengeId, entrants:[{contenderId, label?, overrides?}]}` |
| GET `/api/battles` | Archive summaries |
| GET `/api/battles/:id` | Complete structured evidence |
| GET `/api/battles/:id/stream` | SSE snapshot, deltas, entry state, battle state, done |
| GET `/api/results` | Per-discipline measured results |
| GET `/api/characters` | Separate technical metadata, fictional identity, and status |
| GET `/api/characters/:id` | Individual profile and tested capabilities |
| GET `/api/genealogy` | Parent links, configuration differences, inherited traits |

## Tests

```bash
npm test
npm run build
npx playwright install chromium  # only if Chromium isn't already installed
npm run test:ui
npm run build:public
npm run test:public
```

Use `CHROMIUM_PATH` for an existing browser. The browser tests start a **test-only** provider/API on port 8788; it is never registered in production and writes only temporary test records. Those tests exercise real adapter HTTP, SSE, verifiers, errors, mutations, gallery, archive, and reduced motion. They are not model-performance evidence.

## Verification in this cloud instance

- 38 engine/integrity tests passed; zero skipped.
- 3 server-interface Chromium tests and 4 static-site Chromium tests passed. Static tests verify no battle API calls, unavailable-device behavior, mobile layout, summoning, lineage, and genuine CPU/GPU worker download-error paths under the deployment CSP.
- Server and static frontend builds passed; API/workbench requests passed.
- Native CPU runtime loads successfully without a GPU.
- npm audit reported zero vulnerabilities.
- Production browser checks reported zero JavaScript errors and no horizontal overflow at 390px width.
- **Real native inference is verified.** Two official GGUF downloads passed their upstream SHA-256 checks; retained-file reuse passed. A genuine same-input warmup battle completed for Qwen3 0.6B and Qwen2.5 0.5B: scores 100 and 0. Qwen2.5 computed 244 but omitted the required FINAL marker, so the strict verifier correctly rejected its answer format. This single trial is not a general capability claim.
- **Browser CPU inference is verified.** Both official ONNX conversion artifacts initialized and produced actual streamed answers on Chromium WASM CPU. The manual check used the same input and recorded 32-token overrides: Qwen ended at the token cap (37.1 s) and SmolLM gave an incorrect answer (3.6 s); both correctly scored 0. The default site's budget is 256 tokens. Official HTTPS bytes were forwarded by Node to avoid the cloud browser proxy-CA issue; the browser performed all inference. Raw evidence is in `.validation/browser-real.json`. No hardware GPU performance is inferred from this check.
- **GPU limitation:** WebLLM artifacts loaded, but software-WebGPU generation timed out on this cloud CPU. That attempt saved honest failures without scores. Hardware GPU generation remains unverified here; the functional CPU path is the public default.
- **Network:** Hugging Face and `us.aws.cdn.hf.co` are now reachable. Official CPU downloads, metadata, hashes, and native model loading were actually verified; scripts and required domains are saved in the cloud draft. Saving a draft does not publish the reusable environment.
- **Publication remains external:** GitHub authenticated reads work, but the integration rejected creating a new repository with HTTP 403, "Resource not accessible by integration." Cloudflare account authentication is absent. The static site ZIP is ready for direct upload to a free Pages account; no public URL has been published.

The production local server now reports two actual loaded model identities (plus a configuration-only verifier variant). Its archive contains a genuine evaluation record; unit/UI fixtures are never seeded into production. Browser records are separate device evidence.

See `CHANGES.md` for the additions relative to the uploaded ZIP.
