/**
 * Persistence: saving and loading against localStorage, migration
 * from every legacy save format, and player options.
 */
import { GAS_LIST } from "./gases.ts";
import { MAX_VOLT_STEPS, SPLIT_CAP, VOLT_STEP, zero3 } from "./config.ts";
import type { GasId, GameState } from "./types.ts";

export const SAVE_KEY = "idle-plasma-ball-save-v10";
export const LEGACY_V9_KEY = "idle-plasma-ball-save-v9";
export const LEGACY_V8_KEY = "idle-plasma-ball-save-v8";
export const LEGACY_V6_KEY = "idle-plasma-ball-save-v6";
export const OPTS_KEY = "idle-plasma-ball-opts-v1";

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

export function freshSave(): GameState {
  const now = Date.now();
  return {
    plasma: zero3(), total: zero3(), crackles: 0,
    voltage: zero3(), fingers: 0, toes: 0, ghosts: 0,
    filaments: zero3(), splits: zero3(), unlocked: ["neon"],
    created: now, lastSeen: now, activeSeconds: 0,
  };
}


/** Normalize untrusted persisted values before using them in the simulation. */
function validNumber(value: unknown, fallback = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, maximum) : fallback;
}
function sanitizeSave(s: GameState): GameState {
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
  const filaments = record(s.filaments);
  const voltage = record(s.voltage, MAX_VOLT_STEPS);
  const splits = record(s.splits, SPLIT_CAP);
  for (const g of GAS_LIST) {
    filaments[g.id] = Math.floor(Math.min(g.cap, filaments[g.id]));
    voltage[g.id] = Math.floor(voltage[g.id]);
    splits[g.id] = Math.floor(splits[g.id]);
  }
  return {
    plasma: record(s.plasma), total: record(s.total),
    crackles: Math.floor(validNumber(s.crackles)),
    voltage, filaments, splits, unlocked,
    fingers: Math.floor(validNumber(s.fingers)),
    toes: Math.floor(validNumber(s.toes)),
    ghosts: Math.floor(validNumber(s.ghosts)),
    created: validNumber(s.created, fallback.created),
    lastSeen: validNumber(s.lastSeen, fallback.lastSeen),
    activeSeconds: validNumber(s.activeSeconds),
  };
}

// migrate older saves into the micro-volt economy
export function migrateSave(old: Record<string, unknown>): GameState {
  const base = freshSave();
  // v10 / v9 saves: load as-is (v9 predates splits)
  if (old.v === 12 || old.v === 11 || old.v === 10 || old.v === 9) {
    const s = { ...base, ...(old as unknown as GameState) };
    if (!s.splits) s.splits = zero3();
    if (typeof s.ghosts !== "number") s.ghosts = 0;
    return sanitizeSave(s);
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
      gas === "xenon" ? ["neon", "argon", "xenon"]
      : gas === "argon" ? ["neon", "argon"]
      : ["neon"];
    base.created = (old.created as number) ?? Date.now();
    return sanitizeSave(base);
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
    return sanitizeSave(base);
  }
  return base;
}

export function loadSave(): GameState | null {
  try {
    const raw =
      window.localStorage.getItem(SAVE_KEY) ??
      window.localStorage.getItem(LEGACY_V9_KEY) ??
      window.localStorage.getItem(LEGACY_V8_KEY) ??
      window.localStorage.getItem(LEGACY_V6_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const s = parsed as Record<string, unknown>;
    if (typeof s.fingers !== "number") return null;
    return migrateSave(s);
  } catch {
    return null;
  }
}
export function persist(s: GameState) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now(), v: 12 }));
  } catch {
    /* in-session only */
  }
}


/** Persist UI options (scanlines, haptics) between sessions. */
export function saveOpts(o: { scan: boolean; buzz: boolean }) {
  try {
    window.localStorage.setItem(OPTS_KEY, JSON.stringify(o));
  } catch {
    /* options stay in-session only if storage is unavailable */
  }
}
