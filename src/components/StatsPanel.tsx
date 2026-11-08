import { cracklePower } from "../game/economy";
import { HELPER_CATALOG, helperOwned } from "../game/helpers";
import { MAX_VOLT_LEVELS, splitMult, voltMult } from "../game/config";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

/** Every tile shows this-run value, with a small non-resetting lifetime value. */
function StatCard({ title, value, lifetime, note }: {
  title: string; value: string; lifetime: string; note?: string;
}) {
  return (
    <div className="flex min-h-[77px] min-w-0 flex-col justify-between overflow-hidden border border-white/15 bg-[#15102d] px-1 py-1.5">
      <div className="break-words text-[8px] font-bold leading-[10px] text-white/65">{title}</div>
      <div className="mt-1 break-words text-[12px] font-bold leading-tight tabular-nums text-white">{value}</div>
      <div className="mt-1 break-words text-[8px] leading-[10px] text-[#b6a0d3]" aria-label={`${title} lifetime ${lifetime}`}>
        <span className="text-white/50">LIFETIME </span>
        <span className="tabular-nums">{lifetime}</span>
      </div>
      {note && <div className="mt-0.5 break-words text-[8px] leading-tight text-white/50">{note}</div>}
    </div>
  );
}

/** Four-column phone layout; totals and peak rates survive every Prestige. */
export default function StatsPanel({ state, unlockedGases, rates }: {
  state: GameState; unlockedGases: Gas[]; rates: GasRecord;
}) {
  const ls = state.lifetime;
  const elapsed = (current: number, start: number) => Math.max(0, current - start);
  const cracklesThisRun = elapsed(state.crackles, ls.runStartCrackles);
  const activeThisRun = elapsed(state.activeSeconds, ls.runStartActiveSeconds);
  const offlineThisRun = elapsed(state.offlineSeconds, ls.runStartOfflineSeconds);
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <section aria-labelledby="general-stats-heading" className="border border-white/15 bg-[#120c26] p-1.5">
        <h3 id="general-stats-heading" className="mb-1.5 text-[11px] font-bold tracking-wide text-[#d1b9ff]">
          GENERAL STATS
        </h3>
        <p className="mb-1 text-[9px] text-white/50">MAIN: THIS RUN · SMALL: LIFETIME</p>
        <div className="grid grid-cols-4 gap-1">
          <StatCard title="CRACKLES" value={String(cracklesThisRun)} lifetime={String(state.crackles)} />
          <StatCard title="TOTAL PLAYTIME" value={formatDuration(activeThisRun + offlineThisRun)}
            lifetime={formatDuration(state.activeSeconds + state.offlineSeconds)} />
          <StatCard title="ACTIVE ONLINE" value={formatDuration(activeThisRun)}
            lifetime={formatDuration(state.activeSeconds)} />
          <StatCard title="OFFLINE PLAYTIME" value={formatDuration(offlineThisRun)}
            lifetime={formatDuration(state.offlineSeconds)} />
          {HELPER_CATALOG.map(helper => (
            <StatCard key={helper.id} title={helper.statsLabel}
              value={String(helperOwned(state, helper.id))}
              lifetime={String(ls.helperHires[helper.id])}
              note={helper.id === "stickman" ? "KRYPTON HELPER" : undefined} />
          ))}
        </div>
      </section>
      {unlockedGases.map(gas => {
        const id = gas.id;
        return (
          <section key={id} aria-labelledby={`stats-${id}-heading`}
            className="border border-white/15 bg-[#120c26] p-1.5">
            <h3 id={`stats-${id}-heading`} className="mb-1.5 text-[11px] font-bold tracking-wide"
              style={{ color: gas.color }}>{gas.name} STATS</h3>
            <div className="grid grid-cols-4 gap-1">
              <StatCard title="PLASMA EARNED" value={fmt(elapsed(state.total[id], state.prestige.lastTotal[id]))}
                lifetime={fmt(state.total[id])} />
              <StatCard title="HELP RATE" value={`${fmt(rates[id])}/S`}
                lifetime={`${fmt(Math.max(ls.peakHelpRate[id], rates[id]))}/S`}
                note="BEST EVER" />
              <StatCard title="POWER / TAP" value={fmt(cracklePower(gas, state))}
                lifetime={fmt(Math.max(ls.peakTapPower[id], cracklePower(gas, state)))}
                note="BEST EVER" />
              <StatCard title="ARCS" value={`${state.filaments[id]}/${gas.cap}`}
                lifetime={String(ls.purchasedArcs[id])} />
              <StatCard title="SPLITS" value={String(state.splits[id])}
                lifetime={String(ls.purchasedSplits[id])}
                note={`X${splitMult(state.splits[id]).toFixed(2)} MULT`} />
              <StatCard title="VOLTAGE" value={`${state.voltage[id]}/${MAX_VOLT_LEVELS}`}
                lifetime={String(ls.purchasedVoltage[id])}
                note={`X${voltMult(state.voltage[id], state.legacyVoltage[id]).toFixed(2)} · OLD ${ls.legacyVoltagePurchases[id]} STEPS`} />
            </div>
          </section>
        );
      })}
      {state.prestige.cycles > 0 && (
        <p className="px-1 text-[9px] leading-relaxed text-white/45">
          Lifetime helper purchases and upgrade totals are tracked from v0.12.25.
          Older reset history cannot be reconstructed.
        </p>
      )}
    </div>
  );
}
