# Grand Line V6 → Dead Internet Theory: deliberate port, not a theme swap

The supplied **GRAND_LINE_V6_COMPLETED** repository was reviewed alongside DIT v2.
The repositories are different stacks (Next.js/React vs. DIT vanilla JS + API/Worker), so a
forced source-file merge would break hosting. The following interaction systems were ported
as plain JavaScript concepts, preserving the DIT backend and all verification guards.

| Grand Line feature reviewed | DIT counterpart |
| --- | --- |
| `components/luffy-host.tsx` + `lib/use-luffy.ts` — featured character, docked contextual dialogue | Single three-agent control-room, agent-click dossiers and *only server-recorded* activity speech bubble. No synthetic AI dialogue on idle. |
| `components/crew-rail.tsx` — compact crew selection and progression | Three always-visible agent nameplates, worker state and authenticated voting progress, without duplicated portraits. |
| `components/arcade-scene.tsx`, `lib/use-arcade-interactions.ts` — responsive 3D and pointer interaction | Preserved and retinted DIT Three.js stage with per-agent accent light, existing GLB optional model support, pointer tracking and reduced-motion behavior. |
| `components/live-center.tsx` — context instead of a wall of cards | Treasury, transmissions and verified-launch summary beside stage in compact, always-visible panels. |
| `components/unlock-cinematic.tsx` + `app/page.tsx` — react to authenticated new activity | Subtle event pulse and speech when the **backend records a newly arrived event**, not an invented token launch. |
| `app/api/world/route.ts` — source-of-truth API state | Existing `/api/agents`, `/api/activity`, `/api/network`, `/api/proposals`, `/api/treasury` and `/api/verify`. No Grand Line market-cap progression or webhook unlocking logic is imported, because those business rules do not describe DIT. |

## New DIT interaction layout

- Site-wide fixed `hero.webp` dystopian city image, dimmed and neutralized behind dark glass.
- One compact control-room: Three.js stage + vote nameplates, treasury + activity + chain summary.
- Network, activity and health are **drawers**, keeping the main experience within a typical desktop viewport.
- The empty standalone archive section is removed. Verified tokens remain available in **Network**, with individual evidence routes only when the backend really holds verified records. Research proposals appear in a separate Network tab and are never called launched coins.
- Portraits remain 2D parallax until rigged GLB files are provided. Nothing on screen claims real articulated facial animation.

## Not ported

Grand Line's Luffy frame animation, price-based crew unlocks, soundboard, gambling-like excitement
loops and actual token market cap triggers are intentionally **not** brought across. DIT's
agents develop through research observations and verified state, not unrelated price triggers.

## Run

From project root: `npm test`, `npm run build`, `npm run dev`, open `http://localhost:4173`.
On Windows double-click `START-DIT-WINDOWS.cmd` after extraction.
With no credentials, agent generation is not enabled; voting is local test-only when
`DIT_DEV_AUTH=1`, and all balances are verification-only accounting.
