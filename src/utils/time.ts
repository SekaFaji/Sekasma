/** Duration formatter for play statistics and return summaries. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (days > 0) return `${days}D ${hours}H ${minutes}M`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  if (minutes > 0) return `${minutes}M ${secs}S`;
  return `${secs}S`;
}
