import { NextResponse } from "next/server"
import { authorizeLiveInference } from "@/lib/colosseum/mode"
import { handleTrialRequest } from "@/lib/colosseum/trial-handler"
import { gatewayProvider, getProbe, limiter, recordProbe } from "@/lib/colosseum/runtime-server"

export const maxDuration = 60

export async function POST(request: Request) {
  const result = await handleTrialRequest(request, {
    authorize: authorizeLiveInference,
    provider: gatewayProvider,
    limiter,
    getProbe,
    recordProbe,
  })
  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}
