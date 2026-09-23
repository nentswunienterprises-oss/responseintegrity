import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import { evaluateHandoverVerificationEvidence } from "./handoverEvidenceEvaluator";
import { computeAdaptiveDiagnosisPhaseSummary } from "./adaptiveDiagnosis";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

const buildVerificationSet = (
  phase: TopicPhase,
  evidenceClassFor: (
    fieldKey: string,
    repIndex: number,
  ) => "breakdown" | "conditional" | "near_stable" | "supported" | "not_observed" | "confounded",
  repCount?: number,
): SubmittedEvidenceSet => {
  const schema = getDrillSchemaDefinition("verification", phase);
  const definition = schema.sets[0];
  return {
    setName: definition.setName,
    setId: definition.setId,
    setOrder: 1,
    drillSchemaId: schema.schemaId,
    drillSchemaVersion: schema.schemaVersion,
    drillDefinitionHash: schema.definitionHash,
    constraintProfile: { ...definition.constraints },
    observations: Array.from({ length: repCount ?? definition.reps }, (_, repIndex) => {
      const rep: Record<string, string> = {
        _rep_id: definition.repPurposeIds[repIndex] || `${definition.setId}.opportunity_${repIndex + 1}`,
        _rep_number: String(repIndex + 1),
      };
      definition.fields.forEach((baseField) => {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
        const classes = field.optionEvidenceClasses || [];
        const requestedClass = evidenceClassFor(field.fieldKey, repIndex);
        const optionIndex = classes.indexOf(requestedClass);
        assert.ok(optionIndex >= 0, `Missing ${requestedClass} option for ${field.fieldKey}`);
        const labels = [...(field.optionLabels || [])];
        const identity = getEvidenceSelectionIdentity({
          mode: "verification",
          phase,
          setName: definition.setName,
          repIndex,
          fieldKey: field.fieldKey,
          optionIndex,
        });
        assert.ok(identity);
        rep[field.fieldKey] = labels[optionIndex];
        rep[field.fieldKey + "_option_id"] = identity.optionId;
        rep[field.fieldKey + "_dimension_id"] = identity.dimensionId;
        rep[field.fieldKey + "_level"] = identity.level;
        rep[field.fieldKey + "_evidence_class"] = String(identity.evidenceClass || "");
      });
      return rep;
    }),
  };
};

const evaluate = (
  phase: TopicPhase,
  previousStability: TopicStability,
  set: SubmittedEvidenceSet,
) => {
  const result = evaluateHandoverVerificationEvidence({ phase, previousStability, set });
  assert.equal(result.status, "evaluated");
  return result as Extract<typeof result, { status: "evaluated" }>;
};

test("one clean opportunity keeps handover open instead of forcing re-diagnosis", () => {
  const set = buildVerificationSet("Clarity", () => "supported", 1);
  const result = evaluate("Clarity", "High", set);
  assert.equal(result.verificationOutcome, "continue_verification");
  assert.equal(result.reDiagnosisRequired, false);
});

test("clean supported continuity holds every inherited phase and stability", () => {
  const phases: TopicPhase[] = [
    "Clarity",
    "Structured Execution",
    "Controlled Discomfort",
    "Time Pressure Stability",
  ];
  const stabilities: TopicStability[] = ["Low", "Medium", "High", "High Maintenance"];
  for (const phase of phases) {
    for (const previousStability of stabilities) {
      const set = buildVerificationSet(phase, () => "supported", 2);
      const result = evaluate(phase, previousStability, set);
      assert.equal(result.verificationOutcome, "hold", `${phase} / ${previousStability}`);
      assert.equal(result.resultingPhase, phase);
      assert.equal(result.resultingStability, previousStability);
      assert.equal(result.reDiagnosisRequired, false);
    }
  }
});

test("near-stable continuity holds inherited state without being collapsed into conditional", () => {
  const set = buildVerificationSet(
    "Structured Execution",
    (field) => field === "startBehavior" ? "near_stable" : "supported",
    2,
  );
  const result = evaluate("Structured Execution", "High", set);
  const start = result.dimensions.find((dimension) => dimension.dimensionId === "execution.start");
  assert.equal(start?.state, "NEAR_STABLE");
  assert.equal(result.verificationOutcome, "hold");
  assert.equal(result.resultingStability, "High");
});

test("conditional continuity stays open while clean confirmation can still resolve it", () => {
  const set = buildVerificationSet(
    "Controlled Discomfort",
    (field) => field === "discomfortTolerance" ? "conditional" : "supported",
    2,
  );
  const result = evaluate("Controlled Discomfort", "High Maintenance", set);
  assert.equal(result.verificationOutcome, "continue_verification");
  assert.equal(result.resultingStability, "High Maintenance");
  assert.equal(result.reDiagnosisRequired, false);
});

