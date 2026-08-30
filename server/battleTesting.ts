import { v4 as uuidv4 } from "uuid";
import { supabase } from "./storage";
import { TUTOR_BATTLE_TEST_PHASES_EXACT } from "./battleTestingBanks";
import { cleanupLegacyLiveEnrollmentsForNonLiveTutor } from "./tutorAssignmentProtection";
import {
  BATTLE_TEST_SCORE_POINTS,
  TUTOR_BATTLE_TEST_PHASE_ORDER,
  computeBattleTestOutcome,
  getBattleTestStateLabel,
  type BattleTestOutcome,
  type BattleTestPhaseDefinition,
  type BattleTestPhaseScore,
  type BattleTestRepLogDetail,
  type BattleTestResponseInput,
  type BattleTestRunDetail,
  type BattleTestRunHistoryItem,
  type BattleTestingTdSummary,
  type BattleTestingTutorSummary,
  type BattleTestState,
  type BattleTestSubjectType,
  type PodBattleTestingSummary,
  type TutorBattleTestDeepDiveProgress,
  type TutorBattleTestModuleKey,
  type TutorBattleTestModuleProgress,
  type TutorBattleTestRecommendation,
  type TutorTrainingMode,
} from "@shared/battleTesting";

interface PersistBattleTestRunInput {
  podId: string;
  subjectType: BattleTestSubjectType;
  subjectUserId: string;
  tutorAssignmentId?: string | null;
  createdByUserId: string;
  templateKey: string;
  phases: BattleTestPhaseDefinition[];
  responses: BattleTestResponseInput[];
}

interface TutorBattleTestingMeta {
  assignmentId: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  studentCount: number;
}

interface TdBattleTestingMeta {
  tdId: string | null;
  tdName: string | null;
}

interface BattleTestRunRow {
  id: string;
  pod_id: string;
  subject_type: BattleTestSubjectType;
  subject_user_id: string;
  tutor_assignment_id: string | null;
  created_by_user_id: string;
  template_key: string;
  selected_phase_keys: string[];
  phase_scores: BattleTestPhaseScore[];
  weak_phases: string[];
  critical_fail_reasons: string[];
  total_questions: number;
  answered_questions: number;
  total_points: number;
  possible_points: number;
  alignment_percent: number;
  state: BattleTestState;
  has_critical_fail: boolean;
  action_required: string | null;
  completed_at: string;
  created_at: string;
}

interface BattleTestRepLogRow {
  run_id: string;
  phase_key: string;
  question_key: string;
  section: string;
  question_order: number;
  prompt: string;
  expected_answer: string;
  fail_indicators: string[];
  score: "clear" | "partial" | "fail";
  points_awarded: number;
  note: string | null;
  is_critical_fail: boolean;
}

interface TutorBattleTestStatusRow {
  tutor_assignment_id: string;
  tutor_id: string;
  mode: TutorTrainingMode | "suspended";
  module_progress: TutorBattleTestModuleProgress[];
  next_battle_tests: TutorBattleTestRecommendation[];
  last_synced_at: string;
  certification_recovery_note?: string | null;
  recovery_required_until?: string | null;
}

interface TutorBattleTestDeepDiveProgressRowDb {
  tutor_assignment_id: string;
  tutor_id: string;
  phase_key: string;
  title: string;
  module_key: string;
  module_title: string;
  historical_state: TutorBattleTestDeepDiveProgress["historicalState"];
  current_health_state: TutorBattleTestDeepDiveProgress["currentHealthState"];
  current_streak: number;
  consecutive_drift_count: number;
  latest_score: number | null;
  completed_at: string | null;
  last_tested_at: string | null;
  attempts_count: number;
  critical_flag: boolean;
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

const LIVE_RESTRICTION_DRIFT_THRESHOLD = 2;
const SUSPENSION_DRIFT_THRESHOLD = 3;
const TD_OPERATIONAL_WEAKNESS_WINDOW_DAYS = 14;
const TD_OPERATIONAL_WEAKNESS_TUTOR_THRESHOLD = 3;

const TUTOR_PHASE_TITLE_MAP = new Map(
  TUTOR_BATTLE_TEST_PHASES_EXACT.map((phase) => [phase.key, phase.title] as const)
);

const TUTOR_MODULES: Array<{
  moduleKey: TutorBattleTestModuleKey;
  title: string;
  phaseKeys: string[];
}> = [
  {
    moduleKey: "transformation_phases",
    title: "Transformation Phases",
    phaseKeys: ["clarity", "structured_execution", "controlled_discomfort", "time_pressure_stability", "topic_conditioning"],
  },
  {
    moduleKey: "session_infrastructure",
    title: "Session Infrastructure",
    phaseKeys: [
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ],
  },
];

function getTutorModuleMetaByPhaseKey(phaseKey: string) {
  return (
    TUTOR_MODULES.find((module) => module.phaseKeys.includes(phaseKey)) || {
      moduleKey: "session_infrastructure" as TutorBattleTestModuleKey,
      title: "Session Infrastructure",
      phaseKeys: [],
    }
  );
}

function getTutorBattleTestHealthState(score: number | null): TutorBattleTestDeepDiveProgress["currentHealthState"] {
  if (score == null) return "drift";
  if (score >= 96) return "locked";
  if (score >= 90) return "watchlist";
  return "drift";
}

export function buildTutorDeepDiveProgress(phaseScores: BattleTestPhaseScore[], runs: BattleTestRunRow[]): TutorBattleTestDeepDiveProgress[] {
  const progressByPhaseKey = new Map<string, TutorBattleTestDeepDiveProgress>();
  const phaseTitleByKey = new Map(phaseScores.map((phase) => [phase.phaseKey, phase.title] as const));

  const chronologicalRuns = [...runs].sort(
    (left, right) => new Date(left.completed_at).getTime() - new Date(right.completed_at).getTime()
  );

  for (const phaseKey of TUTOR_BATTLE_TEST_PHASE_ORDER) {
    const moduleMeta = getTutorModuleMetaByPhaseKey(phaseKey);
    progressByPhaseKey.set(phaseKey, {
      phaseKey,
      title: phaseTitleByKey.get(phaseKey) || TUTOR_PHASE_TITLE_MAP.get(phaseKey) || phaseKey,
      moduleKey: moduleMeta.moduleKey,
      moduleTitle: moduleMeta.title,
      historicalState: "in_progress",
      currentHealthState: "drift",
      currentStreak: 0,
      consecutiveDriftCount: 0,
      latestScore: null,
      completedAt: null,
      lastTestedAt: null,
      attemptsCount: 0,
      criticalFlag: false,
    });
  }

  const consecutiveByPhase = new Map<string, number>();
  const consecutiveDriftByPhase = new Map<string, number>();
  for (const run of chronologicalRuns) {
    for (const phase of run.phase_scores || []) {
      const entry = progressByPhaseKey.get(phase.phaseKey);
      if (!entry) continue;

      entry.attemptsCount += 1;
      entry.latestScore = roundValue(phase.percent);
      entry.lastTestedAt = run.completed_at;
      const criticalReasonMatch = run.has_critical_fail
        ? (run.critical_fail_reasons || []).some((reason) =>
            String(reason).toLowerCase().startsWith(`${phase.title.toLowerCase()}:`)
          )
        : false;
      entry.currentHealthState = criticalReasonMatch ? "drift" : getTutorBattleTestHealthState(entry.latestScore);
      // Only the most recent attempt for a phase should decide whether a critical fail is still active.
      entry.criticalFlag = criticalReasonMatch;

      const nextStreak =
        phase.percent >= 96 && !criticalReasonMatch ? (consecutiveByPhase.get(phase.phaseKey) || 0) + 1 : 0;
      consecutiveByPhase.set(phase.phaseKey, nextStreak);
      entry.currentStreak = nextStreak;

      const nextDriftCount =
        entry.currentHealthState === "drift" ? (consecutiveDriftByPhase.get(phase.phaseKey) || 0) + 1 : 0;
      consecutiveDriftByPhase.set(phase.phaseKey, nextDriftCount);
      entry.consecutiveDriftCount = nextDriftCount;

      if (nextStreak >= 3 && entry.historicalState !== "completed") {
        entry.historicalState = "completed";
        entry.completedAt = run.completed_at;
      }
    }
  }

  return TUTOR_BATTLE_TEST_PHASE_ORDER.map((phaseKey) => progressByPhaseKey.get(phaseKey)!).filter(Boolean);
}

function mapPersistedModuleProgress(rawValue: unknown): TutorBattleTestModuleProgress[] {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((entry) => {
      const item = entry as Partial<TutorBattleTestModuleProgress>;
      if (!item?.moduleKey || !item?.title) return null;
      return {
        moduleKey: item.moduleKey,
        title: String(item.title),
        completedCount: Number(item.completedCount || 0),
        totalCount: Number(item.totalCount || 0),
        completed: !!item.completed,
      } satisfies TutorBattleTestModuleProgress;
    })
    .filter((entry): entry is TutorBattleTestModuleProgress => Boolean(entry));
}

function mapPersistedRecommendations(rawValue: unknown): TutorBattleTestRecommendation[] {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((entry) => {
      const item = entry as Partial<TutorBattleTestRecommendation>;
      if (!item?.phaseKey || !item?.title || !item?.moduleKey) return null;
      return {
        phaseKey: String(item.phaseKey),
        title: String(item.title),
        moduleKey: item.moduleKey,
        priorityScore: Number(item.priorityScore || 0),
        reason: String(item.reason || ""),
      } satisfies TutorBattleTestRecommendation;
    })
    .filter((entry): entry is TutorBattleTestRecommendation => Boolean(entry));
}

function mapPersistedDeepDiveProgressRows(rows: any[]): TutorBattleTestDeepDiveProgress[] {
  return rows
    .map((rawRow) => ({
      phaseKey: String(rawRow.phase_key),
      title: String(rawRow.title),
      moduleKey: rawRow.module_key as TutorBattleTestModuleKey,
      moduleTitle: String(rawRow.module_title),
      historicalState: rawRow.historical_state as TutorBattleTestDeepDiveProgress["historicalState"],
      currentHealthState: rawRow.current_health_state as TutorBattleTestDeepDiveProgress["currentHealthState"],
      currentStreak: Number(rawRow.current_streak || 0),
      consecutiveDriftCount: Number(rawRow.consecutive_drift_count || 0),
      latestScore: rawRow.latest_score == null ? null : Number(rawRow.latest_score),
      completedAt: rawRow.completed_at ? String(rawRow.completed_at) : null,
      lastTestedAt: rawRow.last_tested_at ? String(rawRow.last_tested_at) : null,
      attemptsCount: Number(rawRow.attempts_count || 0),
      criticalFlag: !!rawRow.critical_flag,
    }))
    .sort(
      (left, right) =>
        TUTOR_BATTLE_TEST_PHASE_ORDER.indexOf(left.phaseKey as any) -
        TUTOR_BATTLE_TEST_PHASE_ORDER.indexOf(right.phaseKey as any)
    );
}

function hasAllApprovedTutorDocumentStatuses(rawStatuses: unknown): boolean {
  if (!rawStatuses || typeof rawStatuses !== "object") return false;

  const statuses = rawStatuses as Record<string, unknown>;
  return ["1", "2", "3", "4", "5", "6"].every(
    (step) => String(statuses[step] || "").trim().toLowerCase() === "approved"
  );
}

export function hasCompleteTutorDocumentation(row: any): boolean {
  const hasVerifiedFlags = !!(
    row?.doc_1_submission_verified &&
    row?.doc_2_submission_verified &&
    row?.doc_3_submission_verified &&
    row?.doc_4_submission_verified &&
    row?.doc_5_submission_verified &&
    row?.doc_6_submission_verified
  );

  if (hasVerifiedFlags) {
    return true;
  }

  return hasAllApprovedTutorDocumentStatuses(row?.documents_status || row?.documentsStatus);
}

function isLegacyApplicantModePersistenceError(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("invalid input value for enum") &&
    message.includes("applicant") &&
    (message.includes("tutor_certification_mode_old") || message.includes("tutor_certification_mode"))
  );
}

