import type { GasId, GasRecord } from "../game/types.ts";

/** Lowest funded fraction of a mixed-gas price (0–100); no NaN or Infinity. */
export function affordabilityPercent(cost: Partial<GasRecord>, plasma: GasRecord): number {
  const entries = Object.entries(cost) as [GasId, number][];
  if (entries.length === 0) return 100;
  let fraction = 1;
  for (const [gas, required] of entries) {
    if (!Number.isFinite(required) || required <= 0) return 0;
    const balance = plasma[gas];
    if (!Number.isFinite(balance)) return 0;
    fraction = Math.min(fraction, Math.max(0, balance) / required);
  }
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}
