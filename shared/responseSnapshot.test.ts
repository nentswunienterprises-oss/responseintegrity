import assert from "node:assert/strict";
import test from "node:test";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  buildResponseSnapshotV1,
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  summarizeSnapshotObservedResponse,
} from "./responseSnapshot";
import type { TopicPhase } from "./topicConditioningEngine";

function buildSubmittedSet({
  mode,
  phase,
  setName,
  rawByRep,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setName: string;
  rawByRep: Array<Record<string, string>>;
}): SubmittedEvidenceSet {
  const schema = getDrillSchemaDefinition(mode, phase);
  const set = schema.sets.find((candidate) => candidate.setName === setName);
  assert.ok(set, `Expected registered set ${setName}`);

  return {
    setName,
    setId: set.setId,
    setOrder: schema.sets.findIndex((candidate) => candidate.setName === setName) + 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: set.constraints,
    observations: rawByRep.map((repRaw, repIndex) => {
      const rep: Record<string, string> = {
        _rep_id: set.repPurposeIds[repIndex],
        _rep_number: String(repIndex + 1),
      };
      set.fields.forEach((baseField) => {
        const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
        const selected = repRaw[field.fieldKey];
        const optionIndex = field.optionLabels?.indexOf(selected) ?? -1;
        const identity = getEvidenceSelectionIdentity({
          mode,
          phase,
          setName,
          repIndex,
          fieldKey: field.fieldKey,
          optionIndex,
        });
        assert.ok(identity, `Expected evidence identity for ${field.fieldKey}:${selected}`);
        rep[field.fieldKey] = selected;
        rep[`${field.fieldKey}_level`] = identity.level;
        rep[`${field.fieldKey}_option_id`] = identity.optionId;
        rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
      });
      return rep;
    }),
  };
}

test("response snapshot keeps weak evidence visible inside a strong rep", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Structured Execution",
    setName: "Required Structure",
    rawByRep: [
      {
        startBehavior: "delayed",
        stepExecution: "full",
        repeatability: "adjusts",
        independence: "independent",
      },
      {
        startBehavior: "immediate",
        stepExecution: "full",
        repeatability: "already structured correctly",
        independence: "independent",
      },
      {
        startBehavior: "immediate",
        stepExecution: "full",
        repeatability: "already structured correctly",
        independence: "independent",
      },
    ],
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "drill-1",
    topic: "Linear Equations",
    mode: "training",
    phase: "Structured Execution",
    sets: [submittedSet],
    drillScore: 92,
    setScores: [92],
  });

  const firstRep = snapshot.sets[0].reps[0];
  assert.equal(firstRep.responseLabel, "Strong response");
  assert.match(firstRep.resultText, /This rep checked whether/);
  assert.match(firstRep.resultText, /The limiting evidence was that the student started only after delay/);
  assert.doesNotMatch(snapshot.sets[0].resultText, /Require stated step order before solving\. Require stated step order before solving\./);
});

test("response snapshot resolves context-sensitive none from registered evidence", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Controlled Discomfort",
    setName: "Controlled Entry",
    rawByRep: [
      {
        initialResponse: "controlled",
        firstStepControl: "correct",
        discomfortTolerance: "stable",
        rescueDependence: "none",
      },
      {
        initialResponse: "controlled",
        firstStepControl: "correct",
        discomfortTolerance: "stable",
        rescueDependence: "none",
      },
      {
        initialResponse: "controlled",
        firstStepControl: "correct",
        discomfortTolerance: "stable",
        rescueDependence: "none",
      },
    ],
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "drill-2",
    topic: "Quadratics",
    mode: "training",
    phase: "Controlled Discomfort",
    sets: [submittedSet],
    drillScore: 100,
    setScores: [100],
  });

  const rescueEvidence = snapshot.sets[0].reps[0].evidence.find(
    (item) => item.dimensionLabel === "Rescue behavior",
  );
  assert.equal(rescueEvidence?.normalizedLevel, "clear");
  assert.equal(rescueEvidence?.humanClause, "did not seek rescue");
});

