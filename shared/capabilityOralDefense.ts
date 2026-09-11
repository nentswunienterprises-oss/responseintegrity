export type CapabilityOralProbeJudgment = "clear" | "partial" | "fail";
export type CapabilityOralDefenseOutcome = "approved" | "repeat_required" | "integrity_review";

export interface CapabilityOralDefenseProbe {
  focusKey: string;
  deepDiveKey: string;
  scenarioSummary: string;
  observedResponseSummary: string;
  judgment: CapabilityOralProbeJudgment;
  integrityConcern: boolean;
}

export interface CapabilityOralDefenseEvaluation {
  outcome: CapabilityOralDefenseOutcome;
  clearCount: number;
  partialCount: number;
  failCount: number;
  integrityConcernCount: number;
}

export const ORAL_DEFENSE_VERSION = 1;
export const ORAL_DEFENSE_MIN_PROBES = 3;
export const ORAL_DEFENSE_MAX_PROBES = 5;

export const ORAL_DEFENSE_ALWAYS_PROBE = [
  {
    focusKey: "system.authority",
    deepDiveKey: "clarity",
    reviewerInstruction:
      "Use an unfamiliar case where the Specialist believes a student should progress but the captured evidence does not support the state change. Probe whether they preserve system authority rather than inventing permission.",
  },
  {
    focusKey: "evidence.contamination",
    deepDiveKey: "clarity",
    reviewerInstruction:
      "Use an unfamiliar case where Specialist support helped create a successful-looking response. Probe whether the Specialist preserves the support in the evidence and refuses to claim independence that was not observed.",
  },
  {
    focusKey: "discernment.escalation_boundary",
    deepDiveKey: "structured_execution",
    reviewerInstruction:
      "Use an unfamiliar situation outside the active recipe. Probe whether the Specialist can preserve what is safe, record the deviation and escalate instead of inventing protocol.",
  },
] as const;

export function evaluateOralDefenseProbes(
  probes: CapabilityOralDefenseProbe[],
): CapabilityOralDefenseEvaluation {
  if (probes.length < ORAL_DEFENSE_MIN_PROBES || probes.length > ORAL_DEFENSE_MAX_PROBES) {
    throw new Error(
      `Oral Integrity Defense requires ${ORAL_DEFENSE_MIN_PROBES}-${ORAL_DEFENSE_MAX_PROBES} probes.`,
    );
  }

  const identities = new Set<string>();
  for (const probe of probes) {
    const identity = `${probe.deepDiveKey}:${probe.focusKey}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate oral defense focus: ${identity}`);
    }
    identities.add(identity);

    if (probe.scenarioSummary.trim().length < 30) {
      throw new Error(`Oral defense scenario summary is too short for ${identity}.`);
    }
    if (probe.observedResponseSummary.trim().length < 30) {
      throw new Error(`Oral defense response evidence is too short for ${identity}.`);
    }
  }

  const clearCount = probes.filter((probe) => probe.judgment === "clear").length;
  const partialCount = probes.filter((probe) => probe.judgment === "partial").length;
  const failCount = probes.filter((probe) => probe.judgment === "fail").length;
  const integrityConcernCount = probes.filter((probe) => probe.integrityConcern).length;

  const outcome: CapabilityOralDefenseOutcome =
    integrityConcernCount > 0
      ? "integrity_review"
      : partialCount === 0 && failCount === 0
        ? "approved"
        : "repeat_required";

  return {
    outcome,
    clearCount,
    partialCount,
    failCount,
    integrityConcernCount,
  };
}
