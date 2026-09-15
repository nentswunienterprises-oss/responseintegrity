import { pool } from "./db";
import { CAPABILITY_MVP_ASSESSMENT_PLAN_V1 } from "@shared/capabilityAssessmentPlan";
import { getRequiredCapabilityEvidenceCells } from "@shared/capabilityBlueprint";
import {
  buildCapabilityMockDossierSnapshot,
  type CapabilityDossierAssessmentAttempt,
  type CapabilityDossierOralAttempt,
  type CapabilityDossierPracticalAttempt,
  type CapabilityDossierSimulationAttempt,
} from "@shared/capabilityMockDossier";
import { CAPABILITY_PRACTICAL_PROOFS } from "@shared/capabilityPracticalEvidence";
import { ORAL_DEFENSE_VERSION } from "@shared/capabilityOralDefense";
import { getCapabilityReadinessEvidence } from "./capabilityReadiness";
import { DEFAULT_SANDBOX_SIMULATION_BANK_KEY } from "./capabilitySandboxSimulationBank";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function jsonStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function resolveSingleSandboxAssignmentForTutor(tutorId: string) {
  const result = await pool.query(
    `SELECT id, tutor_id, pod_id, operational_mode
       FROM tutor_assignments
      WHERE tutor_id = $1
        AND lower(coalesce(operational_mode, '')) = 'sandbox'`,
    [tutorId],
  );

  if (result.rowCount === 0) {
    throw httpError(404, "No Sandbox assignment exists for this Specialist.");
  }
  if (result.rowCount !== 1) {
    throw httpError(409, "Multiple Sandbox assignments exist for this Specialist. Resolve assignment ambiguity before reviewing capability evidence.");
  }
  return result.rows[0];
}

