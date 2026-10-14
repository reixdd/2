import {describe,it,expect} from 'vitest'
import {importBuild,exportBuild} from '@/lib/colosseum/build-store'
import {LOCAL_MODELS} from '@/lib/colosseum/models'
const original={id:'original',name:'Recovered',contenderId:'capybara-sage',skillIds:['proof-scaffolding'],parentId:'older',revision:3,fingerprint:'untrusted old identity',createdAt:'2026-01-01T00:00:00Z',history:[{revision:2,skillIds:[],at:'2026-01-01T00:00:00Z',note:'Original note'}]}
const wrap=(build:unknown)=>JSON.stringify({format:'colosseum-build',version:1,build})
describe('explicit original-overlay recovery',()=>{
 it('preserves the full original and ancestry without inventing a missing parent revision',()=>{const b=importBuild(wrap(original));expect(b.id).toBe('overlay:original');expect(b.parentId).toBe('overlay:older');expect(b.parentVersion).toBeNull();expect(b.legacySource?.original).toEqual(original);expect(b.revisions[0].version).toBe(2);expect(b.config.modelId).toBe(LOCAL_MODELS[0].modelId)})
 it('round-trips provenance and unknown ancestry in current build exports',()=>{const b=importBuild(wrap(original));expect(importBuild(exportBuild(b))).toEqual(b)})
 it('rejects unknown instructions, models and invalid source dates rather than dropping them',()=>{expect(()=>importBuild(wrap({...original,skillIds:['unknown']}))).toThrow();expect(()=>importBuild(wrap({...original,contenderId:'unknown'}))).toThrow();expect(()=>importBuild(wrap({...original,createdAt:'unknown'}))).toThrow()})
 it('keeps a previous fourth socket as a legacy loadout',()=>{const b=importBuild(wrap({...original,skillIds:['proof-scaffolding','socratic-inquiry','fermi-estimation','narrative-voice']}));expect(b.config.skillIds).toHaveLength(4)})
})
