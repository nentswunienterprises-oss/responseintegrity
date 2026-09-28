export function cleanCapabilityDisplayCopy(value: string) {
  return String(value || "")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/\u2014/g, " - ")
    .replace(/\s*---\s*$/g, "")
    .trim();
}
