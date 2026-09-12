import { pool } from "./db";
import {
  evaluateOralDefenseProbes,
  ORAL_DEFENSE_VERSION,
  type CapabilityOralDefenseProbeObservation,
} from "@shared/capabilityOralDefense";
import {
  assertCapabilityReviewerAccessToAssignment,
  assertCapabilityTutorAssignmentOwnership,
  assertPreOralCapabilityEvidenceReady,
  getCapabilityReadinessEvidence,
  getFoundationCapabilityReadiness,
  normalizeCapabilityReviewerRole,
} from "./capabilityReadiness";
import {
  buildCapabilityEvidenceFingerprint,
  buildCapabilityOralBriefId,
  buildCapabilityOralProbeBriefs,
  buildCapabilityOralRiskSignals,
  type CapabilityAssessmentRiskEvidence,
  type CapabilityOralDefenseProbeBrief,
  type CapabilityPracticalRiskEvidence,
} from "./capabilityOralDefenseCore";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
}

function parseArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeAssessmentRiskRows(rows: Array<Record<string, any>>): CapabilityAssessmentRiskEvidence[] {
  return rows.map((row) => ({
    id: String(row.id),
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    completedAt: row.completed_at,
    questionResults: parseArray(row.question_results)
      .map((question) => ({
        competencyKey: String(question?.competencyKey || "").trim(),
        deepDiveKey: String(question?.deepDiveKey || "").trim(),
        correct: Boolean(question?.correct),
        criticalFail: Boolean(question?.criticalFail),
      }))
      .filter((question) => question.competencyKey && question.deepDiveKey),
  }));
}

function normalizePracticalRiskRows(rows: Array<Record<string, any>>): CapabilityPracticalRiskEvidence[] {
  return rows.map((row) => ({
    id: String(row.id),
    proofKey: String(row.proof_key),
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    competencyLinks: parseArray(row.competency_links)
      .map((link) => ({
        deepDiveKey: String(link?.deepDiveKey || "").trim(),
        competencyKey: String(link?.competencyKey || "").trim(),
      }))
      .filter((link) => link.deepDiveKey && link.competencyKey),
    outcome: (row.outcome || "submitted") as "submitted" | "approved" | "repeat_required" | "integrity_review",
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
  }));
}

function latestPracticalSignals(rows: CapabilityPracticalRiskEvidence[]) {
  const latest = new Map<string, CapabilityPracticalRiskEvidence>();
  for (const row of rows) {
    const current = latest.get(row.proofKey);
    if (!current || row.attemptNumber > current.attemptNumber) latest.set(row.proofKey, row);
  }

  return Array.from(latest.values()).map((row) => ({
    proofKey: row.proofKey,
    proofVersion: row.proofVersion,
    attemptNumber: row.attemptNumber,
    status: row.outcome,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt || null,
  }));
}

async function loadAssessmentRiskHistory(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT id,
            assessment_key,
            bank_version,
            attempt_number,
            question_results,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
      ORDER BY completed_at ASC, attempt_number ASC, id ASC`,
    [tutorAssignmentId],
  );
  return normalizeAssessmentRiskRows(result.rows);
}

async function loadPracticalRiskHistory(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT e.id,
            e.proof_key,
            e.proof_version,
            e.attempt_number,
            e.competency_links,
            e.submitted_at,
            r.outcome,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
      ORDER BY e.proof_key ASC, e.attempt_number ASC, e.id ASC`,
    [tutorAssignmentId],
  );
  return normalizePracticalRiskRows(result.rows);
}

