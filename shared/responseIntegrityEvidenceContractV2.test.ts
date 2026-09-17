import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeRepOperationalEvidenceV2,
  encodeRepOperationalEvidenceV2,
  type RepOperationalEvidenceV2,
} from "./responseIntegrityEvidenceContractV2";

const validEvidence = (): RepOperationalEvidenceV2 => ({
  repId: "structured_execution.independent_execution.opportunity_1",
  repNumber: 1,
  actualSupportUsed: "none",
  timing: {
    mode: "passive_untimed",
    startedAt: "2026-09-17T07:00:00.000Z",
    endedAt: "2026-09-17T07:01:00.000Z",
    elapsedMs: 60000,
    timingValidity: "valid",
    pressureLevel: "none",
  },
  inheritedEvidence: [
    {
      dimensionId: "clarity.method",
      rawObservation: "The student could no longer identify the known method without rescue.",
      normalizedLevel: "weak",
      materiality: "material",
    },
  ],
});

test("V2 codec accepts canonical inherited-layer evidence", () => {
  const evidence = validEvidence();
  assert.deepEqual(decodeRepOperationalEvidenceV2(encodeRepOperationalEvidenceV2(evidence)), evidence);
});

test("V2 decoder rejects an unknown inherited dimension", () => {
  const encoded = JSON.parse(encodeRepOperationalEvidenceV2(validEvidence()));
  encoded.evidence.inheritedEvidence[0].dimensionId = "execution.made_up_dimension";
  assert.equal(decodeRepOperationalEvidenceV2(encoded), null);
});

test("V2 decoder rejects empty inherited observations", () => {
  const encoded = JSON.parse(encodeRepOperationalEvidenceV2(validEvidence()));
  encoded.evidence.inheritedEvidence[0].rawObservation = "   ";
  assert.equal(decodeRepOperationalEvidenceV2(encoded), null);
});

test("V2 decoder rejects invalid inherited materiality and levels", () => {
  const badMateriality = JSON.parse(encodeRepOperationalEvidenceV2(validEvidence()));
  badMateriality.evidence.inheritedEvidence[0].materiality = "critical";
  assert.equal(decodeRepOperationalEvidenceV2(badMateriality), null);

  const badLevel = JSON.parse(encodeRepOperationalEvidenceV2(validEvidence()));
  badLevel.evidence.inheritedEvidence[0].normalizedLevel = "broken";
  assert.equal(decodeRepOperationalEvidenceV2(badLevel), null);
});
