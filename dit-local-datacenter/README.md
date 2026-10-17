# DIT // LOCAL DATA CENTER

An independent **local-only research website** for the Dead Internet Theory project's live Meme Radar and agent concepts. **It does not deploy tokens, sign wallets, purchase, sell, bundle, or change the hosted DIT website.** Only private annotations are editable; live sources are read-only.

## Start on Windows

1. Place this folder next to your existing `dit-site` directory (or use it on its own).
2. Ensure **Node.js 22+** is installed. No `npm install` needed.
3. Double-click `START-DIT-DATACENTER.cmd`.
4. Open **http://127.0.0.1:4187**. On first startup the command window prints a random private access code, saved under `.data/access-code.txt` for later runs. Keep this file private.
5. Enter the access code, then inspect **Agent Concepts** or **Meme Radar**.

Optional: define `DIT_DATACENTER_PASSWORD` (12+ chars) in your **existing** `dit-site/.env` for a stable password. The launcher loads that env file when present; no credentials are duplicated or transmitted to the DIT website. Optional `DIT_DATACENTER_PORT=4187`; `DIT_SITE_URL` may override the hosted site origin (HTTPS only). For a self-contained checkout, OS environment variables work too.

The local app **does not copy the full DIT `.env` into any public web response**, even when that file contains sensitive runtime keys.

The server binds **only** to `127.0.0.1`, rejects other HTTP Host headers, uses a session cookie with HttpOnly and SameSite=Strict, has login rate limiting, and never exposes your environment variables in browser responses. It is local-user protection, not a substitute for Windows account security or disk encryption. **Do not port-forward or reverse-proxy it.**

## Data and limitations

- Live concepts: GET `https://dead-internet-theory-network.deadinternetproject.chatgpt.site/api/concepts?limit=50` (production shows only `review`/`published` concepts). **An empty queue does not mean agents did nothing**: the upstream endpoint might have no published/review records.
- Live market: GET `/api/market` from that same host. Displays upstream status, provider, observation times, and source-provided market fields. Missing and stale information is labeled; nothing is fabricated.
- Poll: browser every 15s, local upstream cache 8s, each request timeout 9s.
- Local annotations (X profile, artwork HTTPS URL, notes) saved to `.data/drafts.json`. **These don't edit the public website or the agent database.** A coin concept's original X URL remains empty until supplied explicitly; existing market-token X links are not assigned to new concepts.
- Concept completeness: name, ticker, X, artwork, narrative, and at least one recorded source. All six fields must exist for the 'Complete' label. This measures metadata completeness, **not safety, uniqueness, legal status, or fitness for launch**.
- `EXPORT JSON` downloads a research draft with `research_only: true`; this is not a Pump.fun transaction or token deployment.

## Test

Run `npm test` from this folder. The tests use local mock responses only and **do not** claim the hosted API is reachable from your computer.

## Architecture / security

`server.mjs` is dependency-free HTTP with local-only authentication, fixed upstream API proxy, and local-only draft state. `model.mjs` normalizes fields and validates external URLs. `public/` is the static responsive console. `test/` covers read-only retrieval, login, privacy and draft persistence. This folder does **not** replace the localhost `/operator` code from earlier versions of DIT or the current hosted site.
