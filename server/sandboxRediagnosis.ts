import { createHmac } from "crypto";
import { pool } from "./db";
import {
  DIAGNOSIS_PROBES,
  evaluateEvidenceCompleteDiagnosis,
  type DiagnosisProbeId,
  type DiagnosisProbeResult,
  type DiagnosisSupportEvent,
} from "@shared/evidenceCompleteDiagnosis";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
} from "@shared/diagnosisObservationMatrix";
import {
  buildSandboxDiagnosisProbeResult,
  compareSandboxDiagnosisDecisions,
  compareSandboxDiagnosisProbe,
  rebuildSandboxDiagnosisState,
  SANDBOX_DIAGNOSIS_SUPPORT_EVENTS,
  selectSandboxDiagnosisOutcome,
  validateSandboxDiagnosisOutcomeDefinition,
  type SandboxDiagnosisOutcomeDefinition,
  type SandboxDiagnosisSubmittedProbe,
} from "@shared/sandboxDiagnosisEnvironment";
import type {
  SandboxCapabilityOccurrence,
} from "@shared/sandboxEnvironment";
import type { TopicPhase, TopicStability } from "@shared/topicConditioningEngine";
import { getSandboxEnvironmentHistory } from "./sandboxEnvironment";

const BANK_KEY = "sandbox_stateful_environment";

type TrajectoryRow = {
  id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  bank_key: string;
  bank_version: number;
  specialist_phase: TopicPhase;
  specialist_stability: TopicStability;
  specialist_route: "normal_training" | "targeted_rediagnosis";
  specialist_targeted_rediagnosis_phase: TopicPhase | null;
  session_number: number;
  completed_rep_count: number;
  divergence_active: boolean;
};

type TrajectoryTruthRow = {
  canonical_phase: TopicPhase;
  canonical_stability: TopicStability;
  canonical_route: "normal_training" | "targeted_rediagnosis";
  canonical_targeted_rediagnosis_phase: TopicPhase | null;
  trajectory_seed: string;
};

type RediagnosisRunRow = {
  id: string;
  trajectory_id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  started_session_number: number;
  target_phase: TopicPhase;
  specialist_probe_history: DiagnosisProbeResult[];
  specialist_decision: unknown;
  status: "active" | "completed" | "blocked";
};

type RediagnosisTruthRow = {
  rediagnosis_run_id: string;
  canonical_probe_history: DiagnosisProbeResult[];
  canonical_decision: unknown;
  recent_outcome_keys: string[];
};

type DiagnosisOutcomeRecord = {
  publicRef: string;
  definition: SandboxDiagnosisOutcomeDefinition;
};

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function secret() {
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
        .update("ri-sandbox-rediagnosis-secret-v1")
        .digest("hex");
    }
  }
  throw httpError(503, "Sandbox re-diagnosis secret is not configured.");
}

const digest = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("hex");

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
  if (!row) throw httpError(403, "Specialist assignment not found.");
  if (String(row.operational_mode || "").toLowerCase() !== "sandbox") {
    throw httpError(409, "Targeted re-diagnosis is available only in Sandbox.");
  }
}

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return [];
};

async function loadTrajectory(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const result = await pool.query(
    `SELECT t.*, truth.canonical_phase, truth.canonical_stability,
            truth.canonical_route, truth.canonical_targeted_rediagnosis_phase,
            truth.trajectory_seed
       FROM specialist_sandbox_trajectories t
       JOIN private.specialist_sandbox_trajectory_truth truth
         ON truth.trajectory_id = t.id
      WHERE t.tutor_assignment_id = $1
        AND t.tutor_id = $2
        AND t.bank_key = $3
        AND t.status = 'active'
      ORDER BY t.created_at DESC
      LIMIT 1`,
    [input.tutorAssignmentId, input.tutorId, BANK_KEY],
  );
  const row = result.rows[0];
  if (!row) throw httpError(409, "No active Sandbox trajectory is available.");
  return {
    trajectory: row as TrajectoryRow,
    truth: {
      canonical_phase: String(row.canonical_phase) as TopicPhase,
      canonical_stability: String(row.canonical_stability) as TopicStability,
      canonical_route: String(row.canonical_route) as TrajectoryTruthRow["canonical_route"],
      canonical_targeted_rediagnosis_phase: row.canonical_targeted_rediagnosis_phase
        ? String(row.canonical_targeted_rediagnosis_phase) as TopicPhase
        : null,
      trajectory_seed: String(row.trajectory_seed),
    } satisfies TrajectoryTruthRow,
  };
}

