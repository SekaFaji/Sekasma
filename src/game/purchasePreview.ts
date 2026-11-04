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

function fmtImpact(n: number): string {
  if (n === 0) return "0";
  if (n < 0.001) return n.toPrecision(2);
  if (n < 1) {
    const digits = n < 0.01 ? 4 : n < 0.1 ? 3 : 2;
    return n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  }
  return fmt(n);
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
  return {
    preview: `${gas.name}${unit} ${fmtImpact(before)} → ${fmtImpact(after)}`,
    gained: `+${fmtImpact(after - before)} ${gas.name}${unit}`,
  };
}
