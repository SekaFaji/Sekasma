
import React, { useEffect, useRef, useState } from "react";

// ============================================================
// IDLE PLASMA BALL — v11.1 "STEADY HANDS"
// - v11.1: max 2 player touches (stuck-pointer bugfix + window
//   cleanup), helpers & ghosts face the ball in 8 directions,
//   every upgrade always shows its next price
// - v11: ghost hands pressing from inside + living static motes
// - v10.x: split strings, bulk buy, toasts/haptics, micro-volts
// Logic block is framework-free → Vite + Capacitor.
// ============================================================

// ---------- Pure game logic (portable) ----------
type GasId = "neon" | "argon" | "xenon";

type Gas = {
  id: GasId;
  name: string;
  color: string;
  glow: string;
  core: string;
  baseRate: number; // plasma per crackle per arc-bonus at 0 upgrades
  cap: number; // max filaments (arcs) of this gas in the glass
  unlockCost: Partial<Record<GasId, number>>;
};

const GAS_LIST: Gas[] = [
  { id: "neon", name: "NEON", color: "#ff5ec8", glow: "#b3238f", core: "#ffd6f2", baseRate: 0.1, cap: 12, unlockCost: {} },
  { id: "argon", name: "ARGON", color: "#7d7dff", glow: "#3d3dc9", core: "#dfe4ff", baseRate: 0.5, cap: 8, unlockCost: { neon: 600 } },
  { id: "xenon", name: "XENON", color: "#35e0e8", glow: "#0f8fa8", core: "#d8fbff", baseRate: 2.5, cap: 6, unlockCost: { argon: 5000 } },
];

type GasRecord = Record<GasId, number>;

type GameState = {
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
};

// a "crackle" = one press on the glass
const PRESS_INTERVAL = 2.2; // hired help presses this often
const HOLD_INTERVAL = 1.2; // manual crackles while held (per finger)
const TOE_MULT = 8; // a foot presses 8x harder than a finger
const OFFLINE_CAP_S = 8 * 3600;

const FIL_BASE: GasRecord = { neon: 12, argon: 30, xenon: 80 };
const VOLT_BASE: GasRecord = { neon: 6, argon: 16, xenon: 48 };
const SPLIT_BASE: GasRecord = { neon: 20, argon: 60, xenon: 150 };
const SPLIT_CAP = 8; // max branches per gas
const GHOST_MULT = 20; // a ghost hand presses 20x harder than a finger

// a split string: every branch carries 0.75x → 1 split = 1.5x output
const splitMult = (n: number) => (n <= 0 ? 1 : 0.75 * (1 + n));

// micro-volts: each purchase adds +0.0001V; output = 1 + volts
const VOLT_STEP = 0.0001;
const MAX_VOLT_STEPS = 99999;
const voltValue = (steps: number) => steps * VOLT_STEP;
const voltMult = (steps: number) => 1 + voltValue(steps);
const fmtVolts = (steps: number) => voltValue(steps).toFixed(4) + "V";

const zero3 = (): GasRecord => ({ neon: 0, argon: 0, xenon: 0 });
const gasById = (id: GasId): Gas => GAS_LIST.find((g) => g.id === id)!;
const nextGas = (unlocked: GasId[]): Gas | null => {
  const last = unlocked[unlocked.length - 1];
  const i = GAS_LIST.findIndex((g) => g.id === last);
  return i >= 0 && i < GAS_LIST.length - 1 ? GAS_LIST[i + 1] : null;
};

// past certain levels, hired help demands payment in EVERY currency
const MIX_LV = { argon: 12, xenon: 25 };
const fingerCost = (n: number, unlocked: GasId[]): Partial<GasRecord> => {
  const c: Partial<GasRecord> = { neon: Math.ceil(5 * Math.pow(1.18, n)) };
  if (n >= MIX_LV.argon && unlocked.includes("argon"))
    c.argon = Math.ceil(3 * Math.pow(1.15, n));
  if (n >= MIX_LV.xenon && unlocked.includes("xenon"))
    c.xenon = Math.ceil(2 * Math.pow(1.12, n));
  return c;
};
const toeCost = (n: number, unlocked: GasId[]): Partial<GasRecord> => {
  const c: Partial<GasRecord> = { argon: Math.ceil(15 * Math.pow(1.3, n)) };
  if (n >= MIX_LV.argon)
    c.neon = Math.ceil(8 * Math.pow(1.15, n));
  if (n >= MIX_LV.xenon && unlocked.includes("xenon"))
    c.xenon = Math.ceil(4 * Math.pow(1.12, n));
  return c;
};
const ghostCost = (n: number): Partial<GasRecord> => ({
  xenon: Math.ceil(80 * Math.pow(1.45, n)),
});
const splitCost = (g: GasId, n: number): Partial<GasRecord> => ({
  [g]: Math.ceil(SPLIT_BASE[g] * Math.pow(2.2, n)),
} as Partial<GasRecord>);
const filamentCost = (g: GasId, n: number): Partial<GasRecord> => ({
  [g]: Math.ceil(FIL_BASE[g] * Math.pow(1.55, n)),
} as Partial<GasRecord>);
const voltageCost = (g: GasId, v: number): Partial<GasRecord> => ({
  [g]: Math.ceil(VOLT_BASE[g] * Math.pow(1.07, v)),
} as Partial<GasRecord>);

// per-gas crackle power = baseRate x (1 + arcs) x (1 + volts) x splits
const cracklePower = (g: Gas, s: GameState) =>
  g.baseRate * (1 + s.filaments[g.id]) * voltMult(s.voltage[g.id]) * splitMult(s.splits[g.id]);

// idle income per gas = hired help pressing around the clock
const idleRate = (s: GameState): GasRecord => {
  const out = zero3();
  for (const g of GAS_LIST) {
    if (!s.unlocked.includes(g.id)) continue;
    out[g.id] =
      ((s.fingers + s.toes * TOE_MULT + s.ghosts * GHOST_MULT) * cracklePower(g, s)) /
      PRESS_INTERVAL;
  }
  return out;
};

const canAfford = (s: GameState, cost: Partial<GasRecord>) =>
  (Object.entries(cost) as [GasId, number][]).every(([g, amt]) => s.plasma[g] >= amt);
const pay = (s: GameState, cost: Partial<GasRecord>) => {
  for (const [g, amt] of Object.entries(cost) as [GasId, number][])
    s.plasma[g] -= amt;
};

// ---------- Bulk buying (1 / 5 / 10 / 100 / MAX) ----------
type BuyKind = "finger" | "toe" | "ghost" | "filament" | "voltage" | "split" | "gas";

const addCosts = (a: Partial<GasRecord>, b: Partial<GasRecord>): Partial<GasRecord> => {
  const out: Partial<GasRecord> = { ...a };
  for (const [g, v] of Object.entries(b) as [GasId, number][])
    out[g] = (out[g] ?? 0) + v;
  return out;
};

