import { webcrypto } from 'node:crypto';
import { MemoryStore } from '../server/lib/store-core.js';
import { bootstrap } from '../worker/bootstrap.js';
import { encode58, PUMP } from '../server/api.js';
globalThis.crypto ??= webcrypto;

export const clockAt = (start = Date.parse('2026-10-13T12:00:00Z')) => { const c = { t: start, now: () => c.t, advance: ms => { c.t += ms; } }; return c; };
export async function freshStore(clock = clockAt()) { const s = new MemoryStore(null, { clock: clock.now }); await bootstrap(s); return s; }
export const addr = n => encode58(Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + n * 13 + 1) % 255 + 1));
export const sig = n => encode58(Uint8Array.from({ length: 64 }, (_, i) => (i * 5 + n * 11 + 1) % 255 + 1));
export const USER = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const req = (path, { method = 'GET', headers = {}, body } = {}) => new Request('https://site.test' + path, { method, headers, body });

// Fixture finalized Pump fee transaction: `wallet` receives `lamports` (wallet is NOT the fee payer unless payer=true).
export function feeTx({ wallet, lamports, payer = false, program = PUMP, err = null, fee = 5000 }) {
  const keys = payer ? [wallet, addr(90), program] : [addr(91), wallet, program];
  const pre = [10_000_000_000, 1_000_000_000, 1], post = [...pre]; const wi = payer ? 0 : 1;
  post[wi] = pre[wi] + lamports - (payer ? fee : 0); if (!payer) post[0] = pre[0] - fee;
  return { slot: 1, blockTime: 1760000000, meta: { err, fee, preBalances: pre, postBalances: post, innerInstructions: [] }, transaction: { message: { accountKeys: keys.map(pubkey => ({ pubkey })), instructions: [{ programId: program, accounts: [], data: '' }] } } };
}
export const json = async response => { const r = await response; return { status: r.status, body: await r.json() }; };
