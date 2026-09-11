import { createHash } from "node:crypto";
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
  getFoundationCapabilityReadiness,
  normalizeCapabilityReviewerRole,
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
  practicalRepeatCount: number;
  practicalIntegrityCount: number;
  latestSeenAt: string;
};

type OralDefenseProbeBrief = {
  focusKey: string;
  deepDiveKey: string;
  source: "evidence_risk" | "integrity_baseline";
  reviewerInstruction: string;
  incorrectCount?: number;
  criticalFailCount?: number;
  practicalRepeatCount?: number;
  practicalIntegrityCount?: number;
};

type AssessmentEvidenceRow = Record<string, any>;
type PracticalEvidenceRow = Record<string, any>;

function parseArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function riskIdentity(deepDiveKey: string, focusKey: string) {
  return `${deepDiveKey}:${focusKey}`;
}

function riskScore(risk?: RiskSignal | null) {
  if (!risk) return 0;
  return (
    risk.practicalIntegrityCount * 100 +
    risk.criticalFailCount * 25 +
    risk.practicalRepeatCount * 8 +
    risk.incorrectCount * 2
  );
}

function buildRiskSignals(
  assessmentRows: AssessmentEvidenceRow[],
  practicalRows: PracticalEvidenceRow[],
): RiskSignal[] {
  const risks = new Map<string, RiskSignal>();

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

  for (const row of assessmentRows) {
    const completedAt = new Date(row.completed_at).toISOString();
    for (const question of parseArray(row.question_results)) {
      const focusKey = String(question?.competencyKey || "").trim();
      const deepDiveKey = String(question?.deepDiveKey || "").trim();
      if (!focusKey || !deepDiveKey) continue;
      if (Boolean(question?.correct) && !Boolean(question?.criticalFail)) continue;

      const current = ensureRisk(focusKey, deepDiveKey, completedAt);
      if (!Boolean(question?.correct)) current.incorrectCount += 1;
      if (Boolean(question?.criticalFail)) current.criticalFailCount += 1;
    }
  }

  for (const row of practicalRows) {
    const outcome = String(row.outcome || "").trim();
    if (outcome !== "repeat_required" && outcome !== "integrity_review") continue;
    const seenAt = new Date(row.reviewed_at || row.submitted_at).toISOString();
    for (const link of parseArray(row.competency_links)) {
      const focusKey = String(link?.competencyKey || "").trim();
      const deepDiveKey = String(link?.deepDiveKey || "").trim();
      if (!focusKey || !deepDiveKey) continue;
      const current = ensureRisk(focusKey, deepDiveKey, seenAt);
      if (outcome === "repeat_required") current.practicalRepeatCount += 1;
      if (outcome === "integrity_review") current.practicalIntegrityCount += 1;
    }
  }

  return Array.from(risks.values()).sort(
    (left, right) =>
      riskScore(right) - riskScore(left) || right.latestSeenAt.localeCompare(left.latestSeenAt),
  );
}

function riskInstructionSuffix(risk?: RiskSignal | null) {
  if (!risk) return "";
  const reasons: string[] = [];
  if (risk.criticalFailCount > 0) {
    reasons.push(`${risk.criticalFailCount} critical-boundary flag${risk.criticalFailCount === 1 ? "" : "s"}`);
  }
  if (risk.incorrectCount > 0) {
    reasons.push(`${risk.incorrectCount} incorrect digital response${risk.incorrectCount === 1 ? "" : "s"}`);
  }
  if (risk.practicalRepeatCount > 0) {
    reasons.push(`${risk.practicalRepeatCount} practical repeat decision${risk.practicalRepeatCount === 1 ? "" : "s"}`);
  }
  if (risk.practicalIntegrityCount > 0) {
    reasons.push(`${risk.practicalIntegrityCount} practical integrity escalation${risk.practicalIntegrityCount === 1 ? "" : "s"}`);
  }
  return reasons.length
    ? ` This focus is elevated by stored evidence: ${reasons.join(", ")}. Do not reuse a known assessment item.`
    : "";
}

function buildProbeBriefs(risks: RiskSignal[]): OralDefenseProbeBrief[] {
  const riskByIdentity = new Map(
    risks.map((risk) => [riskIdentity(risk.deepDiveKey, risk.focusKey), risk]),
  );
  const baselineIds = new Set(
    ORAL_DEFENSE_ALWAYS_PROBE.map((probe) => riskIdentity(probe.deepDiveKey, probe.focusKey)),
  );

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
      _baselineOrder: index,
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
      _baselineOrder: ORAL_DEFENSE_ALWAYS_PROBE.length + index,
    }));

  return [...baseline, ...targeted]
    .sort((left, right) => right._score - left._score || left._baselineOrder - right._baselineOrder)
    .map(({ _score, _baselineOrder, ...probe }) => probe);
}

async function loadPracticalHistory(tutorAssignmentId: string) {
  const result = await pool.query(
    `SELECT e.id,
            e.proof_key,
            e.proof_version,
            e.attempt_number,
            e.competency_links,
            r.outcome,
            r.feedback,
            e.submitted_at,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
      ORDER BY e.proof_key ASC, e.attempt_number ASC`,
    [tutorAssignmentId],
  );
  return result.rows;
}

