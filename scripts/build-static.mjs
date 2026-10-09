import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import './prepare-public.mjs';
const root=path.resolve(import.meta.dirname,'..');
const stage=fs.mkdtempSync(path.join(root,'../.colosseum-static-'));
try{
 const skip=new Set(['node_modules','tests','.next-phase4','.runtime-cache','.next','out','public-dist','.validation','test-results','playwright-report','.git','.agents']);
 fs.cpSync(root,stage,{recursive:true,filter:src=>!path.relative(root,src).split(path.sep).some(p=>skip.has(p)||p.endsWith('.tsbuildinfo'))});
 fs.rmSync(path.join(stage,'app/api'),{recursive:true,force:true});
 fs.symlinkSync(path.join(root,'node_modules'),path.join(stage,'node_modules'),'dir');
 execFileSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:stage,env:{...process.env,COLOSSEUM_STATIC_EXPORT:'1',NEXT_PUBLIC_COLOSSEUM_BASE_PATH:process.env.COLOSSEUM_BASE_PATH||'',NEXT_PUBLIC_COLOSSEUM_STATIC:'1',COLOSSEUM_LIVE_INFERENCE:'disabled',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
 fs.rmSync(path.join(root,'public-dist'),{recursive:true,force:true});fs.cpSync(path.join(stage,'out'),path.join(root,'public-dist'),{recursive:true});
 console.log('Static website exported to public-dist. API routes are retained in source but excluded from this export.');
}finally{fs.rmSync(stage,{recursive:true,force:true})}
