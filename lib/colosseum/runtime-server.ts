import { gateway, generateText } from "ai"
import { CONTENDERS, type Contender } from "./characters"
import { LIMITS, createDefaultLimiter } from "./limits"
import { assertLiveInferenceEnabled } from "./mode"
import {
  classifyRuntimeError,
  resolveRuntimeStatus,
  type GenerateRequest,
  type GenerateResult,
  type ProbeRecord,
  type RuntimeProvider,
  type RuntimeStatus,
} from "./runtime"

export const gatewayProvider: RuntimeProvider = {
  id: "vercel-ai-gateway",
  label: "Vercel AI Gateway",
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    // Last line of defense: even a route that forgot to authorize cannot reach the paid provider in free mode.
    assertLiveInferenceEnabled()
    const result = await generateText({
      model: request.modelId,
      system: request.system,
      prompt: request.prompt,
      maxOutputTokens: request.maxOutputTokens,
      maxRetries: 0,
      timeout: request.timeoutMs,
      abortSignal: request.abortSignal,
    })
    return {
      text: result.text,
      usage: {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
      },
    }
  },
}

interface ServerState {
  catalog: { ids: Set<string>; at: number } | null
  probes: Map<string, ProbeRecord>
  limiter: ReturnType<typeof createDefaultLimiter>
}

// Survives dev-server module reloads so quota counters are not reset on every edit.
const globalKey = Symbol.for("colosseum.runtime-state")
const globalStore = globalThis as unknown as Record<symbol, ServerState | undefined>
const state: ServerState =
  globalStore[globalKey] ??
  (globalStore[globalKey] = { catalog: null, probes: new Map(), limiter: createDefaultLimiter() })

export const limiter = state.limiter

const CATALOG_TTL_MS = 10 * 60_000

async function loadCatalog(): Promise<Set<string> | null> {
  const now = Date.now()
  if (state.catalog && now - state.catalog.at < CATALOG_TTL_MS) return state.catalog.ids
  try {
    const { models } = await gateway.getAvailableModels()
    state.catalog = { ids: new Set(models.map((m) => m.id)), at: now }
    return state.catalog.ids
  } catch {
    return state.catalog?.ids ?? null
  }
}

export function getProbe(modelId: string) {
  return state.probes.get(modelId) ?? null
}

export function recordProbe(modelId: string, record: ProbeRecord) {
  state.probes.set(modelId, record)
}

export async function getRuntimeStatuses(
  contenders: Contender[] = CONTENDERS,
  options: { consultGateway: boolean } = { consultGateway: false },
): Promise<Record<string, RuntimeStatus>> {
  const catalog = options.consultGateway ? await loadCatalog() : null
  const now = Date.now()
  return Object.fromEntries(
    contenders.map((contender) => [
      contender.id,
      resolveRuntimeStatus(contender, {
        catalog,
        probe: contender.modelId ? getProbe(contender.modelId) : null,
        now,
        probeTtlMs: LIMITS.probeTtlMs,
      }),
    ]),
  )
}

/** One tiny live request. This is the only way a model is ever marked "ready". */
export async function probeModel(modelId: string, provider: RuntimeProvider = gatewayProvider): Promise<ProbeRecord> {
  const start = Date.now()
  try {
    await provider.generate({
      modelId,
      system: "Reply with the single word OK.",
      prompt: "OK?",
      maxOutputTokens: 16,
      timeoutMs: LIMITS.requestTimeoutMs,
    })
    const record: ProbeRecord = { ok: true, at: Date.now(), latencyMs: Date.now() - start }
    recordProbe(modelId, record)
    return record
  } catch (error) {
    const { kind, message } = classifyRuntimeError(error)
    const record: ProbeRecord = { ok: false, at: Date.now(), latencyMs: Date.now() - start, errorKind: kind, detail: message }
    recordProbe(modelId, record)
    return record
  }
}
