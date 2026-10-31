import { GAS_LIST } from "../game/gases";
import type { GasRecord } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

export type WelcomeSummary = { seconds: number; gain: GasRecord };

/** Full-screen return summary, including zero earnings when no helpers work. */
export default function WelcomeBack({ summary, onContinue }: {
  summary: WelcomeSummary;
  onContinue: () => void;
}) {
  const earned = GAS_LIST.some((g) => summary.gain[g.id] > 0);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050310]/95 px-3 py-4">
      <div className="w-full max-w-[400px] border-2 border-[#7552af] bg-[#110a29] p-4 text-white shadow-[0_0_40px_#38215480]">
        <div className="text-center text-[11px] tracking-[0.25em] text-[#bb9fed]">SEKASMA</div>
        <h2 id="welcome-title" className="mt-4 text-center text-[23px] font-bold tracking-widest text-[#f4dcff]">
          WELCOME BACK
        </h2>
        <p className="mt-2 text-center text-[11px] text-white/70">WHILE YOU WERE AWAY</p>
        <div className="my-4 border-y border-white/15 py-3 text-center">
          <div className="text-[10px] tracking-widest text-white/60">TIME AWAY</div>
          <div className="mt-1 text-[25px] font-bold tabular-nums text-[#c4a2ff]">
            {formatDuration(summary.seconds)}
          </div>
        </div>
        <div className="text-center text-[11px] font-bold tracking-widest text-white/80">PLASMA EARNED</div>
        <div className="mt-2 max-h-[40vh] space-y-2 overflow-y-auto">
          {GAS_LIST.map((g) => (
            <div key={g.id} className="flex items-center justify-between border border-white/15 bg-[#1a1035] px-3 py-3">
              <span className="font-bold" style={{ color: g.color }}>{g.name}</span>
              <span className="font-bold tabular-nums" style={{ color: g.color }}>+{fmt(summary.gain[g.id])}</span>
            </div>
          ))}
        </div>
        {!earned && (
          <p className="mt-3 text-center text-[11px] text-white/65">
            NO PLASMA EARNED. HIRE HELPERS TO GENERATE PLASMA WHILE AWAY.
          </p>
        )}
        <button type="button" onClick={onContinue}
          className="mt-5 min-h-[48px] w-full border-2 border-[#b795f2] bg-[#39215b] px-3 py-3 text-[13px] font-bold tracking-widest text-white active:bg-[#52317d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          CONTINUE
        </button>
      </div>
    </div>
  );
}
