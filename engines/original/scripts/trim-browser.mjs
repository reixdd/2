import fs from 'node:fs';
import path from 'node:path';
for (const dir of ['dist','public-dist','github-dist']) {
  const assets = path.resolve(import.meta.dirname, '..','client',dir,'assets');
  if (!fs.existsSync(assets)) continue;
  // ONNX's upstream bundle includes an unused asyncify fallback. The CPU worker
  // explicitly uses our self-hosted standard SIMD runtime (see wasm-worker.js).
  // Remove only that unused binary to respect Pages' 25 MiB per-file limit.
  for (const file of fs.readdirSync(assets)) if (/^ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(file)) fs.unlinkSync(path.join(assets,file));
}
