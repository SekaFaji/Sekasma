/**
 * Single source of truth for the helper roster.
 *
 * Future helper additions should start here, with their own sprite and
 * persistence representation added in a separate, versioned content patch.
 * Stable save fields keep the four original helpers compatible with old saves.
 */
import { HELPER_POWER, MIX_LV } from "./config.ts";
import type { GasId, GameState, HelperId, HelperRecord } from "./types.ts";

export type HelperSaveField = "fingers" | "sparkMites" | "copperSpiders" | "toes" | "ghosts" | "stickmen";
export type HelperVisual = "finger" | "mite" | "spider" | "toe" | "ghost" | "stickman";
export type HelperPriceComponent = {
  gas: GasId;
  base: number;
  growth: number;
  minOwned?: number;
  requiresGas?: boolean;
};
export type HelperDefinition = {
  id: HelperId;
  name: string;
  statsLabel: string;
  hiredOne: string;
  hiredMany: string;
  nativeGas: GasId;
  /** Reveal the next helper after one of this type has been purchased. */
  revealAfter?: HelperId;
  saveField: HelperSaveField;
  visual: HelperVisual;
  power: number;
  baseCapacity: number;
  capacityStep: number;
  shopColor?: string;
  iconPixelScale: number;
  firstPurchasePrice?: number;
  prices: readonly HelperPriceComponent[];
};

/**
 * Ordered in the shop. All costs, powers and capacities match v0.12.26.
 * Metadata describes gameplay, rather than forcing gas-based helper limits:
 * the new Neon helpers will receive their own IDs and staged unlocks later.
 */
export const HELPER_CATALOG: readonly HelperDefinition[] = [
  {
    id: "finger", name: "FINGER", statsLabel: "FINGERS HIRED",
    hiredOne: "FINGER HIRED", hiredMany: "FINGERS HIRED",
    nativeGas: "neon", saveField: "fingers", visual: "finger",
    power: HELPER_POWER.finger, baseCapacity: 30, capacityStep: 10,
    iconPixelScale: 2, firstPurchasePrice: 2,
    prices: [
      { gas: "neon", base: 5, growth: 1.18 },
      { gas: "argon", base: 3, growth: 1.15, minOwned: MIX_LV.argon, requiresGas: true },
      { gas: "xenon", base: 2, growth: 1.12, minOwned: MIX_LV.xenon, requiresGas: true },
      { gas: "krypton", base: 1, growth: 1.10, minOwned: MIX_LV.krypton, requiresGas: true },
    ],
  },
  {
    id: "sparkMite", name: "SPARK MITE", statsLabel: "SPARK MITES",
    hiredOne: "SPARK MITE", hiredMany: "SPARK MITES",
    nativeGas: "neon", revealAfter: "finger", saveField: "sparkMites", visual: "mite",
    power: HELPER_POWER.sparkMite, baseCapacity: 35, capacityStep: 10,
    shopColor: "#ff9bcf", iconPixelScale: 2,
    prices: [{ gas: "neon", base: 40, growth: 1.28 }],
  },
  {
    id: "copperSpider", name: "COPPER SPIDER", statsLabel: "COPPER SPIDERS",
    hiredOne: "COPPER SPIDER", hiredMany: "COPPER SPIDERS",
    nativeGas: "neon", revealAfter: "sparkMite", saveField: "copperSpiders", visual: "spider",
    power: HELPER_POWER.copperSpider, baseCapacity: 20, capacityStep: 5,
    shopColor: "#eeb178", iconPixelScale: 2,
    prices: [{ gas: "neon", base: 350, growth: 1.38 }],
  },
  {
    id: "toe", name: "BIG TOE", statsLabel: "BIG TOES",
    hiredOne: "FOOT HIRED", hiredMany: "FEET HIRED",
    nativeGas: "argon", revealAfter: "copperSpider", saveField: "toes", visual: "toe",
    power: HELPER_POWER.toe, baseCapacity: 25, capacityStep: 5,
    shopColor: "#dfa07d", iconPixelScale: 3,
    prices: [
      { gas: "argon", base: 15, growth: 1.30 },
      { gas: "neon", base: 8, growth: 1.15, minOwned: MIX_LV.argon },
      { gas: "xenon", base: 4, growth: 1.12, minOwned: MIX_LV.xenon, requiresGas: true },
      { gas: "krypton", base: 2, growth: 1.10, minOwned: MIX_LV.krypton, requiresGas: true },
    ],
  },
  {
    id: "ghost", name: "GHOST HAND", statsLabel: "GHOST HANDS",
    hiredOne: "GHOST HAND", hiredMany: "GHOST HANDS",
    nativeGas: "xenon", revealAfter: "toe", saveField: "ghosts", visual: "ghost",
    power: HELPER_POWER.ghost, baseCapacity: 20, capacityStep: 5,
    shopColor: "#b7b2ff", iconPixelScale: 3,
    prices: [{ gas: "xenon", base: 80, growth: 1.45 }],
  },
  {
    id: "stickman", name: "STICKMAN", statsLabel: "STICKMEN",
    hiredOne: "STICKMAN", hiredMany: "STICKMEN",
    nativeGas: "krypton", revealAfter: "ghost", saveField: "stickmen", visual: "stickman",
    power: HELPER_POWER.stickman, baseCapacity: 15, capacityStep: 3,
    shopColor: "#ffd166", iconPixelScale: 3,
    prices: [{ gas: "krypton", base: 120, growth: 1.50 }],
  },
];