// Check if all required tutor documents are uploaded and verified
async function checkTutorDocumentationComplete(tutorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tutor_applications")
    .select("doc_1_submission_verified, doc_2_submission_verified, doc_3_submission_verified, doc_4_submission_verified, doc_5_submission_verified, doc_6_submission_verified, documents_status")
    .eq("user_id", tutorId);

  if (error || !data?.length) {
    return false;
  }

  // Any completed tutor application should unlock applicant mode.
  return data.some((row) => hasCompleteTutorDocumentation(row));
}

async function loadTutorDocumentationCompleteMap(tutorIds: string[]) {
  const uniqueTutorIds = Array.from(new Set(tutorIds.filter(Boolean)));
  const completionMap = new Map<string, boolean>();

  for (const tutorId of uniqueTutorIds) {
    completionMap.set(tutorId, false);
  }

  if (!uniqueTutorIds.length) {
    return completionMap;
  }

  const { data, error } = await supabase
    .from("tutor_applications")
    .select(
      "user_id, doc_1_submission_verified, doc_2_submission_verified, doc_3_submission_verified, doc_4_submission_verified, doc_5_submission_verified, doc_6_submission_verified, documents_status"
    )
    .in("user_id", uniqueTutorIds);

  if (error || !data) {
    return completionMap;
  }

  for (const row of data) {
    const tutorId = String((row as any).user_id || "");
    if (!tutorId) continue;
    const currentValue = completionMap.get(tutorId) ?? false;
    completionMap.set(tutorId, currentValue || hasCompleteTutorDocumentation(row));
  }

  return completionMap;
}

async function insertTutorCertificationStatusRow(payload: {
  tutor_assignment_id: string;
  tutor_id: string;
  mode: TutorTrainingMode | "suspended";
  module_progress: TutorBattleTestModuleProgress[];
  next_battle_tests: TutorBattleTestRecommendation[];
  last_synced_at: string;
  updated_at: string;
  certification_recovery_note: string | null;
  recovery_required_until: string | null;
}) {
  const { error: insertStatusError } = await supabase.from("tutor_battle_test_statuses").insert(payload);

  if (insertStatusError && payload.mode === "applicant" && isLegacyApplicantModePersistenceError(insertStatusError)) {
    const fallbackPayload = {
      ...payload,
      mode: "training" as const,
    };

    const { error: fallbackInsertError } = await supabase
      .from("tutor_battle_test_statuses")
      .insert(fallbackPayload);

    if (fallbackInsertError) {
      throw new Error(`Failed to save tutor certification status: ${fallbackInsertError.message}`);
    }

    return fallbackPayload.mode;
  }

  if (insertStatusError) {
    throw new Error(`Failed to save tutor certification status: ${insertStatusError.message}`);
  }

  return payload.mode;
}

