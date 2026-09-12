import {
  getCapabilityDeepDiveBlueprint,
  type CapabilityDeepDiveBlueprint,
} from "./capabilityBlueprint";
import type { TutorBattleTestPhaseKey } from "./battleTesting";

export type BattleTestReplacementEvidenceKind =
  | "mastery"
  | "retrieval"
  | "transfer"
  | "practical"
  | "oral_defense"
  | "simulation"
  | "human_mock";

export type BattleTestReplacementProofClass =
  | "knowledge"
  | "discernment"
  | "observable_execution"
  | "integrity";

export interface CapabilityBattleTestCoverageEntry {
  deepDiveKey: TutorBattleTestPhaseKey;
  questionKey: string;
  competencyKeys: string[];
  criticalBoundaryKeys: string[];
  proofClass: BattleTestReplacementProofClass;
  evidenceKinds: BattleTestReplacementEvidenceKind[];
  humanVerificationRequired: boolean;
}

export const REPLACEMENT_EVIDENCE_BY_PROOF_CLASS: Record<
  BattleTestReplacementProofClass,
  BattleTestReplacementEvidenceKind[]
> = {
  knowledge: ["mastery", "retrieval", "transfer"],
  discernment: ["mastery", "retrieval", "transfer", "simulation"],
  observable_execution: ["mastery", "transfer", "practical", "simulation", "human_mock"],
  integrity: ["transfer", "practical", "oral_defense", "simulation", "human_mock"],
};

const HUMAN_VERIFICATION_PROOF_CLASSES = new Set<BattleTestReplacementProofClass>([
  "observable_execution",
  "integrity",
]);

type CoverageSeed = readonly [
  questionKey: string,
  competencyKeys: readonly string[],
  proofClass: BattleTestReplacementProofClass,
  criticalBoundaryKeys?: readonly string[],
];

function phaseCoverage(
  deepDiveKey: TutorBattleTestPhaseKey,
  seeds: CoverageSeed[],
): CapabilityBattleTestCoverageEntry[] {
  return seeds.map(([questionKey, competencyKeys, proofClass, criticalBoundaryKeys = []]) => ({
    deepDiveKey,
    questionKey,
    competencyKeys: [...competencyKeys],
    criticalBoundaryKeys: [...criticalBoundaryKeys],
    proofClass,
    evidenceKinds: [...REPLACEMENT_EVIDENCE_BY_PROOF_CLASS[proofClass]],
    humanVerificationRequired: HUMAN_VERIFICATION_PROOF_CLASSES.has(proofClass),
  }));
}

