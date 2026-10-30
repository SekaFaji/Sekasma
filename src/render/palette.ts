/** Color constants for the hand-picked sprite families. */

export const SKIN = "#f0a875";
export const SKIN2 = "#c97f52"; // shaded underside
export const NAIL = "#ffe3d0";
export const OUTLINE = "#2a1233";
export const SKIN_PALETTE: Record<string, string> = { "0": OUTLINE, "1": SKIN, "2": NAIL, "3": SKIN2 };
// helpers behind the glass: pressed from the far side, silhouetted
export const BACK_PALETTE: Record<string, string> = { "0": "#150a1e", "1": "#a5704b", "2": "#b9937f", "3": "#8a5a3b" };
export const GHOST_PALETTE: Record<string, string> = { "1": "#a9b8ff", "2": "#eef4ff" };
