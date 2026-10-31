import type { ReactNode } from "react";
import type { GasId, GasRecord } from "../game/types";
import { affordabilityPercent } from "../utils/progress";
import { fmt } from "../utils/format";
import GasBolt from "./GasBolt";
import UnlockBar from "./UnlockBar";
export type BuyQuantity = 1 | 5 | 10 | 100 | "max";
export const BUY_QUANTITIES: readonly BuyQuantity[] = [1, 5, 10, 100, "max"];
/** Keep amounts legible without letter suffixes; the colored bolt identifies the currency. */
function PriceGrid({ cost }: { cost: Partial<GasRecord> }) {
  const entries = Object.entries(cost) as [GasId, number][];
  if (entries.length === 0) return null;
  return (
    <span className="sekasma-price-grid mt-0.5 grid w-full grid-cols-2 gap-x-0.5 gap-y-px"
      aria-label="Upgrade price">
      {entries.map(([gas, amount]) => (
        <span key={gas} className="flex min-w-0 items-center justify-center gap-px whitespace-nowrap"
          aria-label={`${gas}: ${fmt(amount)}`}>
          <GasBolt gas={gas} />
          <span className="text-[8px] font-bold leading-none tabular-nums">{fmt(amount)}</span>
        </span>
      ))}
    </span>
  );
}
/** A fixed-width BUY action displays its price below BUY. */
export default function UpgradeRow({
  name, sub, cost, icon, onBuy, disabled, color, nextCost, plasma,
  locked = false, unlockCost, quantity, onQtyChange,
}: {
  name: string; sub: string; cost: Partial<GasRecord>; icon: ReactNode; onBuy: () => void;
  disabled: boolean; color?: string; nextCost?: Partial<GasRecord>; plasma?: GasRecord;
  locked?: boolean; unlockCost?: Partial<GasRecord>;
  quantity?: BuyQuantity; onQtyChange?: (quantity: BuyQuantity) => void;
}) {
  const price = disabled && nextCost ? nextCost : cost;
  const progress = locked && plasma && unlockCost ? affordabilityPercent(unlockCost, plasma) : 0;
  const capped = !locked && disabled && Object.keys(price).length === 0;
  return (
    <div className="flex h-[52px] w-full shrink-0 items-center gap-1 border border-white/15 bg-[#130c29] px-1 py-0.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-[#0b0618]">{icon}</div>
      <div className="flex h-[46px] min-w-0 flex-1 flex-col justify-center">
        <div className="shrink-0 truncate text-[11px] font-bold leading-tight" style={color ? { color } : undefined}>{name}</div>
        <div className="sekasma-upgrade-sub h-[21px] shrink-0 text-[9px] leading-[10px] text-white/70">{sub}</div>
        {/* Always reserve exactly the same progress slot, even when affordable or maxed. */}
        <div className="h-[10px] min-h-[10px] shrink-0">
          {!locked && disabled && !capped && plasma &&
            <UnlockBar cost={price} color={color ?? "#b7b2ff"} plasma={plasma} label={name} />}
        </div>
      </div>
      {onQtyChange && quantity !== undefined && !locked && (
        <div role="group" aria-label={`${name} quantity`} className="flex shrink-0 items-center gap-0.5">
          {BUY_QUANTITIES.map((value) => (
            <button key={String(value)} type="button" aria-pressed={quantity === value}
              aria-label={`Buy ${value === "max" ? "maximum" : value} ${name}`}
              onClick={() => onQtyChange(value)}
              className={`h-6 min-w-[19px] border px-0.5 text-[9px] font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff] ${
                quantity === value ? "border-white/60 bg-[#382356] text-white" : "border-white/15 bg-[#1a1033] text-white/60"
              }`}>{value === "max" ? "M" : value}</button>
          ))}
        </div>
      )}
      {locked ? (
        <div role="progressbar" aria-label={`${name} unlock progress`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          className="relative flex h-[44px] w-[94px] shrink-0 flex-col items-center justify-center overflow-hidden border border-[#66c96b]/50 bg-[#101d1b] px-1">
          <span className="text-[9px] font-bold text-white/80">LOCKED</span>
          <div className="relative mt-0.5 h-[13px] w-full overflow-hidden bg-[#263a29]">
            <div className="absolute inset-y-0 left-0 bg-[#61e06b]" style={{ width: `${progress}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-white">{progress}%</span>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onBuy} disabled={disabled}
          aria-label={`${capped ? "Maxed" : "Buy"} ${name}`}
          className={`flex h-[44px] w-[94px] shrink-0 flex-col items-center justify-center overflow-hidden border px-1 text-[9px] font-bold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff] ${
            disabled ? "border-white/20 bg-[#100a22] text-white/50" : "border-[#9f80d7] bg-[#291843] text-white active:bg-[#41265e]"
          }`}>
          <span className="leading-none">{capped ? "MAXED" : "BUY"}</span>
          {!capped && <PriceGrid cost={price} />}
        </button>
      )}
    </div>
  );
}
