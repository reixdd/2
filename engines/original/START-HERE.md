# Put COLOSSEUM online for free

You only need a browser and a free Cloudflare account. No API key, paid domain, code commands, or home server.

1. Open https://dash.cloudflare.com/sign-up and create a free account (or sign in).
2. Open **Workers & Pages**. Choose **Create application**, then **Pages**, then **Upload assets / Direct Upload**. The labels may vary; select a Pages website upload rather than a Worker script.
3. Name it `colosseum-arena` (or another available name).
4. Upload **colosseum-public-site.zip** from the deliverables. Upload the ZIP itself, not the source-code ZIP.
5. Click **Deploy / Publish**. Cloudflare gives you a free address ending in **pages.dev**. Share that address.

On the site, leave **CPU · widest compatibility** selected, load a model, select its contender checkbox, and run **The First Sigil**. Load both models to compare them. This downloads real model weights and then runs inference on the visitor's device. Mobile memory and speed vary; model failures are reported rather than replaced with simulated results. Compatible devices can also select GPU mode.

Your home connection never serves visitors. Their browser computes their trial and saves their evidence locally. Use Wi-Fi for model downloads. No global verified rankings are claimed from visitor-controlled records.

If the Cloudflare screen differs, tell me the labels you see and I can map the next click. GitHub publication was unavailable because its connected integration cannot create a new repository; Cloudflare Direct Upload avoids that permission requirement.
