import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentCapabilityReadinessEvidence } from "./capabilityEvidenceSelection";

const legacyRetrieval = {
  assessmentKey: "clarity_retrieval_v1",
  bankVersion: 1,
  attemptNumber: 1,
  passed: true,
  evidenceKind: "retrieval" as const,
  coveredDeepDiveKeys: ["clarity"],
  completedAt: "2026-09-11T10:00:00Z",
};

function base() {
  return {
    assessments: [legacyRetrieval],
    activeAssessmentVersions: [{ assessmentKey: legacyRetrieval.assessmentKey, bankVersion: 1 }],
    practicals: [],
    currentPracticalVersions: [],
    oralDefenses: [],
    currentOralDefenseVersion: 1,
  };
}

test("legacy shadow evidence remains selectable when no V2 plan restriction is requested", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence(base());
  assert.deepEqual(evidence.passedAssessmentKeys, ["clarity_retrieval_v1"]);
  assert.deepEqual(evidence.satisfiedEvidenceCells, ["deep_dive.clarity.retrieval"]);
});

test("V2 callers can exclude legacy shadow banks from capability-cell credit", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence({
    ...base(),
    allowedAssessmentKeys: ["transformation_phases_retrieval_v1"],
  });
  assert.deepEqual(evidence.passedAssessmentKeys, []);
  assert.deepEqual(evidence.satisfiedEvidenceCells, []);
});
