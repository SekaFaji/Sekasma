/**
 * Persistence: saving and loading against localStorage, migration
 * from every legacy save format, and player options.
 */
import { GAS_LIST } from "./gases.ts";
import { MAX_VOLT_LEVELS, MAX_VOLT_STEPS, SPLIT_CAP, VOLT_STEP, zero3 } from "./config.ts";
import type { GasId, GameState, HelperId, HelperRecord, LifetimeStats, PrestigeProgress } from "./types.ts";
import { cracklePower, idleRate } from "./economy.ts";
import { BASE_CAPACITY, HELPERS, freshPrestige } from "./prestige.ts";

export const SAVE_KEY = "idle-plasma-ball-save-v10";
// Keep existing save keys stable for old installs. The internal schema is v17.
export const BACKUP_KEY = "idle-plasma-ball-save-backup-v12";
export const LEGACY_V9_KEY = "idle-plasma-ball-save-v9";
export const LEGACY_V8_KEY = "idle-plasma-ball-save-v8";
export const LEGACY_V6_KEY = "idle-plasma-ball-save-v6";
export const OPTS_KEY = "idle-plasma-ball-opts-v1";
/** One-time read-only snapshot before the old Voltage economy is converted. */
export const PRE_VOLTAGE_BACKUP_KEY = "idle-plasma-ball-before-voltage-v17";

export function loadOpts(): { scan: boolean; buzz: boolean } {
  try {
    const raw = window.localStorage.getItem(OPTS_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { scan?: boolean; buzz?: boolean };
      return { scan: o.scan !== false, buzz: o.buzz !== false };
    }
  } catch {
    /* defaults */
  }
  return { scan: true, buzz: true };
}

export function freshLifetime(): LifetimeStats {
  return {
    helperHires: { finger: 0, toe: 0, ghost: 0, stickman: 0 },
    purchasedArcs: zero3(),
    purchasedSplits: zero3(),
    purchasedVoltage: zero3(),
    legacyVoltagePurchases: zero3(),
    peakHelpRate: zero3(),
    peakTapPower: { ...zero3(), neon: GAS_LIST[0].baseRate },
    runStartCrackles: 0, runStartActiveSeconds: 0, runStartOfflineSeconds: 0,
  };
}

export function freshSave(): GameState {
  const now = Date.now();
  return {
    plasma: zero3(), total: zero3(), crackles: 0,
    voltage: zero3(), legacyVoltage: zero3(), fingers: 0, toes: 0, ghosts: 0, stickmen: 0,
    filaments: zero3(), splits: zero3(), unlocked: ["neon"],
    created: now, lastSeen: now, activeSeconds: 0, offlineSeconds: 0,
    prestige: freshPrestige(),
    lifetime: freshLifetime(),
  };
}


