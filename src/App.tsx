/**
 * Idle Plasma Ball — application shell: status bar, the ball, and a
 * tabbed panel (upgrades / stats / options) in a phone-first column.
 */
import React, { useEffect, useRef, useState } from "react";
import PlasmaBall from "./components/PlasmaBall";
import PixelIcon from "./components/PixelIcon";
import UpgradeRow from "./components/UpgradeRow";
import InfoRow from "./components/InfoRow";
import UnlockBar from "./components/UnlockBar";
import { GAS_LIST, gasById, nextGas } from "./game/gases";
import { OFFLINE_CAP_S, SPLIT_CAP, fmtVolts, splitMult, voltMult } from "./game/config";
import { bulkCost, buyMsg, canAfford, cracklePower, idleRate, pay, peekCost } from "./game/economy";
import type { BuyKind } from "./game/economy";
import { freshSave, loadOpts, loadSave, persist, saveOpts } from "./game/save";
import { fmt } from "./utils/format";
import { haptic } from "./utils/haptic";
import {
  FINGER_SPRITE,
  FOOT_SPRITE,
  GHOST_SPRITE,
  SKIN_PALETTE,
  GHOST_PALETTE,
  GAS_ICON,
  FIL_ICON,
  VOLT_ICON,
  SPLIT_ICON,
} from "./render/sprites";
import type { GasId, GasRecord, GameState } from "./game/types";

