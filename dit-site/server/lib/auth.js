// Identity for voting. Browsers present a Supabase access token; we validate it with Supabase Auth (never trust a client-supplied user id).
// The hosted Site already uses NEXT_PUBLIC_SUPABASE_ANON_KEY; this key is public by design.
export const publicSupabaseKey = env => env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export class AuthError extends Error { constructor(m, status = 401) { super(m); this.status = status; } }
export function bearer(request) { const h = request.headers.get('authorization') || ''; const m = /^Bearer\s+(\S+)$/i.exec(h); return m ? m[1] : null; }

export async function verifySupabaseUser(env, token, fetchImpl = (...a) => fetch(...a)) {
  const anonKey = publicSupabaseKey(env);
  if (!env.SUPABASE_URL || !anonKey) throw new AuthError('Authentication is not configured', 503);
  const r = await fetchImpl(env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: anonKey, authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000) });
  if (r.status === 401 || r.status === 403) throw new AuthError('Session expired. Sign in again.');
  if (!r.ok) throw new AuthError('Authentication provider unavailable', 503);
  const u = await r.json();
  if (!u?.id || u.is_anonymous) throw new AuthError('Sign in with a verified email to vote.', 403);   // anonymous sign-ins cannot vote
  if (!u.email_confirmed_at && !u.confirmed_at) throw new AuthError('Confirm your email to vote.', 403);
  return { id: u.id, email: u.email };
}
// Local development only (DIT_DEV_AUTH=1): token "dev:<email>" maps to a stable pseudo user. Disabled whenever Supabase auth is configured.
export async function verifyDevUser(env, token) {
  if (env.DIT_DEV_AUTH !== '1' || env.SUPABASE_URL) throw new AuthError('Dev auth disabled', 401);
  const m = /^dev:([^\s@]+@[^\s@]+)$/.exec(token); if (!m) throw new AuthError('Invalid dev token');
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dev-user:' + m[1].toLowerCase()))).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x40; h[8] = (h[8] & 0x3f) | 0x80; const x = [...h].map(b => b.toString(16).padStart(2, '0')).join('');
  return { id: `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`, email: m[1] };
}
export function makeVerifier(env, fetchImpl) { return token => (env.DIT_DEV_AUTH === '1' && !env.SUPABASE_URL ? verifyDevUser(env, token) : verifySupabaseUser(env, token, fetchImpl)); }

// Best-effort per-key limiter (per isolate/process). The DB-side cooldown in cast_vote() is the authoritative control.
export class RateLimiter {
  constructor(max, windowMs, clock = Date.now) { this.max = max; this.windowMs = windowMs; this.clock = clock; this.hits = new Map(); }
  take(key) {
    const now = this.clock(); const arr = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);
    if (arr.length >= this.max) { this.hits.set(key, arr); return false; }
    arr.push(now); this.hits.set(key, arr); if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some(t => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}
