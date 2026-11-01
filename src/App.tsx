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
import OptionsPanel, { type ResetStep } from "./components/OptionsPanel";
import PrestigePanel, { type PrestigeConfirmStep } from "./components/PrestigePanel";
import { GAS_LIST, gasById, nextGas } from "./game/gases";
import { accrueIdle, accrueOffline, bulkCost, buyMsg, cappedOfflineSeconds, cracklePower, idleRate, purchaseUpgrade } from "./game/economy";
import type { BuyKind } from "./game/economy";
import { freshSave, loadOpts, loadSave, persist, resetSave, saveOpts } from "./game/save";
import { measureTick } from "./game/timing";
import { haptic } from "./utils/haptic";
import type { GasId, GameState, HelperId } from "./game/types";
import { performPrestige, prestigeReward, upgradeCapacity } from "./game/prestige";

type Tab = "upgrades" | "stats" | "prestige" | "options";

export default function App() {
  const [state, setState] = useState<GameState>(() => loadSave() ?? freshSave());
  const [welcome, setWelcome] = useState<WelcomeSummary | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [tab, setTab] = useState<Tab>("upgrades");
  const [upTab, setUpTab] = useState<UpTab>("help");
  const [quantities, setQuantities] = useState<Record<string, BuyQuantity>>({});
  const [scanlines, setScanlines] = useState(() => loadOpts().scan);
  const [buzz, setBuzz] = useState(() => loadOpts().buzz);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const [resetStep, setResetStep] = useState<ResetStep>(0);
  const [prestigeStep, setPrestigeStep] = useState<PrestigeConfirmStep>(0);
  const appRootRef = useRef<HTMLDivElement | null>(null);
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

  // Fullscreen needs a user gesture. Follow browser changes, including Escape.
  useEffect(() => {
    const syncFullscreen = () => {
      setFullscreen(document.fullscreenElement === appRootRef.current);
      setFullscreenAvailable(Boolean(document.fullscreenEnabled && appRootRef.current?.requestFullscreen));
    };
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
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
    setResetStep(0);
    setPrestigeStep(0);
    restoreScroll(viewKey(next, upTab));
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (appRootRef.current?.requestFullscreen) await appRootRef.current.requestFullscreen();
    } catch {
      showToast("FULLSCREEN UNAVAILABLE IN THIS BROWSER");
    }
  };
  const buyPrestigeCapacity = (kind: HelperId) => {
    const current = stateRef.current;
    const next = upgradeCapacity(current, kind);
    if (next === current) return;
    stateRef.current = next;
    setState(next);
    setSaveWarning(!persist(next));
    buzzNow(9);
    showToast("PERMANENT CAPACITY UPGRADED");
  };
  const confirmPrestige = () => {
    if (prestigeStep !== 2) return;
    const current = stateRef.current;
    if (prestigeReward(current) === 0) return;
    const next = performPrestige(current);
    stateRef.current = next;
    setState(next);
    setSaveWarning(!persist(next));
    setPrestigeStep(0);
    setWelcome(null);
    setQuantities({});
    buzzNow(18);
    showToast("PRESTIGE COMPLETE · SPARKS EARNED");
  };
  const confirmSaveDeletion = () => {
    if (resetStep !== 2) return;
    const fresh = resetSave();
    stateRef.current = fresh;
    setState(fresh);
    setWelcome(null);
    setQuantities({});
    setToast(null);
    setResetStep(0);
    setPrestigeStep(0);
  };
  const switchUpgradeTab = (next: UpTab) => {
    rememberScroll();
    setUpTab(next);
    restoreScroll(viewKey("upgrades", next));
  };

  return (
    <div ref={appRootRef} className="flex h-screen h-dvh justify-center overflow-hidden bg-[#05030f] font-mono text-white select-none">
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
        <nav aria-label="Main sections" className="grid grid-cols-4 border-t border-white/20 bg-[#120a2e]">
          {([
            ["upgrades", "UPGRADES"],
            ["stats", "STATS"],
            ["prestige", "PRESTIGE"],
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
        <div className="sekasma-panel-shell relative min-h-0 shrink-0">
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
          {tab === "prestige" && (
            <PrestigePanel state={state} step={prestigeStep}
              onStart={() => setPrestigeStep(1)}
              onNext={() => setPrestigeStep(2)}
              onCancel={() => setPrestigeStep(0)}
              onConfirm={confirmPrestige}
              onBuyCapacity={buyPrestigeCapacity} />
          )}
          {tab === "options" && (
            <OptionsPanel
              scanlines={scanlines}
              buzz={buzz}
              fullscreen={fullscreen}
              fullscreenAvailable={fullscreenAvailable}
              onToggleFullscreen={toggleFullscreen}
              resetStep={resetStep}
              onToggleScanlines={() => setScanlines(v => !v)}
              onToggleBuzz={() => setBuzz(v => !v)}
              onStartReset={() => setResetStep(1)}
              onNextReset={() => setResetStep(2)}
              onCancelReset={() => setResetStep(0)}
              onConfirmReset={confirmSaveDeletion}
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
