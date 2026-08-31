import type { ObservationLevel } from "./observationScoring";
import { PHASES, type TopicPhase } from "./topicConditioningEngine";

export type EvidenceDrillMode = "diagnosis" | "training" | "verification";

export type EvidenceConstraintProfile = {
  supportLevel: "modeled" | "minimal" | "first_step_only" | "none";
  pressureLevel: "none" | "difficulty" | "light_timer" | "repeated_timer" | "full_constraint";
  variationLevel: "same_form" | "changed_form";
  difficultyLevel: "recognition" | "normal" | "challenging";
};

export type EvidenceFieldDefinition = {
  fieldKey: string;
  dimensionId: string;
  scoreWeight: number;
  optionLabels?: string[];
  optionLevels: ObservationLevel[];
};

export type EvidenceSetDefinition = {
  setId: string;
  setName: string;
  purpose: string;
  reps: number;
  modelingOnly?: boolean;
  repPurposeIds: string[];
  fields: EvidenceFieldDefinition[];
  repFieldOverrides?: Record<number, Record<string, ObservationLevel[]>>;
  repOptionLabelOverrides?: Record<number, Record<string, string[]>>;
  constraints: EvidenceConstraintProfile;
};

export type DrillSchemaDefinition = {
  schemaId: string;
  schemaVersion: number;
  definitionHash: string;
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  sets: EvidenceSetDefinition[];
};

const TRIAD: ObservationLevel[] = ["weak", "partial", "clear"];
const FOUR_WITH_TWO_CLEAR: ObservationLevel[] = ["weak", "partial", "clear", "clear"];

const SCORE_WEIGHT_BY_DIMENSION: Record<string, number> = {
  "clarity.vocabulary": 30,
  "clarity.method": 30,
  "clarity.reason": 20,
  "clarity.immediate_apply": 20,
  "execution.start": 25,
  "execution.step_discipline": 30,
  "execution.repeatability": 25,
  "execution.independence": 20,
  "difficulty.initial_response": 30,
  "difficulty.first_step_control": 25,
  "difficulty.tolerance": 25,
  "difficulty.rescue_dependence": 20,
  "time.start": 20,
  "time.structure": 35,
  "time.pace": 20,
  "time.completion_integrity": 25,
};

const field = (
  fieldKey: string,
  dimensionId: string,
  optionLevels: ObservationLevel[] = TRIAD,
): EvidenceFieldDefinition => {
  const scoreWeight = SCORE_WEIGHT_BY_DIMENSION[dimensionId];
  if (!scoreWeight) throw new Error(`Missing score weight for evidence dimension ${dimensionId}`);
  return { fieldKey, dimensionId, scoreWeight, optionLevels: [...optionLevels] };
};

const repeatedRepPurposes = (setId: string, reps: number) =>
  Array.from({ length: reps }, (_, index) => `${setId}.opportunity_${index + 1}`);

const set = (
  definition: Omit<EvidenceSetDefinition, "repPurposeIds"> & { repPurposeIds?: string[] },
): EvidenceSetDefinition => ({
  ...definition,
  repPurposeIds: (definition.repPurposeIds || repeatedRepPurposes(definition.setId, definition.reps)).map(
    (repPurposeId) =>
      repPurposeId.startsWith(`${definition.setId}.`)
        ? repPurposeId
        : `${definition.setId}.${repPurposeId}`,
  ),
});

const clarityFields = () => [
  field("vocabulary", "clarity.vocabulary"),
  field("method", "clarity.method"),
  field("reason", "clarity.reason"),
  field("immediateApply", "clarity.immediate_apply"),
];

const structuredExecutionFields = () => [
  field("startBehavior", "execution.start"),
  field("stepExecution", "execution.step_discipline"),
  field("repeatability", "execution.repeatability"),
  field("independence", "execution.independence"),
];

const controlledDiscomfortFields = () => [
  field("initialResponse", "difficulty.initial_response"),
  field("firstStepControl", "difficulty.first_step_control"),
  field("discomfortTolerance", "difficulty.tolerance"),
  field("rescueDependence", "difficulty.rescue_dependence"),
];

