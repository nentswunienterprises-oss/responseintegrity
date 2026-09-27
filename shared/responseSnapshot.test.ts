import assert from "node:assert/strict";
import test from "node:test";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionsForRep,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import {
  buildResponseSnapshotV1,
  formatSnapshotEvidenceClassLabel,
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  prepareResponseSnapshotForDisplay,
  summarizeSnapshotEvidenceMix,
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
      getFieldDefinitionsForRep(set, repIndex).forEach((field) => {
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
        if (identity.evidenceClass) {
          rep[`${field.fieldKey}_evidence_class`] = identity.evidenceClass;
        }
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
  getFieldDefinitionsForRep(set, repIndex).forEach((field) => {
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

function rawOptionsForMixedRepLevels({
  mode,
  phase,
  setName,
  repIndex,
  levels,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setName: string;
  repIndex: number;
  levels: Array<"weak" | "partial" | "clear">;
}) {
  const schema = getDrillSchemaDefinition(mode, phase);
  const set = schema.sets.find((candidate) => candidate.setName === setName);
  assert.ok(set, `Expected registered set ${setName}`);
  const raw: Record<string, string> = {};

  getFieldDefinitionsForRep(set, repIndex).forEach((field, fieldIndex) => {
    const level = levels[(fieldIndex + repIndex) % levels.length];
    const optionIndex = field.optionLevels.findIndex(
      (candidate) => candidate === level,
    );
    assert.notEqual(
      optionIndex,
      -1,
      `Expected ${setName}.${field.fieldKey} to support ${level}`,
    );
    const selected = field.optionLabels?.[optionIndex];
    assert.ok(selected);
    raw[field.fieldKey] = selected;
  });

  return raw;
}

function rawOptionsForEvidenceClasses({
  phase,
  setName,
  repIndex,
  classes,
}: {
  phase: TopicPhase;
  setName: string;
  repIndex: number;
  classes: Record<string, "breakdown" | "conditional" | "near_stable" | "supported">;
}) {
  const schema = getDrillSchemaDefinition("training", phase);
  const set = schema.sets.find((candidate) => candidate.setName === setName);
  assert.ok(set, `Expected registered set ${setName}`);
  const raw: Record<string, string> = {};

  getFieldDefinitionsForRep(set, repIndex).forEach((field) => {
    const evidenceClass =
      classes[field.fieldKey] ||
      (field.decisionEligible === false ? "supported" : undefined);
    assert.ok(evidenceClass, `Missing evidence class for ${setName}.${field.fieldKey}`);
    const optionIndex =
      field.optionEvidenceClasses?.findIndex(
        (candidate) => candidate === evidenceClass,
      ) ?? -1;
    assert.notEqual(
      optionIndex,
      -1,
      `Expected ${setName}.${field.fieldKey} to expose ${evidenceClass}`,
    );
    const selected = field.optionLabels?.[optionIndex];
    assert.ok(selected);
    raw[field.fieldKey] = selected;
  });

  return raw;
}

function allPatterns(length: number) {
  const chars = ["W", "P", "S"];
  let patterns = [""];
  for (let index = 0; index < length; index += 1) {
    patterns = patterns.flatMap((pattern) => chars.map((char) => `${pattern}${char}`));
  }
  return patterns;
}

test("not observed evidence stays neutral while observed evidence still scores the rep", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Light Apply",
        repIndex,
        classes: {
          vocabulary: "supported",
          method: "supported",
          reason: "supported",
          immediateApply: "supported",
        },
      }),
    ),
  });

  submittedSet.observations[2].reason_evidence_status = "not_observed";

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-not-observed",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });

  const finalRep = snapshot.sets[0].reps[2];
  assert.equal(finalRep.responseLabel, "Strong response");
  assert.equal(finalRep.score, 100);
  assert.match(formatSnapshotRepResult(finalRep), /Reason was not observed/i);
  assert.match(
    formatSnapshotRepResult(finalRep),
    /did not count toward the evidence decision/i,
  );
  assert.equal(snapshot.sets[0].responseLabel, "Strong response");
});

