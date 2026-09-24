import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const deepDivePaths = [
  "client/src/pages/responseconditioningsystem/session-infrastructure/topic-conditioning.tsx",
  "client/src/pages/responseconditioningsystem/transformation-phases/clarity.tsx",
  "client/src/pages/responseconditioningsystem/transformation-phases/structured-execution.tsx",
  "client/src/pages/responseconditioningsystem/transformation-phases/controlled-discomfort.tsx",
  "client/src/pages/responseconditioningsystem/transformation-phases/time-pressure-stability.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/intro-session-structure.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/logging-system.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/session-flow-control.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/drill-library.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/handover-verification.tsx",
  "client/src/pages/responseconditioningsystem/session-infrastructure/tools-required.tsx",
];

test("live Deep Dive modules load through the TSX runtime", async () => {
  for (const sourcePath of deepDivePaths) {
    const moduleUrl = new URL(`../${sourcePath}`, import.meta.url);
    const loaded = await import(moduleUrl.href);
    assert.equal(typeof loaded.default, "function", sourcePath);
  }
});

test("live Deep Dives use Specialist role language", () => {
  for (const sourcePath of deepDivePaths) {
    const source = read(sourcePath);
    assert.doesNotMatch(source, /\btutor(?:s|'s)?\b/i, sourcePath);
  }
});

test("live Deep Dives do not restore legacy score-authority mechanics", () => {
  const prohibited = [
    /phaseScore/,
    /setScores/,
    /INTRO_PHASE_WEIGHTS/,
    /Diagnosis Total/,
    /Topic Score/,
    /Score the block/i,
    /according to the score/i,
    /high intro score/i,
    /scored evidence/i,
    /protect the score/i,
    /High Maintenance drill/i,
  ];

  for (const sourcePath of deepDivePaths) {
    const source = read(sourcePath);
    for (const pattern of prohibited) {
      assert.doesNotMatch(source, pattern, `${sourcePath}: ${pattern}`);
    }
  }
});

test("active next actions do not invent High Maintenance drill types", () => {
  for (const sourcePath of [
    "shared/topicConditioningEngine.ts",
    "client/src/components/tutor/topicConditioningEngine.ts",
  ]) {
    const source = read(sourcePath);
    assert.doesNotMatch(source, /High Maintenance drill/i, sourcePath);
    assert.doesNotMatch(source, /Time Pressure Stability maintenance drill/i, sourcePath);
  }
});

test("canonical Deep Dive authority is evidence-native", () => {
  const source = read("docs/response-integrity-os-implementation-source-of-truth.md");
  assert.match(source, /Layer inheritance and evidence authority/);
  assert.match(source, /Current Training authority is evidence-native/);
  assert.doesNotMatch(source, /current live training transition engine is driven by score/i);
  assert.doesNotMatch(source, /Run (Clarity|Structured Execution|Controlled Discomfort) High Maintenance drill/);
});
