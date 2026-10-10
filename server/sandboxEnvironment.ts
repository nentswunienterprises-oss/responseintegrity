import { createHmac } from "crypto";
import { pool } from "./db";
import { loadTutorOperationalModeAuthority } from "./tutorOperationalModeAuthority";
import {
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getFieldDefinitionsForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
  type EvidenceConstraintProfile,
  type EvidenceSetDefinition,
  type SubmittedEvidenceSet,
} from "@shared/responseIntegrityDrillRegistry";
import {
  TRAINING_INHERITED_RESCUE_SIGNAL_OPTIONS,
  TRAINING_INTERVENTION_OPTIONS,
  getTrainingPrerequisiteSentinelDefinition,
  trainingEvidenceStatusKey,
  type TrainingEvidenceStatus,
  type TrainingInheritedRescueSignal,
  type TrainingInterventionEvent,
  type TrainingPrerequisiteSentinelResult,
} from "@shared/trainingEvidenceCapture";
import {
  compareSandboxTurn,
  evaluateSandboxCapabilityReadiness,
  evaluateSandboxCompletedSession,
  nextSandboxContinuityState,
  parseSandboxCapabilityReadinessPolicy,
  projectSandboxOutcomeToCurrentTrainingContract,
  selectSandboxOutcome,
  validateSandboxOutcomeDefinition,
  type SandboxCapabilityLayer,
  type SandboxCapabilityOccurrence,
  type SandboxCapabilityReadinessPolicy,
  type SandboxCompletedTurn,
  type SandboxExposureSummary,
  type SandboxOutcomeDefinition,
  type SandboxTrajectoryClass,
} from "@shared/sandboxEnvironment";
import { trainingRawObservationRequiresPrerequisiteSentinel } from "@shared/trainingEvidenceEvaluator";
import type { TopicPhase, TopicStability } from "@shared/topicConditioningEngine";
import { normalizeCapabilityProgressionState, type ProgressionAuthority } from "@shared/capabilityProgressionAuthority";
import {
  sandboxTopicKey,
  resolveSandboxTopicSeed,
  persistedTopicLane,
  normalizeSandboxTopicLane,
  normalizeSandboxCanonicalLane,
  type SandboxTopicLane,
  type SandboxCanonicalTopicLane,
} from "@shared/sandboxTopicAuthority";
import { buildResponseSnapshotV1, type ResponseSnapshotV1 } from "@shared/responseSnapshot";

export const DEFAULT_SANDBOX_ENVIRONMENT_BANK_KEY = "sandbox_stateful_environment";

const SANDBOX_BANK_TRAINING_SCHEMA_VERSION: Record<number, number> = {
  1: 1,
};

const trainingSchemaVersionForSandboxBank = (bankVersion: number) => {
  const schemaVersion = SANDBOX_BANK_TRAINING_SCHEMA_VERSION[bankVersion];
  if (!schemaVersion) {
    throw httpError(
      503,
      `Sandbox bank v${bankVersion} has no declared Training observation schema authority.`,
    );
  }
  return schemaVersion;
};


type SandboxEnvironmentBank = {
  bankKey: string;
  bankVersion: number;
  title: string;
  targetOutcomesPerRep: number;
  minimumOutcomesPerRep: number;
  maximumOutcomesPerRep: number;
  capabilityPolicy: SandboxCapabilityReadinessPolicy | null;
};

type SandboxTrajectoryRow = {
  id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  student_id: string;
  bank_key: string;
  bank_version: number;
  specialist_phase: TopicPhase;
  specialist_stability: TopicStability;
  specialist_progression_authority: ProgressionAuthority;
  active_topic_key: string | null;
  specialist_topic_states: Record<string, unknown>;
  specialist_route: "normal_training" | "targeted_rediagnosis";
  specialist_targeted_rediagnosis_phase: TopicPhase | null;
  session_number: number;
  completed_rep_count: number;
  divergence_active: boolean;
  status: string;
};

type SandboxTruthRow = {
  trajectory_id: string;
  canonical_phase: TopicPhase;
  canonical_stability: TopicStability;
  canonical_progression_authority: ProgressionAuthority;
  canonical_topic_states: Record<string, unknown>;
  canonical_route: "normal_training" | "targeted_rediagnosis";
  canonical_targeted_rediagnosis_phase: TopicPhase | null;
  trajectory_seed: string;
  previous_trajectory_class: SandboxTrajectoryClass | null;
  continuity_tags: string[];
  recent_outcome_keys: string[];
  prior_tracks_diverged: boolean;
};

type SandboxTrajectoryBundle = {
  trajectory: SandboxTrajectoryRow;
  truth: SandboxTruthRow;
};

type SandboxRepSubmission = {
  interventionEvent: TrainingInterventionEvent;
  observations: Record<string, {
    optionId: string;
    evidenceStatus?: TrainingEvidenceStatus;
  }>;
  prerequisiteSentinel?: TrainingPrerequisiteSentinelResult;
  inheritedRescueSignal?: TrainingInheritedRescueSignal;
};

type PrivateOutcomeRecord = {
  publicRef: string;
  definition: SandboxOutcomeDefinition;
};

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function getSandboxEnvironmentSecret() {
  const configured = String(
    process.env.SANDBOX_FORM_SECRET ||
    process.env.CAPABILITY_FORM_SECRET ||
    "",
  ).trim();
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "preview") {
    const previewSessionSecret = String(process.env.SESSION_SECRET || "").trim();
    if (previewSessionSecret) {
      return createHmac("sha256", previewSessionSecret)
        .update("ri-sandbox-environment-secret-v2")
        .digest("hex");
    }
  }

  throw httpError(503, "Sandbox environment secret is not configured.");
}

function digest(value: string) {
  return createHmac("sha256", getSandboxEnvironmentSecret())
    .update(value)
    .digest("hex");
}

async function assertSandboxAccess(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
}) {
  const [result, modeAuthority] = await Promise.all([
    pool.query(
      `SELECT ta.id,
              s.id AS student_id,
              s.name AS student_name,
              s.grade AS student_grade,
              COALESCE(pe.is_sandbox_account, false) AS is_sandbox_account
         FROM tutor_assignments ta
         JOIN students s
           ON s.id = $3
          AND s.tutor_id = ta.tutor_id
         LEFT JOIN parent_enrollments pe
           ON pe.id = s.parent_enrollment_id
        WHERE ta.id = $1
          AND ta.tutor_id = $2
        LIMIT 1`,
      [input.tutorAssignmentId, input.tutorId, input.studentId],
    ),
    loadTutorOperationalModeAuthority({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
    }),
  ]);
  const row = result.rows[0];
  if (!row || !modeAuthority) {
    throw httpError(403, "Sandbox student is not assigned to this authenticated Specialist.");
  }
  if (modeAuthority.mode !== "sandbox") {
    throw httpError(409, "The stateful Sandbox environment is available only while the Specialist is in Sandbox.");
  }
  if (!row.is_sandbox_account) {
    throw httpError(409, "Stateful Sandbox may only run against synthetic Sandbox student accounts.");
  }
  return {
    id: String(row.student_id),
    name: String(row.student_name || "Sandbox Student"),
    grade: row.student_grade ? String(row.student_grade) : null,
  };
}


type SandboxScheduledTrainingSession = {
  id: string;
  parent_id: string;
  tutor_id: string;
  student_id: string;
  type: string;
  status: string;
};

async function loadSandboxScheduledTrainingSession(input: {
  scheduledSessionId?: string | null;
  tutorId: string;
  studentId: string;
  allowCompleted?: boolean;
}) {
  const scheduledSessionId = String(input.scheduledSessionId || "").trim();
  if (!scheduledSessionId) {
    throw httpError(
      409,
      "Start Sandbox Training from a confirmed weekly lesson so completion can retire the exact session.",
    );
  }

  const result = await pool.query(
    `SELECT id, parent_id, tutor_id, student_id, type, status
       FROM public.scheduled_sessions
      WHERE id::text = $1::text
        AND tutor_id::text = $2::text
        AND student_id::text = $3::text
        AND type = 'training'
      LIMIT 1`,
    [scheduledSessionId, input.tutorId, input.studentId],
  );
  const session = result.rows[0] as SandboxScheduledTrainingSession | undefined;
  if (!session) {
    throw httpError(404, "The selected Sandbox training lesson could not be found.");
  }
  const allowedStatuses = input.allowCompleted
    ? ["confirmed", "ready", "live", "completed"]
    : ["confirmed", "ready", "live"];
  if (!allowedStatuses.includes(String(session.status || ""))) {
    throw httpError(
      409,
      String(session.status || "") === "completed"
        ? "This Sandbox lesson is already complete. Return to the Pod and start the next confirmed weekly lesson."
        : "The selected Sandbox training lesson must be confirmed before Training can run.",
    );
  }
  return session;
}

