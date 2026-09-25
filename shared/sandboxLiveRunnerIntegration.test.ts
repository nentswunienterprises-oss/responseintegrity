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
});
