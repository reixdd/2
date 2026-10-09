import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root,'client/public/wasm');
fs.mkdirSync(dir, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) fs.copyFileSync(path.join(root,'node_modules/onnxruntime-web/dist',file),path.join(dir,file));
