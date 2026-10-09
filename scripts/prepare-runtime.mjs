import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const hfRequire=createRequire(require.resolve('@huggingface/transformers'));
const ort=path.dirname(hfRequire.resolve('onnxruntime-web'));
fs.mkdirSync(path.join(root,'public/runtime'),{recursive:true});fs.mkdirSync(path.join(root,'public/wasm'),{recursive:true});
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])fs.copyFileSync(path.join(ort,name),path.join(root,'public/wasm',name));
// The allowlist contains text-only Qwen/SmolLM models. Exclude an unused VLM registration
// whose 32-character public class name triggers GitHub's Mistral credential detector.
// Dependency files are read-only; this transform applies only to the browser bundle.
const approvedRegistry={name:'text-only-browser-registry',setup(bundler){bundler.onLoad({filter:/models\/registry\.js$/},async({path:filename})=>{
 const original=fs.readFileSync(filename,'utf8'),row=/\[\s*['"]mistral3['"]\s*,\s*['"]Mistral3ForConditionalGeneration['"]\s*\],?/g;
 if([...original.matchAll(row)].length!==1)throw Error('Review the updated Transformers registry before bundling.');
 return {contents:original.replace(row,''),loader:'js'};
})}};
await build({plugins:[approvedRegistry],entryPoints:[path.join(root,'runtime/local-worker.js')],outfile:path.join(root,'public/runtime/local-worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false,define:{'process.env.NODE_ENV':'"production"'}});
console.log('Browser CPU worker and WASM prepared. No model weights included.');
