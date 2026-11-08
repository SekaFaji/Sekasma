# Voltage progression: v0.12.26

## New system

Each gas gets up to **20 Voltage levels**. Each new level adds **10%** of base Voltage production, stacking linearly (Level 10 = x2.0, Level 20 = x3.0, *before* any legacy run bonus). Arc and Split effects still multiply the resulting power.

New Voltage price: `ceil(baseCost * 1.25^level)`, where `level` is the number currently owned.

| Gas | First level |
| --- | ---: |
| Neon | 8 |
| Argon | 20 |
| Xenon | 60 |
| Krypton | 140 |

For Neon, levels 1 through 10 cost: 8, 10, 13, 16, 20, 25, 31, 39, 48, 60. The first 10 cost 270 Neon in total; all 20 cost 2,754 Neon. No Arc, Split, gas unlock, helper purchase or Prestige costs changed.

## Existing save migration

Old micro-volt purchases were stored in `state.voltage[gas]` with 0.0001 of multiplier per purchased step. The v17 save schema moves that number to `state.legacyVoltage[gas]` *without changing its current run multiplier*. The new `state.voltage[gas]` starts at 0 and tracks +10% levels only.

`old multiplier = 1 + legacySteps * 0.0001`

`new combined multiplier = old multiplier * (1 + newVoltageLevels * 0.1)`

For example, an account with 1,000 old Neon steps retains x1.10 on loading. The first new level makes it x1.21. On Prestige, **both the new levels and the old legacy bonus reset**, so old save migration does not create permanent power.

Lifetime stats maintain **two separate histories**:
- `lifetime.legacyVoltagePurchases`: old micro-volt purchases (possibly across earlier tracked Prestiges, without inventing missing data)
- `lifetime.purchasedVoltage`: new +10% Voltage levels purchased since this migration

Lifetime peak help and tap rates remain unchanged and can grow naturally as upgrades are purchased. Older saves from v6/v8/v9-v16 still use their previous conversion path, then transition into the new schema.

## Save protection

Before first migration of an old save, the original raw JSON is copied to:
`localStorage["idle-plasma-ball-before-voltage-v17"]`

The normal autosave backup continues rotating independently. The protected snapshot is not overwritten by autosaves. It is cleared only by the game's deliberate two-step **Reset Save** action. If storage capacity is exhausted, the game attempts migration without silently claiming a backup was made.

The existing primary save key stays unchanged. New writes are internal schema **v17**. This allows recovery of the exact original raw save if a problem is encountered, without silently rolling players back.

## Visual consistency and verification

Held touch draws up to 30 extra Arc streams across all gases, rather than stopping at 15. All eight possible Split branch levels can be drawn. Voltage slightly increases arc turbulence (bounded) without adding new draw calls. On a phone, test two-finger input with 30 purchased Arc streams and several Split levels to verify comfort and framerate.

Required checks: old-save multiplier parity, reloading the new schema without double-applying migration, no save mutation during previews, the 20-level cap, bulk cost, Prestige reset and lifetime history, preserved snapshot after multiple autosaves, and the rendered Voltage labels.
