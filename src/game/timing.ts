/**
 * Separate clock-based idle settlement from actual foreground playtime.
 * A throttled or sleeping browser may skip visibilitychange entirely.
 */
import { OFFLINE_CAP_S } from "./config.ts";

export const ACTIVE_TICK_MAX_S = 1.5;
export const STALLED_TICK_THRESHOLD_S = 3;

export type TickDuration = {
  incomeSeconds: number;
  activeSeconds: number;
  stalled: boolean;
};

/** Use in the visible timer; visibilitychange has its own offline settlement. */
export function measureTick(fromMs: number, toMs: number): TickDuration {
  const elapsed = (toMs - fromMs) / 1000;
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return { incomeSeconds: 0, activeSeconds: 0, stalled: false };
  }
  if (elapsed > STALLED_TICK_THRESHOLD_S) {
    return { incomeSeconds: Math.min(elapsed, OFFLINE_CAP_S), activeSeconds: 0, stalled: true };
  }
  const active = Math.min(elapsed, ACTIVE_TICK_MAX_S);
  return { incomeSeconds: active, activeSeconds: active, stalled: false };
}
