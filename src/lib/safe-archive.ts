// Safe, cached wrappers around archive storage to avoid extension-context glitches
import {
  archiveIds as realArchiveIds,
  clearArchive as realClearArchive,
  getArchiveList as realGetArchiveList,
  getArchiveSet as realGetArchiveSet,
  unarchiveId as realUnarchiveId,
  type ArchiveEntry
} from "./archive"

let archSetCache = new Set<string>()
let archListCache: ArchiveEntry[] = []

export async function initArchiveCache() {
  try {
    archSetCache = await realGetArchiveSet()
  } catch {}
  try {
    archListCache = await realGetArchiveList()
  } catch {}
}

export function getCachedArchiveSet(): Set<string> {
  return new Set(archSetCache)
}
export function getCachedArchiveList(): ArchiveEntry[] {
  return [...archListCache]
}

export async function safeGetArchiveSet(): Promise<Set<string>> {
  try {
    archSetCache = await realGetArchiveSet()
  } catch {}
  return new Set(archSetCache)
}
export async function safeGetArchiveList(): Promise<ArchiveEntry[]> {
  try {
    archListCache = await realGetArchiveList()
  } catch {}
  return [...archListCache]
}

export async function safeArchiveIds(ids: string[]) {
  // optimistic cache update
  const now = Date.now()
  const existing = new Set(archListCache.map((e) => e.id))
  for (const id of ids) {
    archSetCache.add(id)
    if (!existing.has(id)) archListCache.push({ id, at: now })
  }
  try {
    await realArchiveIds(ids)
  } catch {}
}

export async function safeUnarchiveId(id: string) {
  archSetCache.delete(id)
  const idx = archListCache.findIndex((e) => e.id === id)
  if (idx >= 0) archListCache.splice(idx, 1)
  try {
    await realUnarchiveId(id)
  } catch {}
}

export async function safeClearArchive() {
  archSetCache.clear()
  archListCache = []
  try {
    await realClearArchive()
  } catch {}
}
