import type { ReactNode } from "react";
import type { GasId, GasRecord } from "../game/types";
import { affordabilityPercent } from "../utils/progress";
import { fmt } from "../utils/format";
import UnlockBar from "./UnlockBar";
export type BuyQuantity = 1 | 5 | 10 | 100 | "max";
export const BUY_QUANTITIES: readonly BuyQuantity[] = [1, 5, 10, 100, "max"];
const GAS_SHORT: Record<GasId, string> = { neon: "N", argon: "A", xenon: "X", krypton: "K" };
function compactCost(cost: Partial<GasRecord>): string[] {
  const entries = Object.entries(cost) as [GasId, number][];
  const parts = entries.map(([gas, amount]) => `${fmt(amount)}${GAS_SHORT[gas]}`);
  if (parts.length === 0) return [];
  if (parts.length <= 2) return [parts.join(" · ")];
  return [parts.slice(0, 2).join(" · "), parts.slice(2).join(" · ")];
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
  const priceLines = compactCost(price);
  const progress = locked && plasma && unlockCost ? affordabilityPercent(unlockCost, plasma) : 0;
  const capped = !locked && disabled && Object.keys(price).length === 0;
  return (
    <div className="flex h-[66px] w-full shrink-0 items-center gap-1.5 border border-white/15 bg-[#130c29] px-1.5 py-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-[#0b0618]">{icon}</div>
      <div className="flex h-[52px] min-w-0 flex-1 flex-col justify-center">
        <div className="shrink-0 truncate text-[11px] font-bold leading-tight" style={color ? { color } : undefined}>{name}</div>
        <div className="sekasma-upgrade-sub mt-0.5 h-[24px] shrink-0 text-[9px] leading-3 text-white/70">{sub}</div>
        {/* Always reserve exactly the same progress slot, even when affordable or maxed. */}
        <div className="h-[12px] min-h-[12px] shrink-0">
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
          className="relative flex h-11 w-[78px] shrink-0 flex-col items-center overflow-hidden border border-[#66c96b]/50 bg-[#101d1b] px-1 pt-1">
          <span className="text-[9px] font-bold text-white/80">LOCKED</span>
          <div className="relative mt-1 h-[15px] w-full overflow-hidden bg-[#263a29]">
            <div className="absolute inset-y-0 left-0 bg-[#61e06b]" style={{ width: `${progress}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-white">{progress}%</span>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onBuy} disabled={disabled}
          aria-label={`${capped ? "Maxed" : "Buy"} ${name}`}
          className={`flex h-11 w-[78px] shrink-0 flex-col items-center justify-center border px-1 text-[9px] font-bold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff] ${
            disabled ? "border-white/20 bg-[#100a22] text-white/50" : "border-[#9f80d7] bg-[#291843] text-white active:bg-[#41265e]"
          }`}>
          <span className="leading-none">{capped ? "MAXED" : "BUY"}</span>
          {!capped && priceLines.length > 0 && (
            <span className="mt-1 flex flex-col items-center text-[8px] leading-[1.05] text-white/80">
              {priceLines.map(line => <span key={line}>{line}</span>)}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
