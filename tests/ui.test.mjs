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

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  ({ default: UpgradeRow } = await server.ssrLoadModule("/src/components/UpgradeRow.tsx"));
  ({ default: App } = await server.ssrLoadModule("/src/App.tsx"));
  ({ default: OptionsPanel } = await server.ssrLoadModule("/src/components/OptionsPanel.tsx"));
  ({ default: UpgradePanel } = await server.ssrLoadModule("/src/components/UpgradePanel.tsx"));
  ({ default: CurrencyHeader } = await server.ssrLoadModule("/src/components/CurrencyHeader.tsx"));
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
    icon: "G", cost: { xenon: 80 }, onBuy() {}, disabled: true, locked: true, plasma: plasma(0),
  }));
  assert.match(html, /LOCKED/);
  assert.doesNotMatch(html, /role="progressbar"/);
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
  assert.match(html, /PLASMA BALL/);
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

test("upgrade tabs and quantity selectors expose their selected states", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const html = renderToStaticMarkup(React.createElement(UpgradePanel, {
    state: freshSave(), unlockedGases: [gasById("neon")], accent: "#f582aa",
    upTab: "help", onUpTabChange() {}, qty: 5, onQtyChange() {}, onBuy() {},
  }));
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-controls="upgrade-panel-help"/);
});

test("currency header keeps gas totals in distinct, wrapping cards", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { GAS_LIST } = await import("../src/game/gases.ts");
  const state = { ...freshSave(), unlocked: ["neon", "argon", "xenon"] };
  const html = renderToStaticMarkup(React.createElement(CurrencyHeader, {
    state, gases: GAS_LIST, rates: { neon: 0, argon: 0, xenon: 0 },
  }));
  assert.match(html, /repeat\(3, minmax\(0, 1fr\)\)/);
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

test("upgrade category and bulk-quantity controls have 44px touch targets", async () => {
  const { freshSave } = await import("../src/game/save.ts");
  const { gasById } = await import("../src/game/gases.ts");
  const html = renderToStaticMarkup(React.createElement(UpgradePanel, {
    state: freshSave(), unlockedGases: [gasById("neon")], accent: "#f582aa",
    upTab: "help", onUpTabChange() {}, qty: 10, onQtyChange() {}, onBuy() {},
  }));
  assert.equal((html.match(/min-h-\[44px\]/g) ?? []).length, 8);
  assert.match(html, /aria-pressed="true"/);
});
