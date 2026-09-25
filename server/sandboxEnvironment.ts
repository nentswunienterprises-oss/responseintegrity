import { createHmac } from "crypto";
import { pool } from "./db";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
  type EvidenceConstraintProfile,
  type EvidenceSetDefinition,
  type SubmittedEvidenceSet,
} from "@shared/responseIntegrityDrillRegistry";
import {
  TRAINING_INTERVENTION_FIELD,
  TRAINING_INTERVENTION_OPTIONS,
  trainingEvidenceStatusKey,
  type TrainingEvidenceStatus,
  type TrainingInterventionEvent,
} from "@shared/trainingEvidenceCapture";
import {
  evaluateTrainingEvidence,
  resolveTrainingEvidenceAuthorityRoute,
} from "@shared/trainingEvidenceEvaluator";
import {
  deriveSandboxCapabilityOccurrences,
  evaluateSandboxCapabilityReadiness,
  parseSandboxCapabilityPolicy,
  sandboxCapabilityNeeds,
  sandboxInterventionPreservesCondition,
  selectSandboxOutcome,
  validateSandboxOutcomeDefinition,
  type SandboxCapabilityOccurrence,
  type SandboxCapabilityPolicy,
  type SandboxOutcomeDefinition,
  type SandboxSpecialistCapabilityId,
  type SandboxStateAuthorityOutcome,
} from "@shared/sandboxEnvironment";
import type { TopicPhase, TopicStability } from "@shared/topicConditioningEngine";

export const DEFAULT_SANDBOX_ENVIRONMENT_BANK_KEY = "sandbox_stateful_environment";

type SandboxEnvironmentBank = {
  bankKey: string;
  bankVersion: number;
  title: string;
  capabilityPolicy: SandboxCapabilityPolicy | null;
};

type SandboxTrajectoryRow = {
  id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  bank_key: string;
  bank_version: number;
  canonical_phase: TopicPhase;
  canonical_stability: TopicStability;
  specialist_phase: TopicPhase;
  specialist_stability: TopicStability;
  canonical_route: "normal_training" | "targeted_rediagnosis";
  specialist_route: "normal_training" | "targeted_rediagnosis";
  canonical_targeted_rediagnosis_phase: TopicPhase | null;
  specialist_targeted_rediagnosis_phase: TopicPhase | null;
  session_number: number;
  completed_rep_count: number;
  divergence_active: boolean;
  status: string;
};

type SandboxRepSubmission = {
  interventionEvent: TrainingInterventionEvent;
  observations: Record<string, {
    optionId: string;
    evidenceStatus?: TrainingEvidenceStatus;
  }>;
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

const normalizeEvidenceStatus = (value?: TrainingEvidenceStatus): TrainingEvidenceStatus =>
  value === "not_observed" || value === "confounded" ? value : "observed";

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
        .update("ri-sandbox-environment-secret-v1")
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
}) {
  const result = await pool.query(
    `SELECT id, operational_mode
       FROM tutor_assignments
      WHERE id = $1
        AND tutor_id = $2
      LIMIT 1`,
    [input.tutorAssignmentId, input.tutorId],
  );
  const row = result.rows[0];
  if (!row) {
    throw httpError(403, "Specialist assignment not found or does not belong to the authenticated user.");
  }
  if (String(row.operational_mode || "").toLowerCase() !== "sandbox") {
    throw httpError(409, "The stateful Sandbox environment is available only while the Specialist is in Sandbox.");
  }
}

