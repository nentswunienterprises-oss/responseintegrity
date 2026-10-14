import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  renderSandboxPrerequisiteFollowUp,
  sandboxRequiresPrerequisiteSentinel,
} from "./sandboxPrerequisiteProbe";

const fields = [
  {
    fieldKey: "start",
    options: [
      { optionId: "late", requiresPrerequisiteSentinel: true },
      { optionId: "prompt", requiresPrerequisiteSentinel: false },
    ],
  },
  {
    fieldKey: "structure",
    options: [
      { optionId: "collapsed", requiresPrerequisiteSentinel: true },
      { optionId: "held", requiresPrerequisiteSentinel: false },
    ],
  },
];

test("honest weak observations trigger a follow-up; strong responses do not bypass evidence truth", () => {
  assert.equal(
    sandboxRequiresPrerequisiteSentinel(fields, {
      start: { optionId: "late", evidenceStatus: "observed" },
      structure: { optionId: "collapsed", evidenceStatus: "observed" },
    }),
    true,
  );
  assert.equal(
    sandboxRequiresPrerequisiteSentinel(fields, {
      start: { optionId: "prompt", evidenceStatus: "observed" },
      structure: { optionId: "held", evidenceStatus: "observed" },
    }),
    false,
  );
  assert.equal(
    sandboxRequiresPrerequisiteSentinel(fields, {
      start: { optionId: "late", evidenceStatus: "not_observed" },
      structure: { optionId: "held", evidenceStatus: "observed" },
    }),
    false,
  );
  assert.equal(
    sandboxRequiresPrerequisiteSentinel(fields, {
      start: { optionId: "late", evidenceStatus: "confounded" },
      structure: { optionId: "held", evidenceStatus: "observed" },
    }),
    false,
  );
});

test("every supported simulated phase supplies a distinct observable follow-up for the pre-authored outcome", () => {
  for (const phase of [
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ] as const) {
    const behaviors = ([
      "held",
      "contradicted",
      "not_observed",
      "confounded",
    ] as const).map((status) => {
      const behavior = renderSandboxPrerequisiteFollowUp(phase, status);
      assert.ok(behavior && behavior.length >= 75, phase + " " + status);
      assert.doesNotMatch(
        behavior,
        /canonical|sentinel|contradicted|phase exit|score|correct choice|option_\d+/i,
      );
      return behavior;
    });
    assert.equal(new Set(behaviors).size, 4);
    assert.notEqual(behaviors[0], behaviors[1]);
  }
  assert.equal(renderSandboxPrerequisiteFollowUp("Clarity", "held"), null);
  assert.equal(renderSandboxPrerequisiteFollowUp("Time Pressure Stability", null), null);
});

test("Sandbox rep shows the follow-up only after a deliberate separate check, with readable choices", () => {
  const source = readFileSync(
    new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL("../server/sandboxEnvironment.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /simulatedFollowUp: renderSandboxPrerequisiteFollowUp\(/);
  assert.match(server, /sandboxRequiresPrerequisiteSentinel\(fields, input\.submission\.observations\)/);
  assert.match(server, /Record the required prerequisite check before confirming this rep/);
  assert.match(source, /prerequisiteProbeStarted/);
  assert.match(source, /Run untimed check|Run prerequisite check/);
  assert.match(source, /Simulated follow-up response/);
  assert.match(source, /bg-white text-amber-950/);
  assert.match(source, /Do not change the earlier observations/);
  assert.match(source, /!requiresPrerequisiteSentinel \|\| \(prerequisiteProbeStarted && Boolean\(prerequisiteSentinel\)\)/);
});
