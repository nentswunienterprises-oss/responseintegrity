import { pool } from "./db";
import {
  evaluateOralDefenseProbes,
  ORAL_DEFENSE_ALWAYS_PROBE,
  ORAL_DEFENSE_VERSION,
  type CapabilityOralDefenseProbe,
} from "@shared/capabilityOralDefense";
import {
  assertCapabilityReviewerAccessToAssignment,
  assertCapabilityTutorAssignmentOwnership,
  assertPreOralCapabilityEvidenceReady,
  getCapabilityReadinessEvidence,
} from "./capabilityReadiness";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; data?: Record<string, unknown> };
  error.status = status;
  error.data = data;
  return error;
}

type RiskSignal = {
  focusKey: string;
  deepDiveKey: string;
  incorrectCount: number;
  criticalFailCount: number;
  totalSeen: number;
  latestSeenAt: string;
};

type OralDefenseProbeBrief = {
  focusKey: string;
  deepDiveKey: string;
  source: "evidence_risk" | "integrity_baseline";
  reviewerInstruction: string;
  incorrectCount?: number;
  criticalFailCount?: number;
};

function parseQuestionResults(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function buildRiskSignals(rows: Array<Record<string, any>>): RiskSignal[] {
  const risks = new Map<string, RiskSignal>();

  for (const row of rows) {
    const completedAt = new Date(row.completed_at).toISOString();
    for (const question of parseQuestionResults(row.question_results)) {
      const focusKey = String(question?.competencyKey || "").trim();
      const deepDiveKey = String(question?.deepDiveKey || "").trim();
      if (!focusKey || !deepDiveKey) continue;

      const identity = `${deepDiveKey}:${focusKey}`;
      const current = risks.get(identity) || {
        focusKey,
        deepDiveKey,
        incorrectCount: 0,
        criticalFailCount: 0,
        totalSeen: 0,
        latestSeenAt: completedAt,
      };

      current.totalSeen += 1;
      if (!Boolean(question?.correct)) current.incorrectCount += 1;
      if (Boolean(question?.criticalFail)) current.criticalFailCount += 1;
      if (completedAt > current.latestSeenAt) current.latestSeenAt = completedAt;
      risks.set(identity, current);
    }
  }

  return Array.from(risks.values())
    .filter((risk) => risk.incorrectCount > 0 || risk.criticalFailCount > 0)
    .sort((left, right) => {
      const leftScore = left.criticalFailCount * 10 + left.incorrectCount * 2;
      const rightScore = right.criticalFailCount * 10 + right.incorrectCount * 2;
      return rightScore - leftScore || right.latestSeenAt.localeCompare(left.latestSeenAt);
    });
}

function buildProbeBriefs(risks: RiskSignal[]): OralDefenseProbeBrief[] {
  const baselineIds = new Set(
    ORAL_DEFENSE_ALWAYS_PROBE.map((probe) => `${probe.deepDiveKey}:${probe.focusKey}`),
  );
  const targeted = risks
    .filter((risk) => !baselineIds.has(`${risk.deepDiveKey}:${risk.focusKey}`))
    .slice(0, 2)
    .map((risk) => ({
      focusKey: risk.focusKey,
      deepDiveKey: risk.deepDiveKey,
      source: "evidence_risk" as const,
      incorrectCount: risk.incorrectCount,
      criticalFailCount: risk.criticalFailCount,
      reviewerInstruction:
        `Use a new scenario to probe ${risk.focusKey}. Stored digital evidence shows ${risk.incorrectCount} incorrect response${risk.incorrectCount === 1 ? "" : "s"}` +
        `${risk.criticalFailCount > 0 ? ` and ${risk.criticalFailCount} critical-boundary flag${risk.criticalFailCount === 1 ? "" : "s"}` : ""}. ` +
        "Do not reuse a known assessment item. Require the Specialist to reason aloud and defend the operating decision.",
    }));

  return [
    ...targeted,
    ...ORAL_DEFENSE_ALWAYS_PROBE.map((probe) => ({
      ...probe,
      source: "integrity_baseline" as const,
    })),
  ];
}

async function loadPracticalSignals(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT e.proof_key,
            e.attempt_number,
            r.outcome,
            r.feedback,
            e.submitted_at,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
      ORDER BY e.proof_key ASC, e.attempt_number DESC`,
    [tutorAssignmentId],
  );

  const latest = new Map<string, any>();
  for (const row of result.rows) {
    if (!latest.has(String(row.proof_key))) latest.set(String(row.proof_key), row);
  }

  return Array.from(latest.values()).map((row) => ({
    proofKey: String(row.proof_key),
    attemptNumber: Number(row.attempt_number),
    status: row.outcome || "submitted",
    feedback: row.feedback || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
  }));
}

export async function buildOralDefenseBrief(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const assignment = await assertCapabilityReviewerAccessToAssignment(input);
  await assertPreOralCapabilityEvidenceReady(input.tutorAssignmentId);

  const [assessmentResult, practicalSignals, readinessEvidence, specialistResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key,
              evidence_kind,
              passed,
              has_critical_fail,
              question_results,
              completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY completed_at ASC`,
      [input.tutorAssignmentId],
    ),
    loadPracticalSignals(input.tutorAssignmentId),
    getCapabilityReadinessEvidence(input.tutorAssignmentId),
    pool.query(
      `SELECT first_name, last_name
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [assignment.tutor_id],
    ),
  ]);

  const risks = buildRiskSignals(assessmentResult.rows);
  const probes = buildProbeBriefs(risks);
  const specialist = specialistResult.rows[0] || {};

  return {
    defenseVersion: ORAL_DEFENSE_VERSION,
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: assignment.tutor_id,
    specialistName: [specialist.first_name, specialist.last_name].filter(Boolean).join(" ").trim(),
    generatedAt: new Date().toISOString(),
    evidenceSummary: {
      passedAssessmentKeys: readinessEvidence.passedAssessmentKeys,
      approvedPracticalProofKeys: readinessEvidence.approvedPracticalProofKeys,
      practicalSignals,
      riskSignalCount: risks.length,
    },
    probes,
  };
}

async function getLatestOralDefense(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT id,
            defense_version,
            attempt_number,
            outcome,
            feedback,
            completed_at
       FROM specialist_capability_oral_defenses
      WHERE tutor_assignment_id = $1
      ORDER BY attempt_number DESC
      LIMIT 1`,
    [tutorAssignmentId],
  );
  return result.rows[0] || null;
}