async function loadActiveEnvironmentBank(
  bankKey = DEFAULT_SANDBOX_ENVIRONMENT_BANK_KEY,
): Promise<SandboxEnvironmentBank | null> {
  const result = await pool.query(
    `SELECT bank_key, bank_version, title, capability_policy
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
    capabilityPolicy: row.capability_policy
      ? parseSandboxCapabilityPolicy(row.capability_policy)
      : null,
  };
}

async function ensureTrajectory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bank: SandboxEnvironmentBank;
}): Promise<SandboxTrajectoryRow> {
  const existing = await pool.query(
    `SELECT *
       FROM specialist_sandbox_trajectories
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        AND bank_key = $3
        AND bank_version = $4
        AND status = 'active'
      LIMIT 1`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.bank.bankKey,
      input.bank.bankVersion,
    ],
  );
  if (existing.rows[0]) return existing.rows[0] as SandboxTrajectoryRow;

  const created = await pool.query(
    `INSERT INTO specialist_sandbox_trajectories (
       tutor_assignment_id,
       tutor_id,
       bank_key,
       bank_version,
       canonical_phase,
       canonical_stability,
       specialist_phase,
       specialist_stability,
       canonical_route,
       specialist_route,
       session_number,
       completed_rep_count,
       divergence_active,
       status,
       student_state_authoritative,
       evidence_scope
     ) VALUES ($1,$2,$3,$4,'Clarity','Low','Clarity','Low','normal_training','normal_training',1,0,false,'active',false,'sandbox')
     RETURNING *`,
    [
      input.tutorAssignmentId,
      input.tutorId,
      input.bank.bankKey,
      input.bank.bankVersion,
    ],
  );
  return created.rows[0] as SandboxTrajectoryRow;
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

async function currentSessionEventCount(trajectory: SandboxTrajectoryRow) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM specialist_sandbox_rep_events
      WHERE trajectory_id = $1
        AND session_number = $2`,
    [trajectory.id, trajectory.session_number],
  );
  return Number(result.rows[0]?.count || 0);
}

async function loadCapabilityOccurrences(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const result = await pool.query(
    `SELECT capability_id, evidence_class, phase, set_id, rep_number,
            trajectory_id, session_number, id, reason
       FROM specialist_sandbox_capability_evidence
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
      ORDER BY created_at ASC, id ASC`,
    [input.tutorAssignmentId, input.tutorId],
  );
  return result.rows.map((row) => ({
    capabilityId: String(row.capability_id) as SandboxSpecialistCapabilityId,
    evidenceClass: String(row.evidence_class) as SandboxCapabilityOccurrence["evidenceClass"],
    phase: String(row.phase) as TopicPhase,
    setId: String(row.set_id),
    repNumber: Number(row.rep_number),
    trajectoryId: String(row.trajectory_id),
    sessionNumber: Number(row.session_number),
    eventId: String(row.id),
    reason: String(row.reason),
  })) satisfies SandboxCapabilityOccurrence[];
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
      phasesRepresented: [] as TopicPhase[],
      longitudinalTrajectoryEstablished: false,
      layers: [],
      reason: "The active Sandbox environment bank does not yet have a capability policy.",
    };
  }
  const occurrences = await loadCapabilityOccurrences(input);
  return {
    policyAvailable: true as const,
    ...evaluateSandboxCapabilityReadiness(input.bank.capabilityPolicy, occurrences),
  };
}

async function recentOutcomeKeys(trajectory: SandboxTrajectoryRow) {
  const result = await pool.query(
    `SELECT o.outcome_key
       FROM specialist_sandbox_rep_events e
       JOIN private.specialist_sandbox_rep_outcomes o
         ON o.public_ref = e.outcome_ref
      WHERE e.trajectory_id = $1
      ORDER BY e.event_sequence DESC
      LIMIT 3`,
    [trajectory.id],
  );
  return result.rows.map((row) => String(row.outcome_key));
}

function validatePrivateOutcomeAgainstRegistry(outcome: SandboxOutcomeDefinition) {
  validateSandboxOutcomeDefinition(outcome);
  const schema = getDrillSchemaDefinition("training", outcome.phase);
  const set = schema.sets.find((candidate) => candidate.setId === outcome.setId);
  if (!set || set.modelingOnly || outcome.repNumber > set.reps) {
    throw new Error(`Private Sandbox outcome ${outcome.outcomeKey} points to an invalid training rep.`);
  }
  for (const baseField of set.fields) {
    const field = getFieldDefinitionForRep(set, outcome.repNumber - 1, baseField.fieldKey) || baseField;
    const canonical = outcome.canonicalObservations[field.fieldKey];
    if (!canonical?.optionId) {
      throw new Error(`Private Sandbox outcome ${outcome.outcomeKey} is missing ${field.fieldKey}.`);
    }
    const resolved = resolveEvidenceSelection({
      mode: "training",
      phase: outcome.phase,
      setId: outcome.setId,
      repIndex: outcome.repNumber - 1,
      fieldKey: field.fieldKey,
      optionId: canonical.optionId,
      schemaVersion: schema.schemaVersion,
    });
    if (!resolved) {
      throw new Error(`Private Sandbox outcome ${outcome.outcomeKey} has an invalid canonical option.`);
    }
  }
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
  return result.rows.map((row) => {
    const definition = (
      typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition
    ) as SandboxOutcomeDefinition;
    validatePrivateOutcomeAgainstRegistry(definition);
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
        return { optionId: identity.optionId, label };
      }),
    };
  });
}

