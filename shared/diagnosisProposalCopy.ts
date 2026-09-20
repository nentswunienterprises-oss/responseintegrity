export type ProposalPlacementEvidence = {
  dimensionLabel: string;
  behaviorLabel: string;
  behaviorClass?: string;
};

type ProposalCopyInput = {
  phase: string;
  stability: string;
};

const clean = (value: unknown) => String(value || "").trim();

export function normalizeProposalPlacementEvidence(
  value: unknown,
): ProposalPlacementEvidence[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const dimensionLabel = clean(row.dimensionLabel);
    const behaviorLabel = clean(row.behaviorLabel);
    if (!dimensionLabel || !behaviorLabel) return [];

    return [{
      dimensionLabel,
      behaviorLabel,
      behaviorClass: clean(row.behaviorClass) || undefined,
    }];
  });
}

export function formatProposalPlacementEvidence(
  placementEvidence: ProposalPlacementEvidence[],
): string {
  return placementEvidence
    .map((item) => `${item.dimensionLabel}: ${item.behaviorLabel}`)
    .join("; ");
}

function stabilityMeaning({ phase, stability }: ProposalCopyInput): string {
  if (stability === "Low") {
    return `The phase-defining ${phase} capability broke at meaningful exposure, so training begins by rebuilding that response layer.`;
  }
  if (stability === "Medium") {
    return `The ${phase} capability is present, but the observed response was materially conditional or unstable, so it needs reinforcement before progression.`;
  }
  if (stability === "High") {
    return `The ${phase} capability is substantially present and usable, but the remaining instability must be resolved before this phase can be considered sustained.`;
  }
  if (stability === "High Maintenance") {
    return `The ${phase} capability has met the strong-performance threshold and is in sustained confirmation before progression.`;
  }
  return `Training begins from the diagnosed ${phase} entry state.`;
}

export function buildDiagnosisProposalFocus(input: {
  studentFirstName: string;
  phase: string;
  stability: string;
}): string {
  return `Training begins at ${input.phase} with ${input.stability} starting stability. ${stabilityMeaning(input)}`;
}

export function buildDiagnosisProposalWhyEntry(input: {
  phase: string;
  placementEvidence: ProposalPlacementEvidence[];
  reason?: unknown;
}): string {
  const evidenceText = formatProposalPlacementEvidence(input.placementEvidence);
  if (evidenceText) {
    return `${input.phase} is the first response layer that did not fully clear. The deciding behavioral evidence was ${evidenceText}.`;
  }

  const reason = clean(input.reason);
  return reason ||
    `${input.phase} was selected from the student's recorded response behavior.`;
}

function firstTrainingMove(nextAction: string): string {
  const action = clean(nextAction);
  if (!action) return "Training will begin from the diagnosed entry state.";
  const runMatch = action.match(/^Run\s+(.+)$/i);
  if (runMatch) return `The first training move is a ${runMatch[1]}.`;
  return `The first training move is: ${action}.`;
}

export function buildDiagnosisProposalPriority(input: {
  studentFirstName: string;
  phase: string;
  stability: string;
  nextAction: string;
  placementEvidence: ProposalPlacementEvidence[];
}): string {
  const dimensions = Array.from(
    new Set(input.placementEvidence.map((item) => item.dimensionLabel)),
  );
  const target = dimensions.length
    ? dimensions.join(" and ")
    : `the remaining ${input.phase} instability`;
  const confirmation =
    input.stability === "High"
      ? "We will tighten that remaining gap and confirm the response holds before any phase progression."
      : "We will target that observed instability before adding the next response layer.";

  return `${firstTrainingMove(input.nextAction)} The immediate focus is ${target}. ${confirmation}`;
}

export function buildDiagnosisProposalRecommendedPlan(input: {
  topic: string;
  phase: string;
  stability: string;
  nextAction: string;
}): string {
  return `Training starts at ${input.phase} / ${input.stability} for ${input.topic}. First action: ${clean(input.nextAction) || "Continue phase work"}.`;
}

export function buildDiagnosisProposalJustification(input: {
  topic: string;
  phase: string;
  stability: string;
  reason: unknown;
  nextAction: string;
  placementEvidence: ProposalPlacementEvidence[];
}): string {
  const evidenceText = formatProposalPlacementEvidence(input.placementEvidence);
  const reason = clean(input.reason);
  const evidenceSentence = evidenceText
    ? ` Decisive evidence: ${evidenceText}.`
    : "";
  const reasonSentence = reason ? ` ${reason}` : "";

  return `Behavioral diagnosis placed ${input.topic} at ${input.phase} / ${input.stability}.${evidenceSentence}${reasonSentence} First training action: ${clean(input.nextAction) || "Continue phase work"}.`;
}
