export type SandboxCompletionAuthority = {
  route?: string | null;
  transitionReason?: string | null;
  targetPhase?: string | null;
};

export type SandboxTargetedRediagnosisCopy = {
  sessionResult: string;
  currentStateLabel: "Recorded checkpoint";
  nextFocusLabel: "Required Next Route";
  nextFocus: string;
  nextConstraint: string;
  footer: string;
};

export function sandboxTargetedRediagnosisCopy(input: {
  topic: string;
  authority: SandboxCompletionAuthority | null | undefined;
}): SandboxTargetedRediagnosisCopy | null {
  const route = String(input.authority?.route || "").trim().toLowerCase();
  const transitionReason = String(input.authority?.transitionReason || "")
    .trim()
    .toLowerCase();
  const requiresTargetedRediagnosis =
    route === "targeted_rediagnosis" ||
    transitionReason === "targeted re-diagnosis required";

  if (!requiresTargetedRediagnosis) return null;

  const targetPhase = String(input.authority?.targetPhase || "").trim();
  const target = targetPhase || "the earliest unsupported phase";

  return {
    sessionResult: `${input.topic}: targeted re-diagnosis required beginning at ${target}`,
    currentStateLabel: "Recorded checkpoint",
    nextFocusLabel: "Required Next Route",
    nextFocus: `Run targeted evidence-native re-diagnosis beginning at ${target}.`,
    nextConstraint:
      "Do not continue ordinary Training until targeted re-diagnosis establishes a trustworthy entry state.",
    footer:
      "The next confirmed weekly lesson must open targeted re-diagnosis before ordinary Training can resume.",
  };
}
