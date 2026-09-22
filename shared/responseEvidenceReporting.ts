export type ResponseEvidenceReportPolarity =
  | "weak"
  | "conditional"
  | "strong"
  | "ineligible";

export type ResponseEvidenceReportSignal = {
  evidenceId: string;
  dimensionId: string;
  rawOption: string | null;
  polarity: ResponseEvidenceReportPolarity;
  label: string;
  claimEligible: boolean;
  recoveredAfterBreakdown: boolean;
  sourceAuthority: "training_evidence" | "diagnosis_evidence";
};

export type ResponseEvidenceReportAuthority =
  | "response_evidence_model_v1"
  | "mixed_response_evidence_legacy"
  | "legacy_compatibility";

const LABEL_BY_DIMENSION: Record<string, { weak: string; conditional: string; strong: string }> = {
  "clarity.vocabulary": {
    weak: "clarity breakdown",
    conditional: "emerging concept recognition",
    strong: "clear concept recall",
  },
  "clarity.method": {
    weak: "clarity breakdown",
    conditional: "emerging method recognition",
    strong: "clear concept recall",
  },
  "clarity.reason": {
    weak: "clarity breakdown",
    conditional: "partial reasoning clarity",
    strong: "clear concept recall",
  },
  "clarity.immediate_apply": {
    weak: "delayed starts",
    conditional: "emerging first response",
    strong: "independent starts",
  },
  "execution.start": {
    weak: "delayed starts",
    conditional: "emerging independent starts",
    strong: "independent starts",
  },
  "execution.step_discipline": {
    weak: "inconsistent step execution",
    conditional: "emerging step discipline",
    strong: "reliable step execution",
  },
  "execution.repeatability": {
    weak: "inconsistent step execution",
    conditional: "emerging repeatability",
    strong: "reliable step execution",
  },
  "execution.independence": {
    weak: "early dependence",
    conditional: "reduced but present dependence",
    strong: "independent execution",
  },
  "difficulty.initial_response": {
    weak: "hesitation under pressure",
    conditional: "emerging control under difficulty",
    strong: "control under difficulty",
  },
  "difficulty.first_step_control": {
    weak: "structure breakdown",
    conditional: "emerging first-step control",
    strong: "control under difficulty",
  },
  "difficulty.tolerance": {
    weak: "hesitation under pressure",
    conditional: "emerging difficulty tolerance",
    strong: "control under difficulty",
  },
  "difficulty.rescue_dependence": {
    weak: "early dependence",
    conditional: "reduced but present rescue dependence",
    strong: "control under difficulty",
  },
  "time.start": {
    weak: "hesitation under pressure",
    conditional: "emerging timed-start control",
    strong: "controlled pace",
  },
  "time.structure": {
    weak: "structure breakdown",
    conditional: "emerging structure retention",
    strong: "structure retention",
  },
  "time.pace": {
    weak: "pace loss",
    conditional: "emerging pace control",
    strong: "controlled pace",
  },
  "time.completion_integrity": {
    weak: "structure breakdown",
    conditional: "emerging completion integrity",
    strong: "structure retention",
  },
};

const labelFor = (
  dimensionId: string,
  polarity: Exclude<ResponseEvidenceReportPolarity, "ineligible">,
) => LABEL_BY_DIMENSION[dimensionId]?.[polarity] || (
  polarity === "strong"
    ? "supported response"
    : polarity === "weak"
      ? "response breakdown"
      : "conditional response"
);

const sourceDrillIdFor = (payload: any) =>
  String(
    payload?.responseSnapshot?.source?.sourceDrillId ||
      payload?.responseSnapshot?.sourceDrillId ||
      payload?.sourceDrillId ||
      "evidence",
  ).trim() || "evidence";

const latestEligibleTrainingOccurrence = (dimension: any) => {
  const rows = Array.isArray(dimension?.evidence) ? dimension.evidence : [];
  return [...rows].reverse().find((row) =>
    !["not_observed", "confounded"].includes(String(row?.evidenceClass || ""))
  ) || null;
};

const trainingPolarity = (state: unknown): ResponseEvidenceReportPolarity => {
  if (state === "BREAKDOWN") return "weak";
  if (state === "SUPPORTED") return "strong";
  if (state === "CONDITIONAL" || state === "NEAR_STABLE") return "conditional";
  return "ineligible";
};

const diagnosisPolarity = (behaviorClass: unknown): ResponseEvidenceReportPolarity => {
  if (behaviorClass === "breakdown") return "weak";
  if (behaviorClass === "supported") return "strong";
  if (behaviorClass === "conditional" || behaviorClass === "near_stable") return "conditional";
  return "ineligible";
};

