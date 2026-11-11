const DEFAULT_TIME_ZONE = "Africa/Johannesburg";

export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Convert a date/time input's browser-local wall clock into an explicit instant. */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function formatScheduledSessionTime(value: string | null | undefined, timezone?: string | null): string {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Time unavailable";
  let safeTimezone = timezone || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: safeTimezone }).format(parsed);
  } catch {
    safeTimezone = DEFAULT_TIME_ZONE;
  }
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: safeTimezone,
  }).format(parsed);
}
