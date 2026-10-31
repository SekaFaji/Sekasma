/**
 * Idle Plasma Ball — application shell: status bar, the ball, and a
 * tabbed panel (upgrades / stats / options) in a phone-first column.
 */
import { useEffect, useRef, useState } from "react";
import PlasmaBall from "./components/PlasmaBall";
import CurrencyHeader from "./components/CurrencyHeader";
import WelcomeBack, { type WelcomeSummary } from "./components/WelcomeBack";
import UpgradePanel, { type UpTab } from "./components/UpgradePanel";
import type { BuyQuantity } from "./components/UpgradeRow";
import StatsPanel from "./components/StatsPanel";
import OptionsPanel from "./components/OptionsPanel";
import { GAS_LIST, gasById, nextGas } from "./game/gases";
import { accrueIdle, accrueOffline, bulkCost, buyMsg, cappedOfflineSeconds, cracklePower, idleRate, purchaseUpgrade } from "./game/economy";
import type { BuyKind } from "./game/economy";
import { freshSave, loadOpts, loadSave, persist, resetSave, saveOpts } from "./game/save";
import { measureTick } from "./game/timing";
import { haptic } from "./utils/haptic";
import type { GasId, GameState } from "./game/types";

type Tab = "upgrades" | "stats" | "options";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSave() ?? freshSave());
  const [welcome, setWelcome] = useState<WelcomeSummary | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [tab, setTab] = useState<Tab>("upgrades");
  const [upTab, setUpTab] = useState<UpTab>("help");
  const [quantities, setQuantities] = useState<Record<string, BuyQuantity>>({});
  const [scanlines, setScanlines] = useState(() => loadOpts().scan);
  const [buzz, setBuzz] = useState(() => loadOpts().buzz);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
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
    if (seconds > 0) setState((current) => accrueOffline(current, seconds).state);
    if (seconds >= 10) setWelcome({ seconds, gain: accrueOffline(saved, seconds).gain });
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
        if (seconds > 0) setState((s) => accrueOffline(s, seconds).state);
        if (seconds >= 10) setWelcome({ seconds, gain: accrueOffline(stateRef.current, seconds).gain });
        hiddenAt = null;
        last = now;
      }
    };
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.hidden) { last = now; return; }
      const { incomeSeconds, activeSeconds, stalled } = measureTick(last, now);
      last = now;
      if (incomeSeconds <= 0) return;
      if (stalled && incomeSeconds >= 10) {
        setWelcome({ seconds: incomeSeconds, gain: accrueOffline(stateRef.current, incomeSeconds).gain });
      }
      setState((s) => {
        const credited = (stalled ? accrueOffline(s, incomeSeconds) : accrueIdle(s, incomeSeconds)).state;
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

  const buy = (kind: BuyKind, gid?: GasId, quantity: BuyQuantity = 1) => {
    const want = kind === "gas" ? 1 : quantity === "max" ? 1000 : quantity;
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

  // Preserve each section's place, including independent upgrade categories.
  const viewKey = (main: Tab, upgrade: UpTab) =>
    main === "upgrades" ? `upgrades:${upgrade}` : main;
  const rememberScroll = () => {
    if (panelScrollRef.current)
      scrollPositionsRef.current[viewKey(tab, upTab)] = panelScrollRef.current.scrollTop;
  };
  const restoreScroll = (key: string) => {
    window.requestAnimationFrame(() => {
      if (panelScrollRef.current)
        panelScrollRef.current.scrollTop = scrollPositionsRef.current[key] ?? 0;
    });
  };
  const switchMainTab = (next: Tab) => {
    rememberScroll();
    setTab(next);
    setConfirmReset(false);
    restoreScroll(viewKey(next, upTab));
  };
  const switchUpgradeTab = (next: UpTab) => {
    rememberScroll();
    setUpTab(next);
    restoreScroll(viewKey("upgrades", next));
  };

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

        <CurrencyHeader state={state} gases={unlockedGases} rates={rates} />

        {saveWarning && (
          <div role="alert" className="border-b border-[#ffb86b]/40 bg-[#35200c] px-3 py-2 text-[11px] text-[#ffd8a4]">
            SAVE UNAVAILABLE — PROGRESS MAY BE LOST WHEN THIS TAB CLOSES.
          </div>
        )}

        {/* the ball */}
        <div className="sekasma-ball-area flex min-h-0 flex-1 flex-col items-center justify-center px-3">
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
            stickmen={state.stickmen}
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
              onClick={() => switchMainTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`min-h-[40px] py-1 text-[11px] tracking-wide active:translate-y-[1px] ${
                tab === id ? "bg-[#1b1233] text-white" : "text-white/70"
              }`}
              style={tab === id ? { borderBottom: `3px solid ${accent}` } : { borderBottom: "3px solid transparent" }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Keep feedback anchored to the panel viewport, never inside scroll content. */}
        <div className={`sekasma-panel-shell relative min-h-0 shrink-0 ${tab === "upgrades" && upTab === "help" ? "sekasma-panel-shell--help" : ""}`}>
          <div ref={panelScrollRef} className="sekasma-scroll h-full overflow-y-auto overscroll-contain bg-[#0d0820] p-2">
          {tab === "upgrades" && (
            <UpgradePanel state={state} unlockedGases={unlockedGases} accent={accent}
              upTab={upTab} onUpTabChange={switchUpgradeTab} quantities={quantities}
              onQuantityChange={(key, quantity) => setQuantities((old) => ({ ...old, [key]: quantity }))}
              onBuy={buy} />
          )}

          {tab === "stats" && (
            <StatsPanel state={state} unlockedGases={unlockedGases} rates={rates} />
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
                  setWelcome(null);
                  setQuantities({});
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
      {welcome && <WelcomeBack summary={welcome} onContinue={() => setWelcome(null)} />}
    </div>
  );
}
