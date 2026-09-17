import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";

export type CapabilityOralProbeJudgment = "clear" | "partial" | "fail";
export type CapabilityOralDefenseOutcome = "approved" | "repeat_required" | "integrity_review";
export type CapabilityOralProbeCriticalitySource =
  | "integrity_baseline"
  | "historical_critical_signal"
  | "ordinary_capability";

export interface CapabilityOralCriticalBoundaryLink {
  deepDiveKey: string;
  boundaryKey: string;
}

export interface CapabilityOralProbeRubric {
  version: 1;
  observableStandard: string;
  clearAnchor: string;
  partialAnchor: string;
  failAnchor: string;
  criticalOnFail: boolean;
  criticalitySource: CapabilityOralProbeCriticalitySource;
  criticalBoundaryLinks: CapabilityOralCriticalBoundaryLink[];
}

export interface CapabilityOralDefenseProbeObservation {
  focusKey: string;
  deepDiveKey: string;
  scenarioSummary: string;
  observedResponseSummary: string;
  judgment: CapabilityOralProbeJudgment;
}

export interface CapabilityIssuedOralProbe {
  focusKey: string;
  deepDiveKey: string;
  rubric: CapabilityOralProbeRubric;
}

export interface CapabilityOralDefenseEvaluation {
  outcome: CapabilityOralDefenseOutcome;
  clearCount: number;
  partialCount: number;
  failCount: number;
  criticalFailCount: number;
  criticalFailProbeKeys: string[];
}

export const ORAL_DEFENSE_VERSION = 2;
export const ORAL_PROBE_RUBRIC_VERSION = 1;
export const ORAL_DEFENSE_MIN_PROBES = 3;
export const ORAL_DEFENSE_MAX_PROBES = 5;

function baselineRubric(input: {
  observableStandard: string;
  clearAnchor: string;
  partialAnchor: string;
  failAnchor: string;
  criticalBoundaryLinks: CapabilityOralCriticalBoundaryLink[];
}): CapabilityOralProbeRubric {
  return {
    version: ORAL_PROBE_RUBRIC_VERSION,
    observableStandard: input.observableStandard,
    clearAnchor: input.clearAnchor,
    partialAnchor: input.partialAnchor,
    failAnchor: input.failAnchor,
    criticalOnFail: true,
    criticalitySource: "integrity_baseline",
    criticalBoundaryLinks: input.criticalBoundaryLinks,
  };
}

export const ORAL_DEFENSE_ALWAYS_PROBE = [
  {
    focusKey: "system.authority",
    deepDiveKey: "clarity",
    reviewerInstruction:
      "Use an unfamiliar case where the Specialist believes a student should progress but the captured evidence does not support the state change. Probe whether they preserve system authority rather than inventing permission.",
    rubric: baselineRubric({
      observableStandard:
        "Preserves evidence-based system authority when personal judgment, convenience, or pressure favors a different progression decision.",
      clearAnchor:
        "States that the captured evidence and system-owned movement remain authoritative, preserves the current state, and escalates any genuine mismatch without rewriting evidence.",
      partialAnchor:
        "Recognises that the system owns movement but is uncertain about one boundary, workaround, or escalation step and needs clarification before carrying responsibility.",
      failAnchor:
        "Proposes manually advancing, rewriting evidence, or otherwise overriding the evidence-based state because personal judgment prefers a different outcome.",
      criticalBoundaryLinks: [
        { deepDiveKey: "clarity", boundaryKey: "clarity.no_manual_progression" },
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
      ],
    }),
  },
  {
    focusKey: "evidence.contamination",
    deepDiveKey: "clarity",
    reviewerInstruction:
      "Use an unfamiliar case where Specialist support helped create a successful-looking response. Probe whether the Specialist preserves the support in the evidence and refuses to claim independence that was not observed.",
    rubric: baselineRubric({
      observableStandard:
        "Preserves the evidentiary meaning of Specialist support and refuses to present assisted performance as independent student capability.",
      clearAnchor:
        "Identifies the material support, explains how it changes the claim, and preserves the response as assisted or contaminated rather than independent evidence.",
      partialAnchor:
        "Notices that support occurred but is imprecise about how it changes the evidence classification or downstream claim.",
      failAnchor:
        "Treats materially assisted performance as independent evidence or proposes hiding the support so the response appears stronger than observed.",
      criticalBoundaryLinks: [
        { deepDiveKey: "clarity", boundaryKey: "clarity.modeling_not_independent_evidence" },
        { deepDiveKey: "structured_execution", boundaryKey: "structured_execution.no_disguised_assistance" },
      ],
    }),
  },
  {
    focusKey: "discernment.escalation_boundary",
    deepDiveKey: "structured_execution",
    reviewerInstruction:
      "Use an unfamiliar situation outside the active recipe. Probe whether the Specialist can preserve what is safe, record the deviation and escalate instead of inventing protocol.",
    rubric: baselineRubric({
      observableStandard:
        "Recognises when the situation exceeds the active recipe and preserves safe known boundaries while recording and escalating rather than inventing authority.",
      clearAnchor:
        "Separates what is known from what is not, preserves the safe operating boundary, records the deviation, and escalates the unresolved decision to the authorised path.",
      partialAnchor:
        "Recognises that escalation is needed but is uncertain about one part of the temporary safe action, evidence record, or escalation path.",
      failAnchor:
        "Invents a new operating rule, silently overrides the assigned system path, or resolves an unauthorised exception personally instead of escalating it.",
      criticalBoundaryLinks: [
        { deepDiveKey: "topic_conditioning", boundaryKey: "topic_conditioning.no_manual_override" },
        { deepDiveKey: "session_flow_control", boundaryKey: "session_flow.no_manual_drill_override" },
      ],
    }),
  },
] as const;