test("a fully unscored rep does not lower a set score", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Light Apply",
        repIndex,
        classes: {
          vocabulary: "supported",
          method: "supported",
          reason: "supported",
          immediateApply: "supported",
        },
      }),
    ),
  });

  Object.keys(submittedSet.observations[2])
    .filter((key) => key.endsWith("_evidence_status"))
    .forEach((key) => {
      submittedSet.observations[2][key] = "not_observed";
    });
  ["vocabulary", "method", "reason", "immediateApply"].forEach((fieldKey) => {
    submittedSet.observations[2][`${fieldKey}_evidence_status`] = "not_observed";
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-unscored-rep",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });

  assert.equal(snapshot.sets[0].reps[2].responseLabel, "Not scored");
  assert.equal(snapshot.sets[0].score, 100);
  assert.match(snapshot.sets[0].resultText, /did not count toward the evidence decision/i);
});

test("response snapshot preserves breakdown evidence even when the legacy compatibility band is strong", () => {
  const supported = {
    startBehavior: "supported",
    stepExecution: "supported",
    repeatability: "supported",
    independence: "supported",
  } as const;
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Structured Execution",
    setName: "Required Structure",
    rawByRep: [
      rawOptionsForEvidenceClasses({
        phase: "Structured Execution",
        setName: "Required Structure",
        repIndex: 0,
        classes: { ...supported, independence: "breakdown" },
      }),
      rawOptionsForEvidenceClasses({
        phase: "Structured Execution",
        setName: "Required Structure",
        repIndex: 1,
        classes: supported,
      }),
      rawOptionsForEvidenceClasses({
        phase: "Structured Execution",
        setName: "Required Structure",
        repIndex: 2,
        classes: supported,
      }),
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
  assert.equal(
    firstRep.evidence.some(
      (item) => item.dimensionId === "execution.repeatability",
    ),
    false,
  );
  assert.equal(
    firstRep.evidence.some(
      (item) =>
        item.dimensionId ===
        "condition.required_structure.step_plan_accuracy",
    ),
    true,
  );
  assert.equal(
    snapshot.sets[0].reps[1].evidence.some(
      (item) => item.dimensionId === "execution.repeatability",
    ),
    true,
  );
  assert.equal(firstRep.responseLabel, "Strong response");
  const conditionEvidence = firstRep.evidence.find(
    (item) =>
      item.dimensionId ===
      "condition.required_structure.step_plan_accuracy",
  );
  assert.equal(conditionEvidence?.decisionEligible, false);
  assert.equal(formatSnapshotEvidenceClassLabel(conditionEvidence!), "Condition check");
  assert.doesNotMatch(summarizeSnapshotEvidenceMix(firstRep.evidence), /condition/i);
  assert.match(firstRep.resultText, /This rep checked whether/);
  assert.match(firstRep.resultText, /depended on external carrying/i);
  assert.doesNotMatch(snapshot.sets[0].resultText, /Require stated step order before solving\. Require stated step order before solving\./);
});


test("response snapshot resolves canonical rescue behavior from registered evidence", () => {
  const classes = {
    initialResponse: "supported",
    firstStepControl: "supported",
    discomfortTolerance: "supported",
    rescueDependence: "supported",
  } as const;
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Controlled Discomfort",
    setName: "Controlled Entry",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Controlled Discomfort",
        setName: "Controlled Entry",
        repIndex,
        classes,
      }),
    ),
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
  assert.match(rescueEvidence?.humanClause || "", /retained responsibility for the attempt/i);
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
    "This rep checked whether clarity could be confirmed. The student kept the correct response and stated the required response clearly. One part remained incomplete: the student showed weak reason awareness.",
  );
  assert.equal(
    formatSnapshotResultText(
      "The student showed a strong response in Clarity evidence across the scored drill.",
    ),
    "Across the drill, performance was strong across the Clarity checks.",
  );
});