async function completeSandboxScheduledTrainingSession(input: {
  scheduledSessionId?: string | null;
  tutorId: string;
  studentId: string;
  trajectoryId: string;
  sandboxSessionNumber: number;
}) {
  const scheduledSessionId = String(input.scheduledSessionId || "").trim();
  if (!scheduledSessionId) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, parent_id, tutor_id, student_id, type, status
         FROM public.scheduled_sessions
        WHERE id::text = $1::text
          AND tutor_id::text = $2::text
          AND student_id::text = $3::text
          AND type = 'training'
        FOR UPDATE`,
      [scheduledSessionId, input.tutorId, input.studentId],
    );
    const session = result.rows[0] as SandboxScheduledTrainingSession | undefined;
    if (!session) {
      throw httpError(404, "The selected Sandbox training lesson could not be found.");
    }
    if (!["confirmed", "ready", "live", "completed"].includes(String(session.status || ""))) {
      throw httpError(
        409,
        "The selected Sandbox training lesson is no longer available for completion.",
      );
    }

    const completedAt = new Date().toISOString();
    if (String(session.status) !== "completed") {
      await client.query(
        `UPDATE public.scheduled_sessions
            SET status = 'completed',
                attendance_status = 'both_joined',
                recording_status = 'manual_not_tracked',
                transcript_status = 'manual_not_tracked',
                updated_at = $4::timestamptz
          WHERE id::text = $1::text
            AND tutor_id::text = $2::text
            AND student_id::text = $3::text`,
        [scheduledSessionId, input.tutorId, input.studentId, completedAt],
      );
    }

    const enrollmentResult = await client.query(
      `SELECT parent_enrollment_id
         FROM public.students
        WHERE id::text = $1::text
        LIMIT 1`,
      [input.studentId],
    );
    const enrollmentId = String(enrollmentResult.rows[0]?.parent_enrollment_id || "").trim() || null;

    const billingEventInsert = await client.query(
      `INSERT INTO public.session_billing_events (
         session_id, parent_id, student_id, enrollment_id, event_type,
         actor_role, actor_id, billing_impact, credits_delta,
         reason_codes, reason_note, metadata, is_sandbox, effective_at, created_at
       )
       SELECT
         $1, $2, $3, $4, 'sandbox_training_completed',
         'tutor', $5, 'consume', 1,
         '["sandbox_training_completed"]'::jsonb,
         'Stateful Sandbox Training session completed',
         jsonb_build_object(
           'evidence_scope', 'sandbox',
           'trajectory_id', $6::text,
           'sandbox_session_number', $7::int
         ),
         true, $8::timestamptz, $8::timestamptz
       WHERE NOT EXISTS (
         SELECT 1
           FROM public.session_billing_events
          WHERE session_id = $1
            AND event_type = 'sandbox_training_completed'
       )
       RETURNING id`,
      [
        scheduledSessionId,
        String(session.parent_id || ""),
        input.studentId,
        enrollmentId,
        input.tutorId,
        input.trajectoryId,
        input.sandboxSessionNumber,
        completedAt,
      ],
    );

    let programProgress: null | {
      sessionQuota: number;
      sessionsUsed: number;
      sessionsRemaining: number;
    } = null;

    if (billingEventInsert.rowCount && billingEventInsert.rowCount > 0) {
      const progressResult = await client.query(
        `WITH target AS (
           SELECT id
             FROM public.membership_months
            WHERE parent_id::text = $1::text
              AND student_id::text = $2::text
              AND is_sandbox = true
              AND status = 'active'
            ORDER BY month_start DESC, updated_at DESC
            LIMIT 1
         )
         UPDATE public.membership_months membership
            SET sessions_used = LEAST(membership.session_quota, membership.sessions_used + 1),
                sessions_remaining = GREATEST(
                  0,
                  membership.session_quota - LEAST(membership.session_quota, membership.sessions_used + 1)
                ),
                updated_at = $3::timestamptz
           FROM target
          WHERE membership.id = target.id
          RETURNING membership.session_quota, membership.sessions_used, membership.sessions_remaining`,
        [String(session.parent_id || ""), input.studentId, completedAt],
      );
      const progress = progressResult.rows[0];
      if (progress) {
        programProgress = {
          sessionQuota: Number(progress.session_quota || 0),
          sessionsUsed: Number(progress.sessions_used || 0),
          sessionsRemaining: Number(progress.sessions_remaining || 0),
        };
      }
    }

    await client.query("COMMIT");
    return {
      id: scheduledSessionId,
      status: "completed" as const,
      completedAt,
      parentId: String(session.parent_id || ""),
      enrollmentId,
      programProgress,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function persistSandboxStudentTopicState(input: {
  studentId: string;
  topic: string;
  phase: TopicPhase;
  stability: TopicStability;
  progressionAuthority: ProgressionAuthority;
  sessionEvaluationId: string;
  observedAt: string;
  reason: string;
}) {
  const topic = String(input.topic || "").trim();
  if (!topic) return;
  const separated = normalizeCapabilityProgressionState({phase: input.phase, stability: input.stability, progression: input.progressionAuthority});

  const result = await pool.query(
    `SELECT concept_mastery
       FROM public.students
      WHERE id::text = $1::text
      LIMIT 1`,
    [input.studentId],
  );
  const existing =
    result.rows[0]?.concept_mastery && typeof result.rows[0].concept_mastery === "object"
      ? { ...result.rows[0].concept_mastery }
      : {};
  const topicConditioning =
    existing.topicConditioning && typeof existing.topicConditioning === "object"
      ? { ...existing.topicConditioning }
      : {};
  const topics =
    topicConditioning.topics && typeof topicConditioning.topics === "object"
      ? { ...topicConditioning.topics }
      : {};
  const existingKey =
    Object.keys(topics).find((key) => key.trim().toLowerCase() === topic.toLowerCase()) || topic;
  const existingTopic =
    topics[existingKey] && typeof topics[existingKey] === "object"
      ? { ...topics[existingKey] }
      : {};
  const history = Array.isArray(existingTopic.history) ? [...existingTopic.history] : [];

  if (!history.some((entry: any) => String(entry?.drillId || "") === input.sessionEvaluationId)) {
    history.push({
      date: input.observedAt,
      phase: input.phase,
      stability: separated.stability,
      progressionAuthority: separated.progression,
      nextAction: input.reason,
      observationNotes: `Stateful Sandbox Training. ${input.reason}`,
      structuredObservation: {
        drillType: "training",
        evidenceScope: "sandbox",
        studentStateAuthoritative: false,
      },
      drillId: input.sessionEvaluationId,
    });
  }

  topics[existingKey] = {
    ...existingTopic,
    topic,
    phase: input.phase,
    stability: separated.stability,
    progressionAuthority: separated.progression,
    lastUpdated: input.observedAt,
    nextAction: input.reason,
    observationNotes: `Stateful Sandbox Training. ${input.reason}`,
    requiresTargetedRediagnosis: false,
    targetedRediagnosisStartPhase: null,
    history: history.slice(-60),
  };
  topicConditioning.topic = topic;
  topicConditioning.entry_phase = input.phase;
  topicConditioning.stability = separated.stability;
  topicConditioning.progressionAuthority = separated.progression;
  topicConditioning.lastUpdatedAt = input.observedAt;
  topicConditioning.topics = topics;
  existing.topicConditioning = topicConditioning;

  await pool.query(
    `UPDATE public.students
        SET concept_mastery = $2::jsonb
      WHERE id::text = $1::text`,
    [input.studentId, JSON.stringify(existing)],
  );
}

function buildSandboxResponseSnapshot(input: {
  sourceDrillId: string;
  topic: string;
  phase: TopicPhase;
  bankVersion: number;
  turns: SandboxCompletedTurn[];
  phaseBefore: TopicPhase | null;
  stabilityBefore: TopicStability | null;
  authority: {
    nextPhase: TopicPhase;
    nextStability: TopicStability;
    reason?: string | null;
    transitionReason?: string | null;
  };
}): ResponseSnapshotV1 {
  // The bank version governs hidden simulated outcomes, not the Specialist-facing
  // observation contract. Sandbox reps are captured through the current live Training
  // schema, so Response Snapshot reconstruction must resolve those same current option IDs.
  const schema = getDrillSchemaDefinition("training", input.phase);
  const turnsBySet = new Map<string, SandboxCompletedTurn[]>();
  input.turns.forEach((turn) => {
    const rows = turnsBySet.get(turn.setId) || [];
    rows.push(turn);
    turnsBySet.set(turn.setId, rows);
  });

  const sets: SubmittedEvidenceSet[] = schema.sets
    .filter((definition) => !definition.modelingOnly && turnsBySet.has(definition.setId))
    .map((definition, schemaSetIndex) => {
      const turns = [...(turnsBySet.get(definition.setId) || [])].sort(
        (left, right) => left.repNumber - right.repNumber,
      );
      return {
        setName: definition.setName,
        setId: definition.setId,
        setOrder: schemaSetIndex + 1,
        drillSchemaId: schema.schemaId,
        drillSchemaVersion: schema.schemaVersion,
        drillDefinitionHash: schema.definitionHash,
        constraintProfile: { ...definition.constraints },
        observations: turns.map((turn) => {
          const repIndex = turn.repNumber - 1;
          const rep: Record<string, string> = {
            _rep_id: getRepPurposeId(definition, repIndex),
            _rep_number: String(turn.repNumber),
          };
          for (const field of getFieldDefinitionsForRep(definition, repIndex)) {
            const selected = turn.specialistObservations[field.fieldKey];
            if (!selected?.optionId) continue;
            const resolved = resolveEvidenceSelection({
              mode: "training",
              phase: input.phase,
              setId: definition.setId,
              repIndex,
              fieldKey: field.fieldKey,
              optionId: selected.optionId,
              schemaVersion: schema.schemaVersion,
            });
            if (!resolved) {
              throw new Error(
                `Sandbox Response Snapshot could not resolve current Training evidence ${definition.setId}.rep_${turn.repNumber}.${field.fieldKey} (${selected.optionId}).`,
              );
            }
            rep[field.fieldKey] = String(
              resolved.field.optionLabels?.[resolved.optionIndex] || "",
            );
            rep[`${field.fieldKey}_level`] = String(resolved.level);
            rep[`${field.fieldKey}_option_id`] = selected.optionId;
            rep[`${field.fieldKey}_dimension_id`] = field.dimensionId;
            rep[trainingEvidenceStatusKey(field.fieldKey)] =
              selected.evidenceStatus || "observed";
          }
          return rep;
        }),
      };
    });

  return buildResponseSnapshotV1({
    sourceDrillId: input.sourceDrillId,
    generatedBy: "deterministic-server",
    topic: input.topic || "Sandbox practice",
    mode: "training",
    phase: input.phase,
    sets,
    engineOutcomeRef: {
      phaseBefore: input.phaseBefore,
      stabilityBefore: input.stabilityBefore,
      phaseAfter: input.authority.nextPhase,
      stabilityAfter: input.authority.nextStability,
      transitionReason:
        input.authority.transitionReason || input.authority.reason || null,
    },
  });
}

async function loadActiveEnvironmentBank(
  bankKey = DEFAULT_SANDBOX_ENVIRONMENT_BANK_KEY,
): Promise<SandboxEnvironmentBank | null> {
  const result = await pool.query(
    `SELECT bank_key, bank_version, title,
            target_outcomes_per_rep, minimum_outcomes_per_rep, maximum_outcomes_per_rep,
            capability_policy
       FROM private.specialist_sandbox_environment_banks
      WHERE bank_key = $1
        AND active = true
      LIMIT 1`,
    [bankKey],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    bankKey: String(row.bank_key),
    bankVersion: Number(row.bank_version),
    title: String(row.title),
    targetOutcomesPerRep: Number(row.target_outcomes_per_rep),
    minimumOutcomesPerRep: Number(row.minimum_outcomes_per_rep),
    maximumOutcomesPerRep: Number(row.maximum_outcomes_per_rep),
    capabilityPolicy: row.capability_policy
      ? parseSandboxCapabilityReadinessPolicy(row.capability_policy)
      : null,
  };
}

const jsonStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
          } catch {
            return [];
          }
        })()
      : [];

async function ensureTrajectory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  bank: SandboxEnvironmentBank;
}): Promise<SandboxTrajectoryBundle> {
  const selectSql = `
    SELECT t.*,
           truth.canonical_phase,
           truth.canonical_stability,
           truth.canonical_progression_authority,
           truth.canonical_topic_states,
           truth.canonical_route,
           truth.canonical_targeted_rediagnosis_phase,
           truth.trajectory_seed,
           truth.previous_trajectory_class,
           truth.continuity_tags,
           truth.recent_outcome_keys,
           truth.prior_tracks_diverged
      FROM specialist_sandbox_trajectories t
      JOIN private.specialist_sandbox_trajectory_truth truth
        ON truth.trajectory_id = t.id
     WHERE t.tutor_assignment_id = $1
       AND t.tutor_id = $2
       AND t.student_id = $3
       AND t.bank_key = $4
       AND t.bank_version = $5
       AND t.status = 'active'
     ORDER BY t.created_at DESC
     LIMIT 1
  `;
  const selectParams = [
    input.tutorAssignmentId,
    input.tutorId,
    input.studentId,
    input.bank.bankKey,
    input.bank.bankVersion,
  ];

  const bundleFromRow = (row: any): SandboxTrajectoryBundle => ({
    trajectory: row as SandboxTrajectoryRow,
    truth: {
      trajectory_id: String(row.id),
      canonical_phase: String(row.canonical_phase) as TopicPhase,
      canonical_stability: String(row.canonical_stability) as TopicStability,
      canonical_progression_authority: String(row.canonical_progression_authority) as ProgressionAuthority,
      canonical_topic_states: row.canonical_topic_states && typeof row.canonical_topic_states === "object"
        ? row.canonical_topic_states : {},
      canonical_route: String(row.canonical_route) as SandboxTruthRow["canonical_route"],
      canonical_targeted_rediagnosis_phase:
        row.canonical_targeted_rediagnosis_phase
          ? String(row.canonical_targeted_rediagnosis_phase) as TopicPhase
          : null,
      trajectory_seed: String(row.trajectory_seed),
      previous_trajectory_class: row.previous_trajectory_class
        ? String(row.previous_trajectory_class) as SandboxTrajectoryClass
        : null,
      continuity_tags: jsonStringArray(row.continuity_tags),
      recent_outcome_keys: jsonStringArray(row.recent_outcome_keys),
      prior_tracks_diverged: Boolean(row.prior_tracks_diverged),
    },
  });

  const existing = await pool.query(selectSql, selectParams);
  if (existing.rows[0]) {
    return bundleFromRow(existing.rows[0]);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockIdentity = [
      input.tutorAssignmentId,
      input.tutorId,
      input.studentId,
      input.bank.bankKey,
      input.bank.bankVersion,
    ].join(":");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [lockIdentity],
    );

    // Both the environment form and history can initialize at the same time.
    // Re-check after taking the transaction lock so only one request creates
    // the trajectory/truth pair.
    const lockedExisting = await client.query(selectSql, selectParams);
    if (lockedExisting.rows[0]) {
      await client.query("COMMIT");
      return bundleFromRow(lockedExisting.rows[0]);
    }

    const created = await client.query(
      `INSERT INTO specialist_sandbox_trajectories (
         tutor_assignment_id,
         tutor_id,
         student_id,
         bank_key,
         bank_version,
         specialist_phase,
         specialist_stability,
         specialist_progression_authority,
         specialist_route,
         session_number,
         completed_rep_count,
         divergence_active,
         status,
         student_state_authoritative,
         evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,'Clarity','Low','building','normal_training',1,0,false,'active',false,'sandbox')
       RETURNING *`,
      selectParams,
    );
    const trajectory = created.rows[0] as SandboxTrajectoryRow;
    const trajectorySeed = digest(
      [
        "sandbox-trajectory-v3",
        trajectory.id,
        input.studentId,
        input.bank.bankKey,
        input.bank.bankVersion,
      ].join(":"),
    );
    await client.query(
      `INSERT INTO private.specialist_sandbox_trajectory_truth (
         trajectory_id,
         canonical_phase,
         canonical_stability,
         canonical_progression_authority,
         canonical_route,
         trajectory_seed,
         continuity_tags,
         recent_outcome_keys,
         prior_tracks_diverged
       ) VALUES ($1,'Clarity','Low','building','normal_training',$2,'[]'::jsonb,'[]'::jsonb,false)`,
      [trajectory.id, trajectorySeed],
    );
    await client.query("COMMIT");
    return {
      trajectory,
      truth: {
        trajectory_id: trajectory.id,
        canonical_phase: "Clarity",
        canonical_stability: "Low",
        canonical_progression_authority: "building",
        canonical_route: "normal_training",
        canonical_targeted_rediagnosis_phase: null,
        trajectory_seed: trajectorySeed,
        previous_trajectory_class: null,
        continuity_tags: [],
        recent_outcome_keys: [],
        prior_tracks_diverged: false,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function scoredTrainingSets(phase: TopicPhase) {
  return getDrillSchemaDefinition("training", phase).sets.filter((set) => !set.modelingOnly);
}

function flattenedRepPlan(phase: TopicPhase) {
  return scoredTrainingSets(phase).flatMap((set) =>
    Array.from({ length: set.reps }, (_, repIndex) => ({
      set,
      repNumber: repIndex + 1,
    })),
  );
}

/**
 * Topic-specific simulated student truth inside ONE persistent Sandbox student
 * trajectory. We never substitute the phase from the launch URL or share a
 * prior topic's canonical state. Phase comes from previously observed topic
 * evidence (first visit), then from the independent saved topic lane.
 *
 * Changing topic is forbidden after the first rep of the current session.
 * The Specialist lane is public-but-server-owned; hidden canonical lanes stay
 * in the private schema. Both tracks switch atomically under row locks.
 */
async function selectSandboxTopicTrajectory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  bank: SandboxEnvironmentBank;
  bundle: SandboxTrajectoryBundle;
  topic?: string | null;
}): Promise<SandboxTrajectoryBundle> {
  const topicKey = sandboxTopicKey(input.topic);
  if (!topicKey) {
    throw httpError(409, "Select an observed topic before starting Sandbox Training.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT t.*, truth.canonical_phase, truth.canonical_stability,
              truth.canonical_progression_authority, truth.canonical_route,
              truth.canonical_targeted_rediagnosis_phase,
              truth.canonical_topic_states,
              truth.previous_trajectory_class, truth.continuity_tags,
              truth.recent_outcome_keys, truth.prior_tracks_diverged
         FROM public.specialist_sandbox_trajectories t
         JOIN private.specialist_sandbox_trajectory_truth truth
           ON truth.trajectory_id = t.id
        WHERE t.id = $1 AND t.tutor_assignment_id = $2
          AND t.tutor_id = $3 AND t.student_id = $4
          AND t.status = 'active'
        FOR UPDATE OF t, truth`,
      [input.bundle.trajectory.id, input.tutorAssignmentId, input.tutorId, input.studentId],
    );
    const row = locked.rows[0];
    if (!row) throw httpError(409, "Sandbox student trajectory changed. Reload the session.");
    const activeKey = sandboxTopicKey(row.active_topic_key);
    if (activeKey === topicKey) {
      await client.query("COMMIT");
      return ensureTrajectory(input);
    }
    const progress = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM public.specialist_sandbox_rep_events
        WHERE trajectory_id = $1 AND session_number = $2`,
      [row.id, row.session_number],
    );
    if (Number(progress.rows[0]?.count || 0) > 0) {
      throw httpError(
        409,
        "This Sandbox session has already started on another topic. Complete it before switching topics.",
      );
    }
    if (!activeKey && Number(row.session_number) > 1) {
      throw httpError(
        409,
        "The earlier Sandbox sessions cannot be safely attributed to a topic. Preserve the history and resolve its origin before selecting a different topic.",
      );
    }
    const specialistStates: Record<string, unknown> =
      row.specialist_topic_states && typeof row.specialist_topic_states === "object" &&
      !Array.isArray(row.specialist_topic_states) ? { ...row.specialist_topic_states } : {};
    const canonicalStates: Record<string, unknown> =
      row.canonical_topic_states && typeof row.canonical_topic_states === "object" &&
      !Array.isArray(row.canonical_topic_states) ? { ...row.canonical_topic_states } : {};

    if (activeKey) {
      const outgoingSpecialist = normalizeSandboxTopicLane({
        phase: row.specialist_phase,
        stability: row.specialist_stability,
        progressionAuthority: row.specialist_progression_authority,
        route: row.specialist_route,
        targetedRediagnosisPhase: row.specialist_targeted_rediagnosis_phase,
      });
      const outgoingCanonical = normalizeSandboxCanonicalLane({
        phase: row.canonical_phase,
        stability: row.canonical_stability,
        progressionAuthority: row.canonical_progression_authority,
        route: row.canonical_route,
        targetedRediagnosisPhase: row.canonical_targeted_rediagnosis_phase,
        previousTrajectoryClass: row.previous_trajectory_class,
        continuityTags: jsonStringArray(row.continuity_tags),
        recentOutcomeKeys: jsonStringArray(row.recent_outcome_keys),
        priorTracksDiverged: row.prior_tracks_diverged === true,
      });
      if (!outgoingSpecialist || !outgoingCanonical) {
        throw httpError(409, "Stored Sandbox state is inconsistent; topic switching is blocked.");
      }
      specialistStates[activeKey] = {
        ...outgoingSpecialist,
        progressionAuthority: outgoingSpecialist.progression,
        divergenceActive: row.divergence_active === true,
      };
      canonicalStates[activeKey] = {
        ...outgoingCanonical,
        progressionAuthority: outgoingCanonical.progression,
      };
    }

    const specialistExists = Object.prototype.hasOwnProperty.call(specialistStates, topicKey);
    const canonicalExists = Object.prototype.hasOwnProperty.call(canonicalStates, topicKey);
    if (specialistExists !== canonicalExists) {
      throw httpError(409, "One Sandbox topic evidence track is missing. Do not reset its hidden state.");
    }
    let specialist: SandboxTopicLane;
    let canonical: SandboxCanonicalTopicLane;
    let divergenceActive = false;

    if (specialistExists) {
      const s = persistedTopicLane(specialistStates, topicKey, false);
      const t = persistedTopicLane(canonicalStates, topicKey, true);
      if (!s || !t) throw httpError(409, "Stored Sandbox topic state is invalid; no reset was made.");
      specialist = s;
      canonical = t;
      divergenceActive = (specialistStates[topicKey] as Record<string, unknown>).divergenceActive === true;
    } else {
      const student = await client.query(
        `SELECT concept_mastery FROM public.students WHERE id::text = $1::text LIMIT 1`,
        [input.studentId],
      );
      const seed = resolveSandboxTopicSeed(student.rows[0]?.concept_mastery, input.topic);
      if (!seed) {
        throw httpError(
          409,
          "The selected topic has no trustworthy observed Training state or needs re-diagnosis. Return to its topic map before starting Sandbox Training.",
        );
      }
      specialist = seed.state;
      // Sandbox students are synthetic. Initial hidden truth follows the
      // previously observed training placement; subsequent hidden and
      // Specialist states may diverge through independent rep evidence.
      canonical = {
        ...seed.state,
        previousTrajectoryClass: null,
        continuityTags: [],
        recentOutcomeKeys: [],
        priorTracksDiverged: false,
      };
    }

    await client.query(
      `UPDATE public.specialist_sandbox_trajectories
          SET active_topic_key = $2,
              specialist_topic_states = $3::jsonb,
              specialist_phase = $4,
              specialist_stability = $5,
              specialist_progression_authority = $6,
              specialist_route = $7,
              specialist_targeted_rediagnosis_phase = $8,
              divergence_active = $9,
              updated_at = now()
        WHERE id = $1`,
      [
        row.id, topicKey, JSON.stringify(specialistStates),
        specialist.phase, specialist.stability, specialist.progression,
        specialist.route, specialist.targetedRediagnosisPhase, divergenceActive,
      ],
    );
    await client.query(
      `UPDATE private.specialist_sandbox_trajectory_truth
          SET canonical_topic_states = $2::jsonb,
              canonical_phase = $3,
              canonical_stability = $4,
              canonical_progression_authority = $5,
              canonical_route = $6,
              canonical_targeted_rediagnosis_phase = $7,
              previous_trajectory_class = $8,
              continuity_tags = $9::jsonb,
              recent_outcome_keys = $10::jsonb,
              prior_tracks_diverged = $11,
              updated_at = now()
        WHERE trajectory_id = $1`,
      [
        row.id, JSON.stringify(canonicalStates),
        canonical.phase, canonical.stability, canonical.progression,
        canonical.route, canonical.targetedRediagnosisPhase,
        canonical.previousTrajectoryClass, JSON.stringify(canonical.continuityTags),
        JSON.stringify(canonical.recentOutcomeKeys), canonical.priorTracksDiverged,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return ensureTrajectory(input);
}

async function currentSessionEventCount(bundle: SandboxTrajectoryBundle) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM specialist_sandbox_rep_events
      WHERE trajectory_id = $1
        AND session_number = $2`,
    [bundle.trajectory.id, bundle.trajectory.session_number],
  );
  return Number(result.rows[0]?.count || 0);
}

