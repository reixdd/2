// Small typed validators. Each returns the cleaned value or throws ValidationError (HTTP 400/422).
import { AGENT_IDS, CATEGORIES } from './agents.js';
export class ValidationError extends Error { constructor(m) { super(m); this.status = 422; } }
const bad = m => { throw new ValidationError(m); };
export const isAgentId = v => AGENT_IDS.includes(v);
export function agentId(v) { return isAgentId(v) ? v : bad('Unknown agent'); }
export function limit(v, def = 50, max = 200) { const n = v == null || v === '' ? def : Number(v); return Number.isInteger(n) && n > 0 ? Math.min(n, max) : bad('Invalid limit'); }
export function lamports(v, label = 'amount') { return Number.isSafeInteger(v) && v >= 0 ? v : bad(`${label} must be a non-negative integer number of lamports`); }
export function text(v, label, { min = 1, max = 500 } = {}) {
  if (typeof v !== 'string') bad(`${label} must be text`);
  const s = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/g, '').trim();   // control + bidi override characters
  return s.length >= min && s.length <= max ? s : bad(`${label} must be ${min}-${max} characters`);
}
export const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const SOL_SIG = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
export function solAddress(v, label = 'address') { return typeof v === 'string' && SOL_ADDR.test(v) ? v : bad(`${label} is not a valid Solana address`); }
export function solSignature(v) { return typeof v === 'string' && SOL_SIG.test(v) ? v : bad('Not a valid Solana signature'); }
export function category(v) { return CATEGORIES.includes(v) ? v : 'general'; }

// Launch limits mirror backend/launch.mjs (name <= 32 bytes, symbol <= 13 bytes).
const enc = new TextEncoder();
export function proposalDraft(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) bad('Concept must be a JSON object');
  const name = text(o.name, 'name', { min: 2, max: 32 }); const ticker = text(String(o.ticker ?? '').replace(/^\$/, ''), 'ticker', { min: 2, max: 13 }).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(ticker)) bad('ticker must be A-Z and 0-9 only');
  if (enc.encode(name).length > 32 || enc.encode(ticker).length > 13) bad('name/ticker exceed launch limits');
  const evidence = Array.isArray(o.evidence_ids) ? o.evidence_ids.filter(x => typeof x === 'string') : [];
  const conf = Number(o.confidence); 
  return { name, ticker, narrative: text(o.narrative, 'narrative', { min: 20, max: 600 }), aesthetic_direction: text(o.aesthetic_direction, 'aesthetic_direction', { min: 10, max: 400 }),
    transmission: text(o.transmission, 'transmission', { min: 10, max: 500 }), rationale: text(o.rationale, 'rationale', { min: 20, max: 800 }),
    reasoning_summary: text(o.reasoning_summary, 'reasoning_summary', { min: 20, max: 600 }), evidence_ids: evidence, confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5 };
}
