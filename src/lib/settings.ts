import { Storage } from "@plasmohq/storage"

export interface Settings {
  previewEnabled: boolean
  previewDelayMs: number
  previewDismissMs: number // <-- NEW: grace delay before hiding
  previewWidth: number
  previewHeight: number
  refreshIntervalSec: number
}

const storage = new Storage({ area: "local" })
const KEY = "dslh:settings:v1"

export const DEFAULTS: Settings = {
  previewEnabled: false,
  previewDelayMs: 350,
  previewDismissMs: 300, // sensible default
  previewWidth: 420,
  previewHeight: 280,
  refreshIntervalSec: 30 // <-- NEW: default 30s (0 disables)
}

export async function getSettings(): Promise<Settings> {
  const s = (await storage.get<Settings>(KEY)) || {}
  return { ...DEFAULTS, ...s }
}

export async function updateSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await storage.set(KEY, { ...cur, ...patch })
}

export async function setSettings(all: Settings) {
  await storage.set(KEY, all)
}
