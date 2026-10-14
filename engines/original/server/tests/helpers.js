// TEST INFRASTRUCTURE ONLY: a local fake OpenAI-compatible server so the real adapter,
// engine, scoring and HTTP API can be exercised end to end without any network or API key.
// Behaviour is selected by the requested model name. This is never used outside tests.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listChallenges } from '../challenges/index.js';
import { createOpenAICompatibleProvider } from '../providers/openaiCompatible.js';
import { createContenderService } from '../contenders.js';
import { createStore } from '../store.js';
import { createEngine } from '../engine.js';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { createCharacterService } from '../characters.js';

export function startFakeProvider() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: ['good', 'bad', 'boom', 'slow', 'thinker'].map((id) => ({ id })) }));
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body);
      const user = j.messages.find((m) => m.role === 'user').content;
      const ch = listChallenges().find((c) => c.user === user);
      const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      if (j.model === 'boom') { res.writeHead(500); return res.end('upstream exploded'); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      if (j.model === 'slow') { return; } // never answers → engine timeout
      const sysSeen = j.messages[0].content;
      let text;
      if (j.model === 'bad') text = 'I think FINAL: 12345';
      else text = `Working it out…\nFINAL: ${ch.referenceAnswer}`;
      if (j.model === 'thinker') text = `<think>maybe FINAL: 0</think>\nFINAL: ${ch.referenceAnswer}`;
      if (sysSeen.includes('MUTATION-MARKER')) text = 'FINAL: 0';
      const chunks = text.match(/.{1,7}/gs);
      let i = 0;
      const tick = () => {
        if (i < chunks.length) { send({ choices: [{ delta: { content: chunks[i++] } }] }); return setTimeout(tick, 2); }
        send({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: chunks.length } });
        res.write('data: [DONE]\n\n'); res.end();
      };
      tick();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/v1` })));
}

export async function makeStack({ timeoutMs = 3000, port = 0, staticDir } = {}) {
  const fake = await startFakeProvider();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'colosseum-'));
  const config = { ...getConfig({}), dataDir, entryTimeoutMs: timeoutMs, clientOrigin: 'http://localhost:5173' };
  const providers = {
    fake: createOpenAICompatibleProvider({ id: 'fake', label: 'Fake', baseUrl: fake.url }),
    openrouter: createOpenAICompatibleProvider({ id: 'openrouter', label: 'OpenRouter', baseUrl: 'http://127.0.0.1:1', requiresKey: true, notConfiguredReason: 'OPENROUTER_API_KEY is not set on the server' }),
  };
  const mk = (id, model, extra = {}) => ({ id, name: id, family: 'Test', kind: 'model', provider: 'fake', model, integrated: true, ...extra });
  const manifest = [
    mk('good', 'good'), mk('bad', 'bad'), mk('boom', 'boom'), mk('slow', 'slow'),
    mk('thinker', 'thinker', { kind: 'agent', base: 'good', config: { systemPrompt: 'be careful' } }),
    mk('ghost', 'ghost'), // not in catalog → must be non-operational
    mk('or', 'x/y', { provider: 'openrouter' }), // no key → non-operational
    mk('slot', null, { provider: null, integrated: false, note: 'Reserved slot' }),
  ];
  const store = createStore(dataDir);
  const contenders = createContenderService({ manifest, providers, config, getBattles: store.all });
  const engine = createEngine({ config, providers, contenders, store });
  const cast = { disclaimer: 'test', families: { Test: { characterName: 'Test Hero', archetype: 'tester', artKey: 'qwen' } },
    contenders: { thinker: { characterName: 'Thinker Child', artKey: 'qwen-research', inheritedTraits: ['palette'] } } };
  const characters = createCharacterService({ cast, contenders, getBattles: store.all, dataDir,
    artDir: new URL('../../client/public/art', import.meta.url).pathname });
  const app = createApp({ config, providers, engine, contenders, store, characters, staticDir });
  await new Promise((r) => app.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const close = () => { app.close(); fake.server.close(); app.closeAllConnections?.(); fake.server.closeAllConnections?.(); };
  return { base, close, store, engine, contenders, characters, dataDir };
}

export async function waitForBattle(base, id, ms = 10000) {
  const t0 = Date.now();
  for (;;) {
    const b = await (await fetch(`${base}/api/battles/${id}`)).json();
    if (b.status !== 'LIVE' && b.status !== 'UNTESTED') return b;
    if (Date.now() - t0 > ms) throw new Error('battle did not finish');
    await new Promise((r) => setTimeout(r, 25));
  }
}
