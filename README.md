# Sekasma — Idle Plasma Ball

A pixel-art idle clicker about a plasma ball that only pays while something touches the glass.

> The ball is dark. Press it and a neon string leaps to your fingertip — but nothing flows unless a finger, a hired hand, or a whole foot is actually pressing.

## Features (v10 · SPLIT & BULK)

- **True touch economy** — no income without help on the glass
- **Multi-touch** — every finger you press with gets its own plasma string
- **One string per finger** — SPLIT upgrades fork it into branches (each branch 0.75x → 1 split = 1.5x output)
- **Wandering arcs** — ARC upgrades add roaming strings that crawl to random glass points and fork mid-flight
- **Three gas currencies** — NEON, ARGON, XENON, each with its own arcs, volts and splits
- **Micro-volts** — VOLTS upgrades add +0.0001V output per step
- **Bulk buy** — ×1 / ×5 / ×10 / ×100 / MAX on every repeatable upgrade
- **Mixed-currency sinks** — high-level fingers & feet cost multiple gases at once
- **Helpers all around the ball** — hired fingers and feet press from both sides of the glass
- CRT scanlines, monospace ALL-CAPS UI, phone-first portrait layout

## Dev

```bash
npm install
npm run dev
```

React + Vite + TypeScript + Tailwind. Saves live in localStorage (`idle-plasma-ball-save-v10`) with migration from all earlier versions.

## Roadmap

- Android-first release via Capacitor, then iOS and web
- Krypton gas tier, milestone bonuses, finger/foot skins
