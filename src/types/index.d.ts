export type ChainId = string;
export type PairId = string; // Meestal het pair-address (0x...) of slug

export interface HiddenEntry {
  id: PairId;
  reason?: string;
  ts: number;
}