// total cost of buying up to `count` units; stops at caps or when broke.
// returns what actually fits so the UI can buy partial amounts.
const bulkCost = (
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
function peekCost(s: GameState, kind: BuyKind, gid?: GasId): Partial<GasRecord> {
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

function fmt(n: number): string {
  if (n < 0.005) return "0";
  if (n < 1) return n.toFixed(2);
  if (n < 10) return n.toFixed(1);
  if (n < 1000) return Math.floor(n).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
}

function fmtShort(n: number): string {
  if (n < 10) return n.toFixed(1);
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return (n / 1e3).toFixed(1) + "K";
  if (n < 1e9) return (n / 1e6).toFixed(1) + "M";
  return (n / 1e9).toFixed(1) + "B";
}

function haptic(ms: number) {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(ms);
  } catch {
    /* device without vibration */
  }
}

function buyMsg(kind: BuyKind, gid: GasId | undefined, n: number): string {
  const s = (base: string) => (n > 1 ? base + "S" : base);
  if (kind === "finger") return `+${n} ${s("FINGER")} HIRED`;
  if (kind === "toe") return n > 1 ? `+${n} FEET HIRED` : "+1 FOOT HIRED";
  if (kind === "ghost") return n > 1 ? `+${n} GHOST HANDS` : "+1 GHOST HAND";
  if (kind === "filament") return `+${n} ${gasById(gid!).name} ${s("ARC")}`;
  if (kind === "voltage") return `+${n} ${s("VOLT STEP")}`;
  return `+${n} ${s("BRANCH")}`;
}

const SAVE_KEY = "idle-plasma-ball-save-v10";
const LEGACY_V9_KEY = "idle-plasma-ball-save-v9";
const LEGACY_V8_KEY = "idle-plasma-ball-save-v8";
const LEGACY_V6_KEY = "idle-plasma-ball-save-v6";
const OPTS_KEY = "idle-plasma-ball-opts-v1";

function loadOpts(): { scan: boolean; buzz: boolean } {
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

function freshSave(): GameState {
  const now = Date.now();
  return {
    plasma: zero3(), total: zero3(), crackles: 0,
    voltage: zero3(), fingers: 0, toes: 0, ghosts: 0,
    filaments: zero3(), splits: zero3(), unlocked: ["neon"],
    created: now, lastSeen: now,
  };
}

// migrate older saves into the micro-volt economy
function migrateSave(old: Record<string, unknown>): GameState {
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

function loadSave(): GameState | null {
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
function persist(s: GameState) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now(), v: 11 }));
  } catch {
    /* in-session only */
  }
}

// ---------- Pixel art: sprite models ----------
const PX = 150; // internal canvas (2x integer scale at 300px display)
const CX = 75;
const CY = 63;
const R = 52;

const SKIN = "#f0a875";
const SKIN2 = "#c97f52"; // shaded underside
const NAIL = "#ffe3d0";
const OUTLINE = "#2a1233";
const SKIN_PALETTE: Record<string, string> = { "0": OUTLINE, "1": SKIN, "2": NAIL, "3": SKIN2 };
// helpers behind the glass: pressed from the far side, silhouetted
const BACK_PALETTE: Record<string, string> = { "0": "#150a1e", "1": "#a5704b", "2": "#b9937f", "3": "#8a5a3b" };

// slimmer + longer, like a human finger
const FINGER_SPRITE = [
  ".000.",
  "02220",
  "02220",
  "01110",
  "01110",
  "01110",
  "01110",
  "01110",
  "01110",
  "01110",
  "01310",
  "03130",
  ".000.",
];

// the BIG TOE: the old, chunkier digit art (approved v3 finger look)
const FOOT_SPRITE = [
  ".00000.",
  "0122210",
  "0122210",
  "0122210",
  "0111110",
  "0111110",
  "0111110",
  ".01110.",
  ".01110.",
  "..000..",
];

const PLAYER_FINGER = [
  "..00000..",
  ".0222220.",
  ".0222220.",
  ".0222220.",
  "001111100",
  "011111110",
  "011131310",
  ".0131310.",
  ".0313130.",
  ".0313130.",
  "..031310.",
  "...0000..",
];

// the ghost hand: reaches from the electrode, fingers toward the glass
const GHOST_SPRITE = [
  "2.2.2.2",
  "2.2.2.2",
  "1212121",
  "1111111",
  ".11111.",
  ".11111.",
  ".11111.",
  "..111..",
  "..111..",
  "...1...",
];
const GHOST_PALETTE: Record<string, string> = { "1": "#a9b8ff", "2": "#eef4ff" };

function rotCW(s: string[]): string[] {
  const H = s.length;
  const W = s[0].length;
  const out: string[] = [];
  for (let y = 0; y < W; y++) {
    let row = "";
    for (let x = 0; x < H; x++) row += s[H - 1 - x][y];
    out.push(row);
  }
  return out;
}

// 45° nearest-neighbour rotation → helpers face the ball in 8 ways
function rot45(s: string[]): string[] {
  const H = s.length;
  const W = s[0].length;
  const D = Math.ceil((W + H) / Math.SQRT2) + 1;
  const cos = Math.cos(Math.PI / 4);
  const sin = Math.sin(Math.PI / 4);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const mid = (D - 1) / 2;
  const out: string[] = [];
  for (let y = 0; y < D; y++) {
    let row = "";
    for (let x = 0; x < D; x++) {
      const dx = x - mid;
      const dy = y - mid;
      const sx = Math.round(dx * cos + dy * sin + cx);
      const sy = Math.round(-dx * sin + dy * cos + cy);
      row +=
        sy >= 0 && sy < H && sx >= 0 && sx < W && s[sy][sx] !== "."
          ? s[sy][sx]
          : ".";
    }
    out.push(row);
  }
  return out;
}

