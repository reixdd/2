import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadDotEnv(path.join(ROOT, '.env'));

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export function getConfig(env = process.env) {
  const dataDir = path.resolve(ROOT, env.DATA_DIR || './data');
  return {
    version: '0.2.0',
    port: num(env.PORT, 8787),
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    dataDir,
    localModelDir: path.resolve(ROOT, env.LOCAL_MODEL_DIR || './.models'),
    localThreads: Math.max(1, Math.min(8, num(env.LOCAL_THREADS, 4))),
    openrouter: { baseUrl: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', apiKey: env.OPENROUTER_API_KEY || '' },
    ollama: { baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434/v1' },
    openaiCompat: { baseUrl: env.OPENAI_COMPAT_BASE_URL || '', apiKey: env.OPENAI_COMPAT_API_KEY || '' },
    defaultTemperature: num(env.DEFAULT_TEMPERATURE, 0),
    defaultMaxTokens: num(env.DEFAULT_MAX_TOKENS, 4096),
    entryTimeoutMs: num(env.ENTRY_TIMEOUT_MS, 180000),
    maxConcurrentBattles: num(env.MAX_CONCURRENT_BATTLES, 3),
    maxEntrants: num(env.MAX_ENTRANTS, 6),
    manifestDir: path.join(here, 'manifest'),
  };
}
