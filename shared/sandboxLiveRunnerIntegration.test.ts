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
const serverRoutesSource = readFileSync(
  new URL("../server/routes.ts", import.meta.url),
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
  assert.match(liveRunnerSource, /operationalMode === "sandbox" && studentId && runtimeMode\?\.assignmentId/);
  assert.match(
    liveRunnerSource,
    /<SpecialistSandboxSimulation[\s\S]*studentIdOverride=\{String\(studentId\)\}[\s\S]*tutorAssignmentIdOverride=\{runtimeMode\.assignmentId\}[\s\S]*operationalModeOverride=\{operationalMode\}[\s\S]*embedded/,
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
  assert.match(responseSnapshotCardSource, /Drill Response/);
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
  assert.match(trainingLiveUiSource, /Support this rep/);
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
