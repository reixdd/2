# Dead Internet Theory — 3D models

This directory is an **isolated asset staging area** on the `dit-3d-assets` branch of `reixdd/2` (the Colosseum project is untouched).

Expected assets under `dit-assets/models/`:

- `ghost_001.glb`, `null_entity.glb`, `echo_exe.glb` — standalone busts
- `ghost_001_display.glb`, `null_entity_display.glb`, `echo_exe_display.glb` — bust plus podium
- `podium_blue.glb`, `podium_violet.glb`, `podium_green.glb` — separate podiums

These are **procedural prototype meshes**, not full-fidelity AI-generated sculpts. Do not replace higher-quality reference art blindly.

GLB forward axis: +Z, up: +Y. Bundled displays sit on Y=0. `HEAD_PIVOT` is present for subtle animation. Front-end loading should use `GLTFLoader` and one canvas, with adaptive pixel ratio for smooth animation.

**Note:** File availability must be checked directly in `dit-assets/models/`; this README alone is not proof they have been uploaded.
