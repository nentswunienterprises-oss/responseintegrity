import { format } from "date-fns";

export function formatApplicationDate(value: unknown): string {
  if (!value) return "Date unavailable";

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "PPP");
}