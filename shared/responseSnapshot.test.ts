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

const SCORE_BY_PATTERN_CHAR: Record<string, number> = {
  W: 20,
  P: 55,
  S: 90,
};

const REP_LEVEL_BY_PATTERN_CHAR: Record<string, "weak" | "partial" | "clear"> = {
  W: "weak",
  P: "partial",
  S: "clear",
};

function rawOptionsForRepLevel({
  mode,
  phase,
  setName,
  repIndex,
  level,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setName: string;
  repIndex: number;
  level: "weak" | "partial" | "clear";
}) {
  const schema = getDrillSchemaDefinition(mode, phase);
  const set = schema.sets.find((candidate) => candidate.setName === setName);
  assert.ok(set, `Expected registered set ${setName}`);
  const raw: Record<string, string> = {};
  set.fields.forEach((baseField) => {
    const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
    const optionIndex = field.optionLevels.findIndex((candidate) => candidate === level);
    assert.notEqual(optionIndex, -1, `Expected ${setName}.${field.fieldKey} to support ${level}`);
    const selected = field.optionLabels?.[optionIndex];
    assert.ok(selected, `Expected option label for ${setName}.${field.fieldKey}.${level}`);
    raw[field.fieldKey] = selected;
  });
  return raw;
}

function buildSubmittedSetByPattern({
  mode = "training",
  phase,
  setName,
  pattern,
}: {
  mode?: EvidenceDrillMode;
  phase: TopicPhase;
  setName: string;
  pattern: string;
}) {
  return buildSubmittedSet({
    mode,
    phase,
    setName,
    rawByRep: pattern.split("").map((char, repIndex) =>
      rawOptionsForRepLevel({
        mode,
        phase,
        setName,
        repIndex,
        level: REP_LEVEL_BY_PATTERN_CHAR[char],
      }),
    ),
  });
}

function allPatterns(length: number) {
  const chars = ["W", "P", "S"];
  let patterns = [""];
  for (let index = 0; index < length; index += 1) {
    patterns = patterns.flatMap((pattern) => chars.map((char) => `${pattern}${char}`));
  }
  return patterns;
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
    evidence: [
      {
        evidenceId: "drill-legacy|schema|1|hash|set:1:test|rep:1:test|dimension:clarity.vocabulary",
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
        evidenceId: "drill-legacy|schema|1|hash|set:1:test|rep:1:test|dimension:clarity.method",
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
        evidenceId: "drill-legacy|schema|1|hash|set:1:test|rep:1:test|dimension:clarity.reason",
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
    resultText:
      "This rep checked whether the student could identify the type, recall the steps, and explain the reason before solving. The student produced a strong response: Vocabulary: recognized the problem type correctly and Method: recalled the method clearly. The remaining logged observation was that the student Reason: showed weak reason awareness.",
  });

  assert.doesNotMatch(text, /Reason:/);
  assert.match(text, /The remaining logged observation was that the student showed weak reason awareness/);
});

test("clarity modeling is persisted as a non-scored snapshot set", () => {
  const schema = getDrillSchemaDefinition("training", "Clarity");
  const modeling = schema.sets[0];
  const identification = buildSubmittedSetByPattern({
    phase: "Clarity",
    setName: "Identification",
    pattern: "SSS",
  });
  const lightApply = buildSubmittedSetByPattern({
    phase: "Clarity",
    setName: "Light Apply",
    pattern: "SSS",
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-with-modeling",
    topic: "Fractions",
    mode: "training",
    phase: "Clarity",
    sets: [
      {
        setName: modeling.setName,
        setId: modeling.setId,
        setOrder: 1,
        drillSchemaId: schema.schemaId,
        drillSchemaVersion: schema.schemaVersion,
        drillDefinitionHash: schema.definitionHash,
        constraintProfile: modeling.constraints,
        observations: [],
      },
      identification,
      lightApply,
    ],
    setScores: [90, 90],
  });

  assert.equal(snapshot.sets.length, 3);
  assert.equal(snapshot.sets[0].setName, "Modeling");
  assert.equal(snapshot.sets[0].responseLabel, "Not scored");
  assert.equal(snapshot.sets[0].score, null);
  assert.match(snapshot.sets[0].resultText, /No scored student response was recorded/);
  assert.equal(snapshot.drill.patternCode, "SS");
  assert.equal(snapshot.drill.score, 90);
});

test("all 27 ordered rep patterns generate deterministic set responses", () => {
  const patterns = allPatterns(3);
  assert.equal(patterns.length, 27);

  const seen = new Set<string>();
  patterns.forEach((pattern) => {
    const snapshot = buildResponseSnapshotV1({
      sourceDrillId: `set-pattern-${pattern}`,
      topic: "Linear Equations",
      mode: "training",
      phase: "Structured Execution",
      sets: [
        buildSubmittedSetByPattern({
          phase: "Structured Execution",
          setName: "Required Structure",
          pattern,
        }),
      ],
    });

    assert.equal(snapshot.sets[0].patternCode, pattern);
    assert.doesNotMatch(snapshot.sets[0].resultText, /recorded from scored reps/);
    seen.add(snapshot.sets[0].resultText);
  });

  assert.equal(seen.size, 27);
});

