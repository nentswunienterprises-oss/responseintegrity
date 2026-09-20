import { DIAGNOSIS_OBSERVATION_MATRIX } from "./diagnosisObservationMatrix";

export type ProposalPlacementEvidence = {
  dimensionLabel: string;
  behaviorLabel: string;
  behaviorClass?: string;
};

export type ProposalSupportedDimensionEvidence = {
  dimensionLabel: string;
  supportingBehaviors: string[];
};

export type ProposalPhaseSupportEvidence = {
  phase: string;
  supportedDimensions: ProposalSupportedDimensionEvidence[];
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

export function normalizeProposalPhaseSupportEvidence(
  phaseStates: unknown,
  phase: string,
): ProposalPhaseSupportEvidence | null {
  if (!Array.isArray(phaseStates)) return null;
  const phaseState = phaseStates.find(
    (item) =>
      item &&
      typeof item === "object" &&
      clean((item as Record<string, unknown>).phase) === phase,
  ) as Record<string, unknown> | undefined;
  if (!phaseState || !Array.isArray(phaseState.dimensions)) return null;

  const supportedDimensions = phaseState.dimensions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (clean(row.status) !== "supported") return [];

    const dimensionId = clean(row.dimensionId);
    const dimensionLabel =
      (dimensionId &&
        DIAGNOSIS_OBSERVATION_MATRIX[
          dimensionId as keyof typeof DIAGNOSIS_OBSERVATION_MATRIX
        ]?.label) ||
      dimensionId;
    const behaviorHistory = Array.isArray(row.behaviorHistory)
      ? row.behaviorHistory
      : [];
    const supportingBehaviors = behaviorHistory.flatMap((behavior) => {
      if (!behavior || typeof behavior !== "object") return [];
      const evidence = behavior as Record<string, unknown>;
      if (
        evidence.contaminated === true ||
        clean(evidence.behaviorClass) !== "supported"
      ) {
        return [];
      }
      const label = clean(evidence.behaviorLabel);
      return label ? [label] : [];
    });

    if (!dimensionLabel || supportingBehaviors.length === 0) return [];
    return [{ dimensionLabel, supportingBehaviors }];
  });

  return {
    phase,
    supportedDimensions,
  };
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


const uniqueDimensionLabels = (
  evidence: ProposalPlacementEvidence[],
): string[] =>
  Array.from(
    new Set(
      evidence
        .map((item) => clean(item.dimensionLabel))
        .filter(Boolean),
    ),
  );

const supportedDimensionLabels = (
  evidence: ProposalPhaseSupportEvidence | null,
): string[] =>
  Array.from(
    new Set(
      (evidence?.supportedDimensions || [])
        .map((item) => clean(item.dimensionLabel))
        .filter(Boolean),
    ),
  );

const humanJoin = (items: string[]): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

export function buildDiagnosisProposalSessionStructure(input: {
  phase: string;
  stability: string;
  nextAction: string;
  placementEvidence: ProposalPlacementEvidence[];
  phaseSupportEvidence: ProposalPhaseSupportEvidence | null;
}): string[] {
  const targetDimensions = uniqueDimensionLabels(input.placementEvidence);
  const preservedDimensions = supportedDimensionLabels(
    input.phaseSupportEvidence,
  ).filter((label) => !targetDimensions.includes(label));
  const action = clean(input.nextAction) || `${input.phase} training`;

  if (input.stability === "High") {
    return [
      "Begin with an independent attempt before explanation, correction, or modelling.",
      targetDimensions.length
        ? `Target the remaining ${humanJoin(targetDimensions)} gap directly rather than rebuilding the whole ${input.phase} layer.`
        : `Target only the remaining ${input.phase} instability rather than rebuilding capabilities that already hold.`,
      preservedDimensions.length
        ? `Preserve the already-supported ${humanJoin(preservedDimensions)} behaviors without prompting.`
        : `Preserve the ${input.phase} behaviors that already hold cleanly.`,
      `Use "${action}" as the immediate training structure.`,
      "Do not progress to the next response layer until this phase has earned High Maintenance and then held in a later qualifying confirmation.",
    ];
  }

  if (input.stability === "Medium") {
    return [
      "Start with independent work and add only the minimum support needed to expose the unstable response.",
      targetDimensions.length
        ? `Target ${humanJoin(targetDimensions)} until the response becomes clean and independent.`
        : `Target the diagnosed ${input.phase} instability until the response becomes clean and independent.`,
      preservedDimensions.length
        ? `Keep the already-supported ${humanJoin(preservedDimensions)} behaviors intact while the unstable dimension is rebuilt.`
        : `Keep already-supported ${input.phase} behavior intact while the unstable dimension is rebuilt.`,
      `Use "${action}" before adding the next response condition.`,
    ];
  }

  return [
    "Rebuild the phase-defining response with clear modelling only where the recorded breakdown requires it.",
    "Move back to independent attempts as soon as the student can act without tutor carry.",
    targetDimensions.length
      ? `Target ${humanJoin(targetDimensions)} as the first recovery point.`
      : `Target the diagnosed ${input.phase} breakdown as the first recovery point.`,
    `Use the state-engine move "${action}" before adding the next response condition.`,
  ];
}

export function buildDiagnosisProposalProgressSignals(input: {
  phase: string;
  stability: string;
  nextAction: string;
  placementEvidence: ProposalPlacementEvidence[];
  phaseSupportEvidence: ProposalPhaseSupportEvidence | null;
}): string[] {
  const targetDimensions = uniqueDimensionLabels(input.placementEvidence);
  const preservedDimensions = supportedDimensionLabels(
    input.phaseSupportEvidence,
  ).filter((label) => !targetDimensions.includes(label));

  const signals: string[] = [];

  for (const dimension of targetDimensions) {
    const matchingEvidence = input.placementEvidence.filter(
      (item) => item.dimensionLabel === dimension,
    );
    const hadMinorGap = matchingEvidence.some((item) =>
      /gap|imprecision|minor|drift|hesitat/i.test(item.behaviorLabel),
    );
    signals.push(
      hadMinorGap
        ? `${dimension} becomes clean and precise without the previously observed gap or imprecision.`
        : `${dimension} becomes clean, independent, and repeatable across qualifying opportunities.`,
    );
  }

  if (preservedDimensions.length) {
    signals.push(
      `${humanJoin(preservedDimensions)} remain clean without prompting while the target gap is trained.`,
    );
  }

  if (input.stability === "High") {
    signals.push(
      `${input.phase} holds across repeated independent opportunities strongly enough to earn High Maintenance.`,
    );
    signals.push(
      "A later independent confirmation is still required before phase progression.",
    );
  } else {
    signals.push(
      `${input.phase} moves from the diagnosed ${input.stability} state toward clean, independent support across its required behaviors.`,
    );
  }

  return signals;
}
