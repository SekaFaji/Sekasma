import { gasById } from "../game/gases";
import { fmt } from "../utils/format";
import type { GasId, GasRecord } from "../game/types";

/** Price chips wrap under a row's description rather than resizing its BUY button. */
export default function CostChips({ cost, ok }: { cost: Partial<GasRecord>; ok: boolean }) {
  return (
    <div className="mt-0.5 flex min-w-0 flex-wrap gap-0.5">
      {(Object.entries(cost) as [GasId, number][]).map(([gas, amount]) => (
        <span key={gas} className="border px-0.5 text-[9px] font-semibold leading-tight tabular-nums"
          style={{ borderColor: ok ? gasById(gas).color : "#ffffff35", color: ok ? gasById(gas).color : "#ffffffb0" }}>{fmt(amount)}</span>
      ))}
    </div>
  );
}
