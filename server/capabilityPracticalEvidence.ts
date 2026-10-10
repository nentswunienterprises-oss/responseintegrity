import { pool } from "./db";
import { getSandboxCapabilityReadiness } from "./sandboxEnvironment";
import { assertCompletedExecuteChallenge, getExecuteChallengeForTd } from "./practicalExecuteChallenge";
import {
  CAPABILITY_PRACTICAL_PROOFS,
  deriveCapabilityPracticalReview,
  getCapabilityPracticalProofDefinition,
  snapshotCapabilityPracticalRubric,
  validateCapabilityPracticalRubric,
  type CapabilityPracticalArtifactType,
  type CapabilityPracticalCriterionReviewInput,
  type CapabilityPracticalProofDefinition,
  type CapabilityPracticalReviewRubric,
} from "@shared/capabilityPracticalEvidence";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeArtifactUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw httpError(400, "A valid HTTPS recording link is required.");
  }

  if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some((key) => /token|secret|password|api.?key|auth/i.test(key))) {
    throw httpError(400, "Recording links must not contain credentials or access tokens.");
  }
  if (parsed.protocol !== "https:") {
    throw httpError(400, "Practical evidence recording links must use HTTPS.");
  }

  return parsed.toString();
}

function validateDeclaration(
  definition: CapabilityPracticalProofDefinition,
  declaration: Record<string, unknown>,
) {
  const normalized: Record<string, string> = {};

  for (const prompt of definition.declarationPrompts) {
    const value = String(declaration[prompt.key] || "").trim();
    if (value.length < prompt.minLength) {
      throw httpError(
        400,
        `Declaration ${prompt.key} must contain at least ${prompt.minLength} characters.`,
      );
    }
    normalized[prompt.key] = value;
  }

  return normalized;
}

function parseFrozenRubric(value: unknown): CapabilityPracticalReviewRubric {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") {
    throw httpError(409, "This practical submission does not contain a frozen review rubric.");
  }
  try {
    return validateCapabilityPracticalRubric(parsed as CapabilityPracticalReviewRubric);
  } catch (error) {
    throw httpError(
      409,
      `This practical submission contains an invalid frozen review rubric: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function buildPublicPracticalDefinitions() {
  return CAPABILITY_PRACTICAL_PROOFS.map((proof) => ({
    key: proof.key,
    version: proof.version,
    title: proof.title,
    purpose: proof.purpose,
    reviewRubric: { version: proof.reviewRubric.version, criteria: proof.reviewRubric.criteria.map(({ key, label, observableStandard, clearAnchor, partialAnchor, failAnchor }) => ({ key, label, observableStandard, clearAnchor, partialAnchor, failAnchor })) },
    requiredArtifactTypes: proof.requiredArtifactTypes,
    mustShow: proof.mustShow,
    declarationPrompts: proof.declarationPrompts,
    realStudentDataAllowed: false,
  }));
}

async function assertTutorAssignmentOwnership(tutorAssignmentId: string, tutorId: string) {
  const result = await pool.query(
    `SELECT ta.id, ta.pod_id, ta.operational_mode, p.td_id
       FROM tutor_assignments ta
       LEFT JOIN pods p ON p.id = ta.pod_id
      WHERE ta.id = $1
        AND ta.tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );

  if (!result.rowCount) {
    throw httpError(403, "Specialist assignment not found or does not belong to the authenticated user.");
  }

  return result.rows[0];
}

async function getLatestProofAttempt(tutorAssignmentId: string, proofKey: string, proofVersion: number) {
  const result = await pool.query(
    `SELECT e.id,
            e.attempt_number,
            e.submitted_at,
            r.outcome,
            r.feedback,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
        AND e.proof_key = $2
        AND e.proof_version = $3
      ORDER BY e.attempt_number DESC
      LIMIT 1`,
    [tutorAssignmentId, proofKey, proofVersion],
  );

  return result.rows[0] || null;
}

