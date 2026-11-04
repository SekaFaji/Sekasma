# Sekasma progression baseline (v0.12.25)

This is a reproducible, code-grounded starting point for playtesting, not a claim about real players. Only the first Finger price changes in v0.12.25.

## Current opening

| Mechanic | v0.12.24 | v0.12.25 | Source |
| --- | ---: | ---: | --- |
| Starting Neon per manual tap | 0.1 | 0.1 | `src/game/gases.ts` |
| Starting Fingers | 0 | 0 | `src/game/save.ts` |
| Price of first Finger | 5 Neon | 2 Neon | `src/game/economy.ts` |
| Manual taps to first Finger with no upgrades | 50 | 20 | first cost / 0.1 |
| Price of second Finger | 6 Neon | 6 Neon | `ceil(5 * 1.18^1)` |
| One Finger passive Neon rate | 0.04545/s | 0.04545/s | 0.1 / 2.2s |
| Seconds to second Finger from zero Neon, idle only | approx. 132s | approx. 132s | 6 / 0.04545 |
| Neon Arc base purchase | 12 Neon | 12 Neon | `src/game/config.ts` |
| Argon unlock | 600 Neon | 600 Neon | `src/game/gases.ts` |

The first Finger is reachable sooner without raising base income or accelerating later prices. Holding the globe and buying Arc upgrades can change the actual timings substantially. Times above are mathematical baselines only, with zero competing purchases.

## Stats and lifetime policy

- Main Stats values describe the current run. Each tile has a smaller **LIFETIME** figure.
- Help Rate and Power/Tap lifetime values mean **highest observed** rate, not a sum of rates.
- Hired helpers and purchased Arcs, Splits and Volt Steps mean **cumulative purchases** across all tracked runs.
- Gas lifetime plasma and lifetime total playtime already existed before this release and remain intact.
- For old saves, the migration seeds newly tracked history with the surviving current run. Prior reset purchases cannot be reconstructed.
- A Prestige reset snapshots current crackles/playtime as the new run baseline and never discards lifetime history.

## Next experiment before further tuning

Playtest on a few Android devices with a fresh save and a pre-existing save:
1. Count active taps and wall-clock seconds to first Finger and the next meaningful purchase.
2. Check if a basic Arc is more attractive than Volt Steps at early levels and whether preview gains make that choice clear.
3. Measure time to Argon, Xenon, Krypton and first Prestige using both active and passive play.
4. Test welcome-back/offline progression, no-affordability stretches, and transitions between small and large helper armies.
5. Recheck all costs using real sessions before changing the gas unlock requirements or Prestige rules.

No new currencies, upgrades, helpers, tabs, monetization, or artificial visual helper caps are proposed in this phase.