const timePressureFields = () => [
  field("startUnderTime", "time.start"),
  field("structureUnderTime", "time.structure"),
  field("paceControl", "time.pace"),
  field("completionIntegrity", "time.completion_integrity"),
];

const NO_PRESSURE_MINIMAL: EvidenceConstraintProfile = {
  supportLevel: "minimal",
  pressureLevel: "none",
  variationLevel: "same_form",
  difficultyLevel: "normal",
};

// Raw labels are part of the versioned evidence contract. They deliberately live beside the
// stable IDs and levels so a client cannot pair a weak display option with a clear option ID.
const RAW_OPTION_LABELS: Record<string, Record<string, string[]>> = {
  "clarity.recognition_probe": {
    vocabulary: ["cannot name", "partial", "clear"],
    method: ["wrong", "hesitant", "correct"],
    reason: ["none", "partial", "clear"],
    immediateApply: ["avoids", "unsure", "engages"],
  },
  "clarity.light_apply_probe": {
    vocabulary: ["incorrect", "partial", "correct"],
    method: ["random", "partial", "structured"],
    reason: ["none", "weak", "present"],
    immediateApply: ["cannot start", "delayed", "starts"],
  },
  "structured_execution.start_and_structure": {
    startBehavior: ["avoids", "delayed", "immediate"],
    stepExecution: ["random / guessing", "partial steps", "full structure"],
    repeatability: ["incorrect", "minor errors", "correct"],
    independence: ["waits for help", "asks after trying", "independent"],
  },
  "structured_execution.repeatability": {
    startBehavior: ["cannot finish", "partial", "complete"],
    stepExecution: ["forgets", "partial", "full"],
    repeatability: ["breaks each time", "inconsistent", "stable"],
    independence: ["guessing", "careless", "structured"],
  },
  "controlled_discomfort.first_contact": {
    initialResponse: ["freeze", "hesitate", "attempt"],
    firstStepControl: ["none", "prompted", "independent"],
    discomfortTolerance: ["panic", "tension", "controlled"],
    rescueDependence: ["asks immediately", "asks later", "no rescue"],
  },
  "controlled_discomfort.pressure_hold": {
    initialResponse: ["collapses", "partial", "recovers"],
    firstStepControl: ["breaks", "partial", "maintained"],
    discomfortTolerance: ["gives up", "short attempt", "stays engaged"],
    rescueDependence: ["asks immediately", "asks later", "no rescue"],
  },
  "time_pressure.light_timer": {
    startUnderTime: ["freeze", "delayed", "immediate"],
    structureUnderTime: ["breaks", "partial", "maintained"],
    paceControl: ["panic", "rushed", "controlled"],
    completionIntegrity: ["fails", "partial", "complete"],
  },
  "time_pressure.consistency": {
    startUnderTime: ["panic", "tension", "composed"],
    structureUnderTime: ["breaks", "partial", "maintained"],
    paceControl: ["rushed", "uneven", "controlled"],
    completionIntegrity: ["collapses", "inconsistent", "stable"],
  },
  "clarity.identification": {
    vocabulary: ["wrong", "hesitant", "correct"],
    method: ["missing", "partial", "clear"],
    reason: ["none", "weak", "clear"],
    immediateApply: ["avoids answering", "unsure but tries", "confident"],
  },
  "clarity.light_apply": {
    vocabulary: ["incorrect", "partial", "correct"],
    method: ["skips", "inconsistent", "structured"],
    reason: ["absent", "weak", "present"],
    immediateApply: ["delayed", "hesitant", "immediate"],
  },
  "structured_execution.required_structure": {
    startBehavior: ["delayed", "hesitant", "immediate"],
    stepExecution: ["skips", "partial", "full"],
    repeatability: ["resists", "accepts", "adjusts", "already structured correctly"],
    independence: ["needs help", "light support", "independent"],
  },
  "structured_execution.independent_execution": {
    startBehavior: ["delayed", "hesitant", "immediate"],
    stepExecution: ["guesses", "partial correction", "structured correction", "no correction needed"],
    repeatability: ["breaks", "inconsistent", "stable"],
    independence: ["needs help", "light support", "independent"],
  },
  "structured_execution.variation_control": {
    startBehavior: ["delayed", "hesitant", "immediate"],
    stepExecution: ["cannot adapt", "partial", "adapts"],
    repeatability: ["lost", "partial", "stable"],
    independence: ["fails", "partial", "complete"],
  },
  "controlled_discomfort.controlled_entry": {
    initialResponse: ["freeze", "hesitant", "controlled"],
    firstStepControl: ["wrong", "partial", "correct"],
    discomfortTolerance: ["breaks", "unstable", "stable"],
    rescueDependence: ["frequent", "occasional", "none"],
  },
  "controlled_discomfort.no_rescue": {
    initialResponse: ["collapses", "partial", "recovers", "no recovery needed"],
    firstStepControl: ["none", "prompted", "independent"],
    discomfortTolerance: ["breaks", "unstable", "stable"],
    rescueDependence: ["dependent", "partial", "independent"],
  },
  "controlled_discomfort.repeat_exposure": {
    initialResponse: ["collapses", "partial", "recovers", "no recovery needed"],
    firstStepControl: ["none", "prompted", "independent"],
    discomfortTolerance: ["breaks", "inconsistent", "stable"],
    rescueDependence: ["frequent", "occasional", "none"],
  },
  "time_pressure.structure_under_timer": {
    startUnderTime: ["panic", "hesitant", "controlled"],
    structureUnderTime: ["lost", "partial", "maintained"],
    paceControl: ["rushed", "uneven", "controlled"],
    completionIntegrity: ["fails", "partial", "complete"],
  },
  "time_pressure.repeated_timed_execution": {
    startUnderTime: ["panic", "hesitant", "controlled"],
    structureUnderTime: ["lost", "partial", "maintained"],
    paceControl: ["rushed", "uneven", "controlled"],
    completionIntegrity: ["breaks", "inconsistent", "stable"],
  },
  "time_pressure.full_constraint": {
    startUnderTime: ["panic", "hesitant", "controlled"],
    structureUnderTime: ["collapses", "unstable", "stable"],
    paceControl: ["rushed", "uneven", "controlled"],
    completionIntegrity: ["fails", "partial", "complete"],
  },
};

