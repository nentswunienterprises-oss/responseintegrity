import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DIAGNOSIS_PROBES, DIAGNOSIS_PROBE_EXECUTION_PROTOCOLS } from "../shared/evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "../shared/diagnosisObservationMatrix";
import type { SandboxDiagnosisOutcomeDefinition } from "../shared/sandboxDiagnosisEnvironment";
import { projectSandboxNativeDiagnosisOutcome } from "./sandboxNativeDiagnosisProjection";

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

test("native stories distinguish the observed dimensions without exposing private IDs", () => {
  for (const probeId of Object.keys(DIAGNOSIS_PROBES) as Array<SandboxDiagnosisOutcomeDefinition["probeId"]>) {
    const original = fixture(probeId, "near_stable");
    const result = projectSandboxNativeDiagnosisOutcome(original);
    if (probeId !== "stack.normal_independent") assert.deepEqual(result.canonicalObservations, original.canonicalObservations);
    for (const observation of result.canonicalObservations) {
      if (observation.behaviorId === "not_observed") continue;
      const dimension = DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId];
      assert.ok(result.studentBehavior.includes(dimension.options.find(o => o.id === observation.behaviorId)!.detail));
      assert.ok(!result.studentBehavior.includes(observation.behaviorId));
    }
    assert.ok(result.studentBehavior.startsWith(original.studentBehavior), "Preserve incident context, including real reference cues");
  }
});


test("prepare and submit share projected truth and invalidate older issued forms", () => {
  const source = readFileSync(new URL("./sandboxRediagnosis.ts", import.meta.url), "utf8");
  const native = source.slice(source.indexOf("export async function prepareSandboxLiveEvidenceSimulation"));
  assert.equal((native.match(/projectSandboxNativeDiagnosisOutcome\(selectSandboxDiagnosisOutcome\(/g) || []).length, 2);
  assert.match(native, /"native-protocol-v" \+ SANDBOX_NATIVE_DIAGNOSIS_PROTOCOL_VERSION/);
  assert.match(native, /prepared.formId !== input.formId[\s\S]*opportunity is stale/);
});
