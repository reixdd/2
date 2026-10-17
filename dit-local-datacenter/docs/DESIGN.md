# DIT Local Data Center — design decisions

- Scope: new independent loopback-only Node.js workstation; existing hosted DIT and local Operator remain unchanged.
- Sources: read-only `/api/concepts?limit=50` and `/api/market` from existing DIT production. Sources and staleness shown; never synthesize live token rows.
- Concept ranking: six metadata fields (name, ticker, original concept X, concept artwork, narrative, recorded evidence). Readiness is metadata completeness, not endorsement.
- Privacy: bound to 127.0.0.1; Host header validation, local password, session cookie, no CORS, strict CSP. Existing DIT .env can be loaded server side; never sent to the browser.
- Local writes: annotating original concept X link, art URL, and private review notes in .data/drafts.json. No remote writes.
- Out of scope: transaction signing, market manipulation, token creation, public deployment, live treasury changes. Separate and independent from the previous Operator treasury work.
- UI: dark terminal, clear two-column stream/inspector, live status, easy keyboard-friendly forms, honest errors and missing data. Browser polls every 15s.
