import { createHash, timingSafeEqual } from "node:crypto"
import {
  ADMIN_HEADER,
  ADMIN_TOKEN_ENV,
  LIVE_INFERENCE_ENABLED_VALUE,
  LIVE_INFERENCE_ENV,
  MIN_ADMIN_TOKEN_LENGTH,
  type PublicMode,
} from "./mode-shared"

/**
 * Server-only. Decides whether a request may cause paid model inference.
 *
 * The default is DENY. A request is allowed only when all three hold:
 *   1. COLOSSEUM_LIVE_INFERENCE is exactly "enabled"
 *   2. COLOSSEUM_ADMIN_TOKEN is configured and long enough to resist guessing
 *   3. the request carries a matching x-colosseum-admin header
 *
 * The token is never sent to the browser and is not part of any client bundle. Public pages cannot
 * authorize themselves, so the website stays free regardless of which component sends a request.
 */

export type Env = Record<string, string | undefined>

export type DenialCode = "live-disabled" | "not-configured" | "missing-credential" | "invalid-credential"

export type LiveAuthorization = { allowed: true } | { allowed: false; code: DenialCode }

function digest(value: string) {
  return createHash("sha256").update(value).digest()
}

function configuredToken(env: Env) {
  const token = env[ADMIN_TOKEN_ENV]
  return token && token.length >= MIN_ADMIN_TOKEN_LENGTH ? token : null
}

export function isLiveInferenceEnabled(env: Env = process.env) {
  return env[LIVE_INFERENCE_ENV] === LIVE_INFERENCE_ENABLED_VALUE
}

/** What the browser may learn: whether live testing exists at all. Never the credential. */
export function getPublicMode(env: Env = process.env): PublicMode {
  return { live: isLiveInferenceEnabled(env) && configuredToken(env) !== null }
}

export function authorizeLiveInference(request: Request, env: Env = process.env): LiveAuthorization {
  if (!isLiveInferenceEnabled(env)) return { allowed: false, code: "live-disabled" }
  const token = configuredToken(env)
  if (!token) return { allowed: false, code: "not-configured" }
  const presented = request.headers.get(ADMIN_HEADER)
  if (!presented) return { allowed: false, code: "missing-credential" }
  const matches = timingSafeEqual(digest(presented), digest(token))
  return matches ? { allowed: true } : { allowed: false, code: "invalid-credential" }
}

/** Defense in depth for code paths that reach the provider without going through a route. */
export function assertLiveInferenceEnabled(env: Env = process.env) {
  if (!getPublicMode(env).live) {
    throw new Error("Live model inference is disabled in free public mode.")
  }
}