export async function submitPracticalCapabilityEvidence(input: {
  tutorAssignmentId: string;
  tutorId: string;
  proofKey: string;
  proofVersion: number;
  artifactUrl: string;
  artifactType: CapabilityPracticalArtifactType;
  declaration: Record<string, unknown>;
  noRealStudentDataConfirmed: boolean;
  executeChallengeId?: string | null;
}) {
  await assertPracticalEntry(input.tutorAssignmentId, input.tutorId);

  const definition = getCapabilityPracticalProofDefinition(input.proofKey);
  if (!definition) throw httpError(404, "Unknown practical capability proof.");
  if (input.proofVersion !== definition.version) {
    throw httpError(409, "This practical proof version is no longer current.");
  }
  if (!definition.requiredArtifactTypes.includes(input.artifactType)) {
    throw httpError(400, "The submitted recording type does not satisfy this practical proof.");
  }
  if (!input.noRealStudentDataConfirmed) {
    throw httpError(400, "Practical evidence may only use the provided sandbox scenario. Real student data is not allowed.");
  }

  const latest = await getLatestProofAttempt(
    input.tutorAssignmentId,
    definition.key,
    definition.version,
  );

  if (latest && !latest.outcome) {
    throw httpError(409, "This practical proof already has a submission awaiting review.");
  }
  if (latest?.outcome === "approved") {
    throw httpError(409, "This practical proof has already been approved.");
  }
  if (latest?.outcome === "integrity_review") {
    throw httpError(409, "This practical proof is under integrity review and cannot be resubmitted yet.");
  }

  const attemptNumber = Number(latest?.attempt_number || 0) + 1;
  const executeChallengeId = definition.key === "execute"
    ? await assertCompletedExecuteChallenge({
        tutorAssignmentId: input.tutorAssignmentId,
        tutorId: input.tutorId,
        attemptNumber,
        challengeId: String(input.executeChallengeId || ""),
      })
    : null;
  if (definition.key !== "execute" && input.executeChallengeId) {
    throw httpError(400, "Only Execute may carry an Execute challenge reference.");
  }
  const artifactUrl = normalizeArtifactUrl(input.artifactUrl);
  const declaration = validateDeclaration(definition, input.declaration);
  const rubricSnapshot = snapshotCapabilityPracticalRubric(definition.reviewRubric);

  try {
    const result = await pool.query(
      `INSERT INTO specialist_capability_practical_evidence (
         tutor_assignment_id,
         tutor_id,
         proof_key,
         proof_version,
         attempt_number,
         artifact_url,
         artifact_type,
         declaration,
         competency_links,
         rubric_version,
         rubric_snapshot,
         no_real_student_data_confirmed,
         execute_challenge_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, true, $12)
       RETURNING id, submitted_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        definition.key,
        definition.version,
        attemptNumber,
        artifactUrl,
        input.artifactType,
        JSON.stringify(declaration),
        JSON.stringify(definition.competencyLinks),
        rubricSnapshot.version,
        JSON.stringify(rubricSnapshot),
        executeChallengeId,
      ],
    );

    return {
      evidenceId: result.rows[0]?.id,
      proofKey: definition.key,
      proofVersion: definition.version,
      rubricVersion: rubricSnapshot.version,
      attemptNumber,
      status: "submitted" as const,
      submittedAt: result.rows[0]?.submitted_at,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This practical proof attempt already exists.");
    }
    throw error;
  }
}

export async function getSpecialistPracticalEvidence(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const result = await pool.query(
    `SELECT e.id,
            e.proof_key,
            e.proof_version,
            e.rubric_version,
            e.attempt_number,
            e.artifact_type,
            e.execute_challenge_id,
            e.submitted_at,
            r.outcome,
            r.feedback,
            r.reason_code,
            r.clear_count,
            r.partial_count,
            r.fail_count,
            r.critical_fail_count,
            r.reviewed_at
       FROM specialist_capability_practical_evidence e
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.tutor_assignment_id = $1
        AND e.tutor_id = $2
      ORDER BY e.submitted_at DESC`,
    [input.tutorAssignmentId, input.tutorId],
  );

  return result.rows.map((row) => ({
    evidenceId: row.id,
    proofKey: row.proof_key,
    proofVersion: Number(row.proof_version),
    rubricVersion: row.rubric_version === null ? null : Number(row.rubric_version),
    attemptNumber: Number(row.attempt_number),
    artifactType: row.artifact_type,
    executeChallengeId: row.execute_challenge_id || null,
    status: row.outcome || "submitted",
    feedback: row.feedback || null,
    reasonCode: row.reason_code || null,
    rubricCounts: row.outcome
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
}

function assertReviewerRole(role: string) {
  const normalized = String(role || "").toLowerCase();
  if (!new Set(["td"]).has(normalized)) {
    throw httpError(403, "Capability practical review access is restricted.");
  }
  return normalized;
}

export async function getPracticalReviewQueue(input: {
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = assertReviewerRole(input.reviewerRole);
  const params: unknown[] = [];
  let tdScope = "";

  if (reviewerRole === "td") {
    params.push(input.reviewerId);
    tdScope = ` AND p.td_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT e.id,
            e.tutor_assignment_id,
            e.tutor_id,
            e.proof_key,
            e.proof_version,
            e.rubric_version,
            e.rubric_snapshot,
            e.attempt_number,
            e.artifact_url,
            e.artifact_type,
            e.declaration,
            e.execute_challenge_id,
            e.submitted_at,
            p.pod_name,
            u.first_name,
            u.last_name
       FROM specialist_capability_practical_evidence e
       JOIN tutor_assignments ta ON ta.id = e.tutor_assignment_id
       LEFT JOIN pods p ON p.id = ta.pod_id
       JOIN users u ON u.id = e.tutor_id
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE r.id IS NULL
        ${tdScope}
      ORDER BY e.submitted_at ASC`,
    params,
  );

  return Promise.all(result.rows.map(async (row) => {
    const reviewRubric = parseFrozenRubric(row.rubric_snapshot);
    const rubricVersion = Number(row.rubric_version || 0);
    if (rubricVersion !== reviewRubric.version) {
      throw httpError(409, `Practical evidence ${String(row.id)} has mismatched rubric lineage.`);
    }

    return {
      evidenceId: row.id,
      tutorAssignmentId: row.tutor_assignment_id,
      tutorId: row.tutor_id,
      specialistName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
      podName: row.pod_name || null,
      proofKey: row.proof_key,
      proofVersion: Number(row.proof_version),
      rubricVersion,
      reviewRubric,
      attemptNumber: Number(row.attempt_number),
      artifactUrl: row.artifact_url,
      artifactType: row.artifact_type,
      declaration: row.declaration,
      executeChallenge: row.proof_key === "execute" && row.execute_challenge_id
        ? await getExecuteChallengeForTd(String(row.execute_challenge_id),String(row.tutor_assignment_id),String(row.tutor_id))
        : null,
      submittedAt: row.submitted_at,
    };
  }));
}

async function assertReviewerCanAccessEvidence(input: {
  evidenceId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const reviewerRole = assertReviewerRole(input.reviewerRole);
  const result = await pool.query(
    `SELECT e.id,
            e.proof_key,
            e.proof_version,
            e.rubric_version,
            e.rubric_snapshot,
            e.execute_challenge_id,
            e.tutor_assignment_id,
            e.tutor_id,
            p.td_id,
            r.id AS review_id
       FROM specialist_capability_practical_evidence e
       JOIN tutor_assignments ta ON ta.id = e.tutor_assignment_id
       LEFT JOIN pods p ON p.id = ta.pod_id
       LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
      WHERE e.id = $1
      LIMIT 1`,
    [input.evidenceId],
  );

  const row = result.rows[0];
  if (!row) throw httpError(404, "Practical capability evidence not found.");
  if (row.review_id) throw httpError(409, "This practical capability evidence has already been reviewed.");
  if (reviewerRole === "td" && String(row.td_id || "") !== input.reviewerId) {
    throw httpError(403, "This evidence is outside the reviewer's assigned pod scope.");
  }

  const rubric = parseFrozenRubric(row.rubric_snapshot);
  const rubricVersion = Number(row.rubric_version || 0);
  if (rubricVersion !== rubric.version) {
    throw httpError(409, "Practical evidence rubric version does not match its frozen rubric snapshot.");
  }

  return { reviewerRole, row, rubric };
}

export async function reviewPracticalCapabilityEvidence(input: {
  evidenceId: string;
  reviewerId: string;
  reviewerRole: string;
  rubricVersion: number;
  criterionJudgments: CapabilityPracticalCriterionReviewInput[];
  feedback?: string | null;
  executeTraceVideoVerified?: boolean;
}) {
  const access = await assertReviewerCanAccessEvidence(input);
  if (input.rubricVersion !== access.rubric.version) {
    throw httpError(409, "The practical review rubric changed or does not match this frozen submission.");
  }

  let derived;
  try {
    derived = deriveCapabilityPracticalReview(access.rubric, input.criterionJudgments);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : "Invalid practical rubric review.");
  }

  if (access.row.proof_key === "execute") {
    if (input.executeTraceVideoVerified !== true) {
      throw httpError(400, "The assigned TD must affirm that the challenge reference, three persisted turns and demonstration recording agree.");
    }
    if (!access.row.execute_challenge_id) {
      throw httpError(409, "Execute v2 cannot be reviewed without its completed server-assigned challenge.");
    }
    const challenge=await getExecuteChallengeForTd(
      String(access.row.execute_challenge_id),
      String(access.row.tutor_assignment_id),
      String(access.row.tutor_id),
    );
    const criticalFlags = new Set(["assisted_recorded_as_independent","unobservable_work_claimed_as_observed","no_rescue_condition_broken","unauthorised_condition_change","independence_claim_without_clean_observation"]);
    const anyCritical = challenge.history.some((turn) =>
      (turn.riskFlags || []).some((flag) => criticalFlags.has(flag)));
    if (anyCritical && derived.outcome !== "integrity_review") {
      throw httpError(409, "Execute contains an objective integrity contradiction. Record the relevant integrity-critical Fail, with observed evidence; approval or ordinary repeat is not allowed.");
    }
  }

  const feedback = String(input.feedback || "").trim() || null;
  if (derived.outcome !== "approved" && (!feedback || feedback.length < 20)) {
    throw httpError(400, "Repeat required and integrity review outcomes need at least 20 characters of actionable reviewer feedback.");
  }

  try {
    const result = await pool.query(
      `INSERT INTO specialist_capability_practical_reviews (
         evidence_id,
         reviewer_id,
         reviewer_role,
         rubric_version,
         outcome_rule_version,
         criterion_judgments,
         clear_count,
         partial_count,
         fail_count,
         critical_fail_count,
         critical_fail_criterion_keys,
         outcome,
         reason_code,
         feedback,
         execute_trace_video_verified
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)
       RETURNING id, reviewed_at`,
      [
        input.evidenceId,
        input.reviewerId,
        access.reviewerRole,
        derived.rubricVersion,
        derived.outcomeRuleVersion,
        JSON.stringify(derived.criterionReviews),
        derived.clearCount,
        derived.partialCount,
        derived.failCount,
        derived.criticalFailCount,
        JSON.stringify(derived.criticalFailCriterionKeys),
        derived.outcome,
        derived.reasonCode,
        feedback,
        access.row.proof_key==="execute" && input.executeTraceVideoVerified===true,
      ],
    );

    return {
      reviewId: result.rows[0]?.id,
      evidenceId: input.evidenceId,
      outcome: derived.outcome,
      reasonCode: derived.reasonCode,
      rubricVersion: derived.rubricVersion,
      outcomeRuleVersion: derived.outcomeRuleVersion,
      clearCount: derived.clearCount,
      partialCount: derived.partialCount,
      failCount: derived.failCount,
      criticalFailCount: derived.criticalFailCount,
      reviewedAt: result.rows[0]?.reviewed_at,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This practical capability evidence has already been reviewed.");
    }
    throw error;
  }
}


export async function getPracticalEntryStatus(tutorAssignmentId: string, tutorId: string) {
  const assignment = await assertTutorAssignmentOwnership(tutorAssignmentId, tutorId);
  const result = await pool.query(
    `SELECT id, decision, checklist FROM public.tutor_sandbox_mock_assessments
      WHERE tutor_assignment_id=$1 AND tutor_id=$2
        AND assessed_by_user_id=$3
        AND checklist->>'assessment_version'='2'
        AND checklist->>'assessment_owner'='td'
        AND checklist->>'next_stage'='practicals'
      ORDER BY assessed_at DESC, id DESC LIMIT 1`,
    [tutorAssignmentId, tutorId, String(assignment.td_id || "")],
  );
  const signoff = result.rows[0] || null;
  const readiness = await getSandboxCapabilityReadiness({ tutorAssignmentId, tutorId });
  const blockers: string[] = [];
  if (assignment.operational_mode !== "sandbox") blockers.push("The Specialist is not in Sandbox.");
  if (!assignment.td_id) blockers.push("The Specialist is missing an assigned TD.");
  if (signoff?.decision !== "passed") blockers.push("Latest version-2 assigned-TD Practicals-readiness approval is missing.");
  if (signoff?.checklist?.capability_snapshot?.practicalsReady !== true) blockers.push("TD sign-off lacks positive Sandbox capability evidence.");
  if (!readiness.practicalsReady) blockers.push("Current Sandbox capability evidence is not ready.");
  return { ready: blockers.length === 0, blockers, signoffId: signoff?.id || null };
}

async function assertPracticalEntry(tutorAssignmentId: string, tutorId: string) {
  const gate = await getPracticalEntryStatus(tutorAssignmentId, tutorId);
  if (!gate.ready) throw httpError(403, gate.blockers.join(" "));
}

export async function getPracticalCompletionStatus(tutorAssignmentId: string, tutorId: string) {
  const entry = await getPracticalEntryStatus(tutorAssignmentId, tutorId);
  const rows = await pool.query(
    `SELECT DISTINCT ON (e.proof_key) e.id, e.proof_key, e.proof_version, e.attempt_number, r.outcome
       FROM public.specialist_capability_practical_evidence e
       LEFT JOIN public.specialist_capability_practical_reviews r ON r.evidence_id=e.id
       WHERE e.tutor_assignment_id=$1 AND e.tutor_id=$2
       ORDER BY e.proof_key, e.proof_version DESC, e.attempt_number DESC`,
    [tutorAssignmentId, tutorId],
  );
  const proofs = CAPABILITY_PRACTICAL_PROOFS.map((proof) => {
    const current = rows.rows.find((r) => r.proof_key === proof.key && Number(r.proof_version) === proof.version);
    return { key: proof.key, version: proof.version, evidenceId: current?.id || null,
      status: current?.outcome || (current ? "submitted" : "not_submitted") };
  });
  const allApproved = proofs.every((p) => p.status === "approved");
  const decisionRows = await pool.query(
    `SELECT id, decision, proof_evidence_ids, evidence_note, decided_at, td_user_id
       FROM public.specialist_practical_completion_decisions
       WHERE tutor_assignment_id=$1 AND tutor_id=$2
       ORDER BY decided_at DESC,id DESC LIMIT 1`,
    [tutorAssignmentId,tutorId],
  );
  const tdDecision = decisionRows.rows[0] || null;
  const complete = entry.ready && allApproved && tdDecision?.decision === "approved"
    && proofs.every(p => tdDecision.proof_evidence_ids?.[p.key] === p.evidenceId);
  return { entry, proofs, allApproved, tdDecision, complete, readyForTDCompletionReview: entry.ready && allApproved,
    readyForTrial: complete };
}


export async function recordPracticalTdCompletion(input: { tutorAssignmentId: string; tutorId: string; reviewerId: string; decision: "approved" | "remediation_required"; evidenceNote: string }) {
  if (input.evidenceNote.trim().length < 30) throw httpError(400, "Give at least 30 characters of observed evidence.");
  // Lock assignment against concurrent gate decisions. Only an assigned TD may decide.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assignment = await client.query(
      `SELECT p.td_id FROM public.tutor_assignments ta JOIN public.pods p ON p.id=ta.pod_id
       WHERE ta.id=$1 AND ta.tutor_id=$2 FOR UPDATE OF ta`,
      [input.tutorAssignmentId, input.tutorId],
    );
    if (String(assignment.rows[0]?.td_id || "") !== input.reviewerId) throw httpError(403, "Only this Specialist's assigned TD may decide Practicals.");
    const latest = await client.query(
      `SELECT DISTINCT ON(e.proof_key) e.id,e.proof_key,e.proof_version,r.outcome
       FROM public.specialist_capability_practical_evidence e
       LEFT JOIN public.specialist_capability_practical_reviews r ON r.evidence_id=e.id
       WHERE e.tutor_assignment_id=$1 AND e.tutor_id=$2
       ORDER BY e.proof_key,e.proof_version DESC,e.attempt_number DESC`,
      [input.tutorAssignmentId,input.tutorId],
    );
    const evidenceIds: Record<string,string> = {};
    for (const proof of CAPABILITY_PRACTICAL_PROOFS) {
      const row=latest.rows.find(x=>x.proof_key===proof.key && Number(x.proof_version)===proof.version);
      if (row?.outcome==="approved") evidenceIds[proof.key]=String(row.id);
      else if (input.decision==="approved") throw httpError(409,`Practical ${proof.key} is not approved at the current version.`);
    }
    const previous=await client.query(
      `SELECT decision,proof_evidence_ids FROM public.specialist_practical_completion_decisions
       WHERE tutor_assignment_id=$1 AND tutor_id=$2 ORDER BY decided_at DESC,id DESC LIMIT 1`,
      [input.tutorAssignmentId,input.tutorId],
    );
    if (previous.rows[0]?.decision === "approved") throw httpError(409,"Practicals were already approved; a separate governed revocation is required.");
    if (input.decision==="approved") {
      const current=await getPracticalEntryStatus(input.tutorAssignmentId,input.tutorId);
      if (!current.ready) throw httpError(409,current.blockers.join(" "));
    }
    const result=await client.query(
      `INSERT INTO public.specialist_practical_completion_decisions
       (tutor_assignment_id,tutor_id,td_user_id,decision,proof_evidence_ids,evidence_note)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING id,decided_at`,
      [input.tutorAssignmentId,input.tutorId,input.reviewerId,input.decision,JSON.stringify(evidenceIds),input.evidenceNote.trim()],
    );
    await client.query("COMMIT");
    return { decisionId:result.rows[0].id, decidedAt:result.rows[0].decided_at, decision:input.decision, evidenceIds, operationalModeUnchanged:true };
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
