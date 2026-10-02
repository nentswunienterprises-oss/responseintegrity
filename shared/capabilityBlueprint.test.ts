import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_BLUEPRINT_VERSION,
  CAPABILITY_CROSS_CUTTING_COMPETENCIES,
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  CAPABILITY_MODULE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";

const expectedKeys = [
  "topic_conditioning",
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
  "how_to_model",
  "how_to_intervene",
  "how_to_use_boss_battles",
  "what_not_to_do",
  "emotional_discipline_under_discomfort",
  "how_to_diagnose",
  "how_to_interpret_prompts",
  "how_baselines_are_established",
  "how_the_system_resolves_uncertainty",
  "intro_session_structure",
  "session_flow_control",
  "drill_library",
  "logging_system",
  "handover_verification",
  "tools_required",
].sort();

const originalFullEvidenceKeys = new Set([
  "topic_conditioning",
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
  "intro_session_structure",
  "session_flow_control",
  "drill_library",
  "logging_system",
  "handover_verification",
  "tools_required",
]);

const blueprintKeys = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => deepDive.key).sort();

function deepDive(key: string) {
  const value = CAPABILITY_DEEP_DIVE_BLUEPRINTS.find((entry) => entry.key === key);
  assert.ok(value, `Missing capability blueprint for ${key}`);
  return value;
}

test("capability blueprint covers the exact 20 Specialist Deep Dives", () => {
  assert.equal(CAPABILITY_BLUEPRINT_VERSION, 3);
  assert.equal(CAPABILITY_DEEP_DIVE_BLUEPRINTS.length, 20);
  assert.deepEqual(blueprintKeys, expectedKeys);
  assert.equal(new Set(blueprintKeys).size, 20);
  assert.equal(blueprintKeys.includes("evidence_integrity" as any), false);
});

test("module blueprint preserves the live 5 + 5 + 4 + 6 Deep Dive split", () => {
  const transformation = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "transformation_phases");
  const execution = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "execution_standards");
  const intelligence = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "system_intelligence");
  const infrastructure = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "session_infrastructure");

  assert.ok(transformation);
  assert.ok(execution);
  assert.ok(intelligence);
  assert.ok(infrastructure);
  assert.equal(transformation.deepDiveKeys.length, 5);
  assert.equal(execution.deepDiveKeys.length, 5);
  assert.equal(intelligence.deepDiveKeys.length, 4);
  assert.equal(infrastructure.deepDiveKeys.length, 6);
  assert.deepEqual(
    CAPABILITY_MODULE_BLUEPRINTS.flatMap((module) => module.deepDiveKeys).sort(),
    expectedKeys,
  );
});

test("every Deep Dive has a capability, competencies, critical boundaries, and Mastery evidence", () => {
  for (const entry of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    assert.ok(entry.operatingCapability.length >= 40, `${entry.key} must state an operating capability`);
    assert.ok(entry.competencyKeys.length >= 6, `${entry.key} needs meaningful competency coverage`);
    assert.equal(new Set(entry.competencyKeys).size, entry.competencyKeys.length);
    assert.ok(entry.criticalBoundaries.length >= 1, `${entry.key} must expose critical integrity boundaries`);
    assert.ok(entry.requiredEvidenceKinds.includes("mastery"), `${entry.key} must require Mastery`);
  }
});

test("required evidence contains 42 capability cells", () => {
  const cells = getRequiredCapabilityEvidenceCells();
  assert.equal(cells.length, 42);
  assert.equal(new Set(cells.map((cell) => cell.code)).size, 42);

  for (const entry of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    const coverage = cells
      .filter((cell) => cell.deepDiveKey === entry.key)
      .map((cell) => cell.evidenceKind)
      .sort();
    assert.deepEqual(
      coverage,
      originalFullEvidenceKeys.has(entry.key)
        ? ["mastery", "retrieval", "transfer"]
        : ["mastery"],
    );
  }
});

test("transfer partners always point to real Deep Dives and never to self", () => {
  const keys = new Set(CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((entry) => entry.key));
  for (const entry of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    assert.ok(entry.transferPartners.length >= 2, `${entry.key} needs interleaving partners`);
    for (const partner of entry.transferPartners) {
      assert.ok(keys.has(partner), `${entry.key} has unknown transfer partner ${partner}`);
      assert.notEqual(partner, entry.key);
    }
  }
});

test("Evidence Integrity remains cross-cutting instead of becoming a separate Deep Dive gate", () => {
  const crossCutting = new Set(CAPABILITY_CROSS_CUTTING_COMPETENCIES);
  const referenced = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((entry) => entry.competencyKeys);

  assert.ok(referenced.some((key) => crossCutting.has(key as any)));
  assert.ok(
    CAPABILITY_DEEP_DIVE_BLUEPRINTS.filter((entry) =>
      entry.competencyKeys.includes("evidence.observation_vs_inference"),
    ).length >= 5,
  );
  assert.equal(
    CAPABILITY_DEEP_DIVE_BLUEPRINTS.some((entry) => entry.key === ("evidence_integrity" as any)),
    false,
  );
});

test("critical boundary identities are unique and stable across the blueprint", () => {
  const identities = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((entry) =>
    entry.criticalBoundaries.map((boundary) => boundary.key),
  );
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(identities.length >= 50);
});

test("System Intelligence explicitly covers Diagnosis, prompts, baselines, and uncertainty", () => {
  const diagnosis = deepDive("how_to_diagnose");
  const prompts = deepDive("how_to_interpret_prompts");
  const baselines = deepDive("how_baselines_are_established");
  const uncertainty = deepDive("how_the_system_resolves_uncertainty");

  assert.ok(diagnosis.competencyKeys.includes("diagnosis.constraint_stripping"));
  assert.ok(prompts.competencyKeys.includes("prompts.evidence_question"));
  assert.ok(baselines.competencyKeys.includes("baselines.timer_contract_derivation"));
  assert.ok(uncertainty.competencyKeys.includes("uncertainty.not_observed"));
});

test("Controlled Discomfort stays same-form and does not absorb Variation Control", () => {
  const controlled = deepDive("controlled_discomfort");
  assert.match(controlled.operatingCapability, /same-form difficulty/i);
  assert.doesNotMatch(controlled.operatingCapability, /unfamiliar/i);
});

test("TPS blueprint preserves Timer Contract authority and technical-failure replacement lineage", () => {
  const tps = deepDive("time_pressure_stability");
  assert.ok(tps.competencyKeys.includes("time_pressure_stability.baseline_authority"));
  assert.ok(tps.competencyKeys.includes("time_pressure_stability.technical_failure_lineage"));
  assert.ok(tps.competencyKeys.includes("evidence.condition_integrity"));

  const boundaries = new Set(tps.criticalBoundaries.map((boundary) => boundary.key));
  assert.ok(boundaries.has("time_pressure_stability.timer_contract_is_system_owned"));
  assert.ok(boundaries.has("time_pressure_stability.technical_replacement_only_for_objective_failure"));
  assert.ok(boundaries.has("time_pressure_stability.student_failure_is_real_evidence"));
});
