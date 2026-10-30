import { cracklePower } from "../game/economy";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";

/** A narrow-screen currency summary. Each currency grows vertically, never clips sideways. */
export default function CurrencyHeader({
  state, gases, rates,
}: {
  state: GameState;
  gases: Gas[];
  rates: GasRecord;
}) {
  return (
    <header className="shrink-0 border-b border-white/20 bg-[#120a2e] px-3 py-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-[11px] font-bold tracking-wider text-white/75">PLASMA BALL</span>
        <span className="text-[10px] tabular-nums leading-tight text-white/65">
          {state.fingers} FING · {state.toes} FEET · {state.ghosts} GHO
        </span>
      </div>
      <div
        className="mt-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${gases.length}, minmax(0, 1fr))` }}
      >
        {gases.map((gas) => (
          <div
            key={gas.id}
            aria-label={`${gas.name} plasma`}
            className="min-w-0 border px-1.5 py-1"
            style={{ borderColor: `${gas.color}55`, background: "#0d0820" }}
          >
            <div className="text-[11px] font-bold tracking-wide" style={{ color: gas.color }}>
              {gas.name}
            </div>
            <div
              className="sekasma-currency-value mt-0.5 text-[14px] font-bold leading-tight tabular-nums"
              style={{ color: gas.color }}
              title={String(state.plasma[gas.id])}
            >
              {fmt(state.plasma[gas.id])}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] leading-tight tabular-nums text-white/70">
              <span>{fmt(cracklePower(gas, state))}/TAP</span>
              <span>{fmt(rates[gas.id])}/S</span>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