export const HELPER_IDS: readonly HelperId[] = HELPER_CATALOG.map(helper => helper.id);
const BY_ID: Readonly<Record<HelperId, HelperDefinition>> = Object.fromEntries(
  HELPER_CATALOG.map(helper => [helper.id, helper]),
) as Record<HelperId, HelperDefinition>;

export function helperDefinition(id: HelperId): HelperDefinition {
  return BY_ID[id];
}
export function helperOwned(state: GameState, id: HelperId): number {
  return state[helperDefinition(id).saveField];
}
export function withHelperOwned(state: GameState, id: HelperId, count: number): GameState {
  return { ...state, [helperDefinition(id).saveField]: count };
}
/** Do not flood the shop. Owned helpers and old higher-gas saves stay visible. */
export function helperVisible(state: GameState, id: HelperId): boolean {
  const helper = helperDefinition(id);
  if (!helper.revealAfter) return true;
  return helperOwned(state, id) > 0 ||
    helperOwned(state, helper.revealAfter) > 0 ||
    (state.lifetime?.helperHires?.[helper.revealAfter] ?? 0) > 0 ||
    (helper.nativeGas !== "neon" && state.unlocked.includes(helper.nativeGas)) ||
    (helper.nativeGas === "neon" && state.unlocked.includes("argon"));
}
export function helperUnlocked(state: GameState, id: HelperId): boolean {
  const helper = helperDefinition(id);
  return helperVisible(state, id) && state.unlocked.includes(helper.nativeGas);
}
export function helperCost(id: HelperId, owned: number, unlocked: readonly GasId[]): Partial<Record<GasId, number>> {
  const definition = helperDefinition(id);
  const cost: Partial<Record<GasId, number>> = {};
  for (const part of definition.prices) {
    if (owned < (part.minOwned ?? 0)) continue;
    if (part.requiresGas && !unlocked.includes(part.gas)) continue;
    cost[part.gas] = owned === 0 && part === definition.prices[0] && definition.firstPurchasePrice !== undefined
      ? definition.firstPurchasePrice
      : Math.ceil(part.base * Math.pow(part.growth, owned));
  }
  return cost;
}
export const BASE_HELPER_CAPACITY: HelperRecord = Object.fromEntries(
  HELPER_CATALOG.map(helper => [helper.id, helper.baseCapacity]),
) as HelperRecord;
export const HELPER_CAPACITY_STEP: HelperRecord = Object.fromEntries(
  HELPER_CATALOG.map(helper => [helper.id, helper.capacityStep]),
) as HelperRecord;

/** Runtime type guard for purchase kinds shared with the economy. */
export function isHelperId(kind: string): kind is HelperId {
  return Object.prototype.hasOwnProperty.call(BY_ID, kind);
}
