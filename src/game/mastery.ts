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
/** Only Argon is milestone-gated in the first chapter rollout. */
export function canDiscoverNextGas(state: GameState): boolean {
  return state.unlocked.includes("argon") || neonChapterComplete(state);
}
