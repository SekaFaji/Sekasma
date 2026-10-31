import React from "react";
import { cracklePower } from "../game/economy";
import { fmtVolts, splitMult } from "../game/config";
import type { Gas, GasRecord, GameState } from "../game/types";
import { fmt } from "../utils/format";
import { formatDuration } from "../utils/time";

/** Read-only progression statistics; the application shell owns the state. */
export default function StatsPanel({
  state, unlockedGases, rates,
}: {
  state: GameState;
  unlockedGases: Gas[];
  rates: GasRecord;
}) {
  return (
    <div className="flex flex-col gap-1 text-[12px]">
      {[
        ["TOTAL CRACKLES", String(state.crackles)],
        ["FINGERS HIRED", String(state.fingers)],
        ["FEET HIRED", String(state.toes)],
        ["GHOST HANDS", String(state.ghosts)],
        ["TOTAL PLAYTIME", formatDuration(state.activeSeconds + state.offlineSeconds)],
        ["ACTIVE ONLINE", formatDuration(state.activeSeconds)],
        ["OFFLINE PLAYTIME", formatDuration(state.offlineSeconds)],
      ].map(([key, value]) => (
        <div key={key} className="flex justify-between border-b border-white/10 px-1 py-1.5">
          <span className="text-white/60">{key}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
      {unlockedGases.map((gas) => (
        <React.Fragment key={gas.id}>
          <div className="mt-1 px-1 text-[11px] font-bold" style={{ color: gas.color }}>
            {gas.name}
          </div>
          {[
            ["LIFETIME", fmt(state.total[gas.id])],
            ["ARCS", `${state.filaments[gas.id]}/${gas.cap}`],
            ["SPLITS", `${state.splits[gas.id]} BRANCHES · X${splitMult(state.splits[gas.id]).toFixed(2)}`],
            ["VOLTS", fmtVolts(state.voltage[gas.id])],
            ["VOLT STEPS", String(state.voltage[gas.id])],
            ["POWER/TAP", fmt(cracklePower(gas, state))],
            ["HELP RATE", fmt(rates[gas.id]) + "/S"],
          ].map(([key, value]) => (
            <div key={key} className="flex justify-between border-b border-white/10 px-1 py-1.5">
              <span className="text-white/60">{key}</span>
              <span className="tabular-nums">{value}</span>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
