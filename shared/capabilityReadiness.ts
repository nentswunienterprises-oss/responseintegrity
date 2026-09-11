export type CapabilityReadinessStatus = "READY" | "NOT_READY";

export type CapabilityReadinessRequirement =
  | {
      code: string;
      kind: "assessment";
      assessmentKey: string;
      label: string;
    }
  | {
      code: string;
      kind: "practical";
      proofKey: string;
      label: string;
    }
  | {
      code: string;
      kind: "oral_defense";
      label: string;
    };

export interface CapabilityReadinessGateDefinition {
  key: string;
  version: number;
  label: string;
  authoritative: false;
  requirements: CapabilityReadinessRequirement[];
}

export interface CapabilityReadinessEvidence {
  passedAssessmentKeys: string[];
  approvedPracticalProofKeys: string[];
  oralDefenseApproved: boolean;
}

export interface CapabilityReadinessResult {
  gateKey: string;
  gateVersion: number;
  label: string;
  authoritative: false;
  status: CapabilityReadinessStatus;
  satisfiedRequirementCodes: string[];
  missingRequirementCodes: string[];
  requirements: Array<CapabilityReadinessRequirement & { satisfied: boolean }>;
}

export const FOUNDATION_CAPABILITY_SHADOW_GATE_V1: CapabilityReadinessGateDefinition = {
  key: "foundation_capability_shadow_gate",
  version: 1,
  label: "Foundation Capability Shadow Gate",
  authoritative: false,
  requirements: [
    {
      code: "assessment.clarity.mastery",
      kind: "assessment",
      assessmentKey: "clarity_mastery_v1",
      label: "Clarity mastery",
    },
    {
      code: "assessment.clarity.retrieval",
      kind: "assessment",
      assessmentKey: "clarity_retrieval_v1",
      label: "Delayed Clarity retrieval",
    },
    {
      code: "assessment.structured_execution.mastery",
      kind: "assessment",
      assessmentKey: "structured_execution_mastery_v1",
      label: "Structured Execution mastery",
    },
    {
      code: "assessment.foundation.transfer",
      kind: "assessment",
      assessmentKey: "clarity_structured_transfer_v1",
      label: "Clarity + Structured Execution interleaved transfer",
    },
    {
      code: "practical.prepare.approved",
      kind: "practical",
      proofKey: "prepare",
      label: "Prepare practical approved",
    },
    {
      code: "practical.execute.approved",
      kind: "practical",
      proofKey: "execute",
      label: "Execute practical approved",
    },
    {
      code: "practical.evidence.approved",
      kind: "practical",
      proofKey: "evidence",
      label: "Evidence practical approved",
    },
    {
      code: "oral_defense.approved",
      kind: "oral_defense",
      label: "Oral Integrity Defense approved",
    },
  ],
};

export function evaluateCapabilityReadiness(
  gate: CapabilityReadinessGateDefinition,
  evidence: CapabilityReadinessEvidence,
): CapabilityReadinessResult {
  const passedAssessmentKeys = new Set(evidence.passedAssessmentKeys);
  const approvedPracticalProofKeys = new Set(evidence.approvedPracticalProofKeys);

  const requirements = gate.requirements.map((requirement) => {
    let satisfied = false;
    if (requirement.kind === "assessment") {
      satisfied = passedAssessmentKeys.has(requirement.assessmentKey);
    } else if (requirement.kind === "practical") {
      satisfied = approvedPracticalProofKeys.has(requirement.proofKey);
    } else {
      satisfied = evidence.oralDefenseApproved;
    }
    return { ...requirement, satisfied };
  });

  const satisfiedRequirementCodes = requirements
    .filter((requirement) => requirement.satisfied)
    .map((requirement) => requirement.code);
  const missingRequirementCodes = requirements
    .filter((requirement) => !requirement.satisfied)
    .map((requirement) => requirement.code);

  return {
    gateKey: gate.key,
    gateVersion: gate.version,
    label: gate.label,
    authoritative: false,
    status: missingRequirementCodes.length === 0 ? "READY" : "NOT_READY",
    satisfiedRequirementCodes,
    missingRequirementCodes,
    requirements,
  };
}
