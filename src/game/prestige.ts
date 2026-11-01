/** Prestige V1: permanent individual helper capacity, with safe legacy migration. */
import { zero3 } from "./config.ts";
import type { GameState, HelperId, HelperRecord, PrestigeProgress } from "./types.ts";

export const HELPERS: readonly HelperId[] = ["finger", "toe", "ghost", "stickman"];
export const BASE_CAPACITY: HelperRecord = { finger: 30, toe: 25, ghost: 20, stickman: 15 };
export const CAPACITY_STEP: HelperRecord = { finger: 10, toe: 5, ghost: 5, stickman: 3 };
export const MIN_PRESTIGE_SCORE = 100_000;

export function freshPrestige(): PrestigeProgress {
  return {
    cycles: 0, sparks: 0, lifetimeSparks: 0,
    capacityLevels: { finger: 0, toe: 0, ghost: 0, stickman: 0 },
    legacyCapacity: { ...BASE_CAPACITY },
    lastTotal: zero3(),
  };
}
const owned = (s: GameState, kind: HelperId): number =>
  kind === "finger" ? s.fingers : kind === "toe" ? s.toes
  : kind === "ghost" ? s.ghosts : s.stickmen;

export function helperCapacity(s: GameState, kind: HelperId): number {
  const p = s.prestige;
  return Math.max(BASE_CAPACITY[kind], p.legacyCapacity[kind]) + CAPACITY_STEP[kind] * p.capacityLevels[kind];
}
export function helperRoom(s: GameState, kind: HelperId): number {
  return Math.max(0, helperCapacity(s, kind) - owned(s, kind));
}
export function capacityUpgradeCost(s: GameState, kind: HelperId): number {
  return (s.prestige.capacityLevels[kind] + 1) ** 2;
}
export function upgradeCapacity(s: GameState, kind: HelperId): GameState {
  const cost = capacityUpgradeCost(s, kind);
  if (s.prestige.sparks < cost) return s;
  return { ...s, prestige: {
    ...s.prestige,
    sparks: s.prestige.sparks - cost,
    capacityLevels: { ...s.prestige.capacityLevels, [kind]: s.prestige.capacityLevels[kind] + 1 },
  } };
}
/** Production since the last Prestige, using immutable lifetime totals. */
export function runPrestigeScore(s: GameState): number {
  const weights = { neon: 1, argon: 5, xenon: 20, krypton: 80 } as const;
  return (Object.keys(weights) as (keyof typeof weights)[]).reduce((sum, gas) =>
    sum + Math.max(0, s.total[gas] - s.prestige.lastTotal[gas]) * weights[gas], 0);
}
export function prestigeReward(s: GameState): number {
  if (!s.unlocked.includes("krypton")) return 0;
  const score = runPrestigeScore(s);
  if (!Number.isFinite(score) || score < MIN_PRESTIGE_SCORE) return 0;
  return Math.max(1, Math.floor(Math.log10(1 + score) - 4));
}
/** Explicit run reset: keep permanent capacities and lifetime play statistics. */
export function performPrestige(s: GameState): GameState {
  const reward = prestigeReward(s);
  if (reward <= 0) return s;
  return {
    ...s,
    plasma: zero3(), voltage: zero3(), filaments: zero3(), splits: zero3(),
    unlocked: ["neon"], fingers: 0, toes: 0, ghosts: 0, stickmen: 0,
    lastSeen: Date.now(),
    prestige: {
      ...s.prestige, cycles: s.prestige.cycles + 1,
      sparks: s.prestige.sparks + reward, lifetimeSparks: s.prestige.lifetimeSparks + reward,
      lastTotal: { ...s.total },
      // Grandfathering only protects already-owned helpers, not future runs.
      legacyCapacity: { ...BASE_CAPACITY },
    },
  };
}