test("persistent conditional evidence adjusts only after the bounded verification window closes", () => {
  const set = buildVerificationSet(
    "Controlled Discomfort",
    (field) => field === "discomfortTolerance" ? "conditional" : "supported",
    5,
  );
  const result = evaluate("Controlled Discomfort", "High Maintenance", set);
  assert.equal(result.verificationOutcome, "stability_adjust");
  assert.equal(result.resultingPhase, "Controlled Discomfort");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("conditional evidence cannot demote Medium to Low without breakdown evidence", () => {
  const set = buildVerificationSet(
    "Clarity",
    (field) => field === "reason" ? "conditional" : "supported",
    5,
  );
  const result = evaluate("Clarity", "Medium", set);
  assert.equal(result.verificationOutcome, "stability_adjust");
  assert.equal(result.resultingStability, "Medium");
  assert.equal(result.reDiagnosisRequired, false);
});

test("confirmed phase-defining breakdown requires targeted re-diagnosis", () => {
  const set = buildVerificationSet(
    "Time Pressure Stability",
    (field, rep) => field === "structureUnderTime" && rep >= 1 ? "breakdown" : "supported",
    2,
  );
  const result = evaluate("Time Pressure Stability", "High", set);
  assert.equal(result.verificationOutcome, "targeted_re_diagnosis_required");
  assert.equal(result.resultingPhase, "Time Pressure Stability");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, true);
  assert.equal(
    result.dimensions.find((dimension) => dimension.dimensionId === "time.structure")?.state,
    "BREAKDOWN",
  );
});

test("not-observed and confounded evidence remain ineligible instead of becoming weakness", () => {
  const set = buildVerificationSet(
    "Clarity",
    (field, rep) => {
      if (field === "method") return rep === 0 ? "not_observed" : "confounded";
      return "supported";
    },
    2,
  );
  const result = evaluate("Clarity", "High", set);
  const method = result.dimensions.find((dimension) => dimension.dimensionId === "clarity.method");
  assert.equal(method?.validOpportunityCount, 0);
  assert.equal(method?.breakdownCount, 0);
  assert.equal(method?.state, "UNRESOLVED");
  assert.equal(result.verificationOutcome, "continue_verification");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("unresolved ineligible evidence routes to targeted re-diagnosis only when the bounded window closes", () => {
  const set = buildVerificationSet(
    "Time Pressure Stability",
    (field) => field === "structureUnderTime" ? "confounded" : "supported",
    5,
  );
  const result = evaluate("Time Pressure Stability", "High Maintenance", set);
  const structure = result.dimensions.find((dimension) => dimension.dimensionId === "time.structure");
  assert.equal(structure?.validOpportunityCount, 0);
  assert.equal(structure?.state, "UNRESOLVED");
  assert.equal(result.verificationOutcome, "targeted_re_diagnosis_required");
  assert.equal(result.resultingStability, "High Maintenance");
  assert.equal(result.reDiagnosisRequired, true);
});

test("forged semantic evidence is unavailable rather than scored", () => {
  const set = buildVerificationSet("Clarity", () => "supported", 2);
  set.observations[0].vocabulary_evidence_class = "breakdown";
  const result = evaluateHandoverVerificationEvidence({
    phase: "Clarity",
    previousStability: "Medium",
    set,
  });
  assert.equal(result.status, "unavailable");
});

test("high compatibility metadata cannot override a confirmed phase-defining breakdown", () => {
  const set = buildVerificationSet(
    "Time Pressure Stability",
    (field, rep) => field === "structureUnderTime" && rep >= 1 ? "breakdown" : "supported",
    3,
  );
  const result = evaluate("Time Pressure Stability", "High", set);
  assert.equal(result.verificationOutcome, "targeted_re_diagnosis_required");
  assert.equal(result.reDiagnosisRequired, true);
  assert.equal(
    result.dimensions.find((dimension) => dimension.dimensionId === "time.structure")?.state,
    "BREAKDOWN",
  );
});

test("one early breakdown plus two clean continuity opportunities stays open rather than falsely recovering or adjusting", () => {
  const set = buildVerificationSet(
    "Structured Execution",
    (field, rep) => field === "stepExecution" && rep === 0 ? "breakdown" : "supported",
    3,
  );
  const result = evaluate("Structured Execution", "High", set);
  const stepDiscipline = result.dimensions.find(
    (dimension) => dimension.dimensionId === "execution.step_discipline",
  );

  assert.equal(stepDiscipline?.breakdownCount, 1);
  assert.equal(stepDiscipline?.supportedCount, 2);
  assert.equal(stepDiscipline?.recoveredAfterBreakdown, false);
  assert.equal(stepDiscipline?.state, "CONDITIONAL");
  assert.equal(result.verificationOutcome, "continue_verification");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("an early breakdown followed by the required clean continuity sequence can recover before the cap", () => {
  const set = buildVerificationSet(
    "Structured Execution",
    (field, rep) => field === "stepExecution" && rep === 0 ? "breakdown" : "supported",
    4,
  );
  const result = evaluate("Structured Execution", "High", set);
  const stepDiscipline = result.dimensions.find(
    (dimension) => dimension.dimensionId === "execution.step_discipline",
  );

  assert.equal(stepDiscipline?.breakdownCount, 1);
  assert.equal(stepDiscipline?.supportedCount, 3);
  assert.equal(stepDiscipline?.recoveredAfterBreakdown, true);
  assert.equal(stepDiscipline?.state, "SUPPORTED");
  assert.equal(result.verificationOutcome, "hold");
  assert.equal(result.resultingStability, "High");
  assert.equal(result.reDiagnosisRequired, false);
});

test("mixed conditional evidence can resolve to supported before the cap", () => {
  const set = buildVerificationSet(
    "Clarity",
    (field, rep) => field === "method" && rep === 0 ? "conditional" : "supported",
    3,
  );
  const result = evaluate("Clarity", "High", set);
  const method = result.dimensions.find(
    (dimension) => dimension.dimensionId === "clarity.method",
  );

  assert.equal(method?.conditionalCount, 1);
  assert.equal(method?.supportedCount, 2);
  assert.equal(method?.state, "SUPPORTED");
  assert.equal(result.verificationOutcome, "hold");
  assert.equal(result.resultingStability, "High");
});