const DIAGNOSIS_SETS: Record<TopicPhase, EvidenceSetDefinition[]> = {
  Clarity: [
    set({
      setId: "clarity.recognition_probe",
      setName: "Recognition Probe",
      purpose: "Verify vocabulary, method recognition, reason awareness, and first response without solving.",
      reps: 3,
      repPurposeIds: ["cold_name", "second_look", "confirmation"],
      fields: clarityFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "none",
        variationLevel: "same_form",
        difficultyLevel: "recognition",
      },
    }),
    set({
      setId: "clarity.light_apply_probe",
      setName: "Light Apply Probe",
      purpose: "Verify whether clarity carries into active solving with minimal guidance.",
      reps: 3,
      repPurposeIds: ["first_attempt", "after_feedback", "independence_check"],
      fields: clarityFields(),
      constraints: NO_PRESSURE_MINIMAL,
    }),
  ],
  "Structured Execution": [
    set({
      setId: "structured_execution.start_and_structure",
      setName: "Start + Structure",
      purpose: "Verify cold-start execution and structure without opening assistance.",
      reps: 3,
      repPurposeIds: ["cold_start", "execution_under_observation", "finish_alone_check"],
      fields: structuredExecutionFields(),
      constraints: { ...NO_PRESSURE_MINIMAL, supportLevel: "none" },
    }),
    set({
      setId: "structured_execution.repeatability",
      setName: "Repeatability",
      purpose: "Verify whether execution holds across similar problems.",
      reps: 3,
      repPurposeIds: ["first_repeat", "correction_response", "final_stability"],
      fields: structuredExecutionFields(),
      repFieldOverrides: {
        2: { independence: FOUR_WITH_TWO_CLEAR },
      },
      repOptionLabelOverrides: {
        2: { independence: ["guessing", "careless", "structured", "no correction needed"] },
      },
      constraints: { ...NO_PRESSURE_MINIMAL, supportLevel: "none" },
    }),
  ],
  "Controlled Discomfort": [
    set({
      setId: "controlled_discomfort.first_contact",
      setName: "First Contact",
      purpose: "Verify the initial response to difficulty under a no-help opening condition.",
      reps: 3,
      repPurposeIds: ["cold_contact", "persistence_under_hold", "reengagement"],
      fields: controlledDiscomfortFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "difficulty",
        variationLevel: "same_form",
        difficultyLevel: "challenging",
      },
    }),
    set({
      setId: "controlled_discomfort.pressure_hold",
      setName: "Pressure Hold",
      purpose: "Verify sustained engagement, structure, and recovery under difficulty.",
      reps: 3,
      repPurposeIds: ["sustained_engagement", "tolerance_ceiling", "final_hold"],
      fields: controlledDiscomfortFields(),
      repFieldOverrides: {
        1: { initialResponse: FOUR_WITH_TWO_CLEAR },
        3: { initialResponse: FOUR_WITH_TWO_CLEAR },
      },
      repOptionLabelOverrides: {
        1: { initialResponse: ["collapses", "partial", "recovers", "no recovery needed"] },
        3: { initialResponse: ["collapses", "partial", "recovers", "no recovery needed"] },
      },
      constraints: {
        supportLevel: "first_step_only",
        pressureLevel: "difficulty",
        variationLevel: "same_form",
        difficultyLevel: "challenging",
      },
    }),
  ],
  "Time Pressure Stability": [
    set({
      setId: "time_pressure.light_timer",
      setName: "Light Timer",
      purpose: "Verify structure and response under a controlled first time constraint.",
      reps: 3,
      repPurposeIds: ["first_timer", "adjustment", "consistency_check"],
      fields: timePressureFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "light_timer",
        variationLevel: "same_form",
        difficultyLevel: "normal",
      },
    }),
    set({
      setId: "time_pressure.consistency",
      setName: "Consistency",
      purpose: "Verify drift and consistency across repeated timed attempts.",
      reps: 3,
      repPurposeIds: ["repeat_1", "drift_check", "final_timed_stability"],
      fields: timePressureFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "repeated_timer",
        variationLevel: "same_form",
        difficultyLevel: "normal",
      },
    }),
  ],
};

