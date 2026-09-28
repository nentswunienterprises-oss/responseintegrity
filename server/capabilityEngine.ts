import { pool } from "./db";
import { cleanCapabilityDisplayCopy } from "./capabilityDisplayCopy";
import { buildCapabilityAttemptPlan, type CapabilityAttemptPlan } from "./capabilityBank";
import {
  buildCapabilityLedger,
  evaluateCapabilityAssessment,
  type CapabilityLedgerAttempt,
  type CapabilityQuestionDefinition,
  type CapabilityQuestionResult,
  type CapabilityResponseInput,
} from "@shared/capabilityEngine";
import {
  projectCapabilityAssessmentForSpecialist,
  projectCapabilityAttemptResultForSpecialist,
} from "./capabilityPublicProjection";
import {
  createCapabilityInteractionToken,
  createCapabilityQuestionReceipt,
  readCapabilityInteractionToken,
  readCapabilityQuestionReceipt,
  type CapabilityInteractionPayload,
  type CapabilityQuestionReceiptPayload,
} from "./capabilityInteractionEnvelope";

export interface CapabilityQuestionConfirmationPublic {
  questionKey: string;
  selectedOptionKeys: string[];
  correct: boolean;
  feedback: string;
  confirmedAt: unknown;
}

export function buildPublicCapabilityAssessment(plan: CapabilityAttemptPlan) {
  return projectCapabilityAssessmentForSpecialist({
    definition: plan.form.definition,
    formId: plan.form.formId,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    maxAttempts: plan.config.maxAttempts,
  });
}

function isProofCapabilityReviewEnvironment() {
  let supabaseHost = "";
  try {
    supabaseHost = new URL(String(process.env.SUPABASE_URL || "")).hostname.toLowerCase();
  } catch {
    supabaseHost = "";
  }

  const isProofProject =
    supabaseHost === "jftlxeacphvbnhbsbpxc.supabase.co";
  const isNonProductionRuntime =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview";

  return isProofProject && isNonProductionRuntime;
}

export async function resetCapabilityReviewSession(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(
    input.tutorAssignmentId,
    input.tutorId,
  );

  const configResult = await pool.query(
    `SELECT bank_version,
            review_mode
       FROM private.specialist_capability_assessment_configs
      WHERE assessment_key = $1
        AND active = true
      LIMIT 1`,
    [input.assessmentKey],
  );

  const config = configResult.rows[0];
  if (!config || !Boolean(config.review_mode)) {
    return {
      reviewMode: false,
      reset: false,
      bankVersion: config ? Number(config.bank_version) : null,
    };
  }

  if (!isProofCapabilityReviewEnvironment()) {
    const error = new Error(
      "Capability review reset is only available in the isolated Proof environment.",
    ) as Error & { status?: number };
    error.status = 403;
    throw error;
  }

  const bankVersion = Number(config.bank_version);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM specialist_capability_question_confirmations
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND assessment_key = $3
          AND bank_version = $4`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        input.assessmentKey,
        bankVersion,
      ],
    );
    await client.query(
      `DELETE FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND assessment_key = $3
          AND bank_version = $4`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        input.assessmentKey,
        bankVersion,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    reviewMode: true,
    reset: true,
    bankVersion,
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  }
  return [];
}

function projectStoredAttempt(row: any) {
  return {
    attemptId: row.id,
    completedAt: row.completed_at,
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    formId: String(row.form_id),
    assessmentKey: String(row.assessment_key),
    evidenceKind: row.evidence_kind,
    totalQuestions: Number(row.total_questions),
    correctQuestions: Number(row.correct_questions),
    percent: Number(row.percent),
    passed: Boolean(row.passed),
    hasCriticalFail: Boolean(row.has_critical_fail),
  };
}

function resolveQuestionFeedback(
  question: CapabilityQuestionDefinition,
  selectedOptionKeys: string[],
  correct: boolean,
) {
  // Correct answers use the approved Truth.
  // Wrong answers must not fall back to the Truth, otherwise the two-stage
  // "Not quite" -> "Truth" interaction repeats the same teaching copy twice.
  if (correct) {
    return cleanCapabilityDisplayCopy(question.explanation);
  }

  if (question.kind === "single_choice" && selectedOptionKeys.length === 1) {
    const optionFeedback = question.optionFeedback?.[selectedOptionKeys[0]];
    if (typeof optionFeedback === "string" && optionFeedback.trim()) {
      return cleanCapabilityDisplayCopy(optionFeedback.trim())
        .replace(/^Not quite[.!]?\s*/i, "")
        .trim();
    }
  }

  return "That answer does not match the condition being tested. Continue to see the Truth.";
}

export async function assertCapabilityTutorAssignmentOwnership(
  tutorAssignmentId: string,
  tutorId: string,
) {
  const result = await pool.query(
    `SELECT id
       FROM tutor_assignments
      WHERE id = $1
        AND tutor_id = $2
      LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );

  if (!result.rowCount) {
    const error = new Error(
      "Specialist assignment not found or does not belong to the authenticated user.",
    ) as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}