async function planNextRep(input: {
  trajectory: SandboxTrajectoryRow;
  bank: SandboxEnvironmentBank;
  tutorAssignmentId: string;
  tutorId: string;
}) {
  if (input.trajectory.canonical_route === "targeted_rediagnosis") {
    return {
      blockedByRoute: true as const,
      targetPhase: input.trajectory.canonical_targeted_rediagnosis_phase,
    };
  }

  const phase = input.trajectory.canonical_phase;
  const plan = flattenedRepPlan(phase);
  const completedInSession = await currentSessionEventCount(input.trajectory);
  const position = plan[completedInSession];
  if (!position) {
    throw httpError(409, "Sandbox session evidence is complete but the session authority has not been resolved.");
  }

  const privateOutcomes = await loadRepOutcomes({
    bank: input.bank,
    phase,
    setId: position.set.setId,
    repNumber: position.repNumber,
  });
  if (!privateOutcomes.length) {
    throw httpError(
      503,
      `No private Sandbox outcomes are available for ${phase} / ${position.set.setId} / rep ${position.repNumber}.`,
    );
  }

  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank: input.bank,
  });
  const recent = await recentOutcomeKeys(input.trajectory);
  const seed = digest(
    [
      "sandbox-outcome-seed-v1",
      input.trajectory.id,
      input.trajectory.session_number,
      completedInSession + 1,
    ].join(":"),
  );
  const selected = selectSandboxOutcome(
    privateOutcomes.map((item) => item.definition),
    {
      trajectoryId: input.trajectory.id,
      seed,
      canonicalPhase: phase,
      canonicalStability: input.trajectory.canonical_stability,
      prescribedPhase: phase,
      setId: position.set.setId,
      repNumber: position.repNumber,
      recentOutcomeKeys: recent,
      capabilityNeeds: readiness.policyAvailable ? sandboxCapabilityNeeds(readiness) : [],
    },
  );
  const selectedRecord = privateOutcomes.find(
    (item) => item.definition.outcomeKey === selected.outcomeKey,
  );
  if (!selectedRecord) throw new Error("Selected Sandbox outcome could not be resolved.");

  const eventSequence = input.trajectory.completed_rep_count + 1;
  const eventFormId = digest(
    [
      "sandbox-rep-form-v1",
      input.trajectory.id,
      input.trajectory.session_number,
      eventSequence,
      selectedRecord.publicRef,
    ].join(":"),
  ).slice(0, 32);

  return {
    blockedByRoute: false as const,
    phase,
    position,
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
  bankKey?: string;
}) {
  await assertSandboxAccess(input);
  const bank = await loadActiveEnvironmentBank(input.bankKey);
  if (!bank) throw httpError(404, "No active stateful Sandbox environment bank is available.");
  const trajectory = await ensureTrajectory({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });
  const planned = await planNextRep({
    trajectory,
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
      trajectoryId: trajectory.id,
      sessionNumber: trajectory.session_number,
      status: "targeted_rediagnosis_required" as const,
      prescribedPhase: trajectory.canonical_phase,
      prescribedStability: trajectory.canonical_stability,
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
    trajectoryId: trajectory.id,
    sessionNumber: trajectory.session_number,
    status: "rep_ready" as const,
    prescribedPhase: planned.phase,
    prescribedStability: trajectory.canonical_stability,
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
      constraints: { ...planned.position.set.constraints },
      repNumber: planned.position.repNumber,
      studentBehavior: planned.selected.studentBehavior,
      fields: projectRepFields(
        planned.phase,
        planned.position.set,
        planned.position.repNumber,
      ),
      interventionOptions: TRAINING_INTERVENTION_OPTIONS,
    },
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
    readiness,
  };
}

