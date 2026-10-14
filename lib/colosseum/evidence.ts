export interface EvidenceEntry {
  id: string
  timestamp: number
  challengeId: string
  challengeName: string
  discipline: string
  contenderId: string
  contenderName: string
  skillId?: string | null
  skillName?: string | null
  correct: boolean
  latencyMs: number
  extracted: string | null
  response: string
  status?: "complete" | "error" | "cancelled" | "unavailable"
  error?: string
  /** Provenance for real runs. Older entries predate these fields. */
  modelId?: string
  runtime?: string
  challengeVersion?: number
  totalTokens?: number
}

const STORAGE_KEY = "colosseum:evidence:v1"

export function loadEvidence(): EvidenceEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EvidenceEntry[]) : []
  } catch {
    return []
  }
}

export function appendEvidence(entry: EvidenceEntry) {
  if (typeof window === "undefined") return
  const current = loadEvidence()
  const next = [entry, ...current].slice(0, 200)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearEvidence() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}