async function loadQuestionConfirmations(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
}) {
  const result = await pool.query(
    `SELECT question_key,
            selected_option_keys,
            correct,
            feedback,
            confirmed_at
       FROM specialist_capability_question_confirmations
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        AND assessment_key = $3
        AND bank_version = $4
        AND attempt_number = $5
        AND form_id = $6
      ORDER BY confirmed_at ASC`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.assessmentKey,
      input.bankVersion,
      input.attemptNumber,
      input.formId,
    ],
  );

  return result.rows.map((row) => ({
    questionKey: String(row.question_key),
    selectedOptionKeys: parseJsonArray(row.selected_option_keys),
    correct: Boolean(row.correct),
    feedback: cleanCapabilityDisplayCopy(String(row.feedback)),
    confirmedAt: row.confirmed_at,
  })) satisfies CapabilityQuestionConfirmationPublic[];
}

async function findCompletedAttemptForForm(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  bankVersion: number;
  formId: string;
}) {
  const result = await pool.query(
    `SELECT id,
            assessment_key,
            bank_version,
            attempt_number,
            form_id,
            evidence_kind,
            total_questions,
            correct_questions,
            percent,
            passed,
            has_critical_fail,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        AND assessment_key = $3
        AND bank_version = $4
        AND form_id = $5
      LIMIT 1`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.assessmentKey,
      input.bankVersion,
      input.formId,
    ],
  );
  return result.rows[0] || null;
}

