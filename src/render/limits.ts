/**
 * Pure, visual-only helper caps. Ownership, purchases and earnings remain uncapped.
 * The shared budget prevents a late-game forest of helpers obscuring the orb.
 */
export const VISUAL_LIMITS = { fingers: 7, toes: 4, ghosts: 4, stickmen: 4 } as const;
export const MAX_VISIBLE_HELPERS = 12;
export type HelperKind = keyof typeof VISUAL_LIMITS;
export type HelperCounts = Record<HelperKind, number>;

export function visibleHelperCount(count: number, kind: HelperKind): number {
  return Number.isFinite(count) ? Math.max(0, Math.min(VISUAL_LIMITS[kind], Math.floor(count))) : 0;
}

/** Fair round-robin allocation for each occupied helper kind. */
export function visibleHelperCounts(owned: HelperCounts): HelperCounts {
  const kinds: HelperKind[] = ["fingers", "toes", "ghosts", "stickmen"];
  const wishes = Object.fromEntries(kinds.map(kind => [kind, visibleHelperCount(owned[kind], kind)])) as HelperCounts;
  const visible: HelperCounts = { fingers: 0, toes: 0, ghosts: 0, stickmen: 0 };
  let available = MAX_VISIBLE_HELPERS;
  while (available > 0) {
    let allocated = false;
    for (const kind of kinds) {
      if (available <= 0) break;
      if (visible[kind] < wishes[kind]) {
        visible[kind]++;
        available--;
        allocated = true;
      }
    }
    if (!allocated) break;
  }
  return visible;
}
