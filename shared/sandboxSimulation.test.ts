import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSandboxSimulation,
  projectSandboxScenarioForSpecialist,
  type SandboxScenarioDefinition,
} from "./sandboxSimulation";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
} from "./responseIntegrityDrillRegistry";

function clarityScenario(): SandboxScenarioDefinition {
  const schema = getDrillSchemaDefinition("training", "Clarity");
  const scored = schema.sets.filter((set) => !set.modelingOnly);

  return {
    key: "clarity-observation-proof-v1",
    version: 1,
    title: "Clarity observation proof",
    description: "A deterministic fictional Clarity session used to prove Sandbox observation fidelity.",
    phase: "Clarity",
    previousStability: "Low",
    passThresholdPercent: 100,
    sets: scored.map((set) => ({
      setId: set.setId,
      reps: Array.from({ length: set.reps }, (_, repIndex) => ({
        repNumber: repIndex + 1,
        studentBehavior: `Fictional response for ${set.setName} rep ${repIndex + 1}.`,
        observations: Object.fromEntries(
          set.fields.map((baseField) => {
            const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
            const optionIndex = field.optionLevels.length - 1;
            const identity = getEvidenceSelectionIdentity({
              mode: "training",
              phase: "Clarity",
              setName: set.setName,
              repIndex,
              fieldKey: field.fieldKey,
              optionIndex,
            });
            assert.ok(identity);
            return [field.fieldKey, { optionId: identity.optionId, evidenceStatus: "observed" as const }];
          }),
        ),
      })),
    })),
  };
}

test("Sandbox projects student behaviour and live RI observation options without evaluator truth", () => {
  const scenario = clarityScenario();
  const projected = projectSandboxScenarioForSpecialist(scenario);
  assert.equal(projected.sets.length, 2);
  assert.equal(projected.sets[0].reps.length, 3);
  assert.ok(projected.sets[0].reps[0].fields[0].options.length >= 3);
  const serialized = JSON.stringify(projected);
  assert.equal(serialized.includes("observations"), false);
  assert.equal(serialized.includes("canonicalOutcome"), false);
});

test("exact RI-style observation logging passes and preserves real system outcome", () => {
  const scenario = clarityScenario();
  const submission = {
    sets: scenario.sets.map((set) => ({
      setId: set.setId,
      reps: set.reps.map((rep) => ({
        repNumber: rep.repNumber,
        observations: rep.observations,
      })),
    })),
  };

  const result = evaluateSandboxSimulation(scenario, submission);
  assert.equal(result.observationFidelityPercent, 100);
  assert.equal(result.systemOutcomeMatched, true);
  assert.equal(result.passed, true);
  assert.equal(result.studentStateAuthoritative, false);
  assert.equal(result.evidenceScope, "sandbox");
});

test("misreading one simulated behaviour is preserved as Sandbox evidence and fails a perfect-fidelity proof", () => {
  const scenario = clarityScenario();
  const projected = projectSandboxScenarioForSpecialist(scenario);
  const submission = {
    sets: scenario.sets.map((set) => ({
      setId: set.setId,
      reps: set.reps.map((rep) => ({
        repNumber: rep.repNumber,
        observations: Object.fromEntries(
          Object.entries(rep.observations).map(([fieldKey, observation]) => [
            fieldKey,
            { ...observation },
          ]),
        ),
      })),
    })),
  };

  const firstField = projected.sets[0].reps[0].fields[0];
  const wrong = firstField.options.find(
    (option) => option.optionId !== submission.sets[0].reps[0].observations[firstField.fieldKey].optionId,
  );
  assert.ok(wrong);
  submission.sets[0].reps[0].observations[firstField.fieldKey].optionId = wrong.optionId;

  const result = evaluateSandboxSimulation(scenario, submission);
  assert.ok(result.observationFidelityPercent < 100);
  assert.equal(result.passed, false);
});
