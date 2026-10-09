import { CONTENDERS } from "./characters"

const CHAMPION_KEY = "colosseum:champion:v1"

/** Remembers the last champion this visitor looked at. Only a roster id is stored, never anything personal. */
export function loadLastChampion(storage: Pick<Storage, "getItem"> | null = safeStorage()): string | null {
  try {
    const id = storage?.getItem(CHAMPION_KEY)
    return id && CONTENDERS.some((c) => c.id === id) ? id : null
  } catch {
    return null
  }
}

export function saveLastChampion(id: string, storage: Pick<Storage, "setItem"> | null = safeStorage()) {
  if (!CONTENDERS.some((c) => c.id === id)) return
  try {
    storage?.setItem(CHAMPION_KEY, id)
  } catch {
    // Private browsing or full storage: the selection simply is not remembered.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}
