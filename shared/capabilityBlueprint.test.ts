import assert from "node:assert/strict";
import test from "node:test";
import { TUTOR_BATTLE_TEST_PHASE_ORDER } from "./battleTesting";
import {
  CAPABILITY_CROSS_CUTTING_COMPETENCIES,
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  CAPABILITY_MODULE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";

const canonicalKeys = [...TUTOR_BATTLE_TEST_PHASE_ORDER].sort();
const blueprintKeys = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => deepDive.key).sort();

test("capability blueprint covers the exact 11 implemented Specialist Battle Test Deep Dives", () => {
  assert.equal(CAPABILITY_DEEP_DIVE_BLUEPRINTS.length, 11);
  assert.deepEqual(blueprintKeys, canonicalKeys);
  assert.equal(new Set(blueprintKeys).size, 11);
  assert.equal(blueprintKeys.includes("evidence_integrity" as any), false);
});

test("module blueprint preserves the implemented 5 + 6 training split", () => {
  const transformation = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "transformation_phases");
  const infrastructure = CAPABILITY_MODULE_BLUEPRINTS.find((module) => module.key === "session_infrastructure");

  assert.ok(transformation);
  assert.ok(infrastructure);
  assert.equal(transformation.deepDiveKeys.length, 5);
  assert.equal(infrastructure.deepDiveKeys.length, 6);
  assert.deepEqual(
    [...transformation.deepDiveKeys, ...infrastructure.deepDiveKeys].sort(),
    canonicalKeys,
  );
});

test("every Deep Dive has a capability, competencies, critical boundaries, and all three evidence classes", () => {
  for (const deepDive of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    assert.ok(deepDive.operatingCapability.length >= 40, `${deepDive.key} must state an operating capability`);
    assert.ok(deepDive.competencyKeys.length >= 6, `${deepDive.key} needs meaningful competency coverage`);
    assert.equal(new Set(deepDive.competencyKeys).size, deepDive.competencyKeys.length);
    assert.ok(deepDive.criticalBoundaries.length >= 1, `${deepDive.key} must expose critical integrity boundaries`);
    assert.deepEqual([...deepDive.requiredEvidenceKinds].sort(), ["mastery", "retrieval", "transfer"]);
  }
});

test("required evidence is 33 capability cells, not 33 separate assessments", () => {
  const cells = getRequiredCapabilityEvidenceCells();
  assert.equal(cells.length, 33);
  assert.equal(new Set(cells.map((cell) => cell.code)).size, 33);

  for (const deepDive of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    const coverage = cells.filter((cell) => cell.deepDiveKey === deepDive.key).map((cell) => cell.evidenceKind).sort();
    assert.deepEqual(coverage, ["mastery", "retrieval", "transfer"]);
  }
});

test("transfer partners always point to real Deep Dives and never to self", () => {
  const keys = new Set(CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => deepDive.key));
  for (const deepDive of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    assert.ok(deepDive.transferPartners.length >= 2, `${deepDive.key} needs interleaving partners`);
    for (const partner of deepDive.transferPartners) {
      assert.ok(keys.has(partner), `${deepDive.key} has unknown transfer partner ${partner}`);
      assert.notEqual(partner, deepDive.key);
    }
  }
});

test("Evidence Integrity remains cross-cutting instead of becoming a twelfth gate", () => {
  const crossCutting = new Set(CAPABILITY_CROSS_CUTTING_COMPETENCIES);
  const referenced = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((deepDive) => deepDive.competencyKeys);

  assert.ok(referenced.some((key) => crossCutting.has(key as any)));
  assert.ok(CAPABILITY_DEEP_DIVE_BLUEPRINTS.filter((deepDive) => deepDive.competencyKeys.includes("evidence.observation_vs_inference")).length >= 5);
  assert.equal(CAPABILITY_DEEP_DIVE_BLUEPRINTS.some((deepDive) => deepDive.key === ("evidence_integrity" as any)), false);
});

test("critical boundary identities are unique and stable across the blueprint", () => {
  const identities = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((deepDive) =>
    deepDive.criticalBoundaries.map((boundary) => boundary.key),
  );
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(identities.length >= 25);
});
