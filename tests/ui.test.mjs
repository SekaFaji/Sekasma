import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { affordabilityPercent } from "../src/utils/progress.ts";

const plasma = (neon) => ({ neon, argon: 0, xenon: 0 });
let server;
let UpgradeRow;
let App;
let OptionsPanel;
let UpgradePanel;
let CurrencyHeader;
let WelcomeBack;
let StatsPanel;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  ({ default: UpgradeRow } = await server.ssrLoadModule("/src/components/UpgradeRow.tsx"));
  ({ default: App } = await server.ssrLoadModule("/src/App.tsx"));
  ({ default: OptionsPanel } = await server.ssrLoadModule("/src/components/OptionsPanel.tsx"));
  ({ default: UpgradePanel } = await server.ssrLoadModule("/src/components/UpgradePanel.tsx"));
  ({ default: CurrencyHeader } = await server.ssrLoadModule("/src/components/CurrencyHeader.tsx"));
  ({ default: WelcomeBack } = await server.ssrLoadModule("/src/components/WelcomeBack.tsx"));
  ({ default: StatsPanel } = await server.ssrLoadModule("/src/components/StatsPanel.tsx"));
});
after(async () => { if (server) await server.close(); });

test("mixed gas prices use the least-funded requirement", () => {
  assert.equal(affordabilityPercent({ neon: 100, argon: 20 }, { neon: 80, argon: 5, xenon: 0 }), 25);
  assert.equal(affordabilityPercent({ neon: 100 }, plasma(50)), 50);
  assert.equal(affordabilityPercent({ neon: 100 }, plasma(1000)), 100);
  assert.equal(affordabilityPercent({ neon: 100 }, plasma(0)), 0);
  assert.equal(affordabilityPercent({}, plasma(0)), 100);
});

test("unaffordable upgrade embeds one accessible compact progress meter", () => {
  const html = renderToStaticMarkup(React.createElement(UpgradeRow, {
    name: "FINGER", sub: "PRESSES ALL GASES", icon: "F", onBuy() {},
    cost: {}, nextCost: { neon: 100 }, plasma: plasma(40), disabled: true,
  }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="40"/);
  assert.match(html, /40%/);
  assert.equal((html.match(/<button/g) ?? []).length, 1);
});

test("gas-locked upgrade uses a locked label without a useless 0% bar", () => {
  const html = renderToStaticMarkup(React.createElement(UpgradeRow, {
    name: "GHOST HAND", sub: "UNLOCKS WITH XENON GAS",
    icon: "G", cost: { xenon: 80 }, unlockCost: { neon: 100 }, onBuy() {}, disabled: true, locked: true, plasma: plasma(35),
  }));
  assert.match(html, /LOCKED/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="35"/);
  assert.ok(html.includes("w-[65px]"));
});

test("affordable upgrades keep a readable price without progress bars", () => {
  const html = renderToStaticMarkup(React.createElement(UpgradeRow, {
    name: "FINGER", sub: "PRESSES ALL GASES",
    icon: "F", cost: { neon: 5 }, onBuy() {}, disabled: false, plasma: plasma(100),
  }));
  assert.match(html, /FINGER/);
  assert.doesNotMatch(html, /role="progressbar"/);
});

test("app renders navigation and upgrade cards with genuine React markup", () => {
  const html = renderToStaticMarkup(React.createElement(App));
  assert.match(html, /UPGRADES/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /FINGER/);
  assert.match(html, /SEKASMA/);
});

test("settings show a neutral initial reset action and accessible pressed states", () => {
  const html = renderToStaticMarkup(React.createElement(OptionsPanel, {
    scanlines: true, buzz: false, confirmReset: false,
    onToggleScanlines() {}, onToggleBuzz() {}, onReset() {}, onCancelReset() {},
  }));
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /RESET SAVE/);
  assert.doesNotMatch(html, /CONFIRM RESET/);
});

test("reset confirmation offers distinct cancel and confirm actions", () => {
  const html = renderToStaticMarkup(React.createElement(OptionsPanel, {
    scanlines: true, buzz: true, confirmReset: true,
    onToggleScanlines() {}, onToggleBuzz() {}, onReset() {}, onCancelReset() {},
  }));
  assert.match(html, /RESET ALL SAVED PROGRESS/);
  assert.match(html, /CANCEL/);
  assert.match(html, /CONFIRM RESET/);
  assert.match(html, /role="group"/);
});

test("upgrade category tabs expose their selected states", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const html = renderToStaticMarkup(React.createElement(UpgradePanel, {
    state: freshSave(), unlockedGases: [gasById("neon")], accent: "#f582aa",
    upTab: "help", onUpTabChange() {}, quantities: {}, onQuantityChange() {}, onBuy() {},
  }));
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-controls="upgrade-panel-help"/);
});

