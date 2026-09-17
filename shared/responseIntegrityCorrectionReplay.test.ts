import test from "node:test";
import assert from "node:assert/strict";

import {
  encodeRepOperationalEvidenceV2,
  REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY,
} from "./responseIntegrityEvidenceContractV2";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { replayCorrectedTopicLineage } from "./responseIntegrityCorrectionReplay";
import type { ApprovedEvidenceCorrection } from "./responseIntegrityEvidenceCorrection";

const buildTrainingSets = (phase: "Structured Execution" | "Controlled Discomfort", optionIndex: number): SubmittedEvidenceSet[] => {
  const schema = getDrillSchemaDefinition("training", phase);
  return schema.sets.map((definition, setIndex) => ({
    setName: definition.setName,
    setId: definition.setId,
    setOrder: setIndex + 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: definition.constraints,
    observations: Array.from({ length: definition.reps }, (_, repIndex) => {
      const rep: Record<string, string> = {
        _rep_id: getRepPurposeId(definition, repIndex),
        _rep_number: String(repIndex + 1),
      };
      for (const baseField of definition.fields) {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
        const selectedIndex = Math.min(optionIndex, field.optionLevels.length - 1);
        const identity = getEvidenceSelectionIdentity({
          mode: "training",
          phase,
          setName: definition.setName,
          repIndex,
          fieldKey: field.fieldKey,
          optionIndex: selectedIndex,
        })!;
        rep[field.fieldKey] = field.optionLabels![selectedIndex];
        rep[`${field.fieldKey}_option_id`] = identity.optionId;
        rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
        rep[`${field.fieldKey}_level`] = identity.level;
      }
      if (!definition.modelingOnly) {
        rep[REP_OPERATIONAL_EVIDENCE_V2_WIRE_KEY] = encodeRepOperationalEvidenceV2({
          repId: getRepPurposeId(definition, repIndex),
          repNumber: repIndex + 1,
          actualSupportUsed: "none",
          timing: {
            mode: "passive_untimed",
            startedAt: "2026-09-17T08:00:00.000Z",
            endedAt: "2026-09-17T08:00:30.000Z",
            elapsedMs: 30000,
            timingValidity: "valid",
            pressureLevel: phase === "Controlled Discomfort" ? "difficulty" : "none",
          },
          inheritedEvidence: [],
        });
      }
      return rep;
    }),
  }));
};

test("correction replay recomputes the source training transition and skips later phase evidence that is no longer valid", () => {
  const structured = buildTrainingSets("Structured Execution", 2);
  const firstScoredSet = structured.find((set) => set.observations.length > 0 && set.setName !== "Modeling")!;
  const rep = firstScoredSet.observations[0];
  const correction: ApprovedEvidenceCorrection = {
    correctionId: "correction-1",
    correctionKind: "observation_option",
    sourceEvidenceId: "evidence-1",
    sourceDrillId: "drill-1",
    blockOrder: Number(firstScoredSet.setOrder),
    setId: String(firstScoredSet.setId),
    setOrder: Number(firstScoredSet.setOrder),
    repId: String(rep._rep_id),
    repNumber: 1,
    dimensionId: String(rep.startBehavior_dimension_id),
    fieldKey: "startBehavior",
    drillType: "training",
    phase: "Structured Execution",
    drillSchemaId: String(firstScoredSet.drillSchemaId),
    drillSchemaVersion: Number(firstScoredSet.drillSchemaVersion),
    drillDefinitionHash: String(firstScoredSet.drillDefinitionHash),
    originalOptionId: String(rep.startBehavior_option_id),
    originalRawOption: String(rep.startBehavior),
    originalNormalizedLevel: "clear",
    proposedOptionId: getEvidenceSelectionIdentity({
      mode: "training",
      phase: "Structured Execution",
      setName: firstScoredSet.setName,
      repIndex: 0,
      fieldKey: "startBehavior",
      optionIndex: 0,
    })!.optionId,
    proposedRawOption: getFieldDefinitionForRep(
      getDrillSchemaDefinition("training", "Structured Execution").sets[Number(firstScoredSet.setOrder) - 1],
      0,
      "startBehavior",
    )!.optionLabels![0],
    proposedNormalizedLevel: "weak",
  };

  const result = replayCorrectedTopicLineage({
    startingPhase: "Structured Execution",
    startingStability: "High Maintenance",
    events: [
      {
        sourceDrillId: "drill-1",
        submittedAt: "2026-09-17T08:00:00.000Z",
        kind: "training",
        observedPhase: "Structured Execution",
        sets: structured,
        corrections: [correction],
      },
      {
        sourceDrillId: "drill-2",
        submittedAt: "2026-09-17T09:00:00.000Z",
        kind: "training",
        observedPhase: "Controlled Discomfort",
        sets: buildTrainingSets("Controlled Discomfort", 2),
      },
    ],
  });

  assert.equal(result.resultingPhase, "Structured Execution");
  assert.equal(result.lineage[0].status, "replayed");
  assert.equal(result.lineage[1].status, "skipped_invalid_after_correction");
  assert.equal(result.skippedEventCount, 1);
});

test("clean strong replay keeps deterministic topic movement system-owned", () => {
  const result = replayCorrectedTopicLineage({
    startingPhase: "Structured Execution",
    startingStability: "High Maintenance",
    events: [{
      sourceDrillId: "strong",
      submittedAt: "2026-09-17T08:00:00.000Z",
      kind: "training",
      observedPhase: "Structured Execution",
      sets: buildTrainingSets("Structured Execution", 2),
    }],
  });

  assert.equal(result.resultingPhase, "Controlled Discomfort");
  assert.equal(result.resultingStability, "Low");
  assert.equal(result.lineage[0].score, 100);
  assert.equal(result.lineage[0].reason, "phase progress");
});
