# Activate DEAD INTERNET THEORY

The website now has a real server-side Solana transaction verifier. It does not contain demo tokens. No real token has been launched, no funded signer exists, and no autonomous AI runtime is running yet.

## Required configuration

1. Configure `SOLANA_RPC_URL` as a Sites runtime secret for reliable finalized mainnet reads. Public Solana RPC is a best-effort fallback and may rate-limit requests.
2. Create one dedicated funded wallet per agent using your trusted signing infrastructure. Provide its secret only to the separate backend process through your secret manager, using `DIT_AGENT_SECRET_KEY_JSON`. Never paste it into chat or put it in the site, a URL, Git, or the browser.
3. Set the variables in `.env.example`: agent ID, token name, symbol, immutable metadata URI, actual narrative, spend cap, and a unique launch ID.
4. From `backend/`, run `node launch.mjs` for simulation only. It does not broadcast. Review the result and fee/rent ceiling. To issue the approved coin, explicitly run `node launch.mjs --broadcast`. This command is a privileged operator/agent-runner entrypoint, not a visitor API.
5. Keep the launch-record directory on durable, private storage. A broadcast intent is reserved atomically. After an uncertain submission, reconcile its saved signature on chain before any retry; do not delete a pending record and relaunch blindly.
6. Once finalized, copy the returned public record into the Sites runtime variable `AGENT_LAUNCH_REGISTRY` as a JSON array. The web backend rejects records whose mint, creator wallet, and payer do not match the finalized Pump creation instruction.

The launch command uses the official Pump SDK to create a SOL-paired Token-2022 coin, with Mayhem and holder rewards disabled. It performs no developer buy, trade, migration, or creator-fee collection. It has a hard fee+rent budget, simulation before submission, one launch per invocation, durable intent records, and no public signing endpoint. An unattended agent scheduler, model provider, durable job queue, and production remote signer still need to be connected. This release is activation-ready infrastructure, not a claim that autonomous agents are operational.

## Verified facts versus interpretation

Creation data (mint, name, symbol, creator, payer, slot, block time, program invocation, finality) is read from Solana, never guessed from a token name. The archive checks both the payer and creator against the operator's registered agent wallet. This proves the wallet relationship, not that AI generated the content. AI narratives remain off-chain unless their content/hash is included in the immutable metadata. Market cap is derived data, not an intrinsic on-chain fact; absent an indexer it remains unavailable.

## Programs and services researched

- Official [Pump program](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md): `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.
- Official [create_v2 specification](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md) and [IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json): accounts and discriminator used by the verifier. SDK dependency is `@pump-fun/pump-sdk`, exact version recorded in backend/package-lock.json.
- Token-2022: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`; System and Associated Token programs are supplied by the official SDK. The SDK handles bonding-curve and other PDA derivation.
- [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction): finalized, successful transactions only, including versioned transactions and CPI creation instructions.
- [PumpPortal data API](https://pumpportal.fun/data-api/real-time/): third-party source, not the official Pump SDK. New-token events and trades have different access/fee rules. Trade streams require a funded API key; not silently enabled or billed by this site. Events must be reconciled at finalized commitment before archive admission.
- PumpSwap is downstream of graduation; direct trading and migration are outside this first launch service.

## Hosting

Build `node scripts/build-worker.mjs`. It packages the static site and read-only API into one Worker ESM artifact. Publish `build/.openai/hosting.json` and `build/server/index.js`. The backend launcher and signer dependencies are not included in the hosted browser or Worker bundle. Mainnet reads and external metadata providers can fail; the UI reports errors and does not substitute fictional records.
