/**
 * Core domain types: the three gas currencies and the save-state shape.
 */

export type GasId = "neon" | "argon" | "xenon";

export type Gas = {
  id: GasId;
  name: string;
  color: string;
  glow: string;
  core: string;
  baseRate: number; // plasma per crackle per arc-bonus at 0 upgrades
  cap: number; // max filaments (arcs) of this gas in the glass
  unlockCost: Partial<Record<GasId, number>>;
};
export type GasRecord = Record<GasId, number>;

export type GameState = {
  plasma: GasRecord; // one currency per gas
  total: GasRecord;
  crackles: number;
  voltage: GasRecord; // volt STEPS per gas (each = +0.0001V output)
  fingers: number;
  toes: number;
  ghosts: number;
  filaments: GasRecord; // arcs are per-gas
  splits: GasRecord; // string split branches per gas
  unlocked: GasId[];
  created: number;
  lastSeen: number;
  activeSeconds: number; // cumulative visible playtime
};
