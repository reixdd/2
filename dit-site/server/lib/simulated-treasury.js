// Isolated PRETEND creator-fee demo. Never alters verified balances or launches a token.
import { PG, StoreError } from './store-core.js';
const SOURCE='dit_simulation',LIMIT=1000;
export function parseSimulatedAmount(v){
 if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,9})?$/.test(v))throw Error('fee_amount_sol must be a decimal string with at most nine fractional digits');
 const [a,b='']=v.split('.'),n=Number(BigInt(a)*1000000000n+BigInt(b.padEnd(9,'0')));
 if(!Number.isSafeInteger(n)||n<=0||n>1000_000_000_000)throw Error('fee_amount_sol must be positive and at most 1000 SOL');
 return n;
}
export function splitSimulatedFee(n){
 if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid simulated fee');
 const t=Number(BigInt(n)*25n/100n);return {treasury_lamports:t,other_lamports:n-t};
}
export async function simulationOverview(store,enabled){
 if(!enabled)return {enabled:false,simulated:true,event_count:0,totals:null,limitation:'Simulation disabled'};
 const rows=await store.select('circuit_events',{filters:[['source','eq',SOURCE]],order:['received_at','desc'],limit:LIMIT});
 const sum=k=>rows.reduce((n,r)=>n+Number(r.payload?.[k]||0),0);
 return {enabled:true,simulated:true,event_count:rows.length,capped:rows.length===LIMIT,latest_event_at:rows[0]?.received_at||null,totals:{fee_lamports:sum('fee_lamports'),treasury_lamports:sum('treasury_lamports'),other_lamports:sum('other_lamports'),transferred_lamports:0},limitation:'Only pretend fee events. No transfers. Preview of latest 1000 events.'};
}
export async function ingestSimulatedFee(store,body){
 if(!body||Array.isArray(body)||typeof body!=='object'||typeof body.event_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.event_id))throw Error('event_id must be 1–100 letters, numbers, underscores or hyphens');
 const fee=parseSimulatedAmount(body.fee_amount_sol),split=splitSimulatedFee(fee);
 const old=await store.select('circuit_events',{filters:[['source','eq',SOURCE],['external_id','eq',body.event_id]],limit:1});
 if(old.length)return old[0].payload?.fee_lamports===fee?{duplicate:true,event_id:body.event_id,simulated:true,...split,fee_lamports:fee}:{conflict:true};
 try{await store.insert('circuit_events',{source:SOURCE,external_id:body.event_id,event_type:'simulated_creator_fee',payload:{fee_lamports:fee,...split,simulated:true},signature_valid:false,status:'processed',processed_at:new Date().toISOString()})}
 catch(e){
  if(!(e instanceof StoreError)||e.code!==PG.UNIQUE)throw e;
  // Another request may win after our initial read. Compare its persisted amount.
  const winner=await store.select('circuit_events',{filters:[['source','eq',SOURCE],['external_id','eq',body.event_id]],limit:1});
  if(!winner.length)throw e;
  return winner[0].payload?.fee_lamports===fee?{duplicate:true,event_id:body.event_id,simulated:true,...split,fee_lamports:fee}:{conflict:true};
 }
 return {created:true,event_id:body.event_id,simulated:true,...split,fee_lamports:fee};
}
export async function simulationAuthorized(req,env){
 const secret=env.DIT_SIMULATION_SECRET;
 if(typeof secret!=='string'||secret.length<32)return false;
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([hash('Bearer '+secret),hash(req.headers.get('authorization')||'')]);
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0;
}
