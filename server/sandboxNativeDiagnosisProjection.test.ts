import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DIAGNOSIS_PROBES, DIAGNOSIS_PROBE_EXECUTION_PROTOCOLS } from "../shared/evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "../shared/diagnosisObservationMatrix";
import type { SandboxDiagnosisOutcomeDefinition } from "../shared/sandboxDiagnosisEnvironment";
import { projectSandboxNativeDiagnosisOutcome } from "./sandboxNativeDiagnosisProjection";
import { compareSandboxDiagnosisProbe } from "../shared/sandboxDiagnosisEnvironment";

function fixture(probeId: SandboxDiagnosisOutcomeDefinition["probeId"], behaviorClass = "supported") {
  return {
    key: "synthetic-protocol-contract", version: 1, probeId,
    studentBehavior: "The response was broadly usable.",
    canonicalObservations: DIAGNOSIS_PROBES[probeId].dimensions.map(dimensionId => ({
      dimensionId,
      behaviorId: DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].options.find(o => o.behaviorClass === behaviorClass)!.id,
    })),
    trajectoryClass: "supported", weight: 1, simulatedElapsedSeconds: 48,
  } satisfies SandboxDiagnosisOutcomeDefinition;
}

test("independent native probe cannot demand unelicited vocabulary or explanation", () => {
  const original = fixture("stack.normal_independent");
  const before = JSON.stringify(original);
  const result = projectSandboxNativeDiagnosisOutcome(original);
  for (const dimensionId of ["clarity.vocabulary", "clarity.reason"]) {
    assert.equal(result.canonicalObservations.find(o => o.dimensionId === dimensionId)?.behaviorId, "not_observed");
  }
  for (const observation of original.canonicalObservations.filter(o => !["clarity.vocabulary", "clarity.reason"].includes(o.dimensionId))) {
    assert.deepEqual(result.canonicalObservations.find(o => o.dimensionId === observation.dimensionId), observation);
  }
  assert.match(JSON.stringify(DIAGNOSIS_PROBE_EXECUTION_PROTOCOLS["stack.normal_independent"]), /Do not ask what method/);
  assert.match(result.studentBehavior, /neither is established by the working alone/);
  assert.equal(JSON.stringify(original), before, "Do not mutate issued/historical definitions");
});

test("V2 Untimed Challenge keeps its authored continuous narrative; other probes retain evidence-complete detail", () => {
  for (const probeId of Object.keys(DIAGNOSIS_PROBES) as Array<SandboxDiagnosisOutcomeDefinition["probeId"]>) {
    const original = fixture(probeId, "near_stable");
    const result = projectSandboxNativeDiagnosisOutcome(original);
    if (probeId !== "stack.normal_independent") assert.deepEqual(result.canonicalObservations, original.canonicalObservations);
    assert.ok(result.studentBehavior.startsWith(original.studentBehavior), "Preserve the authored student narrative");
    for (const observation of result.canonicalObservations) {
      assert.ok(!result.studentBehavior.includes(observation.behaviorId), "Private behavior IDs must not enter the narrative");
    }
    if (probeId === "stack.challenge_no_timer") {
      const v2 = { ...original, version: 2 };
      assert.equal(projectSandboxNativeDiagnosisOutcome(v2).studentBehavior, v2.studentBehavior);
      assert.notEqual(result.studentBehavior, original.studentBehavior, "Legacy challenge scenarios retain their historical detail projection");
    } else if (probeId !== "stack.normal_independent") {
      for (const observation of result.canonicalObservations) {
        const option = DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId].options.find(o => o.id === observation.behaviorId)!;
        assert.ok(result.studentBehavior.includes(option.detail), "Observed dimensions remain represented in narrative");
      }
    }
  }
});


test("prepare and submit share projected truth and invalidate older issued forms", () => {
  const source = readFileSync(new URL("./sandboxRediagnosis.ts", import.meta.url), "utf8");
  const native = source.slice(source.indexOf("export async function prepareSandboxLiveEvidenceSimulation"));
  assert.equal((native.match(/projectSandboxNativeDiagnosisOutcome\(selectSandboxDiagnosisOutcome\(/g) || []).length, 2);
  assert.match(native, /"native-protocol-v" \+ SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION/);
  assert.match(native, /prepared.formId !== input.formId[\s\S]*opportunity is stale/);
});

test("first native Diagnosis initializes only an owned Sandbox trajectory before loading it", () => {
  const source = readFileSync(new URL("./sandboxRediagnosis.ts", import.meta.url), "utf8");
  const native = source.slice(source.indexOf("export async function prepareSandboxLiveEvidenceSimulation"));
  assert.match(native, /await assertSandboxAccess\(input\);[\s\S]*?const initializedTrajectoryId = input.scope === "diagnosis"[\s\S]*?await initializeSandboxNativeEvidenceTrajectory\(input\)[\s\S]*?loadTrajectory\(\{[\s\S]*?trajectoryId: initializedTrajectoryId/);
  assert.match(native, /trajectoryId: prepared.trajectoryId/);
  const environment = readFileSync(new URL("./sandboxEnvironment.ts", import.meta.url), "utf8");
  const initialize = environment.slice(environment.indexOf("export async function initializeSandboxNativeEvidenceTrajectory"), environment.indexOf("export async function getSandboxEnvironmentHistory"));
  assert.match(initialize, /await assertSandboxAccess\(input\)/);
  assert.match(initialize, /loadActiveEnvironmentBank/);
  assert.match(initialize, /const bundle = await ensureTrajectory\(\{ \.\.\.input, bank \}\)/);
  assert.match(initialize, /return bundle\.trajectory\.id/);
  assert.ok(!/INSERT|UPDATE|DELETE|recordSandbox|submitSandbox/.test(initialize));
});

test("stateful targeted re-diagnosis scores honest protocol boundaries and versions its form", () => {
  const original = fixture("stack.normal_independent", "near_stable");
  const projected = projectSandboxNativeDiagnosisOutcome(original);
  const result = compareSandboxDiagnosisProbe({
    sequenceNumber: 1, sessionNumber: 5, phase: "Structured Execution", outcome: projected,
    submitted: { probeId: original.probeId, supportEvent: "none", observations: projected.canonicalObservations },
  });
  assert.equal(result.observationExact, true);
  assert.equal(result.conditionConformed, true);
  assert.equal(result.matchingObservations, 7);
  const source = readFileSync(new URL("./sandboxRediagnosis.ts", import.meta.url), "utf8");
  const planner = source.slice(source.indexOf("async function plan("), source.indexOf("function projectProbe("));
  assert.match(planner, /projectSandboxNativeDiagnosisOutcome\(selectSandboxDiagnosisOutcome\(/);
  assert.match(planner, /"native-protocol-v" \+ SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION/);
});
