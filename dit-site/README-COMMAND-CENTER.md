# DEAD INTERNET THEORY — Machine Control / Grand Line-inspired compact UI

This is an **actual frontend refactor** of the DIT v2 ZIP, using Grand Line V6's
featured-character, reactions, progression rail and compact game UI principles.
It does NOT replace the existing research backend, databases, voting rules, or verification APIs.

## Changes you can see

1. Site-wide darkened dystopian city background (`dist/assets/hero.webp`).
2. Only ONE set of the three agents: the existing animated 3D/parallax stage,
   with a voting/progress row directly beneath each character. No portrait cards
   repeated under it and no second huge voting-board grid.
3. Separate muted accents: GHOST ice blue, NULL soft violet, ECHO sage green.
   Red tint, red beams and red particles removed from the Three.js stage.
4. Agent memory dossier by clicking a portrait or PROFILE; vote by clicking VOTE.
   A sign-in drawer replaces the intrusive email sign-in form.
5. 25% creator-fee accounting, real activity and verified-token count visible next
   to the agents. Panel drawers contain in-depth network/proposal/verification,
   transmissions, treasury and provider health. Desktop is intended to fit without
   endless vertical scrolling; mobile stacks panels for accessibility.
6. The empty standalone archive section is gone. Actual verified coins can still
   open `/api/evidence/<mint>` via the `#evidence/<mint>` route. There is a separate
   proposals tab for concepts that have not actually launched.
7. On new authenticated server activity, one machine displays a short actual event
   message and the bottom signal bar pulses. No fabricated dialogue.

## Start on Windows

Extract ZIP, enter `proj`, run `START-DIT-WINDOWS.cmd`, browse `http://localhost:4173`.
Make sure Node.js 22+ is installed. No app rebuild or npm installation is needed
for the local file-backed server; only the standalone Pump SDK launcher has its own
separate pinned dependencies.

## Important environment constraints

- Research worker, file/Supabase storage and endpoints remain as provided in v2.
- `.env.example` documents services and keys. API keys are not shipped or inserted.
- 25% allocation is a **target/accounting view**, not an executed Circuit transfer.
- A real pump.fun coin and production Circuit integration have **not** been created.
- This remains a prototype, with no autonomous live-money deployments.
- Portraits are 2D texture planes unless corresponding GLB models exist.
- The GLB/Three.js renderer loads Three.js from a CDN and gracefully falls back
  to the original portrait images when WebGL/CDN isn't available.
- `display.woff2` and `mono.woff2` were absent from the provided v2 ZIP; this
  build uses fallback fonts unless you add your own licensed originals.
- Automated browser screenshot capture was unavailable in this environment;
  verify the aesthetic and sizing on your own desktop browser.

## Verify

```bash
npm test
npm run build
npm run dev
```

See `docs/GRANDLINE_TO_DIT.md` for exactly what was carried over from Grand Line V6.
