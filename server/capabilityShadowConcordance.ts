import { pool } from "./db";
import { supabase } from "./storage";
import { buildTutorDeepDiveProgress } from "./battleTesting";
import { getLatestSandboxMockAssessment } from "./sandboxReadiness";
import { assertCapabilityReviewerAccessToAssignment } from "./capabilityReadiness";
import { DEFAULT_SANDBOX_SIMULATION_BANK_KEY } from "./capabilitySandboxSimulationBank";
import {
  buildShadowSpecialistConcordance,
  type ShadowBattleTestDeepDiveEvidence,
  type ShadowCapabilityCellEvidence,
  type ShadowCapabilityEvidenceInput,
  type ShadowCapabilityPracticalOutcome,
  type ShadowOutcomeTarget,
} from "@shared/capabilityShadowConcordance";
import {
  capabilityEvidenceCellCode,
  type CapabilityAssessmentEvidenceSnapshot,
} from "@shared/capabilityEvidenceSelection";
import {
  CAPABILITY_PRACTICAL_PROOFS,
  type CapabilityPracticalProofDefinition,
} from "@shared/capabilityPracticalEvidence";
import { ORAL_DEFENSE_VERSION } from "@shared/capabilityOralDefense";
import { getCapabilityDeepDiveBlueprint } from "@shared/capabilityBlueprint";
import type { CapabilityBlueprintEvidenceKind } from "@shared/capabilityBlueprint";
import type { TutorBattleTestPhaseKey } from "@shared/battleTesting";
import type { TrialCaseStatus, TrialCertificationDecision } from "@shared/trialCertification";

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function parseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : {};
  } catch {
    return {};
  }
}

