import { cracklePower } from "../game/economy";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";

type BuyQuantity = number | "max";

/** Compact currency overview, with a single unobtrusive bulk-buy selector. */
export default function CurrencyHeader({ state, gases, rates, qty, onQtyChange }: {
  state: GameState;
  gases: Gas[];
  rates: GasRecord;
  qty: BuyQuantity;
  onQtyChange: (value: BuyQuantity) => void;
}) {
  return (
    <header className="shrink-0 border-b border-white/20 bg-[#120a2e] px-2.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold leading-tight tracking-wide text-white/80">PLASMA BALL</div>
          <div className="mt-0.5 text-[9px] leading-tight tabular-nums text-white/65">
            {state.fingers} FING · {state.toes} FEET · {state.ghosts} GHO
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-white/75">
          BUY
          <select aria-label="Bulk buy quantity" value={String(qty)}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onQtyChange(value === "max" ? "max" : Number(value));
            }}
            className="h-8 max-w-[78px] rounded-none border border-white/30 bg-[#21153f] px-1 text-[11px] font-bold tabular-nums text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b7b2ff]"
          >
            <option value="1">×1</option>
            <option value="5">×5</option>
            <option value="10">×10</option>
            <option value="100">×100</option>
            <option value="max">MAX</option>
          </select>
        </label>
      </div>
      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${gases.length}, minmax(0, 1fr))` }}>
        {gases.map((gas) => (
          <div key={gas.id} aria-label={`${gas.name} plasma`} className="min-w-0 border px-1 py-0.5"
            style={{ borderColor: `${gas.color}55`, background: "#0d0820" }}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-1">
              <span className="text-[10px] font-bold leading-tight" style={{ color: gas.color }}>{gas.name}</span>
              <span className="sekasma-currency-value text-[12px] font-bold leading-tight tabular-nums"
                style={{ color: gas.color }} title={String(state.plasma[gas.id])}>{fmt(state.plasma[gas.id])}</span>
            </div>
            <div className="mt-0.5 min-w-0 text-[9px] leading-tight tabular-nums text-white/70">
              {fmt(cracklePower(gas, state))}/T · {fmt(rates[gas.id])}/S
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
