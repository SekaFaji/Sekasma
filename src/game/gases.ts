/**
 * The gases that fill the ball: data table plus lookup helpers.
 */
import type { Gas, GasId } from "./types.ts";

export const GAS_LIST: Gas[] = [
  { id: "neon", name: "NEON", color: "#ff5ec8", glow: "#b3238f", core: "#ffd6f2", baseRate: 0.1, cap: 12, unlockCost: {} },
  { id: "argon", name: "ARGON", color: "#7d7dff", glow: "#3d3dc9", core: "#dfe4ff", baseRate: 0.5, cap: 8, unlockCost: { neon: 600 } },
  { id: "xenon", name: "XENON", color: "#35e0e8", glow: "#0f8fa8", core: "#d8fbff", baseRate: 2.5, cap: 6, unlockCost: { argon: 5000 } },
];
export const gasById = (id: GasId): Gas => GAS_LIST.find((g) => g.id === id)!;
export const nextGas = (unlocked: GasId[]): Gas | null => {
  const last = unlocked[unlocked.length - 1];
  const i = GAS_LIST.findIndex((g) => g.id === last);
  return i >= 0 && i < GAS_LIST.length - 1 ? GAS_LIST[i + 1] : null;
};

