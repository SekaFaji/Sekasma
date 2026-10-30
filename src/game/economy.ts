/**
 * The economy: cost curves per upgrade, bulk-buy pricing, income rates
 * and the state mutations behind every purchase.
 */
import { GAS_LIST, gasById, nextGas } from "./gases.ts";
import {
  FIL_BASE,
  GHOST_MULT,
  MAX_VOLT_STEPS,
  MIX_LV,
  PRESS_INTERVAL,
  OFFLINE_CAP_S,
  SPLIT_BASE,
  SPLIT_CAP,
  TOE_MULT,
  VOLT_BASE,
  splitMult,
  voltMult,
  zero3,
} from "./config.ts";
import type { Gas, GasId, GasRecord, GameState } from "./types.ts";

export const fingerCost = (n: number, unlocked: GasId[]): Partial<GasRecord> => {
  const c: Partial<GasRecord> = { neon: Math.ceil(5 * Math.pow(1.18, n)) };
  if (n >= MIX_LV.argon && unlocked.includes("argon"))
    c.argon = Math.ceil(3 * Math.pow(1.15, n));
  if (n >= MIX_LV.xenon && unlocked.includes("xenon"))
    c.xenon = Math.ceil(2 * Math.pow(1.12, n));
  return c;
};
export const toeCost = (n: number, unlocked: GasId[]): Partial<GasRecord> => {
  const c: Partial<GasRecord> = { argon: Math.ceil(15 * Math.pow(1.3, n)) };
  if (n >= MIX_LV.argon)
    c.neon = Math.ceil(8 * Math.pow(1.15, n));
  if (n >= MIX_LV.xenon && unlocked.includes("xenon"))
    c.xenon = Math.ceil(4 * Math.pow(1.12, n));
  return c;
};
export const ghostCost = (n: number): Partial<GasRecord> => ({
  xenon: Math.ceil(80 * Math.pow(1.45, n)),
});
export const splitCost = (g: GasId, n: number): Partial<GasRecord> => ({
  [g]: Math.ceil(SPLIT_BASE[g] * Math.pow(2.2, n)),
} as Partial<GasRecord>);
export const filamentCost = (g: GasId, n: number): Partial<GasRecord> => ({
  [g]: Math.ceil(FIL_BASE[g] * Math.pow(1.55, n)),
} as Partial<GasRecord>);
export const voltageCost = (g: GasId, v: number): Partial<GasRecord> => ({
  [g]: Math.ceil(VOLT_BASE[g] * Math.pow(1.07, v)),
} as Partial<GasRecord>);

// per-gas crackle power = baseRate x (1 + arcs) x (1 + volts) x splits
export const cracklePower = (g: Gas, s: GameState) =>
  g.baseRate * (1 + s.filaments[g.id]) * voltMult(s.voltage[g.id]) * splitMult(s.splits[g.id]);

// idle income per gas = hired help pressing around the clock
export const idleRate = (s: GameState): GasRecord => {
  const out = zero3();
  for (const g of GAS_LIST) {
    if (!s.unlocked.includes(g.id)) continue;
    out[g.id] =
      ((s.fingers + s.toes * TOE_MULT + s.ghosts * GHOST_MULT) * cracklePower(g, s)) /
      PRESS_INTERVAL;
  }
  return out;
};

export const canAfford = (s: GameState, cost: Partial<GasRecord>) =>
  (Object.entries(cost) as [GasId, number][]).every(([g, amt]) => s.plasma[g] >= amt);
export const pay = (s: GameState, cost: Partial<GasRecord>) => {
  for (const [g, amt] of Object.entries(cost) as [GasId, number][])
    s.plasma[g] -= amt;
};

// ---------- Bulk buying (1 / 5 / 10 / 100 / MAX) ----------
export type BuyKind = "finger" | "toe" | "ghost" | "filament" | "voltage" | "split" | "gas";

export const addCosts = (a: Partial<GasRecord>, b: Partial<GasRecord>): Partial<GasRecord> => {
  const out: Partial<GasRecord> = { ...a };
  for (const [g, v] of Object.entries(b) as [GasId, number][])
    out[g] = (out[g] ?? 0) + v;
  return out;
};