function buildEvidenceRow(input: {
  phase: TopicPhase;
  set: EvidenceSetDefinition;
  repNumber: number;
  observations: SandboxRepSubmission["observations"];
  interventionEvent: TrainingInterventionEvent;
}) {
  const schema = getDrillSchemaDefinition("training", input.phase);
  const repIndex = input.repNumber - 1;
  const row: Record<string, string> = {
    _rep_id: getRepPurposeId(input.set, repIndex),
    _rep_number: String(input.repNumber),
    [TRAINING_INTERVENTION_FIELD]: input.interventionEvent,
  };

  for (const baseField of input.set.fields) {
    const field = getFieldDefinitionForRep(input.set, repIndex, baseField.fieldKey) || baseField;
    const submitted = input.observations[field.fieldKey];
    if (!submitted?.optionId) {
      throw httpError(400, `Sandbox rep is missing ${field.fieldKey}.`);
    }
    const resolved = resolveEvidenceSelection({
      mode: "training",
      phase: input.phase,
      setId: input.set.setId,
      repIndex,
      fieldKey: field.fieldKey,
      optionId: submitted.optionId,
      schemaVersion: schema.schemaVersion,
    });
    if (!resolved) throw httpError(400, "Sandbox rep contains an invalid evidence option.");
    const rawOption = resolved.field.optionLabels?.[resolved.optionIndex];
    if (!rawOption) throw new Error("Sandbox evidence option has no registered raw label.");

    row[field.fieldKey] = rawOption;
    row[`${field.fieldKey}_option_id`] = submitted.optionId;
    row[`${field.fieldKey}_dimension_id`] = resolved.field.dimensionId;
    row[`${field.fieldKey}_level`] = resolved.level;
    if (resolved.evidenceClass) {
      row[`${field.fieldKey}_evidence_class`] = resolved.evidenceClass;
    }
    row[trainingEvidenceStatusKey(field.fieldKey)] =
      normalizeEvidenceStatus(submitted.evidenceStatus);
  }
  return row;
}

function sessionEvidenceSets(input: {
  phase: TopicPhase;
  events: Array<{
    setId: string;
    repNumber: number;
    specialistSubmission: SandboxRepSubmission;
    canonicalDefinition: SandboxOutcomeDefinition;
  }>;
  source: "specialist" | "canonical";
}): SubmittedEvidenceSet[] {
  const schema = getDrillSchemaDefinition("training", input.phase);
  return schema.sets.map((set, setIndex) => {
    if (set.modelingOnly) {
      return {
        setName: set.setName,
        setId: set.setId,
        setOrder: setIndex + 1,
        drillSchemaId: schema.schemaId,
        drillSchemaVersion: schema.schemaVersion,
        drillDefinitionHash: schema.definitionHash,
        constraintProfile: { ...set.constraints },
        observations: [],
      };
    }

    const events = input.events
      .filter((event) => event.setId === set.setId)
      .sort((a, b) => a.repNumber - b.repNumber);
    if (events.length !== set.reps) {
      throw httpError(409, `Sandbox session is missing evidence for ${set.setName}.`);
    }

    const observations = events.map((event) => {
      const source =
        input.source === "canonical"
          ? {
              interventionEvent: "none" as TrainingInterventionEvent,
              observations: event.canonicalDefinition.canonicalObservations,
            }
          : event.specialistSubmission;
      return buildEvidenceRow({
        phase: input.phase,
        set,
        repNumber: event.repNumber,
        observations: source.observations,
        interventionEvent: source.interventionEvent,
      });
    });

    return {
      setName: set.setName,
      setId: set.setId,
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: { ...set.constraints },
      observations,
    };
  });
}

function asAuthorityOutcome(
  route: ReturnType<typeof resolveTrainingEvidenceAuthorityRoute>,
): SandboxStateAuthorityOutcome {
  return {
    route: route.route,
    nextPhase: route.nextPhase,
    nextStability: route.nextStability,
    targetPhase: route.targetPhase,
    reason: route.reason,
  };
}

function authoritiesAligned(
  a: SandboxStateAuthorityOutcome,
  b: SandboxStateAuthorityOutcome,
) {
  return (
    a.route === b.route &&
    a.nextPhase === b.nextPhase &&
    a.nextStability === b.nextStability &&
    a.targetPhase === b.targetPhase
  );
}

