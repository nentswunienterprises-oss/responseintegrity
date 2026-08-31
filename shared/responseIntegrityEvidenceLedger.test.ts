import test from "node:test";
import assert from "node:assert/strict";

import {
  projectResponseIntegrityEvidenceLedger,
  type EvidenceLedgerProjectionInput,
  type LedgerEvidenceSet,
} from "./responseIntegrityEvidenceLedger";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  type EvidenceDrillMode,
} from "./responseIntegrityDrillRegistry";
import type { TopicPhase } from "./topicConditioningEngine";

const buildValidSet = ({
  mode,
  phase,
  setIndex,
  selectOptionIndex,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setIndex: number;
  selectOptionIndex?: (repIndex: number, fieldKey: string, optionCount: number) => number;
}): LedgerEvidenceSet => {
  const schema = getDrillSchemaDefinition(mode, phase);
  const definition = schema.sets[setIndex];
  return {
    phase,
    setName: definition.setName,
    setId: definition.setId,
    setOrder: setIndex + 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: definition.constraints,
    observations: definition.modelingOnly
      ? []
      : Array.from({ length: definition.reps }, (_, repIndex) => {
          const rep: Record<string, string> = {
            _rep_id: getRepPurposeId(definition, repIndex),
            _rep_number: String(repIndex + 1),
          };
          definition.fields.forEach((baseField) => {
            const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
            const optionIndex = selectOptionIndex
              ? selectOptionIndex(repIndex, field.fieldKey, field.optionLevels.length)
              : field.optionLevels.length - 1;
            const identity = getEvidenceSelectionIdentity({
              mode,
              phase,
              setName: definition.setName,
              repIndex,
              fieldKey: field.fieldKey,
              optionIndex,
            })!;
            rep[field.fieldKey] = field.optionLabels![optionIndex];
            rep[`${field.fieldKey}_option_id`] = identity.optionId;
            rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
            rep[`${field.fieldKey}_level`] = identity.level;
          });
          return rep;
        }),
  };
};

const baseProjectionInput = (sets: LedgerEvidenceSet[]): EvidenceLedgerProjectionInput => ({
  sourceDrillId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222222",
  tutorId: "33333333-3333-4333-8333-333333333333",
  topic: "Linear Equations",
  scheduledSessionId: "44444444-4444-4444-8444-444444444444",
  trainingSessionRunId: "55555555-5555-4555-8555-555555555555",
  sessionContext: "active_training",
  drillType: "training",
  observedPhase: "Structured Execution",
  statePhaseBefore: "Structured Execution",
  stabilityBefore: "High",
  statePhaseAfter: "Structured Execution",
  stabilityAfter: "High Maintenance",
  transitionReason: "stability advance",
  observedAt: "2026-08-29T10:00:00.000Z",
  sets,
});

test("ledger projection preserves one weak and eight clear opportunities without deduplication", () => {
  const sets = getDrillSchemaDefinition("training", "Structured Execution").sets.map((_, setIndex) =>
    buildValidSet({
      mode: "training",
      phase: "Structured Execution",
      setIndex,
      selectOptionIndex: (repIndex, fieldKey, optionCount) =>
        setIndex === 0 && repIndex === 0 && fieldKey === "startBehavior" ? 0 : optionCount - 1,
    }),
  );

  const result = projectResponseIntegrityEvidenceLedger(baseProjectionInput(sets));
  assert.equal(result.status, "projected");
  if (result.status !== "projected") return;

  assert.equal(result.entries.length, 36);
  assert.equal(new Set(result.entries.map((entry) => entry.evidenceId)).size, 36);
  const startEvidence = result.entries.filter((entry) => entry.dimensionId === "execution.start");
  assert.equal(startEvidence.length, 9);
  assert.equal(startEvidence.filter((entry) => entry.normalizedLevel === "weak").length, 1);
  assert.equal(startEvidence.filter((entry) => entry.normalizedLevel === "clear").length, 8);
});

test("ledger projection retains state, session, constraint, and score lineage", () => {
  const set = buildValidSet({
    mode: "training",
    phase: "Structured Execution",
    setIndex: 0,
    selectOptionIndex: (_repIndex, fieldKey, optionCount) => fieldKey === "stepExecution" ? 1 : optionCount - 1,
  });
  const result = projectResponseIntegrityEvidenceLedger(baseProjectionInput([set]));
  assert.equal(result.status, "projected");
  if (result.status !== "projected") return;

  const stepEvidence = result.entries.find((entry) => entry.dimensionId === "execution.step_discipline")!;
  assert.equal(stepEvidence.sessionGroupId, "44444444-4444-4444-8444-444444444444");
  assert.equal(stepEvidence.stabilityBefore, "High");
  assert.equal(stepEvidence.stabilityAfter, "High Maintenance");
  assert.equal(stepEvidence.transitionReason, "stability advance");
  assert.equal(stepEvidence.constraintProfile.supportLevel, "minimal");
  assert.equal(stepEvidence.normalizedLevel, "partial");
  assert.equal(stepEvidence.scoreContribution, 18);
  assert.equal(stepEvidence.scoreContributionMax, 30);
});

test("ledger projection is deterministic across retries", () => {
  const set = buildValidSet({ mode: "training", phase: "Structured Execution", setIndex: 0 });
  const first = projectResponseIntegrityEvidenceLedger(baseProjectionInput([set]));
  const retry = projectResponseIntegrityEvidenceLedger(baseProjectionInput([set]));

  assert.deepEqual(retry, first);
});

test("fully legacy evidence remains readable by current engines but is not silently promoted into the ledger", () => {
  const input = baseProjectionInput([{
    setName: "Required Structure",
    observations: [{ startBehavior: "immediate", startBehavior_level: "clear" }],
  }]);

  assert.deepEqual(projectResponseIntegrityEvidenceLedger(input), {
    status: "legacy_unprojected",
    entries: [],
    issues: [],
  });
});

test("adaptive diagnosis blocks retain the phase in which each observation occurred", () => {
  const clarity = buildValidSet({ mode: "diagnosis", phase: "Clarity", setIndex: 0 });
  const execution = buildValidSet({ mode: "diagnosis", phase: "Structured Execution", setIndex: 0 });
  const input: EvidenceLedgerProjectionInput = {
    ...baseProjectionInput([clarity, execution]),
    drillType: "diagnosis",
    sessionContext: "intro",
    observedPhase: "Structured Execution",
    statePhaseBefore: "Clarity",
    stabilityBefore: null,
    stabilityAfter: "High",
  };
  const result = projectResponseIntegrityEvidenceLedger(input);
  assert.equal(result.status, "projected");
  if (result.status !== "projected") return;

  assert.deepEqual(new Set(result.entries.map((entry) => entry.phase)), new Set(["Clarity", "Structured Execution"]));
  assert.deepEqual(new Set(result.entries.map((entry) => entry.blockOrder)), new Set([1, 2]));
});
