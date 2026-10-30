/**
 * The plasma itself: arc rendering and the glass circle, plus the
 * effect types (ripples, flashes, hold arcs, wanderers) that the
 * render loop animates.
 */
import { CX, CY, R } from "./geometry";
import type { Gas } from "../game/types";

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
