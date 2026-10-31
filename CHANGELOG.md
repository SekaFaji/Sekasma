# Changelog

## 0.12.16 — Compact four-column Stats, community links, maxed upgrades

- Group general counters under a titled GENERAL STATS section matching each gas's own category
- Display four compact stat boxes per row on phones, in General and per-gas sections
- Add GitHub, SekaFaji Games Discord and YouTube community links in Options from the published SekaFaji profile
- Open external links in a separate browser tab with noopener/noreferrer protection
- Hide x1/x5/x10/x100/MAX controls when a purchase is genuinely capped; keep them on unaffordable upgrades
- Keep upgrade economy, owned quantities, save data and existing layouts unchanged
- Add rendered UI regression tests for grouping, actual links, and maxed-versus-unaffordable behavior


## 0.12.15 — Four visible helpers, individual power and gas-bolt prices

- Fit all four HELP upgrade rows together on typical Android phone screens with shorter, stable row heights and a HELP-specific panel height
- Replace the "x FINGER" text with fixed base power stats per helper (Finger 1, Big Toe 8, Ghost Hand 20, Stickman 45)
- Centralize those power constants in the economy without changing current rates, purchases, upgrades or save data
- Display each noble gas price inside BUY with its own colored, custom-shaped pixel lightning bolt
- Arrange multi-currency prices in two compact columns to stop long prices spilling outside the BUY button
- Add UI and economy tests for four helper rows, fixed helper power and four unique currency bolts


## 0.12.14 — Stable upgrades, plasma pixel logo and animated Stickmen

- Give upgrade rows and their subtitle/progress slots fixed height so affordability bars never shift adjacent items
- Replace text-and-emoji branding with a reusable, crisp pixel-art plasma-orb emblem and custom SEKASMA glyphs
- Animate pixel sparks subtly and respect reduced-motion preferences
- Increase the plasma orb radius, displayed canvas area and stepped pedestal while preserving the responsive layout
- Make Stickmen orbit the sphere, jump toward it, swing and strike with brief self-repairing glass-crack effects
- Reduce per-helper screen limits and cap all visible helpers to a shared budget of 12; existing purchases and idle income stay unchanged
- Add renderer-state, visual-count and React component regression coverage


## 0.12.13 — Electric branding, compact prices, Krypton and Stickman

- Center the SEKASMA logo, animate subtle electric bolts, and reuse the mark on Welcome Back
- Display the full currency cost under BUY inside consistently sized BUY/LOCKED controls
- Replace Stats lines with compact two-column boxed cards
- Enlarge the plasma stand; draw Stickmen that hit the glass and leave temporary self-repairing cracks
- Add Krypton after Xenon and a new Stickman helper whose idle contribution is serverless and save-backed
- Migrate legacy saves safely to schema 14 and preserve existing progression


## 0.12.12 - Welcome Back, playtime statistics and compact purchasing

- Full-screen Welcome Back summary shows time away and actual per-gas earnings, including zero-income returns
- Track capped background time separately from foreground active time, with migration of older saves (schema v13)
- Stats now distinguish TOTAL PLAYTIME, ACTIVE ONLINE and OFFLINE PLAYTIME (historical offline hours unavailable)
- Give BUY and LOCKED actions a fixed 65px width; show green percentage progress inside locked actions
- Move independent x1/x5/x10/x100/MAX controls next to each repeatable upgrade's BUY action
- Rename header to SEKASMA, remove helper counts and use a compact scrolling currency rail for future growth
- Keep existing economy, caps, rewards, upgrade categories and sprites unchanged


## 0.12.11 - Compact UI correction

- Move x1/x5/x10/x100/MAX bulk buying to one compact BUY dropdown in the top status header
- Reduce upgrade row, icon, tab, currency header and plasma ball dimensions
- Restore 0% progress for unavailable-but-unlocked purchases without restoring meaningless locked meters
- Remember each category's scroll position rather than discarding it on tab switches
- Preserve original upgrade categories, buying quantities and effects; add regression tests
- No new gameplay content, assets, balance or save schema changes


## 0.12.10 - Responsive mobile layout and readability

- Size the square plasma canvas from the actual available display area using CSS container units with viewport fallbacks
- Give currency balances a narrow-screen-friendly, wrapping layout without cropping numbers
- Increase upgrade-description readability and preserve compact price chips
- Adjust the lower panel's height on short screens and ensure upgrade tab/quantity controls have 44px touch targets
- Reset scroll position on section/category changes so switching from a long list never opens a short list at the bottom
- Extend rendered React UI regression tests; game logic, saves, art and progression are unchanged


## 0.12.9 — Interaction clarity and accessibility

- Keep existing purchase feedback over the panel viewport instead of inserting it into scrolling content
- Replace the ambiguous second-tap reset flow with explicit CANCEL and CONFIRM RESET actions
- Dismiss pending reset confirmation when leaving the Options tab
- Add pressed-state semantics to toggles and purchase quantity, and connect upgrade tabs to their panels
- Expand rendered UI tests for confirmation states and accessible upgrade controls
- No game balance, content, art or save-schema changes


## 0.12.8 — UI tests and maintainable components

- Extract UpgradePanel from the application shell while retaining existing progression and controls
- Add rendered React SSR regression tests for affordability, locked labels, prices and navigation
- Improve existing purchase feedback animation; honor reduced-motion preferences
- Remove outdated settings version copy and keep game balance unchanged


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
