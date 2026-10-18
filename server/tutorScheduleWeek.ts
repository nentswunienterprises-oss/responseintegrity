/** Calendar weeks are rendered in the browser's zone, not the API runtime's. */
export function tutorScheduleWeekRange(input: {
  weekStart?: string; weekStartUtc?: string; weekEndUtc?: string;
}, now = new Date()) {
  if (input.weekStartUtc || input.weekEndUtc) {
    const start = new Date(input.weekStartUtc || "");
    const end = new Date(input.weekEndUtc || "");
    const calendar = /^\d{4}-\d{2}-\d{2}$/.test(input.weekStart || "")
      ? new Date(`${input.weekStart}T00:00:00Z`) : new Date(NaN);
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    if (!Number.isFinite(calendar.getTime()) || calendar.getUTCDay() !== 1 ||
        calendar.toISOString().slice(0, 10) !== input.weekStart ||
        !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        Math.abs(start.getTime() - calendar.getTime()) > 14 * 3_600_000 ||
        hours < 166 || hours > 170) {
      throw new Error("Invalid calendar week boundaries");
    }
    return {weekStart: start, weekEnd: new Date(end.getTime() - 1)};
  }
  const base = input.weekStart ? new Date(`${input.weekStart}T00:00:00Z`) : now;
  if (!Number.isFinite(base.getTime())) throw new Error("Invalid weekStart");
  const start = new Date(base);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return {weekStart: start, weekEnd: new Date(start.getTime() + 7 * 86_400_000 - 1)};
}
