import {z} from 'zod'
import {getContender} from './characters'
import {configForContender,BUILD_LIMITS,type AgentBuild} from './builds'
const time=z.string().refine(v=>Number.isFinite(Date.parse(v)),'Invalid original timestamp')
const legacy=z.object({id:z.string().min(1).max(90),name:z.string().min(1).max(60),contenderId:z.string(),skillIds:z.array(z.string()).max(4),revision:z.number().int().positive(),parentId:z.string().max(90).nullable(),createdAt:time,updatedAt:time.optional(),history:z.array(z.object({revision:z.number().int().positive(),skillIds:z.array(z.string()).max(4),at:time}).passthrough()).max(200).optional()}).passthrough()
/** Explicit import only. Keep the exact old record; never infer a missing parent revision. */
export function recoverOverlayBuild(value:unknown):AgentBuild {
 const row=legacy.parse(value),contender=getContender(row.contenderId);if(!contender)throw Error('Unknown legacy model identity.')
 const config={...configForContender(contender),skillIds:row.skillIds}
 const notes=['Reconstructed using current adapter and instruction definitions; no historical evaluation equivalence is claimed.']
 if(row.parentId)notes.push('The original parent revision was not recorded; ancestry revision remains unknown.')
 if(row.name.length>BUILD_LIMITS.maxNameLength)notes.push('Display name shortened; original name retained below.')
 return {id:`overlay:${row.id}`,name:row.name.trim().slice(0,BUILD_LIMITS.maxNameLength),config,version:row.revision,parentId:row.parentId?`overlay:${row.parentId}`:null,parentVersion:null,createdAt:Date.parse(row.createdAt),updatedAt:Date.parse(row.updatedAt??row.createdAt),revisions:(row.history??[]).slice(-BUILD_LIMITS.maxRevisions).reverse().map(h=>({version:h.revision,savedAt:Date.parse(h.at),config:{...configForContender(contender),skillIds:h.skillIds}})),legacySource:{format:'claude-overlay-v1',original:row,notes}}
}
