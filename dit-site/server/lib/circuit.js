// Circuit webhook verification + event normalisation.
// IMPORTANT: public Circuit documentation could not be located/verified when this was written. The signature scheme (HMAC-SHA256 of the raw body)
// and the payload shape below are an explicit, configurable CONTRACT of this project, not confirmed Circuit behaviour.
// Until the real scheme is confirmed, events from this endpoint stay 'observed' and nothing is allocated until chain confirmation succeeds.
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}
export async function verifyWebhook(env, headers, rawBody, now = Date.now()) {
  const secret = env.CIRCUIT_WEBHOOK_SECRET; if (!secret) return { ok: false, reason: 'not_configured' };
  const sig = (headers.get(env.CIRCUIT_SIGNATURE_HEADER || 'x-circuit-signature') || '').replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return { ok: false, reason: 'bad_signature_format' };
  const tsHeader = env.CIRCUIT_TIMESTAMP_HEADER || 'x-circuit-timestamp'; const ts = headers.get(tsHeader);
  let signed = rawBody;
  if (ts) {   // optional replay protection: signed payload is `${timestamp}.${body}`
    const t = Number(ts) * (Number(ts) < 1e12 ? 1000 : 1); const tol = Number(env.CIRCUIT_TOLERANCE_SECONDS || 300) * 1000;
    if (!Number.isFinite(t) || Math.abs(now - t) > tol) return { ok: false, reason: 'stale_timestamp' };
    signed = `${ts}.${rawBody}`;
  } else if (env.CIRCUIT_REQUIRE_TIMESTAMP === '1') return { ok: false, reason: 'missing_timestamp' };
  return timingSafeEqual(await hmacHex(secret, signed), sig) ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}
// Expected normalised shape: { id, type, data:{ tx_signature, wallet, lamports, mint? } }
export function normalizeFeeEvent(p) {
  const id = p?.id ?? p?.event_id; const type = p?.type ?? p?.event; const d = p?.data ?? p?.payload ?? {};
  const sig = d.tx_signature ?? d.signature; const wallet = d.wallet ?? d.recipient; const raw = d.lamports ?? d.amount_lamports;
  if (typeof id !== 'string' || !id || id.length > 200) throw new Error('event id missing');
  if (typeof type !== 'string' || !type) throw new Error('event type missing');
  const isFee = /creator[_.-]?fee/i.test(type);
  if (!isFee) return { id, type, kind: 'other' };
  if (typeof sig !== 'string' || typeof wallet !== 'string') throw new Error('fee event needs tx signature and wallet');
  const lamports = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;      // accept numeric strings, reject floats (no "0.5 SOL")
  if (!Number.isSafeInteger(lamports) || lamports < 0) throw new Error('fee event amount must be integer lamports');
  return { id, type, kind: 'creator_fee', signature: sig, wallet, lamports, mint: typeof d.mint === 'string' ? d.mint : null };
}
