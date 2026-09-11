import { createHash } from "node:crypto";
import { ORAL_DEFENSE_ALWAYS_PROBE } from "@shared/capabilityOralDefense";

export type CapabilityRiskQuestionResult = {
  competencyKey: string;
  deepDiveKey: string;
  correct: boolean;
  criticalFail: boolean;
};

export type CapabilityAssessmentRiskEvidence = {
  id: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  completedAt: string | Date;
  questionResults: CapabilityRiskQuestionResult[];
};

export type CapabilityPracticalRiskEvidence = {
  id: string;
  proofKey: string;
  proofVersion: number;
  attemptNumber: number;
  competencyLinks: Array<{ deepDiveKey: string; competencyKey: string }>;
  outcome: "submitted" | "approved" | "repeat_required" | "integrity_review";
  submittedAt: string | Date;
  reviewedAt?: string | Date | null;
};

export type CapabilityOralRiskSignal = {
  focusKey: string;
  deepDiveKey: string;
  incorrectCount: number;
  criticalFailCount: number;
  practicalRepeatCount: number;
  practicalIntegrityCount: number;
  latestSeenAt: string;
};

export type CapabilityOralDefenseProbeBrief = {
  focusKey: string;
  deepDiveKey: string;
  source: "evidence_risk" | "integrity_baseline";
  reviewerInstruction: string;
  incorrectCount?: number;
  criticalFailCount?: number;
  practicalRepeatCount?: number;
  practicalIntegrityCount?: number;
};

