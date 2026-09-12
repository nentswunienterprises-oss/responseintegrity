import type { CapabilityReadinessEvidence } from "./capabilityReadiness";
import {
  getCapabilityDeepDiveBlueprint,
  type CapabilityBlueprintEvidenceKind,
} from "./capabilityBlueprint";

export interface CapabilityAssessmentEvidenceSnapshot {
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  passed: boolean;
  completedAt: string | Date;
  evidenceKind?: CapabilityBlueprintEvidenceKind;
  coveredDeepDiveKeys?: string[];
}

export interface CapabilityActiveAssessmentVersion {
  assessmentKey: string;
  bankVersion: number;
}

export interface CapabilityEvidenceCellState {
  code: string;
  deepDiveKey: string;
  evidenceKind: CapabilityBlueprintEvidenceKind;
  satisfiedAt: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
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
  allowedAssessmentKeys?: string[];
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function iso(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid capability evidence timestamp: ${String(value)}`);
  }
  return parsed.toISOString();
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

export function capabilityEvidenceCellCode(
  deepDiveKey: string,
  evidenceKind: CapabilityBlueprintEvidenceKind,
) {
  return `deep_dive.${deepDiveKey}.${evidenceKind}`;
}

export function selectCurrentPassingCapabilityAssessments(
  assessments: CapabilityAssessmentEvidenceSnapshot[],
  activeAssessmentVersions: CapabilityActiveAssessmentVersion[],
  allowedAssessmentKeys?: string[],
) {
  const allowed = allowedAssessmentKeys ? new Set(allowedAssessmentKeys) : null;
  const activeVersions = new Map(
    activeAssessmentVersions
      .filter((version) => !allowed || allowed.has(version.assessmentKey))
      .map((version) => [version.assessmentKey, version.bankVersion]),
  );

  // Attempt numbering restarts for a new immutable bank version. Filter to the
  // active version before choosing the latest attempt so an old v1 attempt 3
  // can never outrank the current v2 attempt 1. V2 callers may additionally
  // restrict credit to the approved assessment plan so legacy shadow banks stay
  // historically visible without minting current MVP capability cells.
  const activeVersionAttempts = assessments.filter(
    (record) =>
      (!allowed || allowed.has(record.assessmentKey)) &&
      activeVersions.get(record.assessmentKey) === record.bankVersion,
  );
  const latestAssessments = latestByKey(
    activeVersionAttempts,
    (record) => record.assessmentKey,
    (record) => record.attemptNumber,
    (record) => timestamp(record.completedAt),
  );

  return Array.from(latestAssessments.values()).filter((record) => record.passed);
}

export function buildCurrentCapabilityEvidenceCellStates(
  currentPassedAssessments: CapabilityAssessmentEvidenceSnapshot[],
): CapabilityEvidenceCellState[] {
  const cells = new Map<string, CapabilityEvidenceCellState>();

  for (const record of currentPassedAssessments) {
    if (!record.evidenceKind) continue;
    for (const deepDiveKey of record.coveredDeepDiveKeys || []) {
      const blueprint = getCapabilityDeepDiveBlueprint(deepDiveKey);
      if (!blueprint || !blueprint.requiredEvidenceKinds.includes(record.evidenceKind)) continue;

      const code = capabilityEvidenceCellCode(deepDiveKey, record.evidenceKind);
      const next: CapabilityEvidenceCellState = {
        code,
        deepDiveKey,
        evidenceKind: record.evidenceKind,
        satisfiedAt: iso(record.completedAt),
        assessmentKey: record.assessmentKey,
        bankVersion: record.bankVersion,
        attemptNumber: record.attemptNumber,
      };
      const current = cells.get(code);
      if (!current || timestamp(next.satisfiedAt) < timestamp(current.satisfiedAt)) {
        cells.set(code, next);
      }
    }
  }

  return Array.from(cells.values()).sort((left, right) => left.code.localeCompare(right.code));
}

export function selectCurrentCapabilityReadinessEvidence(
  input: CurrentCapabilityEvidenceSelectionInput,
): CapabilityReadinessEvidence {
  const currentPracticalVersions = new Map(
    input.currentPracticalVersions.map((version) => [version.proofKey, version.proofVersion]),
  );

  // Practical attempt numbering also restarts when an immutable proof version
  // changes. Filter to the current version before choosing the latest attempt.
  const currentVersionPracticals = input.practicals.filter(
    (record) => currentPracticalVersions.get(record.proofKey) === record.proofVersion,
  );
  const latestPracticals = latestByKey(
    currentVersionPracticals,
    (record) => record.proofKey,
    (record) => record.attemptNumber,
    (record) => timestamp(record.reviewedAt || record.submittedAt),
  );

  const currentPassedAssessments = selectCurrentPassingCapabilityAssessments(
    input.assessments,
    input.activeAssessmentVersions,
    input.allowedAssessmentKeys,
  );
  const evidenceCellStates = buildCurrentCapabilityEvidenceCellStates(currentPassedAssessments);

  const passedAssessmentKeys = currentPassedAssessments
    .map((record) => record.assessmentKey)
    .sort();
  const satisfiedEvidenceCells = evidenceCellStates.map((cell) => cell.code);

  const approvedPracticalProofKeys = Array.from(latestPracticals.values())
    .filter((record) => record.outcome === "approved")
    .map((record) => record.proofKey)
    .sort();

  // Oral Defense attempt numbering is version-scoped as well. A historical V1
  // attempt 4 must never outrank the current V2 attempt 1.
  const currentVersionOralDefenses = input.oralDefenses.filter(
    (record) => record.defenseVersion === input.currentOralDefenseVersion,
  );
  const latestOralDefense = [...currentVersionOralDefenses].sort((left, right) => {
    const attemptDelta = right.attemptNumber - left.attemptNumber;
    if (attemptDelta !== 0) return attemptDelta;
    return timestamp(right.completedAt) - timestamp(left.completedAt);
  })[0];

  const oralDefenseApproved = Boolean(
    latestOralDefense && latestOralDefense.outcome === "approved",
  );

  return {
    passedAssessmentKeys,
    satisfiedEvidenceCells,
    approvedPracticalProofKeys,
    oralDefenseApproved,
  };
}
