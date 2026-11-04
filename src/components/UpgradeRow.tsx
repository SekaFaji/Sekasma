import type { ReactNode } from "react";
import type { GasId, GasRecord } from "../game/types";
import { MAX_BULK_PURCHASE } from "../game/economy";
import { affordabilityPercent } from "../utils/progress";
import { fmt } from "../utils/format";
import GasBolt from "./GasBolt";
import UnlockBar from "./UnlockBar";

export type BuyQuantity = 1 | 5 | 10 | 100 | "max";
export const BUY_QUANTITIES: readonly BuyQuantity[] = [1, 5, 10, 100, "max"];

/** Price remains inside the BUY button, with one bolt per currency. */
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
          <span className="text-[9px] font-bold leading-none tabular-nums">{fmt(amount)}</span>
        </span>
      ))}
    </span>
  );
}

/** Two-tier mobile layout: wide quantity buttons below the label, fixed BUY at right. */
export default function UpgradeRow({
  name, sub, cost, icon, onBuy, disabled, color, nextCost, plasma,
  locked = false, unlockCost, quantity, onQtyChange, benefit, purchased,
}: {
  name: string; sub: string; cost: Partial<GasRecord>; icon: ReactNode; onBuy: () => void;
  disabled: boolean; color?: string; nextCost?: Partial<GasRecord>; plasma?: GasRecord;
  locked?: boolean; unlockCost?: Partial<GasRecord>;
  quantity?: BuyQuantity; onQtyChange?: (quantity: BuyQuantity) => void;
  /** Exact rate projection for the currently selected affordable amount. */
  benefit?: string;
  /** Brief confirmation from the App after a successful purchase. */
  purchased?: string;
}) {
  const price = disabled && nextCost ? nextCost : cost;
  const progress = locked && plasma && unlockCost ? affordabilityPercent(unlockCost, plasma) : 0;
  const capped = !locked && disabled && Object.keys(price).length === 0;
  const chooseQuantity = Boolean(onQtyChange && quantity !== undefined && !locked && !capped);
  return (
    <div className={`grid w-full shrink-0 grid-cols-[36px_minmax(0,1fr)_94px] gap-x-1 gap-y-0.5 border px-1 py-1
      ${chooseQuantity ? "min-h-[89px] grid-rows-[44px_36px]" : "min-h-[54px] grid-rows-[44px]"}
      ${purchased ? "sekasma-purchase-flash border-[#79e1b4]/70 bg-[#192e2d]" : "border-white/15 bg-[#130c29]"}`}>
      <div className="col-start-1 row-start-1 flex h-[36px] w-[36px] items-center justify-center self-center overflow-hidden border border-white/15 bg-[#0b0618]">
        {icon}
      </div>
      <div className="col-start-2 row-start-1 flex h-[44px] min-w-0 flex-col justify-center">
        <div className="truncate text-[11px] font-bold leading-tight" style={color ? { color } : undefined}>{name}</div>
        <div title={sub} className="truncate text-[9px] leading-[12px] text-white/70">{sub}</div>
        <div className="h-[11px] min-h-[11px] max-w-full overflow-hidden text-[9px] leading-[11px]">
          {purchased ? (
            <span role="status" className="block truncate font-bold text-[#8af7c7]">✓ {purchased}</span>
          ) : !locked && disabled && !capped && plasma ? (
            <UnlockBar cost={price} color={color ?? "#b7b2ff"} plasma={plasma} label={name} />
          ) : benefit && !locked && !capped ? (
            <span title={benefit} className="block truncate tabular-nums text-[#97eacb]">{benefit}</span>
          ) : null}
        </div>
      </div>
      {chooseQuantity && (
        <div role="group" aria-label={`${name} quantity`}
          className="col-span-2 row-start-2 grid min-w-0 grid-cols-5 gap-1">
          {BUY_QUANTITIES.map(value => (
            <button key={String(value)} type="button" aria-pressed={quantity === value}
              aria-label={value === "max" ? `Buy maximum ${name} (up to ${MAX_BULK_PURCHASE} per purchase)` : `Buy ${value} ${name}`}
              title={value === "max" ? `MAX: up to ${MAX_BULK_PURCHASE} per purchase, subject to affordability and caps` : undefined}
              onClick={() => onQtyChange?.(value)}
              className={`flex h-[36px] min-w-0 touch-manipulation items-center justify-center border text-[10px] font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff] ${quantity === value
                ? "border-white/70 bg-[#463066] text-white"
                : "border-white/20 bg-[#1a1033] text-white/70 active:bg-[#33204f]"}`}>
              {value === "max" ? "MAX" : value}
            </button>
          ))}
        </div>
      )}
      {locked ? (
        <div role="progressbar" aria-label={`${name} unlock progress`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          className="relative col-start-3 row-start-1 flex h-[44px] w-[94px] shrink-0 flex-col items-center justify-center overflow-hidden border border-[#66c96b]/50 bg-[#101d1b] px-1">
          <span className="text-[9px] font-bold text-white/80">LOCKED</span>
          <div className="relative mt-0.5 h-[13px] w-full overflow-hidden bg-[#263a29]">
            <div className="absolute inset-y-0 left-0 bg-[#61e06b]" style={{ width: `${progress}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-white">{progress}%</span>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onBuy} disabled={disabled}
          aria-label={`${capped ? "Maxed" : "Buy"} ${name}`}
          className={`col-start-3 row-start-1 flex w-[94px] shrink-0 touch-manipulation flex-col items-center justify-center overflow-hidden border px-1 text-[10px] font-bold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff]
            ${chooseQuantity ? "row-span-2 h-full min-h-[80px]" : "h-[44px]"}
            ${disabled ? "border-white/20 bg-[#100a22] text-white/50" : purchased
              ? "border-[#86efba] bg-[#1e4b3f] text-[#b1ffd1]"
              : "border-[#9f80d7] bg-[#291843] text-white active:bg-[#41265e]"}`}>
          <span className="leading-none">{capped ? "MAXED" : purchased ? "BOUGHT!" : "BUY"}</span>
          {!capped && <PriceGrid cost={price} />}
        </button>
      )}
    </div>
  );
}