async function syncTutorCertificationState(
  tutorAssignmentId: string,
  tutorId: string,
  currentState: BattleTestState | null
) {
  // Check if tutor has completed all documentation
  const docsComplete = await checkTutorDocumentationComplete(tutorId);

  const { data, error } = await supabase
    .from("battle_test_runs")
    .select("*")
    .eq("subject_type", "tutor")
    .eq("tutor_assignment_id", tutorAssignmentId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load tutor battle-test runs for certification sync: ${error.message}`);
  }

  const runs = (data || []).map(mapRunRow);
  const latestPhaseScoreMap = new Map<string, BattleTestPhaseScore>();
  for (const run of runs) {
    for (const phaseScore of run.phase_scores || []) {
      if (!latestPhaseScoreMap.has(phaseScore.phaseKey)) {
        latestPhaseScoreMap.set(phaseScore.phaseKey, phaseScore);
      }
    }
  }

  const phaseScores = Array.from(latestPhaseScoreMap.values());
  const deepDiveProgress = buildTutorDeepDiveProgress(phaseScores, runs);
  const moduleProgress = buildTutorModuleProgress(deepDiveProgress);
  const nextBattleTests = buildTutorNextBattleTests(deepDiveProgress);
  const syncedAt = new Date().toISOString();

  const { error: deleteProgressError } = await supabase
    .from("tutor_battle_test_deep_dive_progress")
    .delete()
    .eq("tutor_assignment_id", tutorAssignmentId);
  if (deleteProgressError) {
    throw new Error(`Failed to reset tutor deep dive progress: ${deleteProgressError.message}`);
  }

  if (deepDiveProgress.length) {
    const progressRows = deepDiveProgress.map((entry) => ({
      tutor_assignment_id: tutorAssignmentId,
      tutor_id: tutorId,
      phase_key: entry.phaseKey,
      title: entry.title,
      module_key: entry.moduleKey,
      module_title: entry.moduleTitle,
      historical_state: entry.historicalState,
      current_health_state: entry.currentHealthState,
      current_streak: entry.currentStreak,
      consecutive_drift_count: entry.consecutiveDriftCount,
      latest_score: entry.latestScore,
      completed_at: entry.completedAt,
      last_tested_at: entry.lastTestedAt,
      attempts_count: entry.attemptsCount,
      critical_flag: entry.criticalFlag,
      updated_at: syncedAt,
    }));

    const { error: insertProgressError } = await supabase
      .from("tutor_battle_test_deep_dive_progress")
      .insert(progressRows);
    if (insertProgressError) {
      throw new Error(`Failed to save tutor deep dive progress: ${insertProgressError.message}`);
    }
  }

  let recoveryNote: string | null = null;
  let recoveryRequiredUntil: string | null = null;

  const { data: previousStatus } = await supabase
    .from("tutor_battle_test_statuses")
    .select("mode")
    .eq("tutor_assignment_id", tutorAssignmentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mode = reconcileTutorTrainingMode({
    persistedMode: previousStatus?.mode as TutorTrainingMode | "suspended" | null,
    moduleProgress,
    deepDiveProgress,
    currentState,
    docsComplete,
  });

  if (previousStatus?.mode === "certified_live" && mode === "training") {
    const driftTriggers = deepDiveProgress.filter(entry => entry.consecutiveDriftCount >= LIVE_RESTRICTION_DRIFT_THRESHOLD);
    recoveryNote = `Moved back to training due to drift in: ${driftTriggers.map(d => d.title).join(", ")}. Must pass all deep dives 3x consecutively to recertify.`;
    recoveryRequiredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  }

  const { error: deleteStatusError } = await supabase
    .from("tutor_battle_test_statuses")
    .delete()
    .eq("tutor_assignment_id", tutorAssignmentId);
  if (deleteStatusError) {
    throw new Error(`Failed to reset tutor certification status: ${deleteStatusError.message}`);
  }

  const persistedMode = await insertTutorCertificationStatusRow({
    tutor_assignment_id: tutorAssignmentId,
    tutor_id: tutorId,
    mode,
    module_progress: moduleProgress,
    next_battle_tests: nextBattleTests,
    last_synced_at: syncedAt,
    updated_at: syncedAt,
    certification_recovery_note: recoveryNote,
    recovery_required_until: recoveryRequiredUntil,
  });

  const { error: assignmentModeError } = await supabase
    .from("tutor_assignments")
    .update({ operational_mode: mode })
    .eq("id", tutorAssignmentId);
  if (assignmentModeError) {
    throw new Error(`Failed to sync tutor assignment operational mode: ${assignmentModeError.message}`);
  }

  await upsertTutorPortableCertificationSnapshot(tutorAssignmentId, tutorId, persistedMode);
  await cleanupLegacyLiveEnrollmentsForNonLiveTutor(tutorId, mode);
}

export async function clearTutorAssignmentCertificationState(tutorAssignmentId: string) {
  const { error: deleteProgressError } = await supabase
    .from("tutor_battle_test_deep_dive_progress")
    .delete()
    .eq("tutor_assignment_id", tutorAssignmentId);
  if (deleteProgressError) {
    throw new Error(`Failed to clear tutor deep dive progress: ${deleteProgressError.message}`);
  }

  const { error: deleteStatusError } = await supabase
    .from("tutor_battle_test_statuses")
    .delete()
    .eq("tutor_assignment_id", tutorAssignmentId);
  if (deleteStatusError) {
    throw new Error(`Failed to clear tutor certification status: ${deleteStatusError.message}`);
  }
}

export async function upsertTutorPortableCertificationSnapshot(
  tutorAssignmentId: string,
  tutorId: string,
  persistedModeOverride?: TutorTrainingMode | "suspended"
) {
  const deepDiveSelectFields =
    "phase_key, title, module_key, module_title, historical_state, current_health_state, current_streak, consecutive_drift_count, latest_score, completed_at, last_tested_at, attempts_count, critical_flag";
  const legacyDeepDiveSelectFields =
    "phase_key, title, module_key, module_title, historical_state, current_health_state, current_streak, latest_score, completed_at, last_tested_at, attempts_count, critical_flag";

  let { data: deepDiveRows, error: deepDiveError } = await supabase
    .from("tutor_battle_test_deep_dive_progress")
    .select(deepDiveSelectFields)
    .eq("tutor_assignment_id", tutorAssignmentId);

  if (deepDiveError?.message?.includes("consecutive_drift_count")) {
    const legacyQuery = await supabase
      .from("tutor_battle_test_deep_dive_progress")
      .select(legacyDeepDiveSelectFields)
      .eq("tutor_assignment_id", tutorAssignmentId);

    deepDiveRows = (legacyQuery.data || []).map((row) => ({
      ...row,
      consecutive_drift_count: 0,
    }));
    deepDiveError = legacyQuery.error;
  }

  if (deepDiveError) {
    throw new Error(`Failed to load tutor deep dive progress for portable snapshot: ${deepDiveError.message}`);
  }

  const { data: statusRow, error: statusError } = await supabase
    .from("tutor_battle_test_statuses")
    .select(
      "mode, module_progress, next_battle_tests, last_synced_at, certification_recovery_note, recovery_required_until"
    )
    .eq("tutor_assignment_id", tutorAssignmentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (statusError) {
    throw new Error(`Failed to load tutor certification status for portable snapshot: ${statusError.message}`);
  }

  const effectiveStatusMode =
    persistedModeOverride ||
    (statusRow?.mode ? (statusRow.mode as TutorTrainingMode | "suspended") : null);

  if (!effectiveStatusMode && !statusRow) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    tutor_id: tutorId,
    source_assignment_id: tutorAssignmentId,
    mode: effectiveStatusMode || "training",
    module_progress: statusRow?.module_progress || [],
    next_battle_tests: statusRow?.next_battle_tests || [],
    deep_dive_progress: deepDiveRows || [],
    certification_recovery_note: (statusRow as any)?.certification_recovery_note || null,
    recovery_required_until: (statusRow as any)?.recovery_required_until || null,
    last_synced_at: statusRow?.last_synced_at || nowIso,
    updated_at: nowIso,
  };

  const { error: upsertError } = await supabase
    .from("tutor_portable_certification_snapshots")
    .upsert(payload, { onConflict: "tutor_id" });

  if (upsertError) {
    throw new Error(`Failed to save tutor portable certification snapshot: ${upsertError.message}`);
  }

  return payload;
}

export async function hydrateTutorAssignmentFromPortableSnapshot(tutorAssignmentId: string, tutorId: string) {
  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("tutor_portable_certification_snapshots")
    .select(
      "mode, module_progress, next_battle_tests, deep_dive_progress, certification_recovery_note, recovery_required_until, last_synced_at"
    )
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`Failed to load tutor portable certification snapshot: ${snapshotError.message}`);
  }

  if (!snapshotRow) {
    return false;
  }

  await clearTutorAssignmentCertificationState(tutorAssignmentId);

  const syncedAt = new Date().toISOString();
  const deepDiveProgress = Array.isArray((snapshotRow as any).deep_dive_progress)
    ? (snapshotRow as any).deep_dive_progress
    : [];

  if (deepDiveProgress.length) {
    const progressRows = deepDiveProgress.map((entry: any) => ({
      tutor_assignment_id: tutorAssignmentId,
      tutor_id: tutorId,
      phase_key: entry.phase_key || entry.phaseKey,
      title: entry.title,
      module_key: entry.module_key || entry.moduleKey,
      module_title: entry.module_title || entry.moduleTitle,
      historical_state: entry.historical_state || entry.historicalState || "in_progress",
      current_health_state: entry.current_health_state || entry.currentHealthState || "drift",
      current_streak: entry.current_streak ?? entry.currentStreak ?? 0,
      consecutive_drift_count: entry.consecutive_drift_count ?? entry.consecutiveDriftCount ?? 0,
      latest_score: entry.latest_score ?? entry.latestScore ?? null,
      completed_at: entry.completed_at || entry.completedAt || null,
      last_tested_at: entry.last_tested_at || entry.lastTestedAt || null,
      attempts_count: entry.attempts_count ?? entry.attemptsCount ?? 0,
      critical_flag: Boolean(entry.critical_flag ?? entry.criticalFlag),
      updated_at: syncedAt,
    }));

    const { error: insertProgressError } = await supabase
      .from("tutor_battle_test_deep_dive_progress")
      .insert(progressRows);
    if (insertProgressError) {
      throw new Error(`Failed to restore tutor deep dive progress: ${insertProgressError.message}`);
    }
  }

  const mode = (snapshotRow.mode || "training") as TutorTrainingMode;
  await insertTutorCertificationStatusRow({
    tutor_assignment_id: tutorAssignmentId,
    tutor_id: tutorId,
    mode,
    module_progress: (snapshotRow as any).module_progress || [],
    next_battle_tests: (snapshotRow as any).next_battle_tests || [],
    last_synced_at: (snapshotRow as any).last_synced_at || syncedAt,
    certification_recovery_note: (snapshotRow as any).certification_recovery_note || null,
    recovery_required_until: (snapshotRow as any).recovery_required_until || null,
    updated_at: syncedAt,
  });

  const { error: assignmentModeError } = await supabase
    .from("tutor_assignments")
    .update({ operational_mode: mode })
    .eq("id", tutorAssignmentId);

  if (assignmentModeError) {
    throw new Error(`Failed to restore tutor assignment operational mode: ${assignmentModeError.message}`);
  }

  return true;
}

async function loadTutorCertificationSnapshots(assignmentIds: string[]) {
  if (!assignmentIds.length) {
    return {
      statusByAssignmentId: new Map<string, TutorBattleTestStatusRow>(),
      deepDiveProgressByAssignmentId: new Map<string, TutorBattleTestDeepDiveProgress[]>(),
    };
  }

  const { data: statusRows, error: statusError } = await supabase
    .from("tutor_battle_test_statuses")
    .select("tutor_assignment_id, tutor_id, mode, module_progress, next_battle_tests, last_synced_at, certification_recovery_note, recovery_required_until")
    .in("tutor_assignment_id", assignmentIds);
  if (statusError) {
    throw new Error(`Failed to load tutor certification statuses: ${statusError.message}`);
  }

  const deepDiveSelectFields =
    "tutor_assignment_id, tutor_id, phase_key, title, module_key, module_title, historical_state, current_health_state, current_streak, consecutive_drift_count, latest_score, completed_at, last_tested_at, attempts_count, critical_flag";
  const legacyDeepDiveSelectFields =
    "tutor_assignment_id, tutor_id, phase_key, title, module_key, module_title, historical_state, current_health_state, current_streak, latest_score, completed_at, last_tested_at, attempts_count, critical_flag";

  let { data: deepDiveRows, error: deepDiveError } = await supabase
    .from("tutor_battle_test_deep_dive_progress")
    .select(deepDiveSelectFields)
    .in("tutor_assignment_id", assignmentIds);

  if (deepDiveError?.message?.includes("consecutive_drift_count")) {
    const legacyQuery = await supabase
      .from("tutor_battle_test_deep_dive_progress")
      .select(legacyDeepDiveSelectFields)
      .in("tutor_assignment_id", assignmentIds);

    deepDiveRows = (legacyQuery.data || []).map((row) => ({
      ...row,
      consecutive_drift_count: 0,
    }));
    deepDiveError = legacyQuery.error;
  }

  if (deepDiveError) {
    throw new Error(`Failed to load tutor deep dive certification progress: ${deepDiveError.message}`);
  }

  const statusByAssignmentId = new Map<string, TutorBattleTestStatusRow>();
  for (const rawRow of statusRows || []) {
    statusByAssignmentId.set(String(rawRow.tutor_assignment_id), {
      tutor_assignment_id: String(rawRow.tutor_assignment_id),
      tutor_id: String(rawRow.tutor_id),
      mode: rawRow.mode as TutorTrainingMode | "suspended",
      module_progress: mapPersistedModuleProgress(rawRow.module_progress),
      next_battle_tests: mapPersistedRecommendations(rawRow.next_battle_tests),
      last_synced_at: String(rawRow.last_synced_at),
      certification_recovery_note: rawRow.certification_recovery_note,
      recovery_required_until: rawRow.recovery_required_until,
    });
  }

  const groupedDeepDiveRows = new Map<string, TutorBattleTestDeepDiveProgress[]>();
  const rowsByAssignment = new Map<string, any[]>();
  for (const rawRow of deepDiveRows || []) {
    const assignmentId = String(rawRow.tutor_assignment_id);
    if (!rowsByAssignment.has(assignmentId)) rowsByAssignment.set(assignmentId, []);
    rowsByAssignment.get(assignmentId)!.push(rawRow);
  }
  for (const [assignmentId, rows] of rowsByAssignment.entries()) {
    groupedDeepDiveRows.set(assignmentId, mapPersistedDeepDiveProgressRows(rows));
  }

  return {
    statusByAssignmentId,
    deepDiveProgressByAssignmentId: groupedDeepDiveRows,
  };
}

function buildTutorModuleProgress(deepDiveProgress: TutorBattleTestDeepDiveProgress[]): TutorBattleTestModuleProgress[] {
  return TUTOR_MODULES.map((module) => {
    const moduleDeepDives = deepDiveProgress.filter((entry) => entry.moduleKey === module.moduleKey);
    const completedCount = moduleDeepDives.filter((entry) => entry.historicalState === "completed").length;
    return {
      moduleKey: module.moduleKey,
      title: module.title,
      completedCount,
      totalCount: module.phaseKeys.length,
      completed: completedCount === module.phaseKeys.length,
    };
  });
}

function chooseMoreCompleteModuleProgress(
  computedModuleProgress: TutorBattleTestModuleProgress[],
  persistedModuleProgress: TutorBattleTestModuleProgress[]
): TutorBattleTestModuleProgress[] {
  const persistedByKey = new Map(persistedModuleProgress.map((entry) => [entry.moduleKey, entry] as const));
  const computedWins = computedModuleProgress.some((computed) => {
    const persisted = persistedByKey.get(computed.moduleKey);
    return persisted == null || computed.completedCount > persisted.completedCount;
  });
  return computedWins ? computedModuleProgress : persistedModuleProgress;
}

export function choosePreferredDeepDiveProgress(
  computedDeepDiveProgress: TutorBattleTestDeepDiveProgress[],
  persistedDeepDiveProgress: TutorBattleTestDeepDiveProgress[]
): TutorBattleTestDeepDiveProgress[] {
  if (!persistedDeepDiveProgress.length) {
    return computedDeepDiveProgress;
  }

  const computedAttempts = computedDeepDiveProgress.reduce((sum, entry) => sum + entry.attemptsCount, 0);
  const persistedAttempts = persistedDeepDiveProgress.reduce((sum, entry) => sum + entry.attemptsCount, 0);

  if (computedAttempts === 0) {
    return persistedDeepDiveProgress;
  }

  if (persistedAttempts === 0) {
    return computedDeepDiveProgress;
  }

  const getLatestTestedAt = (progress: TutorBattleTestDeepDiveProgress[]) =>
    progress.reduce<number | null>((latest, entry) => {
      if (!entry.lastTestedAt) return latest;
      const timestamp = new Date(entry.lastTestedAt).getTime();
      if (Number.isNaN(timestamp)) return latest;
      return latest == null ? timestamp : Math.max(latest, timestamp);
    }, null);

  const computedLatest = getLatestTestedAt(computedDeepDiveProgress);
  const persistedLatest = getLatestTestedAt(persistedDeepDiveProgress);

  if (computedLatest != null && persistedLatest != null && computedLatest !== persistedLatest) {
    return computedLatest > persistedLatest ? computedDeepDiveProgress : persistedDeepDiveProgress;
  }

  if (computedAttempts !== persistedAttempts) {
    return computedAttempts > persistedAttempts ? computedDeepDiveProgress : persistedDeepDiveProgress;
  }

  return computedDeepDiveProgress;
}

function deriveTutorTrainingMode(
  moduleProgress: TutorBattleTestModuleProgress[],
  deepDiveProgress: TutorBattleTestDeepDiveProgress[],
  currentState: BattleTestState | null,
  docsComplete: boolean
): TutorTrainingMode {
  // Applicant mode: blocks all access until documentation is complete
  if (!docsComplete) {
    return "applicant";
  }

  const testedDeepDiveProgress = deepDiveProgress.filter((entry) => entry.attemptsCount > 0);
  const transformationComplete = moduleProgress.find((entry) => entry.moduleKey === "transformation_phases")?.completed || false;
  const sessionComplete = moduleProgress.find((entry) => entry.moduleKey === "session_infrastructure")?.completed || false;
  const fullyCertified = transformationComplete && sessionComplete;
  const hasSuspensionTrigger = testedDeepDiveProgress.some(
    (entry) => entry.consecutiveDriftCount >= SUSPENSION_DRIFT_THRESHOLD
  );
  const hasRetrainingTrigger = testedDeepDiveProgress.some(
    (entry) => entry.consecutiveDriftCount >= LIVE_RESTRICTION_DRIFT_THRESHOLD
  );

  if (fullyCertified && hasSuspensionTrigger) {
    return "suspended";
  }

  if (fullyCertified && hasRetrainingTrigger) {
    return "training";
  }

  if (testedDeepDiveProgress.some((entry) => entry.currentHealthState === "drift" || entry.criticalFlag) || currentState === "fail") {
    return "watchlist";
  }

  if (transformationComplete && sessionComplete) return "trial";
  if (transformationComplete) return "sandbox";
  return "training";
}

export function deriveTutorAuditStateFromProgress(
  deepDiveProgress: TutorBattleTestDeepDiveProgress[],
  fallback: BattleTestState | null
): BattleTestState | null {
  const testedDeepDiveProgress = deepDiveProgress.filter((entry) => entry.attemptsCount > 0);
  if (!testedDeepDiveProgress.length) {
    return fallback;
  }

  if (
    testedDeepDiveProgress.some(
      (entry) => entry.criticalFlag || entry.currentHealthState === "drift" || (entry.latestScore != null && entry.latestScore < 90)
    )
  ) {
    return "fail";
  }

  if (
    testedDeepDiveProgress.some(
      (entry) =>
        entry.currentHealthState === "watchlist" ||
        (entry.latestScore != null && entry.latestScore >= 90 && entry.latestScore < 96)
    )
  ) {
    return "watchlist";
  }

  return "locked";
}

export function reconcileTutorTrainingMode({
  persistedMode,
  moduleProgress,
  deepDiveProgress,
  currentState,
  docsComplete,
}: {
  persistedMode?: TutorTrainingMode | "suspended" | null;
  moduleProgress: TutorBattleTestModuleProgress[];
  deepDiveProgress: TutorBattleTestDeepDiveProgress[];
  currentState: BattleTestState | null;
  docsComplete: boolean;
}): TutorTrainingMode {
  const computedMode = deriveTutorTrainingMode(moduleProgress, deepDiveProgress, currentState, docsComplete);

  if (!docsComplete) {
    return "applicant";
  }

  if (!persistedMode) {
    return computedMode;
  }

  if (persistedMode === "applicant" && docsComplete) {
    return computedMode;
  }

  if (
    (persistedMode === "trial" || persistedMode === "certified_live") &&
    (computedMode === "watchlist" || computedMode === "training" || computedMode === "suspended")
  ) {
    return computedMode;
  }

  if (
    (persistedMode === "watchlist" || persistedMode === "training") &&
    (computedMode === "sandbox" || computedMode === "trial")
  ) {
    return computedMode;
  }

  // Preparation reconciliation cannot issue or revoke a final certification.
  // Existing Certified Live tutors are grandfathered unless a health rule
  // explicitly moves them into recovery, watchlist, or suspension.
  if (persistedMode === "certified_live" && computedMode === "trial") {
    return "certified_live";
  }

  return persistedMode === "suspended" ? "suspended" : persistedMode;
}

function buildTutorNextBattleTests(
  deepDiveProgress: TutorBattleTestDeepDiveProgress[],
  limit = 3
): TutorBattleTestRecommendation[] {
  const now = Date.now();
  const ranked = deepDiveProgress.map((entry) => {
    const daysSinceLastTest = entry.lastTestedAt
      ? Math.max(0, Math.floor((now - new Date(entry.lastTestedAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 30;

    let priorityScore = 0;
    const reasons: string[] = [];

    if (entry.historicalState !== "completed") {
      priorityScore += 100;
      reasons.push("not completed");
    }
    if (entry.currentStreak === 2) {
      priorityScore += 30;
      reasons.push("one pass away from completion");
    } else if (entry.currentStreak === 0 && entry.historicalState !== "completed") {
      priorityScore += 18;
      reasons.push("streak needs rebuilding");
    }
    if (entry.latestScore != null && entry.latestScore < 96) {
      priorityScore += 24;
      reasons.push(entry.latestScore < 90 ? "recent drift" : "watchlist retest");
    }
    if (entry.criticalFlag) {
      priorityScore += 28;
      reasons.push("critical fail history");
    }
    priorityScore += Math.min(daysSinceLastTest, 30);
    if (daysSinceLastTest >= 14) {
      reasons.push("longest time since last tested");
    }
    if (entry.historicalState === "completed" && entry.latestScore != null && entry.latestScore >= 96) {
      priorityScore += 6;
      if (!reasons.length) reasons.push("maintenance retest");
    }

    return {
      phaseKey: entry.phaseKey,
      title: entry.title,
      moduleKey: entry.moduleKey,
      priorityScore,
      reason: reasons[0] || "maintenance retest",
    } satisfies TutorBattleTestRecommendation;
  });

  return ranked.sort((left, right) => right.priorityScore - left.priorityScore).slice(0, limit);
}

function getTutorCertificationActionRequired(
  mode: TutorTrainingMode,
  deepDiveProgress: TutorBattleTestDeepDiveProgress[],
  fallback: string | null
) {
  if (mode === "suspended") {
    return "Suspended after repeated drift. Return to retraining before live responsibility can resume.";
  }

  if (
    mode === "training" &&
    deepDiveProgress.every((entry) => entry.historicalState === "completed") &&
    deepDiveProgress.some((entry) => entry.consecutiveDriftCount >= LIVE_RESTRICTION_DRIFT_THRESHOLD)
  ) {
    return "Live assignments are restricted. Tutor has been moved back to retraining mode after repeated drift.";
  }

  return fallback;
}

function getAggregateBattleTestActionRequired(state: BattleTestState, hasCriticalFail: boolean, isIncomplete = false) {
  if (hasCriticalFail || state === "fail") {
    return "Remove from live responsibility and recondition before returning.";
  }
  if (isIncomplete) {
    return "Complete the remaining tutor battle-test audits.";
  }
  if (state === "watchlist") {
    return "Correct immediately and retest in the next cycle.";
  }
  return "Continue. Eligible for greater responsibility if other operating criteria hold.";
}

function deriveTutorSummaryFromPhaseScores(
  phaseScores: BattleTestPhaseScore[],
  hasCriticalFail: boolean
): Pick<BattleTestingTutorSummary, "alignmentPercent" | "state" | "actionRequired" | "hasCriticalFail"> {
  if (!phaseScores.length) {
    return {
      alignmentPercent: null,
      state: null,
      actionRequired: null,
      hasCriticalFail,
    };
  }

  const pointsEarned = phaseScores.reduce((sum, phase) => sum + phase.pointsEarned, 0);
  const pointsPossible = phaseScores.reduce((sum, phase) => sum + phase.pointsPossible, 0);
  const alignmentPercent = pointsPossible > 0 ? roundValue((pointsEarned / pointsPossible) * 100) : 0;
  const anyPhaseFailed = phaseScores.some((phase) => phase.percent < 90);
  const anyPhaseWatchlist = phaseScores.some((phase) => phase.percent >= 90 && phase.percent < 95);
  const isIncomplete = phaseScores.length < TUTOR_BATTLE_TEST_PHASE_ORDER.length;

  let state: BattleTestState;
  if (hasCriticalFail || anyPhaseFailed || alignmentPercent < 90) {
    state = "fail";
  } else if (anyPhaseWatchlist || alignmentPercent < 95) {
    state = "watchlist";
  } else {
    state = "locked";
  }

  return {
    alignmentPercent,
    state,
    actionRequired: getAggregateBattleTestActionRequired(state, hasCriticalFail, isIncomplete),
    hasCriticalFail,
  };
}

function normalizePhaseScores(rawValue: unknown): BattleTestPhaseScore[] {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((entry) => {
      const item = entry as Partial<BattleTestPhaseScore>;
      if (!item?.phaseKey || !item?.title) return null;
      return {
        phaseKey: String(item.phaseKey),
        title: String(item.title),
        pointsEarned: Number(item.pointsEarned || 0),
        pointsPossible: Number(item.pointsPossible || 0),
        percent: Number(item.percent || 0),
        state: (item.state as BattleTestState) || "fail",
      };
    })
    .filter((entry): entry is BattleTestPhaseScore => Boolean(entry));
}

function normalizeStringArray(rawValue: unknown) {
  return Array.isArray(rawValue) ? rawValue.map((item) => String(item)) : [];
}

function mapRunRow(rawRow: any): BattleTestRunRow {
  return {
    id: String(rawRow.id),
    pod_id: String(rawRow.pod_id),
    subject_type: rawRow.subject_type as BattleTestSubjectType,
    subject_user_id: String(rawRow.subject_user_id),
    tutor_assignment_id: rawRow.tutor_assignment_id ? String(rawRow.tutor_assignment_id) : null,
    created_by_user_id: String(rawRow.created_by_user_id),
    template_key: String(rawRow.template_key),
    selected_phase_keys: normalizeStringArray(rawRow.selected_phase_keys),
    phase_scores: normalizePhaseScores(rawRow.phase_scores),
    weak_phases: normalizeStringArray(rawRow.weak_phases),
    critical_fail_reasons: normalizeStringArray(rawRow.critical_fail_reasons),
    total_questions: Number(rawRow.total_questions || 0),
    answered_questions: Number(rawRow.answered_questions || 0),
    total_points: Number(rawRow.total_points || 0),
    possible_points: Number(rawRow.possible_points || 0),
    alignment_percent: Number(rawRow.alignment_percent || 0),
    state: (rawRow.state as BattleTestState) || "fail",
    has_critical_fail: !!rawRow.has_critical_fail,
    action_required: rawRow.action_required ? String(rawRow.action_required) : null,
    completed_at: String(rawRow.completed_at),
    created_at: String(rawRow.created_at),
  };
}

function mapRepLogRow(rawRow: any): BattleTestRepLogRow {
  return {
    run_id: String(rawRow.run_id),
    phase_key: String(rawRow.phase_key),
    question_key: String(rawRow.question_key),
    section: String(rawRow.section),
    question_order: Number(rawRow.question_order || 0),
    prompt: String(rawRow.prompt),
    expected_answer: String(rawRow.expected_answer),
    fail_indicators: normalizeStringArray(rawRow.fail_indicators),
    score: rawRow.score as "clear" | "partial" | "fail",
    points_awarded: Number(rawRow.points_awarded || 0),
    note: rawRow.note ? String(rawRow.note) : null,
    is_critical_fail: !!rawRow.is_critical_fail,
  };
}

function getEmptySummary(podId: string): PodBattleTestingSummary {
  return {
    podId,
    weeklyAlignmentPercent: null,
    driftIncidents: 0,
    lockedTutors: 0,
    watchlistTutors: 0,
    failTutors: 0,
    tdOperationalFlags: [],
    phaseWeaknesses: [],
    phaseScores: [],
    tutorSummaries: [],
    tdSummary: null,
  };
}

export async function persistBattleTestRun(input: PersistBattleTestRunInput) {
  const { podId, subjectType, subjectUserId, tutorAssignmentId, createdByUserId, templateKey, phases, responses } = input;
  if (!phases.length) {
    throw new Error("At least one battle-testing phase is required.");
  }

  const expectedQuestionKeys = new Set(
    phases.flatMap((phase) => phase.questions.map((question) => `${phase.key}:${question.key}`))
  );

  const responseMap = validateBattleTestResponses(subjectType, phases, responses);
  if (responseMap.size !== expectedQuestionKeys.size) {
    throw new Error("Every battle-testing question must be scored before submission.");
  }

  for (const expectedQuestionKey of expectedQuestionKeys) {
    if (!responseMap.has(expectedQuestionKey)) {
      throw new Error(`Missing battle-testing response: ${expectedQuestionKey}`);
    }
  }

  for (const response of responseMap.values()) {
    if ((response.score === "partial" || response.score === "fail") && !String(response.note || "").trim()) {
      throw new Error("Partial and fail scores require a note.");
    }
  }

  const normalizedResponses = Array.from(responseMap.values());
  const outcome = computeBattleTestOutcome(subjectType, phases, normalizedResponses);
  const completedAt = new Date().toISOString();
  const selectedPhaseKeys = phases.map((phase) => phase.key);

  const runInsert = {
    id: uuidv4(),
    pod_id: podId,
    subject_type: subjectType,
    subject_user_id: subjectUserId,
    tutor_assignment_id: tutorAssignmentId || null,
    created_by_user_id: createdByUserId,
    template_key: templateKey,
    selected_phase_keys: selectedPhaseKeys,
    phase_scores: outcome.phaseScores,
    weak_phases: outcome.weakPhases,
    critical_fail_reasons: outcome.criticalFailReasons,
    total_questions: outcome.totalQuestions,
    answered_questions: outcome.answeredQuestions,
    total_points: outcome.totalPoints,
    possible_points: outcome.possiblePoints,
    alignment_percent: outcome.alignmentPercent,
    state: outcome.state,
    has_critical_fail: outcome.hasCriticalFail,
    action_required: outcome.actionRequired,
    completed_at: completedAt,
  };

  const { data: runRow, error: runError } = await supabase.from("battle_test_runs").insert(runInsert).select("*").single();
  if (runError) {
    throw new Error(`Failed to save battle test run: ${runError.message}`);
  }

  try {
    const repLogRows = phases.flatMap((phase) =>
      phase.questions.map((question, index) => {
        const response = responseMap.get(`${phase.key}:${question.key}`);
        if (!response) {
          throw new Error(`Missing battle-testing response: ${phase.key}:${question.key}`);
        }
        return {
          id: uuidv4(),
          run_id: runRow.id,
          phase_key: phase.key,
          question_key: question.key,
          section: question.section,
          question_order: index,
          prompt: question.prompt,
          expected_answer: question.expectedAnswer,
          fail_indicators: question.failIndicators,
          score: response.score,
          points_awarded: BATTLE_TEST_SCORE_POINTS[response.score],
          note: response.note?.trim() || null,
          is_critical_fail:
            !!response.isCriticalFail || (!!question.autoCriticalOnFail && response.score === "fail"),
        };
      })
    );

    const { error: repLogError } = await supabase.from("battle_test_rep_logs").insert(repLogRows);
    if (repLogError) {
      throw new Error(`Failed to save battle test logs: ${repLogError.message}`);
    }

    if (subjectType === "tutor" && tutorAssignmentId) {
      await syncTutorCertificationState(tutorAssignmentId, subjectUserId, outcome.state);
    }
  } catch (repLogFailure) {
    await supabase.from("battle_test_runs").delete().eq("id", runRow.id);
    throw repLogFailure instanceof Error
      ? repLogFailure
      : new Error("Failed to save battle test logs.");
  }

  return {
    runId: String(runRow.id),
    completedAt,
    outcome,
  };
}

export async function buildPodBattleTestingSummary(
  podId: string,
  tutorMeta: TutorBattleTestingMeta[],
  tdMeta?: TdBattleTestingMeta | null,
) {
  const summary = getEmptySummary(podId);
  const { data, error } = await supabase
    .from("battle_test_runs")
    .select("*")
    .eq("pod_id", podId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load battle-testing runs: ${error.message}`);
  }

  const runRows = (data || []).map(mapRunRow);
  const latestTutorRunByAssignment = new Map<string, BattleTestRunRow>();
  const latestTutorPhaseScoresByAssignment = new Map<string, Map<string, BattleTestPhaseScore>>();
  const latestTutorPhaseRunByAssignment = new Map<string, Map<string, BattleTestRunRow>>();
  const tutorRunsByAssignment = new Map<string, BattleTestRunRow[]>();
  const phaseAggregates = new Map<string, { title: string; total: number; count: number; weakCount: number }>();
  const { statusByAssignmentId, deepDiveProgressByAssignmentId } = await loadTutorCertificationSnapshots(
    tutorMeta.map((entry) => entry.assignmentId)
  );
  const docsCompleteByTutorId = await loadTutorDocumentationCompleteMap(tutorMeta.map((entry) => entry.tutorId));

  for (const run of runRows) {
    if (run.subject_type !== "tutor") continue;
    const assignmentKey = run.tutor_assignment_id || run.subject_user_id;
    if (!tutorRunsByAssignment.has(assignmentKey)) {
      tutorRunsByAssignment.set(assignmentKey, []);
    }
    tutorRunsByAssignment.get(assignmentKey)!.push(run);
    if (!latestTutorRunByAssignment.has(assignmentKey)) {
      latestTutorRunByAssignment.set(assignmentKey, run);
      for (const phase of run.phase_scores) {
        const current = phaseAggregates.get(phase.phaseKey) || {
          title: phase.title,
          total: 0,
          count: 0,
          weakCount: 0,
        };
        current.title = phase.title;
        current.total += phase.percent;
        current.count += 1;
        if (phase.percent < 95) current.weakCount += 1;
        phaseAggregates.set(phase.phaseKey, current);
      }
    }

    if (!latestTutorPhaseScoresByAssignment.has(assignmentKey)) {
      latestTutorPhaseScoresByAssignment.set(assignmentKey, new Map<string, BattleTestPhaseScore>());
    }
    if (!latestTutorPhaseRunByAssignment.has(assignmentKey)) {
      latestTutorPhaseRunByAssignment.set(assignmentKey, new Map<string, BattleTestRunRow>());
    }
    const phaseScoreMap = latestTutorPhaseScoresByAssignment.get(assignmentKey)!;
    const phaseRunMap = latestTutorPhaseRunByAssignment.get(assignmentKey)!;
    for (const phase of run.phase_scores) {
      if (!phaseScoreMap.has(phase.phaseKey)) {
        phaseScoreMap.set(phase.phaseKey, phase);
        phaseRunMap.set(phase.phaseKey, run);
      }
    }
  }

  summary.tutorSummaries = tutorMeta.map((meta) => {
    const latestRun = latestTutorRunByAssignment.get(meta.assignmentId) || latestTutorRunByAssignment.get(meta.tutorId);
    const latestPhaseScoreMap =
      latestTutorPhaseScoresByAssignment.get(meta.assignmentId) ||
      latestTutorPhaseScoresByAssignment.get(meta.tutorId) ||
      new Map<string, BattleTestPhaseScore>();
    const latestPhaseRunMap =
      latestTutorPhaseRunByAssignment.get(meta.assignmentId) ||
      latestTutorPhaseRunByAssignment.get(meta.tutorId) ||
      new Map<string, BattleTestRunRow>();
    const phaseScores = Array.from(latestPhaseScoreMap.values());
    const contributingRuns =
      tutorRunsByAssignment.get(meta.assignmentId) ||
      tutorRunsByAssignment.get(meta.tutorId) ||
      Array.from(latestPhaseRunMap.values());
    const deepDiveProgress = buildTutorDeepDiveProgress(phaseScores, contributingRuns);
    const moduleProgress = buildTutorModuleProgress(deepDiveProgress);
    const derivedLastAuditAt = contributingRuns.length
      ? contributingRuns
          .map((run) => new Date(run.completed_at).getTime())
          .reduce((latest, current) => Math.max(latest, current), 0)
      : null;
    const persistedStatus = statusByAssignmentId.get(meta.assignmentId);
    const persistedDeepDiveProgress = deepDiveProgressByAssignmentId.get(meta.assignmentId) || [];
    const effectiveDeepDiveProgress = choosePreferredDeepDiveProgress(deepDiveProgress, persistedDeepDiveProgress);
    const derivedHasCriticalFail = effectiveDeepDiveProgress.some((entry) => entry.criticalFlag);
    const derivedSummary = deriveTutorSummaryFromPhaseScores(phaseScores, derivedHasCriticalFail);
    const persistedModuleProgress = persistedStatus?.module_progress;
    const effectiveModuleProgress =
      Array.isArray(persistedModuleProgress) && persistedModuleProgress.length > 0
        ? chooseMoreCompleteModuleProgress(moduleProgress, persistedModuleProgress)
        : moduleProgress;
    const effectiveState = deriveTutorAuditStateFromProgress(
      effectiveDeepDiveProgress,
      derivedSummary.state || latestRun?.state || null
    );
    const derivedMode = reconcileTutorTrainingMode({
      persistedMode: persistedStatus?.mode,
      moduleProgress: effectiveModuleProgress,
      deepDiveProgress: effectiveDeepDiveProgress,
      currentState: effectiveState,
      docsComplete: docsCompleteByTutorId.get(meta.tutorId) ?? false,
    });
    const tutorSummary: BattleTestingTutorSummary = {
      assignmentId: meta.assignmentId,
      tutorId: meta.tutorId,
      tutorName: meta.tutorName,
      tutorEmail: meta.tutorEmail,
      studentCount: meta.studentCount,
      alignmentPercent: derivedSummary.alignmentPercent ?? (latestRun ? roundValue(latestRun.alignment_percent) : null),
      state: effectiveState,
      hasCriticalFail: derivedSummary.hasCriticalFail,
      actionRequired: getTutorCertificationActionRequired(
        derivedMode,
        effectiveDeepDiveProgress,
        derivedSummary.actionRequired || latestRun?.action_required || null
      ),
      lastAuditAt: derivedLastAuditAt ? new Date(derivedLastAuditAt).toISOString() : latestRun?.completed_at || null,
      phaseScores,
      mode: derivedMode,
      moduleProgress: effectiveModuleProgress,
      deepDiveProgress: effectiveDeepDiveProgress,
      nextBattleTests: persistedStatus?.next_battle_tests || buildTutorNextBattleTests(deepDiveProgress),
      certificationRecoveryNote: persistedStatus?.certification_recovery_note || null,
      recoveryRequiredUntil: persistedStatus?.recovery_required_until || null,
    };
    if (tutorSummary.state === "locked") summary.lockedTutors += 1;
    if (tutorSummary.state === "watchlist") summary.watchlistTutors += 1;
    if (tutorSummary.state === "fail") summary.failTutors += 1;
    return tutorSummary;
  });

  const tutorPercents = summary.tutorSummaries
    .map((entry) => entry.alignmentPercent)
    .filter((value): value is number => typeof value === "number");
  if (tutorPercents.length) {
    summary.weeklyAlignmentPercent = roundValue(
      tutorPercents.reduce((sum, value) => sum + value, 0) / tutorPercents.length
    );
  }

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  summary.driftIncidents = runRows.filter((run) => {
    const completedAt = new Date(run.completed_at).getTime();
    return (
      run.subject_type === "tutor" &&
      completedAt >= recentCutoff &&
      (run.state !== "locked" || run.has_critical_fail)
    );
  }).length;

  const tdOperationalFlagCutoff = Date.now() - TD_OPERATIONAL_WEAKNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const tdOperationalFlagGroups = new Map<string, { title: string; tutorIds: Set<string> }>();
  for (const tutorSummary of summary.tutorSummaries) {
    for (const entry of tutorSummary.deepDiveProgress || []) {
      if (entry.currentHealthState !== "drift" || !entry.lastTestedAt) continue;
      if (new Date(entry.lastTestedAt).getTime() < tdOperationalFlagCutoff) continue;

      const current = tdOperationalFlagGroups.get(entry.phaseKey) || {
        title: entry.title,
        tutorIds: new Set<string>(),
      };
      current.title = entry.title;
      current.tutorIds.add(tutorSummary.tutorId);
      tdOperationalFlagGroups.set(entry.phaseKey, current);
    }
  }
  summary.tdOperationalFlags = Array.from(tdOperationalFlagGroups.entries())
    .map(([phaseKey, group]) => ({
      phaseKey,
      title: group.title,
      affectedTutors: group.tutorIds.size,
      windowDays: TD_OPERATIONAL_WEAKNESS_WINDOW_DAYS,
    }))
    .filter((entry) => entry.affectedTutors >= TD_OPERATIONAL_WEAKNESS_TUTOR_THRESHOLD)
    .sort((left, right) => right.affectedTutors - left.affectedTutors);

  summary.phaseWeaknesses = Array.from(phaseAggregates.entries())
    .map(([phaseKey, aggregate]) => ({
      phaseKey,
      title: aggregate.title,
      averagePercent: aggregate.count ? roundValue(aggregate.total / aggregate.count) : 0,
      affectedTutors: aggregate.weakCount,
    }))
    .filter((phase) => phase.affectedTutors > 0)
    .sort((left, right) => left.averagePercent - right.averagePercent);

  summary.phaseScores = Array.from(phaseAggregates.entries()).map(([phaseKey, aggregate]) => {
    const percent = aggregate.count ? roundValue(aggregate.total / aggregate.count) : 0;
    return {
      phaseKey,
      title: aggregate.title,
      pointsEarned: percent,
      pointsPossible: 100,
      percent,
      state: percent < 90 ? "fail" : percent < 95 ? "watchlist" : "locked",
    };
  });

  if (tdMeta?.tdId) {
    const latestTdRun = runRows.find((run) => run.subject_type === "td" && run.subject_user_id === tdMeta.tdId) || null;
    summary.tdSummary = {
      tdId: tdMeta.tdId,
      tdName: tdMeta.tdName || null,
      alignmentPercent: latestTdRun ? roundValue(latestTdRun.alignment_percent) : null,
      state: latestTdRun?.state || null,
      hasCriticalFail: latestTdRun?.has_critical_fail || false,
      actionRequired: latestTdRun?.action_required || null,
      lastAuditAt: latestTdRun?.completed_at || null,
    } satisfies BattleTestingTdSummary;
  } else if (tdMeta) {
    summary.tdSummary = {
      tdId: null,
      tdName: tdMeta.tdName || null,
      alignmentPercent: null,
      state: null,
      hasCriticalFail: false,
      actionRequired: null,
      lastAuditAt: null,
    };
  }

  return summary;
}

