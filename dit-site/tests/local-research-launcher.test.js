import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ps=readFileSync(new URL('../scripts/Start-DIT-Local-Research.ps1',import.meta.url),'utf8');
const cmd=readFileSync(new URL('../START-DIT-LOCAL-RESEARCH.cmd',import.meta.url),'utf8');
test('local research launcher never touches hosted database or creates secrets',()=>{
 assert.match(ps,/DIT_STORE='file'/);
 assert.match(ps,/DIT_STORE_FILE=/);
 assert.match(ps,/DIT_JARVIS_SHARED='1'/);
 assert.match(ps,/DIT_AUTONOMOUS='1'/);
 assert.match(ps,/DIT_START_SCHEDULER='0'/);
 assert.match(ps,/DIT_SIMULATION_ENABLED='1'/);
 assert.match(ps,/EXISTING DIT_SIMULATION_SECRET/);
 assert.match(ps,/SUPABASE_SERVICE_ROLE_KEY=''/);
 assert.doesNotMatch(ps,/(?:RandomNumberGenerator|Get-Random|generate.*secret|wallet.?sign|token.?launch)/i);
 assert.match(cmd,/Start-DIT-Local-Research\.ps1/);
});
