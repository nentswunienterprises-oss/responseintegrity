function stripCapabilityAuthoringLeak(value: string) {
  let cleaned = value.replace(
    /\bAnd this also uses the distinction we just approved in Controlled Discomfort:\s*/i,
    "",
  );

  const trailingAuthoringMarkers = [
    /\s+Topic Conditioning:\s*45\/45 authored\..*$/i,
    /\s+That gives us\s+[^.]*\d+\/45[^.]*\.(?:.*)$/i,
    /\s+That is much tighter\.\s+I would replace the original.*$/i,
    /\s+And this caught a source problem too:.*$/i,
    /\s+That feels much closer to the actual condition.*$/i,
  ];

  for (const marker of trailingAuthoringMarkers) {
    cleaned = cleaned.replace(marker, "");
  }
  return cleaned;
}

export function cleanCapabilityDisplayCopy(value: string) {
  return stripCapabilityAuthoringLeak(String(value || ""))
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
