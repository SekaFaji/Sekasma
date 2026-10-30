import type { GasRecord } from "../game/types";
import { affordabilityPercent } from "../utils/progress";

/** Small, accessible affordability meter embedded inside its upgrade row. */
export default function UnlockBar({ cost, color, plasma, label }: {
  cost: Partial<GasRecord>;
  color: string;
  plasma: GasRecord;
  label: string;
}) {
  const percent = affordabilityPercent(cost, plasma);
  if (percent <= 0 || percent >= 100) return null;
  return (
    <div className="mt-1 flex max-w-[144px] items-center gap-1.5">
      <div
        role="progressbar"
        aria-label={`${label} affordability`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-[3px] min-w-0 flex-1 overflow-hidden bg-white/15"
      >
        <div className="h-full" style={{ width: `${percent}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-white/65">{percent}%</span>
    </div>
  );
}
