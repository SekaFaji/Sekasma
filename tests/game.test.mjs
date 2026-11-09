import test from "node:test";
import assert from "node:assert/strict";
import { accrueIdle, accrueOffline, bulkCost, cappedOfflineSeconds, fingerCost, purchaseUpgrade } from "../src/game/economy.ts";
import { OFFLINE_CAP_S, HELPER_POWER, PRESS_INTERVAL, MAX_VOLT_LEVELS, VOLT_LEVEL_BONUS, voltMult } from "../src/game/config.ts";
import { BACKUP_KEY, PRE_VOLTAGE_BACKUP_KEY, PRE_HELPER_BACKUP_KEY, LEGACY_V9_KEY, SAVE_KEY, freshSave, loadSave, migrateSave, persist, resetSave } from "../src/game/save.ts";
import { measureTick } from "../src/game/timing.ts";
import { visibleHelperCount, visibleHelperCounts, helperOrbitRadius, helperEffectChance } from "../src/render/limits.ts";
import { advanceStickman, createStickman } from "../src/render/stickmen.ts";
import { PX, CX, CY, R } from "../src/render/geometry.ts";
import { plasmaDisplacement } from "../src/render/plasma.ts";
import { previewPurchaseImpact } from "../src/game/purchasePreview.ts";
import { idleRate, MAX_BULK_PURCHASE, cracklePower, voltageCost } from "../src/game/economy.ts";
import { BASE_CAPACITY, CAPACITY_STEP, capacityUpgradeCost, helperCapacity, helperRoom, performPrestige, prestigeReward, runPrestigeScore, upgradeCapacity } from "../src/game/prestige.ts";

test("offline settlement is capped and handles negative time", () => {
  assert.equal(cappedOfflineSeconds(0, 86400000), OFFLINE_CAP_S);
  assert.equal(cappedOfflineSeconds(10000, 5000), 0);
  assert.equal(cappedOfflineSeconds(NaN, 1000), 0);
});

test("no hired helpers means no passive income", () => {
  const initial = freshSave();
  const { state, gain } = accrueIdle(initial, 1000);
  assert.strictEqual(state, initial);
  assert.equal(gain.neon, 0);
});

test("idle earnings are capped and immutable", () => {
  const initial = { ...freshSave(), fingers: 2 };
  const { state, gain } = accrueIdle(initial, 86400);
  assert.ok(gain.neon > 0);
  assert.equal(state.plasma.neon, gain.neon);
  assert.equal(initial.plasma.neon, 0);
  assert.equal(gain.neon, accrueIdle(initial, OFFLINE_CAP_S).gain.neon);
});

test("bulk purchases charge successive levels and do not mutate inputs", () => {
  const initial = { ...freshSave(), plasma: { neon: 1000, argon: 0, xenon: 0, krypton: 0 } };
  const quote = bulkCost(initial, "finger", undefined, 5);
  assert.equal(quote.count, 5);
  const expected = Array.from({ length: 5 }, (_, i) => fingerCost(i, ["neon"]).neon ?? 0)
    .reduce((a, b) => a + b, 0);
  assert.equal(quote.cost.neon, expected);
  const purchased = purchaseUpgrade(initial, "finger", undefined, 5);
  assert.equal(purchased.count, 5);
  assert.equal(purchased.state.fingers, 5);
  assert.equal(purchased.state.plasma.neon, 1000 - expected);
  assert.equal(initial.fingers, 0);
  assert.equal(initial.plasma.neon, 1000);
});

test("unaffordable purchases return the exact original state", () => {
  const state = freshSave();
  assert.strictEqual(purchaseUpgrade(state, "finger", undefined, 1).state, state);
});

test("gas unlock costs are charged once", () => {
  const initial = { ...freshSave(), plasma: { neon: 1800, argon: 0, xenon: 0, krypton: 0 },
    total: { neon: 6000, argon: 0, xenon: 0, krypton: 0 }, copperSpiders: 1 };
  const { state, count } = purchaseUpgrade(initial, "gas", undefined, 100);
  assert.equal(count, 1);
  assert.deepEqual(state.unlocked, ["neon", "argon"]);
  assert.equal(state.plasma.neon, 0);
});

test("legacy save validation prevents invalid currencies and progression", () => {
  const state = migrateSave({
    ...freshSave(), v: 11, activeSeconds: -50,
    plasma: { neon: -100, argon: Infinity, xenon: 3, krypton: 2 },
    voltage: { neon: 999999999, argon: -7, xenon: 0, krypton: 0 },
    filaments: { neon: 999, argon: 1, xenon: 0, krypton: 0 },
    splits: { neon: 999, argon: 0, xenon: 0, krypton: 0 },
    unlocked: ["xenon", "not-a-gas"],
  });
  assert.deepEqual(state.unlocked, ["neon"]);
  assert.equal(state.plasma.neon, 0);
  assert.equal(state.plasma.argon, 0);
  assert.equal(state.plasma.xenon, 3);
  assert.equal(state.voltage.neon, 0);
  assert.equal(state.legacyVoltage.neon, 99999);
  assert.equal(state.filaments.neon, 12);
  assert.equal(state.splits.neon, 8);
  assert.equal(state.activeSeconds, 0);
});

test("v6 saves still migrate to a safe game state", () => {
  const state = migrateSave({ plasma: 100, total: 200, voltage: 0, fingers: 1, toes: 0, filaments: 0, gas: "neon" });
  assert.equal(state.plasma.neon, 20);
  assert.equal(state.total.neon, 40);
  assert.equal(state.fingers, 1);
  assert.equal(state.activeSeconds, 0);
});

test("all owned helpers remain visible and contribute their full income", () => {
  const s = { ...freshSave(), fingers: 5000, toes: 100, ghosts: 30, unlocked: ["neon", "argon", "xenon"] };
  const earned = accrueIdle(s, 10).gain.neon;
  assert.ok(earned > accrueIdle({ ...s, fingers: 20, toes: 12, ghosts: 10 }, 10).gain.neon);
  assert.equal(visibleHelperCount(s.fingers, "fingers"), 5000);
  assert.equal(visibleHelperCount(s.toes, "toes"), 100);
  assert.equal(visibleHelperCount(s.ghosts, "ghosts"), 30);
  assert.equal(visibleHelperCount(10, "stickmen"), 10);
  assert.equal(visibleHelperCount(-10, "fingers"), 0);
});