test("clarity identification rep text changes by rep purpose", () => {
  const classes = {
    vocabulary: "supported",
    method: "supported",
    reason: "conditional",
    immediateApply: "supported",
  } as const;
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Identification",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex,
        classes,
      }),
    ),
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

  assert.equal(
    snapshot.sets[0].reps.every((rep) =>
      rep.evidence.every(
        (item) => item.dimensionId !== "clarity.immediate_apply",
      ),
    ),
    true,
    "Identification must not report application evidence from a no-solving set",
  );
  const repTexts = snapshot.sets[0].reps.map((rep) => formatSnapshotRepResult(rep));
  assert.match(repTexts[0], /identified the important terms and selected the method before solving/);
  assert.match(repTexts[0], /explanation contained some correct structure/i);
  assert.match(repTexts[1], /identified the important terms and selected the method on the second unsolved example/i);
  assert.match(repTexts[2], /identified the important terms and selected the method on the final unsolved example/i);
  assert.equal(new Set(repTexts).size, 3);
});


test("a successful final Identification rep does not manufacture repeatability after earlier weak evidence", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Identification",
    rawByRep: [
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 0,
        classes: {
          vocabulary: "conditional",
          method: "conditional",
          reason: "conditional",
          immediateApply: "supported",
        },
      }),
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 1,
        classes: {
          vocabulary: "breakdown",
          method: "breakdown",
          reason: "breakdown",
          immediateApply: "supported",
        },
      }),
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 2,
        classes: {
          vocabulary: "supported",
          method: "supported",
          reason: "supported",
          immediateApply: "supported",
        },
      }),
    ],
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-identification-recovery-without-repeatability",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });

  const finalRep = snapshot.sets[0].reps[2];
  const renderedFinalRep = formatSnapshotRepResult(finalRep);

  assert.match(renderedFinalRep, /final unsolved example/i);
  assert.doesNotMatch(
    renderedFinalRep,
    /repeatable|repeated again|confirmed across|consistency (?:was )?confirmed|rather than isolated/i,
  );
  assert.doesNotMatch(
    finalRep.repPurposeText,
    /repeatable|confirmed across|rather than isolated/i,
  );
  assert.match(snapshot.sets[0].resultText, /breakdown evidence/i);
  assert.match(snapshot.sets[0].resultText, /conditional evidence/i);
  assert.match(snapshot.sets[0].resultText, /supported evidence/i);
});

test("single rep narratives never claim cross-rep repeatability from that rep alone", () => {
  const phases: TopicPhase[] = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ];
  const modes: EvidenceDrillMode[] = ["training", "diagnosis", "verification"];
  const crossRepClaim =
    /repeatable|confirmed across|across repetition|rather than isolated|consistency (?:was )?confirmed/i;
  let checked = 0;

  modes.forEach((mode) => {
    phases.forEach((phase) => {
      const schema = getDrillSchemaDefinition(mode, phase);
      schema.sets
        .filter((set) => !set.modelingOnly && set.fields.length > 0 && set.reps >= 3)
        .forEach((set) => {
          const submittedSet = buildSubmittedSet({
            mode,
            phase,
            setName: set.setName,
            rawByRep: Array.from({ length: set.reps }, (_, repIndex) =>
              rawOptionsForRepLevel({
                mode,
                phase,
                setName: set.setName,
                repIndex,
                level:
                  repIndex === set.reps - 1
                    ? "clear"
                    : repIndex === 0
                      ? "weak"
                      : "partial",
              }),
            ),
          });
          const snapshot = buildResponseSnapshotV1({
            sourceDrillId: `rep-local-${mode}-${phase}-${set.setId}`,
            topic: "Algebra",
            mode,
            phase,
            sets: [submittedSet],
          });
          const finalRep = snapshot.sets[0].reps.at(-1);
          assert.ok(finalRep);
          assert.doesNotMatch(finalRep.repPurposeText, crossRepClaim);
          assert.doesNotMatch(formatSnapshotRepResult(finalRep), crossRepClaim);
          checked += 1;
        });
    });
  });

  assert.equal(checked, 19, "Expected every registered three-rep scored set to enforce rep-local narration");
});

