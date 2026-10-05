import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const liveRunnerSource = readFileSync(
  new URL("../client/src/components/tutor/IntroSessionDrillRunner.tsx", import.meta.url),
  "utf8",
);
const sandboxRunnerSource = readFileSync(
  new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx", import.meta.url),
  "utf8",
);
const introSessionRouteSource = readFileSync(
  new URL("../client/src/components/tutor/IntroSessionRoute.tsx", import.meta.url),
  "utf8",
);
const evidenceDiagnosisRunnerSource = readFileSync(
  new URL("../client/src/components/tutor/EvidenceCompleteDiagnosisRunner.tsx", import.meta.url),
  "utf8",
);
const studentCardSource = readFileSync(
  new URL("../client/src/components/tutor/StudentCard.tsx", import.meta.url),
  "utf8",
);
const sandboxGuideSource = readFileSync(
  new URL("../client/src/components/tutor/sandboxGuide.ts", import.meta.url),
  "utf8",
);
const sandboxRouteSource = readFileSync(
  new URL("../server/routes/sandboxEnvironment.ts", import.meta.url),
  "utf8",
);
const sandboxEnvironmentSource = readFileSync(
  new URL("../server/sandboxEnvironment.ts", import.meta.url),
  "utf8",
);
const sandboxRediagnosisSource = readFileSync(
  new URL("../server/sandboxRediagnosis.ts", import.meta.url),
  "utf8",
);
const serverRoutesSource = readFileSync(
  new URL("../server/routes.ts", import.meta.url),
  "utf8",
);
const tpsTimingAuthoritySource = readFileSync(
  new URL("../server/tpsTimingAuthority.ts", import.meta.url),
  "utf8",
);
const responseSnapshotCardSource = readFileSync(
  new URL("../client/src/components/tutor/ResponseSnapshotCard.tsx", import.meta.url),
  "utf8",
);
const trainingLiveUiSource = readFileSync(
  new URL("../client/src/components/tutor/TrainingLiveDeliveryUi.tsx", import.meta.url),
  "utf8",
);
const battleTestingSource = readFileSync(
  new URL("../server/battleTesting.ts", import.meta.url),
  "utf8",
);
const capabilitySequencingSource = readFileSync(
  new URL("../server/capabilitySequencing.ts", import.meta.url),
  "utf8",
);
const tdOverviewSource = readFileSync(
  new URL("../client/src/pages/operational/td/overview.tsx", import.meta.url),
  "utf8",
);
const cooPodDetailSource = readFileSync(
  new URL("../client/src/pages/executive/coo/pod-detail.tsx", import.meta.url),
  "utf8",
);
const sandboxReadinessCardSource = readFileSync(
  new URL("../client/src/components/sandbox/SandboxReadinessAssessmentCard.tsx", import.meta.url),
  "utf8",
);

