/**
 * Persistence: saving and loading against localStorage, migration
 * from every legacy save format, and player options.
 */
import { GAS_LIST } from "./gases";
import { MAX_VOLT_STEPS, VOLT_STEP, zero3 } from "./config";
import type { GasId, GameState } from "./types";

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
    created: now, lastSeen: now,
  };
}

// migrate older saves into the micro-volt economy
export function migrateSave(old: Record<string, unknown>): GameState {
  const base = freshSave();
  // v10 / v9 saves: load as-is (v9 predates splits)
  if (old.v === 11 || old.v === 10 || old.v === 9) {
    const s = { ...base, ...(old as unknown as GameState) };
    if (!s.splits) s.splits = zero3();
    if (typeof s.ghosts !== "number") s.ghosts = 0;
    return s;
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
    return base;
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
    return base;
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
    const s = JSON.parse(raw);
    if (typeof s.fingers !== "number") return null;
    return migrateSave(s);
  } catch {
    return null;
  }
}
export function persist(s: GameState) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now(), v: 11 }));
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