async function previousCompletedSessionBoundary(
  bundle: SandboxTrajectoryBundle,
  bank: SandboxEnvironmentBank,
  topic: string,
) {
  if (bundle.trajectory.session_number <= 1) return null;
  const currentCount = await currentSessionEventCount(bundle);
  if (currentCount > 0) return null;

  const result = await pool.query(
    `SELECT current.id, current.session_number, current.phase, current.specialist_authority,
            current.authority_aligned, current.state_track_aligned, current.completed_at,
            previous.specialist_authority AS previous_specialist_authority
       FROM specialist_sandbox_session_evaluations current
       LEFT JOIN specialist_sandbox_session_evaluations previous
         ON previous.trajectory_id = current.trajectory_id
        AND previous.session_number = current.session_number - 1
      WHERE current.trajectory_id = $1
        AND current.session_number = $2
      LIMIT 1`,
    [bundle.trajectory.id, bundle.trajectory.session_number - 1],
  );
  const row = result.rows[0];
  if (!row) return null;

  const specialistAuthority =
    typeof row.specialist_authority === "string"
      ? JSON.parse(row.specialist_authority)
      : row.specialist_authority;
  const completedPhase = String(row.phase) as TopicPhase;
  const previousAuthority =
    typeof row.previous_specialist_authority === "string"
      ? JSON.parse(row.previous_specialist_authority)
      : row.previous_specialist_authority;
  const phaseBefore =
    (previousAuthority?.nextPhase as TopicPhase | undefined) || completedPhase;
  const stabilityBefore =
    (previousAuthority?.nextStability as TopicStability | undefined) ||
    (Number(row.session_number) === 1 ? "Low" : null);
  const turns = await loadSessionTurns(bundle, Number(row.session_number));
  const responseSnapshot = buildSandboxResponseSnapshot({
    sourceDrillId: String(row.id),
    topic,
    phase: completedPhase,
    bankVersion: bank.bankVersion,
    turns,
    phaseBefore,
    stabilityBefore,
    authority: specialistAuthority,
  });

  return {
    completedSessionNumber: Number(row.session_number),
    nextSessionNumber: bundle.trajectory.session_number,
    completedPhase,
    completedAt: row.completed_at,
    specialistAuthority,
    authorityAligned: Boolean(row.authority_aligned),
    stateTrackAligned: Boolean(row.state_track_aligned),
    responseSnapshot,
  };
}