async function loadCurrentSessionEvidence(trajectory: SandboxTrajectoryRow) {
  const result = await pool.query(
    `SELECT e.set_id, e.rep_number, e.specialist_submission,
            o.definition
       FROM specialist_sandbox_rep_events e
       JOIN private.specialist_sandbox_rep_outcomes o
         ON o.public_ref = e.outcome_ref
      WHERE e.trajectory_id = $1
        AND e.session_number = $2
      ORDER BY e.event_sequence ASC`,
    [trajectory.id, trajectory.session_number],
  );
  return result.rows.map((row) => ({
    setId: String(row.set_id),
    repNumber: Number(row.rep_number),
    specialistSubmission: (
      typeof row.specialist_submission === "string"
        ? JSON.parse(row.specialist_submission)
        : row.specialist_submission
    ) as SandboxRepSubmission,
    canonicalDefinition: (
      typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition
    ) as SandboxOutcomeDefinition,
  }));
}

async function insertCapabilityOccurrences(input: {
  tutorAssignmentId: string;
  tutorId: string;
  occurrences: SandboxCapabilityOccurrence[];
  sourceEventId?: string | null;
}) {
  for (const occurrence of input.occurrences) {
    await pool.query(
      `INSERT INTO specialist_sandbox_capability_evidence (
         trajectory_id, tutor_assignment_id, tutor_id, capability_id,
         evidence_class, phase, set_id, rep_number, session_number,
         source_event_id, reason, student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,'sandbox')`,
      [
        occurrence.trajectoryId,
        input.tutorAssignmentId,
        input.tutorId,
        occurrence.capabilityId,
        occurrence.evidenceClass,
        occurrence.phase,
        occurrence.setId,
        occurrence.repNumber,
        occurrence.sessionNumber,
        input.sourceEventId || null,
        occurrence.reason,
      ],
    );
  }
}