test("all drill-level training patterns are resolved with purpose-specific language", () => {
  const scenarios: Array<{ phase: TopicPhase; setNames: string[]; patternLength: number }> = [
    { phase: "Clarity", setNames: ["Identification", "Light Apply"], patternLength: 2 },
    {
      phase: "Structured Execution",
      setNames: ["Required Structure", "Independent Execution", "Variation Control"],
      patternLength: 3,
    },
    {
      phase: "Controlled Discomfort",
      setNames: ["Controlled Entry", "No Rescue", "Repeat Exposure"],
      patternLength: 3,
    },
    {
      phase: "Time Pressure Stability",
      setNames: ["Structure Under Timer", "Repeated Timed Execution", "Full Constraint"],
      patternLength: 3,
    },
  ];

  let checked = 0;
  scenarios.forEach(({ phase, setNames, patternLength }) => {
    allPatterns(patternLength).forEach((pattern) => {
      const sets = setNames.map((setName) =>
        buildSubmittedSetByPattern({
          phase,
          setName,
          pattern: "SSS",
        }),
      );
      const setScores = pattern.split("").map((char) => SCORE_BY_PATTERN_CHAR[char]);
      const drillScore = Math.round(setScores.reduce((sum, score) => sum + score, 0) / setScores.length);
      const snapshot = buildResponseSnapshotV1({
        sourceDrillId: `drill-pattern-${phase}-${pattern}`,
        topic: "Linear Equations",
        mode: "training",
        phase,
        sets,
        drillScore,
        setScores,
      });

      assert.equal(snapshot.drill.patternCode, pattern);
      assert.doesNotMatch(snapshot.drill.resultText, /predefined response checks/);
      assert.match(snapshot.drill.resultText, new RegExp(phase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      setNames.forEach((setName) => {
        const role = setName === "No Rescue" ? "no-rescue" : setName.split(" ")[0].toLowerCase();
        assert.match(snapshot.drill.resultText.toLowerCase(), new RegExp(role));
      });
      checked += 1;
    });
  });

  assert.equal(checked, 90);
});

test("reporting lineage separates evidence occurrences from selected option identities", () => {
  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "lineage-drill",
    topic: "Linear Equations",
    mode: "training",
    phase: "Structured Execution",
    sets: [
      buildSubmittedSetByPattern({
        phase: "Structured Execution",
        setName: "Required Structure",
        pattern: "SSS",
      }),
    ],
  });

  const firstEvidence = snapshot.sets[0].reps[0].evidence[0];
  assert.equal(firstEvidence.evidenceId, snapshot.reportingLineage.evidenceIds[0]);
  assert.equal(firstEvidence.selectedOptionId, snapshot.reportingLineage.selectedOptionIds[0]);
  assert.notEqual(firstEvidence.evidenceId, firstEvidence.selectedOptionId);
  assert.match(firstEvidence.evidenceId, /lineage-drill/);
  assert.match(firstEvidence.evidenceId, /dimension:/);
});

test("targeted re-diagnosis can resolve submitted sets through each block phase", () => {
  const claritySet = buildSubmittedSetByPattern({
    mode: "diagnosis",
    phase: "Clarity",
    setName: "Recognition Probe",
    pattern: "PPP",
  }) as SubmittedEvidenceSet & { phase: TopicPhase };
  claritySet.phase = "Clarity";

  const discomfortSet = buildSubmittedSetByPattern({
    mode: "diagnosis",
    phase: "Controlled Discomfort",
    setName: "First Contact",
    pattern: "SSS",
  }) as SubmittedEvidenceSet & { phase: TopicPhase };
  discomfortSet.phase = "Controlled Discomfort";

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "targeted-rediagnosis",
    topic: "Linear Equations",
    mode: "handover_rediagnosis",
    phase: "Clarity",
    sets: [claritySet, discomfortSet],
    drillScore: 73,
    setScores: [55, 90],
  });

  assert.equal(snapshot.sets[0].setName, "Recognition Probe");
  assert.equal(snapshot.sets[0].score, 55);
  assert.equal(snapshot.sets[1].setName, "First Contact");
  assert.equal(snapshot.sets[1].score, 90);
  assert.match(snapshot.sets[1].reps[0].repPurposeId, /controlled_discomfort\.first_contact/);
});

test("persisted rep wording is rendered verbatim after generation", () => {
  const text = formatSnapshotRepResult({
    repPurposeId: "structured_execution.required_structure.opportunity_1",
    repPurposeText: "the student could pause, state the required method, and execute from the first attempt",
    responseLevel: "strong",
    resultText: "Stored historical sentence.",
    evidence: [
      {
        evidenceId: "stored|evidence",
        dimensionId: "execution.start",
        dimensionLabel: "Start",
        selectedOptionId: "option-id",
        selectedRawOption: "delayed",
        normalizedLevel: "weak",
        humanClause: "started only after delay",
        weight: 25,
        contribution: 0,
      },
    ],
  });

  assert.equal(text, "Stored historical sentence.");
});