const TRAINING_SETS: Record<TopicPhase, EvidenceSetDefinition[]> = {
  Clarity: [
    set({
      setId: "clarity.modeling",
      setName: "Modeling",
      purpose: "Build the mental map before scored drilling.",
      reps: 1,
      modelingOnly: true,
      fields: [],
      constraints: {
        supportLevel: "modeled",
        pressureLevel: "none",
        variationLevel: "same_form",
        difficultyLevel: "recognition",
      },
    }),
    set({
      setId: "clarity.identification",
      setName: "Identification",
      purpose: "Build repeatable recognition without solving.",
      reps: 3,
      fields: clarityFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "none",
        variationLevel: "same_form",
        difficultyLevel: "recognition",
      },
    }),
    set({
      setId: "clarity.light_apply",
      setName: "Light Apply",
      purpose: "Test whether clarity holds during active solving.",
      reps: 3,
      fields: clarityFields(),
      constraints: NO_PRESSURE_MINIMAL,
    }),
  ],
  "Structured Execution": [
    set({
      setId: "structured_execution.required_structure",
      setName: "Required Structure",
      purpose: "Require stated step order before solving.",
      reps: 3,
      fields: structuredExecutionFields().map((definition) =>
        definition.fieldKey === "repeatability"
          ? { ...definition, optionLevels: [...FOUR_WITH_TWO_CLEAR] }
          : definition,
      ),
      constraints: NO_PRESSURE_MINIMAL,
    }),
    set({
      setId: "structured_execution.independent_execution",
      setName: "Independent Execution",
      purpose: "Test repeated full execution without tutor help.",
      reps: 3,
      fields: structuredExecutionFields().map((definition) =>
        definition.fieldKey === "stepExecution"
          ? { ...definition, optionLevels: [...FOUR_WITH_TWO_CLEAR] }
          : definition,
      ),
      constraints: { ...NO_PRESSURE_MINIMAL, supportLevel: "none" },
    }),
    set({
      setId: "structured_execution.variation_control",
      setName: "Variation Control",
      purpose: "Test whether the method survives a changed form.",
      reps: 3,
      fields: structuredExecutionFields(),
      constraints: {
        ...NO_PRESSURE_MINIMAL,
        supportLevel: "none",
        variationLevel: "changed_form",
      },
    }),
  ],
  "Controlled Discomfort": [
    set({
      setId: "controlled_discomfort.controlled_entry",
      setName: "Controlled Entry",
      purpose: "Build a controlled first response under difficulty.",
      reps: 3,
      fields: controlledDiscomfortFields(),
      constraints: {
        supportLevel: "minimal",
        pressureLevel: "difficulty",
        variationLevel: "same_form",
        difficultyLevel: "challenging",
      },
    }),
    set({
      setId: "controlled_discomfort.no_rescue",
      setName: "No Rescue",
      purpose: "Build independence and recovery under difficulty without full rescue.",
      reps: 3,
      fields: controlledDiscomfortFields().map((definition) =>
        definition.fieldKey === "initialResponse"
          ? { ...definition, optionLevels: [...FOUR_WITH_TWO_CLEAR] }
          : definition,
      ),
      constraints: {
        supportLevel: "first_step_only",
        pressureLevel: "difficulty",
        variationLevel: "same_form",
        difficultyLevel: "challenging",
      },
    }),
    set({
      setId: "controlled_discomfort.repeat_exposure",
      setName: "Repeat Exposure",
      purpose: "Build consistency across repeated exposure at the same difficulty.",
      reps: 3,
      fields: controlledDiscomfortFields().map((definition) =>
        definition.fieldKey === "initialResponse"
          ? { ...definition, optionLevels: [...FOUR_WITH_TWO_CLEAR] }
          : definition,
      ),
      constraints: {
        supportLevel: "none",
        pressureLevel: "difficulty",
        variationLevel: "same_form",
        difficultyLevel: "challenging",
      },
    }),
  ],
  "Time Pressure Stability": [
    set({
      setId: "time_pressure.structure_under_timer",
      setName: "Structure Under Timer",
      purpose: "Build method-first structure under an active timer.",
      reps: 3,
      fields: timePressureFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "light_timer",
        variationLevel: "same_form",
        difficultyLevel: "normal",
      },
    }),
    set({
      setId: "time_pressure.repeated_timed_execution",
      setName: "Repeated Timed Execution",
      purpose: "Build consistency across repeated attempts under the same timer.",
      reps: 3,
      fields: timePressureFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "repeated_timer",
        variationLevel: "same_form",
        difficultyLevel: "normal",
      },
    }),
    set({
      setId: "time_pressure.full_constraint",
      setName: "Full Constraint",
      purpose: "Test structure and completion under the tightest defined time constraint.",
      reps: 3,
      fields: timePressureFields(),
      constraints: {
        supportLevel: "none",
        pressureLevel: "full_constraint",
        variationLevel: "same_form",
        difficultyLevel: "normal",
      },
    }),
  ],
};