async function loadCapabilityOccurrences(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const result = await pool.query(
    `SELECT capability_id, evidence_class, phase, set_id, rep_number,
            trajectory_id, session_number, sequence_number, reason
       FROM specialist_sandbox_capability_evidence
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
      ORDER BY created_at ASC, id ASC`,
    [input.tutorAssignmentId, input.tutorId],
  );

  return result.rows.map((row) => ({
    layer: String(row.capability_id) as SandboxCapabilityLayer,
    evidenceClass: String(row.evidence_class) as SandboxCapabilityOccurrence["evidenceClass"],
    sequenceNumber: Number(row.sequence_number || 0),
    sessionNumber: Number(row.session_number),
    phase: String(row.phase) as TopicPhase,
    setId: String(row.set_id),
    repNumber: Number(row.rep_number),
    reason: String(row.reason),
  })) satisfies SandboxCapabilityOccurrence[];
}

async function exposureSummary(input: {
  tutorAssignmentId: string;
  tutorId: string;
}): Promise<SandboxExposureSummary> {
  const [repCoverage, sessions] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(DISTINCT phase)::int AS distinct_phases,
         COUNT(DISTINCT set_id)::int AS distinct_sets,
         COUNT(DISTINCT (phase, set_id, rep_number))::int AS distinct_rep_positions
       FROM specialist_sandbox_rep_events
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2`,
      [input.tutorAssignmentId, input.tutorId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS completed_sessions,
         COALESCE(bool_or(state_change_observed), false) AS state_change_observed,
         COALESCE(bool_or(student_breakdown_recovery_observed), false) AS breakdown_recovery_observed
       FROM specialist_sandbox_session_evaluations
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2`,
      [input.tutorAssignmentId, input.tutorId],
    ),
  ]);

  return {
    distinctPhases: Number(repCoverage.rows[0]?.distinct_phases || 0),
    distinctSets: Number(repCoverage.rows[0]?.distinct_sets || 0),
    distinctRepPositions: Number(repCoverage.rows[0]?.distinct_rep_positions || 0),
    completedSessions: Number(sessions.rows[0]?.completed_sessions || 0),
    stateChangeObserved: Boolean(sessions.rows[0]?.state_change_observed),
    breakdownRecoveryObserved: Boolean(sessions.rows[0]?.breakdown_recovery_observed),
  };
}