export async function submitSandboxEnvironmentRep(input: {
  tutorAssignmentId: string;
  tutorId: string;
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
  const trajectoryResult = await pool.query(
    `SELECT *
       FROM specialist_sandbox_trajectories
      WHERE id = $1
        AND tutor_assignment_id = $2
        AND tutor_id = $3
        AND bank_key = $4
        AND bank_version = $5
        AND status = 'active'
      LIMIT 1`,
    [
      input.trajectoryId,
      input.tutorAssignmentId,
      input.tutorId,
      bank.bankKey,
      bank.bankVersion,
    ],
  );
  const trajectory = trajectoryResult.rows[0] as SandboxTrajectoryRow | undefined;
  if (!trajectory) throw httpError(409, "Active Sandbox trajectory not found.");

  const planned = await planNextRep({
    trajectory,
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

  let exactObservationCount = 0;
  let evidenceStatusExact = true;
  for (const field of fields) {
    const canonical = planned.selected.canonicalObservations[field.fieldKey];
    const submitted = input.submission.observations[field.fieldKey];
    const canonicalStatus = normalizeEvidenceStatus(canonical?.evidenceStatus);
    const submittedStatus = normalizeEvidenceStatus(submitted?.evidenceStatus);
    const exact =
      canonicalStatus === "observed"
        ? submittedStatus === "observed" && submitted.optionId === canonical?.optionId
        : submittedStatus === canonicalStatus;
    if (exact) exactObservationCount += 1;
    if (submittedStatus !== canonicalStatus) evidenceStatusExact = false;
  }
  const conditionKept = sandboxInterventionPreservesCondition(
    planned.position.set.constraints as EvidenceConstraintProfile,
    input.submission.interventionEvent,
  );

  const inserted = await pool.query(
    `INSERT INTO specialist_sandbox_rep_events (
       trajectory_id, tutor_assignment_id, tutor_id, event_sequence,
       session_number, phase, set_id, rep_number, outcome_ref,
       selection_seed_digest, specialist_submission, condition_kept,
       exact_observation_count, comparable_observation_count,
       evidence_status_exact, intervention_event_exact,
       student_state_authoritative, evidence_scope
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,NULL,false,'sandbox')
     RETURNING id, completed_at`,
    [
      trajectory.id,
      input.tutorAssignmentId,
      input.tutorId,
      planned.eventSequence,
      trajectory.session_number,
      planned.phase,
      planned.position.set.setId,
      planned.position.repNumber,
      planned.selectedRecord.publicRef,
      digest(
        [
          trajectory.id,
          trajectory.session_number,
          planned.eventSequence,
          planned.selectedRecord.publicRef,
        ].join(":"),
      ),
      JSON.stringify(input.submission),
      conditionKept,
      exactObservationCount,
      fields.length,
      evidenceStatusExact,
    ],
  );
  const eventId = String(inserted.rows[0]?.id || "");

  const repOccurrences = deriveSandboxCapabilityOccurrences({
    trajectoryId: trajectory.id,
    phase: planned.phase,
    setId: planned.position.set.setId,
    repNumber: planned.position.repNumber,
    sessionNumber: trajectory.session_number,
    eventId,
    conditionKept,
    exactObservationCount,
    comparableObservationCount: fields.length,
    evidenceStatusExact,
    interventionEventExact: null,
    systemOutcomeMatched: null,
    stateTrackAligned: null,
  });
  await insertCapabilityOccurrences({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    occurrences: repOccurrences,
    sourceEventId: eventId,
  });

  await pool.query(
    `UPDATE specialist_sandbox_trajectories
        SET completed_rep_count = completed_rep_count + 1,
            updated_at = now()
      WHERE id = $1`,
    [trajectory.id],
  );

  const sessionCompleted = planned.completedInSession + 1 === planned.totalRepsInSession;
  let sessionAuthority: {
    canonical: SandboxStateAuthorityOutcome;
    specialist: SandboxStateAuthorityOutcome;
    aligned: boolean;
    stateTrackAligned: boolean;
  } | null = null;

  if (sessionCompleted) {
    const events = await loadCurrentSessionEvidence(trajectory);
    const canonicalEvaluation = evaluateTrainingEvidence({
      phase: planned.phase,
      previousStability: trajectory.canonical_stability,
      sets: sessionEvidenceSets({
        phase: planned.phase,
        events,
        source: "canonical",
      }),
    });
    const specialistEvaluation = evaluateTrainingEvidence({
      phase: planned.phase,
      previousStability: trajectory.specialist_stability,
      sets: sessionEvidenceSets({
        phase: planned.phase,
        events,
        source: "specialist",
      }),
    });
    if (canonicalEvaluation.status !== "evaluated" || specialistEvaluation.status !== "evaluated") {
      throw httpError(409, "Sandbox session evidence could not be resolved through RI authority.");
    }

    const canonical = asAuthorityOutcome(
      resolveTrainingEvidenceAuthorityRoute(canonicalEvaluation),
    );
    const specialist = asAuthorityOutcome(
      resolveTrainingEvidenceAuthorityRoute(specialistEvaluation),
    );
    const aligned = authoritiesAligned(canonical, specialist);
    const stateTrackAligned =
      canonical.nextPhase === specialist.nextPhase &&
      canonical.nextStability === specialist.nextStability &&
      canonical.route === specialist.route &&
      canonical.targetPhase === specialist.targetPhase;

    await pool.query(
      `INSERT INTO specialist_sandbox_session_evaluations (
         trajectory_id, tutor_assignment_id, tutor_id, session_number,
         phase, canonical_authority, specialist_authority,
         authority_aligned, state_track_aligned,
         student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,false,'sandbox')`,
      [
        trajectory.id,
        input.tutorAssignmentId,
        input.tutorId,
        trajectory.session_number,
        planned.phase,
        JSON.stringify(canonical),
        JSON.stringify(specialist),
        aligned,
        stateTrackAligned,
      ],
    );

    await insertCapabilityOccurrences({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
      occurrences: [
        {
          capabilityId: "authority_integrity",
          evidenceClass: aligned ? "supported" : "breakdown",
          phase: planned.phase,
          setId: planned.position.set.setId,
          repNumber: planned.position.repNumber,
          trajectoryId: trajectory.id,
          sessionNumber: trajectory.session_number,
          eventId,
          reason: aligned
            ? "The completed session preserved the canonical RI authority outcome."
            : "The completed session drove RI authority away from canonical simulated truth.",
        },
        {
          capabilityId: "continuity_integrity",
          evidenceClass: stateTrackAligned ? "supported" : "breakdown",
          phase: planned.phase,
          setId: planned.position.set.setId,
          repNumber: planned.position.repNumber,
          trajectoryId: trajectory.id,
          sessionNumber: trajectory.session_number,
          eventId,
          reason: stateTrackAligned
            ? "Canonical and Specialist-recorded RI state remained aligned after the session."
            : "The Specialist-recorded RI state diverged from the canonical simulated student trajectory.",
        },
      ],
      sourceEventId: eventId,
    });

    await pool.query(
      `UPDATE specialist_sandbox_trajectories
          SET canonical_phase = $2,
              canonical_stability = $3,
              specialist_phase = $4,
              specialist_stability = $5,
              canonical_route = $6,
              specialist_route = $7,
              canonical_targeted_rediagnosis_phase = $8,
              specialist_targeted_rediagnosis_phase = $9,
              divergence_active = $10,
              session_number = session_number + 1,
              updated_at = now()
        WHERE id = $1`,
      [
        trajectory.id,
        canonical.nextPhase,
        canonical.nextStability,
        specialist.nextPhase,
        specialist.nextStability,
        canonical.route,
        specialist.route,
        canonical.targetPhase,
        specialist.targetPhase,
        !stateTrackAligned,
      ],
    );

    sessionAuthority = { canonical, specialist, aligned, stateTrackAligned };
  }

  const readiness = await readinessFor({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });

  return {
    eventId,
    completedAt: inserted.rows[0]?.completed_at,
    eventSequence: planned.eventSequence,
    sessionNumber: trajectory.session_number,
    phase: planned.phase,
    setId: planned.position.set.setId,
    repNumber: planned.position.repNumber,
    exactObservationCount,
    comparableObservationCount: fields.length,
    conditionKept,
    evidenceStatusExact,
    sessionCompleted,
    sessionAuthority: sessionAuthority
      ? {
          specialist: sessionAuthority.specialist,
          authorityAligned: sessionAuthority.aligned,
          stateTrackAligned: sessionAuthority.stateTrackAligned,
        }
      : null,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
    readiness,
  };
}

export async function getSandboxEnvironmentHistory(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertSandboxAccess(input);
  const bank = await loadActiveEnvironmentBank();
  if (!bank) throw httpError(404, "No active stateful Sandbox environment bank is available.");
  const trajectory = await ensureTrajectory({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    bank,
  });
  const [events, sessions, readiness] = await Promise.all([
    pool.query(
      `SELECT id, event_sequence, session_number, phase, set_id, rep_number,
              condition_kept, exact_observation_count, comparable_observation_count,
              evidence_status_exact, completed_at
         FROM specialist_sandbox_rep_events
        WHERE trajectory_id = $1
        ORDER BY event_sequence DESC
        LIMIT 30`,
      [trajectory.id],
    ),
    pool.query(
      `SELECT id, session_number, phase, authority_aligned, state_track_aligned, completed_at
         FROM specialist_sandbox_session_evaluations
        WHERE trajectory_id = $1
        ORDER BY session_number DESC
        LIMIT 12`,
      [trajectory.id],
    ),
    readinessFor({
      tutorAssignmentId: input.tutorAssignmentId,
      tutorId: input.tutorId,
      bank,
    }),
  ]);

  return {
    trajectory: {
      id: trajectory.id,
      sessionNumber: trajectory.session_number,
      prescribedPhase: trajectory.canonical_phase,
      prescribedStability: trajectory.canonical_stability,
      divergenceActive: trajectory.divergence_active,
      route: trajectory.canonical_route,
      targetPhase: trajectory.canonical_targeted_rediagnosis_phase,
      completedRepCount: trajectory.completed_rep_count,
    },
    events: events.rows.map((row) => ({
      id: String(row.id),
      eventSequence: Number(row.event_sequence),
      sessionNumber: Number(row.session_number),
      phase: String(row.phase),
      setId: String(row.set_id),
      repNumber: Number(row.rep_number),
      conditionKept: row.condition_kept === null ? null : Boolean(row.condition_kept),
      exactObservationCount: Number(row.exact_observation_count),
      comparableObservationCount: Number(row.comparable_observation_count),
      evidenceStatusExact:
        row.evidence_status_exact === null ? null : Boolean(row.evidence_status_exact),
      completedAt: row.completed_at,
    })),
    sessions: sessions.rows.map((row) => ({
      id: String(row.id),
      sessionNumber: Number(row.session_number),
      phase: String(row.phase),
      authorityAligned: Boolean(row.authority_aligned),
      stateTrackAligned: Boolean(row.state_track_aligned),
      completedAt: row.completed_at,
    })),
    readiness,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}