const schemaIdFor = (mode: EvidenceDrillMode, phase: TopicPhase) =>
  `ri.${mode}.${phase.toLowerCase().replace(/\s+/g, "_")}`;

const definitionHashFor = (value: unknown) => {
  const serialized = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const schemaFor = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  sets: EvidenceSetDefinition[],
): DrillSchemaDefinition => {
  const registeredSets = sets.map((definition) => ({
    ...definition,
    fields: definition.fields.map((fieldDefinition) => ({
      ...fieldDefinition,
      optionLabels: [...(RAW_OPTION_LABELS[definition.setId]?.[fieldDefinition.fieldKey] || [])],
    })),
  }));
  const versionedDefinition = {
    schemaId: schemaIdFor(mode, phase),
    schemaVersion: 1,
    mode,
    phase,
    sets: registeredSets,
  };
  return {
    ...versionedDefinition,
    definitionHash: definitionHashFor(versionedDefinition),
  };
};

const RESPONSE_INTEGRITY_DRILL_REGISTRY_V1: Record<
  EvidenceDrillMode,
  Record<TopicPhase, DrillSchemaDefinition>
> = {
  diagnosis: Object.fromEntries(
    PHASES.map((phase) => [phase, schemaFor("diagnosis", phase, DIAGNOSIS_SETS[phase])]),
  ) as Record<TopicPhase, DrillSchemaDefinition>,
  training: Object.fromEntries(
    PHASES.map((phase) => [phase, schemaFor("training", phase, TRAINING_SETS[phase])]),
  ) as Record<TopicPhase, DrillSchemaDefinition>,
  verification: Object.fromEntries(
    PHASES.map((phase) => [phase, schemaFor("verification", phase, [DIAGNOSIS_SETS[phase][0]])]),
  ) as Record<TopicPhase, DrillSchemaDefinition>,
};