async function readinessFor(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bank: SandboxEnvironmentBank;
}) {
  if (!input.bank.capabilityPolicy) {
    return {
      policyAvailable: false as const,
      bankKey: input.bank.bankKey,
      bankVersion: input.bank.bankVersion,
      policyStatus: null,
      policyVersion: null,
      evidenceReady: false,
      practicalsReady: false,
      automaticTransition: false as const,
      nextStage: "practicals" as const,
      earliestUnsupportedCapability: null,
      layers: [],
      breadthReady: false,
      longitudinalReady: false,
      reason: "The active Sandbox environment bank does not yet have a capability policy.",
    };
  }
  const [evidence, exposure] = await Promise.all([
    loadCapabilityOccurrences(input),
    exposureSummary(input),
  ]);
  return {
    policyAvailable: true as const,
    bankKey: input.bank.bankKey,
    bankVersion: input.bank.bankVersion,
    policyVersion: input.bank.capabilityPolicy.policyVersion,
    ...evaluateSandboxCapabilityReadiness({
      policy: input.bank.capabilityPolicy,
      evidence,
      exposure,
    }),
    exposure,
  };
}

export async function getSandboxCapabilityReadiness(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const bank = await loadActiveEnvironmentBank();
  if (!bank) {
    return {
      policyAvailable: false as const,
      bankKey: null,
      bankVersion: null,
      policyStatus: null,
      policyVersion: null,
      evidenceReady: false,
      practicalsReady: false,
      automaticTransition: false as const,
      nextStage: "practicals" as const,
      earliestUnsupportedCapability: null,
      layers: [],
      breadthReady: false,
      longitudinalReady: false,
      reason: "No active stateful Sandbox environment bank is available.",
    };
  }

  return readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });
}

async function loadRepOutcomes(input: {
  bank: SandboxEnvironmentBank;
  phase: TopicPhase;
  setId: string;
  repNumber: number;
}): Promise<PrivateOutcomeRecord[]> {
  const result = await pool.query(
    `SELECT public_ref, definition
       FROM private.specialist_sandbox_rep_outcomes
      WHERE bank_key = $1
        AND bank_version = $2
        AND phase = $3
        AND set_id = $4
        AND rep_number = $5
        AND active = true
      ORDER BY outcome_key ASC`,
    [
      input.bank.bankKey,
      input.bank.bankVersion,
      input.phase,
      input.setId,
      input.repNumber,
    ],
  );

  if (
    result.rows.length < input.bank.minimumOutcomesPerRep ||
    result.rows.length > input.bank.maximumOutcomesPerRep
  ) {
    throw httpError(
      503,
      `Sandbox Outcome Matrix has ${result.rows.length} outcomes for ${input.phase} / ${input.setId} / rep ${input.repNumber}; expected ${input.bank.minimumOutcomesPerRep}-${input.bank.maximumOutcomesPerRep}.`,
    );
  }

  const sourceTrainingSchemaVersion =
    trainingSchemaVersionForSandboxBank(input.bank.bankVersion);

  return result.rows.map((row) => {
    const storedDefinition = (
      typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition
    ) as SandboxOutcomeDefinition;
    const definition = projectSandboxOutcomeToCurrentTrainingContract(
      storedDefinition,
      sourceTrainingSchemaVersion,
    );
    validateSandboxOutcomeDefinition(definition);
    return {
      publicRef: String(row.public_ref),
      definition,
    };
  });
}

function projectRepFields(phase: TopicPhase, set: EvidenceSetDefinition, repNumber: number) {
  return getFieldDefinitionsForRep(set, repNumber - 1).map((field) => {
    return {
      fieldKey: field.fieldKey,
      dimensionId: field.dimensionId,
      options: (field.optionLabels || []).map((label, optionIndex) => {
        const identity = getEvidenceSelectionIdentity({
          mode: "training",
          phase,
          setName: set.setName,
          repIndex: repNumber - 1,
          fieldKey: field.fieldKey,
          optionIndex,
        });
        if (!identity) throw new Error("Unable to project Sandbox evidence option.");
        return {
          optionId: identity.optionId,
          label,
          requiresPrerequisiteSentinel:
            trainingRawObservationRequiresPrerequisiteSentinel({
              phase,
              fieldKey: field.fieldKey,
              rawOption: label,
            }),
        };
      }),
    };
  });
}

function interventionPreservesCondition(
  constraints: EvidenceConstraintProfile,
  interventionEvent: TrainingInterventionEvent,
) {
  if (interventionEvent === "none" || interventionEvent === "neutral_clarification") return true;
  if (interventionEvent === "full_rescue_or_teaching" || interventionEvent === "timer_changed") return false;
  if (constraints.supportLevel === "none") return false;
  if (constraints.supportLevel === "first_step_only") {
    return interventionEvent === "first_step_confirmation";
  }
  if (constraints.supportLevel === "minimal") {
    return interventionEvent === "first_step_confirmation" || interventionEvent === "method_or_step_prompt";
  }
  return false;
}

