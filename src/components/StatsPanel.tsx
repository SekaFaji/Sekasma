import { cracklePower } from "../game/economy";
import { fmtVolts, splitMult } from "../game/config";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

function StatCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 border border-white/15 bg-[#15102d] p-2">
      <div className="text-[9px] font-bold tracking-wide text-white/65">{title}</div>
      <div className="mt-1 break-words text-[14px] font-bold tabular-nums text-white">{value}</div>
      {note && <div className="mt-0.5 text-[9px] text-white/60">{note}</div>}
    </div>
  );
}
/** Box-based statistics for easier reading on mobile. */
export default function StatsPanel({ state, unlockedGases, rates }: {
  state: GameState; unlockedGases: Gas[]; rates: GasRecord;
}) {
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="grid grid-cols-2 gap-2">
        <StatCard title="TOTAL CRACKLES" value={String(state.crackles)} />
        <StatCard title="TOTAL PLAYTIME" value={formatDuration(state.activeSeconds + state.offlineSeconds)} />
        <StatCard title="ACTIVE ONLINE" value={formatDuration(state.activeSeconds)} />
        <StatCard title="OFFLINE PLAYTIME" value={formatDuration(state.offlineSeconds)} />
        <StatCard title="FINGERS HIRED" value={String(state.fingers)} />
        <StatCard title="FEET HIRED" value={String(state.toes)} />
        <StatCard title="GHOST HANDS" value={String(state.ghosts)} />
        <StatCard title="STICKMEN" value={String(state.stickmen)} note="KRYPTON HELPER" />
      </div>
      {unlockedGases.map((gas) => (
        <section key={gas.id} className="border border-white/15 bg-[#120c26] p-2">
          <div className="mb-2 text-[11px] font-bold tracking-wide" style={{ color: gas.color }}>{gas.name}</div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard title="LIFETIME" value={fmt(state.total[gas.id])} />
            <StatCard title="HELP RATE" value={`${fmt(rates[gas.id])}/S`} />
            <StatCard title="POWER / TAP" value={fmt(cracklePower(gas, state))} />
            <StatCard title="ARCS" value={`${state.filaments[gas.id]}/${gas.cap}`} />
            <StatCard title="SPLITS" value={String(state.splits[gas.id])} note={`X${splitMult(state.splits[gas.id]).toFixed(2)} MULT`} />
            <StatCard title="VOLT STEPS" value={String(state.voltage[gas.id])} note={fmtVolts(state.voltage[gas.id])} />
          </div>
        </section>
      ))}
    </div>
  );
}
