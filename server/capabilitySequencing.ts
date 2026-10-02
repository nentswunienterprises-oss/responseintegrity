import { pool } from "./db";
import {
  buildCapabilityTrainingAvailability,
  getCapabilityTrainingAssessmentPlan,
  isCapabilityTransformationSandboxReady,
  type CapabilityTrainingActiveBank,
  type CapabilityTrainingAttempt,
  type CapabilityTrainingAvailability,
} from "@shared/capabilityTrainingSequencing";
import { assertCapabilityTutorAssignmentOwnership } from "./capabilityEngine";

function httpError(status: number, message: string, data?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    status?: number;
    data?: Record<string, unknown>;
  };
  error.status = status;
  error.data = data;
  return error;
}

function parseDocumentStatuses(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function hasCompleteSpecialistDocumentation(tutorId: string) {
  const result = await pool.query(
    `SELECT doc_1_submission_verified,
            doc_2_submission_verified,
            doc_3_submission_verified,
            doc_4_submission_verified,
            doc_5_submission_verified,
            doc_6_submission_verified,
            documents_status
       FROM public.tutor_applications
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [tutorId],
  );

  return result.rows.some((row) => {
    const verified = [
      row.doc_1_submission_verified,
      row.doc_2_submission_verified,
      row.doc_3_submission_verified,
      row.doc_4_submission_verified,
      row.doc_5_submission_verified,
      row.doc_6_submission_verified,
    ].every(Boolean);
    if (verified) return true;

    const statuses = parseDocumentStatuses(row.documents_status);
    return ["1", "2", "3", "4", "5", "6"].every(
      (step) => String(statuses[step] || "").trim().toLowerCase() === "approved",
    );
  });
}

export async function getSpecialistCapabilityTrainingState(input: {
  tutorAssignmentId: string;
  tutorId: string;
  now?: Date;
}): Promise<{
  assessments: CapabilityTrainingAvailability[];
  sandboxReady: boolean;
}> {
  await assertCapabilityTutorAssignmentOwnership(
    input.tutorAssignmentId,
    input.tutorId,
  );

  const [bankResult, attemptResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key,
              bank_version,
              evidence_kind,
              max_attempts,
              retry_cooldown_hours,
              COALESCE((to_jsonb(config)->>'review_mode')::boolean, false) AS review_mode
         FROM private.specialist_capability_assessment_configs AS config
        WHERE active = true
          AND evidence_kind IN ('mastery', 'retrieval', 'transfer')`,
    ),
    pool.query(
      `SELECT assessment_key,
              bank_version,
              attempt_number,
              evidence_kind,
              passed,
              completed_at
         FROM public.specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND evidence_kind IN ('mastery', 'retrieval', 'transfer')
        ORDER BY completed_at ASC`,
      [input.tutorAssignmentId, input.tutorId],
    ),
  ]);

  const reviewModeBanks = new Set(
    bankResult.rows
      .filter((row) => Boolean(row.review_mode))
      .map(
        (row) =>
          `${String(row.assessment_key)}:${Number(row.bank_version)}`,
      ),
  );

  const activeBanks: CapabilityTrainingActiveBank[] = bankResult.rows.map(
    (row) => ({
      assessmentKey: String(row.assessment_key),
      bankVersion: Number(row.bank_version),
      evidenceKind: String(
        row.evidence_kind,
      ) as CapabilityTrainingActiveBank["evidenceKind"],
      maxAttempts: Number(row.max_attempts),
      retryCooldownHours: Number(row.retry_cooldown_hours),
    }),
  );

  const attempts: CapabilityTrainingAttempt[] = attemptResult.rows
    .filter(
      (row) =>
        !reviewModeBanks.has(
          `${String(row.assessment_key)}:${Number(row.bank_version)}`,
        ),
    )
    .map((row) => ({
      assessmentKey: String(row.assessment_key),
      bankVersion: Number(row.bank_version),
      attemptNumber: Number(row.attempt_number),
      evidenceKind: String(
        row.evidence_kind,
      ) as CapabilityTrainingAttempt["evidenceKind"],
      passed: Boolean(row.passed),
      completedAt: row.completed_at,
    }));

  const assessments = buildCapabilityTrainingAvailability({
    now: input.now || new Date(),
    activeBanks,
    attempts,
  });

  return {
    assessments,
    sandboxReady: isCapabilityTransformationSandboxReady(assessments),
  };
}

