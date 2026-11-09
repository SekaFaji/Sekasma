# Argon chapter (v0.12.29)

This milestone expands Argon with two buyable, originally code-drawn helpers, introduces a Xenon milestone, and keeps older save formats compatible.

## Unlock sequence

The shop only shows the newly reachable tier rather than the whole roster.

1. Newly discovered Argon shows the existing Big Toe.
2. Buying a Big Toe reveals Conductive Palm: power 18, base price 220 Argon, 1.30x cost growth.
3. Buying a Palm reveals Orbit Drone: power 50, base price 2,200 Argon, 1.40x cost growth.
4. Buying a Drone reveals the locked Ghost Hand for Xenon.

Permanent lifetime hires retain discoveries across Prestige. Accounts that already unlocked Xenon or Krypton see the new Argon rows immediately. Existing helper cost curves, production, Voltage, Neon Mastery and older unlocks are unchanged.

## Mastery and Xenon unlock

- Produce 60,000 Argon since the last Prestige, regardless of how much remains unspent.
- Buy at least one Orbit Drone during the current run.
- Spend 12,000 Argon after meeting both conditions to discover Xenon.
- Previously discovered Xenon stays unlocked on older saves.
- Krypton keeps the pre-existing unlock rule pending its own chapter release.

The Gas tab shares one compact Mastery block for Neon and Argon and avoids naming unrevealed helper classes.

## Save migration

- Internal schema v19, with the original save key unchanged.
- Existing balances, cumulative production, run duration, Voltage bonuses, helper levels, lifetime history and Prestige capacity remain.
- Two new run-owned fields (conductivePalms, orbitDrones) and their lifetime and capacity entries default to zero in older saves.
- An unmodified pre-migration snapshot is stored in the separate browser key idle-plasma-ball-before-argon-v19 before the first older-save load.
- Prestige resets the newly bought helpers, retaining permanent history and capacity upgrades.

## Next playtest

On Android, verify helper rendering with several palms and drones, active and offline time to Xenon, and smooth frame pacing. Future tuning should be driven by real sessions rather than guessed time targets. No arbitrary hidden-helper visual cap was added.
