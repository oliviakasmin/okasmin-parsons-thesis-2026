/** Shared year labels for timeline ticks (matches TimelineAxis conventions). */
export function formatYearForTick(year: number): string {
  if (!Number.isFinite(year)) return "";
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year} CE`;
}
