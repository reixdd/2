import {z} from "zod"
import {sha256} from "@noble/hashes/sha2.js"
import {bytesToHex} from "@noble/hashes/utils.js"
import {configFingerprint,composeInstructions,type BuildConfig} from "./builds"
import {getChallenge} from "./challenges"
import type {BattleRecord} from "./battle"
import {LOCAL_MODELS} from "./models"
const eventSchema=z.object({id:z.string(),type:z.enum(["battle_created","model_ready","challenge_started","output_streamed","output_completed","checker_completed","evidence_stored","battle_finished","failed","cancelled"]),at:z.number(),detail:z.string().optional()})
export type BattleEvent=z.infer<typeof eventSchema>
const schema=z.object({id:z.string().min(1),mode:z.enum(["local-ai","recorded"]),contenderId:z.string(),modelId:z.string(),modelRevision:z.string(),runtime:z.literal("Transformers.js 4.3.1 / ONNX WASM CPU"),challengeId:z.string(),challengeVersion:z.number().int().positive(),prompt:z.string(),inputIdentity:z.string().regex(/^[a-f0-9]{64}$/),buildId:z.string().nullable(),buildFingerprint:z.string(),configuration:z.object({contenderId:z.string(),modelId:z.string().nullable(),runtime:z.string(),soul:z.string(),skillIds:z.array(z.string()),toolIds:z.array(z.string()),knowledgeSources:z.array(z.string()),equipmentSlots:z.array(z.string().nullable()).optional()}).optional(),instructions:z.string(),parameters:z.object({temperature:z.literal(0),maxTokens:z.number().int().min(1).max(512)}),startedAt:z.number(),finishedAt:z.number(),initializationMs:z.number().nonnegative().optional(),latencyMs:z.number().nonnegative(),output:z.string(),tokens:z.number().nonnegative(),status:z.enum(["completed","failed","cancelled"]),correct:z.boolean().nullable(),extracted:z.string().nullable(),error:z.string().optional(),provenance:z.literal("visitor-device; client-controlled; not independently attested"),events:z.array(eventSchema).max(1000)})
export type LocalEvidence=z.infer<typeof schema>
const KEY="colosseum:local-ai-evidence:v1"
export function validateLocalEvidence(value:unknown):LocalEvidence{
 const e=schema.parse(value),c=getChallenge(e.challengeId),model=LOCAL_MODELS.find(m=>m.contenderId===e.contenderId&&m.modelId===e.modelId&&m.revision===e.modelRevision)
 if(!model)throw Error("Unknown model artifact or revision.")
 if(!c?.task||!c.available||e.challengeVersion!==(c.version??1))throw Error("Challenge/checker version mismatch.")
 if(e.prompt!==`${c.task.prompt}\n\n${c.task.instructions}`)throw Error("Challenge input differs from the registered prompt.")
 if(e.inputIdentity!==inputIdentity(e.prompt,e.instructions))throw Error("Input hash differs from captured instructions and challenge.")
 if(e.configuration){if(configFingerprint(e.configuration as BuildConfig)!==e.buildFingerprint||e.configuration.modelId!==e.modelId||e.configuration.contenderId!==e.contenderId)throw Error("Configuration fingerprint or identity mismatch.");if((composeInstructions(e.configuration)||"You are an AI contestant. Follow the requested answer format.")!==e.instructions)throw Error("Configuration instructions differ from captured system input.")}
 if(e.finishedAt<e.startedAt)throw Error("Invalid timing.")
 if(e.status==="completed"){const result=c.task.check(e.output);if(!e.output.trim()||e.correct!==result.correct||e.extracted!==result.extracted)throw Error("Checker verdict differs from the captured output.")}
 else if(e.correct!==null)throw Error("Failed/cancelled execution cannot carry a score.")
 return e
}
export function loadLocalEvidence():LocalEvidence[]{try{const raw=JSON.parse(localStorage.getItem(KEY)??"[]");if(!Array.isArray(raw))return [];return raw.flatMap(value=>{try{return[validateLocalEvidence(value)]}catch{return[]}})}catch{return[]}}
export async function saveLocalEvidence(e:LocalEvidence){validateLocalEvidence(e);const write=()=>{const all=loadLocalEvidence();localStorage.setItem(KEY,JSON.stringify([e,...all.filter(v=>v.id!==e.id)].slice(0,100)))};if(navigator.locks)await navigator.locks.request(KEY,write);else write()}
export function asBattleRecord(e:LocalEvidence,replay=false):BattleRecord{validateLocalEvidence(e);return {mode:replay?"recorded":"local-ai",contenderId:e.contenderId,challengeTitle:getChallenge(e.challengeId)!.name,prompt:e.prompt,answer:e.output,checker:`${e.challengeId} v${e.challengeVersion} · deterministic`,correct:e.correct,model:`${e.modelId}@${e.modelRevision}`,recordedAt:new Date(e.finishedAt).toISOString(),...(replay?{evidenceHref:`/battle-archive?record=${encodeURIComponent(e.id)}`}:{startedByVisitor:true})}}
export async function inputHash(prompt:string,instructions:string){const bytes=new TextEncoder().encode(JSON.stringify({prompt,instructions}));return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("")}

export function inputIdentity(prompt:string,instructions:string){return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({prompt,instructions}))))}
