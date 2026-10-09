import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const hfRequire=createRequire(require.resolve('@huggingface/transformers'));
const ort=path.dirname(hfRequire.resolve('onnxruntime-web'));
fs.mkdirSync(path.join(root,'public/runtime'),{recursive:true});fs.mkdirSync(path.join(root,'public/wasm'),{recursive:true});
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])fs.copyFileSync(path.join(ort,name),path.join(root,'public/wasm',name));
await build({entryPoints:[path.join(root,'runtime/local-worker.js')],outfile:path.join(root,'public/runtime/local-worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false,define:{'process.env.NODE_ENV':'"production"'}});
// This text-only allowlist never uses the Mistral vision adapter. Its public 32-character
// class identifier triggers GitHub credential scanning, so omit that unused registration.
// Transform generated output only; never modify dependency sources or model artifacts.
const workerFile=path.join(root,'public/runtime/local-worker.js'),compiled=fs.readFileSync(workerFile,'utf8');
const unusedRow=/\[\s*['"]mistral3['"]\s*,\s*['"]Mistral3ForConditionalGeneration['"]\s*\],?/g;
if([...compiled.matchAll(unusedRow)].length!==1)throw Error('Review the updated browser registry before packaging.');
fs.writeFileSync(workerFile,compiled.replace(unusedRow,''));
console.log('Browser CPU worker and WASM prepared. No model weights included.');
