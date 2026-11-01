/**
 * The plasma ball: a 150px canvas driven by a requestAnimationFrame loop
 * that draws glass, arcs, hired help, ghost hands and touch feedback.
 * Handles multi-touch input (max two player fingers) and forwards crackles.
 */
import React, { useEffect, useRef } from "react";
import { HOLD_INTERVAL, PRESS_INTERVAL } from "../game/config";
import { fmtShort } from "../utils/format";
import { haptic } from "../utils/haptic";
import { PX, CX, CY, R } from "../render/geometry";
import { SKIN_PALETTE } from "../render/palette";
import {
  PLAYER_FINGER,
  FINGER_ORIENTS,
  FOOT_ORIENTS,
  drawSprite,
  drawOriented,
  drawGhost,
  drawPixelText,
} from "../render/sprites";
import { drawPlasmaArc, pixelCircle } from "../render/plasma";
import { visibleHelperCounts, helperOrbitRadius, helperEffectChance } from "../render/limits";
import { advanceStickman, createStickman, type StickmanMotion } from "../render/stickmen";
import type { Ripple, FloatText, Flash, HoldArc, Wanderer } from "../render/plasma";
import type { Gas, GasRecord } from "../game/types";

export default function PlasmaBall({
  filaments, splits, unlocked, fingers, toes, ghosts, stickmen, crackles, neonPow, onCrackle, buzzOn,
}: {
  filaments: GasRecord;
  splits: GasRecord;
  unlocked: Gas[];
  fingers: number;
  toes: number;
  ghosts: number;
  stickmen: number;
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
  const glassCracks = useRef<{ x: number; y: number; age: number; ttl: number; seed: number }[]>([]);
  const holdArcs = useRef<HoldArc[]>([]);
  const fingerSeeds = useRef<Wanderer[]>([]);
  const toeSeeds = useRef<Wanderer[]>([]);
  const stickAgents = useRef<StickmanMotion[]>([]);
  const propsRef = useRef({ filaments, splits, unlocked, fingers, toes, ghosts, stickmen, crackles });
  propsRef.current = { filaments, splits, unlocked, fingers, toes, ghosts, stickmen, crackles };
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
      // Stepped pedestal, visibly wider than the glass neck.
      b.fillStyle = "#0d0922";
      b.fillRect(CX - 12, CY + R + 1, 24, 3);
      b.fillRect(CX - 16, CY + R + 4, 32, 6);
      b.fillRect(CX - 22, CY + R + 10, 44, 4);
      b.fillStyle = "#45366e";
      b.fillRect(CX - 10, CY + R + 1, 20, 2);
      b.fillRect(CX - 14, CY + R + 5, 28, 2);
      b.fillStyle = "#6d57a0";
      b.fillRect(CX - 20, CY + R + 10, 40, 2);
      b.fillStyle = "#21163d";
      b.fillRect(CX - 19, CY + R + 13, 38, 1);
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
            // Deep navy glass lets thin white-blue arcs and pink flashes stand out.
            b.fillStyle = band < 0.25
              ? lit ? "#29133d" : "#1e102f"
              : band < 0.8
              ? lit ? "#180b30" : "#100922"
              : lit ? "#160a2b" : "#0a061c";
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
          b.fillStyle = bright ? (lit ? "#d0a5e7" : "#997fb9") : lit ? "#aa4e93" : "#694070";
          b.fillRect(px, py, 1, 1);
          // Sparse magenta hotspots echo the uneven ionized rim of a real globe.
          if (i % 9 === 0) {
            b.fillStyle = lit ? "#f875b7" : "#9a527f";
            b.fillRect(Math.round(CX + Math.cos(a) * (R - 2)),
              Math.round(CY + Math.sin(a) * (R - 2)), 1, 1);
          }
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

    const drawStickman = (x: number, y: number, attack: boolean, stride: boolean, facing: number) => {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(facing, 1);
      // Walking legs, alternating foot positions, separate from the attack pose.
      ctx.fillStyle = "#20152e";
      ctx.fillRect(-2, -9, 4, 4);
      ctx.fillRect(-1, -5, 2, 4);
      ctx.fillRect(stride ? -3 : -2, -1, 2, 2);
      ctx.fillRect(stride ? 1 : 0, -1, 2, 2);
      ctx.fillStyle = "#fff2c7";
      ctx.fillRect(0, -8, 1, 1);
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(-2, -5, 3, 1);
      ctx.fillStyle = "#20152e";
      ctx.fillRect(-4, attack ? -8 : -4, 3, 1);
      ctx.fillRect(1, attack ? -8 : -4, 4, 1);
      if (attack) {
        ctx.fillStyle = "#fff1c7";
        ctx.fillRect(5, -8, 2, 2);
      }
      ctx.restore();
    };
    const drawGlassCrack = (crack: { x: number; y: number; age: number; ttl: number; seed: number }) => {
      ctx.globalAlpha = Math.max(0, 1 - crack.age / crack.ttl) * 0.9;
      ctx.fillStyle = "#fff1c7";
      for (let i = 0; i < 3; i++) {
        const dir = -Math.PI / 2 + (i - 1) * 0.55 + Math.sin(crack.seed + i) * 0.08;
        let px = crack.x, py = crack.y;
        for (let step = 0; step < 4; step++) {
          px += Math.cos(dir + step * 0.16) * 2;
          py += Math.sin(dir + step * 0.11) * 2;
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
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
      // The browser may deliver a stale frame while transitioning to background.
      // Never draw or advance held-touch effects while the page is hidden.
      if (document.hidden) return;
      const t = (now - start) / 1000;
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
      last = now;

      const { filaments: fil, fingers: fing, toes: toe, ghosts: ghs, stickmen: stm, unlocked: u, crackles: crk } = propsRef.current;
      const visible = visibleHelperCounts({ fingers: fing, toes: toe, ghosts: ghs, stickmen: stm });
      const visibleFingers = visible.fingers;
      const visibleToes = visible.toes;
      const visibleGhosts = visible.ghosts;
      const visibleStickmen = visible.stickmen;
      const sig = u.map((g) => g.id).join(",");
      if (cache.sig !== sig) buildBg(sig);

      // active = fingers actually on the glass
      const pts = [...pointers.current.entries()].filter(
        ([, p]) => Math.hypot(p.x - CX, p.y - CY) < R * 1.15,
      );
      const held = pts.length > 0;
      const activeFlash = flashes.current.length > 0;

      // Every purchased helper is drawn. Only costly visual effects are sampled.
      const effectChance = helperEffectChance({ fingers: fing, toes: toe, ghosts: ghs, stickmen: stm });
      // ---- moving helpers spread across several concentric rings ----
      const runHelpers = (
        seeds: { current: Wanderer[] }, count: number, orients: string[][],
        kind: "fingers" | "toes",
      ) => {
        while (seeds.current.length < count) seeds.current.push(newWanderer(seeds.current.length, t));
        if (seeds.current.length > count) seeds.current.length = count;
        for (let i = 0; i < seeds.current.length; i++) {
          const w = seeds.current[i];
          const angle = w.base + w.drift * t + Math.sin(t * w.wob + w.phase) * (kind === "toes" ? 0.2 : 0.3);
          const radius = helperOrbitRadius(kind, i, R);
          const tx = Math.round(CX + Math.cos(angle) * radius);
          const ty = Math.round(CY + Math.sin(angle) * radius);
          if (t >= w.timer) {
            w.timer = t + PRESS_INTERVAL;
            // Each helper still animates. Only large flash/ripple effects are
            // sampled so owning thousands doesn't allocate thousands of arcs.
            if (Math.random() < effectChance) {
              flashes.current.push(newFlash(tx, ty, kind === "toes"));
              if (Math.random() < 0.2) flashes.current.push(strayFlash());
              ripples.current.push({ x: tx, y: ty, age: 0, color: pickGas().color });
            }
          }
          const since = t - (w.timer - PRESS_INTERVAL);
          drawOriented(ctx, orients, angle,
            Math.max(0, 1 - since / (kind === "toes" ? 0.35 : 0.3)),
            SKIN_PALETTE, radius,
          );
        }
      };

      ctx.clearRect(0, 0, PX, PX);
      ctx.drawImage(far, 0, 0);

      // Draw the glass first: helpers aren't hidden behind an opaque layer.
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

      // Low-energy ambient filaments keep an untouched globe quietly alive.
      // They are visual only and never grant passive income.
      if (!held) {
        const ambient = 2 + Math.min(2, u.length);
        for (let i = 0; i < ambient; i++) {
          const ang = i * 2.399963 + t * 0.08 +
            Math.sin(t * 0.51 + i * 1.41) * 0.35;
          const reach = R * (0.6 + 0.18 * Math.sin(t * 0.73 + i * 1.27));
          drawPlasmaArc(ctx, CX, CY, CX + Math.cos(ang) * reach,
            CY + Math.sin(ang) * reach, u[i % u.length], t, i * 4.37, 2.4, 0.5, 0.35);
        }
      }

      // ---- ghost hands press from INSIDE the glass ----
      let ghostHold: { ang: number } | null = null;
      const gho = visibleGhosts;
      while (ghostOffs.length < gho) ghostOffs.push(Math.random() * GHOST_T);
      if (ghostOffs.length > gho) ghostOffs.length = gho;
      for (let gi = 0; gi < gho; gi++) {
        const { st, p } = ghostState(gi, t);
        // Resting ghost hands remain faintly visible, so none disappear from the workforce.
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
        } else if (st === 2) {
          reach = R - 7 + p * 14;
          alpha = Math.max(0.24, 0.75 * (1 - p));
        } else {
          reach = helperOrbitRadius("ghosts", gi, R);
          alpha = 0.26;
        }
        // Multiple ghost rings make large armies identifiable inside the ball.
        drawGhost(ctx, ang, Math.min(reach, helperOrbitRadius("ghosts", gi, R)), alpha, t + gi);
        if (st === 1 && Math.random() < effectChance) {
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

      // Prevent visual effect arrays from growing without bound under automation.
      if (flashes.current.length > 96) flashes.current.splice(0, flashes.current.length - 96);
      if (ripples.current.length > 96) ripples.current.splice(0, ripples.current.length - 96);

      // ---- electrode ----
      const primary = u[u.length - 1];
      const pulse = 0.75 + Math.sin(t * 2) * 0.25;
      // Layer the central electrode: pink halo, colored ion shell, hot core.
      ctx.globalAlpha = (held ? 0.85 : 0.55) * pulse;
      ctx.fillStyle = "#e548a8";
      ctx.fillRect(CX - 5, CY - 4, 11, 9);
      ctx.globalAlpha = held ? 0.95 : 0.77;
      ctx.fillStyle = primary.glow;
      ctx.fillRect(CX - 3, CY - 3, 7, 7);
      ctx.fillStyle = primary.core;
      ctx.fillRect(CX - 2, CY - 2, 5, 5);
      ctx.fillStyle = "#fff2fd";
      ctx.fillRect(CX - 1, CY - 1, 2, 2);
      ctx.globalAlpha = 1;

      // Draw every Finger and Toe in full color, including the back-facing ones.
      runHelpers(fingerSeeds, visibleFingers, FINGER_ORIENTS, "fingers");
      runHelpers(toeSeeds, visibleToes, FOOT_ORIENTS, "toes");

      // Independent roam/jump phases: small walkers circle the whole ball and
      // leap in to hit the glass. Effects are cosmetic; all owned helpers earn.
      while (stickAgents.current.length < visibleStickmen)
        stickAgents.current.push(createStickman(stickAgents.current.length, t));
      if (stickAgents.current.length > visibleStickmen)
        stickAgents.current.length = visibleStickmen;
      for (let i = 0; i < visibleStickmen; i++) {
        const agent = stickAgents.current[i];
        const pose = advanceStickman(agent, t, dt);
        const radius = helperOrbitRadius("stickmen", i, R) + 2 - pose.jump * 12;
        const x = CX + Math.cos(pose.angle) * radius;
        const y = CY + Math.sin(pose.angle) * radius - pose.jump * 3;
        if (pose.strike && Math.random() < effectChance) {
          const impactX = CX + Math.cos(pose.angle) * (R - 3);
          const impactY = CY + Math.sin(pose.angle) * (R - 3);
          glassCracks.current.push({ x: impactX, y: impactY, age: 0, ttl: 0.55, seed: t + i * 1.3 });
          flashes.current.push({ x: impactX, y: impactY, age: 0, forks: 2, amp: 4.5, gas: pickGas() });
          ripples.current.push({ x: impactX, y: impactY, age: 0, color: "#ffd166" });
        }
        drawStickman(x, y, pose.attack, pose.stride, Math.cos(pose.angle) > 0 ? -1 : 1);
      }
      if (glassCracks.current.length > 16)
        glassCracks.current.splice(0, glassCracks.current.length - 16);
      glassCracks.current = glassCracks.current.filter((crack) => crack.age < crack.ttl);
      for (const crack of glassCracks.current) {
        crack.age += dt;
        drawGlassCrack(crack);
      }

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
      if (crk === 0 && !held && fing === 0 && toe === 0 && ghs === 0 && stm === 0) {
        ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.4;
        drawPixelText(ctx, CX, CY + 20, "PRESS THE BALL", "#ffffff");
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    // Never retain a held finger across a tab switch, app suspension, or focus loss.
    const clearPointers = () => {
      pointers.current.clear();
      holdArcs.current.length = 0;
      holdNext = Infinity;
    };
    const rmPointer = (ev: PointerEvent) => pointers.current.delete(ev.pointerId);
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearPointers();
        cancelAnimationFrame(raf);
      } else {
        // Do not simulate background time as a giant animation frame.
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    };

    if (!document.hidden) raf = requestAnimationFrame(draw);
    window.addEventListener("pointerup", rmPointer);
    window.addEventListener("pointercancel", rmPointer);
    window.addEventListener("blur", clearPointers);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(raf);
      clearPointers();
      window.removeEventListener("pointerup", rmPointer);
      window.removeEventListener("pointercancel", rmPointer);
      window.removeEventListener("blur", clearPointers);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
      className="sekasma-ball-canvas"
      width={PX}
      height={PX}
      style={{
        height: "auto", display: "block",
        imageRendering: "pixelated", touchAction: "none",
      }}
      role="button"
      tabIndex={0}
      aria-label="Plasma ball. Press Enter or Space to generate electricity."
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          crackleRef.current(1);
          texts.current.push({ x: CX, y: CY - 10, age: 0, str: `+${fmtShort(neonPowRef.current)}` });
          ripples.current.push({ x: CX, y: CY, age: 0, color: "#ffffff" });
        }
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
      onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
    />
  );
}

