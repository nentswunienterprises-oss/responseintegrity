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

test("Sandbox mode uses the existing live-runner route rather than a separate runner flow", () => {
  assert.match(
    liveRunnerSource,
    /import SpecialistSandboxSimulation from "@\/pages\/operational\/tutor\/sandbox-simulation"/,
  );
  assert.match(liveRunnerSource, /operationalMode === "sandbox" && studentId/);
  assert.match(
    liveRunnerSource,
    /<SpecialistSandboxSimulation[\s\S]*studentIdOverride=\{String\(studentId\)\}[\s\S]*embedded/,
  );
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
  assert.match(
    sandboxRunnerSource,
    /studentIdOverride[\s\S]*sandboxStudents\.find\(\(student\) => String\(student\.id\) === requestedStudentId\)/,
  );
  assert.match(sandboxRunnerSource, /Simulated student behaviour/);
  assert.match(sandboxRunnerSource, /studentBehavior/);
});

test("Sandbox guide names the stateful experience as the normal live runner", () => {
  assert.match(sandboxGuideSource, /title: "13\. Run the live training session"/);
  assert.match(sandboxGuideSource, /open the normal live runner/);
  assert.match(sandboxGuideSource, /actionLabel: "Open live runner"/);
});
