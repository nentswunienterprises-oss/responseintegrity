import { createHmac } from "crypto";
import { diagnosisContinuationContext, diagnosisDecisionWithContext, authorizeDiagnosisContinuation } from "./diagnosisContinuation";
import { pool } from "./db";
import { loadTutorOperationalModeAuthority } from "./tutorOperationalModeAuthority";
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
import {
  deriveTpsTimerContractV1,
  type TpsBaselineSnapshot,
} from "@shared/tpsTimingContract";
import { deriveDiagnosisTpsTimerContract } from "@shared/tpsTimingRuntime";
import {
  loadLatestTpsTimerContract,
  persistTpsTimerContract,
  type PersistedTpsTimerContract,
} from "./tpsTimingAuthority";
import { getSandboxEnvironmentHistory, initializeSandboxNativeEvidenceTrajectory } from "./sandboxEnvironment";
import { resolveSandboxRediagnosisEpisodeRun, canRetireSupersededEmptySandboxEpisode, sandboxRediagnosisSelectionSeed } from "./sandboxRediagnosisEpisode";
import { SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION } from "@shared/sandboxDiagnosisExceptionNarrativesV2";

import { projectSandboxNativeDiagnosisOutcome, SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION } from "./sandboxNativeDiagnosisProjection";

const BANK_KEY = "sandbox_stateful_environment";

async function recordContextPreparationReceipt(input: {
  tutorAssignmentId: string; tutorId: string; trajectoryId: string; studentId: string;
  preparationContext: string; sourceContextId: string; phase: string; topicKey: string;
  sequenceNumber: number; probeId?: string | null; planFingerprint?: string | null;
}) {
  try {
    await pool.query(
      `INSERT INTO public.specialist_sandbox_context_preparation_events
        (tutor_assignment_id,tutor_id,trajectory_id,student_id,preparation_context,
         source_context_id,phase,topic_key,sequence_number,probe_id,plan_fingerprint)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tutor_assignment_id,preparation_context,source_context_id,sequence_number) DO NOTHING`,
      [input.tutorAssignmentId,input.tutorId,input.trajectoryId,input.studentId,
       input.preparationContext,input.sourceContextId,input.phase,input.topicKey,
       input.sequenceNumber,input.probeId || null,input.planFingerprint || null],
    );
  } catch (error: any) {
    if (error?.code === "42P01" || String(error?.message || "").includes("specialist_sandbox_context_preparation_events")) return false;
    throw error;
  }
  return true;
}

type TrajectoryRow = {
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
  active_topic_key: string | null;
  divergence_active: boolean;
};

type TrajectoryTruthRow = {
  canonical_phase: TopicPhase;
  canonical_stability: TopicStability;
  canonical_route: "normal_training" | "targeted_rediagnosis";
  canonical_targeted_rediagnosis_phase: TopicPhase | null;
  trajectory_seed: string;
  behavior_model_version: 1 | 2;
  continuity_tags: string[];
};