// total cost of buying up to `count` units; stops at caps or when broke.
// returns what actually fits so the UI can buy partial amounts.
export const bulkCost = (
  s: GameState, kind: BuyKind, gid: GasId | undefined, count: number,
): { cost: Partial<GasRecord>; count: number } => {
  let total: Partial<GasRecord> = {};
  let n = 0;
  while (n < count) {
    let c: Partial<GasRecord> | null = null;
    if (kind === "finger") c = fingerCost(s.fingers + n, s.unlocked);
    if (kind === "toe") c = toeCost(s.toes + n, s.unlocked);
    if (kind === "ghost") c = ghostCost(s.ghosts + n);
    if (kind === "filament" && gid)
      c = s.filaments[gid] + n >= gasById(gid).cap ? null : filamentCost(gid, s.filaments[gid] + n);
    if (kind === "voltage" && gid)
      c = s.voltage[gid] + n >= MAX_VOLT_STEPS ? null : voltageCost(gid, s.voltage[gid] + n);
    if (kind === "split" && gid)
      c = s.splits[gid] + n >= SPLIT_CAP ? null : splitCost(gid, s.splits[gid] + n);
    if (kind === "gas")
      c = n === 0 ? nextGas(s.unlocked)?.unlockCost ?? null : null;
    if (!c) break;
    const nextTotal = addCosts(total, c);
    if (!canAfford(s, nextTotal)) break;
    total = nextTotal;
    n++;
  }
  return { cost: total, count: n };
};

// price of the next single unit — shown when you can't afford any
export function peekCost(s: GameState, kind: BuyKind, gid?: GasId): Partial<GasRecord> {
  if (kind === "finger") return fingerCost(s.fingers, s.unlocked);
  if (kind === "toe") return toeCost(s.toes, s.unlocked);
  if (kind === "ghost") return ghostCost(s.ghosts);
  if (kind === "filament" && gid)
    return s.filaments[gid] >= gasById(gid).cap ? {} : filamentCost(gid, s.filaments[gid]);
  if (kind === "voltage" && gid)
    return s.voltage[gid] >= MAX_VOLT_STEPS ? {} : voltageCost(gid, s.voltage[gid]);
  if (kind === "split" && gid)
    return s.splits[gid] >= SPLIT_CAP ? {} : splitCost(gid, s.splits[gid]);
  if (kind === "gas") return nextGas(s.unlocked)?.unlockCost ?? {};
  return {};
}

export function buyMsg(kind: BuyKind, gid: GasId | undefined, n: number): string {
  const s = (base: string) => (n > 1 ? base + "S" : base);
  if (kind === "finger") return `+${n} ${s("FINGER")} HIRED`;
  if (kind === "toe") return n > 1 ? `+${n} FEET HIRED` : "+1 FOOT HIRED";
  if (kind === "ghost") return n > 1 ? `+${n} GHOST HANDS` : "+1 GHOST HAND";
  if (kind === "filament") return `+${n} ${gasById(gid!).name} ${s("ARC")}`;
  if (kind === "voltage") return `+${n} ${s("VOLT STEP")}`;
  return `+${n} ${s("BRANCH")}`;
}

/** Bound the duration of a single absence (including invalid system clocks). */
export function cappedOfflineSeconds(fromMs: number, toMs: number): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.min(OFFLINE_CAP_S, Math.max(0, (toMs - fromMs) / 1000));
}

/** Credit helper-generated income without mutating the original state. */
export function accrueIdle(s: GameState, seconds: number): { state: GameState; gain: GasRecord } {
  const dt = Number.isFinite(seconds) ? Math.min(OFFLINE_CAP_S, Math.max(0, seconds)) : 0;
  const gain = zero3();
  if (dt === 0) return { state: s, gain };
  const rates = idleRate(s);
  let any = false;
  for (const gas of s.unlocked) {
    gain[gas] = rates[gas] * dt;
    if (gain[gas] > 0) any = true;
  }
  if (!any) return { state: s, gain };
  const plasma = { ...s.plasma };
  const total = { ...s.total };
  for (const gas of s.unlocked) {
    plasma[gas] += gain[gas];
    total[gas] += gain[gas];
  }
  return { state: { ...s, plasma, total }, gain };
}

/** Atomic purchase used by the UI and tests. */
export function purchaseUpgrade(
  s: GameState, kind: BuyKind, gid: GasId | undefined, wanted: number,
): { state: GameState; count: number } {
  const { cost, count } = bulkCost(s, kind, gid, wanted);
  if (count === 0) return { state: s, count: 0 };
  const next: GameState = { ...s, plasma: { ...s.plasma } };
  pay(next, cost);
  if (kind === "finger") next.fingers = s.fingers + count;
  if (kind === "toe") next.toes = s.toes + count;
  if (kind === "ghost") next.ghosts = s.ghosts + count;
  if (kind === "filament" && gid)
    next.filaments = { ...s.filaments, [gid]: s.filaments[gid] + count };
  if (kind === "voltage" && gid)
    next.voltage = { ...s.voltage, [gid]: s.voltage[gid] + count };
  if (kind === "split" && gid)
    next.splits = { ...s.splits, [gid]: s.splits[gid] + count };
  if (kind === "gas") {
    const unlocked = nextGas(s.unlocked);
    if (!unlocked) return { state: s, count: 0 };
    next.unlocked = [...s.unlocked, unlocked.id];
  }
  return { state: next, count };
}
