export function getTrainingSessionWeekKey(
  value: string | null | undefined,
  timezone?: string | null,
): string | null {
  if (!value) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;

  let safeTimezone = timezone || "Africa/Johannesburg";
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: safeTimezone }).format(instant);
  } catch {
    safeTimezone = "Africa/Johannesburg";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = Number(parts.find((part) => part.type === "year")?.value || NaN);
  const month = Number(parts.find((part) => part.type === "month")?.value || NaN);
  const day = Number(parts.find((part) => part.type === "day")?.value || NaN);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const localDateUtc = Date.UTC(year, month - 1, day);
  const weekday = new Date(localDateUtc).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  return new Date(localDateUtc - mondayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * True only when a scheduled lesson is still in the future.
 * The stored timestamp is an absolute instant, so comparison is timezone-safe.
 */
export function isScheduledTrainingSessionUpcoming(
  value: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const scheduledAt = new Date(value).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt > now;
}