export const RESPONSE_INTEGRITY_DRILL_REGISTRY_HISTORY: Record<
  EvidenceDrillMode,
  Record<TopicPhase, Record<number, DrillSchemaDefinition>>
> = Object.fromEntries(
  (["diagnosis", "training", "verification"] as const).map((mode) => [
    mode,
    Object.fromEntries(
      PHASES.map((phase) => [phase, { 1: RESPONSE_INTEGRITY_DRILL_REGISTRY_V1[mode][phase] }]),
    ),
  ]),
) as unknown as Record<EvidenceDrillMode, Record<TopicPhase, Record<number, DrillSchemaDefinition>>>;

// This alias is the schema emitted by the live runner. Published historical definitions remain
// addressable through RESPONSE_INTEGRITY_DRILL_REGISTRY_HISTORY when a later version is activated.
export const RESPONSE_INTEGRITY_DRILL_REGISTRY = RESPONSE_INTEGRITY_DRILL_REGISTRY_V1;

export const getDrillSchemaDefinition = (mode: EvidenceDrillMode, phase: TopicPhase) =>
  RESPONSE_INTEGRITY_DRILL_REGISTRY[mode][phase];

export const getDrillSchemaDefinitionByVersion = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  schemaVersion: number,
) => RESPONSE_INTEGRITY_DRILL_REGISTRY_HISTORY[mode][phase][schemaVersion] || null;

export const getEvidenceSetByName = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  setName: string,
) => getDrillSchemaDefinition(mode, phase).sets.find((definition) => definition.setName === setName) || null;

export const getEvidenceSetById = (
  mode: EvidenceDrillMode,
  phase: TopicPhase,
  setId: string,
) => getDrillSchemaDefinition(mode, phase).sets.find((definition) => definition.setId === setId) || null;

export const getRepPurposeId = (definition: EvidenceSetDefinition, repIndex: number) =>
  definition.repPurposeIds[repIndex] || `${definition.setId}.opportunity_${repIndex + 1}`;

export const getFieldDefinitionForRep = (
  definition: EvidenceSetDefinition,
  repIndex: number,
  fieldKey: string,
) => {
  const base = definition.fields.find((candidate) => candidate.fieldKey === fieldKey);
  if (!base) return null;
  const override = definition.repFieldOverrides?.[repIndex + 1]?.[fieldKey];
  const optionLabelOverride = definition.repOptionLabelOverrides?.[repIndex + 1]?.[fieldKey];
  return {
    ...base,
    optionLevels: override ? [...override] : [...base.optionLevels],
    optionLabels: optionLabelOverride
      ? [...optionLabelOverride]
      : [...(base.optionLabels || [])],
  };
};

const optionIdFor = (
  definition: EvidenceSetDefinition,
  repIndex: number,
  field: EvidenceFieldDefinition,
  optionIndex: number,
) => `${getRepPurposeId(definition, repIndex)}.${field.dimensionId}.option_${optionIndex + 1}`;

