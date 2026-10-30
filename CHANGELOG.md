# Changelog

## 0.12.7 — Compact upgrades and adaptive mobile UI

- Embed a slim affordability meter inside the relevant upgrade instead of a separate row
- Show a readable LOCKED state for gas-gated helpers; no meaningless 0% bars
- Keep prices and descriptions legible even when unaffordable; standardize upgrade row layout
- Improve mobile tap targets, upgrade tabs, quantity selector, scrollbars and screen-height sizing
- Preserve upgrade pricing, effects, currency and all gameplay progression


## 0.12.6 — Mobile touch lifecycle safety

- Release held touches and plasma arcs when the browser loses focus or the game is backgrounded
- Stop requesting canvas animation frames while hidden, then resume with a fresh frame timestamp
- Avoid phantom held-finger crackles after returning from a suspended mobile browser
- Preserve game economy, purchases, save schema and progression balance unchanged


## 0.12.5 — Reproducible builds and static cleanup

- Commit the genuine npm v10 lockfile generated on a GitHub-hosted Node 22 runner (185 packages)
- Use `npm ci` and dependency caching in CI and GitHub Pages builds
- Enable TypeScript's unused-local and unused-parameter checks; remove dead imports
- Update installation guidance and document how to keep the dependency lock reproducible
- Upload full-source and changed-files ZIP packages from pull-request CI runs


## 0.12.4 — Save recovery and lifecycle safety

- Keep a backup of the previous save before overwriting the primary snapshot
- Recover corrupted current saves from the backup or a valid legacy save
- Reset all save slots and legacy keys synchronously to prevent old saves from reappearing
- Account for long timer stalls as capped idle income rather than losing progression or inflating playtime
- Add save recovery, reset and paused-clock regression tests; run pure tests before dependency installation in CI
- Warn when browser storage is unavailable and guard Pages deployment with tests and typechecking

**Next build task:** Generate and commit a genuine `package-lock.json` using npm with registry access, then migrate CI and Pages to `npm ci`.


## 0.12.3 — Mobile polish and module cleanup

- Extract statistics and options panels from the application shell
- Increase compact text sizes, lighten muted text, and allow mobile browser zoom
- Make the plasma canvas keyboard-accessible, with Enter/Space touch equivalents
- Pin direct dependency versions, standardize Node 22 for CI and deployment
- Improve documentation for the tests and rendering limits

**Build note:** A lockfile still needs generating with npm on a networked machine and committing; exact top-level dependency pins alone cannot freeze transitive dependencies.

## 0.12.2 — Scalable visual helpers

- Cap simultaneously rendered fingers, feet, and ghost hands without capping owned counts or earnings
- Bound visual flash and ripple buffers so large helper populations remain predictable
- Add a helper-visibility regression test to enforce the separation from game economy

## 0.12.1 — Reliable progression

- Bound offline settlement on reload and browser resume; prevent StrictMode double-awards
- Record visible playtime rather than elapsed save age; credit idle only when helpers are owned
- Validate legacy/corrupted saves, clamp values, and advance internal save schema to v12
- Extract idle accrual and transactional purchases into pure testable functions
- Add Node 22 regression tests for purchases, migration and offline progression

All notable changes to this project are documented here.

## 0.12.0 — Project restructure

- Modular architecture: framework-free game logic, canvas rendering, React UI
  and utilities split into focused modules with documented boundaries
- CI workflow: every push and pull request is typechecked and built
- README, LICENSE, CHANGELOG and .editorconfig added
- `esModuleInterop` enabled in tsconfig

## 0.11.1 — Steady Hands

- Fix: player fingers could get stuck on the glass — input is now capped at
  two simultaneous touches with window-level pointer cleanup
- Hired fingers, toes and ghost hands face the ball in 8 directions (45°
  pixel-perfect rotation)
- Every upgrade row always shows its next price, affordable or not

## 0.11.0 — The Plasma Presses Back

- Ghost hands: spectral hands grow from the electrode and hold the glass from
  the inside (20× a finger, manifest → hold → dissolve)
- Living static motes drift inside the ball, excited by touch

## 0.10.1 — Feel & Feedback

- Purchase toasts and haptic buzz (optional, persisted)
- Sub-tab affordability dots, unlock progress bars, bulk-buy previews
- UI options persist between sessions

## 0.10.0 — Split & Bulk

- Split strings: each fork adds a 0.75× branch to every crackle
- Bulk buying (×1 / ×5 / ×10 / ×100 / MAX) across all repeatable upgrades
- Micro-volts (+0.0001V per step) and mixed-currency high-tier helpers
- Three gas currencies: NEON, ARGON, XENON with chained unlock costs