export const CAPABILITY_BATTLE_TEST_COVERAGE: CapabilityBattleTestCoverageEntry[] = [
  ...phaseCoverage("clarity", [
    ["clarity_q1", ["clarity.phase_purpose"], "knowledge"],
    ["clarity_q2", ["clarity.phase_purpose", "clarity.vmr_sequence"], "knowledge"],
    ["clarity_q3", ["clarity.modeling_set"], "knowledge"],
    ["clarity_q4", ["clarity.identification_set", "clarity.recognition_boundary"], "knowledge"],
    ["clarity_q5", ["clarity.light_apply_support"], "knowledge"],
    ["clarity_q6", ["clarity.rep_purpose"], "knowledge"],
    ["clarity_q7", ["evidence.observation_vs_inference"], "discernment"],
    ["clarity_q8", ["clarity.modeling_set", "evidence.contamination"], "integrity", ["clarity.modeling_not_independent_evidence"]],
    ["clarity_q9", ["clarity.identification_set", "clarity.recognition_boundary"], "integrity", ["clarity.identification_no_solving"]],
    ["clarity_q10", ["evidence.contamination", "clarity.recognition_boundary"], "discernment"],
    ["clarity_q11", ["clarity.light_apply_support", "evidence.contamination"], "observable_execution"],
    ["clarity_q12", ["clarity.phase_purpose"], "discernment"],
    ["clarity_q13", ["clarity.progression", "system.authority"], "integrity", ["clarity.no_manual_progression"]],
    ["clarity_q14", ["clarity.constraints"], "discernment"],
    ["clarity_q15", ["clarity.phase_purpose", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("structured_execution", [
    ["structured_execution_q1", ["structured_execution.phase_purpose"], "knowledge"],
    ["structured_execution_q2", ["structured_execution.phase_boundary"], "knowledge"],
    ["structured_execution_q3", ["structured_execution.required_structure", "structured_execution.independent_execution"], "knowledge"],
    ["structured_execution_q4", ["structured_execution.required_structure"], "knowledge"],
    ["structured_execution_q5", ["structured_execution.variation_control"], "knowledge"],
    ["structured_execution_q6", ["structured_execution.repeatability"], "knowledge"],
    ["structured_execution_q7", ["structured_execution.independent_execution", "evidence.contamination"], "integrity", ["structured_execution.prompted_not_independent"]],
    ["structured_execution_q8", ["structured_execution.constraints", "structured_execution.required_structure"], "discernment"],
    ["structured_execution_q9", ["evidence.observation_vs_inference"], "discernment"],
    ["structured_execution_q10", ["structured_execution.progression", "system.authority"], "discernment"],
    ["structured_execution_q11", ["structured_execution.independent_execution", "evidence.contamination"], "integrity", ["structured_execution.no_support_independent_execution"]],
    ["structured_execution_q12", ["structured_execution.variation_control"], "discernment"],
    ["structured_execution_q13", ["structured_execution.repeatability"], "discernment"],
    ["structured_execution_q14", ["evidence.contamination", "structured_execution.independent_execution"], "integrity", ["structured_execution.no_disguised_assistance"]],
    ["structured_execution_q15", ["structured_execution.phase_purpose", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("controlled_discomfort", [
    ["controlled_discomfort_q1", ["controlled_discomfort.response_under_uncertainty"], "knowledge"],
    ["controlled_discomfort_q2", ["controlled_discomfort.accessible_difficulty"], "knowledge"],
    ["controlled_discomfort_q3", ["controlled_discomfort.observation_fields"], "knowledge"],
    ["controlled_discomfort_q4", ["controlled_discomfort.controlled_entry_boundary"], "knowledge"],
    ["controlled_discomfort_q5", ["controlled_discomfort.no_rescue_boundary"], "knowledge"],
    ["controlled_discomfort_q6", ["controlled_discomfort.repeat_exposure_boundary"], "knowledge"],
    ["controlled_discomfort_q7", ["controlled_discomfort.response_under_uncertainty"], "knowledge"],
    ["controlled_discomfort_q8", ["controlled_discomfort.observation_fields"], "discernment"],
    ["controlled_discomfort_q9", ["evidence.observation_vs_inference"], "discernment"],
    ["controlled_discomfort_q10", ["controlled_discomfort.accessible_difficulty"], "discernment"],
    ["controlled_discomfort_q11", ["controlled_discomfort.no_rescue_boundary", "evidence.contamination"], "integrity", ["controlled_discomfort.no_full_rescue"]],
    ["controlled_discomfort_q12", ["controlled_discomfort.repeat_exposure_boundary", "evidence.contamination"], "integrity", ["controlled_discomfort.repeat_exposure_no_support"]],
    ["controlled_discomfort_q13", ["controlled_discomfort.accessible_difficulty"], "integrity", ["controlled_discomfort.preserve_assigned_difficulty"]],
    ["controlled_discomfort_q14", ["evidence.observation_vs_inference", "system.authority"], "integrity", ["controlled_discomfort.no_psychological_override"]],
    ["controlled_discomfort_q15", ["controlled_discomfort.response_under_uncertainty", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("time_pressure_stability", [
    ["time_pressure_stability_q1", ["time_pressure_stability.method_under_time"], "knowledge"],
    ["time_pressure_stability_q2", ["time_pressure_stability.method_under_time"], "knowledge"],
    ["time_pressure_stability_q3", ["time_pressure_stability.observation_fields"], "knowledge"],
    ["time_pressure_stability_q4", ["time_pressure_stability.structure_under_timer"], "knowledge"],
    ["time_pressure_stability_q5", ["time_pressure_stability.repeated_timed_execution"], "knowledge"],
    ["time_pressure_stability_q6", ["time_pressure_stability.full_constraint"], "knowledge"],
    ["time_pressure_stability_q7", ["time_pressure_stability.repeated_timed_execution"], "knowledge"],
    ["time_pressure_stability_q8", ["time_pressure_stability.method_over_speed"], "discernment"],
    ["time_pressure_stability_q9", ["time_pressure_stability.observation_fields"], "discernment"],
    ["time_pressure_stability_q10", ["time_pressure_stability.method_under_time", "evidence.contamination"], "observable_execution"],
    ["time_pressure_stability_q11", ["time_pressure_stability.method_over_speed"], "integrity", ["time_pressure_stability.speed_never_replaces_structure"]],
    ["time_pressure_stability_q12", ["time_pressure_stability.repeated_timed_execution", "evidence.contamination"], "integrity", ["time_pressure_stability.no_panic_coaching"]],
    ["time_pressure_stability_q13", ["time_pressure_stability.structure_under_timer", "time_pressure_stability.method_under_time"], "discernment"],
    ["time_pressure_stability_q14", ["time_pressure_stability.full_constraint", "evidence.contamination"], "integrity", ["time_pressure_stability.rescued_not_independent"]],
    ["time_pressure_stability_q15", ["time_pressure_stability.method_under_time", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("topic_conditioning", [
    ["topic_conditioning_q1", ["topic_conditioning.topic_specific_state"], "knowledge"],
    ["topic_conditioning_q2", ["topic_conditioning.topic_specific_state"], "knowledge"],
    ["topic_conditioning_q3", ["topic_conditioning.topic_specific_state"], "knowledge"],
    ["topic_conditioning_q4", ["topic_conditioning.operating_chain"], "knowledge"],
    ["topic_conditioning_q5", ["topic_conditioning.phase_vs_stability"], "knowledge"],
    ["topic_conditioning_q6", ["topic_conditioning.repeated_evidence"], "knowledge"],
    ["topic_conditioning_q7", ["system.authority"], "integrity", ["topic_conditioning.system_owned_movement"]],
    ["topic_conditioning_q8", ["evidence.observation_vs_inference"], "discernment"],
    ["topic_conditioning_q9", ["evidence.rep_lineage"], "knowledge"],
    ["topic_conditioning_q10", ["topic_conditioning.operating_chain"], "discernment"],
    ["topic_conditioning_q11", ["topic_conditioning.phase_identification"], "discernment"],
    ["topic_conditioning_q12", ["topic_conditioning.phase_identification"], "discernment"],
    ["topic_conditioning_q13", ["topic_conditioning.phase_identification"], "discernment"],
    ["topic_conditioning_q14", ["topic_conditioning.phase_identification"], "discernment"],
    ["topic_conditioning_q15", ["system.authority"], "integrity", ["topic_conditioning.no_manual_override"]],
  ]),

  ...phaseCoverage("intro_session_structure", [
    ["intro_session_structure_q1", ["intro.placement_purpose"], "knowledge"],
    ["intro_session_structure_q2", ["intro.placement_purpose"], "knowledge"],
    ["intro_session_structure_q3", ["intro.diagnosis_vs_training"], "knowledge"],
    ["intro_session_structure_q4", ["intro.recommended_start_hypothesis"], "knowledge"],
    ["intro_session_structure_q5", ["intro.diagnosis_vs_training", "intro.recommended_start_hypothesis"], "knowledge"],
    ["intro_session_structure_q6", ["intro.adjacent_phase_movement"], "knowledge"],
    ["intro_session_structure_q7", ["intro.entry_lock_stop"], "knowledge"],
    ["intro_session_structure_q8", ["intro.adjacent_phase_movement"], "knowledge"],
    ["intro_session_structure_q9", ["intro.adjacent_phase_movement"], "knowledge"],
    ["intro_session_structure_q10", ["intro.entry_lock_stop"], "observable_execution"],
    ["intro_session_structure_q11", ["evidence.observation_vs_inference"], "discernment"],
    ["intro_session_structure_q12", ["intro.diagnosis_vs_training", "evidence.contamination"], "integrity", ["intro.no_teaching_as_diagnosis"]],
    ["intro_session_structure_q13", ["intro.adjacent_phase_movement", "system.authority"], "integrity", ["intro.adjacent_movement_only"]],
    ["intro_session_structure_q14", ["intro.adjacent_phase_movement", "system.authority"], "integrity", ["intro.parent_cannot_override_placement"]],
    ["intro_session_structure_final", ["intro.placement_purpose", "intro.entry_lock_stop", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("logging_system", [
    ["logging_system_q1", ["logging.evidence_purpose"], "knowledge"],
    ["logging_system_q2", ["evidence.observation_vs_inference"], "knowledge"],
    ["logging_system_q3", ["evidence.rep_lineage"], "knowledge"],
    ["logging_system_q4", ["logging.raw_option_fidelity"], "integrity", ["logging.record_actual_behavior"]],
    ["logging_system_q5", ["evidence.observation_vs_inference"], "discernment"],
    ["logging_system_q6", ["evidence.contamination", "evidence.logging_integrity"], "discernment"],
    ["logging_system_q7", ["evidence.logging_integrity", "evidence.observation_vs_inference"], "discernment"],
    ["logging_system_q8", ["evidence.contamination", "logging.raw_option_fidelity"], "integrity", ["logging.assisted_not_independent"]],
    ["logging_system_q9", ["evidence.logging_integrity"], "integrity", ["logging.no_invented_behavior"]],
    ["logging_system_q10", ["system.authority"], "discernment"],
    ["logging_system_q11", ["evidence.observation_vs_inference"], "discernment"],
    ["logging_system_q12", ["logging.missing_evidence_recovery"], "integrity", ["logging.no_retroactive_fabrication"]],
    ["logging_system_q13", ["logging.downstream_claim_integrity", "system.authority"], "integrity", ["logging.claims_cannot_override_system"]],
    ["logging_system_q14", ["evidence.rep_lineage"], "observable_execution"],
    ["logging_system_final", ["logging.evidence_purpose", "evidence.logging_integrity", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("session_flow_control", [
    ["session_flow_control_q1", ["session_flow.context_vs_drill"], "knowledge"],
    ["session_flow_control_q2", ["session_flow.context_mapping"], "knowledge"],
    ["session_flow_control_q3", ["session_flow.context_vs_drill"], "knowledge"],
    ["session_flow_control_q4", ["session_flow.context_mapping"], "knowledge"],
    ["session_flow_control_q5", ["session_flow.system_selected_drill"], "knowledge"],
    ["session_flow_control_q6", ["session_flow.active_training_new_topic"], "knowledge"],
    ["session_flow_control_q7", ["session_flow.handover_context"], "knowledge"],
    ["session_flow_control_q8", ["session_flow.context_vs_drill"], "knowledge"],
    ["session_flow_control_q9", ["session_flow.system_selected_drill", "system.authority"], "integrity", ["session_flow.no_manual_drill_override"]],
    ["session_flow_control_q10", ["session_flow.preparation_integrity"], "observable_execution"],
    ["session_flow_control_q11", ["session_flow.system_selected_drill"], "discernment"],
    ["session_flow_control_q12", ["session_flow.active_training_new_topic"], "discernment"],
    ["session_flow_control_q13", ["session_flow.handover_context", "system.authority"], "integrity", ["session_flow.handover_preserves_inherited_state"]],
    ["session_flow_control_q14", ["session_flow.context_mapping", "session_flow.system_selected_drill"], "discernment"],
    ["session_flow_control_final", ["session_flow.context_vs_drill", "session_flow.system_selected_drill", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("drill_library", [
    ["drill_library_q1", ["drill_library.operating_hierarchy"], "knowledge"],
    ["drill_library_q2", ["drill_library.diagnosis_purpose"], "knowledge"],
    ["drill_library_q3", ["drill_library.training_purpose"], "knowledge"],
    ["drill_library_q4", ["drill_library.verification_purpose"], "knowledge"],
    ["drill_library_q5", ["drill_library.phase_set_constraints"], "knowledge"],
    ["drill_library_q6", ["drill_library.phase_set_constraints"], "knowledge"],
    ["drill_library_q7", ["drill_library.phase_set_constraints"], "knowledge"],
    ["drill_library_q8", ["drill_library.phase_set_constraints"], "knowledge"],
    ["drill_library_q9", ["drill_library.repetition_as_evidence"], "knowledge"],
    ["drill_library_q10", ["drill_library.preparation_contract"], "observable_execution"],
    ["drill_library_q11", ["evidence.condition_integrity", "drill_library.phase_set_constraints"], "integrity", ["drill_library.identification_no_solving"]],
    ["drill_library_q12", ["evidence.condition_integrity", "drill_library.phase_set_constraints"], "integrity", ["drill_library.variation_control_no_support"]],
    ["drill_library_q13", ["evidence.condition_integrity", "drill_library.phase_set_constraints"], "integrity", ["drill_library.repeat_exposure_no_rescue"]],
    ["drill_library_q14", ["evidence.condition_integrity", "drill_library.phase_set_constraints"], "integrity", ["drill_library.full_constraint_method_over_speed"]],
    ["drill_library_final", ["drill_library.operating_hierarchy", "evidence.condition_integrity"], "observable_execution"],
  ]),

  ...phaseCoverage("handover_verification", [
    ["handover_verification_q1", ["handover.continuity_purpose"], "knowledge"],
    ["handover_verification_q2", ["handover.inherited_state"], "knowledge"],
    ["handover_verification_q3", ["handover.continuity_purpose"], "knowledge"],
    ["handover_verification_q4", ["handover.continuity_purpose"], "knowledge"],
    ["handover_verification_q5", ["handover.inherited_state", "handover.verification_block"], "observable_execution"],
    ["handover_verification_q6", ["handover.verification_block"], "knowledge"],
    ["handover_verification_q7", ["handover.outcome_families"], "knowledge"],
    ["handover_verification_q8", ["handover.training_reopen_gate"], "knowledge"],
    ["handover_verification_q9", ["system.authority", "handover.outcome_families"], "integrity", ["handover.no_manual_phase_change"]],
    ["handover_verification_q10", ["handover.evidence_record"], "observable_execution"],
    ["handover_verification_q11", ["handover.inherited_state", "system.authority"], "integrity", ["handover.no_personal_replacement"]],
    ["handover_verification_q12", ["handover.outcome_families", "system.authority"], "integrity", ["handover.no_manual_phase_change"]],
    ["handover_verification_q13", ["handover.training_reopen_gate"], "integrity", ["handover.training_closed_on_mismatch"]],
    ["handover_verification_q14", ["handover.outcome_families", "handover.training_reopen_gate"], "discernment"],
    ["handover_verification_final", ["handover.continuity_purpose", "handover.inherited_state", "handover.evidence_record", "system.authority"], "observable_execution"],
  ]),

  ...phaseCoverage("tools_required", [
    ["tools_required_q1", ["tools.compulsory_kit"], "knowledge"],
    ["tools_required_q2", ["tools.top_down_visibility"], "knowledge"],
    ["tools_required_q3", ["tools.top_down_visibility"], "knowledge"],
    ["tools_required_q4", ["tools.audio_reliability"], "knowledge"],
    ["tools_required_q5", ["tools.top_down_visibility"], "knowledge"],
    ["tools_required_q6", ["tools.optional_vs_required"], "knowledge"],
    ["tools_required_q7", ["tools.preflight_check"], "observable_execution"],
    ["tools_required_q8", ["tools.observability_gate", "evidence.observability_integrity"], "discernment"],
    ["tools_required_q9", ["tools.observability_gate", "evidence.observability_integrity"], "observable_execution"],
    ["tools_required_q10", ["tools.optional_vs_required"], "knowledge"],
    ["tools_required_q11", ["tools.observability_gate", "tools.top_down_visibility", "evidence.observability_integrity"], "integrity", ["tools.no_scoring_unobservable_work"]],
    ["tools_required_q12", ["tools.audio_reliability", "tools.observability_gate", "evidence.observability_integrity"], "integrity", ["tools.no_scoring_unreliable_audio"]],
    ["tools_required_q13", ["tools.top_down_visibility", "tools.observability_gate"], "observable_execution"],
    ["tools_required_q14", ["tools.optional_vs_required", "tools.top_down_visibility"], "discernment"],
    ["tools_required_final", ["tools.compulsory_kit", "tools.preflight_check", "tools.observability_gate"], "observable_execution"],
  ]),
];

function entryIdentity(entry: Pick<CapabilityBattleTestCoverageEntry, "deepDiveKey" | "questionKey">) {
  return `${entry.deepDiveKey}:${entry.questionKey}`;
}

function validateEntryAgainstBlueprint(
  entry: CapabilityBattleTestCoverageEntry,
  blueprint: CapabilityDeepDiveBlueprint,
) {
  if (entry.competencyKeys.length === 0 && entry.criticalBoundaryKeys.length === 0) {
    throw new Error(`Battle Test coverage ${entryIdentity(entry)} has no canonical capability lineage.`);
  }
  for (const competencyKey of entry.competencyKeys) {
    if (!blueprint.competencyKeys.includes(competencyKey)) {
      throw new Error(`Battle Test coverage ${entryIdentity(entry)} references unknown competency ${competencyKey}.`);
    }
  }
  for (const boundaryKey of entry.criticalBoundaryKeys) {
    if (!blueprint.criticalBoundaries.some((boundary) => boundary.key === boundaryKey)) {
      throw new Error(`Battle Test coverage ${entryIdentity(entry)} references unknown critical boundary ${boundaryKey}.`);
    }
  }
  const expectedEvidenceKinds = REPLACEMENT_EVIDENCE_BY_PROOF_CLASS[entry.proofClass];
  if (entry.evidenceKinds.join("|") !== expectedEvidenceKinds.join("|")) {
    throw new Error(`Battle Test coverage ${entryIdentity(entry)} has evidence kinds inconsistent with proof class ${entry.proofClass}.`);
  }
  if (entry.humanVerificationRequired !== HUMAN_VERIFICATION_PROOF_CLASSES.has(entry.proofClass)) {
    throw new Error(`Battle Test coverage ${entryIdentity(entry)} has inconsistent human-verification metadata.`);
  }
  if (entry.humanVerificationRequired && !entry.evidenceKinds.some((kind) => kind === "practical" || kind === "oral_defense" || kind === "human_mock")) {
    throw new Error(`Battle Test coverage ${entryIdentity(entry)} claims human verification without a human evidence path.`);
  }
}

export function validateCapabilityBattleTestCoverage(phases: Array<{
  key: string;
  questions: Array<{ key: string; autoCriticalOnFail?: boolean }>;
}>) {
  const liveQuestionIds = new Set<string>();
  const duplicateLiveQuestionIds: string[] = [];
  for (const phase of phases) {
    for (const question of phase.questions) {
      const id = `${phase.key}:${question.key}`;
      if (liveQuestionIds.has(id)) duplicateLiveQuestionIds.push(id);
      liveQuestionIds.add(id);
    }
  }

  const mappingById = new Map<string, CapabilityBattleTestCoverageEntry>();
  const duplicateCoverageIds: string[] = [];
  for (const entry of CAPABILITY_BATTLE_TEST_COVERAGE) {
    const blueprint = getCapabilityDeepDiveBlueprint(entry.deepDiveKey);
    if (!blueprint) throw new Error(`Battle Test coverage references unknown Deep Dive ${entry.deepDiveKey}.`);
    validateEntryAgainstBlueprint(entry, blueprint);
    const id = entryIdentity(entry);
    if (mappingById.has(id)) duplicateCoverageIds.push(id);
    mappingById.set(id, entry);
  }

  const missingCoverageIds = Array.from(liveQuestionIds).filter((id) => !mappingById.has(id));
  const staleCoverageIds = Array.from(mappingById.keys()).filter((id) => !liveQuestionIds.has(id));
  const criticalWithoutBoundary = phases.flatMap((phase) =>
    phase.questions
      .filter((question) => question.autoCriticalOnFail)
      .map((question) => `${phase.key}:${question.key}`)
      .filter((id) => (mappingById.get(id)?.criticalBoundaryKeys.length || 0) === 0),
  );

  const countsByDeepDive = Object.fromEntries(
    phases.map((phase) => [phase.key, phase.questions.length]),
  );
  const countsByProofClass = Object.fromEntries(
    (["knowledge", "discernment", "observable_execution", "integrity"] as BattleTestReplacementProofClass[])
      .map((proofClass) => [
        proofClass,
        CAPABILITY_BATTLE_TEST_COVERAGE.filter((entry) => entry.proofClass === proofClass).length,
      ]),
  );

  return {
    deepDiveCount: phases.length,
    liveQuestionCount: liveQuestionIds.size,
    mappedQuestionCount: CAPABILITY_BATTLE_TEST_COVERAGE.length,
    countsByDeepDive,
    countsByProofClass,
    humanVerificationQuestionCount: CAPABILITY_BATTLE_TEST_COVERAGE.filter((entry) => entry.humanVerificationRequired).length,
    criticalBoundaryQuestionCount: CAPABILITY_BATTLE_TEST_COVERAGE.filter((entry) => entry.criticalBoundaryKeys.length > 0).length,
    duplicateLiveQuestionIds,
    duplicateCoverageIds,
    missingCoverageIds,
    staleCoverageIds,
    criticalWithoutBoundary,
    valid:
      duplicateLiveQuestionIds.length === 0 &&
      duplicateCoverageIds.length === 0 &&
      missingCoverageIds.length === 0 &&
      staleCoverageIds.length === 0 &&
      criticalWithoutBoundary.length === 0,
  };
}
