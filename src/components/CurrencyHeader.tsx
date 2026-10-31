import SekasmaLogo from "./SekasmaLogo";
import { cracklePower } from "../game/economy";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";

/** Centered branding with a compact, horizontally scrollable currency rail. */
export default function CurrencyHeader({ state, gases, rates }: {
  state: GameState; gases: Gas[]; rates: GasRecord;
}) {
  return (
    <header className="shrink-0 border-b border-white/20 bg-[#120a2e] px-2.5 py-1">
      <div className="flex items-center justify-center text-center">
        <SekasmaLogo />
      </div>
      <div role="list" aria-label="Gas balances"
        className="sekasma-currency-rail mt-1 flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5">
        {gases.map((gas) => (
          <div key={gas.id} role="listitem" aria-label={`${gas.name} plasma`}
            className="w-[84px] min-w-[84px] shrink-0 border bg-[#0d0820] px-1.5 py-0.5"
            style={{ borderColor: `${gas.color}55` }}>
            <div className="text-center text-[9px] font-bold" style={{ color: gas.color }}>{gas.name}</div>
            <div className="text-center text-[10px] font-bold tabular-nums" title={String(state.plasma[gas.id])}
              style={{ color: gas.color }}>{fmt(state.plasma[gas.id])}</div>
            <div className="text-center text-[9px] leading-tight tabular-nums text-white/65">
              {fmt(cracklePower(gas, state))}/T · {fmt(rates[gas.id])}/S
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