async function planNextRep(input: {
  bundle: SandboxTrajectoryBundle;
  bank: SandboxEnvironmentBank;
  tutorAssignmentId: string;
  tutorId: string;
}) {
  if (input.bundle.truth.canonical_route === "targeted_rediagnosis") {
    return {
      blockedByRoute: true as const,
      targetPhase: input.bundle.truth.canonical_targeted_rediagnosis_phase,
    };
  }

  const phase = input.bundle.truth.canonical_phase;
  const trainingSets = scoredTrainingSets(phase);
  const plan = flattenedRepPlan(phase);
  const completedInSession = await currentSessionEventCount(input.bundle);
  const position = plan[completedInSession];
  if (!position) {
    throw httpError(409, "Sandbox session evidence is complete but session authority has not been resolved.");
  }

  const privateOutcomes = await loadRepOutcomes({
    bank: input.bank,
    phase,
    setId: position.set.setId,
    repNumber: position.repNumber,
  });
  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank: input.bank,
  });
  const selected = selectSandboxOutcome({
    seed: input.bundle.truth.trajectory_seed,
    outcomes: privateOutcomes.map((item) => item.definition),
    context: {
      canonicalPhase: input.bundle.truth.canonical_phase,
      canonicalStability: input.bundle.truth.canonical_stability,
      prescribedPhase: phase,
      setId: position.set.setId,
      repNumber: position.repNumber,
      sequenceNumber: input.bundle.trajectory.completed_rep_count + 1,
      previousTrajectoryClass: input.bundle.truth.previous_trajectory_class,
      continuityTags: input.bundle.truth.continuity_tags,
      earliestUnsupportedCapability:
        readiness.policyAvailable ? readiness.earliestUnsupportedCapability : null,
      recentOutcomeKeys: input.bundle.truth.recent_outcome_keys,
    },
  });
  const selectedRecord = privateOutcomes.find(
    (item) => item.definition.key === selected.key && item.definition.version === selected.version,
  );
  if (!selectedRecord) throw new Error("Selected Sandbox outcome could not be resolved.");

  const eventSequence = input.bundle.trajectory.completed_rep_count + 1;
  const eventFormId = digest(
    [
      "sandbox-rep-form-v2",
      input.bundle.trajectory.id,
      input.bundle.trajectory.session_number,
      eventSequence,
      selectedRecord.publicRef,
    ].join(":"),
  ).slice(0, 32);

  return {
    blockedByRoute: false as const,
    phase,
    position,
    setIndex:
      trainingSets.findIndex((set) => set.setId === position.set.setId) + 1,
    setCount: trainingSets.length,
    selected,
    selectedRecord,
    completedInSession,
    totalRepsInSession: plan.length,
    eventSequence,
    eventFormId,
    readiness,
  };
}

export async function prepareSandboxEnvironment(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  bankKey?: string;
  requestedSessionNumber?: number | null;
  scheduledSessionId?: string | null;
  topic?: string | null;
}) {
  const sandboxStudent = await assertSandboxAccess(input);
  const bank = await loadActiveEnvironmentBank(input.bankKey);
  if (!bank) throw httpError(404, "No active stateful Sandbox environment bank is available.");
  const bundle = await ensureTrajectory({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    studentId: input.studentId,
    bank,
  });
  const boundScheduledSession = await loadSandboxScheduledTrainingSession({
    scheduledSessionId: input.scheduledSessionId,
    tutorId: input.tutorId,
    studentId: input.studentId,
    allowCompleted: true,
  });

  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });

  const completedBoundary = await previousCompletedSessionBoundary(
    bundle,
    bank,
    String(input.topic || "Sandbox practice"),
  );
  const requestedCurrentSession =
    Number(input.requestedSessionNumber || 0) ===
    bundle.trajectory.session_number;
  const hasActiveBoundScheduledLesson =
    Boolean(boundScheduledSession) &&
    ["confirmed", "ready", "live"].includes(
      String(boundScheduledSession?.status || "").trim().toLowerCase(),
    );
  if (
    completedBoundary &&
    !requestedCurrentSession &&
    !hasActiveBoundScheduledLesson
  ) {
    return {
      bankKey: bank.bankKey,
      bankVersion: bank.bankVersion,
      bankTitle: bank.title,
      sandboxStudent,
      trajectoryId: bundle.trajectory.id,
      sessionNumber: completedBoundary.completedSessionNumber,
      status: "session_complete" as const,
      prescribedPhase: bundle.truth.canonical_phase,
      prescribedStability: bundle.truth.canonical_stability,
      completedSession: completedBoundary,
      studentStateAuthoritative: false as const,
      evidenceScope: "sandbox" as const,
      readiness,
    };
  }
  if (String(boundScheduledSession.status || "") === "completed") {
    throw httpError(
      409,
      "This Sandbox lesson is already complete. Return to the Pod and start the next confirmed weekly lesson.",
    );
  }


  const planned = await planNextRep({
    bundle,
    bank,
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });

  if (planned.blockedByRoute) {
    return {
      bankKey: bank.bankKey,
      bankVersion: bank.bankVersion,
      bankTitle: bank.title,
      sandboxStudent,
      trajectoryId: bundle.trajectory.id,
      sessionNumber: bundle.trajectory.session_number,
      status: "targeted_rediagnosis_required" as const,
      prescribedPhase: bundle.truth.canonical_phase,
      prescribedStability: bundle.truth.canonical_stability,
      targetPhase: planned.targetPhase,
      studentStateAuthoritative: false as const,
      evidenceScope: "sandbox" as const,
      readiness,
    };
  }

  return {
    bankKey: bank.bankKey,
    bankVersion: bank.bankVersion,
    bankTitle: bank.title,
    sandboxStudent,
    trajectoryId: bundle.trajectory.id,
    sessionNumber: bundle.trajectory.session_number,
    status: "rep_ready" as const,
    prescribedPhase: planned.phase,
    prescribedStability: bundle.truth.canonical_stability,
    sessionProgress: {
      completedReps: planned.completedInSession,
      totalReps: planned.totalRepsInSession,
    },
    eventSequence: planned.eventSequence,
    eventFormId: planned.eventFormId,
    rep: {
      setId: planned.position.set.setId,
      setName: planned.position.set.setName,
      setPurpose: planned.position.set.purpose,
      setIndex: planned.setIndex,
      setCount: planned.setCount,
      repCount: planned.position.set.reps,
      constraints: { ...planned.position.set.constraints },
      repNumber: planned.position.repNumber,
      studentBehavior: planned.selected.studentBehavior,
      fields: projectRepFields(
        planned.phase,
        planned.position.set,
        planned.position.repNumber,
      ),
      interventionOptions: TRAINING_INTERVENTION_OPTIONS,
      prerequisiteSentinel: (() => {
        const definition = getTrainingPrerequisiteSentinelDefinition(planned.phase);
        return definition
          ? {
              targetPhase: definition.targetPhase,
              evidenceQuestion: definition.evidenceQuestion,
              specialistInstruction: definition.specialistInstruction,
              options: [
                { id: "held", label: definition.heldLabel },
                { id: "contradicted", label: definition.contradictedLabel },
                { id: "not_observed", label: "Prerequisite could not be observed cleanly" },
                { id: "confounded", label: "Prerequisite check was confounded" },
              ],
            }
          : null;
      })(),
      inheritedRescueSignal:
        planned.phase === "Time Pressure Stability"
          ? {
              evidenceQuestion:
                "Did the student seek rescue or correctness confirmation during this timed no-support opportunity?",
              options: TRAINING_INHERITED_RESCUE_SIGNAL_OPTIONS,
            }
          : null,
    },
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
    readiness,
  };
}

async function insertCapabilityOccurrences(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  trajectoryId: string;
  sourceType: "turn" | "session";
  sourceId: string;
  occurrences: SandboxCapabilityOccurrence[];
}) {
  for (const occurrence of input.occurrences) {
    await pool.query(
      `INSERT INTO specialist_sandbox_capability_evidence (
         trajectory_id, tutor_assignment_id, tutor_id, student_id, capability_id,
         evidence_class, source_type, source_id, phase, set_id, rep_number,
         sequence_number, session_number, reason,
         student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,'sandbox')
       ON CONFLICT DO NOTHING`,
      [
        input.trajectoryId,
        input.tutorAssignmentId,
        input.tutorId,
        input.studentId,
        occurrence.layer,
        occurrence.evidenceClass,
        input.sourceType,
        input.sourceId,
        occurrence.phase,
        occurrence.setId,
        occurrence.repNumber,
        occurrence.sequenceNumber,
        occurrence.sessionNumber,
        occurrence.reason,
      ],
    );
  }
}

async function loadSessionTurns(
  bundle: SandboxTrajectoryBundle,
  sessionNumber: number,
): Promise<SandboxCompletedTurn[]> {
  const result = await pool.query(
    `SELECT e.event_sequence, e.session_number, e.phase, e.set_id, e.rep_number,
            e.student_behavior, e.specialist_submission, e.condition_kept,
            truth.outcome_key, truth.outcome_version, truth.canonical_observations,
            truth.canonical_prerequisite_sentinel, truth.canonical_inherited_rescue_signal,
            truth.trajectory_class, truth.actual_intervention_event
       FROM specialist_sandbox_rep_events e
       JOIN private.specialist_sandbox_rep_event_truth truth
         ON truth.event_id = e.id
      WHERE e.trajectory_id = $1
        AND e.session_number = $2
      ORDER BY e.event_sequence ASC`,
    [bundle.trajectory.id, sessionNumber],
  );

  return result.rows.map((row) => {
    const submission = (
      typeof row.specialist_submission === "string"
        ? JSON.parse(row.specialist_submission)
        : row.specialist_submission
    ) as SandboxRepSubmission;
    const canonicalObservations =
      typeof row.canonical_observations === "string"
        ? JSON.parse(row.canonical_observations)
        : row.canonical_observations;

    return {
      sequenceNumber: Number(row.event_sequence),
      sessionNumber: Number(row.session_number),
      phase: String(row.phase) as TopicPhase,
      setId: String(row.set_id),
      repNumber: Number(row.rep_number),
      outcome: {
        key: String(row.outcome_key),
        version: Number(row.outcome_version),
        phase: String(row.phase) as TopicPhase,
        setId: String(row.set_id),
        repNumber: Number(row.rep_number),
        studentBehavior: String(row.student_behavior),
        canonicalObservations,
        canonicalPrerequisiteSentinel: row.canonical_prerequisite_sentinel || undefined,
        canonicalInheritedRescueSignal: row.canonical_inherited_rescue_signal || undefined,
        trajectoryClass: String(row.trajectory_class) as SandboxTrajectoryClass,
        weight: 1,
      },
      actualInterventionEvent: String(row.actual_intervention_event) as TrainingInterventionEvent,
      recordedInterventionEvent: submission.interventionEvent,
      conditionConformed: row.condition_kept === null ? null : Boolean(row.condition_kept),
      specialistObservations: submission.observations,
      specialistPrerequisiteSentinel: submission.prerequisiteSentinel,
      specialistInheritedRescueSignal: submission.inheritedRescueSignal,
    };
  });
}