test("historical persisted Snapshots recover exact evidence classes without exposing legacy labels", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Identification",
    rawByRep: [
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 0,
        classes: {
          vocabulary: "conditional",
          method: "conditional",
          reason: "conditional",
          immediateApply: "supported",
        },
      }),
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 1,
        classes: {
          vocabulary: "breakdown",
          method: "breakdown",
          reason: "breakdown",
          immediateApply: "supported",
        },
      }),
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Identification",
        repIndex: 2,
        classes: {
          vocabulary: "supported",
          method: "supported",
          reason: "supported",
          immediateApply: "supported",
        },
      }),
    ],
  });

  const generated = buildResponseSnapshotV1({
    sourceDrillId: "historical-snapshot-display-upgrade",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });
  const historical = JSON.parse(JSON.stringify(generated));

  historical.sets[0].reps.forEach((rep: any) => {
    rep.evidence.forEach((item: any) => {
      delete item.evidenceClass;
      delete item.decisionEligible;
    });
  });
  historical.sets[0].reps[2].repPurposeText =
    "clarity could be confirmed as repeatable before active solving";
  historical.sets[0].reps[2].resultText =
    "This rep checked whether clarity could be confirmed as repeatable before active solving. Term recognition and method selection repeated again before active solving.";

  const view = prepareResponseSnapshotForDisplay(historical);

  assert.equal(
    summarizeSnapshotEvidenceMix(view.sets[0].reps[0].evidence),
    "3 conditional",
  );
  assert.equal(
    summarizeSnapshotEvidenceMix(view.sets[0].reps[1].evidence),
    "3 breakdown",
  );
  assert.equal(
    summarizeSnapshotEvidenceMix(view.sets[0].reps[2].evidence),
    "3 supported",
  );
  assert.equal(
    formatSnapshotEvidenceClassLabel(view.sets[0].reps[0].evidence[0]),
    "Conditional",
  );
  assert.doesNotMatch(
    view.sets.flatMap((set: any) =>
      set.reps.flatMap((rep: any) =>
        rep.evidence.map((item: any) => formatSnapshotEvidenceClassLabel(item)),
      ),
    ).join(" "),
    /legacy/i,
  );
  assert.match(
    view.sets[0].reps[2].resultText,
    /final unsolved example/i,
  );
  assert.doesNotMatch(
    view.sets[0].reps[2].resultText,
    /repeatable|repeated again/i,
  );
});

test("clarity light-apply narrative states what happened instead of repeating the response label", () => {
  const classes = {
    vocabulary: "supported",
    method: "supported",
    reason: "near_stable",
    immediateApply: "supported",
  } as const;
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Light Apply",
        repIndex,
        classes,
      }),
    ),
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-light-apply-natural-language",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });

  assert.equal(
    snapshot.sets[0].reps[0].resultText,
    "This rep checked whether the student's clarity would carry into the first light solving attempt. The first light solving attempt kept the vocabulary and method intact. One part was near-stable: the causal logic was substantially correct but still had a small decision-relevant gap.",
  );
  assert.doesNotMatch(
    snapshot.sets[0].reps[0].resultText,
    /produced a (?:strong|partial|weak) response|showed evidence that|remaining logged observation/i,
  );
  const reasonEvidence = snapshot.sets[0].reps[0].evidence.find(
    (item) => item.dimensionId === "clarity.reason",
  );
  assert.equal(reasonEvidence?.evidenceClass, "near_stable");
  assert.equal(formatSnapshotEvidenceClassLabel(reasonEvidence!), "Near-stable");
  assert.equal(
    summarizeSnapshotEvidenceMix(snapshot.sets[0].reps[0].evidence),
    "3 supported · 1 near-stable",
  );
  assert.match(snapshot.sets[0].resultText, /Near-stable evidence remained/i);
  assert.match(snapshot.drill.resultText, /near-stable evidence/i);
});

