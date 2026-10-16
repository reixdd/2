# DIT simulated treasury

This is a simulation-only API and visible DIT treasury preview, not a live coin, real external webhook or wallet transfer. Existing verified /api/treasury and /api/integrations/circuit are unchanged.

Set DIT_SIMULATION_ENABLED=1 and a private server-only DIT_SIMULATION_SECRET of at least 32 characters in a local/staging environment. It is disabled by default. Never expose the secret in Git or browser code.

Start the local DIT backend as usual. Run node scripts/demo-simulated-fees.mjs with the same secret in that process environment. It sends one mock creator-fee event for 0.36 SOL to http://127.0.0.1:4173/api/simulations/creator-fees.

POST /api/simulations/creator-fees accepts JSON {"event_id":"unique-event","fee_amount_sol":"0.36"} with Authorization: Bearer (private secret). GET /api/treasury/simulated returns the separate pretend ledger. Duplicate events are idempotent; conflicting amounts are rejected. Test records go to the existing circuit_events table as source dit_simulation; fee_receipts and verified treasury_ledger remain untouched. The preview is capped at 1000 events and displays TEST ONLY.
