# V7 production handoff – responsive 2.5D pass

Source: `reixdd/2` branch `dit-3d-assets`, `dit-site/`. Release files retain the attached character art. The active scene uses transparent portraits and uniform pointer movement, an interactive parallax city, animated vertical bars and lightweight accent light. Podiums were intentionally removed as a design direction, and prototype GLBs remain in `dit-assets/`. No new data, token signing, worker logic or payment functionality was added.

Check `START-HERE.md` for startup and `/api/config` checks. Hosted Supabase secrets and migrations are environment-side requirements; the GitHub commit cannot set or validate them. Do not overwrite `.env` or `.data/` or expose service keys. The local identity is for testing only. Browser screenshots need testing in a supported real Chromium environment, as the current container cannot start Chromium.

## Current launch handoff
The owner-private Sites deployment is updated. The reviewed implementation is on fix/dit-cinematic-restoration; see docs/FINAL-LAUNCH.md for verification and remaining upstream artwork/local publisher limitations. Preserve local environment, data and models.
