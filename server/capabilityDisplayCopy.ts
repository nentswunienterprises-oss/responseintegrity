function stripCapabilityAuthoringLeak(value: string) {
  let cleaned = value.replace(
    /\bAnd this also uses the distinction we just approved in Controlled Discomfort:\s*/i,
    "",
  );

  const trailingAuthoringMarkers = [
    /\s+The live drill [^.]+\.\s*$/i,
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

function cleanCapabilityLearnerLanguage(value: string) {
  return value
    .replace(/\bdecision-eligible\b/gi, "evidence")
    .replace(/\bmodelingOnly\b/g, "teaching-only")
    .replace(/\bsupportLevel\s*:\s*none\b/gi, "no Specialist support")
    .replace(/\bchanged_form\b/gi, "changed form")
    .replace(/\bsame_form\b/gi, "same form")
    .replace(/\bCapability Blueprint\b/gi, "RI rules")
    .replace(/\bCapability Engine\b/gi, "RI")
    .replace(/\bstate engine\b/gi, "RI-OS")
    .replace(/\btransition engine\b/gi, "RI-OS")
    .replace(/\blive training registry\b/gi, "required Training sequence")
    .replace(/\blive drill registry\b/gi, "required Training sequence")
    .replace(/\bdrill registry\b/gi, "Training sequence")
    .replace(/\blive registry\b/gi, "required Training sequence")
    .replace(/\blive TPS evidence contract\b/gi, "TPS requirements")
    .replace(/\blive TPS contract\b/gi, "TPS requirements")
    .replace(/\bsupport contract\b/gi, "support requirement")
    .replace(/\bevidence contract\b/gi, "evidence requirements")
    .replace(/\blive training contract\b/gi, "Training requirements")
    .replace(/\bcontract\b/gi, "rule")
    .replace(/\bcanonical\b/gi, "")
    .replace(/\blineage\b/gi, "history")
    .replace(/\bruntime\b/gi, "session technology")
    .replace(/\bimplementation\b/gi, "design")
    .replace(/\bcertification specification\b/gi, "RI standard")
    .replace(/\bspecification\b/gi, "standard")
    .replace(/\bplatform\b/gi, "Response Integrity")
    .replace(/\barchitecture\b/gi, "structure")
    .replace(/\brunner\/preparation direction\b/gi, "prepared timing")
    .replace(/\bdrill runner\b/gi, "drill")
    .replace(/\brunner\b/gi, "session")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function cleanCapabilityDisplayCopy(value: string) {
  return cleanCapabilityLearnerLanguage(stripCapabilityAuthoringLeak(String(value || "")))
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
