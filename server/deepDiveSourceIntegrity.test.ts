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

test("canonical TPS contract is implemented and aligned to live timing authority", () => {
  const contract = read("docs/tps-timing-baseline-diagnosis-contract.md");
  const source = read("docs/response-integrity-os-implementation-source-of-truth.md");

  assert.match(contract, /Status:\*\* Implemented, live-proven, and merged to `main`/);
  assert.doesNotMatch(contract, /implementation pending/i);
  assert.doesNotMatch(contract, /- \[ \]/);
  assert.match(contract, /live proof workflow run `35931443789`/);
  assert.match(contract, /shared\/tpsTimingContract\.ts/);
  assert.match(contract, /server\/tpsTimingAuthority\.ts/);

  assert.match(source, /### TPS timing authority/);
  assert.match(source, /most recent complete clean three-rep Independent Execution set/);
  assert.match(source, /There is no hidden pre-TPS calibration side path/);
  assert.match(source, /Full Constraint uses 85% of baseline/);
  assert.match(source, /Current live Training state authority is evidence-native/);
  assert.doesNotMatch(source, /current live transition engine uses:\s*\n\s*- score/i);
});

test("technical timing replacement is an unresolved-slot reserve path, not a second chance", () => {
  const contract = read("docs/tps-timing-baseline-diagnosis-contract.md");
  const source = read("docs/response-integrity-os-implementation-source-of-truth.md");
  const logging = read("client/src/pages/responseconditioningsystem/session-infrastructure/logging-system.tsx");
  const drillLibrary = read("client/src/pages/responseconditioningsystem/session-infrastructure/drill-library.tsx");
  const intro = read("client/src/pages/responseconditioningsystem/session-infrastructure/intro-session-structure.tsx");
  const structured = read("client/src/pages/responseconditioningsystem/transformation-phases/structured-execution.tsx");
  const tpsDeepDive = read("client/src/pages/responseconditioningsystem/transformation-phases/time-pressure-stability.tsx");
  const prep = read("client/src/components/tutor/StudentTopicConditioningDialog.tsx");
  const runner = read("client/src/components/tutor/IntroSessionDrillRunner.tsx");
  const diagnosisRunner = read("client/src/components/tutor/EvidenceCompleteDiagnosisRunner.tsx");
  const timingContract = read("shared/tpsTimingContract.ts");

  for (const text of [contract, source, logging, drillLibrary, intro, structured, tpsDeepDive]) {
    assert.match(text, /fresh (?:pre-prepared )?equivalent/i);
    assert.match(text, /unresolved/i);
  }

  assert.match(prep, /reserve problem/i);
  assert.match(prep, /normal[- ]difficulty/i);
  assert.match(prep, /same[- ]form/i);
  assert.match(runner, /Confirm fresh pre-prepared equivalent reserve/);
  assert.match(diagnosisRunner, /Confirm fresh pre-prepared equivalent reserve/);
  assert.match(timingContract, /fresh_prepared_equivalent/);

  assert.doesNotMatch(runner, /Retry this same rep; the replacement will use the same Timer Contract/i);
  assert.doesNotMatch(runner, /Retry this same Independent Execution rep/i);
  assert.match(contract, /does not create a second chance after student performance/i);
  assert.doesNotMatch(contract, /retry (?:this|the) same (?:rep|problem)/i);
});

test("Specialist delivery surfaces do not expose retired delivery-rating language", () => {
  const specialistSurfacePaths = [
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    "client/src/components/tutor/StudentReportsDialog.tsx",
    "client/src/components/tutor/StudentCard.tsx",
    "client/src/components/tutor/ViewTrackingSystemsDialog.tsx",
    "client/src/pages/responseconditioningsystem/session-infrastructure/logging-system.tsx",
    "client/src/pages/responseconditioningsystem/session-infrastructure/session-flow-control.tsx",
    "client/src/pages/responseconditioningsystem/session-infrastructure/drill-library.tsx",
    "client/src/pages/responseconditioningsystem/session-infrastructure/handover-verification.tsx",
    "client/src/pages/responseconditioningsystem/execution-standards/what-not-to-do.tsx",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Session Infrastructure/Drill Library.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Session Infrastructure/Handover verification.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Session Infrastructure/Intro Session Structure.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Session Infrastructure/Logging System.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Session Infrastructure/Tools Required.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Transformation Phases/TT-OS Trasnformation Phases Battle-Testing = Clarity.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Transformation Phases/TT-OS Trasnformation Phases Battle-Testing = Controlled Discomfort.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Transformation Phases/TT-OS Trasnformation Phases Battle-Testing = Structured Execution.md",
    "Battle-Testing Infrastructure/Tutor Battle-Testing/Transformation Phases/TT-OS Trasnformation Phases Battle-Testing = Topic Conditioning.md",
  ];

  const prohibited = [
    /compatibility score/i,
    /compatibility scoring/i,
    /compatibility average/i,
    /legacy compatibility/i,
    /topic score/i,
    /phase score/i,
    /score band/i,
    /score-driven/i,
    /scored evidence/i,
    /scored proof/i,
    /actual score/i,
    /view scoring breakdown/i,
  ];

  for (const sourcePath of specialistSurfacePaths) {
    const source = read(sourcePath);
    for (const pattern of prohibited) {
      assert.doesNotMatch(source, pattern, `${sourcePath}: ${pattern}`);
    }
  }

  assert.doesNotMatch(
    read("client/src/components/tutor/IntroSessionDrillRunner.tsx"),
    /responseSnapshotScoreLabel/,
  );
  assert.doesNotMatch(
    read("client/src/components/tutor/ViewTrackingSystemsDialog.tsx"),
    /responseSnapshotScoreLabel/,
  );
});

test("canonical Deep Dive authority is evidence-native", () => {
  const source = read("docs/response-integrity-os-implementation-source-of-truth.md");
  assert.match(source, /Layer inheritance and evidence authority/);
  assert.match(source, /Current Training authority is evidence-native/);
  assert.doesNotMatch(source, /current live training transition engine is driven by score/i);
  assert.doesNotMatch(source, /Run (Clarity|Structured Execution|Controlled Discomfort) High Maintenance drill/);
});
