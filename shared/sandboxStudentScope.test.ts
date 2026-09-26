import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../server/sandboxEnvironment.ts", import.meta.url),
  "utf8",
);
const rediagnosisSource = readFileSync(
  new URL("../server/sandboxRediagnosis.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../server/routes/sandboxEnvironment.ts", import.meta.url),
  "utf8",
);
const runnerSource = readFileSync(
  new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx", import.meta.url),
  "utf8",
);
const trainingLiveUiSource = readFileSync(
  new URL("../client/src/components/tutor/TrainingLiveDeliveryUi.tsx", import.meta.url),
  "utf8",
);
const studentCardSource = readFileSync(
  new URL("../client/src/components/tutor/StudentCard.tsx", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../migrations/20260925_sandbox_v1r4_per_student_trajectories.sql", import.meta.url),
  "utf8",
);

test("every new active Sandbox trajectory is scoped to a concrete synthetic student", () => {
  assert.match(serverSource, /studentId: string/);
  assert.match(serverSource, /AND t\.student_id = \$3/);
  assert.match(serverSource, /student_id,\s*bank_key/);
  assert.match(serverSource, /COALESCE\(pe\.is_sandbox_account, false\)/);
  assert.match(serverSource, /Stateful Sandbox may only run against synthetic Sandbox student accounts/);
  assert.match(
    migrationSource,
    /idx_sandbox_one_active_student_trajectory[\s\S]*tutor_assignment_id,[\s\S]*student_id,[\s\S]*bank_key,[\s\S]*bank_version/,
  );
});

test("Sandbox runtime and history require student identity at the API boundary", () => {
  assert.match(routeSource, /const studentId = String\(req\.query\.studentId/);
  assert.match(routeSource, /tutorAssignmentId and studentId are required/);
  assert.match(routeSource, /studentId: payload\.studentId/);
  assert.match(routeSource, /studentId,/);
});

test("a completed Sandbox session is held until the next session is explicitly requested", () => {
  assert.match(serverSource, /async function previousCompletedSessionBoundary/);
  assert.match(
    serverSource,
    /session_number = \$2[\s\S]*bundle\.trajectory\.session_number - 1/,
  );
  assert.match(serverSource, /status: "session_complete" as const/);
  assert.match(
    serverSource,
    /Number\(input\.requestedSessionNumber \|\| 0\)[\s\S]*bundle\.trajectory\.session_number/,
  );
  assert.match(routeSource, /requestedSessionNumber/);
  assert.match(runnerSource, /next session has\s*not started/i);
});

test("rep, session, capability, and targeted diagnosis evidence retain student lineage", () => {
  assert.match(serverSource, /specialist_sandbox_rep_events[\s\S]*student_id/);
  assert.match(serverSource, /specialist_sandbox_session_evaluations[\s\S]*student_id/);
  assert.match(serverSource, /specialist_sandbox_capability_evidence[\s\S]*student_id/);
  assert.match(rediagnosisSource, /specialist_sandbox_rediagnosis_runs[\s\S]*student_id/);
  assert.match(rediagnosisSource, /specialist_sandbox_rediagnosis_turns[\s\S]*student_id/);
});

test("Specialist readiness remains cross-student while each student history remains trajectory-local", () => {
  const capabilityLoaderStart = serverSource.indexOf("async function loadCapabilityOccurrences");
  const capabilityLoaderEnd = serverSource.indexOf("async function exposureSummary", capabilityLoaderStart);
  const capabilityLoader = serverSource.slice(capabilityLoaderStart, capabilityLoaderEnd);
  assert.match(capabilityLoader, /WHERE tutor_assignment_id = \$1/);
  assert.doesNotMatch(capabilityLoader, /student_id =/);

  const historyStart = serverSource.indexOf("export async function getSandboxEnvironmentHistory");
  const history = serverSource.slice(historyStart);
  assert.match(history, /WHERE trajectory_id = \$1/);
});

test("all Sandbox-mode Specialists can select an assigned student and see rep behaviour in the live runner", () => {
  assert.match(runnerSource, /sandboxStudents\.map/);
  assert.match(runnerSource, /studentId=\$\{encodeURIComponent\(String\(student\.id\)\)\}/);
  assert.match(runnerSource, /studentBehavior/);
  assert.match(runnerSource, /LiveSandboxStudentResponse/);
  assert.match(trainingLiveUiSource, /Simulated student response/);
  assert.match(studentCardSource, /case "stateful-sandbox"/);
  assert.match(
    studentCardSource,
    /\/specialist\/intro-session\/\$\{student\.id\}\?mode=training/,
  );
  assert.doesNotMatch(
    studentCardSource,
    /operational\/specialist\/sandbox\?studentId=/,
  );
});

test("legacy assignment-level active trajectories are retired rather than silently attached to a student", () => {
  assert.match(
    migrationSource,
    /UPDATE public\.specialist_sandbox_trajectories[\s\S]*student_id IS NULL[\s\S]*status = 'active'/,
  );
  assert.match(migrationSource, /SET status = 'retired'/);
});