function iso(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid capability evidence timestamp: ${String(value)}`);
  return parsed.toISOString();
}

function riskIdentity(deepDiveKey: string, focusKey: string) {
  return `${deepDiveKey}:${focusKey}`;
}

function riskScore(risk?: CapabilityOralRiskSignal | null) {
  if (!risk) return 0;
  return (
    risk.practicalIntegrityCount * 100 +
    risk.criticalFailCount * 25 +
    risk.practicalRepeatCount * 8 +
    risk.incorrectCount * 2
  );
}

export function buildCapabilityOralRiskSignals(
  assessments: CapabilityAssessmentRiskEvidence[],
  practicals: CapabilityPracticalRiskEvidence[],
): CapabilityOralRiskSignal[] {
  const risks = new Map<string, CapabilityOralRiskSignal>();

  const ensureRisk = (focusKey: string, deepDiveKey: string, seenAt: string) => {
    const identity = riskIdentity(deepDiveKey, focusKey);
    const current = risks.get(identity) || {
      focusKey,
      deepDiveKey,
      incorrectCount: 0,
      criticalFailCount: 0,
      practicalRepeatCount: 0,
      practicalIntegrityCount: 0,
      latestSeenAt: seenAt,
    };
    if (seenAt > current.latestSeenAt) current.latestSeenAt = seenAt;
    risks.set(identity, current);
    return current;
  };

  for (const assessment of assessments) {
    const completedAt = iso(assessment.completedAt);
    for (const question of assessment.questionResults) {
      const focusKey = String(question.competencyKey || "").trim();
      const deepDiveKey = String(question.deepDiveKey || "").trim();
      if (!focusKey || !deepDiveKey) continue;
      if (question.correct && !question.criticalFail) continue;

      const current = ensureRisk(focusKey, deepDiveKey, completedAt);
      if (!question.correct) current.incorrectCount += 1;
      if (question.criticalFail) current.criticalFailCount += 1;
    }
  }

  for (const practical of practicals) {
    if (practical.outcome !== "repeat_required" && practical.outcome !== "integrity_review") continue;
    const seenAt = iso(practical.reviewedAt || practical.submittedAt);
    for (const link of practical.competencyLinks) {
      const focusKey = String(link.competencyKey || "").trim();
      const deepDiveKey = String(link.deepDiveKey || "").trim();
      if (!focusKey || !deepDiveKey) continue;
      const current = ensureRisk(focusKey, deepDiveKey, seenAt);
      if (practical.outcome === "repeat_required") current.practicalRepeatCount += 1;
      if (practical.outcome === "integrity_review") current.practicalIntegrityCount += 1;
    }
  }

  return Array.from(risks.values()).sort(
    (left, right) => riskScore(right) - riskScore(left) || right.latestSeenAt.localeCompare(left.latestSeenAt),
  );
}

function riskInstructionSuffix(risk?: CapabilityOralRiskSignal | null) {
  if (!risk) return "";
  const reasons: string[] = [];
  if (risk.criticalFailCount > 0) reasons.push(`${risk.criticalFailCount} critical-boundary flag${risk.criticalFailCount === 1 ? "" : "s"}`);
  if (risk.incorrectCount > 0) reasons.push(`${risk.incorrectCount} incorrect digital response${risk.incorrectCount === 1 ? "" : "s"}`);
  if (risk.practicalRepeatCount > 0) reasons.push(`${risk.practicalRepeatCount} practical repeat decision${risk.practicalRepeatCount === 1 ? "" : "s"}`);
  if (risk.practicalIntegrityCount > 0) reasons.push(`${risk.practicalIntegrityCount} practical integrity escalation${risk.practicalIntegrityCount === 1 ? "" : "s"}`);
  return reasons.length
    ? ` This focus is elevated by stored evidence: ${reasons.join(", ")}. Do not reuse a known assessment item.`
    : "";
}

export function buildCapabilityOralProbeBriefs(
  risks: CapabilityOralRiskSignal[],
): CapabilityOralDefenseProbeBrief[] {
  const riskByIdentity = new Map(risks.map((risk) => [riskIdentity(risk.deepDiveKey, risk.focusKey), risk]));
  const baselineIds = new Set(ORAL_DEFENSE_ALWAYS_PROBE.map((probe) => riskIdentity(probe.deepDiveKey, probe.focusKey)));

  const baseline = ORAL_DEFENSE_ALWAYS_PROBE.map((probe, index) => {
    const risk = riskByIdentity.get(riskIdentity(probe.deepDiveKey, probe.focusKey));
    return {
      focusKey: probe.focusKey,
      deepDiveKey: probe.deepDiveKey,
      source: risk ? ("evidence_risk" as const) : ("integrity_baseline" as const),
      reviewerInstruction: `${probe.reviewerInstruction}${riskInstructionSuffix(risk)}`,
      incorrectCount: risk?.incorrectCount,
      criticalFailCount: risk?.criticalFailCount,
      practicalRepeatCount: risk?.practicalRepeatCount,
      practicalIntegrityCount: risk?.practicalIntegrityCount,
      _score: riskScore(risk),
      _order: index,
    };
  });

  const targeted = risks
    .filter((risk) => !baselineIds.has(riskIdentity(risk.deepDiveKey, risk.focusKey)))
    .slice(0, 2)
    .map((risk, index) => ({
      focusKey: risk.focusKey,
      deepDiveKey: risk.deepDiveKey,
      source: "evidence_risk" as const,
      incorrectCount: risk.incorrectCount,
      criticalFailCount: risk.criticalFailCount,
      practicalRepeatCount: risk.practicalRepeatCount,
      practicalIntegrityCount: risk.practicalIntegrityCount,
      reviewerInstruction:
        `Use a new fictional scenario to probe ${risk.focusKey}. Require the Specialist to reason aloud, preserve the active operating boundary, and defend the decision they would take.` +
        riskInstructionSuffix(risk),
      _score: riskScore(risk),
      _order: ORAL_DEFENSE_ALWAYS_PROBE.length + index,
    }));

  return [...baseline, ...targeted]
    .sort((left, right) => right._score - left._score || left._order - right._order)
    .map(({ _score, _order, ...probe }) => probe);
}

export function buildCapabilityEvidenceFingerprint(
  assessments: CapabilityAssessmentRiskEvidence[],
  practicals: CapabilityPracticalRiskEvidence[],
) {
  const assessmentSnapshot = assessments.map((assessment) => ({
    id: assessment.id,
    assessmentKey: assessment.assessmentKey,
    bankVersion: assessment.bankVersion,
    attemptNumber: assessment.attemptNumber,
    questionResults: assessment.questionResults,
    completedAt: iso(assessment.completedAt),
  }));
  const practicalSnapshot = practicals.map((practical) => ({
    id: practical.id,
    proofKey: practical.proofKey,
    proofVersion: practical.proofVersion,
    attemptNumber: practical.attemptNumber,
    competencyLinks: practical.competencyLinks,
    outcome: practical.outcome,
    reviewedAt: practical.reviewedAt ? iso(practical.reviewedAt) : null,
    submittedAt: iso(practical.submittedAt),
  }));

  return createHash("sha256")
    .update(JSON.stringify({ assessmentSnapshot, practicalSnapshot }))
    .digest("hex");
}

export function buildCapabilityOralBriefId(input: {
  tutorAssignmentId: string;
  defenseVersion: number;
  attemptNumber: number;
  evidenceFingerprint: string;
  probes: CapabilityOralDefenseProbeBrief[];
}) {
  return createHash("sha256")
    .update(
      [
        input.tutorAssignmentId,
        String(input.defenseVersion),
        String(input.attemptNumber),
        input.evidenceFingerprint,
        input.probes.map((probe) => `${probe.deepDiveKey}:${probe.focusKey}:${probe.source}`).join("|"),
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);
}
