# Sekasma - Idle Plasma Ball

[![CI](https://github.com/SekaFaji/Sekasma/actions/workflows/ci.yml/badge.svg)](https://github.com/SekaFaji/Sekasma/actions/workflows/ci.yml)
[![Deploy](https://github.com/SekaFaji/Sekasma/actions/workflows/deploy.yml/badge.svg)](https://github.com/SekaFaji/Sekasma/actions/workflows/deploy.yml)

A pixel-art idle game about a plasma ball that only pays out while something is
actually touching the glass. Built with React, TypeScript and a hand-rolled
canvas sprite engine - no game framework, no asset files, every sprite is data.

> The ball is dark. Press it and a neon string leaps to your fingertip - but
> nothing flows unless a finger, a hired hand, a whole foot or a ghost from
> inside the electrode is pressing.

## Features

- **True-touch economy** - no passive income floor: hired help presses on a
  cadence, you crackle while you hold, and everything else is still
- **Multi-touch input** - up to two player fingers, each with its own plasma
  string that bends toward where you press
- **Hired help with personality** - fingers, big toes and translucent ghost
  hands circle the ball in 8 facings, pressing from both sides of the glass
- **Three gas currencies** - NEON, ARGON and XENON, each with its own arcs,
  micro-volt ladder and string splits; high tiers cost mixed currencies
- **Bulk buying** - ×1 / ×5 / ×10 / ×100 / MAX on every repeatable upgrade,
  with live bulk-count previews and always-visible next prices
- **Hand-rolled pixel engine** - sprite models as string grids, baked 8-way
  orientation sets (quarter turns plus nearest-neighbour 45° folds), a tiny
  3×5 pixel font and a 150px render surface upscaled with nearest-neighbour
  sampling
- **Persistence done properly** - autosave with an independent backup, corrupted-save recovery, capped offline progress,
  migration from every legacy save format, and options stored separately
- **Feel** - CRT scanlines, haptic buzz on purchases, monospace all-caps UI,
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
│   ├── save.ts            # localStorage saves, backups and migrations
│   └── timing.ts          # Visible and stalled-clock accounting
├── render/                # Canvas rendering
│   ├── geometry.ts        # Internal surface metrics (150px, centred ball)
│   ├── palette.ts         # Sprite color constants
│   ├── sprites.ts         # Pixel-art engine: models, 8-way orientations, font
│   ├── plasma.ts          # Arc rendering, glass circle, effect types
│   └── limits.ts          # Visual-only helper population limits
├── components/            # React UI
│   ├── PlasmaBall.tsx     # The ball: rAF loop, multi-touch, effects
│   ├── UpgradeRow.tsx     # Purchasable row with price chips
│   ├── InfoRow.tsx        # Non-interactive descriptive row
│   ├── CostChips.tsx      # Per-gas price chips
│   ├── UnlockBar.tsx      # Affordability progress bar
│   ├── UpgradePanel.tsx   # Upgrade tabs and purchase presentation
│   ├── PixelIcon.tsx      # Sprite-to-icon renderer
│   ├── StatsPanel.tsx     # Progression statistics
│   └── OptionsPanel.tsx   # Preferences and safe reset
└── utils/
    ├── format.ts          # Number formatting for the tabular UI
    ├── haptic.ts          # Vibration feedback where supported
    └── progress.ts        # Multi-gas affordability percentage
```

## Getting started

Node.js 22 or later is required.

```bash
npm ci
npm run dev        # Vite dev server
npm test           # Game-logic and rendered UI regression tests
```

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server with hot reload       |
| `npm run typecheck` | `tsc --noEmit` under strict mode |
| `npm test`       | Node and Vite SSR game/UI regression tests |
| `npm run build`     | Production bundle to `dist/`     |
| `npm run preview`   | Preview the production build     |

## Save compatibility and build reproducibility

Existing save keys are retained. The current primary snapshot and a previous-snapshot backup are read independently, and legacy formats remain supported. Reset clears both copies and legacy keys. Browser storage errors are surfaced to the player with a warning; the current session continues in memory even if saves cannot be written.

The repository contains an npm-generated `package-lock.json` (lockfile v3). Use **Node.js 22+** and `npm ci` to install exactly the locked dependency tree. CI and GitHub Pages both use `npm ci` so dependency resolution cannot drift between runs. If dependencies change intentionally, regenerate the lock with `npm install`, review the lockfile diff and commit both files together.

## Mobile browser smoke test

Version 0.12.18: verify the upgrade sub-tabs read HELP, POWER, GAS in that order. On Android with dozens of Fingers/Toes/Stickmen, helpers should move all around the ball rather than accumulating in horizontal strips at the top or sides. The ball, glass rim and larger stand should remain inside the square canvas. All owned helpers remain visually represented. Prestige remains a design discussion and its fourth main tab has **not** been enabled.


Version 0.12.17: with 80 Fingers purchased, inspect the sphere for a dense, mobile array of individually drawn Fingers instead of only 7. Toes and Ghost Hands also remain on-screen in full; Stickmen continue to roam and strike. At higher counts, flashes are sampled for mobile performance, not sprites or income. Change between HELP, GAS and POWER: the lower panel must keep the same height with no jump. You can still scroll within the shared panel on short screens. There is **no Prestige ownership cap yet**; that needs its own approved progression rules.


For 0.12.16, open STATS and verify GENERAL STATS plus each unlocked gas section show four compact boxes per row, with long values readable. OPTIONS contains real external links for SekaFaji GitHub, SekaFaji Games Discord and YouTube that open in a new tab without resetting progress. After capping NEON ARC, the 1/5/10/100/MAX buttons should disappear for that row, but stay available for unmaxed VOLTS and SPLIT, including purchases that are simply unaffordable.


For v0.12.15, open HELP on Android with all four gases unlocked. Verify FINGER, BIG TOE, GHOST HAND and STICKMAN cards appear together in the bottom panel, and each reads POWER (1, 8, 20 or 45) instead of "x FINGER". On upgrades with mixed costs, confirm NEON's pink bolt, ARGON's purple-blue bolt, XENON's cyan bolt and KRYPTON's gold bolt all fit INSIDE their BUY button as two neat columns. Prices use the existing cost calculations; the static helper power numbers preserve previous earnings. Small-height browser layouts still permit scrolling when necessary.


In v0.12.14, confirm upgrade-row heights do **not** move when an affordability percentage appears/disappears. The new pixel-drawn SEKASMA plasma logo is reused on Welcome Back. The ball and its stepped stand should be larger, with roaming and jumping Stickmen briefly cracking the glass. Even with hundreds of owned helpers, at most 12 are drawn simultaneously (income still uses all owned helpers). For short Android displays, verify the controls remain usable and the canvas remains square.


In version 0.12.13, check centered animated electric branding in the header and Welcome Back, boxed Stats, and prices displayed beneath BUY in the same-width BUY/LOCKED controls. Unlock Krypton after Xenon and purchase a Stickman; its hit should briefly crack and then repair the plasma glass. Confirm the larger stand is visible, and existing saves retain their helper and gas progress.


Check the full-screen Welcome Back after leaving the app for at least 10 seconds; verify displayed earnings and that returning without helpers still reports zero. Verify Stats' active, offline and combined totals; offline history from versions older than 0.12.12 cannot be reconstructed. On every repeatable upgrade, test the independent 1/5/10/100/MAX controls immediately before the fixed-width BUY action. Locked rows use the same width and contain a green unlock-progress percentage. The SEKASMA currency rail must scroll sideways when many gases are present. **Active online** means visible foreground gameplay, not an internet connection.


Check that the small BUY dropdown in the top bar still offers x1/x5/x10/x100/MAX and affects purchases in HELP/POWER. All HELP/GAS/POWER upgrade rows and next-price chips remain present. Verify each tab remembers its scroll position, and that only genuine gas-gated helpers show LOCKED. These layout changes still require physical-phone verification.


On short Android screens, confirm the ball remains square and touch positions follow the rendered ball (no stretching). Test both a short viewport and a narrow viewport with three gases, switch from a deeply scrolled POWER list to HELP or STATS, and verify the list begins at the top. Currency totals must wrap rather than overlap other cards. These checks require an actual browser; server-rendered UI tests cannot measure screen geometry.


For interaction polish, verify that purchase feedback does **not** shift the upgrade list, that Options → Reset offers separate Cancel/Confirm actions, and that switching away from Options dismisses an unfinished confirmation.


Before merging a renderer change, check the following on an actual phone:

1. Hold a finger on the plasma ball, switch apps, then return. The game must **not** treat the old finger as held or generate manual crackles until a fresh touch.
2. Repeat while two fingers are held; on return, both touches must be cleared.
3. Lock and unlock the screen while touching the ball; confirm the canvas resumes animation without stuck fingers.
4. Return after leaving the browser in the background and verify idle helpers earn the expected capped offline income once.
5. Toggle between Upgrades, Stats and Options, reset and reload, and verify saved state and UI remain usable.

## Demo and portfolio verification

- [Play the deployed game](https://sekafaji.github.io/Sekasma/)
- [Review GitHub Actions checks](https://github.com/SekaFaji/Sekasma/actions/workflows/ci.yml) for game regression tests, rendered UI tests, typecheck, and build

Rendered UI tests verify actual component HTML and accessibility attributes; real-touch mobile QA is still required. Screenshots and gameplay recordings should be captured from the running game rather than mocked up.

## Deployment

Pushes to `main` are typechecked, tested and built by [CI](.github/workflows/ci.yml),
then deployed to GitHub Pages by [deploy.yml](.github/workflows/deploy.yml), which also requires passing unit tests and typechecking before building.

For pull requests, CI also uploads a **Sekasma-source-zips** artifact containing a full project ZIP and a PATCH_ONLY ZIP of files changed relative to the default branch. These are source archives, not compiled releases.

## License

[MIT](LICENSE)
