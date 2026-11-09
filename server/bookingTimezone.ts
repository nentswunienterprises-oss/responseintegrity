const OFFSET_ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|([+-])(\d{2}):(\d{2}))$/;

export function normalizeScheduledInstant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const match = OFFSET_ISO_TIMESTAMP.exec(raw);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText || 0);
  const offsetMinute = Number(offsetMinuteText || 0);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 || minute > 59 || second > 59 ||
    (zone !== "Z" && (offsetHour > 23 || offsetMinute > 59))
  ) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function normalizeScheduledTimeZone(value: unknown): string | null {
  const timezone = String(value || "Africa/Johannesburg").trim();
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return null;
  }
}
