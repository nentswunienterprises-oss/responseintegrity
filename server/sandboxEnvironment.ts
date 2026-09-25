import { createHmac } from "crypto";
import { pool } from "./db";
import { loadTutorOperationalModeAuthority } from "./tutorOperationalModeAuthority";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type EvidenceConstraintProfile,
  type EvidenceSetDefinition,
} from "@shared/responseIntegrityDrillRegistry";
import {
  TRAINING_INHERITED_RESCUE_SIGNAL_OPTIONS,
  TRAINING_INTERVENTION_OPTIONS,
  getTrainingPrerequisiteSentinelDefinition,
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
  const existing = await pool.query(
    `SELECT t.*,
            truth.canonical_phase,
            truth.canonical_stability,
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
      LIMIT 1`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.studentId,
      input.bank.bankKey,
      input.bank.bankVersion,
    ],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    return {
      trajectory: row as SandboxTrajectoryRow,
      truth: {
        trajectory_id: String(row.id),
        canonical_phase: String(row.canonical_phase) as TopicPhase,
        canonical_stability: String(row.canonical_stability) as TopicStability,
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
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO specialist_sandbox_trajectories (
         tutor_assignment_id,
         tutor_id,
         student_id,
         bank_key,
         bank_version,
         specialist_phase,
         specialist_stability,
         specialist_route,
         session_number,
         completed_rep_count,
         divergence_active,
         status,
         student_state_authoritative,
         evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,'Clarity','Low','normal_training',1,0,false,'active',false,'sandbox')
       RETURNING *`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        input.studentId,
        input.bank.bankKey,
        input.bank.bankVersion,
      ],
    );
    const trajectory = created.rows[0] as SandboxTrajectoryRow;
    const trajectorySeed = digest(
      ["sandbox-trajectory-v3", trajectory.id, input.studentId, input.bank.bankKey, input.bank.bankVersion].join(":"),
    );
    await client.query(
      `INSERT INTO private.specialist_sandbox_trajectory_truth (
         trajectory_id,
         canonical_phase,
         canonical_stability,
         canonical_route,
         trajectory_seed,
         continuity_tags,
         recent_outcome_keys,
         prior_tracks_diverged
       ) VALUES ($1,'Clarity','Low','normal_training',$2,'[]'::jsonb,'[]'::jsonb,false)`,
      [trajectory.id, trajectorySeed],
    );
    await client.query("COMMIT");
    return {
      trajectory,
      truth: {
        trajectory_id: trajectory.id,
        canonical_phase: "Clarity",
        canonical_stability: "Low",
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
    ...evaluateSandboxCapabilityReadiness({
      policy: input.bank.capabilityPolicy,
      evidence,
      exposure,
    }),
    exposure,
  };
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
  return set.fields.map((baseField) => {
    const field = getFieldDefinitionForRep(set, repNumber - 1, baseField.fieldKey) || baseField;
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
  const planned = await planNextRep({
    bundle,
    bank,
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
  });

  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
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

async function loadCurrentSessionTurns(bundle: SandboxTrajectoryBundle): Promise<SandboxCompletedTurn[]> {
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
    [bundle.trajectory.id, bundle.trajectory.session_number],
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
      turns,
      priorCompletedSessions,
      priorTracksDiverged: bundle.truth.prior_tracks_diverged,
    });

    const stateChangeObserved =
      evaluation.canonicalNext.phase !== bundle.truth.canonical_phase ||
      evaluation.canonicalNext.stability !== bundle.truth.canonical_stability;
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
                specialist_route = $4,
                specialist_targeted_rediagnosis_phase = $5,
                divergence_active = $6,
                session_number = session_number + 1,
                updated_at = now()
          WHERE id = $1`,
        [
          bundle.trajectory.id,
          evaluation.specialistRoute.nextPhase,
          evaluation.specialistRoute.nextStability,
          evaluation.specialistRoute.route,
          evaluation.specialistRoute.targetPhase,
          !evaluation.systemOutcomeMatched,
        ],
      ),
      pool.query(
        `UPDATE private.specialist_sandbox_trajectory_truth
            SET canonical_phase = $2,
                canonical_stability = $3,
                canonical_route = $4,
                canonical_targeted_rediagnosis_phase = $5,
                prior_tracks_diverged = $6,
                updated_at = now()
          WHERE trajectory_id = $1`,
        [
          bundle.trajectory.id,
          evaluation.canonicalRoute.nextPhase,
          evaluation.canonicalRoute.nextStability,
          evaluation.canonicalRoute.route,
          evaluation.canonicalRoute.targetPhase,
          !evaluation.systemOutcomeMatched,
        ],
      ),
    ]);

    sessionAuthority = {
      specialist: evaluation.specialistRoute,
      authorityAligned: evaluation.systemOutcomeMatched,
      stateTrackAligned: evaluation.systemOutcomeMatched,
    };
  }

  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });

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
