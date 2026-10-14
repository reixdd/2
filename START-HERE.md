# Put COLOSSEUM online for free

The completed demo does not need your home computer, an AI API key or a paid database. Models run on the visitor's device after download consent. Practice, missions and recorded battles work without model downloads.

Cloudflare is the simplest manual route:

1. Sign up or sign in at https://dash.cloudflare.com/.
2. Open **Workers & Pages → Create application → Pages → Direct Upload / Upload assets**.
3. Choose a site name, upload **COLOSSEUM-PHASE4-SITE.zip**, and click **Deploy**.
4. Share the free `pages.dev` address Cloudflare supplies.

Upload the SITE ZIP, not the SOURCE ZIP. Keep `COLOSSEUM-PHASE4-SOURCE.zip` as your complete recovery copy. All eleven skills, source, tests and the original engine are included.

GitHub rejected automatic Pages activation with HTTP 403 because the connected integration lacks Pages administration permission. No live public URL is claimed yet.

A GitHub project Pages build can be generated with `COLOSSEUM_BASE_PATH=/2 pnpm build:public`. The tested `gh-pages` branch is prepared. Enable it in https://github.com/reixdd/2/settings/pages using **Deploy from a branch → gh-pages → /(root) → Save**. Only share the URL after GitHub reports a successful deployment.

Try: select a model → Forge → equip and save → practice a challenge → inspect the animated evidence → Ledger Island → complete a mission → Journal. Optional local generation is slow and requires substantial memory; the smallest download is SmolLM2 (~185 MB plus runtime). Published recordings include incorrect results. No worldwide rankings are claimed, and hosting/model-hosting service limits still apply.