test("rep narratives remain natural across every phase, drill mode, set, rep, and response level", () => {
  const phases: TopicPhase[] = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ];
  const modes: EvidenceDrillMode[] = ["training", "diagnosis", "verification"];
  const levels: Array<"weak" | "partial" | "clear"> = [
    "weak",
    "partial",
    "clear",
  ];
  const roboticPhrases =
    /produced a (?:strong|partial|weak) response|response was (?:strong|partial|weak)(?: overall)?|remaining logged observation|limiting evidence|showed evidence that/i;
  let checked = 0;

  modes.forEach((mode) => {
    phases.forEach((phase) => {
      const schema = getDrillSchemaDefinition(mode, phase);
      schema.sets
        .filter((set) => !set.modelingOnly && set.fields.length > 0)
        .forEach((set) => {
          levels.forEach((level) => {
            const submittedSet = buildSubmittedSet({
              mode,
              phase,
              setName: set.setName,
              rawByRep: Array.from({ length: set.reps }, (_, repIndex) =>
                rawOptionsForRepLevel({
                  mode,
                  phase,
                  setName: set.setName,
                  repIndex,
                  level,
                }),
              ),
            });
            const snapshot = buildResponseSnapshotV1({
              sourceDrillId: `natural-${mode}-${phase}-${set.setId}-${level}`,
              topic: "Algebra",
              mode,
              phase,
              sets: [submittedSet],
            });

            snapshot.sets[0].reps.forEach((rep) => {
              const rendered = formatSnapshotRepResult(rep);
              assert.match(rendered, /^This rep checked whether /);
              assert.doesNotMatch(rep.resultText, roboticPhrases);
              assert.doesNotMatch(rendered, roboticPhrases);
              checked += 1;
            });
            assert.doesNotMatch(
              snapshot.drill.resultText,
              /student produced a (?:strong|partial|weak) response/i,
            );
          });
        });
    });
  });

  assert.equal(checked, 195, "Expected every scored rep across training, diagnosis, and verification schemas");
});

test("mixed evidence combinations stay natural across every phase and drill mode", () => {
  const phases: TopicPhase[] = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ];
  const modes: EvidenceDrillMode[] = ["training", "diagnosis", "verification"];
  const combinations: Array<Array<"weak" | "partial" | "clear">> = [
    ["clear", "partial"],
    ["clear", "weak"],
    ["clear", "partial", "weak"],
    ["partial", "weak"],
  ];
  const roboticPhrases =
    /produced a (?:strong|partial|weak) response|response was (?:strong|partial|weak)(?: overall)?|remaining logged observation|limiting evidence|showed evidence that/i;
  let checked = 0;

  modes.forEach((mode) => {
    phases.forEach((phase) => {
      const schema = getDrillSchemaDefinition(mode, phase);
      schema.sets
        .filter((set) => !set.modelingOnly && set.fields.length > 0)
        .forEach((set) => {
          combinations.forEach((levels, combinationIndex) => {
            const submittedSet = buildSubmittedSet({
              mode,
              phase,
              setName: set.setName,
              rawByRep: Array.from({ length: set.reps }, (_, repIndex) =>
                rawOptionsForMixedRepLevels({
                  mode,
                  phase,
                  setName: set.setName,
                  repIndex,
                  levels,
                }),
              ),
            });
            const snapshot = buildResponseSnapshotV1({
              sourceDrillId: `mixed-${mode}-${phase}-${set.setId}-${combinationIndex}`,
              topic: "Algebra",
              mode,
              phase,
              sets: [submittedSet],
            });

            snapshot.sets[0].reps.forEach((rep) => {
              const rendered = formatSnapshotRepResult(rep);
              assert.match(rendered, /^This rep checked whether /);
              assert.doesNotMatch(rep.resultText, roboticPhrases);
              assert.doesNotMatch(rendered, roboticPhrases);
              checked += 1;
            });
          });
        });
    });
  });

  assert.ok(checked >= 250, `Expected broad mixed-evidence coverage, checked ${checked}`);
});

