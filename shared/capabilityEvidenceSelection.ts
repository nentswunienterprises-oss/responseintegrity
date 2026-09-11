import type { CapabilityReadinessEvidence } from "./capabilityReadiness";

export interface CapabilityAssessmentEvidenceSnapshot {
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  passed: boolean;
  completedAt: string | Date;
}

export interface CapabilityActiveAssessmentVersion {
  assessmentKey: string;
  bankVersion: number;
}

export interface CapabilityPracticalEvidenceSnapshot {
  proofKey: string;
  proofVersion: number;
  attemptNumber: number;
  outcome: "submitted" | "approved" | "repeat_required" | "integrity_review";
  submittedAt: string | Date;
  reviewedAt?: string | Date | null;
}

export interface CapabilityCurrentPracticalVersion {
  proofKey: string;
  proofVersion: number;
}

export interface CapabilityOralDefenseEvidenceSnapshot {
  defenseVersion: number;
  attemptNumber: number;
  outcome: "approved" | "repeat_required" | "integrity_review";
  completedAt: string | Date;
}

export interface CurrentCapabilityEvidenceSelectionInput {
  assessments: CapabilityAssessmentEvidenceSnapshot[];
  activeAssessmentVersions: CapabilityActiveAssessmentVersion[];
  practicals: CapabilityPracticalEvidenceSnapshot[];
  currentPracticalVersions: CapabilityCurrentPracticalVersion[];
  oralDefenses: CapabilityOralDefenseEvidenceSnapshot[];
  currentOralDefenseVersion: number;
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function latestByKey<T>(
  records: T[],
  keyOf: (record: T) => string,
  attemptOf: (record: T) => number,
  timeOf: (record: T) => number,
) {
  const latest = new Map<string, T>();
  for (const record of records) {
    const key = keyOf(record);
    const current = latest.get(key);
    if (!current) {
      latest.set(key, record);
      continue;
    }

    const attemptDelta = attemptOf(record) - attemptOf(current);
    if (attemptDelta > 0 || (attemptDelta === 0 && timeOf(record) > timeOf(current))) {
      latest.set(key, record);
    }
  }
  return latest;
}

export function selectCurrentCapabilityReadinessEvidence(
  input: CurrentCapabilityEvidenceSelectionInput,
): CapabilityReadinessEvidence {
  const activeAssessmentVersions = new Map(
    input.activeAssessmentVersions.map((version) => [version.assessmentKey, version.bankVersion]),
  );
  const currentPracticalVersions = new Map(
    input.currentPracticalVersions.map((version) => [version.proofKey, version.proofVersion]),
  );

  const latestAssessments = latestByKey(
    input.assessments,
    (record) => record.assessmentKey,
    (record) => record.attemptNumber,
    (record) => timestamp(record.completedAt),
  );
  const latestPracticals = latestByKey(
    input.practicals,
    (record) => record.proofKey,
    (record) => record.attemptNumber,
    (record) => timestamp(record.reviewedAt || record.submittedAt),
  );

  const passedAssessmentKeys = Array.from(latestAssessments.values())
    .filter(
      (record) =>
        record.passed &&
        activeAssessmentVersions.get(record.assessmentKey) === record.bankVersion,
    )
    .map((record) => record.assessmentKey)
    .sort();

  const approvedPracticalProofKeys = Array.from(latestPracticals.values())
    .filter(
      (record) =>
        record.outcome === "approved" &&
        currentPracticalVersions.get(record.proofKey) === record.proofVersion,
    )
    .map((record) => record.proofKey)
    .sort();

  const latestOralDefense = [...input.oralDefenses].sort((left, right) => {
    const attemptDelta = right.attemptNumber - left.attemptNumber;
    if (attemptDelta !== 0) return attemptDelta;
    return timestamp(right.completedAt) - timestamp(left.completedAt);
  })[0];

  const oralDefenseApproved = Boolean(
    latestOralDefense &&
      latestOralDefense.defenseVersion === input.currentOralDefenseVersion &&
      latestOralDefense.outcome === "approved",
  );

  return {
    passedAssessmentKeys,
    approvedPracticalProofKeys,
    oralDefenseApproved,
  };
}
