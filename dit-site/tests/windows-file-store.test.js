import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openFileStore } from '../server/lib/store-file.js';

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dit-win-save-'));
const run = async (fn) => { const d=mk(); try { await fn(d); } finally { fs.rmSync(d,{recursive:true,force:true}); } };
const item = {agent_id:'GHOST_001',kind:'episodic',content:'Observed an authentic web trend',summary:'Verified evidence only'};

test('Windows EPERM during rename is retried without losing a saved memory', async () => run(async dir => {
  const file=path.join(dir, 'dit-store.json');
  let attempts=0;
  const store=openFileStore(file, {io: {
    writeFile:(...args)=>fs.promises.writeFile(...args),
    rename:async (...args)=> {
      attempts++;
      if(attempts <= 3) { const e=new Error('Windows antivirus temporarily locked the file');e.code='EPERM';throw e; }
      return fs.promises.rename(...args);
    }
  }});
  await store.insert('agent_memories', item);
  await store.flush();
  assert.equal(attempts, 4);
  assert.equal(store.persistenceStatus.pending, false);
  const reloaded=openFileStore(file);
  assert.equal((await reloaded.select('agent_memories')).length, 1);
}));

test('recovery reads a newer valid V6 interrupted .tmp without deleting original data', async () => run(async dir => {
  const file=path.join(dir,'dit-store.json');
  const initial=openFileStore(file);
  await initial.insert('agent_memories', item);
  await initial.flush();
  const old=fs.readFileSync(file,'utf8');
  const more=initial.snapshot();
  more.t.agent_memories.push({...more.t.agent_memories[0],id:'a-recovered-record'});
  fs.writeFileSync(file+'.tmp',JSON.stringify(more));
  const later=new Date(Date.now()+10000);
  fs.utimesSync(file+'.tmp',later,later);
  const reopened=openFileStore(file);
  assert.equal((await reopened.select('agent_memories')).length,2);
  await reopened.flush();
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).t.agent_memories.length,2);
  assert.equal(JSON.parse(old).t.agent_memories.length,1);
}));

test('ignores incomplete temporary writes while preserving last valid committed state', async () => run(async dir => {
  const file=path.join(dir,'dit-store.json');
  const initial=openFileStore(file);
  await initial.insert('agent_memories', item);
  await initial.flush();
  fs.writeFileSync(file+'.tmp','{"t":');
  const later=new Date(Date.now()+10000);fs.utimesSync(file+'.tmp',later,later);
  const reopened=openFileStore(file);
  assert.equal((await reopened.select('agent_memories')).length,1);
}));

test('serializes rapid snapshots so the final database contains the latest changes', async () => run(async dir => {
  const file=path.join(dir,'dit-store.json');
  const store=openFileStore(file);
  await Promise.all(Array.from({length:25}, (_,i)=>store.insert('agent_memories',{...item, summary:'memory '+i})));
  await store.flush();
  const reloaded=openFileStore(file);
  assert.equal((await reloaded.select('agent_memories')).length,25);
  assert.equal(store.persistenceStatus.pending,false);
}));