export async function buildCapabilityMockDossier(input: {
  tutorId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  if (String(input.reviewerRole || "").toLowerCase() !== "coo") {
    throw httpError(403, "Pre-Mock capability dossier access is restricted to the COO Mock reviewer surface.");
  }

  const assignment = await resolveSingleSandboxAssignmentForTutor(input.tutorId);
  const tutorAssignmentId = String(assignment.id);

  const [
    readinessEvidence,
    activeConfigResult,
    assessmentResult,
    practicalResult,
    oralResult,
    simulationBankResult,
    simulationResult,
  ] = await Promise.all([
    getCapabilityReadinessEvidence(tutorAssignmentId),
    pool.query(
      `SELECT assessment_key, bank_version
         FROM private.specialist_capability_assessment_configs
        WHERE active = true
        ORDER BY assessment_key, bank_version`,
    ),
    pool.query(
      `SELECT id, assessment_key, bank_version, attempt_number, evidence_kind,
              covered_deep_dive_keys, total_questions, correct_questions,
              percent, has_critical_fail, passed, completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY assessment_key, bank_version, attempt_number`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT e.id, e.proof_key, e.proof_version, e.rubric_version,
              e.attempt_number, e.submitted_at,
              r.outcome, r.reason_code, r.feedback,
              r.clear_count, r.partial_count, r.fail_count,
              r.critical_fail_count, r.reviewed_at
         FROM specialist_capability_practical_evidence e
         LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
        WHERE e.tutor_assignment_id = $1
        ORDER BY e.proof_key, e.proof_version, e.attempt_number`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT id, defense_version, attempt_number, clear_count, partial_count,
              fail_count, critical_fail_count, outcome, feedback, completed_at
         FROM specialist_capability_oral_defenses
        WHERE tutor_assignment_id = $1
        ORDER BY defense_version, attempt_number`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT bank_key, bank_version
         FROM private.specialist_capability_simulation_banks
        WHERE bank_key = $1
          AND active = true
        ORDER BY bank_version`,
      [DEFAULT_SANDBOX_SIMULATION_BANK_KEY],
    ),
    pool.query(
      `SELECT id, bank_key, bank_version, attempt_number, scenario_key, scenario_version,
              total_decisions, correct_decisions, percent, passed, has_critical_fail,
              evidence_contamination_count, authority_violation_count,
              escalation_failure_count, authoritative, completed_at
         FROM specialist_capability_sandbox_simulation_attempts
        WHERE tutor_assignment_id = $1
          AND bank_key = $2
        ORDER BY bank_version, attempt_number`,
      [tutorAssignmentId, DEFAULT_SANDBOX_SIMULATION_BANK_KEY],
    ),
  ]);

  const assessmentAttempts: CapabilityDossierAssessmentAttempt[] = assessmentResult.rows.map((row) => ({
    evidenceId: String(row.id),
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    evidenceKind: String(row.evidence_kind),
    coveredDeepDiveKeys: jsonStringArray(row.covered_deep_dive_keys),
    totalQuestions: Number(row.total_questions),
    correctQuestions: Number(row.correct_questions),
    percent: Number(row.percent),
    hasCriticalFail: Boolean(row.has_critical_fail),
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
  }));

  const practicalAttempts: CapabilityDossierPracticalAttempt[] = practicalResult.rows.map((row) => ({
    evidenceId: String(row.id),
    proofKey: String(row.proof_key),
    proofVersion: Number(row.proof_version),
    rubricVersion: row.rubric_version === null ? null : Number(row.rubric_version),
    attemptNumber: Number(row.attempt_number),
    outcome: row.outcome ? String(row.outcome) : "submitted",
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    feedback: row.feedback ? String(row.feedback) : null,
    counts: row.outcome
      ? {
          clear: Number(row.clear_count || 0),
          partial: Number(row.partial_count || 0),
          fail: Number(row.fail_count || 0),
          criticalFail: Number(row.critical_fail_count || 0),
        }
      : null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
  }));

  const oralAttempts: CapabilityDossierOralAttempt[] = oralResult.rows.map((row) => ({
    evidenceId: String(row.id),
    defenseVersion: Number(row.defense_version),
    attemptNumber: Number(row.attempt_number),
    outcome: String(row.outcome),
    counts: {
      clear: Number(row.clear_count || 0),
      partial: Number(row.partial_count || 0),
      fail: Number(row.fail_count || 0),
      criticalFail: Number(row.critical_fail_count || 0),
    },
    feedback: row.feedback ? String(row.feedback) : null,
    completedAt: row.completed_at,
  }));

  const simulationAttempts: CapabilityDossierSimulationAttempt[] = simulationResult.rows.map((row) => ({
    evidenceId: String(row.id),
    bankKey: String(row.bank_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    scenarioKey: String(row.scenario_key),
    scenarioVersion: Number(row.scenario_version),
    totalDecisions: Number(row.total_decisions),
    correctDecisions: Number(row.correct_decisions),
    percent: Number(row.percent),
    passed: Boolean(row.passed),
    hasCriticalFail: Boolean(row.has_critical_fail),
    evidenceContaminationCount: Number(row.evidence_contamination_count || 0),
    authorityViolationCount: Number(row.authority_violation_count || 0),
    escalationFailureCount: Number(row.escalation_failure_count || 0),
    authoritative: false as const,
    completedAt: row.completed_at,
  }));

  const snapshot = buildCapabilityMockDossierSnapshot({
    requiredEvidenceCellCodes: getRequiredCapabilityEvidenceCells().map((cell) => cell.code),
    satisfiedEvidenceCellCodes: readinessEvidence.satisfiedEvidenceCells,
    assessmentPlan: CAPABILITY_MVP_ASSESSMENT_PLAN_V1.map((plan) => ({
      assessmentKey: plan.assessmentKey,
      title: plan.title,
      evidenceKind: plan.evidenceKind,
      coveredDeepDiveKeys: plan.coveredDeepDiveKeys,
    })),
    activeAssessmentVersions: activeConfigResult.rows.map((row) => ({
      key: String(row.assessment_key),
      version: Number(row.bank_version),
    })),
    assessmentAttempts,
    practicalDefinitions: CAPABILITY_PRACTICAL_PROOFS.map((proof) => ({
      proofKey: proof.key,
      title: proof.title,
      proofVersion: proof.version,
    })),
    practicalAttempts,
    currentOralDefenseVersion: ORAL_DEFENSE_VERSION,
    oralAttempts,
    simulationBankKey: DEFAULT_SANDBOX_SIMULATION_BANK_KEY,
    activeSimulationBankVersions: simulationBankResult.rows.map((row) => Number(row.bank_version)),
    simulationAttempts,
  });

  return {
    authoritative: false as const,
    purpose: "Evidence context for the human Sandbox Mock reviewer only.",
    mockRecommendation: null,
    tutorId: String(assignment.tutor_id),
    tutorAssignmentId,
    operationalMode: String(assignment.operational_mode || ""),
    generatedAt: new Date().toISOString(),
    ...snapshot,
  };
}
