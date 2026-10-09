import {LOCAL_MODELS,type LocalModel} from "./models"
export type DeviceState="untested"|"downloading"|"initializing"|"ready"|"generating"|"verified"|"failed"|"cancelled"|"unsupported"
export type DeviceStatus={state:DeviceState;detail:string;progress?:number;initializedAt?:number;initializationMs?:number;lastGenerationMs?:number;verifiedAt?:number;error?:string}
export function supportedDevice(){return typeof Worker!=="undefined"&&typeof WebAssembly!=="undefined"}
/** The worker exists only after explicit model-download consent. No hosted inference path. */
export class LocalRuntime {
 private worker:Worker|null=null;private seq=0;private modelId:string|null=null;
 private pending=new Map<number,{resolve:(v:{tokens:number}|null)=>void;reject:(e:Error)=>void;progress?:(p:{text:string;progress:number;status:string})=>void;delta?:(text:string)=>void}>()
 cancel(){this.worker?.terminate();this.worker=null;this.modelId=null;for(const p of this.pending.values())p.reject(Error("Cancelled by visitor."));this.pending.clear()}
 private request(type:string,payload:Record<string,unknown>,progress?:(p:{text:string;progress:number;status:string})=>void,delta?:(s:string)=>void){
  if(!this.worker){this.worker=new Worker('/runtime/local-worker.js',{type:'module'});this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;if(data.type==='progress')p.progress?.(data.report);else if(data.type==='delta')p.delta?.(data.text);else{this.pending.delete(data.id);data.type==='error'?p.reject(Error(data.message)):p.resolve(data.result)}};this.worker.onerror=e=>{const error=Error(e.message||"Local worker failed. Try practice or replay.");for(const p of this.pending.values())p.reject(error);this.pending.clear();this.worker?.terminate();this.worker=null;this.modelId=null}}
  const id=++this.seq;return new Promise<{tokens:number}|null>((resolve,reject)=>{this.pending.set(id,{resolve,reject,progress,delta});this.worker!.postMessage({id,type,...payload})})
 }
 async load(model:LocalModel,signal:AbortSignal,onStatus:(s:DeviceStatus)=>void){
  if(!LOCAL_MODELS.some(m=>m.modelId===model.modelId&&m.revision===model.revision))throw Error("Unapproved model artifact.")
  if(!supportedDevice())throw Error("This browser needs WebAssembly and Web Workers. Practice still works.")
  if(signal.aborted)throw Error("Cancelled by visitor.");const abort=()=>this.cancel();signal.addEventListener('abort',abort,{once:true});
  const t=performance.now();onStatus({state:'downloading',detail:'Fetching approved artifacts after your consent…'});
  try{await this.request('load',{model:model.modelId,revision:model.revision},p=>onStatus({state:p.status==='done'?'initializing':'downloading',detail:p.status==='done'?'Initializing the ONNX runtime…':p.text,progress:p.progress}));this.modelId=model.modelId;onStatus({state:'ready',detail:'Runtime initialized. A genuine evaluated generation is still required for verification.',initializedAt:Date.now(),initializationMs:performance.now()-t})}finally{signal.removeEventListener('abort',abort)}
 }
 async generate(model:LocalModel,messages:{role:string;content:string}[],maxTokens:number,signal:AbortSignal,onDelta:(s:string)=>void){
  if(this.modelId!==model.modelId)throw Error('Prepare this model first.');if(signal.aborted)throw Error('Cancelled by visitor.');const abort=()=>this.cancel();signal.addEventListener('abort',abort,{once:true});const t=performance.now();let output='';
  try{const result=await this.request('run',{model:model.modelId,messages,maxTokens},undefined,text=>{output+=text;onDelta(text)});if(!output.trim())throw Error('The model returned an empty output. No score assigned.');return{output,tokens:result?.tokens??0,latencyMs:performance.now()-t}}finally{signal.removeEventListener('abort',abort)}
 }
}