export const getEvidenceSelectionIdentity = ({
  mode,
  phase,
  setName,
  repIndex,
  fieldKey,
  optionIndex,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setName: string;
  repIndex: number;
  fieldKey: string;
  optionIndex: number;
}) => {
  const schema = getDrillSchemaDefinition(mode, phase);
  const definition = getEvidenceSetByName(mode, phase, setName);
  if (!definition) return null;
  const fieldDefinition = getFieldDefinitionForRep(definition, repIndex, fieldKey);
  if (!fieldDefinition || optionIndex < 0 || optionIndex >= fieldDefinition.optionLevels.length) return null;

  return {
    schemaId: schema.schemaId,
    schemaVersion: schema.schemaVersion,
    definitionHash: schema.definitionHash,
    setId: definition.setId,
    repId: getRepPurposeId(definition, repIndex),
    dimensionId: fieldDefinition.dimensionId,
    optionId: optionIdFor(definition, repIndex, fieldDefinition, optionIndex),
    level: fieldDefinition.optionLevels[optionIndex],
    constraints: definition.constraints,
  };
};

export const resolveEvidenceSelection = ({
  mode,
  phase,
  setId,
  repIndex,
  fieldKey,
  optionId,
  schemaVersion,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setId: string;
  repIndex: number;
  fieldKey: string;
  optionId: string;
  schemaVersion?: number;
}) => {
  const schema = schemaVersion === undefined
    ? getDrillSchemaDefinition(mode, phase)
    : getDrillSchemaDefinitionByVersion(mode, phase, schemaVersion);
  const definition = schema?.sets.find((candidate) => candidate.setId === setId) || null;
  if (!definition) return null;
  const fieldDefinition = getFieldDefinitionForRep(definition, repIndex, fieldKey);
  if (!fieldDefinition) return null;

  for (let optionIndex = 0; optionIndex < fieldDefinition.optionLevels.length; optionIndex += 1) {
    if (optionIdFor(definition, repIndex, fieldDefinition, optionIndex) === optionId) {
      return {
        definition,
        field: fieldDefinition,
        optionIndex,
        level: fieldDefinition.optionLevels[optionIndex],
        repId: getRepPurposeId(definition, repIndex),
      };
    }
  }

  return null;
};

export type SubmittedEvidenceSet = {
  setName: string;
  setId?: string;
  setOrder?: number;
  drillSchemaId?: string;
  drillSchemaVersion?: number;
  drillDefinitionHash?: string;
  constraintProfile?: Record<string, unknown> | null;
  observations: Array<Record<string, string>>;
};

export type SemanticEvidenceValidationResult =
  | { ok: true; normalizedSet: SubmittedEvidenceSet }
  | { ok: false; error: string };

export const hasSemanticEvidenceContract = (set: SubmittedEvidenceSet) =>
  Boolean(
    set.setId ||
      set.drillSchemaId ||
      set.drillSchemaVersion !== undefined ||
      set.drillDefinitionHash ||
      set.observations.some((rep) =>
        Object.keys(rep || {}).some(
          (key) => key === "_rep_id" || key === "_rep_number" || key.endsWith("_option_id") || key.endsWith("_dimension_id"),
        ),
      ),
  );