function latestPracticalSignals(rows: PracticalEvidenceRow[]) {
  const latest = new Map<string, PracticalEvidenceRow>();
  for (const row of rows) {
    const key = String(row.proof_key);
    const current = latest.get(key);
    if (!current || Number(row.attempt_number) > Number(current.attempt_number)) latest.set(key, row);
  }

  return Array.from(latest.values()).map((row) => ({
    proofKey: String(row.proof_key),
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    status: row.outcome || "submitted",
    feedback: row.feedback || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at || null,
  }));
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
      ORDER BY attempt_number DESC, completed_at DESC
      LIMIT 1`,
    [tutorAssignmentId],
  );
  return result.rows[0] || null;
}

function buildEvidenceFingerprint(
  assessmentRows: AssessmentEvidenceRow[],
  practicalRows: PracticalEvidenceRow[],
) {
  const assessmentSnapshot = assessmentRows.map((row) => ({
    id: String(row.id),
    assessmentKey: String(row.assessment_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    passed: Boolean(row.passed),
    hasCriticalFail: Boolean(row.has_critical_fail),
    questionResults: parseArray(row.question_results),
    completedAt: new Date(row.completed_at).toISOString(),
  }));
  const practicalSnapshot = practicalRows.map((row) => ({
    id: String(row.id),
    proofKey: String(row.proof_key),
    proofVersion: Number(row.proof_version),
    attemptNumber: Number(row.attempt_number),
    competencyLinks: parseArray(row.competency_links),
    outcome: row.outcome || "submitted",
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    submittedAt: new Date(row.submitted_at).toISOString(),
  }));

  return createHash("sha256")
    .update(JSON.stringify({ assessmentSnapshot, practicalSnapshot }))
    .digest("hex");
}

export async function buildOralDefenseBrief(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const assignment = await assertCapabilityReviewerAccessToAssignment(input);
  await assertPreOralCapabilityEvidenceReady(input.tutorAssignmentId);

  const latestDefense = await getLatestOralDefense(input.tutorAssignmentId);
  if (latestDefense?.outcome === "approved") {
    throw httpError(409, "The Oral Integrity Defense has already been approved.");
  }
  if (latestDefense?.outcome === "integrity_review") {
    throw httpError(409, "The Oral Integrity Defense is under integrity review and cannot be repeated yet.");
  }

  const [assessmentResult, practicalRows, readinessEvidence, specialistResult] = await Promise.all([
    pool.query(
      `SELECT id,
              assessment_key,
              bank_version,
              attempt_number,
              evidence_kind,
              passed,
              has_critical_fail,
              question_results,
              completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY completed_at ASC, attempt_number ASC`,
      [input.tutorAssignmentId],
    ),
    loadPracticalHistory(input.tutorAssignmentId),
    getCapabilityReadinessEvidence(input.tutorAssignmentId),
    pool.query(
      `SELECT first_name, last_name
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [assignment.tutor_id],
    ),
  ]);

  const risks = buildRiskSignals(assessmentResult.rows, practicalRows);
  const probes = buildProbeBriefs(risks);
  const evidenceFingerprint = buildEvidenceFingerprint(assessmentResult.rows, practicalRows);
  const attemptNumber = Number(latestDefense?.attempt_number || 0) + 1;
  const briefId = createHash("sha256")
    .update(
      [
        input.tutorAssignmentId,
        String(ORAL_DEFENSE_VERSION),
        String(attemptNumber),
        evidenceFingerprint,
        probes.map((probe) => `${probe.deepDiveKey}:${probe.focusKey}:${probe.source}`).join("|"),
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);
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
      practicalSignals: latestPracticalSignals(practicalRows),
      riskSignalCount: risks.length,
    },
    probes,
  };
}

function assertProbeSetMatchesBrief(
  expected: OralDefenseProbeBrief[],
  actual: CapabilityOralDefenseProbe[],
) {
  const expectedIds = expected
    .map((probe) => riskIdentity(probe.deepDiveKey, probe.focusKey))
    .sort();
  const actualIds = actual
    .map((probe) => riskIdentity(probe.deepDiveKey, probe.focusKey))
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

  const brief = await buildOralDefenseBrief(input);
  if (input.briefId !== brief.briefId || input.attemptNumber !== brief.attemptNumber) {
    throw httpError(409, "The oral defense brief is stale because the Specialist's evidence state changed. Refresh the brief before continuing.");
  }

  assertProbeSetMatchesBrief(brief.probes, input.probes);
  const evaluation = evaluateOralDefenseProbes(input.probes);
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
        evaluation.integrityConcernCount,
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

    const latestDefense = await getLatestOralDefense(tutorAssignmentId);
    if (latestDefense?.outcome === "approved" || latestDefense?.outcome === "integrity_review") continue;

    candidates.push({
      tutorAssignmentId,
      tutorId: String(row.tutor_id),
      specialistName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
      podName: row.pod_name || null,
      latestDefenseOutcome: latestDefense?.outcome || null,
      nextAttemptNumber: Number(latestDefense?.attempt_number || 0) + 1,
      readinessStatus: readiness.status,
      missingRequirementCodes: readiness.missingRequirementCodes,
    });
  }

  return candidates;
}
