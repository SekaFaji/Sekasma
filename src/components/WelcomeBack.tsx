import SekasmaLogo from "./SekasmaLogo";
import { GAS_LIST } from "../game/gases";
import type { GasRecord } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

export type WelcomeSummary = { seconds: number; gain: GasRecord };

/** Compact return summary over a translucent view of the game. */
export default function WelcomeBack({ summary, onContinue }: {
  summary: WelcomeSummary;
  onContinue: () => void;
}) {
  const earned = GAS_LIST.some((g) => summary.gain[g.id] > 0);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050310]/45 px-4 py-4">
      <div className="max-h-[85dvh] w-full max-w-[320px] overflow-y-auto border-2 border-[#7552af] bg-[#110a29]/95 px-3 py-3 text-white shadow-[0_0_32px_#38215480]">
        <div className="flex justify-center"><SekasmaLogo /></div>
        <h2 id="welcome-title" className="mt-1 text-center text-[16px] font-bold tracking-widest text-[#f4dcff]">
          WELCOME BACK
        </h2>
        <p className="mt-1 text-center text-[10px] text-white/65">WHILE YOU WERE AWAY</p>
        <div className="my-2 flex items-center justify-between border-y border-white/15 px-1 py-2">
          <span className="text-[10px] tracking-wide text-white/65">TIME AWAY</span>
          <span className="text-[15px] font-bold tabular-nums text-[#c4a2ff]">{formatDuration(summary.seconds)}</span>
        </div>
        <div className="text-[10px] font-bold tracking-wide text-white/80">PLASMA EARNED</div>
        <div className="mt-1 space-y-1">
          {GAS_LIST.map((g) => (
            <div key={g.id} className="flex min-h-[30px] items-center justify-between gap-2 border border-white/15 bg-[#1a1035] px-2 py-1 text-[10px]">
              <span className="font-bold" style={{ color: g.color }}>{g.name}</span>
              <span className="font-bold tabular-nums" style={{ color: g.color }}>+{fmt(summary.gain[g.id])}</span>
            </div>
          ))}
        </div>
        {!earned && (
          <p className="mt-2 text-center text-[10px] text-white/65">
            NO PLASMA EARNED. HIRE HELPERS TO GENERATE PLASMA WHILE AWAY.
          </p>
        )}
        <button type="button" onClick={onContinue}
          className="mt-3 min-h-[44px] w-full border-2 border-[#b795f2] bg-[#39215b] px-3 py-2 text-[11px] font-bold tracking-widest text-white active:bg-[#52317d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          CONTINUE
        </button>
      </div>
    </div>
  );}