export async function getBattleTestRunHistoryForPod(
  podId: string,
  nameByUserId: Record<string, string>,
  options?: {
    currentTutorIds?: string[];
  }
) {
  const { data, error } = await supabase
    .from("battle_test_runs")
    .select("*")
    .eq("pod_id", podId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load battle-testing history: ${error.message}`);
  }

  const currentTutorIds = Array.from(
    new Set((options?.currentTutorIds || []).map((value) => String(value || "").trim()).filter(Boolean))
  );
  let portableTutorRows: any[] = [];
  if (currentTutorIds.length > 0) {
    const portableTutorQuery = await supabase
      .from("battle_test_runs")
      .select("*")
      .eq("subject_type", "tutor")
      .in("subject_user_id", currentTutorIds)
      .order("completed_at", { ascending: false });

    if (portableTutorQuery.error) {
      throw new Error(`Failed to load portable tutor battle-testing history: ${portableTutorQuery.error.message}`);
    }

    portableTutorRows = portableTutorQuery.data || [];
  }

  const dedupedRuns = Array.from(
    new Map(
      [...(data || []), ...portableTutorRows]
        .map((rawRow) => mapRunRow(rawRow))
        .sort((left, right) => new Date(right.completed_at).getTime() - new Date(left.completed_at).getTime())
        .map((run) => [run.id, run] as const)
    ).values()
  );

  return dedupedRuns.map((run) => {
    return {
      runId: run.id,
      podId: run.pod_id,
      subjectType: run.subject_type,
      subjectUserId: run.subject_user_id,
      tutorAssignmentId: run.tutor_assignment_id,
      subjectName:
        nameByUserId[run.subject_user_id] ||
        (run.subject_type === "td" ? "Assigned TD" : "Assigned Tutor"),
      templateKey: run.template_key,
      selectedPhaseKeys: run.selected_phase_keys,
      alignmentPercent: roundValue(run.alignment_percent),
      state: run.state,
      stateLabel: getBattleTestStateLabel(run.state),
      hasCriticalFail: run.has_critical_fail,
      actionRequired: run.action_required,
      completedAt: run.completed_at,
      phaseScores: run.phase_scores,
    } satisfies BattleTestRunHistoryItem;
  });
}

export async function getBattleTestRunDetail(
  runId: string,
  nameByUserId: Record<string, string>,
) {
  const { data: runData, error: runError } = await supabase
    .from("battle_test_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runError || !runData) {
    throw new Error(`Failed to load battle-testing run: ${runError?.message || "Run not found"}`);
  }

  const { data: repData, error: repError } = await supabase
    .from("battle_test_rep_logs")
    .select("*")
    .eq("run_id", runId)
    .order("phase_key", { ascending: true })
    .order("question_order", { ascending: true });

  if (repError) {
    throw new Error(`Failed to load battle-testing rep logs: ${repError.message}`);
  }

  const run = mapRunRow(runData);
  const phaseOrder = new Map(run.selected_phase_keys.map((phaseKey, index) => [phaseKey, index] as const));
  const repLogs = (repData || []).map((rawRow) => {
    const rep = mapRepLogRow(rawRow);
    return {
      phaseKey: rep.phase_key,
      questionKey: rep.question_key,
      section: rep.section,
      questionOrder: rep.question_order,
      prompt: rep.prompt,
      expectedAnswer: rep.expected_answer,
      failIndicators: rep.fail_indicators,
      score: rep.score,
      pointsAwarded: rep.points_awarded,
      note: rep.note,
      isCriticalFail: rep.is_critical_fail,
    } satisfies BattleTestRepLogDetail;
  }).sort((left, right) => {
    const leftPhaseIndex = phaseOrder.get(left.phaseKey) ?? Number.MAX_SAFE_INTEGER;
    const rightPhaseIndex = phaseOrder.get(right.phaseKey) ?? Number.MAX_SAFE_INTEGER;
    if (leftPhaseIndex !== rightPhaseIndex) return leftPhaseIndex - rightPhaseIndex;
    return left.questionOrder - right.questionOrder;
  });

  return {
    runId: run.id,
    podId: run.pod_id,
    subjectType: run.subject_type,
    subjectUserId: run.subject_user_id,
    tutorAssignmentId: run.tutor_assignment_id,
    subjectName:
      nameByUserId[run.subject_user_id] ||
      (run.subject_type === "td" ? "Assigned TD" : "Assigned Tutor"),
    templateKey: run.template_key,
    selectedPhaseKeys: run.selected_phase_keys,
    alignmentPercent: roundValue(run.alignment_percent),
    state: run.state,
    stateLabel: getBattleTestStateLabel(run.state),
    hasCriticalFail: run.has_critical_fail,
    actionRequired: run.action_required,
    completedAt: run.completed_at,
    phaseScores: run.phase_scores,
    repLogs,
  } satisfies BattleTestRunDetail;
}

export function buildBattleTestSuccessPayload(runId: string, outcome: BattleTestOutcome) {
  return {
    runId,
    alignmentPercent: outcome.alignmentPercent,
    state: outcome.state,
    stateLabel: getBattleTestStateLabel(outcome.state),
    hasCriticalFail: outcome.hasCriticalFail,
    actionRequired: outcome.actionRequired,
    phaseScores: outcome.phaseScores,
  };
}

export function validateBattleTestResponses(
  subjectType: BattleTestSubjectType,
  phases: BattleTestPhaseDefinition[],
  responses: BattleTestResponseInput[],
) {
  const responseMap = new Map<string, BattleTestResponseInput>();

  // Create a map of all valid question keys from the provided phases
  const validQuestionKeys = new Set<string>();
  for (const phase of phases) {
    for (const question of phase.questions) {
      validQuestionKeys.add(`${phase.key}:${question.key}`);
    }
  }

  for (const response of responses) {
    const responseKey = `${response.phaseKey}:${response.questionKey}`;
    if (!validQuestionKeys.has(responseKey)) {
      throw new Error(`Unknown battle-testing question: ${responseKey}`);
    }

    if (responseMap.has(responseKey)) {
      throw new Error(`Duplicate battle-testing response: ${responseKey}`);
    }
    responseMap.set(responseKey, response);
  }

  if (
    subjectType === "td" &&
    phases.some((phase) => phase.key !== "td_system_integrity")
  ) {
    throw new Error("Invalid TD battle-testing phase.");
  }

  return responseMap;
}
