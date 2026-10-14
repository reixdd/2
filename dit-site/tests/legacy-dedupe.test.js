import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';import path from 'node:path';
import { openFileStore } from '../server/lib/store-file.js';
test('legacy duplicate jobs recover without losing audit history',async()=>{
 const d=mkdtempSync(path.join(os.tmpdir(),'dit-dedupe-'));try{
 const file=path.join(d,'snapshot.json');
 writeFileSync(file,JSON.stringify({seq:{},t:{agent_jobs:[{id:'a',dedupe_key:'cycle:GHOST:1',status:'succeeded'},{id:'b',dedupe_key:'cycle:GHOST:1',status:'dead'}],activity_events:[{id:1,title:'prior duplicate error'}]}}));
 const store=openFileStore(file);
 const rows=await store.select('agent_jobs');
 assert.equal(new Set(rows.map(j=>j.dedupe_key)).size,2);
 assert.equal(rows.find(j=>j.status==='succeeded').dedupe_key,'cycle:GHOST:1');
 assert.equal((await store.select('activity_events')).length,1);
 }finally{rmSync(d,{recursive:true,force:true});}
});