function assertInteractionBinding(
  payload: CapabilityInteractionPayload,
  input: {
    tutorId?: string;
    assessmentKey: string;
    tutorAssignmentId?: string;
  },
) {
  if (
    (input.tutorId && payload.tutorId !== input.tutorId) ||
    payload.assessmentKey !== input.assessmentKey ||
    (input.tutorAssignmentId &&
      payload.tutorAssignmentId !== input.tutorAssignmentId)
  ) {
    const error = new Error(
      "Capability interaction does not belong to this Specialist or assignment.",
    ) as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}

function assertReceiptBinding(
  receipt: CapabilityQuestionReceiptPayload,
  interaction: CapabilityInteractionPayload,
  expectedIndex: number,
) {
  const expectedQuestion = interaction.definition.questions[expectedIndex];
  if (
    !expectedQuestion ||
    receipt.tutorAssignmentId !== interaction.tutorAssignmentId ||
    receipt.tutorId !== interaction.tutorId ||
    receipt.assessmentKey !== interaction.assessmentKey ||
    receipt.bankVersion !== interaction.bankVersion ||
    receipt.attemptNumber !== interaction.attemptNumber ||
    receipt.formId !== interaction.formId ||
    receipt.questionIndex !== expectedIndex ||
    receipt.questionKey !== expectedQuestion.key
  ) {
    const error = new Error(
      "Capability answer receipt does not match this assessment interaction.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }
}

export async function prepareCapabilityInteractiveAssessmentForm(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(
    input.tutorAssignmentId,
    input.tutorId,
  );

  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });

  const interactionToken = createCapabilityInteractionToken({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    assessmentKey: input.assessmentKey,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    formId: plan.form.formId,
    definition: plan.form.definition,
  });

  return {
    ...buildPublicCapabilityAssessment(plan),
    interactionToken,
    confirmations: [],
  };
}

export function confirmCapabilityQuestionStateless(input: {
  assessmentKey: string;
  interactionToken: string;
  priorReceipts: string[];
  questionKey: string;
  selectedOptionKeys: string[];
}) {
  const interaction = readCapabilityInteractionToken(input.interactionToken);
  assertInteractionBinding(interaction, input);

  const prior = input.priorReceipts.map((receipt, index) => {
    const decoded = readCapabilityQuestionReceipt(receipt);
    assertReceiptBinding(decoded, interaction, index);
    return decoded;
  });

  const questionIndex = prior.length;
  const question = interaction.definition.questions[questionIndex];
  if (!question || question.key !== input.questionKey) {
    const error = new Error(
      "Capability questions must be confirmed in form order.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const oneQuestionResult = evaluateCapabilityAssessment(
    { ...interaction.definition, questions: [question] },
    [
      {
        questionKey: question.key,
        selectedOptionKeys: input.selectedOptionKeys,
      },
    ],
  ).questionResults[0];

  const feedback = resolveQuestionFeedback(
    question,
    input.selectedOptionKeys,
    oneQuestionResult.correct,
  );
  const confirmedAt = Date.now();

  const receipt = createCapabilityQuestionReceipt({
    version: 1,
    tutorAssignmentId: interaction.tutorAssignmentId,
    tutorId: interaction.tutorId,
    assessmentKey: interaction.assessmentKey,
    bankVersion: interaction.bankVersion,
    attemptNumber: interaction.attemptNumber,
    formId: interaction.formId,
    questionIndex,
    questionKey: question.key,
    selectedOptionKeys: input.selectedOptionKeys,
    confirmedAt,
  });

  return {
    confirmation: {
      questionKey: question.key,
      selectedOptionKeys: input.selectedOptionKeys,
      correct: oneQuestionResult.correct,
      feedback,
      truth: cleanCapabilityDisplayCopy(question.explanation),
      confirmedAt: new Date(confirmedAt).toISOString(),
    },
    receipt,
  };
}

export async function persistCapabilityInteractiveAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  interactionToken: string;
  receipts: string[];
}) {
  await assertCapabilityTutorAssignmentOwnership(
    input.tutorAssignmentId,
    input.tutorId,
  );

  const interaction = readCapabilityInteractionToken(input.interactionToken);
  assertInteractionBinding(interaction, input);

  const existingAttempt = await findCompletedAttemptForForm({
    tutorAssignmentId: interaction.tutorAssignmentId,
    tutorId: interaction.tutorId,
    assessmentKey: interaction.assessmentKey,
    bankVersion: interaction.bankVersion,
    formId: interaction.formId,
  });
  if (existingAttempt) return projectStoredAttempt(existingAttempt);

  if (input.receipts.length !== interaction.definition.questions.length) {
    const error = new Error(
      "Every Capability question must be confirmed before the attempt can be finalized.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const decodedReceipts = input.receipts.map((receipt, index) => {
    const decoded = readCapabilityQuestionReceipt(receipt);
    assertReceiptBinding(decoded, interaction, index);
    return decoded;
  });

  const responses: CapabilityResponseInput[] = decodedReceipts.map((receipt) => ({
    questionKey: receipt.questionKey,
    selectedOptionKeys: receipt.selectedOptionKeys,
  }));

  const result = evaluateCapabilityAssessment(
    interaction.definition,
    responses,
  );

  try {
    const insertResult = await pool.query(
      `INSERT INTO specialist_capability_assessment_attempts (
         tutor_assignment_id,
         tutor_id,
         assessment_key,
         bank_version,
         attempt_number,
         form_id,
         form_item_keys,
         assessment_deep_dive_key,
         evidence_kind,
         covered_deep_dive_keys,
         pass_threshold_percent,
         total_questions,
         correct_questions,
         percent,
         has_critical_fail,
         critical_fail_question_keys,
         passed,
         responses,
         question_results
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb,
         $11, $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19::jsonb
       )
       RETURNING id, completed_at`,
      [
        interaction.tutorAssignmentId,
        interaction.tutorId,
        result.assessmentKey,
        interaction.bankVersion,
        interaction.attemptNumber,
        interaction.formId,
        JSON.stringify(
          interaction.definition.questions.map((question) => question.key),
        ),
        result.assessmentDeepDiveKey,
        result.evidenceKind,
        JSON.stringify(result.coveredDeepDiveKeys),
        interaction.definition.passThresholdPercent,
        result.totalQuestions,
        result.correctQuestions,
        result.percent,
        result.hasCriticalFail,
        JSON.stringify(result.criticalFailQuestionKeys),
        result.passed,
        JSON.stringify(responses),
        JSON.stringify(result.questionResults),
      ],
    );

    return projectCapabilityAttemptResultForSpecialist({
      attemptId: insertResult.rows[0]?.id,
      completedAt: insertResult.rows[0]?.completed_at,
      bankVersion: interaction.bankVersion,
      attemptNumber: interaction.attemptNumber,
      formId: interaction.formId,
      result,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      const stored = await findCompletedAttemptForForm({
        tutorAssignmentId: interaction.tutorAssignmentId,
        tutorId: interaction.tutorId,
        assessmentKey: interaction.assessmentKey,
        bankVersion: interaction.bankVersion,
        formId: interaction.formId,
      });
      if (stored) return projectStoredAttempt(stored);
    }
    throw error;
  }
}

export async function prepareCapabilityAssessmentForm(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);
  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });
  const confirmations = await loadQuestionConfirmations({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    assessmentKey: input.assessmentKey,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    formId: plan.form.formId,
  });

  return {
    ...buildPublicCapabilityAssessment(plan),
    confirmations,
  };
}

