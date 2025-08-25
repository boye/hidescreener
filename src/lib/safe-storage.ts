// Safe wrappers around the real storage functions with an in-memory cache.
// Purpose: avoid hitting chrome.storage during transient SPA updates
// (which can throw "Extension context invalidated") and keep the UI responsive.

import {
  clearAllHidden as realClearAllHidden,
  getHiddenList as realGetHiddenList,
  getHiddenSet as realGetHiddenSet,
  hidePair as realHidePair,
  unhidePair as realUnhidePair
} from "~/lib/storage"
import type { HiddenEntry, PairId, PairSymbols } from "~types"

let cache = new Set<string>()
let listCache: { id: string; ts: number }[] = []

export async function initHiddenCache(): Promise<Set<string>> {
  try {
    const s = await realGetHiddenSet()
    cache = new Set(s)
  } catch (e) {
    console.debug(
      "[safe-storage] initHiddenCache fallback to existing cache",
      e
    )
  }
  return new Set(cache)
}

export function getCachedHidden(): Set<string> {
  // return a copy to avoid external mutation
  return new Set(cache)
}

export async function safeGetHiddenSet(): Promise<Set<string>> {
  try {
    const s = await realGetHiddenSet()
    cache = new Set(s)
  } catch (e) {
    console.debug("[safe-storage] safeGetHiddenSet fallback", e)
    // keep cache as-is
  }
  return new Set(cache)
}

export async function safeGetHiddenList(): Promise<HiddenEntry[]> {
  try {
    listCache = await realGetHiddenList()
  } catch (e) {
    console.debug("[safe-storage] safeGetHiddenList fallback", e)
  }
  // @ts-ignore
  return [...listCache]
}

export async function safeHidePair(
  id: PairId,
  url: string,
  pairSymbols?: PairSymbols,
  chain?: string
) {
  cache.add(id)
  try {
    await realHidePair(id, url, pairSymbols, chain)
  } catch (e) {
    console.debug("[safe-storage] safeHidePair storage failed", e)
  }
}

export async function safeUnhidePair(id: string) {
  cache.delete(id)
  try {
    await realUnhidePair(id)
  } catch (e) {
    console.debug("[safe-storage] safeUnhidePair storage failed", e)
  }
}

export async function safeClearAll() {
  cache.clear()
  try {
    await realClearAllHidden()
  } catch (e) {
    console.debug("[safe-storage] safeClearAll storage failed", e)
  }
}
