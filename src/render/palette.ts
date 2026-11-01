/** Hand-picked pixel palettes. Each numeric key is a shade in the sprite grid. */
export const OUTLINE = "#382537";
export const SKIN = "#dfa07d";
export const SKIN2 = "#b97c66";
export const NAIL = "#e7b7b1";

/** Warm directional lighting gives the single index finger volume at 10x18. */
export const SKIN_PALETTE: Record<string, string> = {
  "0": OUTLINE,
  "1": SKIN,
  "2": "#9d5d50",
  "3": SKIN2,
  "4": NAIL,
  "5": "#ffe9db",
  "6": "#be8682",
  "7": "#99605c",
  "8": "#f8c6a2",
  "9": "#dfacfa",
};

/** Big toe has thicker, slightly less saturated skin and a broader nail. */
export const TOE_PALETTE: Record<string, string> = {
  "0": "#402939",
  "1": "#d99b7b",
  "2": "#a26556",
  "3": "#b97b66",
  "4": "#e2b0a9",
  "5": "#ffe4d6",
  "6": "#b88883",
  "7": "#965c55",
  "8": "#f5bd99",
  "9": "#e7b3fb",
};

// helpers behind the glass: pressed from the far side, silhouetted
export const BACK_PALETTE: Record<string, string> = { "0": "#150a1e", "1": "#a5704b", "2": "#b9937f", "3": "#8a5a3b" };
export const GHOST_PALETTE: Record<string, string> = { "1": "#a9b8ff", "2": "#eef4ff" };
