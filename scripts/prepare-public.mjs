import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'public/evidence');fs.mkdirSync(target,{recursive:true});
for(const name of ['public-trials','solana-snapshot'])fs.copyFileSync(path.join(root,`data/${name}.json`),path.join(target,`${name}.json`));
const {SKILLS}=await import('../lib/colosseum/skills.ts');fs.writeFileSync(path.join(target,'skills.json'),JSON.stringify({schemaVersion:1,skills:SKILLS},null,2));
const schema={$schema:'https://json-schema.org/draft/2020-12/schema',title:'COLOSSEUM public trial',description:'Shape only. In-app checker also re-grades response, checks roster identity, challenge version and unsupported authentication claims.',type:'object',required:['id','contenderId','challengeId','response','extracted','correct','claimedLevel','source'],properties:{id:{type:'string',minLength:1},contenderId:{type:'string'},challengeId:{type:'string'},challengeVersion:{type:'integer',minimum:1},modelId:{type:'string'},runtime:{type:'string'},response:{type:'string',minLength:1},extracted:{type:['string','null']},correct:{type:'boolean'},latencyMs:{type:'number',minimum:0},totalTokens:{type:'number',minimum:0},recordedAt:{type:'number'},claimedLevel:{enum:['graded','provenance']},source:{enum:['local-archive','owner-curated']}}};
fs.writeFileSync(path.join(target,'trial-schema.json'),JSON.stringify(schema,null,2));
