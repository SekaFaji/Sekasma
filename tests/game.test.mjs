import test from "node:test";
import assert from "node:assert/strict";
import { accrueIdle, accrueOffline, bulkCost, cappedOfflineSeconds, fingerCost, purchaseUpgrade } from "../src/game/economy.ts";
import { OFFLINE_CAP_S, HELPER_POWER, PRESS_INTERVAL } from "../src/game/config.ts";
import { BACKUP_KEY, LEGACY_V9_KEY, SAVE_KEY, freshSave, loadSave, migrateSave, persist, resetSave } from "../src/game/save.ts";
import { measureTick } from "../src/game/timing.ts";
import { visibleHelperCount, visibleHelperCounts, helperOrbitRadius, helperEffectChance } from "../src/render/limits.ts";
import { advanceStickman, createStickman } from "../src/render/stickmen.ts";
import { PX, CX, CY, R } from "../src/render/geometry.ts";
import { plasmaDisplacement } from "../src/render/plasma.ts";
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
  const initial = { ...freshSave(), plasma: { neon: 600, argon: 0, xenon: 0, krypton: 0 } };
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
  assert.equal(state.voltage.neon, 99999);
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
  assert.deepEqual(BASE_CAPACITY, { finger: 30, toe: 25, ghost: 20, stickman: 15 });
  assert.deepEqual(CAPACITY_STEP, { finger: 10, toe: 5, ghost: 5, stickman: 3 });
  const s = freshSave();
  assert.deepEqual(s.prestige.capacityLevels, { finger: 0, toe: 0, ghost: 0, stickman: 0 });
  for (const kind of ["finger", "toe", "ghost", "stickman"])
    assert.equal(helperCapacity(s, kind), BASE_CAPACITY[kind]);
  const wealthy = { ...s, plasma: { neon: 1e30, argon: 1e30, xenon: 1e30, krypton: 1e30 } };
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
