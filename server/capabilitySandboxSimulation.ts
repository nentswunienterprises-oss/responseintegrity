import { pool } from "./db";
import {
  buildSandboxSimulationAttemptPlan,
  DEFAULT_SANDBOX_SIMULATION_BANK_KEY,
} from "./capabilitySandboxSimulationBank";
import { evaluateSandboxSimulation, type SandboxSimulationResponseInput } from "@shared/capabilitySandboxSimulation";
import {
  projectSandboxSimulationForSpecialist,
  projectSandboxSimulationResultForSpecialist,
} from "./capabilitySandboxSimulationProjection";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function assertSandboxSimulationAccess(input: {
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
    throw httpError(409, "Sandbox simulations are available only while the Specialist is in Sandbox mode.");
  }

  return row;
}

export async function prepareSandboxSimulation(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
}) {
  await assertSandboxSimulationAccess(input);
  const plan = await buildSandboxSimulationAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: input.bankKey || DEFAULT_SANDBOX_SIMULATION_BANK_KEY,
  });

  return projectSandboxSimulationForSpecialist({
    definition: plan.generated.definition,
    simulationFormId: plan.generated.simulationFormId,
    bankVersion: plan.generated.bankVersion,
    attemptNumber: plan.attemptNumber,
    maxAttempts: plan.config.maxAttempts,
  });
}

export async function persistSandboxSimulationAttempt(input: {
  tutorAssignmentId: string;
  tutorId: string;
  bankKey?: string;
  bankVersion: number;
  simulationFormId: string;
  responses: SandboxSimulationResponseInput[];
}) {
  await assertSandboxSimulationAccess(input);

  const plan = await buildSandboxSimulationAttemptPlan({
    tutorAssignmentId: input.tutorAssignmentId,
    bankKey: input.bankKey || DEFAULT_SANDBOX_SIMULATION_BANK_KEY,
  });
  if (
    plan.generated.bankVersion !== input.bankVersion ||
    plan.generated.simulationFormId !== input.simulationFormId
  ) {
    throw httpError(409, "Sandbox simulation form is stale or does not match the active attempt.");
  }

  const result = evaluateSandboxSimulation(plan.generated.definition, input.responses);

  try {
    const insertResult = await pool.query(
      `INSERT INTO specialist_capability_sandbox_simulation_attempts (
         tutor_assignment_id,
         tutor_id,
         bank_key,
         bank_version,
         attempt_number,
         simulation_form_id,
         scenario_key,
         scenario_version,
         total_decisions,
         correct_decisions,
         percent,
         passed,
         has_critical_fail,
         critical_fail_decision_keys,
         evidence_contamination_count,
         authority_violation_count,
         escalation_failure_count,
         covered_deep_dive_keys,
         responses,
         decision_results,
         authoritative
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         $14::jsonb, $15, $16, $17, $18::jsonb, $19::jsonb, $20::jsonb, false
       )
       RETURNING id, completed_at`,
      [
        input.tutorAssignmentId,
        input.tutorId,
        plan.generated.bankKey,
        plan.generated.bankVersion,
        plan.attemptNumber,
        plan.generated.simulationFormId,
        result.simulationKey,
        result.version,
        result.totalDecisions,
        result.correctDecisions,
        result.percent,
        result.passed,
        result.hasCriticalFail,
        JSON.stringify(result.criticalFailDecisionKeys),
        result.evidenceContaminationCount,
        result.authorityViolationCount,
        result.escalationFailureCount,
        JSON.stringify(result.coveredDeepDiveKeys),
        JSON.stringify(input.responses),
        JSON.stringify(result.decisionResults),
      ],
    );

    return projectSandboxSimulationResultForSpecialist({
      attemptId: insertResult.rows[0]?.id,
      completedAt: insertResult.rows[0]?.completed_at,
      bankVersion: plan.generated.bankVersion,
      attemptNumber: plan.attemptNumber,
      simulationFormId: plan.generated.simulationFormId,
      result,
    });
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
  await assertSandboxSimulationAccess(input);
  const bankKey = input.bankKey || DEFAULT_SANDBOX_SIMULATION_BANK_KEY;
  const result = await pool.query(
    `SELECT id,
            bank_key,
            bank_version,
            attempt_number,
            simulation_form_id,
            scenario_key,
            scenario_version,
            total_decisions,
            correct_decisions,
            percent,
            passed,
            has_critical_fail,
            evidence_contamination_count,
            authority_violation_count,
            escalation_failure_count,
            authoritative,
            completed_at
       FROM specialist_capability_sandbox_simulation_attempts
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
    simulationFormId: String(row.simulation_form_id),
    scenarioKey: String(row.scenario_key),
    scenarioVersion: Number(row.scenario_version),
    totalDecisions: Number(row.total_decisions),
    correctDecisions: Number(row.correct_decisions),
    percent: Number(row.percent),
    passed: Boolean(row.passed),
    hasCriticalFail: Boolean(row.has_critical_fail),
    evidenceContaminationCount: Number(row.evidence_contamination_count),
    authorityViolationCount: Number(row.authority_violation_count),
    escalationFailureCount: Number(row.escalation_failure_count),
    authoritative: false as const,
    completedAt: row.completed_at,
  }));
}
