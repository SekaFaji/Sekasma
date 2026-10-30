import type { ReactNode } from "react";
import type { GasRecord } from "../game/types";
import CostChips from "./CostChips";

/**
 * A single purchasable upgrade row: icon, description and price chips.
 * When the row is unaffordable, `nextCost` shows the next unit's price
 * dimmed instead of an empty chip stack.
 */
export default function UpgradeRow({
  name,
  sub,
  cost,
  icon,
  onBuy,
  disabled,
  color,
  nextCost,
}: {
  name: string;
  sub: string;
  cost: Partial<GasRecord>;
  icon: ReactNode;
  onBuy: () => void;
  disabled: boolean;
  color?: string;
  nextCost?: Partial<GasRecord>;
}) {
  return (
    <button
      onClick={onBuy}
      disabled={disabled}
      className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-transform active:translate-y-[1px] ${
        disabled ? "border-white/10 bg-[#100a22] opacity-50" : "border-white/20 bg-[#16102c] hover:border-white/40"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-[#0b0618]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold leading-none" style={color ? { color } : undefined}>{name}</div>
        <div className="mt-0.5 truncate text-[8px] leading-tight text-white/45">{sub}</div>
      </div>
      <CostChips cost={disabled && nextCost ? nextCost : cost} ok={!disabled} />
    </button>
  );
}
