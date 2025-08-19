import { Storage } from "@plasmohq/storage"

import type { HiddenEntry, PairId, PairSymbols } from "~/types"

const storage = new Storage({ area: "local" })
const KEY = "hiddenPairs:v1"

export async function getHiddenSet(): Promise<Set<PairId>> {
  const arr = (await storage.get<HiddenEntry[]>(KEY)) || []
  return new Set(arr.map((e) => e.id))
}

export async function getHiddenList(): Promise<HiddenEntry[]> {
  return (await storage.get<HiddenEntry[]>(KEY)) || []
}

export async function hidePair(
  id: PairId,
  url: string,
  pairSymbols?: PairSymbols,
  chain?: string
) {
  const list = await getHiddenList()
  if (!list.find((e) => e.id === id)) {
    list.push({ id, chain, symbols: pairSymbols, url, ts: Date.now() })
    await storage.set(KEY, list)
  }
}

export async function unhidePair(id: PairId) {
  const list = await getHiddenList()
  const next = list.filter((e) => e.id !== id)
  await storage.set(KEY, next)
}

export async function clearAllHidden() {
  await storage.set(KEY, [])
}
