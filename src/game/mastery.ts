/**
 * Neon is the first complete chapter, not just a price gate.
 *
 * Mastery measures *produced* Neon this run, so spending plasma never moves
 * the progress bar backwards. Prestige supplies the existing run baseline.
 * Existing runs already in Argon or higher keep all their unlocked gases.
 */
import type { GameState } from "./types.ts";

export const NEON_MASTERY_REQUIRED = 6000;
export const ARGON_MASTER_PRICE = 1800;
export const ARGON_MASTERY_REQUIRED = 60000;
export const XENON_MASTER_PRICE = 12000;

export function neonProducedThisRun(state: GameState): number {
  return Math.max(0, state.total.neon - state.prestige.lastTotal.neon);
}
export function neonMasteryProgress(state: GameState): number {
  return Math.min(100, 100 * neonProducedThisRun(state) / NEON_MASTERY_REQUIRED);
}
export function neonChapterComplete(state: GameState): boolean {
  return state.unlocked.includes("argon") ||
    (neonProducedThisRun(state) >= NEON_MASTERY_REQUIRED && state.copperSpiders >= 1);
}
/** Argon is a substantial second chapter. Spending never removes progress. */
export function argonProducedThisRun(state: GameState): number {
  return Math.max(0, state.total.argon - state.prestige.lastTotal.argon);
}
export function argonMasteryProgress(state: GameState): number {
  return Math.min(100, 100 * argonProducedThisRun(state) / ARGON_MASTERY_REQUIRED);
}
export function argonChapterComplete(state: GameState): boolean {
  return state.unlocked.includes("xenon") ||
    (argonProducedThisRun(state) >= ARGON_MASTERY_REQUIRED && state.orbitDrones >= 1);
}

/** The next unavailable gas is gated by its preceding chapter. */
export function canDiscoverNextGas(state: GameState): boolean {
  if (!state.unlocked.includes("argon")) return neonChapterComplete(state);
  if (!state.unlocked.includes("xenon")) return argonChapterComplete(state);
  return true; // Krypton keeps its existing requirements until the Xenon chapter.
}

/** Small data model shared by both chapter milestones and the Gas tab. */
export type MasteryView = {
  gas: "NEON" | "ARGON";
  earned: number;
  required: number;
  percent: number;
  helperPurchased: boolean;
  helperLabel: string;
  helperId: "copperSpider" | "orbitDrone";
  complete: boolean;
  nextGas: "ARGON" | "XENON";
};
export function nextGasMastery(state: GameState): MasteryView | null {
  if (!state.unlocked.includes("argon")) return {
    gas: "NEON", earned: neonProducedThisRun(state), required: NEON_MASTERY_REQUIRED,
    percent: neonMasteryProgress(state), helperPurchased: state.copperSpiders >= 1,
    helperLabel: "COPPER SPIDER", helperId: "copperSpider",
    complete: neonChapterComplete(state), nextGas: "ARGON",
  };
  if (!state.unlocked.includes("xenon")) return {
    gas: "ARGON", earned: argonProducedThisRun(state), required: ARGON_MASTERY_REQUIRED,
    percent: argonMasteryProgress(state), helperPurchased: state.orbitDrones >= 1,
    helperLabel: "ORBIT DRONE", helperId: "orbitDrone",
    complete: argonChapterComplete(state), nextGas: "XENON",
  };
  return null;
}