// 8 orientations at 45° steps: 0, 45, 90 ... 315 (clockwise)
function sprOrients8(spr: string[]): string[][] {
  const q = [spr, rotCW(spr), rotCW(rotCW(spr)), rotCW(rotCW(rotCW(spr)))];
  return [q[0], rot45(q[0]), q[1], rot45(q[1]), q[2], rot45(q[2]), q[3], rot45(q[3])];
}
const FINGER_ORIENTS = sprOrients8(FINGER_SPRITE);
const FOOT_ORIENTS = sprOrients8(FOOT_SPRITE);
const GHOST_ORIENTS = sprOrients8(GHOST_SPRITE);

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  palette: Record<string, string>,
) {
  for (let r = 0; r < sprite.length; r++)
    for (let c = 0; c < sprite[r].length; c++) {
      const ch = sprite[r][c];
      if (ch === ".") continue;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
}

function drawOriented(
  ctx: CanvasRenderingContext2D,
  orients: string[][],
  angle: number,
  press: number,
  palette: Record<string, string>,
) {
  const inwardA = angle + Math.PI;
  const idx = ((Math.round((inwardA + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  const spr = orients[idx];
  const w = spr[0].length;
  const h = spr.length;
  const len = Math.max(w, h);
  const rad = R - 1 - Math.round(press * 2) + len / 2;
  drawSprite(
    ctx, spr,
    Math.round(CX + Math.cos(angle) * rad - w / 2),
    Math.round(CY + Math.sin(angle) * rad - h / 2),
    palette,
  );
}

// ghost hands: grow from the electrode, fingers point OUT to the glass
function drawGhost(
  ctx: CanvasRenderingContext2D,
  angle: number,
  reach: number,
  alpha: number,
  t: number,
) {
  const idx = ((Math.round((angle + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  const spr = GHOST_ORIENTS[idx];
  const w = spr[0].length;
  const h = spr.length;
  const jitter = Math.sin(t * 21) * 0.6;
  ctx.globalAlpha = alpha;
  drawSprite(
    ctx, spr,
    Math.round(CX + Math.cos(angle) * (reach + jitter) - w / 2),
    Math.round(CY + Math.sin(angle) * (reach + jitter) - h / 2),
    GHOST_PALETTE,
  );
  ctx.globalAlpha = 1;
}

// ---------- UI pixel icons (no emoji) ----------
const VOLT_ICON = [
  "...111.",
  "..111..",
  ".111...",
  ".1111..",
  "..111..",
  ".111...",
  "111....",
  "11.....",
];
const FIL_ICON = [
  "...11..",
  "..111..",
  ".111...",
  "111....",
  ".111...",
  "..111..",
  "...11..",
  "....11.",
];
const GAS_ICON = [
  "1111111",
  "..111..",
  "...1...",
  "...1...",
  "..1.1..",
  "..1.1..",
  ".1...1.",
  ".11111.",
];
const SPLIT_ICON = [
  "1.....1",
  "11...11",
  ".11.11.",
  "..111..",
  "...1...",
  "...1...",
  "...1...",
  "...1...",
];

function PixelIcon({
  sprite, color, px = 2, palette,
}: {
  sprite: string[];
  color?: string;
  px?: number;
  palette?: Record<string, string>;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = sprite[0].length;
    const h = sprite.length;
    c.width = w;
    c.height = h;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, sprite, 0, 0, palette ?? { "1": color ?? "#ffffff" });
  }, [sprite, color, palette]);
  return (
    <canvas
      ref={ref}
      style={{
        width: sprite[0].length * px,
        height: sprite.length * px,
        imageRendering: "pixelated",
        display: "inline-block",
      }}
    />
  );
}

// ---------- Text: tiny pixel font ----------
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "+": ["000", "010", "111", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
  K: ["101", "101", "110", "101", "101"],
  M: ["101", "111", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  P: ["111", "101", "111", "100", "100"],
  R: ["111", "101", "111", "110", "101"],
  E: ["111", "100", "111", "100", "111"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  H: ["101", "101", "111", "101", "101"],
  A: ["010", "101", "111", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  " ": ["000", "000", "000", "000", "000"],
};

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  str: string,
  color: string,
) {
  ctx.fillStyle = color;
  let cursor = x - ((str.length * 4 - 1) / 2);
  for (const ch of str) {
    const glyph = FONT[ch];
    if (glyph)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (glyph[r][c] === "1")
            ctx.fillRect(Math.round(cursor + c), Math.round(y + r), 1, 1);
    cursor += 4;
  }
}

// ---------- The plasma arc ----------
function drawPlasmaArc(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  gas: Gas,
  t: number,
  phase: number,
  amp: number,
  jit = 0,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.max(4, Math.floor(len));
  const sway = 0.7 + 0.3 * Math.sin(t * 0.9 + phase * 2);
  const flick = Math.max(0.25, 0.7 + 0.3 * Math.sin(t * 2 + phase) + Math.random() * 0.15);

  // two sine octaves = lazy snake instead of a straight bow
  const offAt = (p: number) =>
    amp * sway * Math.sin(p * Math.PI + t * 1.3 + phase) +
    amp * 0.55 * Math.sin(p * 3.7 + t * 2.2 + phase * 2.3) +
    jit * Math.sin(p * 9.4 + t * 7 + phase * 5);

  ctx.globalAlpha = 0.13 * flick;
  ctx.fillStyle = gas.glow;
  for (let i = 0; i <= steps; i += 2) {
    const p = i / steps;
    const off = offAt(p);
    ctx.fillRect(
      Math.round(x1 + dx * p + (-(dy / len)) * off) - 1,
      Math.round(y1 + dy * p + (dx / len) * off) - 1,
      3, 3,
    );
  }
  ctx.globalAlpha = 0.85 * flick;
  ctx.fillStyle = gas.color;
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const off = offAt(p);
    ctx.fillRect(
      Math.round(x1 + dx * p + (-(dy / len)) * off),
      Math.round(y1 + dy * p + (dx / len) * off),
      1, 1,
    );
  }
  ctx.globalAlpha = 0.95;
  for (let i = 0; i <= steps; i += 2) {
    const p = i / steps;
    const off = offAt(p);
    ctx.fillStyle = Math.random() < 0.08 ? "#ffffff" : gas.core;
    ctx.fillRect(
      Math.round(x1 + dx * p + (-(dy / len)) * off),
      Math.round(y1 + dy * p + (dx / len) * off),
      1, 1,
    );
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x2), Math.round(y2), 1, 1);
  if (Math.random() < 0.5) {
    ctx.fillStyle = gas.core;
    ctx.fillRect(Math.round(x2) + (Math.random() < 0.5 ? -1 : 1), Math.round(y2) + (Math.random() < 0.5 ? -1 : 1), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function pixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const steps = Math.max(10, Math.floor(r * 1.4));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------- Plasma ball renderer (multi-touch, multi-gas) ----------
type Ripple = { x: number; y: number; age: number; color: string };
type FloatText = { x: number; y: number; age: number; str: string };
type Flash = { x: number; y: number; age: number; forks: number; amp: number; gas: Gas };
type HoldArc = {
  kind: "leader" | "roam"; // leaders stick to your finger, roams wander the glass
  pid: number; // owning pointer for leaders
  ang: number;
  drift: number;
  reach: number;
  phase: number;
  ttl: number;
  age: number;
  gas: Gas;
  fork: boolean;
};
type Wanderer = {
  base: number;
  drift: number;
  wob: number;
  phase: number;
  timer: number;
  back: boolean; // presses from behind the glass
};

function PlasmaBall({
  filaments, splits, unlocked, fingers, toes, ghosts, crackles, neonPow, onCrackle, buzzOn,
}: {
  filaments: GasRecord;
  splits: GasRecord;
  unlocked: Gas[];
  fingers: number;
  toes: number;
  ghosts: number;
  crackles: number;
  neonPow: number;
  onCrackle: (fingerCount: number) => void;
  buzzOn: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const ripples = useRef<Ripple[]>([]);
  const texts = useRef<FloatText[]>([]);
  const flashes = useRef<Flash[]>([]);
  const holdArcs = useRef<HoldArc[]>([]);
  const fingerSeeds = useRef<Wanderer[]>([]);
  const toeSeeds = useRef<Wanderer[]>([]);
  const propsRef = useRef({ filaments, splits, unlocked, fingers, toes, ghosts, crackles });
  propsRef.current = { filaments, splits, unlocked, fingers, toes, ghosts, crackles };
  const neonPowRef = useRef(neonPow);
  neonPowRef.current = neonPow;
  const buzzRef = useRef(buzzOn);
  buzzRef.current = buzzOn;
  const crackleRef = useRef(onCrackle);
  crackleRef.current = onCrackle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // ---- static far background: stars + stand (behind everything) ----
    const far = document.createElement("canvas");
    far.width = PX;
    far.height = PX;
    {
      const b = far.getContext("2d")!;
      for (let i = 0; i < 52; i++) {
        const x = Math.floor(Math.random() * PX);
        const y = Math.floor(Math.random() * PX);
        if (Math.hypot(x - CX, y - CY) < R + 7) continue;
        b.globalAlpha = 0.25 + Math.random() * 0.35;
        b.fillStyle = Math.random() < 0.25 ? "#3a2d6e" : "#221a4a";
        b.fillRect(x, y, 1, 1);
      }
      b.globalAlpha = 1;
      // stand under the ball
      b.fillStyle = "#14102a";
      b.fillRect(CX - 7, CY + R + 1, 14, 3);
      b.fillRect(CX - 11, CY + R + 4, 22, 2);
      b.fillStyle = "#1f1838";
      b.fillRect(CX - 4, CY + R + 1, 8, 1);
    }

    // ---- glass cache: dead + lit, rebuilt when gases change ----
    const cache: { sig: string; dead: HTMLCanvasElement; lit: HTMLCanvasElement } = {
      sig: "",
      dead: document.createElement("canvas"),
      lit: document.createElement("canvas"),
    };
    const buildBg = (signature: string) => {
      for (const [key, lit] of [
        ["dead", false],
        ["lit", true],
      ] as const) {
        const c = cache[key];
        c.width = PX;
        c.height = PX;
        const b = c.getContext("2d")!;
        for (let y = CY - R - 2; y <= CY + R + 2; y++)
          for (let x = CX - R - 2; x <= CX + R + 2; x++) {
            const d = Math.hypot(x - CX, y - CY);
            if (d > R) continue;
            const band = d / R;
            b.fillStyle = band < 0.4
              ? lit ? "#2e1a5e" : "#170f36"
              : band < 0.8
              ? lit ? "#1f1250" : "#0f0a2c"
              : lit ? "#160e3c" : "#0a0622";
            b.fillRect(x, y, 1, 1);
          }
        // electrode stem from base to center
        b.fillStyle = "#241645";
        b.fillRect(CX - 1, CY + 3, 2, R - 4);
        b.fillStyle = "#31215e";
        b.fillRect(CX - 1, CY + 3, 1, R - 4);
        if (lit) {
          // dither sparkles in every unlocked gas color
          const u = propsRef.current.unlocked;
          for (let i = 0; i < 110; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.random() * (R - 4);
            const g = u[Math.floor(Math.random() * u.length)];
            b.fillStyle = Math.random() < 0.5 ? g.color : g.glow;
            b.globalAlpha = 0.5;
            b.fillRect(Math.round(CX + Math.cos(a) * rr), Math.round(CY + Math.sin(a) * rr), 1, 1);
            b.globalAlpha = 1;
          }
        }
        // rim
        for (let i = 0; i < 260; i++) {
          const a = (i / 260) * Math.PI * 2;
          const px = Math.round(CX + Math.cos(a) * R);
          const py = Math.round(CY + Math.sin(a) * R);
          const bright = a > Math.PI * 1.05 && a < Math.PI * 1.5;
          b.fillStyle = bright ? (lit ? "#b7b2ff" : "#8f8bd8") : lit ? "#5d57a0" : "#4a4473";
          b.fillRect(px, py, 1, 1);
        }
        // fixed specular highlight, top-left
        b.globalAlpha = lit ? 0.35 : 0.22;
        b.fillStyle = "#cfd8ff";
        b.fillRect(CX - 26, CY - 27, 7, 2);
        b.fillRect(CX - 28, CY - 24, 4, 2);
        b.globalAlpha = 1;
      }
      cache.sig = signature;
    };

    // ---- living static motes: slow violet sparks inside the glass ----
    const MOTE_COLS = ["#b7b2ff", "#9b8cff", "#8f8bd8", "#cfd8ff"];
    const motes: {
      ang: number; rad: number; spd: number; wob: number; ph: number;
      big: boolean; col: string; tint: boolean;
    }[] = [];
    for (let i = 0; i < 26; i++) {
      motes.push({
        ang: Math.random() * Math.PI * 2,
        rad: 5 + Math.random() * (R - 10),
        spd: (0.08 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1),
        wob: Math.random() * Math.PI * 2,
        ph: Math.random() * Math.PI * 2,
        big: Math.random() < 0.18,
        col: MOTE_COLS[Math.floor(Math.random() * MOTE_COLS.length)],
        tint: Math.random() < 0.2,
      });
    }

    // ---- ghost hands: the plasma presses back ----
    const GHOST_T = 4.5; // manifest cycle: emerge 0.7s → hold 1.3s → dissolve 0.5s
    const ghostOffs: number[] = [];
    const ghostState = (i: number, t: number) => {
      const off = ghostOffs[i] ?? 0;
      const tc = (t + off) % GHOST_T;
      if (tc < 0.7) return { st: 0, p: tc / 0.7 };
      if (tc < 2.0) return { st: 1, p: (tc - 0.7) / 1.3 };
      if (tc < 2.5) return { st: 2, p: (tc - 2.0) / 0.5 };
      return { st: 3, p: 0 };
    };

    let raf = 0;
    const start = performance.now();
    let last = start;
    let holdNext = Infinity;

    const newWanderer = (i: number, t: number): Wanderer => ({
      // golden-angle spread: no clumping, no cap
      base: i * 2.399963 + Math.random() * 0.8,
      drift: (0.015 + Math.random() * 0.04) * (Math.random() < 0.5 ? -1 : 1),
      wob: 0.8 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      timer: t + Math.random() * PRESS_INTERVAL,
      back: i % 2 === 1,
    });

    // pick a gas weighted by arcs + splits — invested gases stream more
    const pickGas = (): Gas => {
      const u = propsRef.current.unlocked;
      const fil = propsRef.current.filaments;
      const spl = propsRef.current.splits;
      const weights = u.map((g) => 1 + fil[g.id] + spl[g.id] * 2);
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < u.length; i++) {
        r -= weights[i];
        if (r <= 0) return u[i];
      }
      return u[u.length - 1];
    };

    const newFlash = (x: number, y: number, foot: boolean): Flash => ({
      x, y, age: 0,
      forks: foot ? 3 : Math.random() < 0.3 ? 2 : 1,
      amp: 3 + Math.random() * 5,
      gas: pickGas(),
    });
    const strayFlash = (): Flash => ({
      x: CX + Math.cos(Math.random() * Math.PI * 2) * (R - 2),
      y: CY + Math.sin(Math.random() * Math.PI * 2) * (R - 2),
      age: 0,
      forks: Math.random() < 0.4 ? 2 : 1,
      amp: 3 + Math.random() * 5,
      gas: pickGas(),
    });

    const newHoldArc = (kind: "leader" | "roam", pid: number): HoldArc =>
      kind === "leader"
        ? {
            kind, pid,
            ang: Math.random() * Math.PI * 2,
            drift: (Math.random() - 0.5) * 1.2,
            reach: 1 + Math.random() * 3.5,
            phase: Math.random() * Math.PI * 2,
            ttl: 0.25 + Math.random() * 0.7,
            age: 0, gas: pickGas(), fork: false,
          }
        : {
            kind, pid,
            ang: Math.random() * Math.PI * 2,
            drift: (0.3 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1),
            reach: R - 3 - Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
            ttl: 0.5 + Math.random() * 2,
            age: 0, gas: pickGas(), fork: Math.random() < 0.35,
          };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const { filaments: fil, fingers: fing, toes: toe, unlocked: u, crackles: crk } = propsRef.current;
      const sig = u.map((g) => g.id).join(",");
      if (cache.sig !== sig) buildBg(sig);

      // active = fingers actually on the glass
      const pts = [...pointers.current.entries()].filter(
        ([, p]) => Math.hypot(p.x - CX, p.y - CY) < R * 1.15,
      );
      const held = pts.length > 0;
      const activeFlash = flashes.current.length > 0;

      // ---- one pass over all helpers (front or back) ----
      const runHelpers = (
        seeds: { current: Wanderer[] }, count: number, orients: string[][],
        foot: boolean, backPass: boolean,
      ) => {
        while (seeds.current.length < count) seeds.current.push(newWanderer(seeds.current.length, t));
        if (seeds.current.length > count) seeds.current.length = count;
        for (const w of seeds.current) {
          if (w.back !== backPass) continue;
          const angle = w.base + w.drift * t + Math.sin(t * w.wob + w.phase) * (foot ? 0.2 : 0.3);
          const tx = Math.round(CX + Math.cos(angle) * (R - 1));
          const ty = Math.round(CY + Math.sin(angle) * (R - 1));
          if (t >= w.timer) {
            w.timer = t + PRESS_INTERVAL;
            flashes.current.push(newFlash(tx, ty, foot));
            if (foot) flashes.current.push({ ...newFlash(tx, ty, foot) });
            if (Math.random() < (foot ? 0.2 : 0.08)) flashes.current.push(strayFlash());
            const c = pickGas().color;
            ripples.current.push({ x: tx, y: ty, age: 0, color: c });
          }
          const since = t - (w.timer - PRESS_INTERVAL);
          drawOriented(
            ctx, orients, angle,
            Math.max(0, 1 - since / (foot ? 0.35 : 0.3)),
            w.back ? BACK_PALETTE : SKIN_PALETTE,
          );
        }
      };

      ctx.clearRect(0, 0, PX, PX);
      ctx.drawImage(far, 0, 0);

      // helpers pressing from BEHIND the glass: silhouettes, mostly hidden
      runHelpers(fingerSeeds, fing, FINGER_ORIENTS, false, true);
      runHelpers(toeSeeds, toe, FOOT_ORIENTS, true, true);

      // the glass
      ctx.drawImage(held || activeFlash ? cache.lit : cache.dead, 0, 0);

      // ---- living static motes: the ball is never quite dead ----
      for (const m of motes) {
        m.ang += m.spd * dt * (held ? 2.2 : 1);
        const wob = Math.sin(t * 0.8 + m.wob) * 2.5;
        let x = CX + Math.cos(m.ang) * (m.rad + wob);
        let y = CY + Math.sin(m.ang) * (m.rad + wob);
        if (held && pts.length > 0) {
          const pt = pts[0][1];
          x += (pt.x - x) * 0.12;
          y += (pt.y - y) * 0.12;
        }
        ctx.globalAlpha = 0.22 + 0.38 * (0.5 + 0.5 * Math.sin(t * 3.1 + m.ph));
        ctx.fillStyle = m.tint ? pickGas().color : m.col;
        if (m.big) {
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        } else {
          ctx.fillRect(
            Math.round(x) + (Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0),
            Math.round(y), 1, 1,
          );
        }
      }
      ctx.globalAlpha = 1;

      // ---- ghost hands press from INSIDE the glass ----
      let ghostHold: { ang: number } | null = null;
      const gho = propsRef.current.ghosts;
      while (ghostOffs.length < gho) ghostOffs.push(Math.random() * GHOST_T);
      if (ghostOffs.length > gho) ghostOffs.length = gho;
      for (let gi = 0; gi < gho; gi++) {
        const { st, p } = ghostState(gi, t);
        if (st === 3) continue;
        const ang = gi * 2.399963 + Math.sin(t * 0.11 + gi * 1.7) * 0.15;
        let reach: number;
        let alpha: number;
        if (st === 0) {
          const e = p * p * (3 - 2 * p);
          reach = 10 + (R - 17) * e;
          alpha = 0.15 + 0.6 * e;
        } else if (st === 1) {
          reach = R - 7 + Math.sin(t * 13 + gi) * 0.7;
          alpha = 0.62 + Math.sin(t * 9 + gi) * 0.1;
          ghostHold = { ang };
        } else {
          reach = R - 7 + p * 14;
          alpha = 0.75 * (1 - p);
        }
        drawGhost(ctx, ang, reach, alpha, t + gi);
        if (st === 1) {
          // your strings bend toward its palm
          drawPlasmaArc(
            ctx, CX, CY,
            CX + Math.cos(ang) * (R - 8), CY + Math.sin(ang) * (R - 8),
            pickGas(), t, gi, 2.4, 1.3,
          );
          // press moment → flash + ripple on the glass
          const tc = (t + ghostOffs[gi]) % GHOST_T;
          if (tc - Math.min(dt, 0.1) < 0.7) {
            flashes.current.push({
              x: Math.round(CX + Math.cos(ang) * (R - 2)),
              y: Math.round(CY + Math.sin(ang) * (R - 2)),
              age: 0, forks: 2, amp: 5, gas: pickGas(),
            });
            ripples.current.push({
              x: CX + Math.cos(ang) * (R - 1),
              y: CY + Math.sin(ang) * (R - 1),
              age: 0, color: "#cfd8ff",
            });
          }
        }
      }

      // ---- press flashes: arcs through the glass in gas colors ----
      flashes.current = flashes.current.filter((f) => f.age < 0.16);
      for (const f of flashes.current) {
        f.age += dt;
        for (let k = 0; k < f.forks; k++) {
          const spreadA = (k / Math.max(f.forks - 1, 1)) * Math.PI * 2;
          drawPlasmaArc(
            ctx, CX, CY,
            f.x + Math.cos(spreadA) * 3,
            f.y + Math.sin(spreadA) * 3,
            f.gas, t, f.x * 0.13 + k * 1.4, f.amp, 1.2,
          );
        }
      }

      // ---- your fingers: ONE string each + wandering streams from ARCS ----
      if (held) {
        const totalFil = u.reduce((sum, g) => sum + fil[g.id], 0);
        const roamsPer = Math.min(totalFil, 15); // ARC upgrades = more strings
        const per = 1 + roamsPer;
        const want = Math.min(per * pts.length, 64);
        const activeIds = pts.map(([id]) => id);
        const randPid = () => activeIds[Math.floor(Math.random() * activeIds.length)];

        while (holdArcs.current.length < want) {
          const i = holdArcs.current.length;
          holdArcs.current.push(newHoldArc((i % per) === 0 ? "leader" : "roam", randPid()));
        }
        if (holdArcs.current.length > want) holdArcs.current.length = want;

        for (const a of holdArcs.current) {
          a.age += dt;
          a.ang += a.drift * dt;
          if (a.age > a.ttl) Object.assign(a, newHoldArc(a.kind, a.kind === "leader" ? a.pid : randPid()));
          let tx: number;
          let ty: number;
          if (a.kind === "leader") {
            const owner = pointers.current.get(a.pid) ?? pointers.current.get(randPid());
            if (!owner) continue;
            tx = owner.x + Math.cos(a.ang) * a.reach;
            ty = owner.y + Math.sin(a.ang) * a.reach;
          } else {
            let ra = a.ang;
            if (ghostHold) {
              const pull = ghostHold.ang - a.ang;
              ra += Math.atan2(Math.sin(pull), Math.cos(pull)) * 0.12;
            }
            tx = CX + Math.cos(ra) * a.reach;
            ty = CY + Math.sin(ra) * a.reach;
          }
          drawPlasmaArc(ctx, CX, CY, tx, ty, a.gas, t, a.phase, a.kind === "leader" ? 2.2 : 3.4, 1.4);
          // SPLIT upgrade: your one string forks, real-plasma-ball style
          if (a.kind === "leader") {
            const br = Math.min(propsRef.current.splits[a.gas.id] ?? 0, 6);
            if (br > 0) {
              const mx = (CX + tx) / 2;
              const my = (CY + ty) / 2;
              const lead = Math.atan2(ty - CY, tx - CX);
              for (let k = 0; k < br; k++) {
                const side = k % 2 === 0 ? 1 : -1;
                const ba = lead + side * (0.3 + 0.25 * Math.floor(k / 2)) + Math.sin(t * 1.7 + a.phase + k) * 0.12;
                drawPlasmaArc(
                  ctx, mx, my,
                  CX + Math.cos(ba) * (R - 3),
                  CY + Math.sin(ba) * (R - 3),
                  a.gas, t, a.phase + 1 + k, 2.2, 1.2,
                );
              }
            }
          }
          // wandering streams sometimes fork mid-flight
          if (a.kind === "roam" && a.fork) {
            const mx = (CX + tx) / 2;
            const my = (CY + ty) / 2;
            const fa = a.ang + (Math.random() - 0.5) * 0.9;
            drawPlasmaArc(
              ctx, mx, my,
              CX + Math.cos(fa) * (R - 4),
              CY + Math.sin(fa) * (R - 4),
              a.gas, t, a.phase + 2, 1.5, 1.2,
            );
          }
        }

        if (holdNext === Infinity) holdNext = t + HOLD_INTERVAL;
        if (t >= holdNext) {
          holdNext = t + HOLD_INTERVAL;
          crackleRef.current(pts.length);
          for (const [, p] of pts) ripples.current.push({ x: p.x, y: p.y, age: 0, color: pickGas().color });
        }
      } else {
        holdArcs.current.length = 0;
        holdNext = Infinity;
      }

      // ---- electrode ----
      const primary = u[u.length - 1];
      const pulse = 0.75 + Math.sin(t * 2) * 0.25;
      ctx.globalAlpha = held ? 1 : pulse;
      ctx.fillStyle = primary.core;
      ctx.fillRect(CX - 2, CY - 2, 5, 5);
      ctx.fillStyle = primary.glow;
      ctx.fillRect(CX - 3, CY - 1, 1, 3);
      ctx.fillRect(CX + 3, CY - 1, 1, 3);
      ctx.fillRect(CX - 1, CY - 3, 3, 1);
      ctx.fillRect(CX - 1, CY + 3, 3, 1);
      ctx.globalAlpha = 1;

      // helpers on THIS side of the glass: full color
      runHelpers(fingerSeeds, fing, FINGER_ORIENTS, false, false);
      runHelpers(toeSeeds, toe, FOOT_ORIENTS, true, false);

      // ---- your fingers on the glass (one sprite per touch) ----
      for (const [, p] of pts)
        drawSprite(ctx, PLAYER_FINGER, Math.round(p.x) - 4, Math.round(p.y) - 2, SKIN_PALETTE);

      // ---- ripples ----
      ripples.current = ripples.current.filter((r) => r.age < 0.5);
      for (const r of ripples.current) {
        if (r.age < 0) continue;
        r.age += dt;
        const p = r.age / 0.5;
        pixelCircle(ctx, r.x, r.y, 2 + p * 14, r.color, (1 - p) * 0.7);
      }

      // ---- floating numbers (manual crackles only) ----
      texts.current = texts.current.filter((ft) => ft.age < 0.9);
      for (const ft of texts.current) {
        ft.age += dt;
        const p = ft.age / 0.9;
        drawPixelText(ctx, ft.x, ft.y - p * 16, ft.str, u[0].core);
      }

      // ---- hint on a brand-new dark ball ----
      if (crk === 0 && !held && fing === 0 && toe === 0) {
        ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.4;
        drawPixelText(ctx, CX, CY + 20, "PRESS THE BALL", "#ffffff");
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    // safety net: never leave a stuck pointer holding the glass
    const rmPointer = (ev: PointerEvent) => pointers.current.delete(ev.pointerId);
    const clearPointers = () => pointers.current.clear();
    window.addEventListener("pointerup", rmPointer);
    window.addEventListener("pointercancel", rmPointer);
    window.addEventListener("blur", clearPointers);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", rmPointer);
      window.removeEventListener("pointercancel", rmPointer);
      window.removeEventListener("blur", clearPointers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = PX / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  return (
    <canvas
      ref={canvasRef}
      width={PX}
      height={PX}
      style={{
        width: "100%", maxWidth: 300, height: "auto", display: "block",
        imageRendering: "pixelated", touchAction: "none",
      }}
      onPointerDown={(e) => {
        // max 2 player touches — a third finger is ignored
        if (pointers.current.size >= 2 && !pointers.current.has(e.pointerId)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toLocal(e);
        pointers.current.set(e.pointerId, p);
        if (Math.hypot(p.x - CX, p.y - CY) < R * 1.15) {
          if (buzzRef.current) haptic(8);
          crackleRef.current(1);
          texts.current.push({ x: p.x, y: p.y - 8, age: 0, str: `+${fmtShort(neonPowRef.current)}` });
          ripples.current.push({ x: p.x, y: p.y, age: 0, color: "#ffffff" });
        }
      }}
      onPointerMove={(e) => {
        const p = toLocal(e);
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
      }}
      onPointerUp={(e) => pointers.current.delete(e.pointerId)}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
    />
  );
}

// ---------- App: phone-first UI with bottom tab bar ----------
type Tab = "upgrades" | "stats" | "options";
type UpTab = "help" | "gas" | "power";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSave() ?? freshSave());
  const [offlineGain, setOfflineGain] = useState<Partial<GasRecord> | null>(null);
  const [tab, setTab] = useState<Tab>("upgrades");
  const [upTab, setUpTab] = useState<UpTab>("help");
  const [qty, setQty] = useState<number | "max">(1);
  const [scanlines, setScanlines] = useState(() => loadOpts().scan);
  const [buzz, setBuzz] = useState(() => loadOpts().buzz);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const saved = loadSave();
    if (!saved) return;
    const elapsed = Math.min((Date.now() - saved.lastSeen) / 1000, OFFLINE_CAP_S);
    const rates = idleRate(saved);
    const gain: Partial<GasRecord> = {};
    let any = false;
    for (const g of GAS_LIST) {
      const v = rates[g.id] * elapsed;
      if (v > 1) {
        gain[g.id] = v;
        any = true;
      }
    }
    if (elapsed > 60 && any) {
      setState((s) => {
        const plasma = { ...s.plasma };
        const total = { ...s.total };
        for (const [g, v] of Object.entries(gain) as [GasId, number][]) {
          plasma[g] += v;
          total[g] += v;
        }
        return { ...s, plasma, total };
      });
      setOfflineGain(gain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle income = hired fingers & feet pressing around the clock
  useEffect(() => {
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setState((s) => {
        const rates = idleRate(s);
        if (rates.neon + rates.argon + rates.xenon <= 0) return s;
        const plasma = { ...s.plasma };
        const total = { ...s.total };
        for (const g of s.unlocked) {
          plasma[g] += rates[g] * dt;
          total[g] += rates[g] * dt;
        }
        return { ...s, plasma, total };
      });
    }, 200);
    const saveIv = setInterval(() => persist(stateRef.current), 2000);
    return () => {
      clearInterval(iv);
      clearInterval(saveIv);
      persist(stateRef.current);
    };
  }, []);

  // options persist between sessions
  useEffect(() => {
    try {
      window.localStorage.setItem(OPTS_KEY, JSON.stringify({ scan: scanlines, buzz }));
    } catch {
      /* in-session only */
    }
  }, [scanlines, buzz]);

  const unlockedGases = state.unlocked.map(gasById);
  const rates = idleRate(state);
  const neonGas = gasById("neon");
  const neonPow = cracklePower(neonGas, state);
  const accent = unlockedGases[unlockedGases.length - 1].color;

  const crackle = (fingerCount: number) =>
    setState((s) => {
      const plasma = { ...s.plasma };
      const total = { ...s.total };
      for (const g of GAS_LIST) {
        if (!s.unlocked.includes(g.id)) continue;
        const p = cracklePower(g, s) * fingerCount;
        plasma[g.id] += p;
        total[g.id] += p;
      }
      return { ...s, plasma, total, crackles: s.crackles + fingerCount };
    });

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 1500);
  };
  const buzzNow = (ms: number) => {
    if (buzz) haptic(ms);
  };

  const buy = (kind: BuyKind, gid?: GasId) => {
    const want = kind === "gas" ? 1 : qty === "max" ? 1000 : qty;
    const pre = bulkCost(stateRef.current, kind, gid, want);
    setState((s) => {
      const { cost, count } = bulkCost(s, kind, gid, want);
      if (count <= 0) return s;
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
        const nx = nextGas(s.unlocked);
        if (!nx) return s;
        next.unlocked = [...s.unlocked, nx.id];
      }
      return next;
    });
    if (pre.count > 0) {
      buzzNow(12);
      showToast(
        kind === "gas"
          ? `${nextGas(stateRef.current.unlocked)?.name ?? "GAS"} UNLOCKED`
          : buyMsg(kind, gid, pre.count),
      );
    }
  };

  const bulkWant = qty === "max" ? 1000 : qty;
  const fingerBuy = bulkCost(state, "finger", undefined, bulkWant);
  const toeBuy = bulkCost(state, "toe", undefined, bulkWant);
  const ghostBuy = bulkCost(state, "ghost", undefined, bulkWant);
  const argonUnlocked = state.unlocked.includes("argon");
  const xenonUnlocked = state.unlocked.includes("xenon");
  const nxGas = nextGas(state.unlocked);

  // afford dots for sub-tabs (shown only on tabs you're NOT looking at)
  const powerKinds: BuyKind[] = ["filament", "voltage", "split"];
  const subDots: Record<UpTab, boolean> = {
    help:
      fingerBuy.count > 0 || (argonUnlocked && toeBuy.count > 0) ||
      (xenonUnlocked && ghostBuy.count > 0),
    gas: !!nxGas && canAfford(state, nxGas.unlockCost),
    power: unlockedGases.some((g) => powerKinds.some((k) => bulkCost(state, k, g.id, 1).count > 0)),
  };

  // how close you are to affording a locked upgrade, 0..1
  const unlockPct = (cost: Partial<GasRecord>) => {
    let pct = 1;
    for (const [g, amt] of Object.entries(cost) as [GasId, number][])
      pct = Math.min(pct, state.plasma[g] / amt);
    return Math.max(0, Math.min(1, pct));
  };
  const UnlockBar = ({ cost, color }: { cost: Partial<GasRecord>; color: string }) => {
    const pct = Math.round(unlockPct(cost) * 100);
    return (
      <div className="mb-1 flex items-center gap-1 px-2 pt-0.5">
        <div className="h-1.5 flex-1 border border-white/15 bg-[#0b0618]">
          <div className="h-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="shrink-0 text-[8px] tabular-nums text-white/40">{pct}%</span>
      </div>
    );
  };

  const CostChips = ({ cost, ok }: { cost: Partial<GasRecord>; ok: boolean }) => (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {(Object.entries(cost) as [GasId, number][]).map(([g, amt]) => (
        <span
          key={g}
          className="border px-1 py-0.5 text-[9px] tabular-nums"
          style={{
            borderColor: ok ? gasById(g).color : "#ffffff20",
            color: ok ? gasById(g).color : "#ffffff40",
          }}
        >
          {fmt(amt)}
        </span>
      ))}
    </div>
  );

  // dense one-line upgrade row
  const upRow = (
    name: string, sub: string,
    cost: Partial<GasRecord>,
    icon: React.ReactNode,
    onBuy: () => void, disabled: boolean, color?: string,
    nextCost?: Partial<GasRecord>,
  ) => (
    <button
      onClick={onBuy}
      disabled={disabled}
      className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-transform active:translate-y-[1px] ${
        disabled ? "border-white/10 bg-[#100a22] opacity-50" : "border-white/20 bg-[#16102c] hover:border-white/40"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-[#0b0618]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold leading-none" style={color ? { color } : undefined}>{name}</div>
        <div className="mt-0.5 truncate text-[8px] leading-tight text-white/45">{sub}</div>
      </div>
      <CostChips cost={disabled && nextCost ? nextCost : cost} ok={!disabled} />
    </button>
  );

  // non-interactive info row
  const infoRow = (name: string, sub: string, icon: React.ReactNode, color?: string) => (
    <div className="flex w-full items-center gap-2 border border-white/10 bg-[#0d0820] px-2 py-1.5 text-left">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-[#0b0618]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold leading-none" style={color ? { color } : undefined}>{name}</div>
        <div className="mt-0.5 truncate text-[8px] leading-tight text-white/40">{sub}</div>
      </div>
    </div>
  );

  const playSec = Math.floor((Date.now() - state.created) / 1000);

  return (
    <div className="flex min-h-screen justify-center bg-[#05030f] font-mono text-white select-none">
      <div className="relative flex min-h-screen w-full max-w-[400px] flex-col bg-[#08041a]">
        {scanlines && (
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
            }}
          />
        )}

        {/* status bar + currency chips */}
        <header className="border-b-2 border-white/15 bg-[#120a2e] px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] tracking-widest text-white/50">PLASMA BALL</span>
            <span className="text-[9px] tracking-widest text-white/50">
              {state.fingers} FING · {state.toes} FEET · {state.ghosts} GHO
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {unlockedGases.map((g) => (
              <div
                key={g.id}
                className="min-w-0 flex-1 border px-1.5 py-1"
                style={{ borderColor: `${g.color}44`, background: "#0d0820" }}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[8px] tracking-widest" style={{ color: g.color }}>{g.name}</span>
                  <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color: g.color }}>
                    {fmt(state.plasma[g.id])}
                  </span>
                </div>
                <div className="mt-0.5 text-[8px] tabular-nums text-white/40">
                  {fmt(cracklePower(g, state))}/TAP · {fmt(rates[g.id])}/S
                </div>
              </div>
            ))}
          </div>
        </header>

        {offlineGain !== null && (
          <button
            className="border-b-2 border-white/15 bg-[#1b1233] px-3 py-2 text-[10px] active:bg-[#241840]"
            onClick={() => setOfflineGain(null)}
          >
            THE HELP KEPT PRESSING WHILE YOU WERE AWAY:{" "}
            {(Object.entries(offlineGain) as [GasId, number][])
              .map(([g, v]) => `${fmt(v)} ${gasById(g).name}`)
              .join(" · ")}{" "}
            — TAP TO COLLECT
          </button>
        )}

        {/* the ball */}
        <div className="flex min-h-[20vh] flex-1 flex-col items-center justify-center px-4">
          <PlasmaBall
            filaments={state.filaments}
            splits={state.splits}
            unlocked={unlockedGases}
            fingers={state.fingers}
            toes={state.toes}
            crackles={state.crackles}
            neonPow={neonPow}
            buzzOn={buzz}
            ghosts={state.ghosts}
            onCrackle={crackle}
          />
        </div>

        {/* tab bar */}
        <nav className="grid grid-cols-3 border-t-2 border-white/15 bg-[#120a2e]">
          {([
            ["upgrades", "UPGRADES"],
            ["stats", "STATS"],
            ["options", "OPTIONS"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-2 text-[10px] tracking-widest active:translate-y-[1px] ${
                tab === id ? "bg-[#1b1233] text-white" : "text-white/40"
              }`}
              style={tab === id ? { borderBottom: `3px solid ${accent}` } : { borderBottom: "3px solid transparent" }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* panel — fixed height so switching tabs never moves the layout */}
        <div className="relative h-[42vh] shrink-0 overflow-y-auto bg-[#0d0820] p-2">
          {toast && (
            <div
              className="pointer-events-none absolute inset-x-2 bottom-2 z-20 border-2 px-2 py-1.5 text-center text-[9px] tracking-widest"
              style={{ borderColor: accent, color: accent, background: "#1b1233" }}
            >
              {toast}
            </div>
          )}
          {tab === "upgrades" && (
            <div className="flex flex-col gap-1.5">
              {/* sticky sub-tab + BUY bar */}
              <div className="sticky top-0 z-10 -mx-2 mb-1 bg-[#0d0820] px-2 pt-0.5">
                <div className="grid grid-cols-3 border-2 border-white/15">
                  {([
                    ["help", "HELP"],
                    ["gas", "GAS"],
                    ["power", "POWER"],
                  ] as [UpTab, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setUpTab(id)}
                      className={`py-1 text-[9px] tracking-widest active:translate-y-[1px] ${
                        upTab === id ? "bg-[#1b1233] text-white" : "text-white/40"
                      }`}
                      style={upTab === id ? { borderBottom: `2px solid ${accent}` } : { borderBottom: "2px solid transparent" }}
                    >
                      {label}
                      {upTab !== id && subDots[id] && (
                        <span className="ml-1 inline-block h-1 w-1 align-middle" style={{ background: accent }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* buy quantity selector */}
                {upTab !== "gas" && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="shrink-0 text-[8px] tracking-widest text-white/40">BUY</span>
                    {([1, 5, 10, 100, "max"] as (number | "max")[]).map((q) => (
                      <button
                        key={String(q)}
                        onClick={() => setQty(q)}
                        className={`flex-1 border py-1 text-[9px] tabular-nums active:translate-y-[1px] ${
                          qty === q ? "border-white/60 bg-[#1b1233] text-white" : "border-white/15 text-white/40"
                        }`}
                      >
                        {q === "max" ? "MAX" : `×${q}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {upTab === "help" && (
                <>
                  {upRow(
                    "FINGER",
                    `PRESSES ALL GASES · OWN ${state.fingers}` +
                      (fingerBuy.count > 1 ? ` · +${fingerBuy.count}` : ""),
                    fingerBuy.cost,
                    <PixelIcon sprite={FINGER_SPRITE} palette={SKIN_PALETTE} px={2} />,
                    () => buy("finger"), fingerBuy.count === 0,
                    undefined, peekCost(state, "finger"),
                  )}
                  {argonUnlocked
                    ? upRow(
                        "BIG TOE",
                        `A WHOLE FOOT · PRESSES 8X HARDER · OWN ${state.toes}` +
                          (toeBuy.count > 1 ? ` · +${toeBuy.count}` : ""),
                        toeBuy.cost,
                        <PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />,
                        () => buy("toe"), toeBuy.count === 0, SKIN,
                        peekCost(state, "toe"),
                      )
                    : (
                      <React.Fragment>
                        {upRow(
                          "BIG TOE", "UNLOCKS WITH ARGON GAS",
                          { argon: 15 },
                          <PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />,
                          () => {}, true,
                        )}
                        <UnlockBar cost={{ argon: 15 }} color={gasById("argon").color} />
                      </React.Fragment>
                    )}
                  {xenonUnlocked
                    ? upRow(
                        "GHOST HAND",
                        `THE PLASMA PRESSES BACK · 20X A FINGER · OWN ${state.ghosts}` +
                          (ghostBuy.count > 1 ? ` · +${ghostBuy.count}` : ""),
                        ghostBuy.cost,
                        <PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />,
                        () => buy("ghost"), ghostBuy.count === 0, "#b7b2ff",
                        peekCost(state, "ghost"),
                      )
                    : (
                      <React.Fragment>
                        {upRow(
                          "GHOST HAND", "UNLOCKS WITH XENON GAS",
                          { xenon: 80 },
                          <PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />,
                          () => {}, true,
                        )}
                        <UnlockBar cost={{ xenon: 80 }} color={gasById("xenon").color} />
                      </React.Fragment>
                    )}
                </>
              )}

              {upTab === "gas" && (
                <>
                  {unlockedGases.map((g) =>
                    infoRow(
                      `${g.name} GAS`, `IN THE GLASS · ${fmt(g.baseRate)} BASE/TAP · ${fmt(cracklePower(g, state))} NOW`,
                      <PixelIcon sprite={GAS_ICON} color={g.color} px={3} />,
                      g.color,
                    ),
                  )}
                  {nxGas
                    ? (
                      <React.Fragment>
                        {upRow(
                          `${nxGas.name} GAS`, `FILL THE BALL · NEW CURRENCY · ${fmt(nxGas.baseRate)}/TAP BASE`,
                          nxGas.unlockCost,
                          <PixelIcon sprite={GAS_ICON} color={nxGas.color} px={3} />,
                          () => buy("gas"), !canAfford(state, nxGas.unlockCost),
                          nxGas.color,
                        )}
                        <UnlockBar cost={nxGas.unlockCost} color={nxGas.color} />
                      </React.Fragment>
                    )
                    : infoRow(
                        "MORE GAS", "A FUTURE BUILD MIGHT HOLD HEAVIER GASES",
                        <PixelIcon sprite={GAS_ICON} color="#ffffff40" px={3} />,
                      )}
                </>
              )}

              {upTab === "power" && (
                <>
                  {unlockedGases.map((g) => {
                    const fil = state.filaments[g.id];
                    const nextPow = cracklePower(g, { ...state, filaments: { ...state.filaments, [g.id]: fil + 1 } });
                    const filBuy = bulkCost(state, "filament", g.id, bulkWant);
                    const steps = state.voltage[g.id];
                    const voltBuy = bulkCost(state, "voltage", g.id, bulkWant);
                    const spl = state.splits[g.id];
                    const splitBuy = bulkCost(state, "split", g.id, bulkWant);
                    return (
                      <React.Fragment key={g.id}>
                        <div className="mt-1 mb-0.5 px-0.5 text-[9px] font-bold tracking-widest" style={{ color: g.color }}>
                          {g.name}
                        </div>
                        {upRow(
                          `${g.name} ARC`,
                          `+1 STRING · ${fmt(cracklePower(g, state))} → ${fmt(nextPow)}/TAP · ${fil}/${g.cap}` +
                            (filBuy.count > 1 ? ` · +${filBuy.count}` : ""),
                          filBuy.cost,
                          <PixelIcon sprite={FIL_ICON} color={g.color} px={3} />,
                          () => buy("filament", g.id),
                          filBuy.count === 0,
                          g.color,
                          peekCost(state, "filament", g.id),
                        )}
                        {upRow(
                          `${g.name} VOLTS`,
                          `+0.0001V · NOW ${fmtVolts(steps)} · X${voltMult(steps).toFixed(4)} OUTPUT` +
                            (voltBuy.count > 1 ? ` · +${voltBuy.count} STEPS` : ""),
                          voltBuy.cost,
                          <PixelIcon sprite={VOLT_ICON} color={g.color} px={3} />,
                          () => buy("voltage", g.id),
                          voltBuy.count === 0,
                          g.color,
                          peekCost(state, "voltage", g.id),
                        )}
                        {upRow(
                          `${g.name} SPLIT`,
                          `+1 BRANCH · EACH 0.75X · NOW X${splitMult(spl).toFixed(2)} · ${spl}/${SPLIT_CAP}` +
                            (splitBuy.count > 1 ? ` · +${splitBuy.count}` : ""),
                          splitBuy.cost,
                          <PixelIcon sprite={SPLIT_ICON} color={g.color} px={3} />,
                          () => buy("split", g.id),
                          splitBuy.count === 0,
                          g.color,
                          peekCost(state, "split", g.id),
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="flex flex-col gap-1 text-[11px]">
              {[
                ["TOTAL CRACKLES", String(state.crackles)],
                ["FINGERS HIRED", String(state.fingers)],
                ["FEET HIRED", String(state.toes)],
                ["GHOST HANDS", String(state.ghosts)],
                ["TIME PLAYED", `${Math.floor(playSec / 3600)}H ${Math.floor((playSec % 3600) / 60)}M`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/10 px-1 py-1.5">
                  <span className="text-white/50">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              ))}
              {unlockedGases.map((g) => (
                <React.Fragment key={g.id}>
                  <div className="mt-1 px-1 text-[10px] font-bold" style={{ color: g.color }}>
                    {g.name}
                  </div>
                  {[
                    ["LIFETIME", fmt(state.total[g.id])],
                    ["ARCS", `${state.filaments[g.id]}/${g.cap}`],
                    ["SPLITS", `${state.splits[g.id]} BRANCHES · X${splitMult(state.splits[g.id]).toFixed(2)}`],
                    ["VOLTS", fmtVolts(state.voltage[g.id])],
                    ["VOLT STEPS", String(state.voltage[g.id])],
                    ["POWER/TAP", fmt(cracklePower(g, state))],
                    ["HELP RATE", fmt(rates[g.id]) + "/S"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-white/10 px-1 py-1.5">
                      <span className="text-white/50">{k}</span>
                      <span className="tabular-nums">{v}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}

          {tab === "options" && (
            <div className="flex flex-col gap-2 text-[11px]">
              <button
                onClick={() => setScanlines((v) => !v)}
                className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] p-2 active:translate-y-[1px]"
              >
                <span>CRT SCANLINES</span>
                <span style={{ color: scanlines ? "#61e06b" : "#ffffff40" }}>
                  {scanlines ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => setBuzz((v) => !v)}
                className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] p-2 active:translate-y-[1px]"
              >
                <span>HAPTIC BUZZ</span>
                <span style={{ color: buzz ? "#61e06b" : "#ffffff40" }}>
                  {buzz ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => {
                  if (confirmReset) {
                    setState(freshSave());
                    setConfirmReset(false);
                  } else setConfirmReset(true);
                }}
                className="border-2 p-2 active:translate-y-[1px]"
                style={{
                  borderColor: confirmReset ? "#ff5ec8" : "#ffffff40",
                  color: confirmReset ? "#ff5ec8" : "#ffffff80",
                  background: confirmReset ? "#2a1233" : "#120c26",
                }}
              >
                {confirmReset ? "TAP AGAIN TO CONFIRM RESET" : "RESET SAVE"}
              </button>
              <p className="px-1 text-[9px] leading-relaxed text-white/30">
                V11.1 · STEADY HANDS — MAX 2 PLAYER TOUCHES (NO MORE STUCK
                FINGERS), FINGERS, TOES AND GHOST HANDS NOW FACE THE BALL
                IN 8 DIRECTIONS, AND EVERY UPGRADE ALWAYS SHOWS ITS NEXT
                PRICE, AFFORDABLE OR NOT.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
