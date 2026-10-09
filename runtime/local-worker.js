// Adapted from the retained original CPU worker. Model revisions are allowlisted.
import { pipeline, TextStreamer, env } from '@huggingface/transformers';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.useWasmCache = false;
env.backends.onnx.wasm.wasmPaths = {
 mjs: new URL('../wasm/ort-wasm-simd-threaded.mjs',self.location.href).href,
 wasm: new URL('../wasm/ort-wasm-simd-threaded.wasm',self.location.href).href,
};
const allowed = new Map([
 ['onnx-community/Qwen3-0.6B-ONNX','1e0a4a196ecabdf9a879664110574563d3f372d3'],
 ['onnx-community/Qwen2.5-0.5B-Instruct','22942cb7d7ba4cc81bb4673549ca4d4614469b5e'],
 ['onnx-community/SmolLM2-135M-Instruct-ONNX','b8a5c0f183b78c55955a5364f610c36668b5e681'],
]);
let generator, model;
self.onmessage = async ({data}) => {
 try {
  if(data.type==='load') {
   if(allowed.get(data.model)!==data.revision)throw Error('Model artifact/revision is not approved.');
   if(generator&&model!==data.model){await generator.dispose();generator=null;}
   // Pipeline metadata helpers in Transformers.js 4.3.1 do not forward revision.
   // Pin the URL template too, so config, tokenizer, HEAD and weight requests all use this commit.
   env.remotePathTemplate = `{model}/resolve/${data.revision}/`;
   if(!generator)generator=await pipeline('text-generation',data.model,{device:'wasm',dtype:'q4',revision:data.revision,progress_callback:p=>self.postMessage({type:'progress',id:data.id,report:{progress:(p.progress??0)/100,text:`${p.status}${p.file?' · '+p.file:''}`,status:p.status,file:p.file}})});
   model=data.model;
  }else if(data.type==='run') {
   if(!generator||data.model!==model)throw Error('Model is not initialized.');
   let tokens=0;
   const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>self.postMessage({type:'delta',id:data.id,text}),token_callback_function:t=>{tokens+=t.length}});
   await generator(data.messages,{max_new_tokens:data.maxTokens,do_sample:false,return_full_text:false,streamer});
   self.postMessage({type:'done',id:data.id,result:{tokens}});return;
  }else throw Error('Unknown local worker action.');
  self.postMessage({type:'done',id:data.id,result:null});
 }catch(e){self.postMessage({type:'error',id:data.id,message:e?.message??String(e)})}
};