function oralProbeIdentity(probe: Pick<CapabilityIssuedOralProbe, "focusKey" | "deepDiveKey">) {
  return `${probe.deepDiveKey}:${probe.focusKey}`;
}

function validateCriticalBoundaryLink(link: CapabilityOralCriticalBoundaryLink) {
  const deepDive = getCapabilityDeepDiveBlueprint(link.deepDiveKey);
  return Boolean(deepDive?.criticalBoundaries.some((boundary) => boundary.key === link.boundaryKey));
}

export function validateCapabilityOralProbeRubric(rubric: CapabilityOralProbeRubric) {
  if (rubric.version !== ORAL_PROBE_RUBRIC_VERSION) {
    throw new Error(`Unsupported Oral Defense probe rubric version: ${String(rubric.version)}.`);
  }
  if (
    !rubric.observableStandard.trim() ||
    !rubric.clearAnchor.trim() ||
    !rubric.partialAnchor.trim() ||
    !rubric.failAnchor.trim()
  ) {
    throw new Error("Oral Defense probe rubrics require observable Clear, Partial, and Fail anchors.");
  }
  if (rubric.criticalBoundaryLinks.some((link) => !validateCriticalBoundaryLink(link))) {
    throw new Error("Oral Defense probe rubric references an unknown RI critical boundary.");
  }
  if (
    rubric.criticalOnFail &&
    rubric.criticalitySource === "integrity_baseline" &&
    rubric.criticalBoundaryLinks.length === 0
  ) {
    throw new Error("Integrity baseline probes require canonical RI critical-boundary lineage.");
  }
  if (!rubric.criticalOnFail && rubric.criticalitySource !== "ordinary_capability") {
    throw new Error("Non-critical Oral Defense probes must use ordinary capability criticality.");
  }
  return rubric;
}

