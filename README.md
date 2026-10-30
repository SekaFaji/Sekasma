# Sekasma — Idle Plasma Ball

[![CI](https://github.com/SekaFaji/Sekasma/actions/workflows/ci.yml/badge.svg)](https://github.com/SekaFaji/Sekasma/actions/workflows/ci.yml)
[![Deploy](https://github.com/SekaFaji/Sekasma/actions/workflows/deploy.yml/badge.svg)](https://github.com/SekaFaji/Sekasma/actions/workflows/deploy.yml)

A pixel-art idle game about a plasma ball that only pays out while something is
actually touching the glass. Built with React, TypeScript and a hand-rolled
canvas sprite engine — no game framework, no asset files, every sprite is data.

> The ball is dark. Press it and a neon string leaps to your fingertip — but
> nothing flows unless a finger, a hired hand, a whole foot or a ghost from
> inside the electrode is pressing.

## Features

- **True-touch economy** — no passive income floor: hired help presses on a
  cadence, you crackle while you hold, and everything else is still
- **Multi-touch input** — up to two player fingers, each with its own plasma
  string that bends toward where you press
- **Hired help with personality** — fingers, big toes and translucent ghost
  hands circle the ball in 8 facings, pressing from both sides of the glass
- **Three gas currencies** — NEON, ARGON and XENON, each with its own arcs,
  micro-volt ladder and string splits; high tiers cost mixed currencies
- **Bulk buying** — ×1 / ×5 / ×10 / ×100 / MAX on every repeatable upgrade,
  with live bulk-count previews and always-visible next prices
- **Hand-rolled pixel engine** — sprite models as string grids, baked 8-way
  orientation sets (quarter turns plus nearest-neighbour 45° folds), a tiny
  3×5 pixel font and a 150px render surface upscaled with nearest-neighbour
  sampling
- **Persistence done properly** — autosave with offline progress (capped),
  migration from every legacy save format, and options stored separately
- **Feel** — CRT scanlines, haptic buzz on purchases, monospace all-caps UI,
  phone-first 400px portrait layout

## Architecture

The simulation has no framework imports: `game/` and `render/` are pure
TypeScript, so the whole engine can run under any host (this repo mounts it
with React; it is written to be trivially portable to Capacitor).

```
src/
├── App.tsx                # Application shell: status bar, tabs, purchase actions
├── game/                  # Framework-free game logic
│   ├── types.ts           # Gas currencies and the save-state shape
│   ├── gases.ts           # Gas data table and lookup helpers
│   ├── config.ts          # Balance tuning: cadence, multipliers, cost bases
│   ├── economy.ts         # Cost curves, bulk pricing, income, purchases
│   └── save.ts            # localStorage persistence and legacy migrations
├── render/                # Canvas rendering
│   ├── geometry.ts        # Internal surface metrics (150px, centred ball)
│   ├── palette.ts         # Sprite color constants
│   ├── sprites.ts         # Pixel-art engine: models, 8-way orientations, font
│   └── plasma.ts          # Arc rendering, glass circle, effect types
├── components/            # React UI
│   ├── PlasmaBall.tsx     # The ball: rAF loop, multi-touch, effects
│   ├── UpgradeRow.tsx     # Purchasable row with price chips
│   ├── InfoRow.tsx        # Non-interactive descriptive row
│   ├── CostChips.tsx      # Per-gas price chips
│   ├── UnlockBar.tsx      # Affordability progress bar
│   └── PixelIcon.tsx      # Sprite-to-icon renderer
└── utils/
    ├── format.ts          # Number formatting for the tabular UI
    └── haptic.ts          # Vibration feedback where supported
```

## Getting started

```bash
npm install
npm run dev        # Vite dev server
npm test           # Pure game logic regression tests (Node.js 22+)
```

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server with hot reload       |
| `npm run typecheck` | `tsc --noEmit` under strict mode |
| `npm test`       | Node test runner for game economy and saves |
| `npm run build`     | Production bundle to `dist/`     |
| `npm run preview`   | Preview the production build     |

## Deployment

Pushes to `main` are typechecked, tested and built by [CI](.github/workflows/ci.yml),
then deployed to GitHub Pages by [deploy.yml](.github/workflows/deploy.yml).

## License

[MIT](LICENSE)