async function loadCurrentSessionTurns(bundle: SandboxTrajectoryBundle) {
  return loadSessionTurns(bundle, bundle.trajectory.session_number);
}

function sessionHasBreakdownRecovery(turns: SandboxCompletedTurn[]) {
  const ordered = [...turns].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const firstBreakdown = ordered.findIndex((turn) => turn.outcome.trajectoryClass === "breakdown");
  return firstBreakdown >= 0 && ordered
    .slice(firstBreakdown + 1)
    .some((turn) => turn.outcome.trajectoryClass === "supported");
}

export async function submitSandboxEnvironmentRep(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  bankVersion: number;
  trajectoryId: string;
  eventSequence: number;
  eventFormId: string;
  scheduledSessionId?: string | null;
  topic?: string | null;
  submission: SandboxRepSubmission;
}) {
  await assertSandboxAccess(input);
  const bank = await loadActiveEnvironmentBank();
  if (!bank || bank.bankVersion !== input.bankVersion) {
    throw httpError(409, "Sandbox environment bank changed. Reload the current rep.");
  }
  const bundle = await ensureTrajectory({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    studentId: input.studentId,
    bank,
  });
  await loadSandboxScheduledTrainingSession({
    scheduledSessionId: input.scheduledSessionId,
    tutorId: input.tutorId,
    studentId: input.studentId,
  });
  if (bundle.trajectory.id !== input.trajectoryId) {
    throw httpError(409, "Sandbox trajectory changed. Reload the current rep.");
  }

  const planned = await planNextRep({
    bundle,
    bank,
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });
  if (planned.blockedByRoute) {
    throw httpError(409, "Sandbox Training is paused because targeted re-diagnosis is required.");
  }
  if (
    input.eventSequence !== planned.eventSequence ||
    input.eventFormId !== planned.eventFormId
  ) {
    throw httpError(409, "Sandbox rep is stale or does not match the active trajectory.");
  }
  if (!TRAINING_INTERVENTION_OPTIONS.some((option) => option.id === input.submission.interventionEvent)) {
    throw httpError(400, "Sandbox rep has an invalid Specialist intervention event.");
  }

  const fields = projectRepFields(
    planned.phase,
    planned.position.set,
    planned.position.repNumber,
  );
  for (const field of fields) {
    const submitted = input.submission.observations[field.fieldKey];
    if (!submitted?.optionId || !field.options.some((option) => option.optionId === submitted.optionId)) {
      throw httpError(400, `Sandbox rep is missing a valid ${field.fieldKey} observation.`);
    }
  }

  const turn: SandboxCompletedTurn = {
    sequenceNumber: planned.eventSequence,
    sessionNumber: bundle.trajectory.session_number,
    phase: planned.phase,
    setId: planned.position.set.setId,
    repNumber: planned.position.repNumber,
    outcome: planned.selected,
    actualInterventionEvent: input.submission.interventionEvent,
    recordedInterventionEvent: input.submission.interventionEvent,
    conditionConformed: interventionPreservesCondition(
      planned.position.set.constraints,
      input.submission.interventionEvent,
    ),
    specialistObservations: input.submission.observations,
    specialistPrerequisiteSentinel: input.submission.prerequisiteSentinel,
    specialistInheritedRescueSignal: input.submission.inheritedRescueSignal,
  };
  const comparison = compareSandboxTurn(turn);

  const inserted = await pool.query(
    `INSERT INTO specialist_sandbox_rep_events (
       trajectory_id, tutor_assignment_id, tutor_id, student_id, event_sequence,
       session_number, phase, set_id, rep_number, outcome_ref, student_behavior,
       selection_seed_digest, specialist_submission, condition_kept,
       total_observations, matching_observations, matching_evidence_statuses,
       observation_exact, evidence_exact,
       student_state_authoritative, evidence_scope
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,false,'sandbox')
     RETURNING id, completed_at`,
    [
      bundle.trajectory.id,
      input.tutorAssignmentId,
      input.tutorId,
      bundle.trajectory.student_id,
      planned.eventSequence,
      bundle.trajectory.session_number,
      planned.phase,
      planned.position.set.setId,
      planned.position.repNumber,
      planned.selectedRecord.publicRef,
      planned.selected.studentBehavior,
      digest(
        [
          bundle.truth.trajectory_seed,
          bundle.trajectory.session_number,
          planned.eventSequence,
          planned.selectedRecord.publicRef,
        ].join(":"),
      ),
      JSON.stringify(input.submission),
      turn.conditionConformed,
      comparison.totalObservations,
      comparison.matchingOptions,
      comparison.matchingEvidenceStatuses,
      comparison.observationExact,
      comparison.evidenceExact,
    ],
  );
  const eventId = String(inserted.rows[0]?.id || "");

  await pool.query(
    `INSERT INTO private.specialist_sandbox_rep_event_truth (
       event_id, bank_key, bank_version, outcome_ref, outcome_key, outcome_version,
       canonical_observations, canonical_prerequisite_sentinel,
       canonical_inherited_rescue_signal, trajectory_class, actual_intervention_event
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
    [
      eventId,
      bank.bankKey,
      bank.bankVersion,
      planned.selectedRecord.publicRef,
      planned.selected.key,
      planned.selected.version,
      JSON.stringify(planned.selected.canonicalObservations),
      planned.selected.canonicalPrerequisiteSentinel || null,
      planned.selected.canonicalInheritedRescueSignal || null,
      planned.selected.trajectoryClass,
      input.submission.interventionEvent,
    ],
  );

  await insertCapabilityOccurrences({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    studentId: bundle.trajectory.student_id,
    trajectoryId: bundle.trajectory.id,
    sourceType: "turn",
    sourceId: eventId,
    occurrences: comparison.capabilityEvidence,
  });

  const continuity = nextSandboxContinuityState({
    currentTags: bundle.truth.continuity_tags,
    outcome: planned.selected,
  });
  const recentOutcomeKeys = [
    ...bundle.truth.recent_outcome_keys,
    planned.selected.key,
  ].slice(-3);

  await Promise.all([
    pool.query(
      `UPDATE specialist_sandbox_trajectories
          SET completed_rep_count = completed_rep_count + 1,
              updated_at = now()
        WHERE id = $1`,
      [bundle.trajectory.id],
    ),
    pool.query(
      `UPDATE private.specialist_sandbox_trajectory_truth
          SET previous_trajectory_class = $2,
              continuity_tags = $3::jsonb,
              recent_outcome_keys = $4::jsonb,
              updated_at = now()
        WHERE trajectory_id = $1`,
      [
        bundle.trajectory.id,
        continuity.trajectoryClass,
        JSON.stringify(continuity.continuityTags),
        JSON.stringify(recentOutcomeKeys),
      ],
    ),
  ]);

  const sessionCompleted = planned.completedInSession + 1 === planned.totalRepsInSession;
  let sessionAuthority: {
    specialist: ReturnType<typeof evaluateSandboxCompletedSession>["specialistRoute"];
    authorityAligned: boolean;
    stateTrackAligned: boolean;
  } | null = null;
  let responseSnapshot: ResponseSnapshotV1 | null = null;
  let completedScheduledSession: {
    id: string;
    status: "completed";
    completedAt: string;
    parentId: string;
    enrollmentId: string | null;
  } | null = null;

  if (sessionCompleted) {
    const refreshedBundle = await ensureTrajectory({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
      studentId: input.studentId,
      bank,
    });
    const turns = await loadCurrentSessionTurns(refreshedBundle);
    const priorSessionCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM specialist_sandbox_session_evaluations
        WHERE trajectory_id = $1`,
      [bundle.trajectory.id],
    );
    const priorCompletedSessions = Number(priorSessionCountResult.rows[0]?.count || 0);
    const evaluation = evaluateSandboxCompletedSession({
      phase: planned.phase,
      canonicalPreviousStability: bundle.truth.canonical_stability,
      specialistPreviousStability: bundle.trajectory.specialist_stability,
      canonicalPreviousProgressionAuthority: bundle.truth.canonical_progression_authority,
      specialistPreviousProgressionAuthority: bundle.trajectory.specialist_progression_authority,
      turns,
      priorCompletedSessions,
      priorTracksDiverged: bundle.truth.prior_tracks_diverged,
    });

    // Repeatability eligibility is a real longitudinal state change even
    // when the student's capability stability remains High.
    const stateChangeObserved =
      evaluation.canonicalNext.phase !== bundle.truth.canonical_phase ||
      evaluation.canonicalNext.stability !== bundle.truth.canonical_stability ||
      evaluation.canonicalNext.progressionAuthority !== bundle.truth.canonical_progression_authority;
    const breakdownRecoveryObserved = sessionHasBreakdownRecovery(turns);

    const sessionInsert = await pool.query(
      `INSERT INTO specialist_sandbox_session_evaluations (
         trajectory_id, tutor_assignment_id, tutor_id, student_id, session_number,
         phase, specialist_authority, authority_aligned, state_track_aligned,
         state_change_observed, student_breakdown_recovery_observed,
         student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,false,'sandbox')
       RETURNING id`,
      [
        bundle.trajectory.id,
        input.tutorAssignmentId,
        input.tutorId,
        bundle.trajectory.student_id,
        bundle.trajectory.session_number,
        planned.phase,
        JSON.stringify(evaluation.specialistRoute),
        evaluation.systemOutcomeMatched,
        evaluation.systemOutcomeMatched,
        stateChangeObserved,
        breakdownRecoveryObserved,
      ],
    );
    const sessionId = String(sessionInsert.rows[0]?.id || "");
    responseSnapshot = buildSandboxResponseSnapshot({
      sourceDrillId: sessionId,
      topic: String(input.topic || "Sandbox practice"),
      phase: planned.phase,
      bankVersion: bank.bankVersion,
      turns,
      phaseBefore: bundle.trajectory.specialist_phase,
      stabilityBefore: bundle.trajectory.specialist_stability,
      authority: evaluation.specialistRoute,
    });
    completedScheduledSession = await completeSandboxScheduledTrainingSession({
      scheduledSessionId: input.scheduledSessionId,
      tutorId: input.tutorId,
      studentId: input.studentId,
      trajectoryId: bundle.trajectory.id,
      sandboxSessionNumber: bundle.trajectory.session_number,
    });

    await pool.query(
      `INSERT INTO private.specialist_sandbox_session_truth (
         session_evaluation_id, canonical_authority
       ) VALUES ($1,$2::jsonb)`,
      [sessionId, JSON.stringify(evaluation.canonicalRoute)],
    );

    await insertCapabilityOccurrences({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
      studentId: bundle.trajectory.student_id,
      trajectoryId: bundle.trajectory.id,
      sourceType: "session",
      sourceId: sessionId,
      occurrences: evaluation.capabilityEvidence,
    });

    await Promise.all([
      pool.query(
        `UPDATE specialist_sandbox_trajectories
            SET specialist_phase = $2,
                specialist_stability = $3,
                specialist_progression_authority = $7,
                specialist_route = $4,
                specialist_targeted_rediagnosis_phase = $5,
                divergence_active = $6,
                session_number = session_number + 1,
                updated_at = now()
          WHERE id = $1`,
        [
          bundle.trajectory.id,
          evaluation.specialistRoute.nextPhase,
          evaluation.specialistRoute.nextCapabilityStability,
          evaluation.specialistRoute.route,
          evaluation.specialistRoute.targetPhase,
          !evaluation.systemOutcomeMatched,
          evaluation.specialistRoute.nextProgressionAuthority,
        ],
      ),
      pool.query(
        `UPDATE private.specialist_sandbox_trajectory_truth
            SET canonical_phase = $2,
                canonical_stability = $3,
                canonical_progression_authority = $7,
                canonical_route = $4,
                canonical_targeted_rediagnosis_phase = $5,
                prior_tracks_diverged = $6,
                updated_at = now()
          WHERE trajectory_id = $1`,
        [
          bundle.trajectory.id,
          evaluation.canonicalRoute.nextPhase,
          evaluation.canonicalRoute.nextCapabilityStability,
          evaluation.canonicalRoute.route,
          evaluation.canonicalRoute.targetPhase,
          !evaluation.systemOutcomeMatched,
          evaluation.canonicalRoute.nextProgressionAuthority,
        ],
      ),
    ]);

    await persistSandboxStudentTopicState({
      studentId: bundle.trajectory.student_id,
      topic: String(input.topic || "Sandbox practice"),
      phase: evaluation.specialistRoute.nextPhase,
      stability: evaluation.specialistRoute.nextCapabilityStability,
      progressionAuthority: evaluation.specialistRoute.nextProgressionAuthority,
      sessionEvaluationId: sessionId,
      observedAt: String(inserted.rows[0]?.completed_at || new Date().toISOString()),
      reason: evaluation.specialistRoute.reason,
    });

    sessionAuthority = {
      specialist: evaluation.specialistRoute,
      authorityAligned: evaluation.systemOutcomeMatched,
      stateTrackAligned: evaluation.systemOutcomeMatched,
    };
  }

  const nextEnvironment = await prepareSandboxEnvironment({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    studentId: input.studentId,
    bankKey: bank.bankKey,
    requestedSessionNumber: null,
    scheduledSessionId: input.scheduledSessionId || null,
    topic: input.topic || null,
  });
  const readiness = nextEnvironment.readiness;

  return {
    studentId: bundle.trajectory.student_id,
    eventId,
    completedAt: inserted.rows[0]?.completed_at,
    eventSequence: planned.eventSequence,
    sessionNumber: bundle.trajectory.session_number,
    phase: planned.phase,
    setId: planned.position.set.setId,
    repNumber: planned.position.repNumber,
    matchingObservations: comparison.matchingOptions,
    totalObservations: comparison.totalObservations,
    observationExact: comparison.observationExact,
    evidenceExact: comparison.evidenceExact,
    conditionKept: turn.conditionConformed,
    sessionCompleted,
    sessionAuthority,
    responseSnapshot,
    completedScheduledSession,
    nextEnvironment,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
    readiness,
  };
}

