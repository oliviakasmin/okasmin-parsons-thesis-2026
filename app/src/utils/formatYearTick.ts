/** Shared year labels for timeline ticks (matches TimelineAxis conventions). */
export function formatYearForTick(year: number): string {
  if (!Number.isFinite(year)) return "";
  if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BCE`;
  return `${year.toLocaleString("en-US")} CE`;
}
