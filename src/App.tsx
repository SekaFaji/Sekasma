/**
 * Idle Plasma Ball — application shell: status bar, the ball, and a
 * tabbed panel (upgrades / stats / options) in a phone-first column.
 */
import React, { useEffect, useRef, useState } from "react";
import PlasmaBall from "./components/PlasmaBall";
import PixelIcon from "./components/PixelIcon";
import UpgradeRow from "./components/UpgradeRow";
import InfoRow from "./components/InfoRow";
import StatsPanel from "./components/StatsPanel";
import OptionsPanel from "./components/OptionsPanel";
import { GAS_LIST, gasById, nextGas } from "./game/gases";
import { SPLIT_CAP, fmtVolts, splitMult, voltMult } from "./game/config";
import { accrueIdle, bulkCost, buyMsg, canAfford, cappedOfflineSeconds, cracklePower, idleRate, peekCost, purchaseUpgrade } from "./game/economy";
import type { BuyKind } from "./game/economy";
import { freshSave, loadOpts, loadSave, persist, resetSave, saveOpts } from "./game/save";
import { measureTick } from "./game/timing";
import { fmt } from "./utils/format";
import { haptic } from "./utils/haptic";
import {
  FINGER_SPRITE,
  FOOT_SPRITE,
  GHOST_SPRITE,
  GAS_ICON,
  FIL_ICON,
  VOLT_ICON,
  SPLIT_ICON,
} from "./render/sprites";
import { SKIN, SKIN_PALETTE, GHOST_PALETTE } from "./render/palette";
import type { GasId, GasRecord, GameState } from "./game/types";