function timestamp(value: unknown) {
  const parsed = new Date(String(value || ""));
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestByAttempt<T>(
  rows: T[],
  attemptOf: (row: T) => number,
  timeOf: (row: T) => number,
) {
  return rows.reduce<T | null>((latest, row) => {
    if (!latest) return row;
    const attemptDelta = attemptOf(row) - attemptOf(latest);
    if (attemptDelta > 0) return row;
    if (attemptDelta === 0 && timeOf(row) > timeOf(latest)) return row;
    return latest;
  }, null);
}

function requireDeepDive(value: unknown, label: string): TutorBattleTestPhaseKey {
  const key = String(value || "").trim();
  if (!getCapabilityDeepDiveBlueprint(key)) {
    throw httpError(409, `${label} references unknown Deep Dive ${key || "<empty>"}.`);
  }
  return key as TutorBattleTestPhaseKey;
}

function requireEvidenceKind(value: unknown): CapabilityBlueprintEvidenceKind {
  const kind = String(value || "").trim();
  if (!new Set(["mastery", "retrieval", "transfer"]).has(kind)) {
    throw httpError(409, `Capability attempt references unknown evidence kind ${kind || "<empty>"}.`);
  }
  return kind as CapabilityBlueprintEvidenceKind;
}

async function loadBattleTestDeepDiveEvidence(
  tutorAssignmentId: string,
): Promise<ShadowBattleTestDeepDiveEvidence[]> {
  const { data, error } = await supabase
    .from("battle_test_runs")
    .select(
      "id, pod_id, subject_type, subject_user_id, tutor_assignment_id, created_by_user_id, template_key, selected_phase_keys, phase_scores, weak_phases, critical_fail_reasons, total_questions, answered_questions, total_points, possible_points, alignment_percent, state, has_critical_fail, action_required, completed_at, created_at",
    )
    .eq("tutor_assignment_id", tutorAssignmentId)
    .eq("subject_type", "tutor")
    .order("completed_at", { ascending: true });

  if (error) throw httpError(500, `Failed to load Battle Test history: ${error.message}`);
  const runs = data || [];
  const progress = buildTutorDeepDiveProgress([], runs as any[]);
  const latestRunByPhase = new Map<string, { id: string; completedAt: string }>();

  for (const run of runs) {
    for (const phase of parseArray((run as any).phase_scores)) {
      const phaseKey = String(phase?.phaseKey || "").trim();
      if (!phaseKey) continue;
      requireDeepDive(phaseKey, "Battle Test run");
      latestRunByPhase.set(phaseKey, {
        id: String((run as any).id),
        completedAt: String((run as any).completed_at),
      });
    }
  }

  return progress
    .filter((entry) => entry.attemptsCount > 0)
    .map((entry) => {
      const deepDiveKey = requireDeepDive(entry.phaseKey, "Battle Test progress");
      const latestRun = latestRunByPhase.get(deepDiveKey);
      if (!latestRun) {
        throw httpError(409, `Battle Test ${deepDiveKey} has progress without a traceable run ID.`);
      }
      if (entry.lastTestedAt && latestRun.completedAt !== entry.lastTestedAt) {
        throw httpError(409, `Battle Test ${deepDiveKey} latest-run lineage is inconsistent.`);
      }
      return {
        evidenceId: latestRun.id,
        deepDiveKey,
        historicalState: entry.historicalState,
        currentHealthState: entry.currentHealthState,
        currentStreak: entry.currentStreak,
        latestScore: entry.latestScore,
        attemptsCount: entry.attemptsCount,
        criticalFlag: entry.criticalFlag,
        completedAt: entry.completedAt,
        lastTestedAt: entry.lastTestedAt,
      };
    });
}

function buildCurrentAssessmentEvidence(input: {
  attempts: Array<Record<string, any>>;
  activeVersions: Array<Record<string, any>>;
}) {
  const seenConfigKeys = new Set<string>();
  const activeVersionMap = new Map<string, number>();
  for (const row of input.activeVersions) {
    const assessmentKey = String(row.assessment_key || "").trim();
    if (!assessmentKey) throw httpError(409, "Active Capability assessment config has no assessment key.");
    if (seenConfigKeys.has(assessmentKey)) {
      throw httpError(409, `Multiple active Capability bank versions exist for ${assessmentKey}.`);
    }
    seenConfigKeys.add(assessmentKey);
    const bankVersion = Number(row.bank_version);
    if (!Number.isInteger(bankVersion) || bankVersion < 1) {
      throw httpError(409, `Capability assessment ${assessmentKey} has invalid active bank version.`);
    }
    activeVersionMap.set(assessmentKey, bankVersion);
  }

  const latestCurrentAttempts: Array<Record<string, any>> = [];
  for (const [assessmentKey, bankVersion] of activeVersionMap) {
    const currentRows = input.attempts.filter(
      (row) => String(row.assessment_key) === assessmentKey && Number(row.bank_version) === bankVersion,
    );
    const latest = latestByAttempt(
      currentRows,
      (row) => Number(row.attempt_number),
      (row) => timestamp(row.completed_at),
    );
    if (latest) latestCurrentAttempts.push(latest);
  }

  const lineages = new Map<string, ShadowCapabilityCellEvidence>();
  const satisfied = new Set<string>();
  const observed = new Set<string>();
  const criticalDeepDiveKeys = new Set<TutorBattleTestPhaseKey>();

  for (const row of latestCurrentAttempts) {
    const evidenceKind = requireEvidenceKind(row.evidence_kind);
    const coveredDeepDiveKeys = parseArray(row.covered_deep_dive_keys).map((value) =>
      requireDeepDive(value, `Capability assessment ${String(row.assessment_key)}`),
    );
    const criticalQuestionResults = parseArray(row.question_results).filter(
      (question) => Boolean(question?.criticalFail),
    );
    for (const question of criticalQuestionResults) {
      criticalDeepDiveKeys.add(
        requireDeepDive(question?.deepDiveKey, `Capability critical question ${String(question?.questionKey || "")}`),
      );
    }
    if (Boolean(row.has_critical_fail) && criticalQuestionResults.length === 0) {
      throw httpError(
        409,
        `Capability assessment ${String(row.assessment_key)} has an aggregate critical fail that cannot be localized to a Deep Dive.`,
      );
    }

    for (const deepDiveKey of coveredDeepDiveKeys) {
      const blueprint = getCapabilityDeepDiveBlueprint(deepDiveKey)!;
      if (!blueprint.requiredEvidenceKinds.includes(evidenceKind)) continue;
      const code = capabilityEvidenceCellCode(deepDiveKey, evidenceKind);
      if (lineages.has(code)) {
        throw httpError(409, `Multiple current Capability assessments resolve to evidence cell ${code}.`);
      }
      const deepDiveHasCritical = criticalQuestionResults.some(
        (question) => String(question?.deepDiveKey || "") === deepDiveKey,
      );
      const lineage: ShadowCapabilityCellEvidence = {
        code,
        deepDiveKey,
        evidenceKind,
        evidenceId: String(row.id),
        assessmentKey: String(row.assessment_key),
        bankVersion: Number(row.bank_version),
        attemptNumber: Number(row.attempt_number),
        passed: Boolean(row.passed),
        hasCriticalFail: deepDiveHasCritical,
        observedAt: String(row.completed_at),
      };
      lineages.set(code, lineage);
      observed.add(code);
      if (lineage.passed && !lineage.hasCriticalFail) satisfied.add(code);
    }
  }

  return {
    activeAssessmentVersions: input.activeVersions.map((row) => ({
      assessmentKey: String(row.assessment_key),
      bankVersion: Number(row.bank_version),
    })),
    satisfiedEvidenceCellCodes: Array.from(satisfied).sort(),
    observedEvidenceCellCodes: Array.from(observed).sort(),
    criticalDeepDiveKeys,
    evidenceCellLineage: Array.from(lineages.values()).sort((a, b) => a.code.localeCompare(b.code)),
  };
}

function currentPracticalOutcome(
  proof: CapabilityPracticalProofDefinition,
  rows: Array<Record<string, any>>,
  criticalDeepDiveKeys: Set<TutorBattleTestPhaseKey>,
): ShadowCapabilityPracticalOutcome {
  const currentRows = rows.filter(
    (row) => String(row.proof_key) === proof.key && Number(row.proof_version) === proof.version,
  );
  const latest = latestByAttempt(
    currentRows,
    (row) => Number(row.attempt_number),
    (row) => timestamp(row.reviewed_at || row.submitted_at),
  );
  if (!latest) {
    return {
      proofKey: proof.key,
      outcome: null,
      evidenceId: null,
      version: null,
      rubricVersion: null,
      attemptNumber: null,
      observedAt: null,
    };
  }

  const outcome = (latest.outcome || "submitted") as ShadowCapabilityPracticalOutcome["outcome"];
  const criticalCount = Number(latest.critical_fail_count || 0);
  const criticalKeys = parseArray(latest.critical_fail_criterion_keys).map(String);
  if ((outcome === "integrity_review" || criticalCount > 0) && criticalKeys.length === 0) {
    throw httpError(409, `Capability practical ${proof.key} has an integrity signal without criterion lineage.`);
  }
  for (const criterionKey of criticalKeys) {
    const criterion = proof.reviewRubric.criteria.find((entry) => entry.key === criterionKey);
    if (!criterion) {
      throw httpError(409, `Capability practical ${proof.key} references unknown critical criterion ${criterionKey}.`);
    }
    for (const link of [...criterion.competencyLinks, ...criterion.criticalBoundaryLinks]) {
      criticalDeepDiveKeys.add(requireDeepDive(link.deepDiveKey, `Capability practical ${proof.key}`));
    }
  }

  return {
    proofKey: proof.key,
    outcome,
    evidenceId: String(latest.id),
    version: Number(latest.proof_version),
    rubricVersion: latest.rubric_version === null ? null : Number(latest.rubric_version),
    attemptNumber: Number(latest.attempt_number),
    observedAt: String(latest.reviewed_at || latest.submitted_at),
  };
}

function currentOralDefense(
  rows: Array<Record<string, any>>,
  criticalDeepDiveKeys: Set<TutorBattleTestPhaseKey>,
): ShadowCapabilityEvidenceInput["oralDefense"] {
  const currentRows = rows.filter((row) => Number(row.defense_version) === ORAL_DEFENSE_VERSION);
  const latest = latestByAttempt(
    currentRows,
    (row) => Number(row.attempt_number),
    (row) => timestamp(row.completed_at),
  );
  if (!latest) {
    return {
      outcome: null,
      evidenceId: null,
      version: null,
      attemptNumber: null,
      observedAt: null,
    };
  }

  const outcome = latest.outcome as ShadowCapabilityEvidenceInput["oralDefense"]["outcome"];
  const criticalFailCount = Number(latest.critical_fail_count || 0);
  if (outcome === "integrity_review" || criticalFailCount > 0) {
    const brief = parseObject(latest.brief_snapshot);
    const issuedProbes = parseArray(brief.probes);
    const observations = parseArray(latest.probes);
    let localized = 0;
    for (const observation of observations) {
      if (String(observation?.judgment || "") !== "fail") continue;
      const focusKey = String(observation?.focusKey || "");
      const deepDiveKey = String(observation?.deepDiveKey || "");
      const issued = issuedProbes.find(
        (probe) => String(probe?.focusKey || "") === focusKey && String(probe?.deepDiveKey || "") === deepDiveKey,
      );
      if (!issued?.rubric?.criticalOnFail) continue;
      criticalDeepDiveKeys.add(requireDeepDive(deepDiveKey, "Oral Defense critical probe"));
      for (const link of parseArray(issued.rubric.criticalBoundaryLinks)) {
        criticalDeepDiveKeys.add(requireDeepDive(link?.deepDiveKey, "Oral Defense critical boundary"));
      }
      localized += 1;
    }
    if (criticalFailCount > 0 && localized === 0) {
      throw httpError(409, "Oral Defense has critical failures that cannot be localized to current probe lineage.");
    }
  }

  return {
    outcome,
    evidenceId: String(latest.id),
    version: Number(latest.defense_version),
    attemptNumber: Number(latest.attempt_number),
    observedAt: String(latest.completed_at),
  };
}

async function loadCapabilityEvidence(tutorAssignmentId: string): Promise<ShadowCapabilityEvidenceInput> {
  const [activeConfigResult, assessmentResult, practicalResult, oralResult] = await Promise.all([
    pool.query(
      `SELECT assessment_key, bank_version
         FROM private.specialist_capability_assessment_configs
        WHERE active = true
        ORDER BY assessment_key`,
    ),
    pool.query(
      `SELECT id, assessment_key, bank_version, attempt_number, evidence_kind,
              covered_deep_dive_keys, passed, has_critical_fail, question_results, completed_at
         FROM specialist_capability_assessment_attempts
        WHERE tutor_assignment_id = $1
        ORDER BY completed_at ASC, attempt_number ASC, id ASC`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT e.id, e.proof_key, e.proof_version, e.rubric_version, e.attempt_number,
              e.submitted_at, r.outcome, r.reviewed_at, r.critical_fail_count,
              r.critical_fail_criterion_keys
         FROM specialist_capability_practical_evidence e
         LEFT JOIN specialist_capability_practical_reviews r ON r.evidence_id = e.id
        WHERE e.tutor_assignment_id = $1
        ORDER BY e.proof_key, e.attempt_number, e.submitted_at`,
      [tutorAssignmentId],
    ),
    pool.query(
      `SELECT id, defense_version, attempt_number, outcome, brief_snapshot, probes,
              critical_fail_count, completed_at
         FROM specialist_capability_oral_defenses
        WHERE tutor_assignment_id = $1
        ORDER BY defense_version, attempt_number, completed_at`,
      [tutorAssignmentId],
    ),
  ]);

  const assessment = buildCurrentAssessmentEvidence({
    attempts: assessmentResult.rows,
    activeVersions: activeConfigResult.rows,
  });
  const criticalDeepDiveKeys = new Set<TutorBattleTestPhaseKey>(assessment.criticalDeepDiveKeys);
  const practicalOutcomes = CAPABILITY_PRACTICAL_PROOFS.map((proof) =>
    currentPracticalOutcome(proof, practicalResult.rows, criticalDeepDiveKeys),
  );
  const oralDefense = currentOralDefense(oralResult.rows, criticalDeepDiveKeys);

  const activeSimulationResult = await pool.query(
    `SELECT bank_key, bank_version
       FROM private.specialist_capability_simulation_banks
      WHERE bank_key = $1
        AND active = true
      ORDER BY bank_version DESC`,
    [DEFAULT_SANDBOX_SIMULATION_BANK_KEY],
  );
  if (activeSimulationResult.rowCount > 1) {
    throw httpError(409, `Multiple active Sandbox simulation banks exist for ${DEFAULT_SANDBOX_SIMULATION_BANK_KEY}.`);
  }
  const activeSimulationBankVersion = activeSimulationResult.rows[0]
    ? Number(activeSimulationResult.rows[0].bank_version)
    : null;

  let latestSimulationAttempt: ShadowCapabilityEvidenceInput["sandboxSimulation"]["latestCurrentAttempt"] = null;
  if (activeSimulationBankVersion !== null) {
    const simulationResult = await pool.query(
      `SELECT id, bank_version, attempt_number, passed, has_critical_fail, completed_at
         FROM specialist_capability_sandbox_simulation_attempts
        WHERE tutor_assignment_id = $1
          AND bank_key = $2
          AND bank_version = $3
        ORDER BY attempt_number DESC, completed_at DESC
        LIMIT 1`,
      [tutorAssignmentId, DEFAULT_SANDBOX_SIMULATION_BANK_KEY, activeSimulationBankVersion],
    );
    const row = simulationResult.rows[0];
    if (row) {
      latestSimulationAttempt = {
        evidenceId: String(row.id),
        bankVersion: Number(row.bank_version),
        attemptNumber: Number(row.attempt_number),
        passed: Boolean(row.passed),
        hasCriticalFail: Boolean(row.has_critical_fail),
        observedAt: String(row.completed_at),
      };
    }
  }

  return {
    activeAssessmentVersions: assessment.activeAssessmentVersions,
    satisfiedEvidenceCellCodes: assessment.satisfiedEvidenceCellCodes,
    observedEvidenceCellCodes: assessment.observedEvidenceCellCodes,
    criticalDeepDiveKeys: Array.from(criticalDeepDiveKeys).sort(),
    evidenceCellLineage: assessment.evidenceCellLineage,
    practicalOutcomes,
    oralDefense,
    sandboxSimulation: {
      bankKey: DEFAULT_SANDBOX_SIMULATION_BANK_KEY,
      activeBankVersion: activeSimulationBankVersion,
      latestCurrentAttempt: latestSimulationAttempt,
    },
  };
}

async function loadTrialOutcomeTarget(tutorAssignmentId: string): Promise<ShadowOutcomeTarget["trial"]> {
  const { data: caseRow, error: caseError } = await supabase
    .from("tutor_trial_cases")
    .select("id, status, started_at, reviewable_at, closed_at")
    .eq("tutor_assignment_id", tutorAssignmentId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (caseError) throw httpError(500, `Failed to load Trial case: ${caseError.message}`);
  if (!caseRow) {
    return { caseStatus: null, certificationDecision: null, evidenceId: null, observedAt: null };
  }

  const { data: decisionRow, error: decisionError } = await supabase
    .from("tutor_certification_decisions")
    .select("id, decision, decided_at")
    .eq("case_id", caseRow.id)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (decisionError) throw httpError(500, `Failed to load Trial certification decision: ${decisionError.message}`);

  const caseStatus = String(caseRow.status || "") as TrialCaseStatus;
  if (!new Set<TrialCaseStatus>(["active", "reviewable", "certified", "remediation_required", "unsuccessful"]).has(caseStatus)) {
    throw httpError(409, `Trial case ${String(caseRow.id)} has unknown status ${String(caseRow.status)}.`);
  }
  const certificationDecision = decisionRow
    ? String(decisionRow.decision || "") as TrialCertificationDecision
    : null;
  if (
    certificationDecision !== null &&
    !new Set<TrialCertificationDecision>(["certified", "remediation_required", "unsuccessful"]).has(certificationDecision)
  ) {
    throw httpError(409, `Trial decision ${String(decisionRow?.id)} has unknown outcome.`);
  }

  return {
    caseStatus,
    certificationDecision,
    evidenceId: String(decisionRow?.id || caseRow.id),
    observedAt: String(
      decisionRow?.decided_at || caseRow.closed_at || caseRow.reviewable_at || caseRow.started_at,
    ),
  };
}

async function loadOutcomeTarget(tutorAssignmentId: string): Promise<ShadowOutcomeTarget> {
  const [mock, trial] = await Promise.all([
    getLatestSandboxMockAssessment(tutorAssignmentId),
    loadTrialOutcomeTarget(tutorAssignmentId),
  ]);
  return {
    mock: mock
      ? {
          decision: mock.decision,
          evidenceId: mock.id,
          observedAt: mock.assessedAt,
        }
      : { decision: null, evidenceId: null, observedAt: null },
    trial,
  };
}

export async function buildPersistedShadowConcordanceSnapshot(input: {
  tutorAssignmentId: string;
  reviewerId: string;
  reviewerRole: string;
}) {
  const assignment = await assertCapabilityReviewerAccessToAssignment(input);
  const [battleTestDeepDives, capabilityEvidence, outcomeTarget] = await Promise.all([
    loadBattleTestDeepDiveEvidence(input.tutorAssignmentId),
    loadCapabilityEvidence(input.tutorAssignmentId),
    loadOutcomeTarget(input.tutorAssignmentId),
  ]);

  return {
    tutorAssignmentId: input.tutorAssignmentId,
    tutorId: String(assignment.tutor_id),
    generatedAt: new Date().toISOString(),
    comparison: buildShadowSpecialistConcordance({
      battleTestDeepDives,
      capabilityEvidence,
      outcomeTarget,
    }),
  };
}
