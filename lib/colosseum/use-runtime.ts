"use client"

import { useCallback, useState } from "react"
import useSWR from "swr"
import { FREE_MODE_DEFAULT, type PublicMode } from "./mode-shared"
import type { RuntimeStatus } from "./runtime"

interface RuntimeResponse {
  mode: PublicMode
  statuses: Record<string, RuntimeStatus>
  limits: {
    maxOutputTokens: number
    requestTimeoutMs: number
    maxRequestsPerWindow: number
    windowMinutes: number
    freeBattleFighters: number
  }
}

async function fetchRuntime(url: string): Promise<RuntimeResponse> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Runtime check failed (${response.status}).`)
  return response.json()
}

/** Reads provider readiness (free) and lets the visitor opt in to a live probe (one tiny paid request). */
export function useRuntime() {
  const { data, error, isLoading, mutate } = useSWR<RuntimeResponse>(process.env.NEXT_PUBLIC_COLOSSEUM_STATIC === "1" ? null : "/api/runtime", fetchRuntime, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const [verifying, setVerifying] = useState<Record<string, boolean>>({})

  const verify = useCallback(
    async (contenderId: string) => {
      if (process.env.NEXT_PUBLIC_COLOSSEUM_STATIC === "1") return { error: "Model requests are disabled in the static launch." }
      setVerifying((prev) => ({ ...prev, [contenderId]: true }))
      try {
        const response = await fetch("/api/runtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenderId }),
        })
        const body = (await response.json().catch(() => null)) as { status?: RuntimeStatus; error?: string } | null
        if (body?.status) {
          await mutate(
            (current) =>
              current ? { ...current, statuses: { ...current.statuses, [contenderId]: body.status! } } : current,
            { revalidate: false },
          )
        }
        return body
      } finally {
        setVerifying((prev) => ({ ...prev, [contenderId]: false }))
      }
    },
    [mutate],
  )

  const statuses: Record<string, RuntimeStatus> = Object.fromEntries(
    Object.entries(data?.statuses ?? {}).map(([id, status]) => [
      id,
      verifying[id] ? { ...status, state: "loading" as const, detail: "Sending one live probe request..." } : status,
    ]),
  )

  // Until the server says otherwise, assume free mode: the safe default never offers paid actions.
  const mode: PublicMode = data?.mode ?? FREE_MODE_DEFAULT

  return { mode, statuses, limits: data?.limits, isLoading, error, verify, refresh: () => mutate() }
}