/** Normalize untrusted persisted values before using them in the simulation. */
function validNumber(value: unknown, fallback = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, maximum) : fallback;
}
function sanitizeSave(s: GameState, fromOldVoltage = false): GameState {
  const fallback = freshSave();
  const record = (value: unknown, max = Number.MAX_SAFE_INTEGER) => {
    const object = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<GasId, unknown> : {} as Record<GasId, unknown>;
    const out = zero3();
    for (const g of GAS_LIST) out[g.id] = validNumber(object[g.id], 0, max);
    return out;
  };
  const rawUnlocks: unknown[] = Array.isArray(s.unlocked) ? s.unlocked : [];
  const unlocked: GasId[] = ["neon"];
  if (rawUnlocks.includes("argon")) unlocked.push("argon");
  if (rawUnlocks.includes("argon") && rawUnlocks.includes("xenon")) unlocked.push("xenon");
  if (unlocked.includes("xenon") && rawUnlocks.includes("krypton")) unlocked.push("krypton");
  const filaments = record(s.filaments);
  // Convert micro-volt STEPS into a separate legacy run-only contribution.
  // Never reinterpret them as 10% levels or erase their current multiplier.
  const legacyVoltage = record(fromOldVoltage ? s.voltage : s.legacyVoltage, MAX_VOLT_STEPS);
  const voltage = fromOldVoltage ? zero3() : record(s.voltage, MAX_VOLT_LEVELS);
  const splits = record(s.splits, SPLIT_CAP);
  for (const g of GAS_LIST) {
    filaments[g.id] = Math.floor(Math.min(g.cap, filaments[g.id]));
    voltage[g.id] = Math.floor(voltage[g.id]);
    legacyVoltage[g.id] = Math.floor(legacyVoltage[g.id]);
    splits[g.id] = Math.floor(splits[g.id]);
  }
  const rawPrestige: Partial<PrestigeProgress> = s.prestige && typeof s.prestige === "object"
    ? s.prestige : {};
  const capacityRecord = (value: unknown, fallback: HelperRecord): HelperRecord => {
    const input = value && typeof value === "object" ? value as Partial<Record<HelperId, unknown>> : {};
    return Object.fromEntries(HELPERS.map(kind => [kind,
      Math.floor(validNumber(input[kind], fallback[kind]))])) as HelperRecord;
  };
  const original = freshPrestige();
  const originalCap = capacityRecord(rawPrestige.legacyCapacity, BASE_CAPACITY);
  // v0.12.19 saved its old default limits as "legacy" capacity, even for
  // brand-new accounts. Normalize those defaults without deleting any helpers.
  const previousBase: HelperRecord = { finger: 100, toe: 60, ghost: 40, stickman: 40 };
  const legacyCapacity = { ...originalCap };
  for (const [kind, owned] of [
    ["finger", s.fingers], ["toe", s.toes], ["ghost", s.ghosts], ["stickman", s.stickmen],
  ] as [HelperId, number][]) {
    const preserved = originalCap[kind] === previousBase[kind] ? BASE_CAPACITY[kind] : originalCap[kind];
    legacyCapacity[kind] = Math.max(BASE_CAPACITY[kind], preserved, Math.floor(validNumber(owned)));
  }
  const lastTotal = record(rawPrestige.lastTotal);
  const prior = s.lifetime && typeof s.lifetime === "object"
    ? s.lifetime as Partial<LifetimeStats> : {};
  const baseline = freshLifetime();
  const helperHires = capacityRecord(prior.helperHires, {
    finger: Math.floor(validNumber(s.fingers)),
    toe: Math.floor(validNumber(s.toes)),
    ghost: Math.floor(validNumber(s.ghosts)),
    stickman: Math.floor(validNumber(s.stickmen)),
  });
  const purchasedArcs = record(prior.purchasedArcs ?? filaments);
  const purchasedSplits = record(prior.purchasedSplits ?? splits);
  const purchasedVoltage = record(fromOldVoltage ? undefined : (prior.purchasedVoltage ?? voltage));
  // Legacy lifetime totals are kept verbatim, not rebadged as new levels.
  const legacyVoltagePurchases = record(fromOldVoltage
    ? prior.purchasedVoltage ?? legacyVoltage
    : prior.legacyVoltagePurchases);
  const peakHelpRate = record(prior.peakHelpRate);
  const peakTapPower = record(prior.peakTapPower ?? baseline.peakTapPower);
  // Old saves lack per-run counter snapshots. Do not invent purchases made
  // in earlier Prestiges; begin counting from migration for prior cycles.
  const oldRun = validNumber(rawPrestige.cycles) > 0;
  const legacyOffset = (value: unknown, current: number): number =>
    Math.min(current, validNumber(value, oldRun ? current : 0));
  const lifetime: LifetimeStats = {
    helperHires, purchasedArcs, purchasedSplits, purchasedVoltage, legacyVoltagePurchases,
    peakHelpRate, peakTapPower,
    runStartCrackles: legacyOffset(prior.runStartCrackles, Math.floor(validNumber(s.crackles))),
    runStartActiveSeconds: legacyOffset(prior.runStartActiveSeconds, validNumber(s.activeSeconds)),
    runStartOfflineSeconds: legacyOffset(prior.runStartOfflineSeconds, validNumber(s.offlineSeconds)),
  };
  const prestige: PrestigeProgress = {
    cycles: Math.floor(validNumber(rawPrestige.cycles)),
    sparks: Math.floor(validNumber(rawPrestige.sparks)),
    lifetimeSparks: Math.floor(validNumber(rawPrestige.lifetimeSparks)),
    capacityLevels: capacityRecord(rawPrestige.capacityLevels, original.capacityLevels),
    legacyCapacity,
    lastTotal,
  };
  const normalized: GameState = {
    plasma: record(s.plasma), total: record(s.total),
    crackles: Math.floor(validNumber(s.crackles)),
    voltage, legacyVoltage, filaments, splits, unlocked,
    fingers: Math.floor(validNumber(s.fingers)),
    toes: Math.floor(validNumber(s.toes)),
    ghosts: Math.floor(validNumber(s.ghosts)),
    stickmen: Math.floor(validNumber(s.stickmen)),
    created: validNumber(s.created, fallback.created),
    lastSeen: validNumber(s.lastSeen, fallback.lastSeen),
    activeSeconds: validNumber(s.activeSeconds),
    offlineSeconds: validNumber(s.offlineSeconds),
    prestige, lifetime,
  };
  // Existing purchases/rates cannot be reconstructed after an older reset,
  // but the surviving current run must never be hidden by the new counters.
  const nowRates = idleRate(normalized);
  for (const gas of GAS_LIST) {
    const id = gas.id;
    lifetime.purchasedArcs[id] = Math.max(lifetime.purchasedArcs[id], filaments[id]);
    lifetime.purchasedSplits[id] = Math.max(lifetime.purchasedSplits[id], splits[id]);
    lifetime.purchasedVoltage[id] = Math.max(lifetime.purchasedVoltage[id], voltage[id]);
    lifetime.legacyVoltagePurchases[id] = Math.max(lifetime.legacyVoltagePurchases[id], legacyVoltage[id]);
    lifetime.peakHelpRate[id] = Math.max(lifetime.peakHelpRate[id], nowRates[id]);
    if (unlocked.includes(id))
      lifetime.peakTapPower[id] = Math.max(lifetime.peakTapPower[id], cracklePower(gas, normalized));
  }
  for (const kind of HELPERS) {
    const held = kind === "finger" ? normalized.fingers : kind === "toe" ? normalized.toes
      : kind === "ghost" ? normalized.ghosts : normalized.stickmen;
    lifetime.helperHires[kind] = Math.max(lifetime.helperHires[kind], held);
  }
  return normalized;
}

