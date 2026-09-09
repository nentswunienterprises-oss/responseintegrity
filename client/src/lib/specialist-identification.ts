export type SpecialistIdentificationType = "" | "sa_id" | "passport";

export function normalizeSpecialistIdentificationType(value: unknown): SpecialistIdentificationType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "sa_id" || normalized === "passport") return normalized;
  return "";
}

export function getSpecialistIdentificationLabel(value: unknown): string {
  const normalized = normalizeSpecialistIdentificationType(value);
  if (normalized === "sa_id") return "South African ID";
  if (normalized === "passport") return "Passport";
  return "";
}

export function deriveSpecialistDateOfBirth(idType: unknown, idNumber: string): string {
  if (normalizeSpecialistIdentificationType(idType) !== "sa_id") return "";

  const digits = String(idNumber || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";

  const now = new Date();
  const currentTwoDigitYear = now.getFullYear() % 100;
  const fullYear = yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy;
  const date = new Date(fullYear, mm - 1, dd);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== fullYear ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return "";
  }

  return `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