export function buildCapabilityOralRiskProbeRubric(input: {
  focusKey: string;
  deepDiveKey: string;
  hasHistoricalCriticalSignal: boolean;
}): CapabilityOralProbeRubric {
  const deepDive = getCapabilityDeepDiveBlueprint(input.deepDiveKey);
  if (!deepDive || !deepDive.competencyKeys.includes(input.focusKey)) {
    throw new Error(`Cannot build Oral Defense rubric for unknown capability focus ${input.deepDiveKey}:${input.focusKey}.`);
  }

  const criticalOnFail = input.hasHistoricalCriticalSignal;
  const rubric: CapabilityOralProbeRubric = {
    version: ORAL_PROBE_RUBRIC_VERSION,
    observableStandard:
      `Applies ${input.focusKey} correctly in a new fictional case, explains the operating boundary aloud, and chooses an action that preserves RI evidence and system authority.`,
    clearAnchor:
      "Identifies the relevant operating boundary without rescue, chooses a compliant action, and can explain what evidence or authority makes that action correct.",
    partialAnchor:
      "Moves in the correct direction but misses, blurs, or needs prompting on one material boundary before the action would be safe to carry live.",
    failAnchor:
      "Chooses or defends an action that materially contradicts the operating boundary, corrupts the evidence condition, or exceeds Specialist authority.",
    criticalOnFail,
    criticalitySource: criticalOnFail ? "historical_critical_signal" : "ordinary_capability",
    criticalBoundaryLinks: [],
  };

  return validateCapabilityOralProbeRubric(rubric);
}

export function evaluateOralDefenseProbes(
  issuedProbes: CapabilityIssuedOralProbe[],
  observations: CapabilityOralDefenseProbeObservation[],
): CapabilityOralDefenseEvaluation {
  if (
    issuedProbes.length < ORAL_DEFENSE_MIN_PROBES ||
    issuedProbes.length > ORAL_DEFENSE_MAX_PROBES
  ) {
    throw new Error(
      `Oral Integrity Defense requires ${ORAL_DEFENSE_MIN_PROBES}-${ORAL_DEFENSE_MAX_PROBES} issued probes.`,
    );
  }
  if (observations.length !== issuedProbes.length) {
    throw new Error(`Expected ${issuedProbes.length} Oral Defense observations, received ${observations.length}.`);
  }

  const issuedMap = new Map<string, CapabilityIssuedOralProbe>();
  for (const probe of issuedProbes) {
    const identity = oralProbeIdentity(probe);
    if (issuedMap.has(identity)) throw new Error(`Duplicate issued oral defense focus: ${identity}.`);
    validateCapabilityOralProbeRubric(probe.rubric);
    issuedMap.set(identity, probe);
  }

  const observationMap = new Map<string, CapabilityOralDefenseProbeObservation>();
  for (const observation of observations) {
    const identity = oralProbeIdentity(observation);
    if (!issuedMap.has(identity)) {
      throw new Error(`Unexpected oral defense focus: ${identity}.`);
    }
    if (observationMap.has(identity)) {
      throw new Error(`Duplicate oral defense focus: ${identity}.`);
    }
    if (observation.scenarioSummary.trim().length < 30) {
      throw new Error(`Oral defense scenario summary is too short for ${identity}.`);
    }
    if (observation.observedResponseSummary.trim().length < 30) {
      throw new Error(`Oral defense response evidence is too short for ${identity}.`);
    }
    if (!new Set<CapabilityOralProbeJudgment>(["clear", "partial", "fail"]).has(observation.judgment)) {
      throw new Error(`Invalid Oral Defense judgment for ${identity}.`);
    }
    observationMap.set(identity, observation);
  }

  for (const identity of issuedMap.keys()) {
    if (!observationMap.has(identity)) throw new Error(`Missing oral defense focus: ${identity}.`);
  }

  const ordered = issuedProbes.map((probe) => ({
    issued: probe,
    observation: observationMap.get(oralProbeIdentity(probe))!,
  }));
  const clearCount = ordered.filter((entry) => entry.observation.judgment === "clear").length;
  const partialCount = ordered.filter((entry) => entry.observation.judgment === "partial").length;
  const failCount = ordered.filter((entry) => entry.observation.judgment === "fail").length;
  const criticalFailProbeKeys = ordered
    .filter((entry) => entry.observation.judgment === "fail" && entry.issued.rubric.criticalOnFail)
    .map((entry) => oralProbeIdentity(entry.issued));
  const criticalFailCount = criticalFailProbeKeys.length;

  const outcome: CapabilityOralDefenseOutcome =
    criticalFailCount > 0
      ? "integrity_review"
      : partialCount === 0 && failCount === 0
        ? "approved"
        : "repeat_required";

  return {
    outcome,
    clearCount,
    partialCount,
    failCount,
    criticalFailCount,
    criticalFailProbeKeys,
  };
}
