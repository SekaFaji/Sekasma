import type { GameState, HelperId } from "../game/types";
import {
  BASE_CAPACITY, CAPACITY_STEP, HELPERS, MIN_PRESTIGE_SCORE,
  capacityUpgradeCost, helperCapacity, prestigeReward, runPrestigeScore,
} from "../game/prestige";
import { fmt } from "../utils/format";

const HELPER_NAMES: Record<HelperId, string> = {
  finger: "FINGERS", toe: "BIG TOES", ghost: "GHOST HANDS", stickman: "STICKMEN",
};
export type PrestigeConfirmStep = 0 | 1 | 2;

export default function PrestigePanel({ state, step, onStart, onNext, onCancel, onConfirm, onBuyCapacity }: {
  state: GameState;
  step: PrestigeConfirmStep;
  onStart: () => void; onNext: () => void; onCancel: () => void; onConfirm: () => void;
  onBuyCapacity: (kind: HelperId) => void;
}) {
  const gain = prestigeReward(state);
  const score = runPrestigeScore(state);
  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <section className="border border-[#ba8cff]/35 bg-[#19102f] p-2">
        <h2 className="text-[13px] font-bold tracking-widest text-[#e2caff]">PRESTIGE</h2>
        <p className="mt-1 leading-relaxed text-white/70">
          RESTART A RUN TO EARN PERMANENT SPARKS. EXPAND HOW MANY HELPERS YOU CAN HIRE.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          {[
            ["SPARKS", String(state.prestige.sparks)],
            ["PRESTIGES", String(state.prestige.cycles)],
            ["NEXT RESET", `+${gain}`],
          ].map(([label, value]) => (
            <div key={label} className="border border-white/15 bg-[#100a25] px-1 py-2">
              <div className="text-[8px] tracking-wide text-white/55">{label}</div>
              <div className="mt-1 text-[16px] font-bold tabular-nums text-[#e4bbff]">{value}</div>
            </div>
          ))}
        </div>
      </section>
      <section aria-label="Permanent helper capacity" className="border border-white/15 bg-[#120c27] p-2">
        <h3 className="mb-1.5 font-bold tracking-widest text-[#d4b6ff]">PERMANENT HELPER CAPACITY</h3>
        <p className="mb-2 text-[10px] text-white/60">UPGRADES COST SPARKS AND SURVIVE EVERY PRESTIGE.</p>
        {HELPERS.map(kind => {
          const cost = capacityUpgradeCost(state, kind);
          const capacity = helperCapacity(state, kind);
          const canBuy = state.prestige.sparks >= cost;
          return (
            <div key={kind} className="mb-1.5 flex min-h-[46px] items-center gap-2 border border-white/15 bg-[#1b1233] px-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white">{HELPER_NAMES[kind]}</div>
                <div className="text-[10px] text-white/70">
                  CAP {capacity} · NEXT +{CAPACITY_STEP[kind]}
                </div>
                <div className="text-[9px] text-white/45">
                  START {BASE_CAPACITY[kind]} · LEVEL {state.prestige.capacityLevels[kind]}
                </div>
              </div>
              <button type="button" onClick={() => onBuyCapacity(kind)} disabled={!canBuy}
                aria-label={`Increase ${HELPER_NAMES[kind]} capacity by ${CAPACITY_STEP[kind]} for ${cost} Sparks`}
                className="h-[40px] w-[85px] shrink-0 border border-[#af80e2] bg-[#3b215c] px-1 font-bold text-white disabled:border-white/20 disabled:bg-[#151027] disabled:text-white/40">
                +{CAPACITY_STEP[kind]} <span className="block text-[9px]">{cost} SPARKS</span>
              </button>
            </div>
          );
        })}
      </section>
      <section aria-label="Prestige reset" className="border border-[#af80e2]/50 bg-[#1a1030] p-2">
        <h3 className="font-bold tracking-widest text-[#e2caff]">START A NEW RUN</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-white/70">
          UNLOCK KRYPTON AND EARN {fmt(MIN_PRESTIGE_SCORE)} WEIGHTED PLASMA THIS RUN.
          CURRENT: {fmt(score)}.
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-[#c4f6dd]">
          KEEP: LIFETIME EARNINGS, TIME, CRACKLES, SPARKS AND PERMANENT CAPACITY.
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-[#ffd1be]">
          RESET: HELPER COUNTS, GAS UNLOCKS, PLASMA BALANCES AND PURCHASED POWER UPGRADES.
        </p>
        {step === 0 ? (
          <button type="button" disabled={gain === 0} onClick={onStart}
            className="mt-2 min-h-[44px] w-full border border-[#c59af4] bg-[#362054] font-bold text-white disabled:border-white/20 disabled:bg-[#110d21] disabled:text-white/50">
            {gain > 0 ? `PRESTIGE FOR +${gain} SPARKS` : "PRESTIGE NOT READY"}
          </button>
        ) : (
          <div role="group" aria-label="Confirm Prestige" className="mt-2 border border-[#d7a6ff]/40 bg-[#27163f] p-2">
            <p className="mb-2 font-bold text-white">
              {step === 1 ? "CONFIRM NEW RUN? PURCHASED HELPERS AND UPGRADES WILL RESET." :
                "FINAL CONFIRMATION: RESET THIS RUN AND CLAIM SPARKS?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onCancel} className="min-h-[44px] border border-white/40 bg-[#130d27] font-bold">CANCEL</button>
              <button type="button" onClick={step === 1 ? onNext : onConfirm}
                className="min-h-[44px] border border-[#d6a0ff] bg-[#4b266b] font-bold">
                {step === 1 ? "CONTINUE" : "CONFIRM PRESTIGE"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
