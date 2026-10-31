import { cracklePower } from "../game/economy";
import { fmtVolts, splitMult } from "../game/config";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

/** Compact stat tiles fit four across on phone screens without changing the data. */
function StatCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="flex min-h-[60px] min-w-0 flex-col justify-between border border-white/15 bg-[#15102d] px-1 py-1.5">
      <div className="break-words text-[8px] font-bold leading-[10px] text-white/65">{title}</div>
      <div className="mt-1 break-words text-[12px] font-bold leading-tight tabular-nums text-white">{value}</div>
      {note && <div className="mt-0.5 break-words text-[8px] leading-tight text-white/60">{note}</div>}
    </div>
  );
}

/** All stats use grouped, four-column cards, including general information. */
export default function StatsPanel({ state, unlockedGases, rates }: {
  state: GameState; unlockedGases: Gas[]; rates: GasRecord;
}) {
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <section aria-labelledby="general-stats-heading" className="border border-white/15 bg-[#120c26] p-1.5">
        <h3 id="general-stats-heading" className="mb-1.5 text-[11px] font-bold tracking-wide text-[#d1b9ff]">
          GENERAL STATS
        </h3>
        <div className="grid grid-cols-4 gap-1">
          <StatCard title="TOTAL CRACKLES" value={String(state.crackles)} />
          <StatCard title="TOTAL PLAYTIME" value={formatDuration(state.activeSeconds + state.offlineSeconds)} />
          <StatCard title="ACTIVE ONLINE" value={formatDuration(state.activeSeconds)} />
          <StatCard title="OFFLINE PLAYTIME" value={formatDuration(state.offlineSeconds)} />
          <StatCard title="FINGERS HIRED" value={String(state.fingers)} />
          <StatCard title="FEET HIRED" value={String(state.toes)} />
          <StatCard title="GHOST HANDS" value={String(state.ghosts)} />
          <StatCard title="STICKMEN" value={String(state.stickmen)} note="KRYPTON HELPER" />
        </div>
      </section>
      {unlockedGases.map(gas => (
        <section key={gas.id} aria-labelledby={`stats-${gas.id}-heading`}
          className="border border-white/15 bg-[#120c26] p-1.5">
          <h3 id={`stats-${gas.id}-heading`} className="mb-1.5 text-[11px] font-bold tracking-wide"
            style={{ color: gas.color }}>{gas.name} STATS</h3>
          <div className="grid grid-cols-4 gap-1">
            <StatCard title="LIFETIME" value={fmt(state.total[gas.id])} />
            <StatCard title="HELP RATE" value={`${fmt(rates[gas.id])}/S`} />
            <StatCard title="POWER / TAP" value={fmt(cracklePower(gas, state))} />
            <StatCard title="ARCS" value={`${state.filaments[gas.id]}/${gas.cap}`} />
            <StatCard title="SPLITS" value={String(state.splits[gas.id])}
              note={`X${splitMult(state.splits[gas.id]).toFixed(2)} MULT`} />
            <StatCard title="VOLT STEPS" value={String(state.voltage[gas.id])}
              note={fmtVolts(state.voltage[gas.id])} />
          </div>
        </section>
      ))}
    </div>
  );
}
