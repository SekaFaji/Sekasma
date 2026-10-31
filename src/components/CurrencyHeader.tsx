import { cracklePower } from "../game/economy";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";

/** Compact horizontally-scrollable currency rail for future currencies. */
export default function CurrencyHeader({ state, gases, rates }: {
  state: GameState; gases: Gas[]; rates: GasRecord;
}) {
  return (
    <header className="shrink-0 border-b border-white/20 bg-[#120a2e] px-2.5 py-1">
      <div className="text-[12px] font-bold tracking-[0.2em] text-white/90">SEKASMA</div>
      <div role="list" aria-label="Gas balances" className="sekasma-currency-rail mt-1 flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5">
        {gases.map((gas) => (
          <div key={gas.id} role="listitem" aria-label={`${gas.name} plasma`}
            className="w-[94px] min-w-[94px] shrink-0 border bg-[#0d0820] px-1.5 py-0.5"
            style={{ borderColor: `${gas.color}55` }}>
            <div className="flex min-w-0 items-baseline justify-between gap-1">
              <span className="text-[9px] font-bold" style={{ color: gas.color }}>{gas.name}</span>
              <span className="min-w-0 text-[10px] font-bold tabular-nums"
                style={{ color: gas.color }} title={String(state.plasma[gas.id])}>{fmt(state.plasma[gas.id])}</span>
            </div>
            <div className="text-[9px] leading-tight tabular-nums text-white/65">
              {fmt(cracklePower(gas, state))}/T · {fmt(rates[gas.id])}/S
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