type Tab = "upgrades" | "stats" | "options";
type UpTab = "help" | "gas" | "power";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSave() ?? freshSave());
  const [offlineGain, setOfflineGain] = useState<Partial<GasRecord> | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [tab, setTab] = useState<Tab>("upgrades");
  const [upTab, setUpTab] = useState<UpTab>("help");
  const [qty, setQty] = useState<number | "max">(1);
  const [scanlines, setScanlines] = useState(() => loadOpts().scan);
  const [buzz, setBuzz] = useState(() => loadOpts().buzz);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const stateRef = useRef(state);
  const restored = useRef(false);
  stateRef.current = state;

  // Credit existing offline rewards once, including under React StrictMode.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadSave();
    if (!saved) return;
    const seconds = cappedOfflineSeconds(saved.lastSeen, Date.now());
    const { gain } = accrueIdle(saved, seconds);
    if (seconds > 0) setState((current) => accrueIdle(current, seconds).state);
    if (seconds > 60 && GAS_LIST.some((g) => gain[g.id] > 1)) setOfflineGain(gain);
  }, []);

  // Hidden tabs do not run the realtime tick. On resume settle one capped absence.
  useEffect(() => {
    let last = Date.now();
    let hiddenAt: number | null = document.hidden ? last : null;
    const onVisibility = () => {
      const now = Date.now();
      if (document.hidden) {
        hiddenAt = now;
        persist(stateRef.current);
      } else {
        const seconds = hiddenAt === null ? 0 : cappedOfflineSeconds(hiddenAt, now);
        if (seconds > 0) setState((s) => accrueIdle(s, seconds).state);
        hiddenAt = null;
        last = now;
      }
    };
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.hidden) { last = now; return; }
      const { incomeSeconds, activeSeconds } = measureTick(last, now);
      last = now;
      if (incomeSeconds <= 0) return;
      setState((s) => {
        const credited = accrueIdle(s, incomeSeconds).state;
        return activeSeconds > 0
          ? { ...credited, activeSeconds: s.activeSeconds + activeSeconds }
          : credited;
      });
    }, 1000);
    const autosave = window.setInterval(() => {
      if (!document.hidden) setSaveWarning(!persist(stateRef.current));
    }, 2000);
    // If already hidden, retain the timestamp saved at the moment of hiding.
    // Re-saving on pagehide could erase hours of pending offline earnings.
    const onPageHide = () => { if (!document.hidden) persist(stateRef.current); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      clearInterval(autosave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
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
    setState((s) => purchaseUpgrade(s, kind, gid, want).state);
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

  const playSec = Math.floor(state.activeSeconds);

  return (
    <div className="flex h-screen h-dvh justify-center overflow-hidden bg-[#05030f] font-mono text-white select-none">
      <div className="relative flex h-full min-h-0 w-full max-w-[400px] flex-col bg-[#08041a]">
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
            <span className="text-[10px] tracking-widest text-white/50">PLASMA BALL</span>
            <span className="text-[10px] tracking-widest text-white/50">
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
                  <span className="text-[10px] tracking-widest" style={{ color: g.color }}>{g.name}</span>
                  <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color: g.color }}>
                    {fmt(state.plasma[g.id])}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] tabular-nums text-white/40">
                  {fmt(cracklePower(g, state))}/TAP · {fmt(rates[g.id])}/S
                </div>
              </div>
            ))}
          </div>
        </header>

        {saveWarning && (
          <div role="alert" className="border-b border-[#ffb86b]/40 bg-[#35200c] px-3 py-2 text-[11px] text-[#ffd8a4]">
            SAVE UNAVAILABLE — PROGRESS MAY BE LOST WHEN THIS TAB CLOSES.
          </div>
        )}

        {offlineGain !== null && (
          <button
            className="border-b-2 border-white/15 bg-[#1b1233] px-3 py-2 text-[11px] active:bg-[#241840]"
            onClick={() => setOfflineGain(null)}
          >
            THE HELP KEPT PRESSING WHILE YOU WERE AWAY:{" "}
            {(Object.entries(offlineGain) as [GasId, number][])
              .map(([g, v]) => `${fmt(v)} ${gasById(g).name}`)
              .join(" · ")}{" "}
            — TAP TO DISMISS
          </button>
        )}

        {/* the ball */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
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
        <nav aria-label="Main sections" className="grid grid-cols-3 border-t border-white/20 bg-[#120a2e]">
          {([
            ["upgrades", "UPGRADES"],
            ["stats", "STATS"],
            ["options", "OPTIONS"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`min-h-[44px] py-2 text-[11px] tracking-widest active:translate-y-[1px] ${
                tab === id ? "bg-[#1b1233] text-white" : "text-white/70"
              }`}
              style={tab === id ? { borderBottom: `3px solid ${accent}` } : { borderBottom: "3px solid transparent" }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* panel — fixed height so switching tabs never moves the layout */}
        <div className="sekasma-scroll relative h-[min(43dvh,480px)] min-h-0 shrink-0 overflow-y-auto overscroll-contain bg-[#0d0820] p-2">
          {toast && (
            <div
              className="pointer-events-none absolute inset-x-2 bottom-2 z-20 border-2 px-2 py-1.5 text-center text-[10px] tracking-widest"
              style={{ borderColor: accent, color: accent, background: "#1b1233" }}
            >
              {toast}
            </div>
          )}
          {tab === "upgrades" && (
            <div className="flex flex-col gap-1.5">
              {/* sticky sub-tab + BUY bar */}
              <div className="sticky top-0 z-10 -mx-2 mb-1 bg-[#0d0820] px-2 pt-0.5">
                <div role="tablist" aria-label="Upgrade categories" className="grid grid-cols-3 overflow-hidden border border-white/20 bg-[#140c2b]">
                  {([
                    ["help", "HELP"],
                    ["gas", "GAS"],
                    ["power", "POWER"],
                  ] as [UpTab, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setUpTab(id)}
                      role="tab"
                      aria-selected={upTab === id}
                      className={`min-h-[40px] border-r border-white/10 py-1 text-[11px] tracking-widest active:translate-y-[1px] ${
                        upTab === id ? "bg-[#21153f] text-white" : "text-white/65"
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
                    <span className="shrink-0 text-[10px] tracking-widest text-white/40">BUY</span>
                    {([1, 5, 10, 100, "max"] as (number | "max")[]).map((q) => (
                      <button
                        key={String(q)}
                        onClick={() => setQty(q)}
                        className={`min-h-[40px] flex-1 border py-1 text-[11px] tabular-nums active:translate-y-[1px] ${
                          qty === q ? "border-white/60 bg-[#21153f] text-white" : "border-white/20 text-white/75"
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
                          plasma={state.plasma}
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
                          plasma={state.plasma}
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
                          locked
                        />
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
                          plasma={state.plasma}
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
                          locked
                        />
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
                          plasma={state.plasma}
                          color={nxGas.color}
                        />
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
                        <div className="mt-1 mb-0.5 px-0.5 text-[10px] font-bold tracking-widest" style={{ color: g.color }}>
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
                          plasma={state.plasma}
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
                          plasma={state.plasma}
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
                          plasma={state.plasma}
                        />
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === "stats" && (
            <StatsPanel state={state} unlockedGases={unlockedGases} rates={rates} playSec={playSec} />
          )}
          {tab === "options" && (
            <OptionsPanel
              scanlines={scanlines}
              buzz={buzz}
              confirmReset={confirmReset}
              onToggleScanlines={() => setScanlines((v) => !v)}
              onToggleBuzz={() => setBuzz((v) => !v)}
              onReset={() => {
                if (confirmReset) {
                  const fresh = resetSave();
                  stateRef.current = fresh;
                  setState(fresh);
                  setOfflineGain(null);
                  setToast(null);
                  setConfirmReset(false);
                } else setConfirmReset(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
