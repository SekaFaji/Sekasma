/**
 * Tuning knobs: press cadence, helper multipliers, cost bases and the
 * micro-volt ladder. Balance changes happen here, and only here.
 */
import type { GasRecord } from "./types";

// a "crackle" = one press on the glass
export const PRESS_INTERVAL = 2.2; // hired help presses this often
export const HOLD_INTERVAL = 1.2; // manual crackles while held (per finger)
export const TOE_MULT = 8; // a foot presses 8x harder than a finger
export const OFFLINE_CAP_S = 8 * 3600;

export const FIL_BASE: GasRecord = { neon: 12, argon: 30, xenon: 80 };
export const VOLT_BASE: GasRecord = { neon: 6, argon: 16, xenon: 48 };
export const SPLIT_BASE: GasRecord = { neon: 20, argon: 60, xenon: 150 };
export const SPLIT_CAP = 8; // max branches per gas
export const GHOST_MULT = 20; // a ghost hand presses 20x harder than a finger

// a split string: every branch carries 0.75x → 1 split = 1.5x output
export const splitMult = (n: number) => (n <= 0 ? 1 : 0.75 * (1 + n));

// micro-volts: each purchase adds +0.0001V; output = 1 + volts
export const VOLT_STEP = 0.0001;
export const MAX_VOLT_STEPS = 99999;
export const voltValue = (steps: number) => steps * VOLT_STEP;
export const voltMult = (steps: number) => 1 + voltValue(steps);
export const fmtVolts = (steps: number) => voltValue(steps).toFixed(4) + "V";

export const zero3 = (): GasRecord => ({ neon: 0, argon: 0, xenon: 0 });

// past certain levels, hired help demands payment in EVERY currency
export const MIX_LV = { argon: 12, xenon: 25 };
