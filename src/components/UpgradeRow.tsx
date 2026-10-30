import type { ReactNode } from "react";
import type { GasRecord } from "../game/types";
import CostChips from "./CostChips";
import UnlockBar from "./UnlockBar";

/** One consistent 44px+ purchase target; locked rows never pretend to be affordable. */
export default function UpgradeRow({
  name, sub, cost, icon, onBuy, disabled, color, nextCost, plasma, locked = false,
}: {
  name: string;
  sub: string;
  cost: Partial<GasRecord>;
  icon: ReactNode;
  onBuy: () => void;
  disabled: boolean;
  color?: string;
  nextCost?: Partial<GasRecord>;
  plasma?: GasRecord;
  locked?: boolean;
}) {
  const price = disabled && nextCost ? nextCost : cost;
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={disabled || locked}
      aria-label={locked ? `${name}: ${sub}` : undefined}
      className={`flex min-h-[44px] w-full items-center gap-1.5 border px-1.5 py-1 text-left transition-colors active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#b7b2ff] ${
        disabled || locked ? "border-white/10 bg-[#100a22]" : "border-white/25 bg-[#16102c] hover:border-white/45 active:bg-[#21143d]"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-[#0b0618]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold leading-tight" style={color ? { color } : undefined}>{name}</div>
        <div className="mt-0.5 text-[10px] leading-tight text-white/75">{sub}</div>
        {!locked && disabled && plasma && (
          <UnlockBar cost={price} color={color ?? "#b7b2ff"} plasma={plasma} label={name} />
        )}
      </div>
      {locked ? (
        <span className="shrink-0 border border-white/20 px-1 py-0.5 text-[10px] font-bold tracking-wider text-white/65">LOCKED</span>
      ) : (
        <CostChips cost={price} ok={!disabled} />
      )}
    </button>
  );
}
