export type ChainId = string
export type PairId = string // Meestal het pair-address (0x...) of slug
export type PairSymbols = string

export interface HiddenEntry {
  id: PairId
  url: string
  symbols?: PairSymbols // Optioneel, voor betere UX
  reason?: string
  chain?: ChainId
  ts: number
}
