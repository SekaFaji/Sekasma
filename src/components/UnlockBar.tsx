import type { GasId, GasRecord } from "../game/types";

/** Progress bar showing how close the player is to a locked upgrade. */
export default function UnlockBar({
  cost,
  color,
  plasma,
}: {
  cost: Partial<GasRecord>;
  color: string;
  plasma: GasRecord;
}) {
  let pct = 1;
  for (const [g, amt] of Object.entries(cost) as [GasId, number][])
    pct = Math.min(pct, plasma[g] / amt);
  const shown = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  return (
    <div className="mb-1 flex items-center gap-1 px-2 pt-0.5">
      <div className="h-1.5 flex-1 border border-white/15 bg-[#0b0618]">
        <div className="h-full" style={{ width: `${shown}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-white/40">{shown}%</span>
    </div>
  );
}