test("currency header keeps gas totals in distinct, wrapping cards", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { GAS_LIST } = await import("../src/game/gases.ts");
  const state = { ...freshSave(), unlocked: ["neon", "argon", "xenon"] };
  const html = renderToStaticMarkup(React.createElement(CurrencyHeader, {
    state, gases: GAS_LIST, rates: { neon: 0, argon: 0, xenon: 0 },
  }));
  assert.match(html, /sekasma-currency-rail/);
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 3);
  for (const name of ["NEON", "ARGON", "XENON"]) assert.match(html, new RegExp(name));
  assert.equal((html.match(/sekasma-currency-value/g) ?? []).length, 3);
  assert.doesNotMatch(html, /truncate/);
});

test("app exposes a flexible ball area and a separate scrollable upgrades panel", () => {
  const html = renderToStaticMarkup(React.createElement(App));
  assert.match(html, /sekasma-ball-area/);
  assert.match(html, /sekasma-ball-canvas/);
  assert.match(html, /sekasma-panel-shell/);
  assert.match(html, /sekasma-scroll/);
});

test("every repeatable upgrade exposes per-row quantity choices and a fixed BUY action", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const state = freshSave();
  const html = renderToStaticMarkup(React.createElement(UpgradePanel, {
    state, unlockedGases: [gasById("neon")], accent: "#f582aa",
    upTab: "help", onUpTabChange() {}, quantities: { finger: 10 },
    onQuantityChange() {}, onBuy() {},
  }));
  assert.match(html, /aria-label="FINGER quantity"/);
  for (const value of ["1", "5", "10", "100", "max"]) {
    const label = value === "max" ? "Buy maximum FINGER" : `Buy ${value} FINGER`;
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /aria-pressed="true"/);
  assert.ok(html.includes('w-[65px]'));
  const header = renderToStaticMarkup(React.createElement(CurrencyHeader, {
    state, gases: [gasById("neon")], rates: plasma(0),
  }));
  assert.doesNotMatch(header, /Bulk buy quantity/);
});

test("unaffordable but available upgrades retain an unobtrusive 0% meter", () => {
  const html = renderToStaticMarkup(React.createElement(UpgradeRow, {
    name: "FINGER", sub: "ALL GASES", icon: "F", onBuy() {},
    cost: {}, nextCost: { neon: 100 }, plasma: plasma(0), disabled: true,
  }));
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, /0%/);
  assert.ok(html.includes("h-[2px]"));
});

test("original HELP, GAS and POWER upgrades remain visible", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const state = freshSave();
  const shared = { state, unlockedGases: [gasById("neon")], accent: "#f582aa",
    onUpTabChange() {}, quantities: {}, onQuantityChange() {}, onBuy() {} };
  const help = renderToStaticMarkup(React.createElement(UpgradePanel, { ...shared, upTab: "help" }));
  const gas = renderToStaticMarkup(React.createElement(UpgradePanel, { ...shared, upTab: "gas" }));
  const power = renderToStaticMarkup(React.createElement(UpgradePanel, { ...shared, upTab: "power" }));
  for (const label of ["FINGER", "BIG TOE", "GHOST HAND"]) assert.match(help, new RegExp(label));
  assert.match(gas, /ARGON GAS/);
  for (const label of ["NEON ARC", "NEON VOLTS", "NEON SPLIT"]) assert.match(power, new RegExp(label));
});

test("welcome-back takeover displays time away and actual earned gases, including zero", () => {
  const zero = renderToStaticMarkup(React.createElement(WelcomeBack, {
    summary: { seconds: 1800, gain: plasma(0) }, onContinue() {},
  }));
  assert.match(zero, /aria-modal="true"/);
  assert.match(zero, /WELCOME BACK/);
  assert.match(zero, /30M/);
  assert.match(zero, /NO PLASMA EARNED/);
  const earned = renderToStaticMarkup(React.createElement(WelcomeBack, {
    summary: { seconds: 3600, gain: { neon: 120, argon: 5, xenon: 0 } }, onContinue() {},
  }));
  assert.match(earned, /1H 0M/);
  assert.match(earned, /\+120/);
});

test("stats distinguish cumulative time, active/online time, and capped time away", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const state = { ...freshSave(), activeSeconds: 3600, offlineSeconds: 7200 };
  const html = renderToStaticMarkup(React.createElement(StatsPanel, {
    state, unlockedGases: [gasById("neon")], rates: plasma(0),
  }));
  assert.match(html, /TOTAL PLAYTIME/);
  assert.match(html, /ACTIVE ONLINE/);
  assert.match(html, /OFFLINE PLAYTIME/);
  assert.match(html, /3H 0M/);
  assert.match(html, /2H 0M/);
  assert.match(html, /1H 0M/);
});
