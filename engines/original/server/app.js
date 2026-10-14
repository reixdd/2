import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { listChallenges, publicChallenge, DISCIPLINES } from './challenges/index.js';
import { aggregate } from './results.js';
import { HttpError } from './engine.js';

const MIME = { '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'too_large', 'Request body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'bad_json', 'Body is not valid JSON')); } });
    req.on('error', reject);
  });
}

export function createApp({ config, providers, engine, contenders, store, characters, staticDir }) {
  const summary = (b) => ({
    battleId: b.battleId, challengeId: b.challengeId, title: b.challenge.title, discipline: b.challenge.discipline, status: b.status,
    createdAt: b.createdAt, startedAt: b.startedAt, completedAt: b.completedAt,
    entries: b.entries.map((e) => ({ entryId: e.entryId, label: e.label, status: e.status, score: e.verification?.score ?? null, passed: e.verification?.passed ?? null, totalMs: e.latency.totalMs })),
  });

  async function health() {
    const out = {};
    for (const [id, p] of Object.entries(providers)) {
      const configured = p.isConfigured();
      if (!configured) { out[id] = { configured, reachable: null, reason: p.notConfiguredReason }; continue; }
      const cat = await p.listModels();
      out[id] = { configured, reachable: cat.ok, modelCount: cat.ok ? cat.models.size : null, error: cat.ok ? null : cat.error };
    }
    return { status: 'ok', version: config.version, time: new Date().toISOString(), uptimeSec: Math.round(process.uptime()), liveBattles: engine.activeCount(), storage: { dir: store.dir, battles: store.all().length }, providers: out };
  }

  function sse(req, res, battleId) {
    const battle = store.get(battleId);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    send('snapshot', battle);
    if (battle.status !== 'LIVE' && battle.status !== 'UNTESTED') { send('done', battle); return res.end(); }
    const onEvent = (ev) => {
      if (ev.battleId !== battleId) return;
      if (ev.type === 'battle' && ev.data.final) { send('battle', { status: ev.data.status, completedAt: ev.data.completedAt }); send('done', ev.data.final); cleanup(); res.end(); }
      else send(ev.type, ev.data);
    };
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    const cleanup = () => { clearInterval(ping); engine.events.off('event', onEvent); };
    engine.events.on('event', onEvent);
    req.on('close', cleanup);
  }

  function serveStatic(req, res, pathname) {
    if (!staticDir || !fs.existsSync(staticDir)) return false;
    let rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    let file = path.join(staticDir, path.normalize(rel));
    const relative = path.relative(staticDir, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin === config.clientOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'api') {
        if (req.method === 'GET' && serveStatic(req, res, url.pathname)) return;
        throw new HttpError(404, 'not_found', 'Not found');
      }
      const [, a, b, c] = parts;
      if (req.method === 'GET' && a === 'health' && !b) return json(200, await health());
      if (req.method === 'GET' && a === 'contenders' && !b) return json(200, { generatedAt: new Date().toISOString(), contenders: await contenders.describeAll() });
      if (characters && req.method === 'GET' && a === 'characters' && !c) {
        if (!b) return json(200, { generatedAt: new Date().toISOString(), characters: await characters.build() });
        const character = await characters.get(b);
        if (!character) throw new HttpError(404, 'unknown_character', `No character "${b}"`);
        return json(200, character);
      }
      if (characters && req.method === 'GET' && a === 'genealogy' && !b) return json(200, { nodes: await characters.genealogy() });
      if (req.method === 'GET' && a === 'challenges' && !b) return json(200, { disciplines: DISCIPLINES, challenges: listChallenges().map(publicChallenge) });
      if (req.method === 'GET' && a === 'results' && !b) return json(200, aggregate(store.all()));
      if (a === 'battles') {
        if (req.method === 'POST' && !b) {
          const body = await readJson(req);
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'bad_request', 'Battle request must be a JSON object');
          const battle = await engine.createBattle({ challengeId: body.challengeId, entrants: body.entrants });
          return json(202, battle);
        }
        if (req.method === 'GET' && !b) return json(200, { battles: store.all().map(summary) });
        if (req.method === 'GET' && b) {
          const battle = store.get(b);
          if (!battle) throw new HttpError(404, 'unknown_battle', `No battle "${b}"`);
          if (c === 'stream') return sse(req, res, b);
          if (!c) return json(200, battle);
        }
      }
      throw new HttpError(404, 'not_found', 'Not found');
    } catch (err) {
      if (res.headersSent) return res.end();
      if (!(err instanceof HttpError)) console.error('[api]', err);
      json(err.status || 500, { error: { code: err.code || 'internal_error', message: err.status ? err.message : 'Internal error', details: err.details } });
    }
  });
}
