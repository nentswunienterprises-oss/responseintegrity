export function isDeepDiveModuleBlocked(
  mode: string | undefined,
  developmentCoverageReady: boolean | null | undefined,
) {
  return mode !== "sandbox" || developmentCoverageReady !== true;
}

export function isCapabilityAssessmentBlocked(input: {
  assessmentKey: string;
  mode: string | undefined;
  developmentCoverageReady: boolean | null | undefined;
}) {
  return (
    input.assessmentKey.startsWith("operating_system_") &&
    input.mode === "sandbox" &&
    input.developmentCoverageReady !== true
  );
}