async function ensureRediagnosisRun(input: {
  trajectory: TrajectoryRow;
  truth: TrajectoryTruthRow;
}) {
  if (
    input.truth.canonical_route !== "targeted_rediagnosis" ||
    !input.truth.canonical_targeted_rediagnosis_phase
  ) {
    throw httpError(409, "The Sandbox trajectory does not currently require targeted re-diagnosis.");
  }

  const existing = await pool.query(
    `SELECT r.*, truth.canonical_probe_history, truth.canonical_decision,
            truth.recent_outcome_keys
       FROM specialist_sandbox_rediagnosis_runs r
       JOIN private.specialist_sandbox_rediagnosis_truth truth
         ON truth.rediagnosis_run_id = r.id
      WHERE r.trajectory_id = $1
        AND r.status = 'active'
      LIMIT 1`,
    [input.trajectory.id],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    return {
      run: {
        ...row,
        specialist_probe_history: asArray<DiagnosisProbeResult>(row.specialist_probe_history),
      } as RediagnosisRunRow,
      truth: {
        rediagnosis_run_id: String(row.id),
        canonical_probe_history: asArray<DiagnosisProbeResult>(row.canonical_probe_history),
        canonical_decision: row.canonical_decision,
        recent_outcome_keys: asArray<string>(row.recent_outcome_keys),
      } satisfies RediagnosisTruthRow,
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO specialist_sandbox_rediagnosis_runs (
         trajectory_id, tutor_assignment_id, tutor_id, started_session_number,
         target_phase, specialist_probe_history, status
       ) VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,'active')
       RETURNING *`,
      [
        input.trajectory.id,
        input.trajectory.tutor_assignment_id,
        input.trajectory.tutor_id,
        input.trajectory.session_number,
        input.truth.canonical_targeted_rediagnosis_phase,
      ],
    );
    const run = created.rows[0] as RediagnosisRunRow;
    await client.query(
      `INSERT INTO private.specialist_sandbox_rediagnosis_truth (
         rediagnosis_run_id, canonical_probe_history, recent_outcome_keys
       ) VALUES ($1,'[]'::jsonb,'[]'::jsonb)`,
      [run.id],
    );
    await client.query("COMMIT");
    return {
      run: {
        ...run,
        specialist_probe_history: [],
      },
      truth: {
        rediagnosis_run_id: run.id,
        canonical_probe_history: [],
        canonical_decision: null,
        recent_outcome_keys: [],
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadDiagnosisOutcomes(input: {
  bankVersion: number;
  probeId: DiagnosisProbeId;
}) {
  const result = await pool.query(
    `SELECT public_ref, definition
       FROM private.specialist_sandbox_diagnosis_outcomes
      WHERE bank_key = $1
        AND bank_version = $2
        AND probe_id = $3
        AND active = true
      ORDER BY outcome_key ASC`,
    [BANK_KEY, input.bankVersion, input.probeId],
  );
  if (result.rows.length < 6 || result.rows.length > 10) {
    throw httpError(
      503,
      `Sandbox targeted diagnosis has ${result.rows.length} outcomes for ${input.probeId}; expected 6-10.`,
    );
  }
  return result.rows.map((row) => {
    const definition = (
      typeof row.definition === "string" ? JSON.parse(row.definition) : row.definition
    ) as SandboxDiagnosisOutcomeDefinition;
    validateSandboxDiagnosisOutcomeDefinition(definition);
    return {
      publicRef: String(row.public_ref),
      definition,
    } satisfies DiagnosisOutcomeRecord;
  });
}

async function insertCapabilityEvidence(input: {
  trajectory: TrajectoryRow;
  sourceType: "turn" | "session";
  sourceId: string;
  occurrences: SandboxCapabilityOccurrence[];
}) {
  for (const occurrence of input.occurrences) {
    await pool.query(
      `INSERT INTO specialist_sandbox_capability_evidence (
         trajectory_id, tutor_assignment_id, tutor_id, capability_id,
         evidence_class, source_type, source_id, phase, set_id, rep_number,
         sequence_number, session_number, reason,
         student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,'sandbox')
       ON CONFLICT DO NOTHING`,
      [
        input.trajectory.id,
        input.trajectory.tutor_assignment_id,
        input.trajectory.tutor_id,
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

async function plan(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  const { trajectory, truth } = await loadTrajectory(input);
  const { run, truth: diagnosisTruth } = await ensureRediagnosisRun({ trajectory, truth });

  const canonicalState = rebuildSandboxDiagnosisState({
    startingPhase: run.target_phase,
    history: diagnosisTruth.canonical_probe_history,
  });
  const specialistState = rebuildSandboxDiagnosisState({
    startingPhase: run.target_phase,
    history: run.specialist_probe_history,
  });
  const canonicalDecision = evaluateEvidenceCompleteDiagnosis(canonicalState);

  if (canonicalDecision.complete) {
    throw httpError(409, "Targeted re-diagnosis is already complete.");
  }
  if (!canonicalDecision.nextProbeId) {
    return {
      trajectory,
      truth,
      run,
      diagnosisTruth,
      canonicalState,
      specialistState,
      canonicalDecision,
      blocked: true as const,
    };
  }

  const outcomes = await loadDiagnosisOutcomes({
    bankVersion: trajectory.bank_version,
    probeId: canonicalDecision.nextProbeId,
  });
  const history = await getSandboxEnvironmentHistory(input);
  const selected = selectSandboxDiagnosisOutcome({
    seed: truth.trajectory_seed,
    outcomes: outcomes.map((item) => item.definition),
    context: {
      startingPhase: run.target_phase,
      probeId: canonicalDecision.nextProbeId,
      sequenceNumber: diagnosisTruth.canonical_probe_history.length + 1,
      earliestUnsupportedCapability:
        history.readiness.policyAvailable
          ? history.readiness.earliestUnsupportedCapability
          : null,
      recentOutcomeKeys: diagnosisTruth.recent_outcome_keys,
    },
  });
  const selectedRecord = outcomes.find(
    (item) => item.definition.key === selected.key && item.definition.version === selected.version,
  );
  if (!selectedRecord) throw new Error("Selected diagnosis outcome could not be resolved.");

  const sequenceNumber = diagnosisTruth.canonical_probe_history.length + 1;
  const turnFormId = digest(
    [
      "sandbox-rediagnosis-turn-v1",
      run.id,
      sequenceNumber,
      selectedRecord.publicRef,
    ].join(":"),
  ).slice(0, 32);

  return {
    trajectory,
    truth,
    run,
    diagnosisTruth,
    canonicalState,
    specialistState,
    canonicalDecision,
    blocked: false as const,
    selected,
    selectedRecord,
    sequenceNumber,
    turnFormId,
  };
}

function projectProbe(probeId: DiagnosisProbeId) {
  const probe = DIAGNOSIS_PROBES[probeId];
  return {
    probeId,
    label: probe.label,
    primaryPhase: probe.primaryPhase,
    evidenceQuestion: probe.evidenceQuestion,
    specialistInstruction: probe.specialistInstruction,
    constraints: { ...probe.constraints },
    fields: probe.dimensions.map((dimensionId) => {
      const dimension = DIAGNOSIS_OBSERVATION_MATRIX[dimensionId];
      return {
        dimensionId,
        label: dimension.label,
        observationQuestion: dimension.observationQuestion,
        options: dimension.options.map((option) => ({
          behaviorId: option.id,
          label: option.label,
          detail: option.detail,
        })),
      };
    }),
    supportOptions: SANDBOX_DIAGNOSIS_SUPPORT_EVENTS,
  };
}

export async function prepareSandboxRediagnosis(input: {
  tutorAssignmentId: string;
  tutorId: string;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (planned.blocked) {
    return {
      status: "rediagnosis_blocked" as const,
      trajectoryId: planned.trajectory.id,
      rediagnosisRunId: planned.run.id,
      targetPhase: planned.run.target_phase,
      reason: "The permitted clean targeted probes did not resolve placement. Sandbox Training remains paused for evidence review.",
      studentStateAuthoritative: false as const,
      evidenceScope: "sandbox" as const,
    };
  }

  return {
    status: "rediagnosis_probe_ready" as const,
    trajectoryId: planned.trajectory.id,
    rediagnosisRunId: planned.run.id,
    bankVersion: planned.trajectory.bank_version,
    sessionNumber: planned.trajectory.session_number,
    targetPhase: planned.run.target_phase,
    sequenceNumber: planned.sequenceNumber,
    turnFormId: planned.turnFormId,
    probe: {
      ...projectProbe(planned.canonicalDecision.nextProbeId!),
      studentBehavior: planned.selected.studentBehavior,
    },
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}

export async function submitSandboxRediagnosisProbe(input: {
  tutorAssignmentId: string;
  tutorId: string;
  trajectoryId: string;
  rediagnosisRunId: string;
  bankVersion: number;
  sequenceNumber: number;
  turnFormId: string;
  submission: SandboxDiagnosisSubmittedProbe;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (planned.blocked) throw httpError(409, planned.canonicalDecision.reason);
  if (
    planned.trajectory.id !== input.trajectoryId ||
    planned.run.id !== input.rediagnosisRunId ||
    planned.trajectory.bank_version !== input.bankVersion ||
    planned.sequenceNumber !== input.sequenceNumber ||
    planned.turnFormId !== input.turnFormId
  ) {
    throw httpError(409, "Sandbox targeted re-diagnosis probe is stale.");
  }
  if (input.submission.probeId !== planned.canonicalDecision.nextProbeId) {
    throw httpError(400, "Submitted diagnosis probe does not match the prescribed RI probe.");
  }

  const probe = DIAGNOSIS_PROBES[input.submission.probeId];
  const submittedDimensions = new Set(
    input.submission.observations.map((item) => item.dimensionId),
  );
  if (
    submittedDimensions.size !== probe.dimensions.length ||
    probe.dimensions.some((dimensionId) => !submittedDimensions.has(dimensionId))
  ) {
    throw httpError(400, "Sandbox targeted diagnosis must record every prescribed behavior dimension.");
  }

  const timingBaselineSeconds =
    planned.canonicalDecision.timingBaseline.baselineSeconds || null;
  const canonicalResult = buildSandboxDiagnosisProbeResult({
    outcome: planned.selected,
    observations: planned.selected.canonicalObservations,
    supportEvent: input.submission.supportEvent,
    sequenceNumber: planned.sequenceNumber,
    timingBaselineSeconds,
  });
  const specialistResult = buildSandboxDiagnosisProbeResult({
    outcome: planned.selected,
    observations: input.submission.observations,
    supportEvent: input.submission.supportEvent,
    sequenceNumber: planned.sequenceNumber,
    timingBaselineSeconds,
  });

  const probeComparison = compareSandboxDiagnosisProbe({
    sequenceNumber: planned.sequenceNumber,
    sessionNumber: planned.trajectory.session_number,
    phase: planned.run.target_phase,
    outcome: planned.selected,
    submitted: input.submission,
  });

  const canonicalHistory = [
    ...planned.diagnosisTruth.canonical_probe_history,
    canonicalResult,
  ];
  const specialistHistory = [
    ...planned.run.specialist_probe_history,
    specialistResult,
  ];
  const canonicalState = rebuildSandboxDiagnosisState({
    startingPhase: planned.run.target_phase,
    history: canonicalHistory,
  });
  const specialistState = rebuildSandboxDiagnosisState({
    startingPhase: planned.run.target_phase,
    history: specialistHistory,
  });
  const decisionComparison = compareSandboxDiagnosisDecisions({
    canonicalState,
    specialistState,
    sequenceNumber: planned.sequenceNumber,
    sessionNumber: planned.trajectory.session_number,
    phase: planned.run.target_phase,
    probeId: input.submission.probeId,
  });

  const turn = await pool.query(
    `INSERT INTO specialist_sandbox_rediagnosis_turns (
       rediagnosis_run_id, trajectory_id, tutor_assignment_id, tutor_id,
       sequence_number, probe_id, turn_form_id, student_behavior,
       specialist_submission, condition_conformed, total_observations,
       matching_observations, observation_exact, authority_aligned
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)
     RETURNING id, completed_at`,
    [
      planned.run.id,
      planned.trajectory.id,
      input.tutorAssignmentId,
      input.tutorId,
      planned.sequenceNumber,
      input.submission.probeId,
      input.turnFormId,
      planned.selected.studentBehavior,
      JSON.stringify(input.submission),
      probeComparison.conditionConformed,
      probeComparison.totalObservations,
      probeComparison.matchingObservations,
      probeComparison.observationExact,
      decisionComparison.authorityAligned,
    ],
  );
  const turnId = String(turn.rows[0]?.id || "");

  await pool.query(
    `INSERT INTO private.specialist_sandbox_rediagnosis_turn_truth (
       rediagnosis_turn_id, outcome_ref, outcome_key, outcome_version,
       canonical_observations, trajectory_class, simulated_elapsed_seconds
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [
      turnId,
      planned.selectedRecord.publicRef,
      planned.selected.key,
      planned.selected.version,
      JSON.stringify(planned.selected.canonicalObservations),
      planned.selected.trajectoryClass,
      planned.selected.simulatedElapsedSeconds,
    ],
  );

  await insertCapabilityEvidence({
    trajectory: planned.trajectory,
    sourceType: "turn",
    sourceId: turnId,
    occurrences: [
      ...probeComparison.capabilityEvidence,
      ...decisionComparison.capabilityEvidence,
    ],
  });

  const recentOutcomeKeys = [
    ...planned.diagnosisTruth.recent_outcome_keys,
    planned.selected.key,
  ].slice(-3);

  const complete = decisionComparison.canonicalDecision.complete;
  const blocked =
    !complete && !decisionComparison.canonicalDecision.nextProbeId;

  await Promise.all([
    pool.query(
      `UPDATE specialist_sandbox_rediagnosis_runs
          SET specialist_probe_history = $2::jsonb,
              specialist_decision = $3::jsonb,
              status = $4,
              completed_at = CASE WHEN $4 <> 'active' THEN now() ELSE NULL END
        WHERE id = $1`,
      [
        planned.run.id,
        JSON.stringify(specialistHistory),
        JSON.stringify(decisionComparison.specialistDecision),
        complete ? "completed" : blocked ? "blocked" : "active",
      ],
    ),
    pool.query(
      `UPDATE private.specialist_sandbox_rediagnosis_truth
          SET canonical_probe_history = $2::jsonb,
              canonical_decision = $3::jsonb,
              recent_outcome_keys = $4::jsonb,
              updated_at = now()
        WHERE rediagnosis_run_id = $1`,
      [
        planned.run.id,
        JSON.stringify(canonicalHistory),
        JSON.stringify(decisionComparison.canonicalDecision),
        JSON.stringify(recentOutcomeKeys),
      ],
    ),
  ]);

  if (complete) {
    const canonicalPhase = decisionComparison.canonicalDecision.placementPhase;
    const canonicalStability = decisionComparison.canonicalDecision.stability;
    if (!canonicalPhase || !canonicalStability) {
      throw new Error("Completed Sandbox re-diagnosis is missing canonical placement.");
    }

    const specialistComplete =
      decisionComparison.specialistDecision.complete &&
      decisionComparison.specialistDecision.placementPhase &&
      decisionComparison.specialistDecision.stability;
    await Promise.all([
      pool.query(
        `UPDATE private.specialist_sandbox_trajectory_truth
            SET canonical_phase = $2,
                canonical_stability = $3,
                canonical_route = 'normal_training',
                canonical_targeted_rediagnosis_phase = NULL,
                prior_tracks_diverged = $4,
                updated_at = now()
          WHERE trajectory_id = $1`,
        [
          planned.trajectory.id,
          canonicalPhase,
          canonicalStability,
          !decisionComparison.placementAligned,
        ],
      ),
      pool.query(
        `UPDATE specialist_sandbox_trajectories
            SET specialist_phase = CASE WHEN $2 THEN $3 ELSE specialist_phase END,
                specialist_stability = CASE WHEN $2 THEN $4 ELSE specialist_stability END,
                specialist_route = 'normal_training',
                specialist_targeted_rediagnosis_phase = NULL,
                divergence_active = $5,
                updated_at = now()
          WHERE id = $1`,
        [
          planned.trajectory.id,
          Boolean(specialistComplete),
          decisionComparison.specialistDecision.placementPhase,
          decisionComparison.specialistDecision.stability,
          !decisionComparison.placementAligned,
        ],
      ),
    ]);
  }

  const history = await getSandboxEnvironmentHistory(input);
  return {
    turnId,
    completedAt: turn.rows[0]?.completed_at,
    sequenceNumber: planned.sequenceNumber,
    probeId: input.submission.probeId,
    matchingObservations: probeComparison.matchingObservations,
    totalObservations: probeComparison.totalObservations,
    observationExact: probeComparison.observationExact,
    conditionConformed: probeComparison.conditionConformed,
    authorityAligned: decisionComparison.authorityAligned,
    diagnosisComplete: complete,
    blocked,
    specialistPlacement:
      decisionComparison.specialistDecision.complete
        ? {
            phase: decisionComparison.specialistDecision.placementPhase,
            stability: decisionComparison.specialistDecision.stability,
          }
        : null,
    readiness: history.readiness,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}
