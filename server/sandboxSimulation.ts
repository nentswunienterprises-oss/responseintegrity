import { pool } from "./db";
import {
  evaluateSandboxSimulation,
  projectSandboxScenarioForSpecialist,
  type SandboxSimulationSubmission,
} from "@shared/sandboxSimulation";
import {
  buildSandboxAttemptPlan,
  DEFAULT_SANDBOX_BANK_KEY,
  loadActiveSandboxBank,
} from "./sandboxSimulationBank";
import {
  evaluateSandboxGraduation,
  type SandboxGraduationAttempt,
} from "@shared/sandboxGraduation";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
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
    throw httpError(409, "Sandbox simulation is available only while the Specialist is in Sandbox.");
  }
}

export async function prepareSandboxSimulation(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
}) {
  await assertSandboxAccess(input);
  const plan = await buildSandboxAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: input.bankKey,
  });

  return {
    bankKey: plan.bank.bankKey,
    bankVersion: plan.bank.bankVersion,
    bankTitle: plan.bank.title,
    attemptNumber: plan.attemptNumber,
    maxAttempts: plan.bank.maxAttempts,
    scenarioFormId: plan.scenarioFormId,
    scenario: projectSandboxScenarioForSpecialist(plan.scenario),
  };
}

export async function persistSandboxSimulationAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
  bankVersion: number;
  scenarioFormId: string;
  submission: SandboxSimulationSubmission;
}) {
  await assertSandboxAccess(input);
  const plan = await buildSandboxAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: input.bankKey,
  });

  if (
    input.bankVersion !== plan.bank.bankVersion ||
    input.scenarioFormId !== plan.scenarioFormId
  ) {
    throw httpError(409, "Sandbox scenario is stale or does not match the active attempt.");
  }

  const evaluation = evaluateSandboxSimulation(plan.scenario, input.submission);

  try {
    const inserted = await pool.query(
      `INSERT INTO specialist_sandbox_simulation_attempts (
         tutor_assignment_id,
         tutor_id,
         bank_key,
         bank_version,
         attempt_number,
         scenario_form_id,
         scenario_key,
         scenario_version,
         phase,
         previous_stability,
         total_observations,
         matching_observations,
         observation_fidelity_percent,
         system_outcome_matched,
         passed,
         specialist_outcome,
         canonical_outcome,
         submission,
         student_state_authoritative,
         evidence_scope
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16::jsonb,$17::jsonb,$18::jsonb,false,'sandbox'
       )
       RETURNING id, completed_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        plan.bank.bankKey,
        plan.bank.bankVersion,
        plan.attemptNumber,
        plan.scenarioFormId,
        plan.scenario.key,
        plan.scenario.version,
        evaluation.phase,
        evaluation.previousStability,
        evaluation.totalObservations,
        evaluation.matchingObservations,
        evaluation.observationFidelityPercent,
        evaluation.systemOutcomeMatched,
        evaluation.passed,
        JSON.stringify(evaluation.specialistOutcome),
        JSON.stringify(evaluation.canonicalOutcome),
        JSON.stringify(input.submission),
      ],
    );

    return {
      attemptId: String(inserted.rows[0]?.id || ""),
      completedAt: inserted.rows[0]?.completed_at,
      bankKey: plan.bank.bankKey,
      bankVersion: plan.bank.bankVersion,
      attemptNumber: plan.attemptNumber,
      scenarioKey: evaluation.scenarioKey,
      scenarioVersion: evaluation.scenarioVersion,
      phase: evaluation.phase,
      totalObservations: evaluation.totalObservations,
      matchingObservations: evaluation.matchingObservations,
      observationFidelityPercent: evaluation.observationFidelityPercent,
      systemOutcomeMatched: evaluation.systemOutcomeMatched,
      passed: evaluation.passed,
      specialistOutcome: evaluation.specialistOutcome,
      studentStateAuthoritative: false as const,
      evidenceScope: "sandbox" as const,
    };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw httpError(409, "This Sandbox simulation attempt has already been submitted.");
    }
    throw error;
  }
}

export async function getSandboxSimulationHistory(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
}) {
  await assertSandboxAccess(input);
  const bankKey = input.bankKey || DEFAULT_SANDBOX_BANK_KEY;
  const result = await pool.query(
    `SELECT id, bank_key, bank_version, attempt_number, scenario_key, scenario_version,
            phase, total_observations, matching_observations,
            observation_fidelity_percent, system_outcome_matched, passed,
            specialist_outcome, student_state_authoritative, evidence_scope, completed_at
       FROM specialist_sandbox_simulation_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        AND bank_key = $3
      ORDER BY completed_at DESC`,
    [input.tutorAssignmentId, input.tutorId, bankKey],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    bankKey: String(row.bank_key),
    bankVersion: Number(row.bank_version),
    attemptNumber: Number(row.attempt_number),
    scenarioKey: String(row.scenario_key),
    scenarioVersion: Number(row.scenario_version),
    phase: String(row.phase),
    totalObservations: Number(row.total_observations),
    matchingObservations: Number(row.matching_observations),
    observationFidelityPercent: Number(row.observation_fidelity_percent),
    systemOutcomeMatched: Boolean(row.system_outcome_matched),
    passed: Boolean(row.passed),
    specialistOutcome: row.specialist_outcome,
    studentStateAuthoritative: false as const,
    evidenceScope: "sandbox" as const,
    completedAt: row.completed_at,
  }));
}


export async function getSandboxGraduationStatus(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
}) {
  await assertSandboxAccess(input);
  const bankKey = input.bankKey || DEFAULT_SANDBOX_BANK_KEY;
  const bank = await loadActiveSandboxBank(bankKey);
  if (!bank) throw httpError(404, "Sandbox simulation bank is not active.");
  if (!bank.graduationPolicy) {
    return {
      bankKey: bank.bankKey,
      bankVersion: bank.bankVersion,
      policyAvailable: false,
      evidenceReady: false,
      practicalsReady: false,
      automaticTransition: false,
      nextStage: "practicals",
      phases: [],
      qualifyingDistinctScenarios: 0,
      requiredDistinctScenarios: 0,
      reason: "The active Sandbox bank does not yet have a graduation policy.",
    };
  }

  const attemptResult = await pool.query(
    `SELECT scenario_key, phase, observation_fidelity_percent,
            system_outcome_matched, passed, completed_at
       FROM specialist_sandbox_simulation_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
        AND bank_key = $3
        AND bank_version = $4
      ORDER BY completed_at ASC`,
    [input.tutorAssignmentId, input.tutorId, bank.bankKey, bank.bankVersion],
  );

  const attempts: SandboxGraduationAttempt[] = attemptResult.rows.map((row) => ({
    scenarioKey: String(row.scenario_key),
    phase: String(row.phase) as SandboxGraduationAttempt["phase"],
    observationFidelityPercent: Number(row.observation_fidelity_percent),
    systemOutcomeMatched: Boolean(row.system_outcome_matched),
    passed: Boolean(row.passed),
    completedAt: String(row.completed_at),
  }));

  return {
    bankKey: bank.bankKey,
    bankVersion: bank.bankVersion,
    policyAvailable: true,
    ...evaluateSandboxGraduation(bank.graduationPolicy, attempts),
  };
}