function withStorage(run) {
  const previousWindow = globalThis.window;
  const items = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => items.has(key) ? items.get(key) : null,
      setItem: (key, value) => items.set(key, String(value)),
      removeItem: (key) => items.delete(key),
    },
  };
  try {
    run(items);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("save backup keeps the previous complete snapshot", () => withStorage((items) => {
  const first = { ...freshSave(), fingers: 3 };
  const second = { ...freshSave(), fingers: 7 };
  assert.equal(persist(first), true);
  assert.equal(persist(second), true);
  assert.equal(JSON.parse(items.get(BACKUP_KEY)).fingers, 3);
  assert.equal(loadSave().fingers, 7);
}));

test("malformed current save falls back to backup or legacy", () => withStorage((items) => {
  const good = { ...freshSave(), fingers: 4, v: 12 };
  items.set(SAVE_KEY, "{ broken JSON");
  items.set(BACKUP_KEY, JSON.stringify(good));
  assert.equal(loadSave().fingers, 4);
  items.delete(BACKUP_KEY);
  items.set(LEGACY_V9_KEY, JSON.stringify({ ...good, v: 9, fingers: 9 }));
  assert.equal(loadSave().fingers, 9);
}));

test("reset clears current, backup and legacy progress immediately", () => withStorage((items) => {
  persist({ ...freshSave(), fingers: 10 });
  persist({ ...freshSave(), fingers: 20 });
  items.set(LEGACY_V9_KEY, JSON.stringify({ ...freshSave(), fingers: 30, v: 9 }));
  const result = resetSave();
  assert.equal(result.fingers, 0);
  assert.equal(loadSave().fingers, 0);
  assert.equal(items.get(BACKUP_KEY), undefined);
  assert.equal(items.get(LEGACY_V9_KEY), undefined);
  assert.equal(JSON.parse(items.get(SAVE_KEY)).fingers, 0);
}));

test("normal game ticks account for visible time", () => {
  assert.deepEqual(measureTick(1000, 2000), {
    incomeSeconds: 1, activeSeconds: 1, stalled: false,
  });
});

test("long stalls credit bounded income but not active playtime", () => {
  assert.deepEqual(measureTick(0, 10_000), {
    incomeSeconds: 10, activeSeconds: 0, stalled: true,
  });
  assert.equal(measureTick(0, 86_400_000).incomeSeconds, OFFLINE_CAP_S);
  assert.equal(measureTick(1000, 0).incomeSeconds, 0);
  assert.equal(measureTick(NaN, 1000).incomeSeconds, 0);
});

test("unavailable storage is reported and reset stays safe in memory", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    },
  };
  try {
    assert.equal(persist(freshSave()), false);
    assert.equal(resetSave().fingers, 0);
    assert.equal(loadSave(), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("offline time is tracked even with zero earnings and is capped", () => {
  const start = freshSave();
  const { state, gain } = accrueOffline(start, 86400);
  assert.equal(gain.neon, 0);
  assert.equal(state.offlineSeconds, OFFLINE_CAP_S);
  assert.equal(state.activeSeconds, 0);
  assert.equal(start.offlineSeconds, 0);
  const withHelpers = accrueOffline({ ...start, fingers: 1, offlineSeconds: 12 }, 60);
  assert.equal(withHelpers.state.offlineSeconds, 72);
  assert.ok(withHelpers.gain.neon > 0);
});

test("legacy save migration initializes offline time safely", () => {
  const oldSave = { ...freshSave(), v: 12, offlineSeconds: undefined, activeSeconds: 120 };
  const migrated = migrateSave(oldSave);
  assert.equal(migrated.activeSeconds, 120);
  assert.equal(migrated.offlineSeconds, 0);
  assert.equal(migrateSave({ ...freshSave(), v: 13, offlineSeconds: -50 }).offlineSeconds, 0);
});

test("Krypton unlocks after Xenon and Stickmen purchase safely", () => {
  const s = freshSave();
  s.unlocked = ["neon", "argon", "xenon"];
  s.plasma.xenon = 40000;
  const gas = purchaseUpgrade(s, "gas", undefined, 1);
  assert.equal(gas.count, 1);
  assert.deepEqual(gas.state.unlocked, ["neon", "argon", "xenon", "krypton"]);
  assert.equal(gas.state.plasma.xenon, 0);
  const available = { ...gas.state, plasma: { ...gas.state.plasma, krypton: 200 } };
  const purchased = purchaseUpgrade(available, "stickman", undefined, 1);
  assert.equal(purchased.count, 1);
  assert.equal(purchased.state.stickmen, 1);
  assert.ok(purchased.state.plasma.krypton < 200);
  assert.equal(available.stickmen, 0);
  assert.ok(accrueIdle(purchased.state, 10).gain.neon > accrueIdle({ ...purchased.state, stickmen: 0 }, 10).gain.neon);
});

test("v13 save migrations preserve old progress and add Krypton and Stickmen", () => {
  const old = freshSave();
  delete old.plasma.krypton;
  delete old.total.krypton;
  delete old.voltage.krypton;
  delete old.filaments.krypton;
  delete old.splits.krypton;
  delete old.stickmen;
  const result = migrateSave({ ...old, v: 13, fingers: 9, activeSeconds: 3600 });
  assert.equal(result.fingers, 9);
  assert.equal(result.activeSeconds, 3600);
  assert.equal(result.stickmen, 0);
  assert.equal(result.plasma.krypton, 0);
  assert.deepEqual(result.unlocked, ["neon"]);
});

test("every type receives its full owned sprite count, even with hundreds", () => {
  const counts = visibleHelperCounts({ fingers: 200, toes: 30, ghosts: 40, stickmen: 500 });
  assert.deepEqual(counts, { fingers: 200, toes: 30, ghosts: 40, stickmen: 500 });
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 770);
  assert.ok(Object.values(counts).every(n => n > 0));
  assert.deepEqual(visibleHelperCounts({ fingers: 0, toes: 0, ghosts: 0, stickmen: 0 }),
    { fingers: 0, toes: 0, ghosts: 0, stickmen: 0 });
  assert.equal(visibleHelperCounts({ fingers: 0, toes: 0, ghosts: 0, stickmen: 1 }).stickmen, 1);
});

test("Stickmen move around the orb, jump, then strike exactly once per leap", () => {
  const agent = createStickman(0, 0);
  let strikes = 0, framesInAir = 0, walking = false;
  const origin = agent.angle;
  for (let step = 0; step < 150; step++) {
    const pose = advanceStickman(agent, step * .04, .04);
    if (pose.strike) strikes++;
    if (pose.jump > 0) framesInAir++;
    if (pose.stride) walking = true;
    if (pose.strike) assert.equal(pose.attack, true);
  }
  assert.ok(agent.angle !== origin);
  assert.ok(framesInAir >= 5);
  assert.ok(walking);
  assert.ok(strikes >= 2 && strikes <= 4);
});

test("helper types have independent fixed power values, not finger-owned scaling", () => {
  const { neon: neonGas } = { neon: { baseRate: 0.1 } };
  const base = freshSave();
  const helpers = [
    ["fingers", "finger", 1], ["toes", "toe", 8],
    ["ghosts", "ghost", 20], ["stickmen", "stickman", 45],
  ];
  for (const [field, key, power] of helpers) {
    assert.equal(HELPER_POWER[key], power);
    const state = { ...base, [field]: 1 };
    assert.ok(Math.abs(accrueIdle(state, PRESS_INTERVAL).gain.neon - neonGas.baseRate * power) < 1e-9);
    const after = { ...state, fingers: field === "fingers" ? 1 : 777 };
    const contribution = accrueIdle(after, PRESS_INTERVAL).gain.neon -
      accrueIdle({ ...after, [field]: 0 }, PRESS_INTERVAL).gain.neon;
    assert.ok(Math.abs(contribution - neonGas.baseRate * power) < 1e-9);
  }
});

test("helpers occupy distinct orbital rings without a visual hard limit", () => {
  const radii = Array.from({ length: 80 }, (_, i) => helperOrbitRadius("fingers", i, 57));
  assert.equal(new Set(radii).size, 3);
  assert.ok(radii.every(r => r < R));
  assert.ok(helperOrbitRadius("ghosts", 0, 57) < 57);
  assert.ok(helperOrbitRadius("stickmen", 1, 57) < R);
  assert.equal(visibleHelperCount(Infinity, "fingers"), 0);
  assert.equal(visibleHelperCount(80.9, "fingers"), 80);
});

test("costly lighting is sampled independently without hiding any sprites", () => {
  assert.equal(helperEffectChance({ fingers: 80, toes: 10, ghosts: 5, stickmen: 4 }), 1);
  const crowd = { fingers: 5000, toes: 1000, ghosts: 200, stickmen: 300 };
  assert.ok(helperEffectChance(crowd) > 0 && helperEffectChance(crowd) < 0.05);
  assert.equal(visibleHelperCounts(crowd).fingers, 5000);
  assert.equal(visibleHelperCounts(crowd).stickmen, 300);
  assert.equal(helperEffectChance({ fingers: 0, toes: 0, ghosts: 0, stickmen: 0 }), 1);
});

test("all finger, toe, and stickman orbit rings fit inside the canvas without top-edge clamping", () => {
  assert.equal(CY, 70); // enough headroom and room for the enlarged pedestal
  for (const kind of ["fingers", "toes", "stickmen"]) {
    for (let ring = 0; ring < 3; ring++) {
      const orbit = helperOrbitRadius(kind, ring, R);
      assert.ok(orbit > 0 && orbit < R);
      // The new anatomical sprites bake to at most 21x21 at 45 degrees.
      // drawOriented places the center an additional half sprite away.
      const spriteMax = kind === "stickmen" ? 0 : 21;
      const furthest = orbit + spriteMax + (kind === "toes" ? 1 : 0);
      for (let step = 0; step < 360; step++) {
        const angle = (step * Math.PI) / 180;
        const x = CX + Math.cos(angle) * furthest;
        const y = CY + Math.sin(angle) * furthest;
        const stickmanHalf = kind === "stickmen" ? 8 : 0;
        assert.ok(x - stickmanHalf >= 0 && x + stickmanHalf < PX, `${kind} ring ${ring} x clipped`);
        assert.ok(y - stickmanHalf >= 0 && y + stickmanHalf < PX, `${kind} ring ${ring} y clipped`);
      }
    }
  }
  assert.ok(CY + R + 14 < PX); // oversized pedestal still fits below the sphere
});

test("Prestige capacity starts independent for every helper", () => {
  assert.deepEqual(BASE_CAPACITY, { finger: 30, sparkMite: 35, copperSpider: 20, toe: 25, ghost: 20, stickman: 15 });
  assert.deepEqual(CAPACITY_STEP, { finger: 10, sparkMite: 10, copperSpider: 5, toe: 5, ghost: 5, stickman: 3 });
  const s = freshSave();
  assert.deepEqual(s.prestige.capacityLevels, { finger: 0, sparkMite: 0, copperSpider: 0, toe: 0, ghost: 0, stickman: 0 });
  for (const kind of ["finger", "sparkMite", "copperSpider", "toe", "ghost", "stickman"])
    assert.equal(helperCapacity(s, kind), BASE_CAPACITY[kind]);
  const wealthy = { ...s, plasma: { neon: 1e30, argon: 1e30, xenon: 1e30, krypton: 1e30 },
    unlocked: ["neon", "argon", "xenon", "krypton"] };
  assert.equal(bulkCost(wealthy, "finger", undefined, 1000).count, BASE_CAPACITY.finger);
  assert.equal(bulkCost(wealthy, "toe", undefined, 1000).count, BASE_CAPACITY.toe);
});

test("legacy ownership migrates without losing or locking hundreds of owned helpers", () => {
  const legacy = { ...freshSave(), v: 14, prestige: undefined,
    fingers: 800, toes: 160, ghosts: 55, stickmen: 92 };
  const s = migrateSave(legacy);
  for (const [kind, owned] of [["finger", 800], ["toe", 160], ["ghost", 55], ["stickman", 92]])
    assert.ok(helperCapacity(s, kind) >= owned, kind);
  assert.equal(s.fingers, 800);
  assert.equal(s.stickmen, 92);
  assert.equal(s.prestige.sparks, 0);
});

test("v15 old default helper caps shrink without deleting currently hired helpers", () => {
  const old = freshSave();
  old.prestige.legacyCapacity = { finger: 100, toe: 60, ghost: 40, stickman: 40 };
  old.fingers = 38;
  old.toes = 10;
  const migrated = migrateSave({ ...old, v: 15 });
  assert.equal(migrated.fingers, 38);
  assert.equal(helperCapacity(migrated, "finger"), 38);
  assert.equal(helperCapacity(migrated, "toe"), 25);
  const ready = { ...migrated, unlocked: ["neon", "argon", "xenon", "krypton"],
    total: { ...migrated.total, krypton: 2000 } };
  const restarted = performPrestige(ready);
  assert.equal(restarted.fingers, 0);
  assert.deepEqual(restarted.prestige.legacyCapacity, BASE_CAPACITY);
  assert.equal(helperCapacity(restarted, "finger"), 30);
});

test("Sparks buy permanent individual capacity without mutating existing ownership", () => {
  const s = { ...freshSave(), prestige: { ...freshSave().prestige, sparks: 12 } };
  assert.equal(capacityUpgradeCost(s, "finger"), 1);
  const raised = upgradeCapacity(s, "finger");
  assert.equal(helperCapacity(raised, "finger"), BASE_CAPACITY.finger + CAPACITY_STEP.finger);
  assert.equal(helperCapacity(raised, "toe"), BASE_CAPACITY.toe);
  assert.equal(raised.prestige.sparks, 11);
  assert.equal(capacityUpgradeCost(raised, "finger"), 4);
  assert.equal(s.prestige.sparks, 12);
  const poor = { ...raised, prestige: { ...raised.prestige, sparks: 0 } };
  assert.strictEqual(upgradeCapacity(poor, "toe"), poor);
});

test("prestige preserves lifetime statistics, permanent capacities and spendable Sparks", () => {
  const old = freshSave();
  old.unlocked = ["neon", "argon", "xenon", "krypton"];
  old.fingers = 60; old.toes = 20;
  old.plasma.krypton = 5500; old.total.krypton = 25000;
  old.crackles = 1234; old.activeSeconds = 7200; old.offlineSeconds = 3600;
  old.prestige.sparks = 2;
  old.prestige.capacityLevels.finger = 2;
  const gain = prestigeReward(old);
  assert.ok(gain > 0);
  assert.ok(runPrestigeScore(old) > 100000);
  const next = performPrestige(old);
  assert.equal(next.prestige.cycles, 1);
  assert.equal(next.prestige.sparks, 2 + gain);
  assert.equal(next.prestige.capacityLevels.finger, 2);
  assert.deepEqual(next.unlocked, ["neon"]);
  assert.equal(next.fingers, 0);
  assert.equal(next.toes, 0);
  assert.equal(next.plasma.krypton, 0);
  assert.equal(next.total.krypton, 25000);
  assert.equal(next.crackles, 1234);
  assert.equal(next.activeSeconds, 7200);
  assert.equal(next.offlineSeconds, 3600);
  assert.equal(next.prestige.lastTotal.krypton, 25000);
  // A second claim without earning more and unlocking Krypton is impossible.
  assert.strictEqual(performPrestige(next), next);
  assert.equal(prestigeReward(next), 0);
});

test("a fully capped helper purchase is blocked, but lifetime earning remains unchanged", () => {
  const s = freshSave();
  s.fingers = BASE_CAPACITY.finger;
  s.plasma.neon = 1e9;
  assert.equal(helperRoom(s, "finger"), 0);
  assert.equal(bulkCost(s, "finger", undefined, 5).count, 0);
  assert.strictEqual(purchaseUpgrade(s, "finger", undefined, 1).state, s);
  assert.ok(accrueIdle(s, 10).gain.neon > 0);
});


test("plasma noise is deterministic, organically varied and pinned to endpoints", () => {
  assert.equal(plasmaDisplacement(0, 2, 3, 4, 1), 0);
  assert.equal(plasmaDisplacement(1, 2, 3, 4, 1), 0);
  const first = Array.from({ length: 20 }, (_, i) => plasmaDisplacement((i + 1) / 21, 2, 3, 4, 1));
  const identical = Array.from({ length: 20 }, (_, i) => plasmaDisplacement((i + 1) / 21, 2, 3, 4, 1));
  assert.deepEqual(first, identical);
  assert.ok(new Set(first.map(x => x.toFixed(2))).size > 10);
  const otherArc = Array.from({ length: 20 }, (_, i) => plasmaDisplacement((i + 1) / 21, 2, 8, 4, 1));
  assert.notDeepEqual(first, otherArc);
  const nearbyFrame = plasmaDisplacement(0.4, 2.01, 3, 4, 1);
  assert.ok(Math.abs(nearbyFrame - plasmaDisplacement(0.4, 2, 3, 4, 1)) < 1);
});

test("Stickman animation visits every pose and emits one punch signal per leap", () => {
  const agent = createStickman(2, 0);
  const seen = new Set();
  let strikes = 0;
  let lastStrike = -1;
  for (let step = 0; step <= 500; step++) {
    const t = step * 0.02;
    const pose = advanceStickman(agent, t, 0.02);
    seen.add(pose.frame);
    if (pose.strike) {
      strikes++;
      assert.equal(pose.frame, "punch", "strike must be accompanied by punch art");
      assert.ok(t - lastStrike > 0.72, "at most one strike per jump");
      lastStrike = t;
    }
  }
  assert.deepEqual([...seen].sort(), ["fall", "land", "leap", "punch", "runA", "runB", "windup"].sort());
  assert.ok(strikes >= 2);
});

test("purchase preview accurately projects helper rates without changing state", () => {
  const s = { ...freshSave(), plasma: { neon: 200, argon: 0, xenon: 0, krypton: 0 } };
  const before = JSON.stringify(s);
  const preview = previewPurchaseImpact(s, "finger", undefined, 5);
  assert.match(preview.preview, /NEON\/S 0 → 0.23/);
  const bought = purchaseUpgrade(s, "finger", undefined, 5);
  assert.equal(bought.count, 5);
  assert.ok(Math.abs(idleRate(bought.state).neon - 5 * 0.1 / PRESS_INTERVAL) < 1e-10);
  assert.equal(JSON.stringify(s), before);
  assert.match(previewPurchaseImpact({ ...s, unlocked: ["neon", "argon", "xenon", "krypton"] },
    "toe", undefined, 1).preview, /KRYPTON\/S/);
  assert.equal(previewPurchaseImpact(s, "gas", undefined, 1), null);
  assert.equal(previewPurchaseImpact(s, "finger", undefined, 0), null);
});

test("Arc Split and ten-percent Voltage improvements remain visible in projected tap rates", () => {
  const s = freshSave();
  assert.match(previewPurchaseImpact(s, "filament", "neon", 1).preview, /NEON\/T 0.1 → 0.2/);
  assert.match(previewPurchaseImpact(s, "split", "neon", 1).preview, /NEON\/T 0.1 → 0.15/);
  assert.match(previewPurchaseImpact(s, "voltage", "neon", 1).preview, /0.1 → 0.11/);
  assert.equal(MAX_BULK_PURCHASE, 1000);
});

test("first Finger arrives after 20 base taps, with all later prices unchanged", () => {
  assert.equal(fingerCost(0, ["neon"]).neon, 2);
  assert.equal(fingerCost(1, ["neon"]).neon, 6);
  assert.equal(fingerCost(2, ["neon"]).neon, 7);
  const old = freshSave();
  assert.equal(old.plasma.neon, 0);
  old.plasma.neon = 2;
  assert.equal(purchaseUpgrade(old, "finger", undefined, 1).state.fingers, 1);
  assert.equal(old.fingers, 0);
});

test("purchases accumulate lifetime helper and power counters and historical peak rates", () => {
  const start = freshSave();
  start.plasma = { neon: 1e12, argon: 1e12, xenon: 1e12, krypton: 1e12 };
  start.unlocked = ["neon", "argon", "xenon", "krypton"];
  const a = purchaseUpgrade(start, "finger", undefined, 2).state;
  assert.equal(a.fingers, 2);
  assert.equal(a.lifetime.helperHires.finger, 2);
  assert.equal(start.lifetime.helperHires.finger, 0);
  assert.ok(a.lifetime.peakHelpRate.neon > 0);
  const b = purchaseUpgrade(a, "toe", undefined, 1).state;
  const c = purchaseUpgrade(b, "filament", "neon", 2).state;
  const d = purchaseUpgrade(c, "split", "argon", 1).state;
  const e = purchaseUpgrade(d, "voltage", "neon", 2).state;
  assert.equal(e.lifetime.helperHires.toe, 1);
  assert.equal(e.lifetime.purchasedArcs.neon, 2);
  assert.equal(e.lifetime.purchasedSplits.argon, 1);
  assert.equal(e.lifetime.purchasedVoltage.neon, 2);
  assert.ok(e.lifetime.peakHelpRate.neon > a.lifetime.peakHelpRate.neon);
  assert.ok(e.lifetime.peakTapPower.neon > start.lifetime.peakTapPower.neon);
  assert.equal(a.lifetime.purchasedArcs.neon, 0);
});

test("Prestige keeps lifetime purchases, peaks, production and total time", () => {
  const s = freshSave();
  s.unlocked = ["neon", "argon", "xenon", "krypton"];
  s.plasma = { neon: 1e12, argon: 1e12, xenon: 1e12, krypton: 1e12 };
  const paid = purchaseUpgrade(s, "finger", undefined, 3).state;
  paid.total.krypton = 3000;
  paid.total.neon = 120;
  paid.crackles = 130;
  paid.activeSeconds = 210;
  paid.offlineSeconds = 320;
  const reset = performPrestige(paid);
  assert.notStrictEqual(reset, paid);
  assert.equal(reset.fingers, 0);
  assert.equal(reset.lifetime.helperHires.finger, 3);
  assert.equal(reset.lifetime.runStartCrackles, 130);
  assert.equal(reset.lifetime.runStartActiveSeconds, 210);
  assert.equal(reset.lifetime.runStartOfflineSeconds, 320);
  assert.deepEqual(reset.lifetime.peakHelpRate, paid.lifetime.peakHelpRate);
  assert.equal(reset.total.krypton, 3000);
  assert.equal(reset.crackles, 130);
  assert.equal(reset.activeSeconds, 210);
  const subsequent = { ...reset, plasma: { ...reset.plasma, neon: 2 } };
  const hired = purchaseUpgrade(subsequent, "finger", undefined, 1).state;
  assert.equal(hired.lifetime.helperHires.finger, 4);
  assert.equal(hired.fingers, 1);
});

test("v15 migration preserves observed counters but cannot invent prior reset totals", () => {
  const s = freshSave();
  s.fingers = 6;
  s.toes = 2;
  s.filaments.neon = 3;
  s.splits.neon = 1;
  s.voltage.neon = 14;
  s.total.neon = 45678;
  s.crackles = 678;
  s.activeSeconds = 234;
  s.prestige.cycles = 4;
  const { lifetime, ...old } = s;
  const restored = migrateSave({ ...old, v: 15 });
  assert.equal(restored.lifetime.helperHires.finger, 6);
  assert.equal(restored.lifetime.helperHires.toe, 2);
  assert.equal(restored.lifetime.purchasedArcs.neon, 3);
  assert.equal(restored.lifetime.purchasedSplits.neon, 1);
  assert.equal(restored.lifetime.purchasedVoltage.neon, 0);
  assert.equal(restored.lifetime.legacyVoltagePurchases.neon, 14);
  assert.equal(restored.legacyVoltage.neon, 14);
  assert.equal(restored.lifetime.runStartCrackles, 678);
  assert.equal(restored.lifetime.runStartActiveSeconds, 234);
  assert.equal(restored.total.neon, 45678);
  assert.ok(restored.lifetime.peakTapPower.neon > 0.1);
});

test("v17 lifetime history survives real save and reload without resetting save keys", () => withStorage((items) => {
  let s = freshSave();
  s.plasma.neon = 100;
  s = purchaseUpgrade(s, "finger", undefined, 2).state;
  assert.equal(persist(s), true);
  const stored = JSON.parse(items.get(SAVE_KEY));
  assert.equal(stored.v, 18);
  assert.equal(loadSave().lifetime.helperHires.finger, 2);
  assert.equal(loadSave().fingers, 2);
  assert.equal(loadSave().lifetime.peakHelpRate.neon, s.lifetime.peakHelpRate.neon);
}));

test("Voltage uses 20 additive ten-percent levels with per-gas pricing", () => {
  assert.equal(MAX_VOLT_LEVELS, 20);
  assert.equal(VOLT_LEVEL_BONUS, 0.10);
  assert.deepEqual([0, 1, 2, 4, 9, 19].map(level => voltageCost("neon", level).neon),
    [8, 10, 13, 20, 60, 556]);
  assert.equal(voltageCost("argon", 0).argon, 20);
  assert.equal(voltageCost("xenon", 0).xenon, 60);
  assert.equal(voltageCost("krypton", 0).krypton, 140);
  assert.ok(Math.abs(voltMult(10) - 2) < 1e-12);
  assert.ok(Math.abs(voltMult(20) - 3) < 1e-12);
  assert.ok(Math.abs(voltMult(1, 1000) - 1.21) < 1e-12);
  const wealthy = freshSave();
  wealthy.plasma.neon = 1e8;
  const quote = bulkCost(wealthy, "voltage", "neon", 100);
  assert.equal(quote.count, 20);
  assert.equal(quote.cost.neon, 2754);
  const result = purchaseUpgrade(wealthy, "voltage", "neon", 100).state;
  assert.equal(result.voltage.neon, 20);
  assert.equal(result.lifetime.purchasedVoltage.neon, 20);
  assert.equal(result.legacyVoltage.neon, 0);
  assert.ok(Math.abs(cracklePower({ id: "neon", baseRate: 0.1 }, result) - 0.3) < 1e-12);
  assert.equal(bulkCost(result, "voltage", "neon", 1).count, 0);
  assert.equal(purchaseUpgrade(result, "voltage", "neon", 1).state, result);
});

test("v16 Voltage migration retains old exact output and separates lifetime step history", () => {
  const s = freshSave();
  s.voltage.neon = 1000; // old 0.1000V = x1.10
  s.filaments.neon = 2;
  s.splits.neon = 1;
  s.lifetime.purchasedVoltage.neon = 1200;
  s.fingers = 3;
  s.plasma.neon = 2000;
  const migrated = migrateSave({ ...s, v: 16 });
  assert.equal(migrated.voltage.neon, 0);
  assert.equal(migrated.legacyVoltage.neon, 1000);
  assert.equal(migrated.lifetime.legacyVoltagePurchases.neon, 1200);
  assert.equal(migrated.lifetime.purchasedVoltage.neon, 0);
  assert.equal(migrated.plasma.neon, 2000);
  assert.ok(Math.abs(cracklePower({ id: "neon", baseRate: 0.1 }, migrated) -
    0.1 * 3 * 1.1 * 1.5) < 1e-12);
  const again = migrateSave({ ...migrated, v: 17 });
  assert.equal(again.legacyVoltage.neon, 1000);
  assert.equal(again.voltage.neon, 0);
  assert.equal(again.lifetime.legacyVoltagePurchases.neon, 1200);
  const next = purchaseUpgrade(again, "voltage", "neon", 1).state;
  assert.equal(next.voltage.neon, 1);
  assert.equal(next.lifetime.purchasedVoltage.neon, 1);
  assert.equal(next.lifetime.legacyVoltagePurchases.neon, 1200);
  assert.ok(Math.abs(cracklePower({ id: "neon", baseRate: 0.1 }, next) -
    0.1 * 3 * 1.1 * 1.5 * 1.1) < 1e-12);
});

test("Prestige resets legacy micro-volts and new levels but preserves both lifetime records", () => {
  const s = freshSave();
  s.unlocked = ["neon", "argon", "xenon", "krypton"];
  s.total.krypton = 3000;
  s.legacyVoltage.neon = 1000;
  s.lifetime.legacyVoltagePurchases.neon = 1400;
  s.plasma.neon = 1000;
  const bought = purchaseUpgrade(s, "voltage", "neon", 2).state;
  const next = performPrestige(bought);
  assert.equal(next.voltage.neon, 0);
  assert.equal(next.legacyVoltage.neon, 0);
  assert.equal(next.lifetime.purchasedVoltage.neon, 2);
  assert.equal(next.lifetime.legacyVoltagePurchases.neon, 1400);
  assert.equal(next.lifetime.peakTapPower.neon, bought.lifetime.peakTapPower.neon);
  assert.ok(Math.abs(voltMult(next.voltage.neon, next.legacyVoltage.neon) - 1) < 1e-12);
});

test("first legacy Voltage load stores an untouched snapshot through later autosaves", () => withStorage((items) => {
  const prior = freshSave();
  prior.voltage.neon = 1234;
  prior.lifetime.purchasedVoltage.neon = 3456;
  const raw = JSON.stringify({ ...prior, v: 16 });
  items.set(SAVE_KEY, raw);
  const migrated = loadSave();
  assert.equal(migrated.legacyVoltage.neon, 1234);
  assert.equal(migrated.lifetime.legacyVoltagePurchases.neon, 3456);
  assert.equal(items.get(PRE_VOLTAGE_BACKUP_KEY), raw);
  assert.equal(persist(migrated), true);
  assert.equal(persist({ ...migrated, fingers: 3 }), true);
  assert.equal(loadSave().legacyVoltage.neon, 1234);
  assert.equal(items.get(PRE_VOLTAGE_BACKUP_KEY), raw);
  assert.equal(JSON.parse(items.get(SAVE_KEY)).v, 18);
  resetSave();
  assert.equal(items.has(PRE_VOLTAGE_BACKUP_KEY), false);
}));

test("new Voltage levels visibly improve tap rate previews and migrate legacy modifiers", () => {
  const base = freshSave();
  assert.match(previewPurchaseImpact(base, "voltage", "neon", 1).preview, /0.1 → 0.11/);
  const upgraded = purchaseUpgrade({ ...base, plasma: { ...base.plasma, neon: 100 } },
    "voltage", "neon", 2).state;
  assert.equal(upgraded.voltage.neon, 2);
  assert.match(previewPurchaseImpact(upgraded, "voltage", "neon", 1).preview, /0.12 → 0.13/);
  const old = migrateSave({ ...base, voltage: { ...base.voltage, neon: 1000 }, v: 16 });
  assert.match(previewPurchaseImpact(old, "voltage", "neon", 1).preview, /0.11 → 0.121/);
});

test("helper catalog preserves v0.12.26 prices at early and mixed-currency thresholds", async () => {
  const { HELPER_CATALOG, HELPER_IDS, helperCost, helperDefinition, helperOwned,
    helperUnlocked, isHelperId } = await import("../src/game/helpers.ts");
  const { fingerCost, toeCost, ghostCost, stickmanCost, buyMsg } = await import("../src/game/economy.ts");
  const { GAS_LIST } = await import("../src/game/gases.ts");
  assert.deepEqual(HELPER_IDS, ["finger", "sparkMite", "copperSpider", "toe", "ghost", "stickman"]);
  assert.deepEqual(HELPER_CATALOG.filter(h => ["finger", "toe", "ghost", "stickman"].includes(h.id)).map(h => h.nativeGas), GAS_LIST.map(g => g.id));
  const gasSets = [
    ["neon"],
    ["neon", "argon"],
    ["neon", "argon", "xenon"],
    ["neon", "argon", "xenon", "krypton"],
  ];
  for (const unlocked of gasSets) {
    for (const n of [0, 1, 2, 11, 12, 24, 25, 39, 40, 49]) {
      const finger = { neon: n === 0 ? 2 : Math.ceil(5 * 1.18 ** n) };
      if (n >= 12 && unlocked.includes("argon")) finger.argon = Math.ceil(3 * 1.15 ** n);
      if (n >= 25 && unlocked.includes("xenon")) finger.xenon = Math.ceil(2 * 1.12 ** n);
      if (n >= 40 && unlocked.includes("krypton")) finger.krypton = Math.ceil(1.10 ** n);
      const toe = { argon: Math.ceil(15 * 1.3 ** n) };
      if (n >= 12) toe.neon = Math.ceil(8 * 1.15 ** n);
      if (n >= 25 && unlocked.includes("xenon")) toe.xenon = Math.ceil(4 * 1.12 ** n);
      if (n >= 40 && unlocked.includes("krypton")) toe.krypton = Math.ceil(2 * 1.10 ** n);
      assert.deepEqual(fingerCost(n, unlocked), finger);
      assert.deepEqual(helperCost("finger", n, unlocked), finger);
      assert.deepEqual(toeCost(n, unlocked), toe);
      assert.deepEqual(helperCost("toe", n, unlocked), toe);
      assert.deepEqual(ghostCost(n), { xenon: Math.ceil(80 * 1.45 ** n) });
      assert.deepEqual(stickmanCost(n), { krypton: Math.ceil(120 * 1.5 ** n) });
    }
  }
  assert.deepEqual(HELPER_CATALOG.map(h => h.power), [1, 3, 12, 8, 20, 45]);
  assert.deepEqual(HELPER_CATALOG.map(h => h.baseCapacity), [30, 35, 20, 25, 20, 15]);
  assert.deepEqual(HELPER_CATALOG.map(h => h.capacityStep), [10, 10, 5, 5, 5, 3]);
  assert.deepEqual([1, 2].map(n => buyMsg("finger", undefined, n)),
    ["+1 FINGER HIRED", "+2 FINGERS HIRED"]);
  assert.deepEqual([1, 2].map(n => buyMsg("toe", undefined, n)),
    ["+1 FOOT HIRED", "+2 FEET HIRED"]);
  assert.deepEqual([1, 2].map(n => buyMsg("ghost", undefined, n)),
    ["+1 GHOST HAND", "+2 GHOST HANDS"]);
  assert.deepEqual([1, 2].map(n => buyMsg("stickman", undefined, n)),
    ["+1 STICKMAN", "+2 STICKMEN"]);
  assert.equal(isHelperId("finger"), true);
  assert.equal(isHelperId("voltage"), false);
  const fresh = freshSave();
  assert.equal(helperOwned(fresh, "finger"), fresh.fingers);
  assert.equal(helperUnlocked(fresh, "toe"), false);
  assert.equal(helperUnlocked({ ...fresh, unlocked: ["neon", "argon"] }, "toe"), true);
  assert.equal(helperDefinition("toe").statsLabel, "BIG TOES");
});

test("catalog purchase and Prestige retain exact save fields, balances and lifetime history", () => {
  const saved = freshSave();
  saved.unlocked = ["neon", "argon", "xenon", "krypton"];
  saved.plasma = { neon: 5e10, argon: 5e10, xenon: 5e10, krypton: 5e10 };
  let current = saved;
  const amounts = [["finger", 5], ["toe", 4], ["ghost", 3], ["stickman", 2]];
  const fields = ["fingers", "toes", "ghosts", "stickmen"];
  for (let i = 0; i < amounts.length; i++) {
    const [kind, count] = amounts[i];
    const pre = bulkCost(current, kind, undefined, count);
    assert.equal(pre.count, count);
    const before = { ...current.plasma };
    const old = current;
    const next = purchaseUpgrade(current, kind, undefined, count);
    assert.equal(next.count, count);
    assert.equal(next.state[fields[i]], count);
    assert.equal(next.state.lifetime.helperHires[kind], count);
    for (const gas of Object.keys(before))
      assert.equal(next.state.plasma[gas], before[gas] - (pre.cost[gas] ?? 0));
    assert.equal(JSON.stringify(old), JSON.stringify(current));
    current = next.state;
  }
  const expectedHelp = (5 * 1 + 4 * 8 + 3 * 20 + 2 * 45) * 0.1 / 2.2;
  assert.ok(Math.abs(idleRate(current).neon - expectedHelp) < 1e-10);
  assert.equal(helperCapacity(current, "finger"), 30);
  current.total.krypton = 3000;
  const reset = performPrestige(current);
  assert.notStrictEqual(reset, current);
  for (const field of fields) assert.equal(reset[field], 0);
  assert.deepEqual(reset.lifetime.helperHires, current.lifetime.helperHires);
  const reloaded = migrateSave({ ...reset, v: 17 });
  assert.deepEqual(reloaded.lifetime.helperHires, current.lifetime.helperHires);
  assert.equal(reloaded.voltage.neon, 0);
});

test("Neon helpers unlock in sequence, cannot be purchased early, and retain old helper rates", async () => {
  const { helperCost, helperVisible, helperUnlocked } = await import("../src/game/helpers.ts");
  const s = freshSave();
  s.plasma.neon = 1e7;
  assert.equal(helperVisible(s, "sparkMite"), false);
  assert.equal(helperVisible(s, "copperSpider"), false);
  assert.equal(bulkCost(s, "sparkMite", undefined, 1).count, 0);
  assert.equal(bulkCost(s, "copperSpider", undefined, 1).count, 0);
  assert.deepEqual(helperCost("sparkMite", 0, ["neon"]), { neon: 40 });
  assert.deepEqual(helperCost("sparkMite", 1, ["neon"]), { neon: 52 });
  assert.deepEqual(helperCost("copperSpider", 0, ["neon"]), { neon: 350 });
  assert.deepEqual(helperCost("copperSpider", 1, ["neon"]), { neon: 483 });
  let a = purchaseUpgrade(s, "finger", undefined, 1).state;
  assert.equal(helperUnlocked(a, "sparkMite"), true);
  assert.equal(helperVisible(a, "copperSpider"), false);
  a = purchaseUpgrade(a, "sparkMite", undefined, 2).state;
  assert.equal(a.sparkMites, 2);
  assert.equal(a.lifetime.helperHires.sparkMite, 2);
  assert.equal(helperUnlocked(a, "copperSpider"), true);
  a = purchaseUpgrade(a, "copperSpider", undefined, 1).state;
  assert.equal(a.copperSpiders, 1);
  assert.equal(a.lifetime.helperHires.copperSpider, 1);
  assert.ok(Math.abs(idleRate(a).neon -
    (1 + 2 * 3 + 12) * 0.1 / PRESS_INTERVAL) < 1e-10);
  assert.equal(s.fingers, 0);
  assert.equal(s.sparkMites, 0);
  assert.equal(s.copperSpiders, 0);
});

test("Neon Mastery depends on lifetime-earned Neon this run and one purchased Spider", async () => {
  const { NEON_MASTERY_REQUIRED, ARGON_MASTER_PRICE, neonProducedThisRun, neonChapterComplete,
    neonMasteryProgress } = await import("../src/game/mastery.ts");
  assert.equal(NEON_MASTERY_REQUIRED, 6000);
  assert.equal(ARGON_MASTER_PRICE, 1800);
  const s = freshSave();
  s.plasma.neon = 1e7;
  assert.equal(bulkCost(s, "gas", undefined, 1).count, 0, "currency alone does not bypass Mastery");
  assert.equal(neonMasteryProgress(s), 0);
  s.total.neon = 6000;
  assert.equal(neonMasteryProgress(s), 100);
  assert.equal(neonChapterComplete(s), false, "Spider required");
  let current = purchaseUpgrade(s, "finger", undefined, 1).state;
  current = purchaseUpgrade(current, "sparkMite", undefined, 1).state;
  current = purchaseUpgrade(current, "copperSpider", undefined, 1).state;
  assert.equal(neonChapterComplete(current), true);
  assert.equal(bulkCost(current, "gas", undefined, 1).count, 1);
  assert.equal(bulkCost(current, "gas", undefined, 1).cost.neon, 1800);
  assert.equal(neonProducedThisRun(current), 6000);
  const gas = purchaseUpgrade(current, "gas", undefined, 1);
  assert.equal(gas.state.unlocked.includes("argon"), true);
  assert.equal(gas.state.plasma.neon, current.plasma.neon - 1800);
  assert.equal(s.unlocked.length, 1);
  const spent = { ...current, plasma: { ...current.plasma, neon: 1800 } };
  assert.equal(neonMasteryProgress(spent), 100, "spending must not reduce Mastery");
  const nextRun = { ...current, prestige: { ...current.prestige,
    lastTotal: { ...current.prestige.lastTotal, neon: 1500 } } };
  assert.equal(neonProducedThisRun(nextRun), 4500);
  assert.equal(bulkCost(nextRun, "gas", undefined, 1).count, 0);
});

test("v17 migration retains existing plasma, gases, power and legacy helper records", () => {
  const old = freshSave();
  old.plasma = { neon: 1234, argon: 567, xenon: 89, krypton: 1 };
  old.unlocked = ["neon", "argon", "xenon"];
  old.total.neon = 12000;
  old.fingers = 8;
  old.toes = 3;
  old.voltage.neon = 4;
  old.prestige.capacityLevels.finger = 2;
  old.lifetime.helperHires.finger = 48;
  const { sparkMites, copperSpiders, ...legacy } = old;
  void sparkMites; void copperSpiders;
  const saved = { ...legacy, v: 17, prestige: { ...legacy.prestige,
    capacityLevels: { finger: 2, toe: 0, ghost: 0, stickman: 0 },
    legacyCapacity: { finger: 30, toe: 25, ghost: 20, stickman: 15 } },
    lifetime: { ...legacy.lifetime,
      helperHires: { finger: 48, toe: 3, ghost: 0, stickman: 0 } },
  };
  const restored = migrateSave(saved);
  assert.deepEqual(restored.plasma, old.plasma);
  assert.deepEqual(restored.unlocked, old.unlocked);
  assert.equal(restored.fingers, 8);
  assert.equal(restored.toes, 3);
  assert.equal(restored.sparkMites, 0);
  assert.equal(restored.copperSpiders, 0);
  assert.equal(restored.lifetime.helperHires.finger, 48);
  assert.equal(restored.lifetime.helperHires.sparkMite, 0);
  assert.equal(restored.prestige.capacityLevels.finger, 2);
  assert.equal(restored.voltage.neon, 4);
  assert.ok(Math.abs(idleRate(restored).neon -
    (8 + 3 * 8) * 0.1 * (1 + restored.voltage.neon * 0.1) / PRESS_INTERVAL) < 1e-10);
});

test("v18 saves preserve both Neon helper counts, lifetime hires and Prestige reset", () => {
  const s = freshSave();
  s.unlocked = ["neon", "argon", "xenon", "krypton"];
  s.total.krypton = 3000;
  s.total.neon = 100000;
  s.plasma.neon = 1e7;
  s.fingers = 1;
  s.sparkMites = 3;
  s.copperSpiders = 2;
  s.lifetime.helperHires.sparkMite = 7;
  s.lifetime.helperHires.copperSpider = 4;
  const restored = migrateSave({ ...s, v: 18 });
  assert.equal(restored.sparkMites, 3);
  assert.equal(restored.copperSpiders, 2);
  assert.equal(restored.lifetime.helperHires.sparkMite, 7);
  assert.equal(restored.lifetime.helperHires.copperSpider, 4);
  const reset = performPrestige(restored);
  assert.equal(reset.sparkMites, 0);
  assert.equal(reset.copperSpiders, 0);
  assert.equal(reset.lifetime.helperHires.sparkMite, 7);
  assert.equal(reset.lifetime.helperHires.copperSpider, 4);
  assert.equal(reset.unlocked.length, 1);
  assert.ok(reset.prestige.cycles > 0);
});



test("old helper save has a protected original snapshot through repeated autosaves", () => withStorage((items) => {
  const old = freshSave();
  const raw = JSON.stringify({ ...old, fingers: 7, v: 17 });
  items.set(SAVE_KEY, raw);
  const migrated = loadSave();
  assert.equal(migrated.fingers, 7);
  assert.equal(migrated.sparkMites, 0);
  assert.equal(migrated.copperSpiders, 0);
  assert.equal(items.get(PRE_HELPER_BACKUP_KEY), raw);
  assert.equal(persist(migrated), true);
  assert.equal(persist({ ...migrated, fingers: 9 }), true);
  assert.equal(items.get(PRE_HELPER_BACKUP_KEY), raw);
  const current = JSON.parse(items.get(SAVE_KEY));
  assert.equal(current.v, 18);
  assert.equal(loadSave().fingers, 9);
  resetSave();
  assert.equal(items.has(PRE_HELPER_BACKUP_KEY), false);
}));
