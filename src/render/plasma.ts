/**
 * The plasma itself: arc rendering and the glass circle, plus the
 * effect types (ripples, flashes, hold arcs, wanderers) that the
 * render loop animates.
 */
import type { Gas } from "../game/types";

// Coherent, seeded noise gives each filament a different irregular shape.
// Stable samples prevent the per-pixel television-static effect of Math.random().
const frac = (n: number) => n - Math.floor(n);
const hash = (n: number) => frac(Math.sin(n * 127.1 + 78.233) * 43758.5453);
const noise = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);
  return (hash(i + seed * 19.19) * (1 - smooth) + hash(i + 1 + seed * 19.19) * smooth) * 2 - 1;
};

/** Organic sideways movement, pinned to both electrodes/endpoints. */
export function plasmaDisplacement(p: number, t: number, phase: number, amp: number, jit = 0): number {
  if (p <= 0 || p >= 1) return 0;
  const taper = Math.pow(Math.sin(p * Math.PI), 0.65);
  const seed = phase * 1.93 + 1.17;
  const broad = noise(p * 5.7 - t * 0.48, seed);
  const fine = noise(p * 17.1 + t * 1.16, seed + 4.3);
  const spikes = noise(p * 33.7 - t * 2.05, seed + 9.7);
  return taper * (amp * (broad * 0.93 + fine * 0.39 + spikes * 0.16) +
    jit * Math.sin(p * 36 + t * 8 + phase) * 0.4);
}

// ---------- The plasma arc ----------
export function drawPlasmaArc(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  gas: Gas,
  t: number,
  phase: number,
  amp: number,
  jit = 0,
  strength = 1,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const steps = Math.max(4, Math.ceil(len));
  const nx = -dy / len;
  const ny = dx / len;
  const flick = Math.max(0.45, 0.77 + 0.18 * Math.sin(t * 4.1 + phase * 2.7) +
    noise(t * 3.2, phase + 2.3) * 0.15);
  const point = (p: number) => {
    const d = plasmaDisplacement(p, t, phase, amp, jit);
    return {
      x: Math.round(x1 + dx * p + nx * d),
      y: Math.round(y1 + dy * p + ny * d),
    };
  };
  ctx.save();

  // Three layers: soft colored glow, magenta/blue body, thin white-hot core.
  ctx.globalAlpha = 0.18 * flick * strength;
  ctx.fillStyle = gas.glow;
  for (let i = 0; i <= steps; i += 2) {
    const { x, y } = point(i / steps);
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  ctx.globalAlpha = 0.8 * flick * strength;
  ctx.fillStyle = gas.color;
  for (let i = 0; i <= steps; i++) {
    const { x, y } = point(i / steps);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 0.92 * flick * strength;
  ctx.fillStyle = gas.core;
  for (let i = 0; i <= steps; i += 2) {
    const { x, y } = point(i / steps);
    ctx.fillRect(x, y, 1, 1);
  }

  // Short-lived, uneven offshoots from the actual curved trunk.
  // Cosmetic only: purchased SPLIT upgrades still create long full branches.
  if (len > 17) {
    const branches = 1 + (hash(phase * 13.7 + 5.6) > 0.76 ? 1 : 0);
    for (let b = 0; b < branches; b++) {
      const startP = 0.22 + 0.47 * hash(phase * 3.71 + b * 21.11 + 1);
      const origin = point(startP);
      const side = hash(phase * 7.17 + b * 31.1) < 0.5 ? -1 : 1;
      const branchLength = Math.min(11, len * (0.13 + 0.05 * hash(phase * 11 + b)));
      const direction = Math.atan2(dy, dx) + side * (0.35 + 0.47 * hash(phase * 7 + b * 13));
      const bx = Math.cos(direction) * branchLength;
      const by = Math.sin(direction) * branchLength;
      ctx.fillStyle = gas.color;
      ctx.globalAlpha = 0.48 * flick * strength;
      const count = Math.max(2, Math.ceil(branchLength));
      for (let i = 0; i <= count; i++) {
        const p = i / count;
        const offset = Math.sin(p * Math.PI) * noise(p * 5 + t * 1.8, phase + b * 9) * 1.4;
        ctx.fillRect(Math.round(origin.x + bx * p - Math.sin(direction) * offset),
          Math.round(origin.y + by * p + Math.cos(direction) * offset), 1, 1);
      }
    }
  }

  // A few moving brighter knots, instead of uniformly bright, evenly spaced strands.
  const hot = point(0.24 + 0.6 * hash(phase * 5.23 + Math.floor(t * 2) * 3.11));
  ctx.globalAlpha = 0.85 * flick * strength;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(hot.x, hot.y, 1, 1);
  ctx.fillRect(Math.round(x2), Math.round(y2), 1, 1);
  ctx.restore();
}

export function pixelCircle(
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
export type Ripple = { x: number; y: number; age: number; color: string };
export type FloatText = { x: number; y: number; age: number; str: string };
export type Flash = { x: number; y: number; age: number; forks: number; amp: number; gas: Gas };
export type HoldArc = {
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
export type Wanderer = {
  base: number;
  drift: number;
  wob: number;
  phase: number;
  timer: number;
  back: boolean; // presses from behind the glass
};
