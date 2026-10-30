import test from "node:test";
import assert from "node:assert/strict";
import { accrueIdle, bulkCost, cappedOfflineSeconds, fingerCost, purchaseUpgrade } from "../src/game/economy.ts";
import { OFFLINE_CAP_S } from "../src/game/config.ts";
import { freshSave, migrateSave } from "../src/game/save.ts";
import { visibleHelperCount } from "../src/render/limits.ts";

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
  const initial = { ...freshSave(), plasma: { neon: 1000, argon: 0, xenon: 0 } };
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
  const initial = { ...freshSave(), plasma: { neon: 600, argon: 0, xenon: 0 } };
  const { state, count } = purchaseUpgrade(initial, "gas", undefined, 100);
  assert.equal(count, 1);
  assert.deepEqual(state.unlocked, ["neon", "argon"]);
  assert.equal(state.plasma.neon, 0);
});

test("legacy save validation prevents invalid currencies and progression", () => {
  const state = migrateSave({
    ...freshSave(), v: 11, activeSeconds: -50,
    plasma: { neon: -100, argon: Infinity, xenon: 3 },
    voltage: { neon: 999999999, argon: -7, xenon: 0 },
    filaments: { neon: 999, argon: 1, xenon: 0 },
    splits: { neon: 999, argon: 0, xenon: 0 },
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

test("visual helper caps never limit economy ownership or income", () => {
  const s = { ...freshSave(), fingers: 5000, toes: 100, ghosts: 30, unlocked: ["neon", "argon", "xenon"] };
  const earned = accrueIdle(s, 10).gain.neon;
  assert.ok(earned > accrueIdle({ ...s, fingers: 20, toes: 12, ghosts: 10 }, 10).gain.neon);
  assert.equal(visibleHelperCount(s.fingers, "fingers"), 20);
  assert.equal(visibleHelperCount(s.toes, "toes"), 12);
  assert.equal(visibleHelperCount(s.ghosts, "ghosts"), 10);
  assert.equal(visibleHelperCount(-10, "fingers"), 0);
});