export async function getSpecialistCapabilityPlanStatus(input: {
  tutorAssignmentId: string;
  tutorId: string;
  now?: Date;
}) {
  const state = await getSpecialistCapabilityTrainingState(input);
  return state.assessments;
}

export async function assertCapabilityAssessmentAvailable(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  const isPlannedAssessment = getCapabilityTrainingAssessmentPlan().some(
    (entry) => entry.assessmentKey === input.assessmentKey,
  );
  if (!isPlannedAssessment) {
    throw httpError(
      404,
      "This assessment is not part of the active Specialist Training capability plan.",
    );
  }

  const { assessments } = await getSpecialistCapabilityTrainingState({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });
  const status = assessments.find(
    (entry) => entry.assessmentKey === input.assessmentKey,
  );
  if (!status) {
    throw httpError(404, "Capability assessment is not part of the active Training plan.");
  }
  if (status.status === "available") return status;

  if (status.status === "unavailable") {
    throw httpError(404, "This Capability bank is not active yet.", {
      availability: status,
    });
  }

  if (status.status === "complete") {
    throw httpError(
      409,
      "Current-version evidence for this Capability gate is already complete.",
      { availability: status },
    );
  }

  const messages: Record<string, string> = {
    prerequisite_incomplete:
      "Complete the preceding Specialist Training evidence before this Capability gate opens.",
    spacing_interval:
      "This delayed Retrieval gate has not reached its required spacing interval yet.",
    attempt_limit:
      "The current Capability attempt allowance has been reached and requires review.",
    retry_cooldown:
      "This Capability retry is still inside its cooling-off window.",
  };

  throw httpError(
    409,
    messages[String(status.reason)] || "This Capability gate is currently locked.",
    { availability: status },
  );
}

export async function reconcileCapabilitySandboxAuthority(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const state = await getSpecialistCapabilityTrainingState(input);
  if (!state.sandboxReady) {
    return { ...state, promoted: false, mode: null };
  }

  const docsComplete = await hasCompleteSpecialistDocumentation(input.tutorId);
  if (!docsComplete) {
    return {
      ...state,
      promoted: false,
      mode: "applicant",
      reason: "documentation_incomplete",
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `SELECT id, operational_mode
         FROM public.tutor_assignments
        WHERE id = $1
          AND tutor_id = $2
        FOR UPDATE`,
      [input.tutorAssignmentId, input.tutorId],
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      throw httpError(404, "Specialist assignment was not found.");
    }

    const lifecycleResult = await client.query(
      `SELECT id, mode
         FROM public.tutor_battle_test_statuses
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
        FOR UPDATE`,
      [input.tutorAssignmentId, input.tutorId],
    );
    const lifecycle = lifecycleResult.rows[0] || null;

    const assignmentMode = String(assignment.operational_mode || "training")
      .trim()
      .toLowerCase();
    const lifecycleMode = String(lifecycle?.mode || "")
      .trim()
      .toLowerCase();
    const currentMode = lifecycleMode || assignmentMode || "training";

    if (currentMode === "sandbox") {
      await client.query("COMMIT");
      return { ...state, promoted: false, mode: "sandbox" };
    }

    if (!["training", "applicant"].includes(currentMode)) {
      await client.query("COMMIT");
      return {
        ...state,
        promoted: false,
        mode: currentMode,
        reason: "existing_lifecycle_authority_preserved",
      };
    }

    await client.query(
      `UPDATE public.tutor_assignments
          SET operational_mode = 'sandbox'
        WHERE id = $1
          AND tutor_id = $2`,
      [input.tutorAssignmentId, input.tutorId],
    );

    if (lifecycle) {
      await client.query(
        `UPDATE public.tutor_battle_test_statuses
            SET mode = 'sandbox',
                last_synced_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [String(lifecycle.id)],
      );
    } else {
      await client.query(
        `INSERT INTO public.tutor_battle_test_statuses (
           tutor_assignment_id,
           tutor_id,
           mode,
           module_progress,
           next_battle_tests,
           last_synced_at,
           created_at,
           updated_at
         ) VALUES ($1, $2, 'sandbox', '[]'::jsonb, '[]'::jsonb, now(), now(), now())`,
        [input.tutorAssignmentId, input.tutorId],
      );
    }

    await client.query("COMMIT");
    return { ...state, promoted: true, mode: "sandbox" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
