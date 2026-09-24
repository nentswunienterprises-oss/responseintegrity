import assert from "node:assert/strict";
import test from "node:test";
import { TUTOR_BATTLE_TEST_PHASE_ORDER } from "./battleTesting";
import {
  CAPABILITY_BLUEPRINT_VERSION,
  CAPABILITY_CROSS_CUTTING_COMPETENCIES,
  CAPABILITY_DEEP_DIVE_BLUEPRINTS,
  CAPABILITY_MODULE_BLUEPRINTS,
  getRequiredCapabilityEvidenceCells,
} from "./capabilityBlueprint";

const canonicalKeys = [...TUTOR_BATTLE_TEST_PHASE_ORDER].sort();
const blueprintKeys = CAPABILITY_DEEP_DIVE_BLUEPRINTS.map((deepDive) => deepDive.key).sort();

function deepDive(key: string) {
  const value = CAPABILITY_DEEP_DIVE_BLUEPRINTS.find((entry) => entry.key === key);
  assert.ok(value, `Missing capability blueprint for ${key}`);
  return value;
}

test("capability blueprint covers the exact 11 implemented Specialist Deep Dives", () => {
  assert.equal(CAPABILITY_BLUEPRINT_VERSION, 2);
  assert.equal(CAPABILITY_DEEP_DIVE_BLUEPRINTS.length, 11);
  assert.deepEqual(blueprintKeys, canonicalKeys);
  assert.equal(new Set(blueprintKeys).size, 11);
  assert.equal(blueprintKeys.includes("evidence_integrity" as any), false);
});

test("module blueprint preserves the implemented 5 + 6 Training split", () => {
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
  for (const entry of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    assert.ok(entry.operatingCapability.length >= 40, `${entry.key} must state an operating capability`);
    assert.ok(entry.competencyKeys.length >= 6, `${entry.key} needs meaningful competency coverage`);
    assert.equal(new Set(entry.competencyKeys).size, entry.competencyKeys.length);
    assert.ok(entry.criticalBoundaries.length >= 1, `${entry.key} must expose critical integrity boundaries`);
    assert.deepEqual([...entry.requiredEvidenceKinds].sort(), ["mastery", "retrieval", "transfer"]);
  }
});

test("required evidence is 33 capability cells, not 33 separate assessments", () => {
  const cells = getRequiredCapabilityEvidenceCells();
  assert.equal(cells.length, 33);
  assert.equal(new Set(cells.map((cell) => cell.code)).size, 33);

  for (const entry of CAPABILITY_DEEP_DIVE_BLUEPRINTS) {
    const coverage = cells.filter((cell) => cell.deepDiveKey === entry.key).map((cell) => cell.evidenceKind).sort();
    assert.deepEqual(coverage, ["mastery", "retrieval", "transfer"]);
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

test("Evidence Integrity remains cross-cutting instead of becoming a twelfth gate", () => {
  const crossCutting = new Set(CAPABILITY_CROSS_CUTTING_COMPETENCIES);
  const referenced = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((entry) => entry.competencyKeys);

  assert.ok(referenced.some((key) => crossCutting.has(key as any)));
  assert.ok(CAPABILITY_DEEP_DIVE_BLUEPRINTS.filter((entry) => entry.competencyKeys.includes("evidence.observation_vs_inference")).length >= 5);
  assert.equal(CAPABILITY_DEEP_DIVE_BLUEPRINTS.some((entry) => entry.key === ("evidence_integrity" as any)), false);
});

test("critical boundary identities are unique and stable across the blueprint", () => {
  const identities = CAPABILITY_DEEP_DIVE_BLUEPRINTS.flatMap((entry) =>
    entry.criticalBoundaries.map((boundary) => boundary.key),
  );
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(identities.length >= 25);
});

test("Intro is evidence-complete and never regresses to adjacent score-driven placement", () => {
  const intro = deepDive("intro_session_structure");
  assert.ok(intro.competencyKeys.includes("intro.starting_signal_hypothesis"));
  assert.ok(intro.competencyKeys.includes("intro.evidence_question_routing"));
  assert.ok(intro.competencyKeys.includes("intro.constraint_stripping"));
  assert.ok(intro.competencyKeys.includes("intro.evidence_complete_stop"));
  assert.equal(intro.competencyKeys.includes("intro.adjacent_phase_movement"), false);
  assert.equal(intro.competencyKeys.includes("intro.recommended_start_hypothesis"), false);

  const boundaries = new Set(intro.criticalBoundaries.map((boundary) => boundary.key));
  assert.ok(boundaries.has("intro.starting_signal_never_placement"));
  assert.ok(boundaries.has("intro.no_fixed_rep_quota"));
  assert.ok(boundaries.has("intro.high_maintenance_training_only"));
  assert.equal(boundaries.has("intro.adjacent_movement_only"), false);
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

test("Logging blueprint keeps behavior, eligibility, intervention, condition, and lineage separate", () => {
  const logging = deepDive("logging_system");
  assert.ok(logging.competencyKeys.includes("logging.evidence_status"));
  assert.ok(logging.competencyKeys.includes("logging.intervention_separation"));
  assert.ok(logging.competencyKeys.includes("logging.recovery_history"));
  assert.equal(logging.competencyKeys.includes("logging.raw_option_fidelity"), false);

  const boundaries = new Set(logging.criticalBoundaries.map((boundary) => boundary.key));
  assert.ok(boundaries.has("logging.missing_is_not_weakness"));
  assert.ok(boundaries.has("logging.intervention_not_hidden"));
  assert.ok(boundaries.has("logging.condition_change_not_clean"));
});

test("Session Flow keeps contexts distinct and forbids hidden baseline calibration", () => {
  const flow = deepDive("session_flow_control");
  assert.ok(flow.competencyKeys.includes("session_flow.intro_diagnosis"));
  assert.ok(flow.competencyKeys.includes("session_flow.active_training"));
  assert.ok(flow.competencyKeys.includes("session_flow.handover_verification"));
  assert.ok(flow.competencyKeys.includes("session_flow.targeted_rediagnosis"));

  const boundaries = new Set(flow.criticalBoundaries.map((boundary) => boundary.key));
  assert.ok(boundaries.has("session_flow.no_context_blending"));
  assert.ok(boundaries.has("session_flow.no_hidden_baseline_calibration"));
});
