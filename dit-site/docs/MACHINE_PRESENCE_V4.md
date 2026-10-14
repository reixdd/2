# DIT V4 / MACHINE PRESENCE

This is a character-centered interaction pass, **not** a new crypto trading dashboard.

## Grand Line systems reused as ideas

- One featured character display rather than duplicating character cards.
- Character reactions linked to known state/event changes, like the Luffy host.
- Gesture-unlocked, optional WebAudio UI tones inspired by Grand Line's audio deck.
- Contextual reveal/dossier with sound and pointer feedback, and no autoplay.

DIT continues to use **three distinct agents**, whose character plates and WebGL sprites are
shown against a shared city backdrop. The original art is still 2D; GLB models may be dropped
into `dist/assets/models/` to replace the parallax sprites when those assets exist.

## JARVIS cross-reference

The connected GitHub repository `reixdd/1` is JARVIS Clean Rebuild Step 3. Its `MemoryBrain`
maintains classes such as OBSERVATION and AGENT_CONCLUSION with evidence references, and
its `AgentTeam` consumes canonical evidence without owning token transactions. DIT preserves
that separation: sources/observations -> ranked signal -> evidence-backed memory -> concept
proposal; actual launch signing remains outside the research UI.

## Cycle duplicate-key fix

Old versions used two partial unique indexes (`active` and `succeeded`) for `agent_jobs`. After
success, a cycle could be requeued under the same dedupe key, then fail with
`duplicate key (dedupe_key)` when it tried to succeed.

V4 fixes this in three places:
1. `worker/scheduler.js` checks for every prior job state, not just active jobs.
2. Local `MemoryStore` requires logical job IDs to be unique across all job states.
3. `supabase/migrations/0003_job_dedupe_repair.sql` preserves duplicate history and replaces
   the partial unique indexes with a single all-status unique index.

**For Supabase:** apply migrations 0001, 0002, then 0003 in sequence. If you have already
applied the first two, apply only 0003. Never drop a production database to fix a UI bug.

**For local state:** file-based storage loads and safely rewrites legacy duplicated job keys
without losing activity, observations, memories, or vote records.

Existing historical `job_dead` events will remain in the audit trail; they are not evidence of a
new failure after the fix. A worker with no LLM key legitimately records research-only cycles.

## What was and was not tested

- `npm test` runs all current unit/integration tests including dedupe regression tests.
- `npm run build` produces the Worker bundle.
- Local server routes can be smoke-tested with `npm run dev` and `curl`.
- This environment's managed Chromium blocks both localhost and file:// visits; visual
  rendering, WebGL GPU behavior and real sound playback still require testing in your browser.
- No live Coin/Circuit transfers, automatic deployments, or live AI model calls were performed.

## Run

On Windows: double-click `START-DIT-WINDOWS.cmd`, open `http://localhost:4173`.
On other systems: `npm run dev`.

Click `SOUND OFF` to enable synthesized interface cues. It defaults off, respects reduced-motion
settings and never plays before you explicitly turn it on. No third-party sound files needed.

To connect the research model, securely configure the provider credentials on the server/worker;
do not add secrets to the frontend or GitHub.