const extractTrainingSignals = (payload: any): ResponseEvidenceReportSignal[] => {
  const evaluation = payload?.summary?.evidence;
  if (
    payload?.summary?.decisionAuthority !== "evidence_native" ||
    evaluation?.status !== "evaluated" ||
    !Array.isArray(evaluation?.dimensions)
  ) {
    return [];
  }

  const sourceDrillId = sourceDrillIdFor(payload);
  return evaluation.dimensions.map((dimension: any) => {
    const dimensionId = String(dimension?.dimensionId || "").trim();
    const polarity = trainingPolarity(dimension?.state);
    const last = latestEligibleTrainingOccurrence(dimension);
    const recoveredAfterBreakdown =
      dimension?.recoveredAfterBreakdown === true ||
      (dimension?.state === "SUPPORTED" && Number(dimension?.breakdownCount || 0) > 0);

    return {
      evidenceId: [sourceDrillId, "resolved", dimensionId].join("::"),
      dimensionId,
      rawOption: last ? String(last.rawOption || "").trim() || null : null,
      polarity,
      label:
        polarity === "ineligible"
          ? "insufficient decision-eligible evidence"
          : labelFor(dimensionId, polarity),
      claimEligible: polarity === "weak" || polarity === "strong",
      recoveredAfterBreakdown,
      sourceAuthority: "training_evidence" as const,
    };
  });
};

const extractDiagnosisSignals = (payload: any): ResponseEvidenceReportSignal[] => {
  const summary = payload?.summary;
  if (
    summary?.decisionAuthority !== "behavioral_evidence" ||
    !Array.isArray(summary?.phaseStates)
  ) {
    return [];
  }

  const sourceDrillId = sourceDrillIdFor(payload);
  return summary.phaseStates.flatMap((phaseState: any) =>
    (Array.isArray(phaseState?.dimensions) ? phaseState.dimensions : []).map((dimension: any) => {
      const dimensionId = String(dimension?.dimensionId || "").trim();
      const history = Array.isArray(dimension?.behaviorHistory)
        ? dimension.behaviorHistory.filter((entry: any) => entry?.contaminated !== true)
        : [];
      const last = history[history.length - 1] || null;
      const polarity = diagnosisPolarity(last?.behaviorClass);

      return {
        evidenceId: [sourceDrillId, "resolved", dimensionId].join("::"),
        dimensionId,
        rawOption: last ? String(last.behaviorLabel || "").trim() || null : null,
        polarity,
        label:
          polarity === "ineligible"
            ? "insufficient decision-eligible evidence"
            : labelFor(dimensionId, polarity),
        claimEligible: polarity === "weak" || polarity === "strong",
        recoveredAfterBreakdown: false,
        sourceAuthority: "diagnosis_evidence" as const,
      };
    }),
  );
};

export const extractAuthoritativeResponseEvidenceSignals = (
  drillPayload: unknown,
): ResponseEvidenceReportSignal[] => {
  if (!drillPayload || typeof drillPayload !== "object") return [];
  const payload = drillPayload as any;
  const drillType = String(payload?.drillType || "").trim().toLowerCase();

  if (drillType === "training") {
    return extractTrainingSignals(payload);
  }
  if (
    drillType === "diagnosis" ||
    (drillType === "handover_verification" && payload?.handoverMode === "targeted_re_diagnosis")
  ) {
    return extractDiagnosisSignals(payload);
  }
  return [];
};

export const reportClaimLabelsFromEvidence = (
  signals: ResponseEvidenceReportSignal[],
) =>
  Array.from(
    new Set(
      signals
        .filter((signal) => signal.claimEligible)
        .map((signal) =>
          signal.recoveredAfterBreakdown && signal.polarity === "strong"
            ? `recovered to ${signal.label}`
            : signal.label
        )
        .filter(Boolean),
    ),
  );

export const resolveResponseEvidenceReportAuthority = (
  signalGroups: ResponseEvidenceReportSignal[][],
): ResponseEvidenceReportAuthority => {
  if (signalGroups.length === 0) return "legacy_compatibility";
  const authoritativeCount = signalGroups.filter((signals) => signals.length > 0).length;
  if (authoritativeCount === signalGroups.length) return "response_evidence_model_v1";
  if (authoritativeCount > 0) return "mixed_response_evidence_legacy";
  return "legacy_compatibility";
};
