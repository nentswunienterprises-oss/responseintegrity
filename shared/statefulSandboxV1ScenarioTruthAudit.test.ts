import test from "node:test";
import assert from "node:assert/strict";

import {
  compareSandboxTurn,
  projectSandboxOutcomeToCurrentTrainingContract,
  validateSandboxOutcomeDefinition,
  type SandboxOutcomeDefinition,
} from "./sandboxEnvironment";
import {
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
} from "./responseIntegrityDrillRegistry";
import {
  LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER,
  LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES,
  getLegacyStatefulSandboxV1ScenarioTruthAudit,
  renderLegacyStatefulSandboxV1StudentBehavior,
  validateLegacyStatefulSandboxV1ScenarioTruthAudit,
  validateLegacyStatefulSandboxV1VignetteLeakage,
} from "./statefulSandboxV1ScenarioTruthAudit";
import type { TopicPhase } from "./topicConditioningEngine";

const phases: TopicPhase[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

function historicalOutcome(
  phase: TopicPhase,
  setId: string,
  repNumber: number,
  patternNumber: number,
): SandboxOutcomeDefinition {
  const schema = getDrillSchemaDefinitionByVersion("training", phase, 1);
  assert.ok(schema);
  const set = schema!.sets.find((candidate) => candidate.setId === setId);
  assert.ok(set);
  const repIndex = repNumber - 1;
  const observations = Object.fromEntries(
    set!.fields.map((baseField) => {
      const field =
        getFieldDefinitionForRep(set!, repIndex, baseField.fieldKey) ||
        baseField;
      return [
        field.fieldKey,
        {
          optionId:
            getRepPurposeId(set!, repIndex) +
            "." +
            field.dimensionId +
            ".option_1",
          evidenceStatus: "observed" as const,
        },
      ];
    }),
  );

  return {
    key:
      setId +
      ".rep_" +
      String(repNumber) +
      ".pattern_" +
      String(patternNumber),
    version: 1,
    phase,
    setId,
    repNumber,
    studentBehavior: "Historical placeholder that must never reach the Specialist.",
    canonicalObservations: observations,
    trajectoryClass: "breakdown",
    weight: 1,
    emitsContinuityTags: ["recent_breakdown"],
  };
}

test("the audited V1 scenario truth matrix and natural-vignette layer are complete", () => {
  assert.equal(validateLegacyStatefulSandboxV1ScenarioTruthAudit(), true);
  assert.equal(validateLegacyStatefulSandboxV1VignetteLeakage(), true);
  for (const phase of phases) {
    assert.equal(
      Object.keys(LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES[phase]).length,
      8,
    );
  }
});

test("all 264 Stateful Sandbox V1 outcomes preserve audited truth while rendering natural non-answer-key vignettes", () => {
  let projectedCount = 0;

  for (const phase of phases) {
    const historical = getDrillSchemaDefinitionByVersion("training", phase, 1);
    assert.ok(historical);
    const current = getDrillSchemaDefinition("training", phase);

    for (const set of historical!.sets.filter((candidate) => !candidate.modelingOnly)) {
      const currentSet = current.sets.find(
        (candidate) => candidate.setId === set.setId,
      );
      assert.ok(currentSet);

      for (let repNumber = 1; repNumber <= set.reps; repNumber += 1) {
        const repIndex = repNumber - 1;

        for (let patternNumber = 1; patternNumber <= 8; patternNumber += 1) {
          const historicalDefinition = historicalOutcome(
            phase,
            set.setId,
            repNumber,
            patternNumber,
          );
          const projected = projectSandboxOutcomeToCurrentTrainingContract(
            historicalDefinition,
            1,
          );
          assert.doesNotThrow(() => validateSandboxOutcomeDefinition(projected));

          const audit = getLegacyStatefulSandboxV1ScenarioTruthAudit({
            phase,
            outcomeKey: historicalDefinition.key,
          });
          assert.ok(audit);
          assert.equal(projected.trajectoryClass, audit!.trajectoryClass);
          assert.equal(
            projected.studentBehavior,
            renderLegacyStatefulSandboxV1StudentBehavior({
              phase,
              outcomeKey: historicalDefinition.key,
              repNumber,
              repCount: set.reps,
            }),
          );
          assert.doesNotMatch(projected.studentBehavior, /Historical placeholder/);

          for (const dimensionId of LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER[
            phase
          ]) {
            const auditedObservation = audit!.observations[dimensionId];
            assert.ok(auditedObservation);
            assert.equal(
              projected.studentBehavior.includes(auditedObservation!.behavior),
              false,
              historicalDefinition.key +
                " must not copy hidden evaluator prose for " +
                dimensionId,
            );

            const field = currentSet!.fields.find(
              (candidate) => candidate.dimensionId === dimensionId,
            );
            assert.ok(field);
            const canonical = projected.canonicalObservations[field!.fieldKey];
            assert.ok(canonical);
            const resolved = resolveEvidenceSelection({
              mode: "training",
              phase,
              setId: set.setId,
              repIndex,
              fieldKey: field!.fieldKey,
              optionId: canonical.optionId,
              schemaVersion: current.schemaVersion,
            });
            assert.equal(
              resolved?.evidenceClass,
              auditedObservation!.evidenceClass,
              historicalDefinition.key +
                " must use audited class for " +
                dimensionId,
            );
            assert.equal(
              canonical.evidenceStatus || "observed",
              auditedObservation!.evidenceStatus,
              historicalDefinition.key +
                " must use audited evidence status for " +
                dimensionId,
            );
          }

          if (audit!.trajectoryClass === "breakdown") {
            assert.ok(projected.emitsContinuityTags?.includes("recent_breakdown"));
          } else {
            assert.equal(
              projected.emitsContinuityTags?.includes("recent_breakdown"),
              false,
            );
          }

          projectedCount += 1;
        }
      }
    }
  }

  assert.equal(projectedCount, 264);
});

test("Clarity pattern 5 records partial reason evidence rather than an invented reason breakdown", () => {
  const projected = projectSandboxOutcomeToCurrentTrainingContract(
    historicalOutcome("Clarity", "clarity.identification", 1, 5),
    1,
  );
  const current = getDrillSchemaDefinition("training", "Clarity");
  const reason = resolveEvidenceSelection({
    mode: "training",
    phase: "Clarity",
    setId: "clarity.identification",
    repIndex: 0,
    fieldKey: "reason",
    optionId: projected.canonicalObservations.reason.optionId,
    schemaVersion: current.schemaVersion,
  });

  assert.equal(reason?.evidenceClass, "conditional");
  assert.equal(projected.trajectoryClass, "conditional");
  assert.equal(projected.emitsContinuityTags?.includes("recent_breakdown"), false);
  assert.match(
    projected.studentBehavior,
    /justify the choice with only one piece of the relationship/i,
  );
  assert.doesNotMatch(
    projected.studentBehavior,
    /conditional|breakdown|incomplete and unreliable|decision-relevant/i,
  );
});

test("not-observed and confounded truth never grades the Specialist against a hidden option", () => {
  const current = getDrillSchemaDefinition("training", "Clarity");
  const currentSet = current.sets.find(
    (candidate) => candidate.setId === "clarity.identification",
  );
  assert.ok(currentSet);

  for (const item of [
    { patternNumber: 7, fieldKey: "reason", status: "not_observed" as const },
    { patternNumber: 8, fieldKey: "method", status: "confounded" as const },
  ]) {
    const outcome = projectSandboxOutcomeToCurrentTrainingContract(
      historicalOutcome(
        "Clarity",
        "clarity.identification",
        1,
        item.patternNumber,
      ),
      1,
    );
    const specialist = Object.fromEntries(
      Object.entries(outcome.canonicalObservations).map(([fieldKey, value]) => [
        fieldKey,
        {
          optionId: value.optionId,
          evidenceStatus: value.evidenceStatus,
        },
      ]),
    );
    const field = getFieldDefinitionForRep(currentSet!, 0, item.fieldKey);
    assert.ok(field);
    const expected = outcome.canonicalObservations[item.fieldKey];
    const expectedResolved = resolveEvidenceSelection({
      mode: "training",
      phase: "Clarity",
      setId: outcome.setId,
      repIndex: 0,
      fieldKey: item.fieldKey,
      optionId: expected.optionId,
      schemaVersion: current.schemaVersion,
    });
    assert.ok(expectedResolved);
    const alternateIndex = expectedResolved!.optionIndex === 0 ? 3 : 0;
    const alternate = getEvidenceSelectionIdentity({
      mode: "training",
      phase: "Clarity",
      setName: currentSet!.setName,
      repIndex: 0,
      fieldKey: item.fieldKey,
      optionIndex: alternateIndex,
    });
    assert.ok(alternate);
    specialist[item.fieldKey] = {
      optionId: alternate!.optionId,
      evidenceStatus: item.status,
    };

    const comparison = compareSandboxTurn({
      sequenceNumber: 1,
      sessionNumber: 1,
      phase: "Clarity",
      setId: outcome.setId,
      repNumber: 1,
      outcome,
      actualInterventionEvent: "none",
      recordedInterventionEvent: "none",
      conditionConformed: true,
      specialistObservations: specialist,
    });

    assert.equal(comparison.observationExact, true);
    assert.equal(comparison.evidenceExact, true);
    assert.equal(
      outcome.canonicalObservations[item.fieldKey].evidenceStatus,
      item.status,
    );
  }
});