// Migrate old micro-voltage saves into the new level system without changing power.
export function migrateSave(old: Record<string, unknown>): GameState {
  const base = freshSave();
  // v17 already uses levels; all earlier versions use micro-volt steps.
  if (old.v === 17 || old.v === 16 || old.v === 15 || old.v === 14 || old.v === 13 || old.v === 12 || old.v === 11 || old.v === 10 || old.v === 9) {
    const s = { ...base, ...(old as unknown as GameState) };
    // Old snapshots never had lifetime counters. Distinguish "not recorded"
    // from fresh zeroes so older Prestiges are not counted as this run.
    if (!Object.prototype.hasOwnProperty.call(old, "lifetime"))
      s.lifetime = undefined as unknown as LifetimeStats;
    if (!s.splits) s.splits = zero3();
    if (typeof s.ghosts !== "number") s.ghosts = 0;
    if (typeof s.stickmen !== "number") s.stickmen = 0;
    return sanitizeSave(s, old.v !== 17);
  }
  // v6 save: single currency, volts were x2 levels
  if (typeof old.plasma === "number") {
    const gas = old.gas as GasId;
    base.plasma.neon = (old.plasma as number) / 5;
    base.total.neon = ((old.total as number) ?? 0) / 5;
    base.crackles = (old.crackles as number) ?? 0;
    const v6v = (old.voltage as number) ?? 0;
    base.voltage.neon = Math.min(MAX_VOLT_STEPS, Math.round((Math.pow(2, v6v) - 1) / VOLT_STEP));
    base.fingers = (old.fingers as number) ?? 0;
    base.toes = (old.toes as number) ?? 0;
    base.filaments.neon = (old.filaments as number) ?? 0;
    base.unlocked =
      gas === "krypton" ? ["neon", "argon", "xenon", "krypton"]
      : gas === "xenon" ? ["neon", "argon", "xenon"]
      : gas === "argon" ? ["neon", "argon"]
      : ["neon"];
    base.created = (old.created as number) ?? Date.now();
    return sanitizeSave(base, true);
  }
  // v8 save: gas currencies, volts were x2 levels → convert to steps
  const src = old as Record<string, Record<string, number> | number | GasId[] | undefined>;
  if (src.plasma && typeof src.plasma === "object") {
    const p = src.plasma as Record<GasId, number>;
    const tt = (src.total ?? {}) as Record<GasId, number>;
    const vv = (src.voltage ?? {}) as Record<GasId, number>;
    const ff = (src.filaments ?? {}) as Record<GasId, number>;
    for (const g of GAS_LIST) {
      base.plasma[g.id] = (p[g.id] ?? 0) / 5;
      base.total[g.id] = (tt[g.id] ?? 0) / 5;
      base.voltage[g.id] = Math.min(MAX_VOLT_STEPS, Math.round((Math.pow(2, vv[g.id] ?? 0) - 1) / VOLT_STEP));
      base.filaments[g.id] = ff[g.id] ?? 0;
    }
    base.crackles = (src.crackles as number) ?? 0;
    base.fingers = (src.fingers as number) ?? 0;
    base.toes = (src.toes as number) ?? 0;
    const unl = src.unlocked as GasId[] | undefined;
    base.unlocked = Array.isArray(unl) && unl.length ? unl : ["neon"];
    base.created = (src.created as number) ?? Date.now();
    return sanitizeSave(base, true);
  }
  return base;
}

