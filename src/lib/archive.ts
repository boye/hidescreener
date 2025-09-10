// Simple archive storage for hidden items.
// Archiving does NOT unhide items; it only removes them from the panel's active list.

import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })
const ARCH_SET = "dslh:archive:set:v1"
const ARCH_LIST = "dslh:archive:list:v1"

export type ArchiveEntry = { id: string; at: number }

export async function getArchiveSet(): Promise<Set<string>> {
  const arr = (await storage.get<string[]>(ARCH_SET)) || []
  return new Set(arr)
}

export async function getArchiveList(): Promise<ArchiveEntry[]> {
  return (await storage.get<ArchiveEntry[]>(ARCH_LIST)) || []
}

async function saveArchiveSet(s: Set<string>) {
  await storage.set(ARCH_SET, Array.from(s))
}

async function saveArchiveList(list: ArchiveEntry[]) {
  await storage.set(ARCH_LIST, list)
}

export async function archiveIds(ids: string[]) {
  if (!ids.length) return
  const set = await getArchiveSet()
  const list = await getArchiveList()
  const existing = new Set(list.map((e) => e.id))

  let changed = false
  const now = Date.now()

  for (const id of ids) {
    if (!set.has(id)) {
      set.add(id)
      changed = true
    }
    if (!existing.has(id)) {
      list.push({ id, at: now })
      changed = true
    }
  }
  if (changed) {
    await saveArchiveSet(set)
    await saveArchiveList(list)
  }
}

export async function unarchiveId(id: string) {
  const set = await getArchiveSet()
  const list = await getArchiveList()
  if (!set.has(id)) return
  set.delete(id)
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) list.splice(idx, 1)
  await saveArchiveSet(set)
  await saveArchiveList(list)
}

export async function clearArchive() {
  await saveArchiveSet(new Set())
  await saveArchiveList([])
}