type Tab = "upgrades" | "stats" | "options";
type UpTab = "help" | "gas" | "power";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSave() ?? freshSave());
  const [offlineGain, setOfflineGain] = useState<Partial<GasRecord> | null>(null);
  const [tab, setTab] = useState<Tab>("upgrades");
  const [upTab, setUpTab] = useState<UpTab>("help");
  const [qty, setQty] = useState<number | "max">(1);
  const [scanlines, setScanlines] = useState(() => loadOpts().scan);
  const [buzz, setBuzz] = useState(() => loadOpts().buzz);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const saved = loadSave();
    if (!saved) return;
    const elapsed = Math.min((Date.now() - saved.lastSeen) / 1000, OFFLINE_CAP_S);
    const rates = idleRate(saved);
    const gain: Partial<GasRecord> = {};
    let any = false;
    for (const g of GAS_LIST) {
      const v = rates[g.id] * elapsed;
      if (v > 1) {
        gain[g.id] = v;
        any = true;
      }
    }
    if (elapsed > 60 && any) {
      setState((s) => {
        const plasma = { ...s.plasma };
        const total = { ...s.total };
        for (const [g, v] of Object.entries(gain) as [GasId, number][]) {
          plasma[g] += v;
          total[g] += v;
        }
        return { ...s, plasma, total };
      });
      setOfflineGain(gain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle income = hired fingers & feet pressing around the clock
  useEffect(() => {
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setState((s) => {
        const rates = idleRate(s);
        if (rates.neon + rates.argon + rates.xenon <= 0) return s;
        const plasma = { ...s.plasma };
        const total = { ...s.total };
        for (const g of s.unlocked) {
          plasma[g] += rates[g] * dt;
          total[g] += rates[g] * dt;
        }
        return { ...s, plasma, total };
      });
    }, 200);
    const saveIv = setInterval(() => persist(stateRef.current), 2000);
    return () => {
      clearInterval(iv);
      clearInterval(saveIv);
      persist(stateRef.current);
    };
  }, []);

  // options persist between sessions
  useEffect(() => {
    saveOpts({ scan: scanlines, buzz });
  }, [scanlines, buzz]);

  const unlockedGases = state.unlocked.map(gasById);
  const rates = idleRate(state);
  const neonGas = gasById("neon");
  const neonPow = cracklePower(neonGas, state);
  const accent = unlockedGases[unlockedGases.length - 1].color;

  const crackle = (fingerCount: number) =>
    setState((s) => {
      const plasma = { ...s.plasma };
      const total = { ...s.total };
      for (const g of GAS_LIST) {
        if (!s.unlocked.includes(g.id)) continue;
        const p = cracklePower(g, s) * fingerCount;
        plasma[g.id] += p;
        total[g.id] += p;
      }
      return { ...s, plasma, total, crackles: s.crackles + fingerCount };
    });

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 1500);
  };
  const buzzNow = (ms: number) => {
    if (buzz) haptic(ms);
  };

  const buy = (kind: BuyKind, gid?: GasId) => {
    const want = kind === "gas" ? 1 : qty === "max" ? 1000 : qty;
    const pre = bulkCost(stateRef.current, kind, gid, want);
    setState((s) => {
      const { cost, count } = bulkCost(s, kind, gid, want);
      if (count <= 0) return s;
      const next: GameState = { ...s, plasma: { ...s.plasma } };
      pay(next, cost);
      if (kind === "finger") next.fingers = s.fingers + count;
      if (kind === "toe") next.toes = s.toes + count;
      if (kind === "ghost") next.ghosts = s.ghosts + count;
      if (kind === "filament" && gid)
        next.filaments = { ...s.filaments, [gid]: s.filaments[gid] + count };
      if (kind === "voltage" && gid)
        next.voltage = { ...s.voltage, [gid]: s.voltage[gid] + count };
      if (kind === "split" && gid)
        next.splits = { ...s.splits, [gid]: s.splits[gid] + count };
      if (kind === "gas") {
        const nx = nextGas(s.unlocked);
        if (!nx) return s;
        next.unlocked = [...s.unlocked, nx.id];
      }
      return next;
    });
    if (pre.count > 0) {
      buzzNow(12);
      showToast(
        kind === "gas"
          ? `${nextGas(stateRef.current.unlocked)?.name ?? "GAS"} UNLOCKED`
          : buyMsg(kind, gid, pre.count),
      );
    }
  };

  const bulkWant = qty === "max" ? 1000 : qty;
  const fingerBuy = bulkCost(state, "finger", undefined, bulkWant);
  const toeBuy = bulkCost(state, "toe", undefined, bulkWant);
  const ghostBuy = bulkCost(state, "ghost", undefined, bulkWant);
  const argonUnlocked = state.unlocked.includes("argon");
  const xenonUnlocked = state.unlocked.includes("xenon");
  const nxGas = nextGas(state.unlocked);

  // afford dots for sub-tabs (shown only on tabs you're NOT looking at)
  const powerKinds: BuyKind[] = ["filament", "voltage", "split"];
  const subDots: Record<UpTab, boolean> = {
    help:
      fingerBuy.count > 0 || (argonUnlocked && toeBuy.count > 0) ||
      (xenonUnlocked && ghostBuy.count > 0),
    gas: !!nxGas && canAfford(state, nxGas.unlockCost),
    power: unlockedGases.some((g) => powerKinds.some((k) => bulkCost(state, k, g.id, 1).count > 0)),
  };

  const playSec = Math.floor((Date.now() - state.created) / 1000);

  return (
    <div className="flex min-h-screen justify-center bg-[#05030f] font-mono text-white select-none">
      <div className="relative flex min-h-screen w-full max-w-[400px] flex-col bg-[#08041a]">
        {scanlines && (
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
            }}
          />
        )}

        {/* status bar + currency chips */}
        <header className="border-b-2 border-white/15 bg-[#120a2e] px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] tracking-widest text-white/50">PLASMA BALL</span>
            <span className="text-[9px] tracking-widest text-white/50">
              {state.fingers} FING · {state.toes} FEET · {state.ghosts} GHO
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {unlockedGases.map((g) => (
              <div
                key={g.id}
                className="min-w-0 flex-1 border px-1.5 py-1"
                style={{ borderColor: `${g.color}44`, background: "#0d0820" }}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[8px] tracking-widest" style={{ color: g.color }}>{g.name}</span>
                  <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color: g.color }}>
                    {fmt(state.plasma[g.id])}
                  </span>
                </div>
                <div className="mt-0.5 text-[8px] tabular-nums text-white/40">
                  {fmt(cracklePower(g, state))}/TAP · {fmt(rates[g.id])}/S
                </div>
              </div>
            ))}
          </div>
        </header>

        {offlineGain !== null && (
          <button
            className="border-b-2 border-white/15 bg-[#1b1233] px-3 py-2 text-[10px] active:bg-[#241840]"
            onClick={() => setOfflineGain(null)}
          >
            THE HELP KEPT PRESSING WHILE YOU WERE AWAY:{" "}
            {(Object.entries(offlineGain) as [GasId, number][])
              .map(([g, v]) => `${fmt(v)} ${gasById(g).name}`)
              .join(" · ")}{" "}
            — TAP TO COLLECT
          </button>
        )}

        {/* the ball */}
        <div className="flex min-h-[20vh] flex-1 flex-col items-center justify-center px-4">
          <PlasmaBall
            filaments={state.filaments}
            splits={state.splits}
            unlocked={unlockedGases}
            fingers={state.fingers}
            toes={state.toes}
            crackles={state.crackles}
            neonPow={neonPow}
            buzzOn={buzz}
            ghosts={state.ghosts}
            onCrackle={crackle}
          />
        </div>

        {/* tab bar */}
        <nav className="grid grid-cols-3 border-t-2 border-white/15 bg-[#120a2e]">
          {([
            ["upgrades", "UPGRADES"],
            ["stats", "STATS"],
            ["options", "OPTIONS"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-2 text-[10px] tracking-widest active:translate-y-[1px] ${
                tab === id ? "bg-[#1b1233] text-white" : "text-white/40"
              }`}
              style={tab === id ? { borderBottom: `3px solid ${accent}` } : { borderBottom: "3px solid transparent" }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* panel — fixed height so switching tabs never moves the layout */}
        <div className="relative h-[42vh] shrink-0 overflow-y-auto bg-[#0d0820] p-2">
          {toast && (
            <div
              className="pointer-events-none absolute inset-x-2 bottom-2 z-20 border-2 px-2 py-1.5 text-center text-[9px] tracking-widest"
              style={{ borderColor: accent, color: accent, background: "#1b1233" }}
            >
              {toast}
            </div>
          )}
          {tab === "upgrades" && (
            <div className="flex flex-col gap-1.5">
              {/* sticky sub-tab + BUY bar */}
              <div className="sticky top-0 z-10 -mx-2 mb-1 bg-[#0d0820] px-2 pt-0.5">
                <div className="grid grid-cols-3 border-2 border-white/15">
                  {([
                    ["help", "HELP"],
                    ["gas", "GAS"],
                    ["power", "POWER"],
                  ] as [UpTab, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setUpTab(id)}
                      className={`py-1 text-[9px] tracking-widest active:translate-y-[1px] ${
                        upTab === id ? "bg-[#1b1233] text-white" : "text-white/40"
                      }`}
                      style={upTab === id ? { borderBottom: `2px solid ${accent}` } : { borderBottom: "2px solid transparent" }}
                    >
                      {label}
                      {upTab !== id && subDots[id] && (
                        <span className="ml-1 inline-block h-1 w-1 align-middle" style={{ background: accent }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* buy quantity selector */}
                {upTab !== "gas" && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="shrink-0 text-[8px] tracking-widest text-white/40">BUY</span>
                    {([1, 5, 10, 100, "max"] as (number | "max")[]).map((q) => (
                      <button
                        key={String(q)}
                        onClick={() => setQty(q)}
                        className={`flex-1 border py-1 text-[9px] tabular-nums active:translate-y-[1px] ${
                          qty === q ? "border-white/60 bg-[#1b1233] text-white" : "border-white/15 text-white/40"
                        }`}
                      >
                        {q === "max" ? "MAX" : `×${q}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {upTab === "help" && (
                <>
                  <UpgradeRow
                    name="FINGER"
                    sub={`PRESSES ALL GASES · OWN ${state.fingers}` +
                      (fingerBuy.count > 1 ? ` · +${fingerBuy.count}` : "")}
                    cost={fingerBuy.cost}
                    icon={<PixelIcon sprite={FINGER_SPRITE} palette={SKIN_PALETTE} px={2} />}
                    onBuy={() => buy("finger")}
                    disabled={fingerBuy.count === 0}
                    nextCost={peekCost(state, "finger")}
                  />
                  {argonUnlocked
                    ? <UpgradeRow
                        name="BIG TOE"
                        sub={`A WHOLE FOOT · PRESSES 8X HARDER · OWN ${state.toes}` +
                          (toeBuy.count > 1 ? ` · +${toeBuy.count}` : "")}
                        cost={toeBuy.cost}
                        icon={<PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />}
                        onBuy={() => buy("toe")}
                        disabled={toeBuy.count === 0}
                        color={SKIN}
                        nextCost={peekCost(state, "toe")}
                      />
                    : (
                      <React.Fragment>
                        <UpgradeRow
                          name="BIG TOE"
                          sub="UNLOCKS WITH ARGON GAS"
                          cost={{ argon: 15 }}
                          icon={<PixelIcon sprite={FOOT_SPRITE} palette={SKIN_PALETTE} px={3} />}
                          onBuy={() => {}}
                          disabled
                        />
                        <UnlockBar cost={{ argon: 15 }} color={gasById("argon").color} plasma={state.plasma} />
                      </React.Fragment>
                    )}
                  {xenonUnlocked
                    ? <UpgradeRow
                        name="GHOST HAND"
                        sub={`THE PLASMA PRESSES BACK · 20X A FINGER · OWN ${state.ghosts}` +
                          (ghostBuy.count > 1 ? ` · +${ghostBuy.count}` : "")}
                        cost={ghostBuy.cost}
                        icon={<PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />}
                        onBuy={() => buy("ghost")}
                        disabled={ghostBuy.count === 0}
                        color="#b7b2ff"
                        nextCost={peekCost(state, "ghost")}
                      />
                    : (
                      <React.Fragment>
                        <UpgradeRow
                          name="GHOST HAND"
                          sub="UNLOCKS WITH XENON GAS"
                          cost={{ xenon: 80 }}
                          icon={<PixelIcon sprite={GHOST_SPRITE} palette={GHOST_PALETTE} px={3} />}
                          onBuy={() => {}}
                          disabled
                        />
                        <UnlockBar cost={{ xenon: 80 }} color={gasById("xenon").color} plasma={state.plasma} />
                      </React.Fragment>
                    )}
                </>
              )}

              {upTab === "gas" && (
                <>
                  {unlockedGases.map((g) => (
                    <InfoRow
                      key={g.id}
                      name={`${g.name} GAS`}
                      sub={`IN THE GLASS · ${fmt(g.baseRate)} BASE/TAP · ${fmt(cracklePower(g, state))} NOW`}
                      icon={<PixelIcon sprite={GAS_ICON} color={g.color} px={3} />}
                      color={g.color}
                    />
                  ))}
                  {nxGas
                    ? (
                      <React.Fragment>
                        <UpgradeRow
                          name={`${nxGas.name} GAS`}
                          sub={`FILL THE BALL · NEW CURRENCY · ${fmt(nxGas.baseRate)}/TAP BASE`}
                          cost={nxGas.unlockCost}
                          icon={<PixelIcon sprite={GAS_ICON} color={nxGas.color} px={3} />}
                          onBuy={() => buy("gas")}
                          disabled={!canAfford(state, nxGas.unlockCost)}
                          color={nxGas.color}
                        />
                        <UnlockBar cost={nxGas.unlockCost} color={nxGas.color} plasma={state.plasma} />
                      </React.Fragment>
                    )
                    : (
                      <InfoRow
                        name="MORE GAS"
                        sub="A FUTURE BUILD MIGHT HOLD HEAVIER GASES"
                        icon={<PixelIcon sprite={GAS_ICON} color="#ffffff40" px={3} />}
                      />
                    )}
                </>
              )}

              {upTab === "power" && (
                <>
                  {unlockedGases.map((g) => {
                    const fil = state.filaments[g.id];
                    const nextPow = cracklePower(g, { ...state, filaments: { ...state.filaments, [g.id]: fil + 1 } });
                    const filBuy = bulkCost(state, "filament", g.id, bulkWant);
                    const steps = state.voltage[g.id];
                    const voltBuy = bulkCost(state, "voltage", g.id, bulkWant);
                    const spl = state.splits[g.id];
                    const splitBuy = bulkCost(state, "split", g.id, bulkWant);
                    return (
                      <React.Fragment key={g.id}>
                        <div className="mt-1 mb-0.5 px-0.5 text-[9px] font-bold tracking-widest" style={{ color: g.color }}>
                          {g.name}
                        </div>
                        <UpgradeRow
                          name={`${g.name} ARC`}
                          sub={`+1 STRING · ${fmt(cracklePower(g, state))} → ${fmt(nextPow)}/TAP · ${fil}/${g.cap}` +
                            (filBuy.count > 1 ? ` · +${filBuy.count}` : "")}
                          cost={filBuy.cost}
                          icon={<PixelIcon sprite={FIL_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("filament", g.id)}
                          disabled={filBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "filament", g.id)}
                        />
                        <UpgradeRow
                          name={`${g.name} VOLTS`}
                          sub={`+0.0001V · NOW ${fmtVolts(steps)} · X${voltMult(steps).toFixed(4)} OUTPUT` +
                            (voltBuy.count > 1 ? ` · +${voltBuy.count} STEPS` : "")}
                          cost={voltBuy.cost}
                          icon={<PixelIcon sprite={VOLT_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("voltage", g.id)}
                          disabled={voltBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "voltage", g.id)}
                        />
                        <UpgradeRow
                          name={`${g.name} SPLIT`}
                          sub={`+1 BRANCH · EACH 0.75X · NOW X${splitMult(spl).toFixed(2)} · ${spl}/${SPLIT_CAP}` +
                            (splitBuy.count > 1 ? ` · +${splitBuy.count}` : "")}
                          cost={splitBuy.cost}
                          icon={<PixelIcon sprite={SPLIT_ICON} color={g.color} px={3} />}
                          onBuy={() => buy("split", g.id)}
                          disabled={splitBuy.count === 0}
                          color={g.color}
                          nextCost={peekCost(state, "split", g.id)}
                        />
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="flex flex-col gap-1 text-[11px]">
              {[
                ["TOTAL CRACKLES", String(state.crackles)],
                ["FINGERS HIRED", String(state.fingers)],
                ["FEET HIRED", String(state.toes)],
                ["GHOST HANDS", String(state.ghosts)],
                ["TIME PLAYED", `${Math.floor(playSec / 3600)}H ${Math.floor((playSec % 3600) / 60)}M`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/10 px-1 py-1.5">
                  <span className="text-white/50">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              ))}
              {unlockedGases.map((g) => (
                <React.Fragment key={g.id}>
                  <div className="mt-1 px-1 text-[10px] font-bold" style={{ color: g.color }}>
                    {g.name}
                  </div>
                  {[
                    ["LIFETIME", fmt(state.total[g.id])],
                    ["ARCS", `${state.filaments[g.id]}/${g.cap}`],
                    ["SPLITS", `${state.splits[g.id]} BRANCHES · X${splitMult(state.splits[g.id]).toFixed(2)}`],
                    ["VOLTS", fmtVolts(state.voltage[g.id])],
                    ["VOLT STEPS", String(state.voltage[g.id])],
                    ["POWER/TAP", fmt(cracklePower(g, state))],
                    ["HELP RATE", fmt(rates[g.id]) + "/S"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-white/10 px-1 py-1.5">
                      <span className="text-white/50">{k}</span>
                      <span className="tabular-nums">{v}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}

          {tab === "options" && (
            <div className="flex flex-col gap-2 text-[11px]">
              <button
                onClick={() => setScanlines((v) => !v)}
                className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] p-2 active:translate-y-[1px]"
              >
                <span>CRT SCANLINES</span>
                <span style={{ color: scanlines ? "#61e06b" : "#ffffff40" }}>
                  {scanlines ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => setBuzz((v) => !v)}
                className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] p-2 active:translate-y-[1px]"
              >
                <span>HAPTIC BUZZ</span>
                <span style={{ color: buzz ? "#61e06b" : "#ffffff40" }}>
                  {buzz ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => {
                  if (confirmReset) {
                    setState(freshSave());
                    setConfirmReset(false);
                  } else setConfirmReset(true);
                }}
                className="border-2 p-2 active:translate-y-[1px]"
                style={{
                  borderColor: confirmReset ? "#ff5ec8" : "#ffffff40",
                  color: confirmReset ? "#ff5ec8" : "#ffffff80",
                  background: confirmReset ? "#2a1233" : "#120c26",
                }}
              >
                {confirmReset ? "TAP AGAIN TO CONFIRM RESET" : "RESET SAVE"}
              </button>
              <p className="px-1 text-[9px] leading-relaxed text-white/30">
                V11.1 · STEADY HANDS — MAX 2 PLAYER TOUCHES (NO MORE STUCK
                FINGERS), FINGERS, TOES AND GHOST HANDS NOW FACE THE BALL
                IN 8 DIRECTIONS, AND EVERY UPGRADE ALWAYS SHOWS ITS NEXT
                PRICE, AFFORDABLE OR NOT.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