test("conditional and near-stable remain distinct in Response Snapshot evidence", () => {
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Light Apply",
        repIndex,
        classes: {
          vocabulary: "supported",
          method: "supported",
          reason: repIndex === 0 ? "conditional" : "near_stable",
          immediateApply: "supported",
        },
      }),
    ),
  });

  const snapshot = buildResponseSnapshotV1({
    sourceDrillId: "clarity-four-class-separation",
    topic: "Algebra",
    mode: "training",
    phase: "Clarity",
    sets: [submittedSet],
  });

  const firstReason = snapshot.sets[0].reps[0].evidence.find(
    (item) => item.dimensionId === "clarity.reason",
  );
  const secondReason = snapshot.sets[0].reps[1].evidence.find(
    (item) => item.dimensionId === "clarity.reason",
  );

  assert.equal(firstReason?.evidenceClass, "conditional");
  assert.equal(secondReason?.evidenceClass, "near_stable");
  assert.equal(formatSnapshotEvidenceClassLabel(firstReason!), "Conditional");
  assert.equal(formatSnapshotEvidenceClassLabel(secondReason!), "Near-stable");
  assert.match(snapshot.sets[0].reps[0].resultText, /remained conditional/i);
  assert.match(snapshot.sets[0].reps[1].resultText, /was near-stable/i);
  assert.doesNotMatch(
    snapshot.sets[0].reps[0].resultText,
    /partial response|strong response|weak response/i,
  );
});

test("observed response summary preserves limiting evidence from strong clarity reps", () => {
  const classes = {
    vocabulary: "supported",
    method: "supported",
    reason: "conditional",
    immediateApply: "supported",
  } as const;
  const submittedSet = buildSubmittedSet({
    mode: "training",
    phase: "Clarity",
    setName: "Light Apply",
    rawByRep: [0, 1, 2].map((repIndex) =>
      rawOptionsForEvidenceClasses({
        phase: "Clarity",
        setName: "Light Apply",
        repIndex,
        classes,
      }),
    ),
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

  const summary = summarizeSnapshotObservedResponse(snapshot);
  assert.match(summary || "", /clear vocabulary recognition and method selection/i);
  assert.match(summary || "", /explanation contained some correct structure/i);
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
        evidenceStatus: "observed",
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
        evidenceStatus: "observed",
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
        evidenceStatus: "observed",
        humanClause: "Reason: showed weak reason awareness",
        weight: 20,
        contribution: 12,
      },
    ],
    resultText:
      "This rep checked whether the student could identify the type, recall the steps, and explain the reason before solving. The student produced a strong response: Vocabulary: recognized the problem type correctly and Method: recalled the method clearly. The remaining logged observation was that the student Reason: showed weak reason awareness.",
  });

  assert.doesNotMatch(text, /Reason:/);
  assert.doesNotMatch(text, /produced a strong response/i);
  assert.doesNotMatch(text, /remaining logged observation/i);
  assert.match(text, /One part remained conditional: the student showed weak reason awareness/);
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
  assert.match(snapshot.sets[0].resultText, /No student observation evidence was recorded/);
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
        evidenceStatus: "observed",
        humanClause: "started only after delay",
        weight: 25,
        contribution: 0,
      },
    ],
  });

  assert.equal(text, "Stored historical sentence.");
});
