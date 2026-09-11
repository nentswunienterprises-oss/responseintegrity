import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentCapabilityReadinessEvidence } from "./capabilityEvidenceSelection";

test("current bank v2 attempt 1 outranks retired v1 attempt 3", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence({
    assessments: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 1,
        attemptNumber: 3,
        passed: true,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-10T10:00:00Z",
      },
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 2,
        attemptNumber: 1,
        passed: true,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-11T10:00:00Z",
      },
    ],
    activeAssessmentVersions: [{ assessmentKey: "clarity_mastery_v1", bankVersion: 2 }],
    practicals: [],
    currentPracticalVersions: [],
    oralDefenses: [],
    currentOralDefenseVersion: 1,
  });

  assert.deepEqual(evidence.passedAssessmentKeys, ["clarity_mastery_v1"]);
  assert.deepEqual(evidence.satisfiedEvidenceCells, ["deep_dive.clarity.mastery"]);
});

test("current bank v2 failure invalidates a retired v1 pass even when v1 had more attempts", () => {
  const evidence = selectCurrentCapabilityReadinessEvidence({
    assessments: [
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 1,
        attemptNumber: 3,
        passed: true,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-10T10:00:00Z",
      },
      {
        assessmentKey: "clarity_mastery_v1",
        bankVersion: 2,
        attemptNumber: 1,
        passed: false,
        evidenceKind: "mastery",
        coveredDeepDiveKeys: ["clarity"],
        completedAt: "2026-09-11T10:00:00Z",
      },
    ],
    activeAssessmentVersions: [{ assessmentKey: "clarity_mastery_v1", bankVersion: 2 }],
    practicals: [],
    currentPracticalVersions: [],
    oralDefenses: [],
    currentOralDefenseVersion: 1,
  });

  assert.deepEqual(evidence.passedAssessmentKeys, []);
  assert.deepEqual(evidence.satisfiedEvidenceCells, []);
});