function assertProbeSetMatchesBrief(
  expected: OralDefenseProbeBrief[],
  actual: CapabilityOralDefenseProbe[],
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
  defenseVersion: number;
  probes: CapabilityOralDefenseProbe[];
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

  const latest = await getLatestOralDefense(input.tutorAssignmentId);
  if (latest?.outcome === "approved") {
    throw httpError(409, "The Oral Integrity Defense has already been approved.");
  }
  if (latest?.outcome === "integrity_review") {
    throw httpError(409, "The Oral Integrity Defense is under integrity review and cannot be repeated yet.");
  }

  const brief = await buildOralDefenseBrief(input);
  assertProbeSetMatchesBrief(brief.probes, input.probes);
  const evaluation = evaluateOralDefenseProbes(input.probes);
  const feedback = String(input.feedback || "").trim();

  if (evaluation.outcome !== "approved" && feedback.length < 20) {
    throw httpError(400, "Actionable reviewer feedback is required when the oral defense is not approved.");
  }

  const attemptNumber = Number(latest?.attempt_number || 0) + 1;
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
        attemptNumber,
        input.reviewerId,
        String(input.reviewerRole).toLowerCase(),
        JSON.stringify(brief),
        JSON.stringify(input.probes),
        evaluation.clearCount,
        evaluation.partialCount,
        evaluation.failCount,
        evaluation.integrityConcernCount,
        evaluation.outcome,
        feedback || null,
      ],
    );

    return {
      defenseId: result.rows[0]?.id,
      defenseVersion: ORAL_DEFENSE_VERSION,
      attemptNumber,
      outcome: evaluation.outcome,
      counts: {
        clear: evaluation.clearCount,
        partial: evaluation.partialCount,
        fail: evaluation.failCount,
        integrityConcern: evaluation.integrityConcernCount,
      },
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
  const latest = await getLatestOralDefense(input.tutorAssignmentId);
  if (!latest) return null;

  return {
    defenseVersion: Number(latest.defense_version),
    attemptNumber: Number(latest.attempt_number),
    outcome: latest.outcome,
    feedback: latest.feedback || null,
    completedAt: latest.completed_at,
  };
}