test("response snapshot formatter makes old stored text read naturally", () => {
  assert.equal(
    formatSnapshotPurposeText("Build usable recognition before solving by checking vocabulary."),
    "Building usable recognition before solving by checking vocabulary.",
  );
  assert.equal(
    formatSnapshotResultText(
      "Build repeatable recognition without solving. The response remained strong across all three reps; the target behavior was repeatable within this set.",
      "Build repeatable recognition without solving.",
    ),
    "The response remained strong across all three reps; the target behavior was repeatable within this set.",
  );
  assert.equal(
    formatSnapshotResultText(
      "When testing whether clarity could be confirmed, the student produced a strong response: Vocabulary: kept the correct response and Method: stated the required response clearly, with Reason: showed weak reason awareness.",
    ),
    "This rep checked whether clarity could be confirmed. The student produced a strong response: kept the correct response and stated the required response clearly. The remaining logged observation was that the student showed weak reason awareness.",
  );
});

test("clarity identification rep text changes by rep purpose", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Identification",
    rawByRep: [
      {
        vocabulary: "correct",
        method: "clear",
        reason: "weak",
        immediateApply: "confident",
      },
      {
        vocabulary: "correct",
        method: "clear",
        reason: "weak",
        immediateApply: "confident",
      },
      {
        vocabulary: "correct",
        method: "clear",
        reason: "weak",
        immediateApply: "confident",
      },
    ],
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "drill-3",
    topic: "Fractions",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
    drillScore: 84,
    setScores: [84],
  });

  const repTexts = snapshot.sets[0].reps.map((rep) => formatSnapshotRepResult(rep));
  assert.match(repTexts[0], /recognized the problem type and recalled the method before solving/);
  assert.match(repTexts[0], /The remaining logged observation was that the student showed weak reason awareness/);
  assert.match(repTexts[1], /recognition and method recall held on the second example/);
  assert.match(repTexts[2], /recognition and method recall repeated again before active solving/);
  assert.equal(new Set(repTexts).size, 3);
});

test("observed response summary preserves limiting evidence from strong clarity reps", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [
      {
        vocabulary: "correct",
        method: "structured",
        reason: "weak",
        immediateApply: "immediate",
      },
      {
        vocabulary: "correct",
        method: "structured",
        reason: "weak",
        immediateApply: "immediate",
      },
      {
        vocabulary: "correct",
        method: "structured",
        reason: "weak",
        immediateApply: "immediate",
      },
    ],
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "drill-4",
    topic: "Fractions",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
    drillScore: 92,
    setScores: [92],
  });

  assert.equal(
    summarizeSnapshotObservedResponse(snapshot),
    "The student showed clear recognition and method recall during the drill, while weak reason awareness was still logged across the reps.",
  );
});

test("rep formatter strips labels from stored evidence clauses", () => {
  const text = formatSnapshotRepResult({
    repPurposeId: "clarity.identification.opportunity_1",
    repPurposeText: "the student could identify the type, recall the steps, and explain the reason before solving",
    responseLevel: "strong",
    resultText: "",
    evidence: [
      {
        dimensionId: "clarity.vocabulary",
        dimensionLabel: "Vocabulary",
        selectedOptionId: "option-1",
        selectedRawOption: "correct",
        normalizedLevel: "clear",
        humanClause: "Vocabulary: recognized the problem type correctly",
        weight: 30,
        contribution: 30,
      },
      {
        dimensionId: "clarity.method",
        dimensionLabel: "Method",
        selectedOptionId: "option-2",
        selectedRawOption: "clear",
        normalizedLevel: "clear",
        humanClause: "Method: recalled the method clearly",
        weight: 30,
        contribution: 30,
      },
      {
        dimensionId: "clarity.reason",
        dimensionLabel: "Reason",
        selectedOptionId: "option-3",
        selectedRawOption: "weak",
        normalizedLevel: "partial",
        humanClause: "Reason: showed weak reason awareness",
        weight: 20,
        contribution: 12,
      },
    ],
  });

  assert.doesNotMatch(text, /Reason:/);
  assert.match(text, /The remaining logged observation was that the student showed weak reason awareness/);
});
