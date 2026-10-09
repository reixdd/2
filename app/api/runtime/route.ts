import { NextResponse } from "next/server"
import { getContender } from "@/lib/colosseum/characters"
import { LIMITS } from "@/lib/colosseum/limits"
import { authorizeLiveInference, getPublicMode } from "@/lib/colosseum/mode"
import {
  clientIdFromRequest,
  isSameOriginRequest,
  liveInferenceRefusal,
} from "@/lib/colosseum/trial-handler"
import { getRuntimeStatuses, limiter, probeModel } from "@/lib/colosseum/runtime-server"

export const maxDuration = 60

/** Free and side-effect free. In free mode it never contacts the AI Gateway, not even for the model catalog. */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const mode = getPublicMode()
  const statuses = await getRuntimeStatuses(undefined, { consultGateway: mode.live })
  return NextResponse.json({
    mode,
    statuses,
    limits: {
      maxOutputTokens: LIMITS.maxOutputTokens,
      requestTimeoutMs: LIMITS.requestTimeoutMs,
      maxRequestsPerWindow: LIMITS.maxRequestsPerWindow,
      windowMinutes: Math.round(LIMITS.windowMs / 60_000),
      freeBattleFighters: LIMITS.freeBattleFighters,
    },
  })
}

/** Runs one tiny live request so a fighter can be marked Ready. Authorized callers only; counts against the same quota as trials. */
export async function POST(request: Request) {
  if (!authorizeLiveInference(request).allowed) {
    const refusal = liveInferenceRefusal()
    return NextResponse.json(refusal.body, { status: refusal.status })
  }
  const body = (await request.json().catch(() => null)) as { contenderId?: unknown } | null
  const contender = typeof body?.contenderId === "string" ? getContender(body.contenderId) : undefined
  if (!contender) return NextResponse.json({ error: "Unknown contender." }, { status: 404 })
  if (!contender.modelId) {
    return NextResponse.json({ error: contender.unavailableReason ?? "No runtime is connected." }, { status: 409 })
  }

  const lease = limiter.acquire(clientIdFromRequest(request))
  if (!lease.ok) {
    return NextResponse.json(
      { error: lease.message, limit: lease.reason },
      { status: 429, headers: { "Retry-After": String(lease.retryAfterSec) } },
    )
  }
  try {
    await probeModel(contender.modelId)
  } finally {
    lease.release()
  }

  const statuses = await getRuntimeStatuses([contender], { consultGateway: true })
  return NextResponse.json({ status: statuses[contender.id] })
}
