/**
 * Idle Plasma Ball — application shell: status bar, the ball, and a
 * tabbed panel (upgrades / stats / options) in a phone-first column.
 */
import { useEffect, useRef, useState } from "react";
import PlasmaBall from "./components/PlasmaBall";
import UpgradePanel, { type UpTab } from "./components/UpgradePanel";
import StatsPanel from "./components/StatsPanel";
import OptionsPanel from "./components/OptionsPanel";
import { GAS_LIST, gasById, nextGas } from "./game/gases";
import { accrueIdle, bulkCost, buyMsg, cappedOfflineSeconds, cracklePower, idleRate, purchaseUpgrade } from "./game/economy";
import type { BuyKind } from "./game/economy";
import { freshSave, loadOpts, loadSave, persist, resetSave, saveOpts } from "./game/save";
import { measureTick } from "./game/timing";
import { fmt } from "./utils/format";
import { haptic } from "./utils/haptic";
import type { GasId, GasRecord, GameState } from "./game/types";

type Tab = "upgrades" | "stats" | "options";

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
              onClick={() => { setTab(id); setConfirmReset(false); }}
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

        {/* Keep feedback anchored to the panel viewport, never inside scroll content. */}
        <div className="relative h-[min(43dvh,480px)] min-h-0 shrink-0">
          <div className="sekasma-scroll h-full overflow-y-auto overscroll-contain bg-[#0d0820] p-2">
          {tab === "upgrades" && (
            <UpgradePanel state={state} unlockedGases={unlockedGases} accent={accent}
              upTab={upTab} onUpTabChange={setUpTab} qty={qty}
              onQtyChange={setQty} onBuy={buy} />
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
              onCancelReset={() => setConfirmReset(false)}
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
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="sekasma-toast pointer-events-none absolute inset-x-2 bottom-2 z-20 border-2 px-2 py-1.5 text-center text-[11px] tracking-widest"
              style={{ borderColor: accent, color: accent, background: "#1b1233" }}
            >
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