/** Try each slot independently: corrupt JSON must not block a valid backup. */
export function loadSave(): GameState | null {
  for (const key of [SAVE_KEY, BACKUP_KEY, LEGACY_V9_KEY, LEGACY_V8_KEY, LEGACY_V6_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const candidate = parsed as Record<string, unknown>;
      if (typeof candidate.fingers !== "number" || !Number.isFinite(candidate.fingers)) continue;
      // Preserve the exact pre-migration snapshot in a separate storage slot.
      // Normal autosaves rotate BACKUP_KEY; this one never gets overwritten.
      if (candidate.v !== 17 && !window.localStorage.getItem(PRE_VOLTAGE_BACKUP_KEY)) {
        try { window.localStorage.setItem(PRE_VOLTAGE_BACKUP_KEY, raw); }
        catch { /* Limited storage; the in-memory migration still proceeds. */ }
      }
      return migrateSave(candidate);
    } catch {
      // A single bad slot must not hide other usable snapshots.
    }
  }
  return null;
}

export function persist(s: GameState): boolean {
  try {
    const previous = window.localStorage.getItem(SAVE_KEY);
    // Preserve the last readable primary snapshot before replacing it.
    if (previous) {
      try {
        const parsed: unknown = JSON.parse(previous);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
            typeof (parsed as Record<string, unknown>).fingers === "number" &&
            Number.isFinite((parsed as Record<string, number>).fingers)) {
          window.localStorage.setItem(BACKUP_KEY, previous);
        }
      } catch {
        // Leave the existing backup untouched.
      }
    }
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now(), v: 17 }));
    return true;
  } catch {
    // No storage (e.g. private browsing): retain the in-memory session.
    return false;
  }
}

/** Reset both slots and all legacy keys before writing a genuinely fresh save. */
export function resetSave(): GameState {
  const fresh = freshSave();
  try {
    for (const key of [SAVE_KEY, BACKUP_KEY, LEGACY_V9_KEY, LEGACY_V8_KEY, LEGACY_V6_KEY, PRE_VOLTAGE_BACKUP_KEY]) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable. The UI still resets in memory.
  }
  persist(fresh);
  return fresh;
}


/** Persist UI options (scanlines, haptics) between sessions. */
export function saveOpts(o: { scan: boolean; buzz: boolean }) {
  try {
    window.localStorage.setItem(OPTS_KEY, JSON.stringify(o));
  } catch {
    /* options stay in-session only if storage is unavailable */
  }
}