export const validateAndNormalizeSemanticEvidenceSet = ({
  mode,
  phase,
  setIndex,
  submittedSet,
  acceptHistoricalVersion = false,
}: {
  mode: EvidenceDrillMode;
  phase: TopicPhase;
  setIndex: number;
  submittedSet: SubmittedEvidenceSet;
  acceptHistoricalVersion?: boolean;
}): SemanticEvidenceValidationResult => {
  const liveSchema = getDrillSchemaDefinition(mode, phase);
  const schema = acceptHistoricalVersion
    ? getDrillSchemaDefinitionByVersion(mode, phase, Number(submittedSet.drillSchemaVersion))
    : liveSchema;
  const location = `Set ${setIndex + 1}`;

  if (!schema) return { ok: false, error: `${location} has an unsupported drill schema version` };
  const definition = schema.sets[setIndex];
  if (!definition) return { ok: false, error: `${location} is not defined for ${phase} ${mode}` };
  if (submittedSet.drillSchemaId !== schema.schemaId) {
    return { ok: false, error: `${location} has an invalid drill schema ID` };
  }
  if (submittedSet.drillSchemaVersion !== schema.schemaVersion || (!acceptHistoricalVersion && schema !== liveSchema)) {
    return { ok: false, error: `${location} has an unsupported drill schema version` };
  }
  if (submittedSet.drillDefinitionHash !== schema.definitionHash) {
    return { ok: false, error: `${location} has an invalid drill definition hash` };
  }
  if (submittedSet.setId !== definition.setId || submittedSet.setName !== definition.setName) {
    return { ok: false, error: `${location} does not match the registered evidence set` };
  }
  if (submittedSet.setOrder !== setIndex + 1) {
    return { ok: false, error: `${location} has an invalid set order` };
  }

  const observations = Array.isArray(submittedSet.observations) ? submittedSet.observations : [];
  if (definition.modelingOnly) {
    if (observations.length > 0) {
      return { ok: false, error: `${location} must not include scored observations` };
    }
  } else if (observations.length !== definition.reps) {
    return { ok: false, error: `${location} must include exactly ${definition.reps} reps` };
  }

  const normalizedObservations: Array<Record<string, string>> = [];
  for (let repIndex = 0; repIndex < observations.length; repIndex += 1) {
    const submittedRep = observations[repIndex] || {};
    const expectedRepId = getRepPurposeId(definition, repIndex);
    if (String(submittedRep._rep_id || "") !== expectedRepId) {
      return { ok: false, error: `${location}, rep ${repIndex + 1} has an invalid rep ID` };
    }
    if (String(submittedRep._rep_number || "") !== String(repIndex + 1)) {
      return { ok: false, error: `${location}, rep ${repIndex + 1} has an invalid rep number` };
    }

    const normalizedRep: Record<string, string> = {
      ...submittedRep,
      _rep_id: expectedRepId,
      _rep_number: String(repIndex + 1),
    };

    for (const baseField of definition.fields) {
      const fieldDefinition = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey);
      if (!fieldDefinition) {
        return { ok: false, error: `${location}, rep ${repIndex + 1} has an unknown evidence dimension` };
      }

      const rawOption = String(submittedRep[fieldDefinition.fieldKey] || "").trim();
      const optionId = String(submittedRep[`${fieldDefinition.fieldKey}_option_id`] || "").trim();
      const dimensionId = String(submittedRep[`${fieldDefinition.fieldKey}_dimension_id`] || "").trim();
      const submittedLevel = String(submittedRep[`${fieldDefinition.fieldKey}_level`] || "").trim();
      const resolved = resolveEvidenceSelection({
        mode,
        phase,
        setId: definition.setId,
        repIndex,
        fieldKey: fieldDefinition.fieldKey,
        optionId,
        schemaVersion: schema.schemaVersion,
      });

      if (!rawOption || !optionId || !resolved) {
        return { ok: false, error: `${location}, rep ${repIndex + 1} has an invalid evidence option` };
      }
      if (dimensionId !== resolved.field.dimensionId) {
        return { ok: false, error: `${location}, rep ${repIndex + 1} has an invalid evidence dimension` };
      }
      const registeredRawOption = resolved.field.optionLabels?.[resolved.optionIndex];
      if (!registeredRawOption || rawOption !== registeredRawOption) {
        return { ok: false, error: `${location}, rep ${repIndex + 1} raw option does not match its option ID` };
      }
      if (submittedLevel !== resolved.level) {
        return { ok: false, error: `${location}, rep ${repIndex + 1} level does not match its option ID` };
      }

      normalizedRep[fieldDefinition.fieldKey] = registeredRawOption;
      normalizedRep[`${fieldDefinition.fieldKey}_option_id`] = optionId;
      normalizedRep[`${fieldDefinition.fieldKey}_dimension_id`] = resolved.field.dimensionId;
      normalizedRep[`${fieldDefinition.fieldKey}_level`] = resolved.level;
    }

    normalizedObservations.push(normalizedRep);
  }

  return {
    ok: true,
    normalizedSet: {
      setName: definition.setName,
      setId: definition.setId,
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: { ...definition.constraints },
      observations: normalizedObservations,
    },
  };
};
