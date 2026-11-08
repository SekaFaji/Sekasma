# Sekasma helper expansion plan (v0.12.27 groundwork)

This milestone is an architecture-only patch. It does not add helpers, change prices, adjust gas unlocks, or change saved-data representation.

## Current architecture

The four released helpers are described in `src/game/helpers.ts`. Each catalog entry defines:

- A stable ID and original save property
- Display name, hire feedback strings and Stats label
- Native gas and existing unlock condition
- Attack power, helper capacity and Prestige expansion step
- Starting price, exponential cost growth, mixed-currency fees and level thresholds
- The visual category, icon pixel scaling and shop accent

`src/game/economy.ts` uses the catalog for purchasing, cost previews and combined passive power. `src/game/prestige.ts` uses it for helper capacity and `src/components/UpgradePanel.tsx` for rendering HELP rows. `StatsPanel.tsx` derives the helper rows and lifetime counts from the same definitions.

This patch deliberately retains the four original save fields (fingers, toes, ghosts, stickmen), and the v17 save schema. Existing saves do not need a migration.

## Next staged releases

1. Add a versioned, expandable owned-helper record to the save schema, with a one-way migration mapping existing counts into the catalog without double-counting income. Keep all existing save data safe, using a pre-migration backup.
2. Introduce **Spark Mite** and **Copper Spider** with original, hand-authored pixel sprite animations and a clear role different from Fingers. Add purchase, bulk-price, income and lifetime-ownership parity tests.
3. Add per-gas, per-run **Mastery milestones** tied to cumulative production, not unspent money. Argon discovery should be a meaningful late-Neon milestone, not just a higher currency price.
4. Simulate and playtest fresh save, offline and active paths before finalizing Neon Mastery thresholds. Ensure old saves already beyond a milestone remain valid.
5. Expand Argon, Xenon and Krypton with two new distinct helper types each, keeping the same UI and registry architecture.

For newly introduced helper classes, the catalog should eventually drive dedicated animation/render strategies. The four legacy visual paths stay unchanged for this groundwork patch, so we do not risk breaking the polished art on mobile.

## Stability contract

- Current helper levels: Finger 30, Big Toe 25, Ghost Hand 20, Stickman 15.
- Current power: 1, 8, 20, 45. Press interval: 2.2 seconds.
- Native gases: Neon, Argon, Xenon, Krypton.
- The four current price formulas and their mixed-currency transitions are not modified.
- Existing save slot and internal schema remain unchanged; no reset or rebalancing.
- Every owned helper remains represented in the plasma renderer, with visual effects sampled separately for mobile performance.
