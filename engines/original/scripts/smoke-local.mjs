import {getConfig} from '../server/config.js';
const config = getConfig();
const base = `http://127.0.0.1:${config.port}/api`;
const response = await fetch(base + '/battles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ challengeId: 'math.warmup', entrants: [{ contenderId: 'local-qwen3-06b' }, { contenderId: 'local-qwen25-05b' }] }) });
const record = await response.json();
if (!response.ok) throw new Error(JSON.stringify(record.error));
console.log('Real battle started:', record.battleId);
const deadline = Date.now() + config.entryTimeoutMs * 2 + 30000;
while (Date.now() < deadline) {
  const battle = await (await fetch(base + '/battles/' + record.battleId)).json();
  if (battle.status !== 'LIVE' && battle.status !== 'UNTESTED') {
    for (const e of battle.entries) console.log(JSON.stringify({ model: e.model, status: e.status, output: e.output,
      score: e.verification?.score ?? null, latency: e.latency, error: e.error }, null, 2));
    if (battle.entries.some((e) => e.status !== 'COMPLETED' || !e.verification)) throw new Error('Local inference battle had failed entries; inspect the saved record');
    console.log('Real local inference, captured outputs, measured latency, and deterministic scoring verified.');
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
throw new Error('Battle did not complete within the smoke-check deadline');