type RediagnosisRunRow = {
  id: string;
  trajectory_id: string;
  tutor_assignment_id: string;
  tutor_id: string;
  student_id: string;
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
  studentId: string;
}) {
  const [result, modeAuthority] = await Promise.all([
    pool.query(
      `SELECT ta.id,
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
    throw httpError(409, "Targeted re-diagnosis is available only in Sandbox.");
  }
  if (!row.is_sandbox_account) {
    throw httpError(409, "Targeted re-diagnosis may only run against synthetic Sandbox student accounts.");
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
  studentId: string;
}) {
  const result = await pool.query(
    `SELECT t.*, truth.canonical_phase, truth.canonical_stability,
            truth.canonical_route, truth.canonical_targeted_rediagnosis_phase,
            truth.trajectory_seed, truth.behavior_model_version, truth.continuity_tags
       FROM specialist_sandbox_trajectories t
       JOIN private.specialist_sandbox_trajectory_truth truth
         ON truth.trajectory_id = t.id
      WHERE t.tutor_assignment_id = $1
        AND t.tutor_id = $2
        AND t.student_id = $3
        AND t.bank_key = $4
        AND t.status = 'active'
      ORDER BY t.created_at DESC
      LIMIT 1`,
    [input.tutorAssignmentId, input.tutorId, input.studentId, BANK_KEY],
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
      behavior_model_version: Number(row.behavior_model_version) as 1 | 2,
      continuity_tags: asArray<string>(row.continuity_tags),
    } satisfies TrajectoryTruthRow,
  };
}

async function ensureRediagnosisRun(input: {
  trajectory: TrajectoryRow;
  truth: TrajectoryTruthRow;
  scheduledSessionId?: string | null;
}) {
  const inferredTimingBaselineTarget =
    input.truth.canonical_route === "normal_training" &&
    (input.truth.canonical_phase === "Controlled Discomfort" || input.truth.canonical_phase === "Time Pressure Stability")
      ? "Structured Execution"
      : null;
  const targetPhase = input.truth.canonical_targeted_rediagnosis_phase || inferredTimingBaselineTarget;
  if (
    (input.truth.canonical_route !== "targeted_rediagnosis" && !inferredTimingBaselineTarget) ||
    !targetPhase
  ) {
    throw httpError(409, "The Sandbox trajectory does not currently require targeted re-diagnosis.");
  }

  const loadExisting = (db: Pick<typeof pool, "query">) => db.query(
    `SELECT r.*, truth.canonical_probe_history, truth.canonical_decision,
            truth.recent_outcome_keys
       FROM specialist_sandbox_rediagnosis_runs r
       JOIN private.specialist_sandbox_rediagnosis_truth truth
         ON truth.rediagnosis_run_id = r.id
      WHERE r.trajectory_id = $1
        AND r.started_session_number = $2
        AND r.status IN ('active', 'blocked')
      ORDER BY r.created_at DESC`,
    [input.trajectory.id, input.trajectory.session_number],
  );
  const existing = await loadExisting(pool);
  const episodeRun = resolveSandboxRediagnosisEpisodeRun(existing.rows, input.trajectory.session_number);
  if (episodeRun) {
    const row = episodeRun;
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
    // Serialize creation and recheck after acquiring the trajectory lock: two
    // concurrent runner opens must resume the same episode, not race the index.
    const locked = await client.query(
      `SELECT session_number FROM specialist_sandbox_trajectories
        WHERE id=$1 AND tutor_assignment_id=$2 AND tutor_id=$3 AND student_id=$4 FOR UPDATE`,
      [input.trajectory.id,input.trajectory.tutor_assignment_id,input.trajectory.tutor_id,input.trajectory.student_id],
    );
    if (Number(locked.rows[0]?.session_number) !== input.trajectory.session_number)
      throw httpError(409,"The Sandbox session changed. Reload its prescribed route.");
    const concurrent = resolveSandboxRediagnosisEpisodeRun((await loadExisting(client)).rows,input.trajectory.session_number);
    if (concurrent) {
      await client.query("COMMIT");
      return { run: {...concurrent,specialist_probe_history:asArray<DiagnosisProbeResult>(concurrent.specialist_probe_history)} as RediagnosisRunRow,
        truth:{rediagnosis_run_id:String(concurrent.id),canonical_probe_history:asArray<DiagnosisProbeResult>(concurrent.canonical_probe_history),
          canonical_decision:concurrent.canonical_decision,recent_outcome_keys:asArray<string>(concurrent.recent_outcome_keys)} satisfies RediagnosisTruthRow };
    }
    const priorActive = await client.query(
      `SELECT r.id,r.status,r.started_session_number,
          jsonb_array_length(r.specialist_probe_history) AS specialist_probe_count,
          jsonb_array_length(truth.canonical_probe_history) AS canonical_probe_count,
          (SELECT count(*)::int FROM specialist_sandbox_rediagnosis_turns turn WHERE turn.rediagnosis_run_id=r.id) AS persisted_turn_count,
          EXISTS (SELECT 1 FROM specialist_sandbox_rediagnosis_runs done
            WHERE done.trajectory_id=r.trajectory_id AND done.tutor_assignment_id=r.tutor_assignment_id
              AND done.tutor_id=r.tutor_id AND done.student_id=r.student_id
              AND done.started_session_number=r.started_session_number
              AND done.status='completed' AND done.specialist_decision->>'complete'='true') AS completed_sibling,
          COALESCE(r.specialist_decision->>'complete','false')='true' AS specialist_complete,
          COALESCE(truth.canonical_decision->>'complete','false')='true' AS canonical_complete
       FROM specialist_sandbox_rediagnosis_runs r
       JOIN private.specialist_sandbox_rediagnosis_truth truth ON truth.rediagnosis_run_id=r.id
       WHERE r.trajectory_id=$1 AND r.status='active' FOR UPDATE OF r`,
      [input.trajectory.id],
    );
    for (const prior of priorActive.rows) {
      if (!canRetireSupersededEmptySandboxEpisode(prior,input.trajectory.session_number))
        throw httpError(409,"An earlier re-diagnosis still contains unresolved evidence. Review that episode before starting another.");
      await client.query(
        `UPDATE specialist_sandbox_rediagnosis_runs SET status='blocked',
          specialist_decision=COALESCE(specialist_decision,'{}'::jsonb) || jsonb_build_object(
            'episodeRetirement',jsonb_build_object('reason','superseded_empty_episode',
              'priorStatus',status,'retiredAt',now(),'nextSessionNumber',$2::int))
          WHERE id=$1 AND status='active'`,[prior.id,input.trajectory.session_number],
      );
    }
    const created = await client.query(
      `INSERT INTO specialist_sandbox_rediagnosis_runs (
         trajectory_id, tutor_assignment_id, tutor_id, student_id, started_session_number,
         target_phase, specialist_probe_history, status, specialist_decision
       ) VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,'active',$7::jsonb)
       RETURNING *`,
      [
        input.trajectory.id,
        input.trajectory.tutor_assignment_id,
        input.trajectory.tutor_id,
        input.trajectory.student_id,
        input.trajectory.session_number,
        targetPhase,
        JSON.stringify(input.truth.behavior_model_version === 2 ? {
          decisionPolicyVersion: 2,
          _diagnosisContext: {
            legacyPrefixLength: 0,
            sessions: [{ scheduledSessionId: input.scheduledSessionId || null, startProbeIndex: 0 }],
            sandboxSelectionVersion: 2,
          },
        } : {}),
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
         trajectory_id, tutor_assignment_id, tutor_id, student_id, capability_id,
         evidence_class, source_type, source_id, phase, set_id, rep_number,
         sequence_number, session_number, reason,
         student_state_authoritative, evidence_scope
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,'sandbox')
       ON CONFLICT DO NOTHING`,
      [
        input.trajectory.id,
        input.trajectory.tutor_assignment_id,
        input.trajectory.tutor_id,
        input.trajectory.student_id,
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
  studentId: string;
  scheduledSessionId?: string | null;
}) {
  const { trajectory, truth } = await loadTrajectory(input);
  const { run, truth: diagnosisTruth } = await ensureRediagnosisRun({ trajectory, truth, scheduledSessionId: input.scheduledSessionId });

  const context = diagnosisContinuationContext(run.specialist_decision, run.specialist_probe_history.length, input.scheduledSessionId || null);
  const sessionStartProbeIndex = context.sessions.at(-1)!.startProbeIndex;
  const canonicalState = rebuildSandboxDiagnosisState({
    sessionStartProbeIndex,
    startingPhase: run.target_phase,
    history: diagnosisTruth.canonical_probe_history,
  });
  const specialistState = rebuildSandboxDiagnosisState({
    sessionStartProbeIndex,
    startingPhase: run.target_phase,
    history: run.specialist_probe_history,
  });
  const canonicalDecision = evaluateEvidenceCompleteDiagnosis(canonicalState);

  if (canonicalDecision.complete) {
    return { trajectory, truth, run, diagnosisTruth, canonicalState, specialistState, canonicalDecision,
      context, resolved: true as const, blocked: false as const };
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
      context, resolved: false as const,
      blocked: true as const,
    };
  }

  const outcomes = await loadDiagnosisOutcomes({
    bankVersion: trajectory.bank_version,
    probeId: canonicalDecision.nextProbeId,
  });
  const history = await getSandboxEnvironmentHistory(input);
  const selected = projectSandboxNativeDiagnosisOutcome(selectSandboxDiagnosisOutcome({
    seed: sandboxRediagnosisSelectionSeed({
      trajectorySeed: truth.trajectory_seed, runId: run.id,
      selectionVersion: context.sandboxSelectionVersion,
    }),
    profileSeed: truth.trajectory_seed,
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
      behaviorModelVersion: truth.behavior_model_version,
      continuityTags: truth.continuity_tags,
      developmentTopicKey: trajectory.active_topic_key || "",
    },
  }));
  const selectedRecord = outcomes.find(
    (item) => item.definition.key === selected.key && item.definition.version === selected.version,
  );
  if (!selectedRecord) throw new Error("Selected diagnosis outcome could not be resolved.");

  const sequenceNumber = diagnosisTruth.canonical_probe_history.length + 1;
  const turnFormId = digest(
    [
      "sandbox-rediagnosis-turn-v1",
      "native-protocol-v" + SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION,
      run.id,
      sequenceNumber,
      selectedRecord.publicRef,
      ...(truth.behavior_model_version === 2
        ? ["evidence-exceptions-v" + SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION] : []),
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
    context, resolved: false as const,
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


const SANDBOX_HANDOVER_SIMULATION_PROBE_BY_PHASE: Record<TopicPhase, DiagnosisProbeId> = {
  Clarity: "clarity.recognition",
  "Structured Execution": "stack.normal_independent",
  "Controlled Discomfort": "stack.challenge_no_timer",
  "Time Pressure Stability": "time.consistency",
};


async function ensureSandboxTpsTimerContract(input: {
  trajectory: TrajectoryRow;
  truth: TrajectoryTruthRow;
  tutorId: string;
  studentId: string;
  topic: string;
}): Promise<PersistedTpsTimerContract> {
  const topic = String(input.topic || "").trim();
  if (!topic) {
    throw httpError(
      400,
      "Sandbox Time Pressure Stability simulation requires a topic for timing authority.",
    );
  }

  const epochKey = `sandbox:${input.trajectory.id}:structured_execution:v1`;
  const existing = await loadLatestTpsTimerContract({
    studentId: input.studentId,
    topic,
  });
  if (existing?.baselineSourceEpochKey === epochKey) {
    return existing;
  }

  // Sandbox students carry persistent fictional state. Their inherited TPS state
  // must therefore carry the fictional baseline lineage that would have made that
  // state possible. Keep the three samples deterministic for the trajectory so a
  // refresh cannot manufacture a different Timer Contract.
  const seedHex = digest(
    [
      "sandbox-tps-baseline-v1",
      input.truth.trajectory_seed,
      input.trajectory.id,
      input.studentId,
      topic.toLowerCase(),
    ].join(":"),
  ).slice(0, 8);
  const seedNumber = Number.parseInt(seedHex, 16);
  const baselineSeconds = 44 + (Number.isFinite(seedNumber) ? seedNumber % 9 : 0);
  const sampleSeconds: [number, number, number] = [
    Math.max(1, baselineSeconds - 2),
    baselineSeconds,
    baselineSeconds + 2,
  ];

  const snapshot: TpsBaselineSnapshot = {
    source: "training",
    sourceEpochKey: epochKey,
    baselineGroupId: `sandbox:${input.trajectory.id}:independent_execution`,
    studentId: input.studentId,
    topic,
    recordIds: [
      `sandbox:${input.trajectory.id}:se-baseline:1`,
      `sandbox:${input.trajectory.id}:se-baseline:2`,
      `sandbox:${input.trajectory.id}:se-baseline:3`,
    ],
    elapsedMs: [
      sampleSeconds[0] * 1000,
      sampleSeconds[1] * 1000,
      sampleSeconds[2] * 1000,
    ],
    baselineSeconds,
    completedAt: new Date().toISOString(),
  };

  return persistTpsTimerContract({
    contract: deriveTpsTimerContractV1(snapshot),
    tutorId: input.tutorId,
  });
}


function projectSandboxLiveBehavior(input: {
  scope: SandboxLiveEvidenceSimulationScope;
  probeId: DiagnosisProbeId;
  behavior: string;
}) {
  if (input.scope !== "handover" || input.probeId !== "time.consistency") {
    return input.behavior;
  }

  return input.behavior
    .replace(/On the repeated timed opportunity, the student again /i, "Under the timed continuity condition, the student ")
    .replace(/repeated timed opportunity/gi, "timed continuity opportunity")
    .replace(/repeated timed response/gi, "timed continuity response")
    .replace(/The repeat is/gi, "The timed continuity response is")
    .replace(/the repeat is/gi, "the timed continuity response is")
    .replace(/breaks again/gi, "breaks");
}

export type SandboxLiveEvidenceSimulationScope = "diagnosis" | "handover";

export async function prepareSandboxLiveEvidenceSimulation(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  scope: SandboxLiveEvidenceSimulationScope;
  sourceContextId: string;
  topic: string;
  startingPhase: TopicPhase;
  sequenceNumber: number;
  probeId?: DiagnosisProbeId | null;
}) {
  await assertSandboxAccess(input);
  if (input.scope === "diagnosis") await initializeSandboxNativeEvidenceTrajectory(input);
  const { trajectory, truth } = await loadTrajectory(input);

  const timerContract =
    input.scope === "handover" &&
    input.startingPhase === "Time Pressure Stability"
      ? await ensureSandboxTpsTimerContract({
          trajectory,
          truth,
          tutorId: input.tutorId,
          studentId: input.studentId,
          topic: input.topic,
        })
      : null;

  const probeId =
    input.scope === "handover"
      ? SANDBOX_HANDOVER_SIMULATION_PROBE_BY_PHASE[input.startingPhase]
      : input.probeId || null;
  if (!probeId || !(probeId in DIAGNOSIS_PROBES)) {
    throw httpError(400, "Sandbox evidence simulation requires a valid diagnosis probe.");
  }
  if (!input.sourceContextId.trim()) {
    throw httpError(400, "Sandbox evidence simulation requires a source context.");
  }
  if (!Number.isInteger(input.sequenceNumber) || input.sequenceNumber <= 0) {
    throw httpError(400, "Sandbox evidence simulation sequence must be positive.");
  }

  const outcomes = await loadDiagnosisOutcomes({
    bankVersion: trajectory.bank_version,
    probeId,
  });
  const seed = [
    truth.trajectory_seed,
    input.scope,
    input.sourceContextId,
  ].join(":");
  const selected = projectSandboxNativeDiagnosisOutcome(selectSandboxDiagnosisOutcome({
    seed,
    profileSeed: truth.trajectory_seed,
    outcomes: outcomes.map((item) => item.definition),
    context: {
      startingPhase: input.startingPhase,
      probeId,
      sequenceNumber: input.sequenceNumber,
      earliestUnsupportedCapability: null,
      recentOutcomeKeys: [],
      behaviorModelVersion: truth.behavior_model_version,
      continuityTags: truth.continuity_tags,
      developmentTopicKey: input.topic,
    },
  }));
  const selectedRecord = outcomes.find(
    (item) =>
      item.definition.key === selected.key &&
      item.definition.version === selected.version,
  );
  if (!selectedRecord) {
    throw new Error("Sandbox simulated evidence outcome could not be resolved.");
  }

  const formId = digest(
    [
      "sandbox-live-evidence-v1",
      "native-protocol-v" + SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION,
      trajectory.id,
      input.scope,
      input.sourceContextId,
      input.startingPhase,
      input.sequenceNumber,
      probeId,
      selectedRecord.publicRef,
      ...(truth.behavior_model_version === 2
        ? ["evidence-exceptions-v" + SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION] : []),
    ].join(":"),
  ).slice(0, 32);

  await recordContextPreparationReceipt({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    trajectoryId: trajectory.id,
    studentId: input.studentId,
    preparationContext: input.scope === "diagnosis" ? `diagnosis:${input.startingPhase}` : "handover",
    sourceContextId: input.sourceContextId,
    phase: input.startingPhase,
    topicKey: input.topic,
    sequenceNumber: input.sequenceNumber,
    probeId,
    planFingerprint: formId,
  });

  return {
    scope: input.scope,
    trajectoryId: trajectory.id,
    bankVersion: trajectory.bank_version,
    sessionNumber: trajectory.session_number,
    probeId,
    sequenceNumber: input.sequenceNumber,
    formId,
    studentBehavior: projectSandboxLiveBehavior({
      scope: input.scope,
      probeId,
      behavior: selected.studentBehavior,
    }),
    simulatedElapsedSeconds: selected.simulatedElapsedSeconds,
    timerAuthority: timerContract
      ? {
          contractId: timerContract.contractId,
          baselineSeconds: timerContract.baselineSeconds,
          structureUnderTimerSeconds: timerContract.structureUnderTimerSeconds,
          repeatedTimedExecutionSeconds: timerContract.repeatedTimedExecutionSeconds,
          fullConstraintSeconds: timerContract.fullConstraintSeconds,
        }
      : null,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}

export async function submitSandboxLiveEvidenceSimulation(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  scope: SandboxLiveEvidenceSimulationScope;
  sourceContextId: string;
  topic: string;
  startingPhase: TopicPhase;
  sequenceNumber: number;
  probeId?: DiagnosisProbeId | null;
  formId: string;
  supportEvent: DiagnosisSupportEvent;
  observations: Array<{
    dimensionId: string;
    behaviorId: string;
  }>;
}) {
  const prepared = await prepareSandboxLiveEvidenceSimulation(input);
  if (prepared.formId !== input.formId) {
    throw httpError(409, "Sandbox simulated evidence opportunity is stale.");
  }

  const outcomes = await loadDiagnosisOutcomes({
    bankVersion: prepared.bankVersion,
    probeId: prepared.probeId as DiagnosisProbeId,
  });
  const { trajectory, truth } = await loadTrajectory(input);
  // Preparation and submission must select the *same* versioned outcome.
  // Re-evaluating a V2 Profile through V1 weighting can silently score the
  // Specialist against a student response they were never shown.
  const selected = projectSandboxNativeDiagnosisOutcome(selectSandboxDiagnosisOutcome({
    seed: [truth.trajectory_seed, input.scope, input.sourceContextId].join(":"),
    profileSeed: truth.trajectory_seed,
    outcomes: outcomes.map((item) => item.definition),
    context: {
      startingPhase: input.startingPhase,
      probeId: prepared.probeId as DiagnosisProbeId,
      sequenceNumber: input.sequenceNumber,
      earliestUnsupportedCapability: null,
      recentOutcomeKeys: [],
      behaviorModelVersion: truth.behavior_model_version,
      continuityTags: truth.continuity_tags,
      developmentTopicKey: input.topic,
    },
  }));

  // Handover observes only its own phase, and only dimensions actually
  // created by the prescribed probe. In particular, an immediate execution
  // probe does NOT establish repeatability from a missing second opportunity.
  const prescribedDimensions =
    DIAGNOSIS_PROBES[prepared.probeId as DiagnosisProbeId].dimensions;
  const expectedDimensionIds =
    input.scope === "diagnosis"
      ? prescribedDimensions
      : prescribedDimensions.filter(
          (dimensionId) =>
            DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].phase === input.startingPhase,
        );

  const submitted = new Map(
    input.observations.map((item) => [
      String(item.dimensionId || "").trim(),
      String(item.behaviorId || "").trim(),
    ]),
  );
  if (
    submitted.size !== expectedDimensionIds.length ||
    expectedDimensionIds.some((dimensionId) => !submitted.has(dimensionId))
  ) {
    throw httpError(
      400,
      "Sandbox evidence simulation must record every prescribed behavior dimension.",
    );
  }

  const canonical = new Map(
    selected.canonicalObservations.map((item) => [
      item.dimensionId,
      item.behaviorId,
    ]),
  );
  for (const dimensionId of expectedDimensionIds) {
    if (!canonical.has(dimensionId)) {
      throw new Error(
        `Sandbox simulated outcome is missing canonical evidence for ${dimensionId}.`,
      );
    }
  }

  let matchingObservations = 0;
  for (const dimensionId of expectedDimensionIds) {
    if (submitted.get(dimensionId) === canonical.get(dimensionId)) {
      matchingObservations += 1;
    }
  }
  const observationExact =
    matchingObservations === expectedDimensionIds.length;
  const conditionConformed =
    input.supportEvent === "none" ||
    input.supportEvent === "neutral_clarification";

  const sourceId = digest(
    [
      "sandbox-live-evidence-turn-v1",
      prepared.formId,
      input.studentId,
    ].join(":"),
  ).slice(0, 36);

  const occurrence = (
    layer: SandboxCapabilityOccurrence["layer"],
    evidenceClass: SandboxCapabilityOccurrence["evidenceClass"],
    reason: string,
  ): SandboxCapabilityOccurrence => ({
    layer,
    evidenceClass,
    sequenceNumber: input.sequenceNumber,
    sessionNumber: trajectory.session_number,
    phase: input.startingPhase,
    setId:
      input.scope === "handover"
        ? `handover.${input.startingPhase.toLowerCase().replace(/\s+/g, "_")}`
        : prepared.probeId,
    repNumber: input.sequenceNumber,
    reason,
  });



  // Historical, submitted simulation only. Protected Proof schema + explicit flag required.
  // A simulation observation never claims native Diagnosis/Handover authority.
  if (process.env.RI_SANDBOX_CROSSMODE_CAPTURE_V1 === "true") {
    const selectedRecord = outcomes.find(record =>
      record.definition.key === selected.key && record.definition.version === selected.version);
    if (!selectedRecord) throw new Error("Sandbox canonical lineage is missing.");
    const stored = await pool.query(
      `WITH recorded AS (
        INSERT INTO public.specialist_sandbox_live_evidence_turns (
          tutor_assignment_id,tutor_id,trajectory_id,student_id,scope,source_context_id,
          form_id,sequence_number,phase,probe_id,bank_version,behavior_model_version,
          student_behavior,specialist_submission,condition_conformed,observation_exact,
          matching_observations,total_observations
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18)
        ON CONFLICT (tutor_assignment_id,form_id) DO NOTHING
        RETURNING id
      )
      INSERT INTO private.specialist_sandbox_live_evidence_truth (
        event_id,outcome_ref,outcome_key,outcome_version,canonical_observations,
        trajectory_class,actual_support_event
      ) SELECT recorded.id,$19,$20,$21,$22::jsonb,$23,$24 FROM recorded`,
      [input.tutorAssignmentId,input.tutorId,trajectory.id,input.studentId,input.scope,
       input.sourceContextId,prepared.formId,input.sequenceNumber,input.startingPhase,
       prepared.probeId,prepared.bankVersion,truth.behavior_model_version,
       prepared.studentBehavior,JSON.stringify({supportEvent:input.supportEvent,observations:input.observations}),
       conditionConformed,observationExact,matchingObservations,expectedDimensionIds.length,
       selectedRecord.publicRef,selected.key,selected.version,
       JSON.stringify(selected.canonicalObservations),selected.trajectoryClass,input.supportEvent],
    );
    if (!stored.rowCount) {
      // A replay is allowed only when the originally committed public record
      // AND its private canonical truth match every decision-relevant field.
      // Never overwrite or reinterpret the first committed observation.
      const previouslyStored = await pool.query(
        `SELECT e.id FROM public.specialist_sandbox_live_evidence_turns e
           JOIN private.specialist_sandbox_live_evidence_truth t ON t.event_id=e.id
          WHERE e.tutor_assignment_id=$1 AND e.tutor_id=$2
            AND e.trajectory_id=$3 AND e.student_id=$4
            AND e.scope=$5 AND e.source_context_id=$6 AND e.form_id=$7
            AND e.sequence_number=$8 AND e.phase=$9 AND e.probe_id=$10
            AND e.bank_version=$11 AND e.behavior_model_version=$12
            AND e.student_behavior=$13 AND e.specialist_submission=$14::jsonb
            AND e.condition_conformed=$15 AND e.observation_exact=$16
            AND e.matching_observations=$17 AND e.total_observations=$18
            AND t.outcome_ref=$19 AND t.outcome_key=$20 AND t.outcome_version=$21
            AND t.canonical_observations=$22::jsonb
            AND t.trajectory_class=$23 AND t.actual_support_event=$24
          LIMIT 1`,
        [input.tutorAssignmentId,input.tutorId,trajectory.id,input.studentId,input.scope,
         input.sourceContextId,prepared.formId,input.sequenceNumber,input.startingPhase,
         prepared.probeId,prepared.bankVersion,truth.behavior_model_version,
         prepared.studentBehavior,JSON.stringify({supportEvent:input.supportEvent,observations:input.observations}),
         conditionConformed,observationExact,matchingObservations,expectedDimensionIds.length,
         selectedRecord.publicRef,selected.key,selected.version,
         JSON.stringify(selected.canonicalObservations),selected.trajectoryClass,input.supportEvent],
      );
      if (!previouslyStored.rows[0]) {
        throw httpError(409, "The previous Sandbox evidence record conflicts with this submission. Preserve the original and escalate for evidence review.");
      }
    }
  }
  // Record qualification capability only AFTER immutable capture validation.
  // A conflicting replay must never write a fresh capability occurrence.
  await insertCapabilityEvidence({
    trajectory,
    sourceType: "turn",
    sourceId,
    occurrences: [
      ...(input.scope === "diagnosis"
        ? [
            occurrence(
              "condition_integrity",
              conditionConformed ? "supported" : "breakdown",
              conditionConformed
                ? "The Specialist preserved the prescribed Sandbox evidence condition."
                : "The Specialist changed the prescribed Sandbox evidence condition through mathematical support.",
            ),
          ]
        : []),
      occurrence(
        "observation_integrity",
        observationExact ? "supported" : "breakdown",
        observationExact
          ? "The Specialist recorded the concrete simulated student behavior that occurred."
          : "At least one recorded behavior differed from the hidden simulated student truth.",
      ),
      occurrence(
        "evidence_integrity",
        observationExact ? "supported" : "breakdown",
        observationExact
          ? "The Specialist preserved the evidence class carried by the simulated response."
          : "The Specialist record changed decision-relevant evidence truth.",
      ),
    ],
  });

  return {
    success: true as const,
    matchingObservations,
    totalObservations: expectedDimensionIds.length,
    observationExact,
    conditionConformed,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
  };
}

export async function prepareSandboxRediagnosis(input: {
  tutorAssignmentId: string;
  tutorId: string;
  studentId: string;
  scheduledSessionId?: string | null;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (planned.resolved) return {
    status: "rediagnosis_resolution_ready" as const, trajectoryId: planned.trajectory.id,
    rediagnosisRunId: planned.run.id, targetPhase: planned.run.target_phase,
    reason: "The recorded responses establish a Training starting point. Apply the evidence-derived result without repeating any opportunity.",
    studentStateAuthoritative: false as const, evidenceScope: "sandbox" as const,
  };
  if (planned.blocked) {
    // Bind the current lesson once; a later lesson must pass explicit continuation authorization.
    if (!(planned.run.specialist_decision as any)?._diagnosisContext) await pool.query(
      `UPDATE specialist_sandbox_rediagnosis_runs SET specialist_decision=COALESCE(specialist_decision,'{}'::jsonb) || $2::jsonb
        WHERE id=$1 AND NOT (COALESCE(specialist_decision,'{}'::jsonb) ? '_diagnosisContext')`,
      [planned.run.id, JSON.stringify({ _diagnosisContext: planned.context })]);
    return {
      status: "rediagnosis_blocked" as const,
      trajectoryId: planned.trajectory.id,
      rediagnosisRunId: planned.run.id,
      targetPhase: planned.run.target_phase,
      reason: planned.canonicalDecision.continuation?.parentMessage || planned.canonicalDecision.reason,
      canContinue: !!input.scheduledSessionId && input.scheduledSessionId !== planned.context.sessions.at(-1)?.scheduledSessionId,
      studentStateAuthoritative: false as const,
      evidenceScope: "sandbox" as const,
    };
  }

  await recordContextPreparationReceipt({
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: input.tutorId,
    trajectoryId: planned.trajectory.id,
    studentId: input.studentId,
    preparationContext: "targeted_rediagnosis",
    sourceContextId: planned.run.id,
    phase: planned.run.target_phase,
    topicKey: planned.trajectory.active_topic_key || "",
    sequenceNumber: planned.sequenceNumber,
    probeId: planned.canonicalDecision.nextProbeId,
    planFingerprint: planned.turnFormId,
  });

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
  studentId: string;
  trajectoryId: string;
  rediagnosisRunId: string;
  bankVersion: number;
  sequenceNumber: number;
  turnFormId: string;
  scheduledSessionId?: string | null;
  submission: SandboxDiagnosisSubmittedProbe;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (planned.resolved) throw httpError(409, "Apply the recorded diagnosis result before ordinary Training.");
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
    sessionStartProbeIndex: planned.context.sessions.at(-1)!.startProbeIndex,
    history: canonicalHistory,
  });
  const specialistState = rebuildSandboxDiagnosisState({
    startingPhase: planned.run.target_phase,
    sessionStartProbeIndex: planned.context.sessions.at(-1)!.startProbeIndex,
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

  const complete = decisionComparison.canonicalDecision.complete;
  const blocked =
    !complete && !decisionComparison.canonicalDecision.nextProbeId;
  const completedPlacementNeedsTimer =
    complete &&
    ["Controlled Discomfort", "Time Pressure Stability"].includes(
      String(decisionComparison.canonicalDecision.placementPhase || ""),
    ) &&
    decisionComparison.canonicalDecision.timingBaseline.ready &&
    decisionComparison.canonicalDecision.timingBaseline.source === "diagnosis_run";
  const diagnosisTimerContract = completedPlacementNeedsTimer
    ? deriveDiagnosisTpsTimerContract({
        state: canonicalState,
        studentId: input.studentId,
        topic: planned.trajectory.active_topic_key || "",
        sourceEpochKey: `sandbox-rediagnosis-v1:${planned.run.id}`,
        baselineGroupId: `sandbox-rediagnosis:${planned.run.id}`,
      })
    : null;
  if (completedPlacementNeedsTimer && !diagnosisTimerContract) {
    throw httpError(
      409,
      "Sandbox re-diagnosis timing evidence reports ready but its Timer Contract could not be derived.",
    );
  }

  const turn = await pool.query(
    `INSERT INTO specialist_sandbox_rediagnosis_turns (
       rediagnosis_run_id, trajectory_id, tutor_assignment_id, tutor_id, student_id,
       sequence_number, probe_id, turn_form_id, student_behavior,
       specialist_submission, condition_conformed, total_observations,
       matching_observations, observation_exact, authority_aligned
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)
     RETURNING id, completed_at`,
    [
      planned.run.id,
      planned.trajectory.id,
      input.tutorAssignmentId,
      input.tutorId,
      planned.trajectory.student_id,
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

  await Promise.all([
    pool.query(
      `UPDATE specialist_sandbox_rediagnosis_runs
          SET specialist_probe_history = $2::jsonb,
              specialist_decision = $3::jsonb,
              status = $4::varchar,
              completed_at = CASE WHEN $4::varchar <> 'active' THEN now() ELSE NULL END
        WHERE id = $1`,
      [
        planned.run.id,
        JSON.stringify(specialistHistory),
        JSON.stringify(diagnosisDecisionWithContext(decisionComparison.specialistDecision, planned.context, planned.run.specialist_decision)),
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
        JSON.stringify(diagnosisDecisionWithContext(decisionComparison.canonicalDecision, planned.context, planned.diagnosisTruth.canonical_decision)),
        JSON.stringify(recentOutcomeKeys),
      ],
    ),
  ]);

  if (diagnosisTimerContract) {
    await persistTpsTimerContract({
      contract: diagnosisTimerContract,
      tutorId: input.tutorId,
    });
  }
  if (complete) await persistSandboxDiagnosisPlacement(pool, planned.trajectory.id, decisionComparison);

  const history = await getSandboxEnvironmentHistory(input);
  return {
    studentId: planned.trajectory.student_id,
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

async function persistSandboxDiagnosisPlacement(db: Pick<typeof pool, "query">, trajectoryId: string,
  decisionComparison: ReturnType<typeof compareSandboxDiagnosisDecisions>) {
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
      db.query(
        `UPDATE private.specialist_sandbox_trajectory_truth
            SET canonical_phase = $2,
                canonical_stability = $3,
                canonical_route = 'normal_training',
                canonical_targeted_rediagnosis_phase = NULL,
                prior_tracks_diverged = $4,
                updated_at = now()
          WHERE trajectory_id = $1`,
        [
          trajectoryId,
          canonicalPhase,
          canonicalStability,
          !decisionComparison.placementAligned,
        ],
      ),
      db.query(
        `UPDATE specialist_sandbox_trajectories
            SET specialist_phase = CASE WHEN $2 THEN $3 ELSE specialist_phase END,
                specialist_stability = CASE WHEN $2 THEN $4 ELSE specialist_stability END,
                specialist_route = 'normal_training',
                specialist_targeted_rediagnosis_phase = NULL,
                divergence_active = $5,
                updated_at = now()
          WHERE id = $1`,
        [
          trajectoryId,
          Boolean(specialistComplete),
          decisionComparison.specialistDecision.placementPhase,
          decisionComparison.specialistDecision.stability,
          !decisionComparison.placementAligned,
        ],
      ),
    ]);
}

export async function resolveSandboxRecordedDiagnosis(input: {
  tutorAssignmentId: string; tutorId: string; studentId: string; rediagnosisRunId: string;
  scheduledSessionId?: string | null;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (!planned.resolved || planned.run.id !== input.rediagnosisRunId) throw httpError(409, "The recorded episode does not establish a complete placement.");
  const comparison = compareSandboxDiagnosisDecisions({ canonicalState: planned.canonicalState,
    specialistState: planned.specialistState, sequenceNumber: planned.run.specialist_probe_history.length,
    sessionNumber: planned.trajectory.session_number, phase: planned.run.target_phase,
    probeId: planned.run.specialist_probe_history.at(-1)!.probeId });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const lock = await db.query("SELECT status, completed_at FROM specialist_sandbox_rediagnosis_runs WHERE id=$1 FOR UPDATE", [planned.run.id]);
    if (!lock.rows[0] || !["active","blocked"].includes(lock.rows[0].status)) throw httpError(409, "The episode has already changed. Refresh the prescribed route.");
    await db.query(`UPDATE specialist_sandbox_rediagnosis_runs SET specialist_decision=$2::jsonb, status='completed', completed_at=now() WHERE id=$1`,
      [planned.run.id, JSON.stringify({ ...diagnosisDecisionWithContext(comparison.specialistDecision, planned.context, planned.run.specialist_decision), resolutionAudit: { priorStatus: lock.rows[0].status, priorCompletedAt: lock.rows[0].completed_at, resolvedAt: new Date().toISOString(), reason: "mixed_behavior_policy_v2" } })]);
    await db.query(`UPDATE private.specialist_sandbox_rediagnosis_truth SET canonical_decision=$2::jsonb, updated_at=now() WHERE rediagnosis_run_id=$1`,
      [planned.run.id, JSON.stringify(diagnosisDecisionWithContext(comparison.canonicalDecision, planned.context, planned.diagnosisTruth.canonical_decision))]);
    await persistSandboxDiagnosisPlacement(db as any, planned.trajectory.id, comparison);
    await db.query("COMMIT");
    return { success: true, diagnosisComplete: true, studentStateAuthoritative: false, evidenceScope: "sandbox" };
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

export async function continueSandboxDiagnosis(input: {
  tutorAssignmentId: string; tutorId: string; studentId: string; rediagnosisRunId: string; scheduledSessionId: string;
}) {
  await assertSandboxAccess(input);
  const planned = await plan(input);
  if (!planned.blocked || planned.run.id !== input.rediagnosisRunId) throw httpError(409, "Continue only the paused, unfinished episode.");
  const context = await authorizeDiagnosisContinuation({ tutorId: input.tutorId, studentId: input.studentId,
    scheduledSessionId: input.scheduledSessionId, context: planned.context,
    historyLength: planned.run.specialist_probe_history.length, decision: planned.canonicalDecision }, pool);
  const updated = await pool.query(`UPDATE specialist_sandbox_rediagnosis_runs SET specialist_decision=COALESCE(specialist_decision,'{}'::jsonb) || $2::jsonb, status='active'
    WHERE id=$1 AND status='blocked' AND jsonb_array_length(specialist_probe_history)=$3 RETURNING id`,
    [planned.run.id, JSON.stringify({ _diagnosisContext: context }), planned.run.specialist_probe_history.length]);
  if (!updated.rows[0]) throw httpError(409, "The episode changed. Refresh before continuing.");
  return { success: true, studentStateAuthoritative: false, evidenceScope: "sandbox" };
}
