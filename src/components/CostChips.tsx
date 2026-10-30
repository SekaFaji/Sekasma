import { gasById } from "../game/gases";
import { fmt } from "../utils/format";
import type { GasId, GasRecord } from "../game/types";

/**
 * Price chips for one upgrade row, one chip per gas currency, colored
 * when affordable and dimmed when not.
 */
export default function CostChips({ cost, ok }: { cost: Partial<GasRecord>; ok: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {(Object.entries(cost) as [GasId, number][]).map(([g, amt]) => (
        <span
          key={g}
          className="border px-1 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{
            borderColor: ok ? gasById(g).color : "#ffffff38",
            color: ok ? gasById(g).color : "#ffffffb0",
          }}
        >
          {fmt(amt)}
        </span>
      ))}
    </div>
  );
}
