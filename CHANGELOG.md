# Changelog

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