async function getLatestCurrentOralDefense(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT id,
            defense_version,
            attempt_number,
            outcome,
            feedback,
            completed_at
       FROM specialist_capability_oral_defenses
      WHERE tutor_assignment_id = $1
        AND defense_version = $2
      ORDER BY attempt_number DESC, completed_at DESC
      LIMIT 1`,
    [tutorAssignmentId, ORAL_DEFENSE_VERSION],
  );
  return result.rows[0] || null;
}

export async function buildOralDefenseBrief(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const assignment = await assertCapabilityReviewerAccessToAssignment(input);
  await assertPreOralCapabilityEvidenceReady(input.tutorAssignmentId);

  const latestDefense = await getLatestCurrentOralDefense(input.tutorAssignmentId);
  if (latestDefense?.outcome === "approved") {
    throw httpError(409, "The current Oral Integrity Defense has already been approved.");
  }
  if (latestDefense?.outcome === "integrity_review") {
    throw httpError(409, "The current Oral Integrity Defense is under integrity review and cannot be repeated yet.");
  }

  const [assessments, practicals, readinessEvidence, specialistResult] = await Promise.all([
    loadAssessmentRiskHistory(input.tutorAssignmentId),
    loadPracticalRiskHistory(input.tutorAssignmentId),
    getCapabilityReadinessEvidence(input.tutorAssignmentId),
    pool.query(
      `SELECT first_name, last_name
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [assignment.tutor_id],
    ),
  ]);

  const risks = buildCapabilityOralRiskSignals(assessments, practicals);
  let probes: CapabilityOralDefenseProbeBrief[];
  try {
    probes = buildCapabilityOralProbeBriefs(risks);
  } catch (error) {
    throw httpError(
      409,
      `The current capability evidence cannot produce a canonical Oral Defense brief: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const evidenceFingerprint = buildCapabilityEvidenceFingerprint(assessments, practicals);
  const attemptNumber = Number(latestDefense?.attempt_number || 0) + 1;
  const briefId = buildCapabilityOralBriefId({
    tutorAssignmentId: input.tutorAssignmentId,
    defenseVersion: ORAL_DEFENSE_VERSION,
    attemptNumber,
    evidenceFingerprint,
    probes,
  });
  const specialist = specialistResult.rows[0] || {};

  return {
    briefId,
    evidenceFingerprint,
    defenseVersion: ORAL_DEFENSE_VERSION,
    attemptNumber,
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: assignment.tutor_id,
    specialistName: [specialist.first_name, specialist.last_name].filter(Boolean).join(" ").trim(),
    generatedAt: new Date().toISOString(),
    evidenceSummary: {
      passedAssessmentKeys: readinessEvidence.passedAssessmentKeys,
      approvedPracticalProofKeys: readinessEvidence.approvedPracticalProofKeys,
      practicalSignals: latestPracticalSignals(practicals),
      riskSignalCount: risks.length,
    },
    probes,
  };
}

function assertProbeSetMatchesBrief(
  expected: CapabilityOralDefenseProbeBrief[],
  actual: CapabilityOralDefenseProbeObservation[],
) {
  const expectedIds = expected
    .map((probe) => `${probe.deepDiveKey}:${probe.focusKey}`)
    .sort();
  const actualIds = actual
    .map((probe) => `${probe.deepDiveKey}:${probe.focusKey}`)
    .sort();

  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((identity, index) => identity !== actualIds[index])
  ) {
    throw httpError(400, "The oral defense probe evidence does not match the issued reviewer brief.");
  }
}

export async function completeOralDefense(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
  briefId: string;
  defenseVersion: number;
  attemptNumber: number;
  probes: CapabilityOralDefenseProbeObservation[];
  feedback?: string | null;
  sandboxScenarioConfirmed: boolean;
}) {
  await assertCapabilityReviewerAccessToAssignment(input);
  await assertPreOralCapabilityEvidenceReady(input.tutorAssignmentId);

  if (input.defenseVersion !== ORAL_DEFENSE_VERSION) {
    throw httpError(409, "This oral defense version is no longer current.");
  }
  if (!input.sandboxScenarioConfirmed) {
    throw httpError(400, "Oral defense probes must use fictional or sandbox scenarios, not real student data.");
  }

  const brief = await buildOralDefenseBrief(input);
  if (input.briefId !== brief.briefId || input.attemptNumber !== brief.attemptNumber) {
    throw httpError(409, "The oral defense brief is stale because the Specialist's evidence state or issued standard changed. Refresh the brief before continuing.");
  }

  assertProbeSetMatchesBrief(brief.probes, input.probes);
  let evaluation;
  try {
    evaluation = evaluateOralDefenseProbes(brief.probes, input.probes);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : "Invalid Oral Integrity Defense evidence.");
  }
  const feedback = String(input.feedback || "").trim();

  if (evaluation.outcome !== "approved" && feedback.length < 20) {
    throw httpError(400, "Actionable reviewer feedback is required when the oral defense is not approved.");
  }

  try {
    const result = await pool.query(
      `INSERT INTO specialist_capability_oral_defenses (
         tutor_assignment_id,
         tutor_id,
         defense_version,
         attempt_number,
         reviewer_id,
         reviewer_role,
         brief_snapshot,
         probes,
         clear_count,
         partial_count,
         fail_count,
         integrity_concern_count,
         outcome,
         feedback,
         sandbox_scenario_confirmed
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
         $9, $10, $11, $12, $13, $14, true
       )
       RETURNING id, completed_at`,
      [
        input.tutorAssignmentId,
        brief.tutorId,
        ORAL_DEFENSE_VERSION,
        brief.attemptNumber,
        input.reviewerId,
        String(input.reviewerRole).toLowerCase(),
        JSON.stringify(brief),
        JSON.stringify(input.probes),
        evaluation.clearCount,
        evaluation.partialCount,
        evaluation.failCount,
        evaluation.criticalFailCount,
        evaluation.outcome,
        feedback || null,
      ],
    );

    return {
      defenseId: result.rows[0]?.id,
      briefId: brief.briefId,
      defenseVersion: ORAL_DEFENSE_VERSION,
      attemptNumber: brief.attemptNumber,
      outcome: evaluation.outcome,
      counts: {
        clear: evaluation.clearCount,
        partial: evaluation.partialCount,
        fail: evaluation.failCount,
        criticalFail: evaluation.criticalFailCount,
      },
      criticalFailProbeKeys: evaluation.criticalFailProbeKeys,
      completedAt: result.rows[0]?.completed_at,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This Oral Integrity Defense attempt has already been recorded.");
    }
    throw error;
  }
}

export async function getSpecialistOralDefenseStatus(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);
  const latest = await getLatestCurrentOralDefense(input.tutorAssignmentId);
  if (!latest) return null;

  return {
    defenseVersion: Number(latest.defense_version),
    attemptNumber: Number(latest.attempt_number),
    outcome: latest.outcome,
    feedback: latest.feedback || null,
    completedAt: latest.completed_at,
  };
}

export async function listOralDefenseCandidates(input: {
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = normalizeCapabilityReviewerRole(input.reviewerRole);
  const params: unknown[] = [];
  let tdScope = "";
  if (reviewerRole === "td") {
    params.push(input.reviewerId);
    tdScope = ` AND p.td_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT ta.id AS tutor_assignment_id,
            ta.tutor_id,
            p.pod_name,
            u.first_name,
            u.last_name
       FROM tutor_assignments ta
       LEFT JOIN pods p ON p.id = ta.pod_id
       JOIN users u ON u.id = ta.tutor_id
      WHERE EXISTS (
              SELECT 1
                FROM specialist_capability_assessment_attempts a
               WHERE a.tutor_assignment_id = ta.id
            )
        ${tdScope}
      ORDER BY p.pod_name NULLS LAST, u.first_name, u.last_name
      LIMIT 100`,
    params,
  );

  const candidates: Array<Record<string, unknown>> = [];
  for (const row of result.rows) {
    const tutorAssignmentId = String(row.tutor_assignment_id);
    const readiness = await getFoundationCapabilityReadiness(tutorAssignmentId);
    const missingPreOral = readiness.requirements.filter(
      (requirement) => requirement.kind !== "oral_defense" && !requirement.satisfied,
    );
    if (missingPreOral.length > 0) continue;

    const currentDefense = await getLatestCurrentOralDefense(tutorAssignmentId);
    if (currentDefense?.outcome === "approved" || currentDefense?.outcome === "integrity_review") continue;

    candidates.push({
      tutorAssignmentId,
      tutorId: String(row.tutor_id),
      specialistName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
      podName: row.pod_name || null,
      latestDefenseOutcome: currentDefense?.outcome || null,
      nextAttemptNumber: Number(currentDefense?.attempt_number || 0) + 1,
      readinessStatus: readiness.status,
      missingRequirementCodes: readiness.missingRequirementCodes,
    });
  }

  return candidates;
}
