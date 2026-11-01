/**
 * Rendering policy: every owned helper is represented on the canvas.
 * Economic ownership is never limited by drawing or special-effects budgets.
 * Expensive arc/ripple effects are sampled separately for mobile performance.
 */
export type HelperKind = "fingers" | "toes" | "ghosts" | "stickmen";
export type HelperCounts = Record<HelperKind, number>;

export function visibleHelperCount(count: number, _kind: HelperKind): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** Exact owned counts, with no visual cap or shared visual budget. */
export function visibleHelperCounts(owned: HelperCounts): HelperCounts {
  return {
    fingers: visibleHelperCount(owned.fingers, "fingers"),
    toes: visibleHelperCount(owned.toes, "toes"),
    ghosts: visibleHelperCount(owned.ghosts, "ghosts"),
    stickmen: visibleHelperCount(owned.stickmen, "stickmen"),
  };
}

/** Keep every helper's entire sprite within the ball's 150px canvas.
 * The previous radii grew past the northern edge and sprite clamping
 * collapsed different helpers into a visible straight line at y=0.
 * Rings now step inward while retaining a dense, moving army.
 */
export function helperOrbitRadius(kind: HelperKind, index: number, ballRadius: number): number {
  const ring = Math.max(0, Math.floor(index)) % 3;
  if (kind === "ghosts") return ballRadius - 8 - ring * 11;
  // Larger detailed 45-degree poses must remain entirely in the 150px field.
  // Pull fingers and toes inward, never clamp them to the canvas edges.
  if (kind === "toes") return ballRadius - 16 - ring * 4;
  if (kind === "stickmen") return ballRadius - 3 - ring * 3;
  return ballRadius - 14 - ring * 4;
}

/** Probability per autonomous strike for its costly effects; sprites are NEVER sampled. */
export function helperEffectChance(owned: HelperCounts): number {
  const all = Object.values(owned).reduce((total, count) => total + visibleHelperCount(count, "fingers"), 0);
  return all <= 0 ? 1 : Math.min(1, 160 / all);
}