test("Sandbox mode uses the existing live-runner route rather than a separate runner flow", () => {
  assert.match(
    liveRunnerSource,
    /import SpecialistSandboxSimulation from "@\/pages\/operational\/tutor\/sandbox-simulation"/,
  );
  assert.match(liveRunnerSource, /\/api\/tutor\/runtime-mode/);
  assert.match(liveRunnerSource, /refetchOnMount: "always"/);
  assert.match(liveRunnerSource, /cache: "no-store"/);
  assert.doesNotMatch(
    liveRunnerSource,
    /headers:\s*HeadersInit\s*=\s*\{\s*"Cache-Control"/,
  );
  assert.match(liveRunnerSource, /runtimeModeLoading \|\| runtimeModeFetching/);
  assert.match(
    liveRunnerSource,
    /operationalMode === "sandbox"[\s\S]*sandboxAssignmentId[\s\S]*requestedMode !== "handover"/,
  );
  assert.match(
    liveRunnerSource,
    /<SpecialistSandboxSimulation[\s\S]*studentIdOverride=\{String\(studentId\)\}[\s\S]*tutorAssignmentIdOverride=\{sandboxAssignmentId\}[\s\S]*operationalModeOverride=\{operationalMode\}[\s\S]*embedded/,
  );
  assert.match(sandboxRouteSource, /app\.get\("\/api\/tutor\/runtime-mode"/);
  assert.match(sandboxRouteSource, /Cache-Control", "no-store, max-age=0"/);
  assert.match(
    studentCardSource,
    /\/specialist\/intro-session\/\$\{student\.id\}\?mode=training/,
  );
  assert.doesNotMatch(
    studentCardSource,
    /case "stateful-sandbox"[\s\S]{0,500}\/operational\/specialist\/sandbox\?studentId=/,
  );
});

test("evidence diagnosis remains on the evidence-native runner even when the Specialist is in Sandbox", () => {
  assert.match(
    introSessionRouteSource,
    /mode === "diagnosis"[\s\S]*<EvidenceCompleteDiagnosisRunner \/>/,
  );
  assert.doesNotMatch(introSessionRouteSource, /\/api\/tutor\/runtime-mode/);
  assert.doesNotMatch(introSessionRouteSource, /SpecialistSandboxSimulation/);
});

test("Sandbox diagnosis keeps the evidence-native runner and projects private simulated student behavior", () => {
  assert.match(evidenceDiagnosisRunnerSource, /\/api\/tutor\/runtime-mode/);
  assert.match(
    evidenceDiagnosisRunnerSource,
    /\/api\/tutor\/sandbox-live-evidence/,
  );
  assert.match(
    evidenceDiagnosisRunnerSource,
    /<LiveSandboxStudentResponse>[\s\S]*sandboxSimulation\.studentBehavior/,
  );
  assert.match(
    evidenceDiagnosisRunnerSource,
    /runtimeAuthority\?\.operationalMode === "sandbox"[\s\S]*recordSandboxSimulation/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /private\.specialist_sandbox_diagnosis_outcomes/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /studentBehavior: projectSandboxLiveBehavior\([\s\S]*behavior: selected\.studentBehavior/,
  );
  assert.doesNotMatch(
    sandboxRediagnosisSource.slice(
      sandboxRediagnosisSource.indexOf("export async function prepareSandboxLiveEvidenceSimulation"),
      sandboxRediagnosisSource.indexOf("export async function submitSandboxLiveEvidenceSimulation"),
    ),
    /canonicalObservations:/,
  );
});

test("Sandbox Handover stays on the live Handover runner and records one observation at a time", () => {
  assert.match(
    liveRunnerSource,
    /operationalMode === "sandbox"[\s\S]*\(!studentId \|\| !sandboxAssignmentId\)[\s\S]*missing its assignment or student identity/,
  );
  assert.match(
    liveRunnerSource,
    /operationalMode === "sandbox"[\s\S]*requestedMode !== "handover"[\s\S]*<SpecialistSandboxSimulation/,
  );
  assert.match(
    liveRunnerSource,
    /<IntroSessionDrillRunnerCore[\s\S]*sandboxAssignmentId=[\s\S]*operationalMode === "sandbox"/,
  );
  assert.match(liveRunnerSource, /requestedMode !== "handover"/);
  assert.match(
    liveRunnerSource,
    /sandboxHandoverEnabled[\s\S]*\/api\/tutor\/sandbox-live-evidence/,
  );
  assert.match(
    liveRunnerSource,
    /<LiveSandboxStudentResponse>[\s\S]*sandboxHandoverSimulation\.studentBehavior/,
  );
  assert.match(
    liveRunnerSource,
    /isHandoverContinuityVerification && \(!repStarted \|\| !handoverExecutionFinished\)[\s\S]*"hidden"/,
  );
  assert.match(
    liveRunnerSource,
    /isHandoverContinuityVerification && !handoverExecutionFinished[\s\S]*Click Student Finished before recording Handover observations/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /"Time Pressure Stability": "time\.consistency"/,
  );
  assert.match(
    liveRunnerSource,
    /Continuity check · \$\{set\?\.setName \|\| ""\}/,
  );
  assert.match(
    liveRunnerSource,
    /!isHandoverContinuityVerification[\s\S]*<LiveRepContextCard/,
  );
  assert.match(
    liveRunnerSource,
    /!isHandoverContinuityVerification && \([\s\S]*of \{set\?\.reps \?\? 0\}/,
  );

  const verificationPrepStart = liveRunnerSource.indexOf(
    "function buildVerificationPrepSpec",
  );
  const handoverPrepStart = liveRunnerSource.indexOf(
    'if (mode === "handover")',
    verificationPrepStart,
  );
  const handoverPrepEnd = liveRunnerSource.indexOf(
    'title: "Targeted Re-Diagnosis Prep"',
    handoverPrepStart,
  );
  const handoverPrepSource = liveRunnerSource.slice(
    handoverPrepStart,
    handoverPrepEnd,
  );
  assert.doesNotMatch(handoverPrepSource, /\.\.\.verificationRules|\.\.\.phaseRules/);
  assert.doesNotMatch(
    liveRunnerSource,
    /Handover prep is continuity-check prep, not intro prep and not training prep\./,
  );
  assert.match(
    liveRunnerSource,
    /drillMode === "handover" && handoverReDiagnosisMode && showModeInstructions/,
  );
  assert.doesNotMatch(
    liveRunnerSource,
    /drillMode === "handover" && showModeInstructions && \(/,
  );
  const regularHandoverPrep = handoverPrepSource;
  assert.match(
    regularHandoverPrep,
    /record it as not observed[\s\S]*record it as confounded/,
  );

  assert.match(
    liveRunnerSource,
    /const \[handoverObservationIndex, setHandoverObservationIndex\] = useState\(0\)/,
  );
  assert.match(
    liveRunnerSource,
    /observationIndex !== handoverObservationIndex/,
  );
  assert.match(
    liveRunnerSource,
    /Observation \{Math\.min\(handoverObservationIndex \+ 1,[\s\S]*handoverObservationBlock\.length/,
  );
  assert.match(liveRunnerSource, /Previous observation/);
  assert.match(liveRunnerSource, /Next observation/);
  assert.match(liveRunnerSource, /Review Opportunity/);
  assert.match(liveRunnerSource, /Review continuity evidence/);
  assert.match(
    liveRunnerSource,
    /Complete the Handover observation runner and review this opportunity before confirming it/,
  );
  assert.match(
    liveRunnerSource,
    /isHandoverContinuityVerification && !handoverObservationReview[\s\S]*Evaluate Continuity Evidence/,
  );
});

test("generic Sandbox evidence simulation is deterministic for retries and never grants Handover condition integrity without intervention evidence", () => {
  const prepareStart = sandboxRediagnosisSource.indexOf(
    "export async function prepareSandboxLiveEvidenceSimulation",
  );
  const genericEnd = sandboxRediagnosisSource.indexOf(
    "export async function prepareSandboxRediagnosis",
    prepareStart,
  );
  const genericSource = sandboxRediagnosisSource.slice(prepareStart, genericEnd);
  assert.match(genericSource, /earliestUnsupportedCapability: null/);
  assert.doesNotMatch(genericSource, /history\.readiness\.earliestUnsupportedCapability/);
  assert.match(
    genericSource,
    /input\.scope === "diagnosis"[\s\S]*"condition_integrity"/,
  );
});


test("TPS Handover reuses inherited baseline-derived Timer Contract authority", () => {
  assert.match(
    liveRunnerSource,
    /\(isTrainingEvidenceCapture \|\| isHandoverContinuityVerification\)[\s\S]*displayPhase === "Time Pressure Stability"/,
  );
  assert.match(
    liveRunnerSource,
    /isHandoverContinuityVerification && activeTpsPressureLevel === "light_timer"[\s\S]*"time_pressure\.handover_continuity"/,
  );
  assert.match(
    liveRunnerSource,
    /Baseline: \{tpsTimerContract\.baselineSeconds\}s[\s\S]*inherited Timer Contract governs the opportunity/,
  );
  assert.match(
    liveRunnerSource,
    /sandboxHandoverEnabled \? sandboxHandoverSimulation\?\.formId \|\| "sandbox-pending" : "live"/,
  );
  assert.match(
    liveRunnerSource,
    /scope: "handover"[\s\S]*topic: currentTopicName[\s\S]*startingPhase: displayPhase/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /async function ensureSandboxTpsTimerContract/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /deriveTpsTimerContractV1\(snapshot\)/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /persistTpsTimerContract/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /input\.scope === "handover"[\s\S]*input\.startingPhase === "Time Pressure Stability"[\s\S]*ensureSandboxTpsTimerContract/,
  );
  assert.match(
    serverRoutesSource,
    /verificationPhase === "Time Pressure Stability"[\s\S]*loadLatestTpsTimerContract[\s\S]*validateTpsHandoverTimedAttemptLineage/,
  );
  assert.match(
    tpsTimingAuthoritySource,
    /validateTpsHandoverTimedAttemptLineage[\s\S]*time_pressure\.handover_continuity[\s\S]*loadTpsTimedAttemptById/,
  );
});

test("Sandbox Handover projects continuity-native wording instead of diagnosis repeat wording", () => {
  assert.match(
    sandboxRediagnosisSource,
    /function projectSandboxLiveBehavior/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /input\.scope !== "handover" \|\| input\.probeId !== "time\.consistency"/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /repeated timed opportunity[\s\S]*timed continuity opportunity/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /repeated timed response[\s\S]*timed continuity response/,
  );
  assert.match(
    sandboxRediagnosisSource,
    /studentBehavior: projectSandboxLiveBehavior/,
  );
});
test("DB-session proof auth never leaks a stale Supabase bearer into diagnosis or live-runner authority checks", () => {
  assert.match(evidenceDiagnosisRunnerSource, /getAuthMode/);
  assert.match(
    evidenceDiagnosisRunnerSource,
    /if \(!authMode\.dbSessionAuthMode\)[\s\S]*supabase\.auth\.getSession/,
  );
  assert.match(liveRunnerSource, /getAuthMode/);
  assert.match(
    liveRunnerSource,
    /if \(!authMode\.dbSessionAuthMode\)[\s\S]*supabase\.auth\.getSession/,
  );
});

test("embedded Sandbox live runner is locked to the route student and still renders simulated behaviour", () => {
  assert.match(
    sandboxRunnerSource,
    /studentIdOverride \|\| searchParams\.get\("studentId"\)/,
  );
  assert.match(sandboxRunnerSource, /tutorAssignmentIdOverride/);
  assert.match(sandboxRunnerSource, /operationalModeOverride/);
  assert.match(
    sandboxRunnerSource,
    /const studentId = String\([\s\S]*studentIdOverride \|\| selectedSandboxStudent\?\.id/,
  );
  assert.match(sandboxRunnerSource, /enabled: requiresPodData/);
  assert.match(sandboxRunnerSource, /LiveSandboxStudentResponse/);
  assert.match(trainingLiveUiSource, /Simulated student response/);
  assert.match(sandboxRunnerSource, /studentBehavior/);
});

test("Sandbox evidence exceptions never force a hidden behavior guess", () => {
  assert.match(
    sandboxRunnerSource,
    /allowEvidenceExceptionWithoutOption/,
  );
  assert.match(
    sandboxRunnerSource,
    /selection\?\.evidenceStatus === "observed"[\s\S]{0,160}selection\.optionId/,
  );
  assert.match(
    trainingLiveUiSource,
    /No behavior option is required when the evidence itself was not interpretable/,
  );
  assert.match(
    trainingLiveUiSource,
    /status === "observed" \|\| !allowEvidenceExceptionWithoutOption/,
  );
});

test("Sandbox rep submission swaps to the authoritative next form without replaying the old rep", () => {
  assert.match(
    sandboxEnvironmentSource,
    /const nextEnvironment = await prepareSandboxEnvironment\([\s\S]*nextEnvironment,/,
  );
  assert.match(
    sandboxRunnerSource,
    /queryClient\.setQueryData<EnvironmentForm>\([\s\S]*environmentQueryKey,[\s\S]*result\.nextEnvironment/,
  );

  const successStart = sandboxRunnerSource.indexOf("onSuccess: async (result) => {", sandboxRunnerSource.indexOf("const submitRep = useMutation"));
  const successEnd = sandboxRunnerSource.indexOf("    },\n  });", successStart);
  const successSource = sandboxRunnerSource.slice(successStart, successEnd);
  assert.ok(
    successSource.indexOf("queryClient.setQueryData<EnvironmentForm>") <
      successSource.indexOf("setRepStarted(false)"),
    "The next authoritative form must enter the cache before the completed rep UI resets.",
  );
});

test("completed Sandbox training uses the live Response Snapshot completion contract", () => {
  assert.match(sandboxRunnerSource, /"session_complete"/);
  assert.match(sandboxRunnerSource, /Training session complete/);
  assert.doesNotMatch(sandboxRunnerSource, /Sandbox session complete/);
  assert.match(sandboxRunnerSource, /<ResponseSnapshotCard snapshot=\{snapshot\}/);
  assert.match(sandboxRunnerSource, /System Direction/);
  assert.match(responseSnapshotCardSource, /What This Drill Tested/);
  assert.match(responseSnapshotCardSource, /Drill Evidence/);
  assert.match(responseSnapshotCardSource, /summarizeSnapshotEvidenceMix/);
  assert.match(responseSnapshotCardSource, /formatSnapshotEvidenceClassLabel/);
  assert.doesNotMatch(responseSnapshotCardSource, /snapshot\.drill\.responseLabel/);
  assert.doesNotMatch(responseSnapshotCardSource, /rep\.responseLabel/);
  assert.doesNotMatch(sandboxRunnerSource, /Start Sandbox session \{/);
  assert.match(sandboxRunnerSource, /The next Sandbox session starts from the next confirmed weekly lesson/);
  assert.match(sandboxRunnerSource, /Return to Pod/);
  assert.match(sandboxRunnerSource, /searchParams\.get\("sandboxSession"\)/);
  assert.match(
    sandboxRunnerSource,
    /requestedSandboxSessionNumber[\s\S]*sessionNumber=/,
  );
  assert.match(sandboxRouteSource, /requestedSessionNumber/);
  assert.match(sandboxRouteSource, /req\.query\.sessionNumber/);
});

test("Sandbox trajectory initialization is serialized across environment and history requests", () => {
  assert.match(
    sandboxEnvironmentSource,
    /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/,
  );
  assert.match(
    sandboxEnvironmentSource,
    /const lockedExisting = await client\.query\(selectSql, selectParams\)/,
  );
  assert.match(
    sandboxEnvironmentSource,
    /Both the environment form and history can initialize at the same time/,
  );
});

test("stateful Sandbox surfaces the actual environment request failure", () => {
  assert.match(
    sandboxRunnerSource,
    /environmentQuery\.error instanceof Error[\s\S]*environmentQuery\.error\.message/,
  );
});

test("a newly confirmed Sandbox lesson overrides the previous completion boundary", () => {
  assert.match(
    sandboxEnvironmentSource,
    /const hasActiveBoundScheduledLesson =[\s\S]*\["confirmed", "ready", "live"\]\.includes/,
  );
  assert.match(
    sandboxEnvironmentSource,
    /completedBoundary[\s\S]*!requestedCurrentSession[\s\S]*!hasActiveBoundScheduledLesson/,
  );
});

test("Sandbox completion is bound to the exact confirmed scheduled lesson", () => {
  assert.match(sandboxRunnerSource, /searchParams\.get\("scheduledSessionId"\)/);
  assert.match(
    sandboxRunnerSource,
    /scheduledSessionId \? `&scheduledSessionId=\$\{encodeURIComponent\(scheduledSessionId\)\}`/,
  );
  assert.match(sandboxRunnerSource, /\.\.\.\(scheduledSessionId \? \{ scheduledSessionId \} : \{\}\)/);
  assert.match(sandboxRouteSource, /req\.query\.scheduledSessionId/);
  assert.match(sandboxRouteSource, /scheduledSessionId: payload\.scheduledSessionId \|\| null/);
  assert.match(sandboxEnvironmentSource, /loadSandboxScheduledTrainingSession/);
  assert.match(
    sandboxEnvironmentSource,
    /Start Sandbox Training from a confirmed weekly lesson/,
  );
  assert.match(
    sandboxEnvironmentSource,
    /This Sandbox lesson is already complete\. Return to the Pod/,
  );
  assert.match(sandboxEnvironmentSource, /completeSandboxScheduledTrainingSession/);
  assert.match(sandboxEnvironmentSource, /UPDATE public\.scheduled_sessions[\s\S]*status = 'completed'/);
  assert.match(sandboxEnvironmentSource, /event_type[\s\S]*'sandbox_training_completed'/);
  assert.match(sandboxEnvironmentSource, /billing_impact[\s\S]*'consume'/);
});

test("Sandbox Response Snapshot resolves the same current Training schema used by the live runner", () => {
  const snapshotStart = sandboxEnvironmentSource.indexOf(
    "function buildSandboxResponseSnapshot",
  );
  const snapshotEnd = sandboxEnvironmentSource.indexOf(
    "async function loadActiveEnvironmentBank",
    snapshotStart,
  );
  const snapshotSource = sandboxEnvironmentSource.slice(snapshotStart, snapshotEnd);

  assert.match(
    snapshotSource,
    /const schema = getDrillSchemaDefinition\("training", input\.phase\)/,
  );
  assert.doesNotMatch(snapshotSource, /trainingSchemaVersionForSandboxBank/);
  assert.match(
    snapshotSource,
    /Sandbox Response Snapshot could not resolve current Training evidence/,
  );
});

test("Sandbox System Direction preserves Before stability and uses a real next-session action", () => {
  assert.match(
    sandboxEnvironmentSource,
    /previous\.specialist_authority AS previous_specialist_authority/,
  );
  assert.match(
    sandboxEnvironmentSource,
    /stabilityBefore[\s\S]*previousAuthority\?\.nextStability/,
  );
  assert.match(
    sandboxRunnerSource,
    /snapshot\.engineOutcomeRef\.stabilityBefore/,
  );
  assert.match(sandboxRunnerSource, /NEXT_ACTION_ENGINE/);
  assert.match(sandboxRunnerSource, /Next Session Focus/);
  assert.doesNotMatch(
    sandboxRunnerSource.slice(
      sandboxRunnerSource.indexOf('if \(form.status === "session_complete"'),
      sandboxRunnerSource.indexOf("if (embedded)", sandboxRunnerSource.indexOf('if \(form.status === "session_complete"')),
    ),
    /Next Focus[\s\S]*authority\.reason/,
  );
});

test("Sandbox Response Snapshot is derived from Specialist-recorded evidence, not hidden canonical truth", () => {
  assert.match(sandboxEnvironmentSource, /buildSandboxResponseSnapshot/);
  assert.match(sandboxEnvironmentSource, /turn\.specialistObservations/);
  assert.match(sandboxEnvironmentSource, /resolveEvidenceSelection/);
  assert.match(sandboxEnvironmentSource, /buildResponseSnapshotV1/);
  assert.doesNotMatch(
    sandboxEnvironmentSource.slice(
      sandboxEnvironmentSource.indexOf("function buildSandboxResponseSnapshot"),
      sandboxEnvironmentSource.indexOf("async function loadActiveEnvironmentBank"),
    ),
    /canonicalObservations/,
  );
});

test("emergency Pod respects mixed student ID column types", () => {
  assert.match(
    serverRoutesSource,
    /FROM public\.training_session_runs[\s\S]*student_id = ANY\(\$2::uuid\[\]\)/,
  );
  assert.match(
    serverRoutesSource,
    /FROM public\.specialist_sandbox_session_evaluations[\s\S]*student_id = ANY\(\$2::text\[\]\)/,
  );
  assert.match(
    serverRoutesSource,
    /FROM public\.specialist_sandbox_trajectories[\s\S]*student_id = ANY\(\$2::text\[\]\)/,
  );
});

test("Sandbox Program Progress counts completed stateful sessions and carries visible Specialist state", () => {
  assert.match(studentCardSource, /const sessionProgress = isSandboxStudent[\s\S]*countedProgramProgress/);
  assert.match(serverRoutesSource, /specialist_sandbox_session_evaluations/);
  assert.match(serverRoutesSource, /sandbox-session:/);
  assert.match(serverRoutesSource, /specialist_phase, specialist_stability/);
  assert.match(serverRoutesSource, /certificationMode !== "sandbox"/);
});

test("completion-time Sandbox consumption cannot double-count the same scheduled lesson later", () => {
  assert.match(
    serverRoutesSource,
    /select\("session_id, credits_delta, billing_impact"\)/,
  );
  assert.match(
    serverRoutesSource,
    /completedSessionKeys\.has\(`training:\$\{sessionId\}`\)/,
  );
});

test("ordinary Training and embedded Sandbox share the same live-delivery UI primitives", () => {
  assert.match(liveRunnerSource, /LiveRepContextCard/);
  assert.match(liveRunnerSource, /LiveSupportPanel/);
  assert.match(liveRunnerSource, /LiveObservationField/);
  assert.match(sandboxRunnerSource, /LiveRepContextCard/);
  assert.match(sandboxRunnerSource, /LiveSupportPanel/);
  assert.match(sandboxRunnerSource, /LiveObservationField/);
  assert.match(sandboxRunnerSource, /LiveRepStage/);
  assert.match(sandboxRunnerSource, /Begin Rep/);
  assert.match(trainingLiveUiSource, /Simulated student response/);
  assert.match(trainingLiveUiSource, /Support used in this rep/);
});

test("Sandbox guide names the stateful experience as the normal live runner", () => {
  assert.match(sandboxGuideSource, /title: "13\. Run the live training session"/);
  assert.match(sandboxGuideSource, /open the normal live runner/);
  assert.match(sandboxGuideSource, /actionLabel: "Open live runner"/);
  assert.match(studentCardSource, /Confirm a weekly lesson first/);
  assert.match(
    studentCardSource,
    /scheduledSessionId=\$\{encodeURIComponent\([\s\S]*confirmedLesson\.id/,
  );
});

test("Sandbox Specialist evaluation is system-derived and TD-owned, not COO-owned", () => {
  assert.match(serverRoutesSource, /"\/api\/td\/tutors\/:tutorId\/sandbox-readiness"/);
  assert.match(
    serverRoutesSource,
    /"\/api\/td\/tutors\/:tutorId\/sandbox-readiness-assessment"/,
  );
  assert.match(
    serverRoutesSource,
    /requireRole\(\["td"\]\)[\s\S]*getTDAccessibleTutorIds/,
  );
  assert.doesNotMatch(
    serverRoutesSource,
    /"\/api\/coo\/tutors\/:tutorId\/sandbox-mock-assessment"/,
  );
  assert.match(
    serverRoutesSource,
    /getSandboxCapabilityReadiness\([\s\S]*systemPracticalsReady/,
  );

  assert.match(tdOverviewSource, /SandboxReadinessAssessmentCard/);
  assert.match(sandboxReadinessCardSource, /Sandbox Specialist Evaluation/);
  assert.match(sandboxReadinessCardSource, /TD Readiness Review/);
  assert.match(sandboxReadinessCardSource, /Ready for Practicals/);
  assert.match(sandboxReadinessCardSource, /Approve for Practicals/);
  assert.doesNotMatch(cooPodDetailSource, /SandboxMockGateCard/);
});

test("Sandbox readiness never skips Practicals by promoting directly to Trial", () => {
  assert.match(
    sandboxEnvironmentSource,
    /practicalsReady:[\s\S]*automaticTransition: false[\s\S]*nextStage: "practicals"/,
  );
  assert.match(
    serverRoutesSource,
    /nextStage: "practicals" as const[\s\S]*automaticTransition: false as const/,
  );
  assert.doesNotMatch(
    serverRoutesSource,
    /recordSandboxMockAssessment\(/,
  );

  const deriveModeStart = battleTestingSource.indexOf(
    "function deriveTutorTrainingMode",
  );
  const deriveModeEnd = battleTestingSource.indexOf(
    "export function deriveTutorAuditStateFromProgress",
    deriveModeStart,
  );
  const deriveModeSource = battleTestingSource.slice(
    deriveModeStart,
    deriveModeEnd,
  );
  assert.doesNotMatch(
    deriveModeSource,
    /if \(transformationComplete(?: && sessionComplete)?\) return "sandbox"/,
  );
  assert.match(
    deriveModeSource,
    /Legacy Battle Testing remains a health\/history surface[\s\S]*return "training"/,
  );
  assert.match(
    capabilitySequencingSource,
    /isCapabilityTransformationSandboxReady[\s\S]*reconcileCapabilitySandboxAuthority/,
  );
  assert.match(
    capabilitySequencingSource,
    /operational_mode = 'sandbox'/,
  );
  assert.doesNotMatch(
    deriveModeSource,
    /sandboxMockPassed[\s\S]*return "trial"/,
  );
});