export async function confirmCapabilityQuestion(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  formId: string;
  bankVersion: number;
  questionKey: string;
  selectedOptionKeys: string[];
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const completedAttempt = await findCompletedAttemptForForm(input);
  if (completedAttempt) {
    const existing = await pool.query(
      `SELECT question_key,
              selected_option_keys,
              correct,
              feedback,
              confirmed_at
         FROM specialist_capability_question_confirmations
        WHERE tutor_assignment_id = $1
          AND tutor_id = $2
          AND assessment_key = $3
          AND bank_version = $4
          AND form_id = $5
          AND question_key = $6
        LIMIT 1`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        input.assessmentKey,
        input.bankVersion,
        input.formId,
        input.questionKey,
      ],
    );
    const row = existing.rows[0];
    return {
      confirmation: row
        ? {
            questionKey: String(row.question_key),
            selectedOptionKeys: parseJsonArray(row.selected_option_keys),
            correct: Boolean(row.correct),
            feedback: cleanCapabilityDisplayCopy(String(row.feedback)),
            confirmedAt: row.confirmed_at,
          }
        : null,
      attemptResult: projectStoredAttempt(completedAttempt),
    };
  }

  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });

  if (plan.form.formId !== input.formId || plan.form.bankVersion !== input.bankVersion) {
    const error = new Error(
      "Capability assessment form is stale or does not match the active attempt.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const existingConfirmations = await loadQuestionConfirmations({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    assessmentKey: input.assessmentKey,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    formId: plan.form.formId,
  });
  const alreadyConfirmed = existingConfirmations.find(
    (entry) => entry.questionKey === input.questionKey,
  );
  if (alreadyConfirmed) {
    return { confirmation: alreadyConfirmed, attemptResult: null };
  }

  const firstUnconfirmedQuestion = plan.form.definition.questions.find(
    (entry) =>
      !existingConfirmations.some(
        (confirmation) => confirmation.questionKey === entry.key,
      ),
  );
  if (!firstUnconfirmedQuestion || firstUnconfirmedQuestion.key !== input.questionKey) {
    const error = new Error(
      "Capability questions must be confirmed in form order.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const question = firstUnconfirmedQuestion;

  const oneQuestionResult = evaluateCapabilityAssessment(
    { ...plan.form.definition, questions: [question] },
    [
      {
        questionKey: question.key,
        selectedOptionKeys: input.selectedOptionKeys,
      },
    ],
  ).questionResults[0];

  const feedback = resolveQuestionFeedback(
    question,
    input.selectedOptionKeys,
    oneQuestionResult.correct,
  );

  await pool.query(
    `INSERT INTO specialist_capability_question_confirmations (
       tutor_assignment_id,
       tutor_id,
       assessment_key,
       bank_version,
       attempt_number,
       form_id,
       question_key,
       selected_option_keys,
       correct,
       critical_fail,
       feedback
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (
       tutor_assignment_id,
       assessment_key,
       bank_version,
       attempt_number,
       form_id,
       question_key
     ) DO NOTHING`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.assessmentKey,
      plan.form.bankVersion,
      plan.attemptNumber,
      plan.form.formId,
      question.key,
      JSON.stringify(input.selectedOptionKeys),
      oneQuestionResult.correct,
      oneQuestionResult.criticalFail,
      feedback,
    ],
  );

  const confirmations = await loadQuestionConfirmations({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    assessmentKey: input.assessmentKey,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    formId: plan.form.formId,
  });

  const confirmation = confirmations.find(
    (entry) => entry.questionKey === input.questionKey,
  );
  if (!confirmation) {
    throw new Error("Capability question confirmation could not be persisted.");
  }

  const confirmedByQuestion = new Map(
    confirmations.map((entry) => [entry.questionKey, entry] as const),
  );
  const allConfirmed = plan.form.definition.questions.every((entry) =>
    confirmedByQuestion.has(entry.key),
  );

  const attemptResult = allConfirmed
    ? await persistCapabilityAssessmentAttempt({
        tutorAssignmentId: input.tutorAssignmentId,
        tutorId: input.tutorId,
        assessmentKey: input.assessmentKey,
        formId: input.formId,
        bankVersion: input.bankVersion,
      })
    : null;

  return { confirmation, attemptResult };
}

export async function persistCapabilityAssessmentAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  formId: string;
  bankVersion: number;
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const existingAttempt = await findCompletedAttemptForForm(input);
  if (existingAttempt) return projectStoredAttempt(existingAttempt);

  const plan = await buildCapabilityAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    assessmentKey: input.assessmentKey,
  });

  if (plan.form.formId !== input.formId || plan.form.bankVersion !== input.bankVersion) {
    const error = new Error(
      "Capability assessment form is stale or does not match the active attempt.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const confirmations = await loadQuestionConfirmations({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    assessmentKey: input.assessmentKey,
    bankVersion: plan.form.bankVersion,
    attemptNumber: plan.attemptNumber,
    formId: plan.form.formId,
  });
  const confirmationByQuestion = new Map(
    confirmations.map((entry) => [entry.questionKey, entry] as const),
  );

  if (
    confirmations.length !== plan.form.definition.questions.length ||
    !plan.form.definition.questions.every((question) =>
      confirmationByQuestion.has(question.key),
    )
  ) {
    const error = new Error(
      "Every Capability question must be confirmed before the attempt can be finalized.",
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const responses: CapabilityResponseInput[] = plan.form.definition.questions.map(
    (question) => ({
      questionKey: question.key,
      selectedOptionKeys:
        confirmationByQuestion.get(question.key)?.selectedOptionKeys || [],
    }),
  );

  const result = evaluateCapabilityAssessment(plan.form.definition, responses);

  try {
    const insertResult = await pool.query(
      `INSERT INTO specialist_capability_assessment_attempts (
         tutor_assignment_id,
         tutor_id,
         assessment_key,
         bank_version,
         attempt_number,
         form_id,
         form_item_keys,
         assessment_deep_dive_key,
         evidence_kind,
         covered_deep_dive_keys,
         pass_threshold_percent,
         total_questions,
         correct_questions,
         percent,
         has_critical_fail,
         critical_fail_question_keys,
         passed,
         responses,
         question_results
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb,
         $11, $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19::jsonb
       )
       RETURNING id, completed_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        result.assessmentKey,
        plan.form.bankVersion,
        plan.attemptNumber,
        plan.form.formId,
        JSON.stringify(plan.form.itemKeys),
        result.assessmentDeepDiveKey,
        result.evidenceKind,
        JSON.stringify(result.coveredDeepDiveKeys),
        plan.form.definition.passThresholdPercent,
        result.totalQuestions,
        result.correctQuestions,
        result.percent,
        result.hasCriticalFail,
        JSON.stringify(result.criticalFailQuestionKeys),
        result.passed,
        JSON.stringify(responses),
        JSON.stringify(result.questionResults),
      ],
    );

    return projectCapabilityAttemptResultForSpecialist({
      attemptId: insertResult.rows[0]?.id,
      completedAt: insertResult.rows[0]?.completed_at,
      bankVersion: plan.form.bankVersion,
      attemptNumber: plan.attemptNumber,
      formId: plan.form.formId,
      result,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      const stored = await findCompletedAttemptForForm(input);
      if (stored) return projectStoredAttempt(stored);
    }
    throw error;
  }
}

export async function submitCapabilityExperienceFeedback(input: {
  attemptId: string;
  tutorId: string;
  rating: number;
  feedback?: string | null;
}) {
  const normalizedFeedback = String(input.feedback || "").trim();
  const updated = await pool.query(
    `UPDATE specialist_capability_assessment_attempts
        SET experience_rating = $1,
            experience_feedback = $2,
            experience_feedback_submitted_at = now()
      WHERE id = $3
        AND tutor_id = $4
        AND experience_feedback_submitted_at IS NULL
      RETURNING id,
                experience_rating,
                experience_feedback,
                experience_feedback_submitted_at`,
    [input.rating, normalizedFeedback || null, input.attemptId, input.tutorId],
  );

  if (updated.rowCount) return updated.rows[0];

  const existing = await pool.query(
    `SELECT id,
            experience_rating,
            experience_feedback,
            experience_feedback_submitted_at
       FROM specialist_capability_assessment_attempts
      WHERE id = $1
        AND tutor_id = $2
      LIMIT 1`,
    [input.attemptId, input.tutorId],
  );

  if (!existing.rowCount) {
    const error = new Error("Capability attempt not found.") as Error & {
      status?: number;
    };
    error.status = 404;
    throw error;
  }

  return existing.rows[0];
}

export async function getCapabilityAssessmentHistory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey?: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const params: unknown[] = [input.tutorAssignmentId, input.tutorId];
  let assessmentFilter = "";
  if (input.assessmentKey) {
    params.push(input.assessmentKey);
    assessmentFilter = ` AND assessment_key = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT id,
            assessment_key,
            bank_version,
            attempt_number,
            form_id,
            assessment_deep_dive_key,
            evidence_kind,
            pass_threshold_percent,
            total_questions,
            correct_questions,
            percent,
            has_critical_fail,
            passed,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        ${assessmentFilter}
      ORDER BY completed_at DESC`,
    params,
  );

  return result.rows;
}

export async function getSpecialistCapabilityLedger(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertCapabilityTutorAssignmentOwnership(input.tutorAssignmentId, input.tutorId);

  const result = await pool.query(
    `SELECT id,
            assessment_key,
            evidence_kind,
            passed,
            question_results,
            completed_at
       FROM specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
      ORDER BY completed_at ASC`,
    [input.tutorAssignmentId, input.tutorId],
  );

  const attempts: CapabilityLedgerAttempt[] = result.rows.map((row) => ({
    attemptId: String(row.id),
    assessmentKey: String(row.assessment_key),
    evidenceKind: row.evidence_kind,
    passed: Boolean(row.passed),
    completedAt: row.completed_at,
    questionResults: (Array.isArray(row.question_results)
      ? row.question_results
      : []) as CapabilityQuestionResult[],
  }));

  return buildCapabilityLedger(attempts);
}
