/**
 * Visual-only limits. Helpers above these counts still contribute full economy income.
 * Never use these constants in game/economy.ts.
 */
export const VISUAL_LIMITS = { fingers: 20, toes: 12, ghosts: 10 } as const;
export function visibleHelperCount(count: number, kind: keyof typeof VISUAL_LIMITS): number {
  return Number.isFinite(count) ? Math.max(0, Math.min(VISUAL_LIMITS[kind], Math.floor(count))) : 0;
}
