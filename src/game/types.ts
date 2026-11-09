/**
 * Core domain types: four gas currencies and the versioned save-state shape.
 */

export type GasId = "neon" | "argon" | "xenon" | "krypton";

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
export type HelperId = "finger" | "sparkMite" | "copperSpider" | "toe" | "ghost" | "stickman";
export type HelperRecord = Record<HelperId, number>;
/** Non-resetting progress; historic purchases are tracked from v0.12.25 onward. */
export type LifetimeStats = {
  helperHires: HelperRecord;
  purchasedArcs: GasRecord;
  purchasedSplits: GasRecord;
  purchasedVoltage: GasRecord; // all new Voltage levels purchased, across runs
  legacyVoltagePurchases: GasRecord; // old micro-volt step history, read-only
  peakHelpRate: GasRecord;
  peakTapPower: GasRecord;
  runStartCrackles: number;
  runStartActiveSeconds: number;
  runStartOfflineSeconds: number;
};

export type PrestigeProgress = {
  cycles: number;
  sparks: number;
  lifetimeSparks: number;
  capacityLevels: HelperRecord;
  legacyCapacity: HelperRecord;
  lastTotal: GasRecord;
};

export type GameState = {
  plasma: GasRecord; // one currency per gas
  total: GasRecord;
  crackles: number;
  voltage: GasRecord; // new +10% Voltage levels per gas (0..20)
  legacyVoltage: GasRecord; // grandfathered micro-volt steps, current run only
  fingers: number;
  sparkMites: number;
  copperSpiders: number;
  toes: number;
  ghosts: number;
  stickmen: number;
  filaments: GasRecord; // arcs are per-gas
  splits: GasRecord; // string split branches per gas
  unlocked: GasId[];
  created: number;
  lastSeen: number;
  activeSeconds: number; // cumulative visible/foreground playtime
  offlineSeconds: number; // capped time away, tracked starting with schema 13
  prestige: PrestigeProgress;
  lifetime: LifetimeStats;
};
