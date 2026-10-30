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

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  ({ default: UpgradeRow } = await server.ssrLoadModule("/src/components/UpgradeRow.tsx"));
  ({ default: App } = await server.ssrLoadModule("/src/App.tsx"));
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
