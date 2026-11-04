/**
 * Pure, cost-free purchase previews for the upgrade list.
 * These are projections, not purchases or changes to game economy or saves.
 */
import { HELPER_POWER, PRESS_INTERVAL } from "./config.ts";
import { cracklePower, idleRate, type BuyKind } from "./economy.ts";
import { gasById } from "./gases.ts";
import type { GasId, GameState } from "./types.ts";
import { fmt } from "../utils/format.ts";

export type PurchaseImpact = {
  /** Compact before -> after text for the selected gas. */
  preview: string;
  /** Actual projected gain shown briefly after buying. */
  gained: string;
};

function fmtImpact(n: number, delta = 0): string {
  if (n === 0) return "0";
  if (n >= 1000) return fmt(n);
  // Preserve enough digits to show tiny Volt changes such as 0.1 -> 0.10001.
  const needed = delta > 0 ? Math.min(8, Math.max(0, Math.ceil(-Math.log10(delta)) + 1)) : 0;
  const baseline = n < 0.01 ? 4 : n < 0.1 ? 3 : n < 1 ? 2 : 0;
  const decimals = Math.max(needed, baseline);
  return n.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
}

/** Model the rate from exactly count extra units without mutating state. */
export function previewPurchaseImpact(
  state: GameState, kind: BuyKind, gid: GasId | undefined, count: number,
): PurchaseImpact | null {
  if (kind === "gas" || !Number.isFinite(count) || count <= 0) return null;
  const units = Math.floor(count);
  if (units <= 0) return null;
  const focus = gid ?? state.unlocked[state.unlocked.length - 1];
  if (!focus || !state.unlocked.includes(focus)) return null;
  const gas = gasById(focus);
  const helper = kind === "finger" || kind === "toe" || kind === "ghost" || kind === "stickman";
  const unit = helper ? "/S" : "/T";
  let before: number;
  let after: number;
  if (helper) {
    before = idleRate(state)[focus];
    after = before + (units * HELPER_POWER[kind] * cracklePower(gas, state)) / PRESS_INTERVAL;
  } else {
    before = cracklePower(gas, state);
    const key = kind === "filament" ? "filaments" : kind === "voltage" ? "voltage" : "splits";
    const updated: GameState = { ...state, [key]: { ...state[key], [focus]: state[key][focus] + units } };
    after = cracklePower(gas, updated);
  }
  if (![before, after].every(Number.isFinite) || after < before) return null;
  const delta = after - before;
  return {
    preview: `${gas.name}${unit} ${fmtImpact(before, delta)} → ${fmtImpact(after, delta)}`,
    gained: `+${fmtImpact(delta, delta)} ${gas.name}${unit}`,
  };
}