export async function getSandboxEnvironmentHistory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
}) {
  const sandboxStudent = await assertSandboxAccess(input);
  const bank = await loadActiveEnvironmentBank();
  if (!bank) throw httpError(404, "No active stateful Sandbox environment bank is available.");
  const bundle = await ensureTrajectory({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    studentId: input.studentId,
    bank,
  });
  const [events, sessions, readiness] = await Promise.all([
    pool.query(
      `SELECT id, event_sequence, session_number, phase, set_id, rep_number,
              condition_kept, total_observations, matching_observations,
              matching_evidence_statuses, observation_exact, evidence_exact, completed_at
         FROM specialist_sandbox_rep_events
        WHERE trajectory_id = $1
        ORDER BY event_sequence DESC
        LIMIT 30`,
      [bundle.trajectory.id],
    ),
    pool.query(
      `SELECT id, session_number, phase, authority_aligned, state_track_aligned,
              state_change_observed, student_breakdown_recovery_observed, completed_at
         FROM specialist_sandbox_session_evaluations
        WHERE trajectory_id = $1
        ORDER BY session_number DESC
        LIMIT 12`,
      [bundle.trajectory.id],
    ),
    readinessFor({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
      bank,
    }),
  ]);

  return {
    sandboxStudent,
    trajectory: {
      id: bundle.trajectory.id,
      sessionNumber: bundle.trajectory.session_number,
      prescribedPhase: bundle.truth.canonical_phase,
      prescribedStability: bundle.truth.canonical_stability,
      divergenceActive: bundle.trajectory.divergence_active,
      route: bundle.truth.canonical_route,
      targetPhase: bundle.truth.canonical_targeted_rediagnosis_phase,
      completedRepCount: bundle.trajectory.completed_rep_count,
    },
    events: events.rows.map((row) => ({
      id: String(row.id),
      eventSequence: Number(row.event_sequence),
      sessionNumber: Number(row.session_number),
      phase: String(row.phase),
      setId: String(row.set_id),
      repNumber: Number(row.rep_number),
      conditionKept: row.condition_kept === null ? null : Boolean(row.condition_kept),
      matchingObservations: Number(row.matching_observations),
      totalObservations: Number(row.total_observations),
      observationExact: row.observation_exact === null ? null : Boolean(row.observation_exact),
      evidenceExact: row.evidence_exact === null ? null : Boolean(row.evidence_exact),
      completedAt: row.completed_at,
    })),
    sessions: sessions.rows.map((row) => ({
      id: String(row.id),
      sessionNumber: Number(row.session_number),
      phase: String(row.phase),
      authorityAligned: Boolean(row.authority_aligned),
      stateTrackAligned: Boolean(row.state_track_aligned),
      stateChangeObserved: Boolean(row.state_change_observed),
      breakdownRecoveryObserved: Boolean(row.student_breakdown_recovery_observed),
      completedAt: row.completed_at,
    })),
    readiness,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}
