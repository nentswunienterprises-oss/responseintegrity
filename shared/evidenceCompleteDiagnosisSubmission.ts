import type { TopicPhase, TopicStability } from "./topicConditioningEngine";
import {
  createEvidenceCompleteDiagnosisState,
  DIAGNOSIS_PROBES,
  evaluateEvidenceCompleteDiagnosis,
  getDiagnosisProbeOpportunityPurpose,
  recordEvidenceCompleteDiagnosisProbe,
  type DiagnosisDimensionId,
  type DiagnosisProbeDefinition,
  type DiagnosisProbeId,
  type DiagnosisProbeResult,
  type DiagnosisSupportEvent,
  type EvidenceCompleteDiagnosisDecision,
  type EvidenceCompleteDiagnosisState,
} from "./evidenceCompleteDiagnosis";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  getDiagnosisObservationOption,
  type DiagnosisBehaviorClass,
} from "./diagnosisObservationMatrix";

export const EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_ID = "ri.diagnosis.evidence_native";
export const EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_VERSION = 2;
export const EVIDENCE_COMPLETE_DIAGNOSIS_DEFINITION_HASH =
  "d5af9c66f1b8e807b325e898884416662a0c743ad1b82f446b08ff34f16d9de2";
export const MAX_EVIDENCE_COMPLETE_DIAGNOSIS_PROBES = 12;

export const canonicalizeEvidenceJson = (value: unknown): string => {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) {
      return entry.map(normalize);
    }
    if (entry && typeof entry === "object") {
      return Object.fromEntries(
        Object.keys(entry as Record<string, unknown>)
          .sort()
          .map((key) => [key, normalize((entry as Record<string, unknown>)[key])]),
      );
    }
    return entry ?? null;
  };

  return JSON.stringify(normalize(value ?? null));
};

const SUPPORT_EVENTS = new Set<DiagnosisSupportEvent>([
  "none",
  "neutral_clarification",
  "first_step_confirmation",
  "teaching",
]);

export type EvidenceCompleteDiagnosisReplay =
  | {
      ok: true;
      state: EvidenceCompleteDiagnosisState;
      decision: EvidenceCompleteDiagnosisDecision;
      nextProbe: DiagnosisProbeDefinition | null;
    }
  | {
      ok: false;
      error: string;
      failedAtProbeIndex?: number;
    };

const cleanProbeResult = (value: unknown): DiagnosisProbeResult | null => {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const probeId = String(input.probeId || "").trim() as DiagnosisProbeId;
  if (!(probeId in DIAGNOSIS_PROBES)) return null;

  const supportEvent = String(input.supportEvent || "none").trim() as DiagnosisSupportEvent;
  if (!SUPPORT_EVENTS.has(supportEvent)) return null;

  if (!Array.isArray(input.observations)) return null;
  const observations = input.observations.map((raw) => {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const dimensionId = String(row.dimensionId || "").trim() as DiagnosisDimensionId;
    const behaviorId = String(row.behaviorId || "").trim();
    if (!(dimensionId in DIAGNOSIS_OBSERVATION_MATRIX)) return null;
    if (!getDiagnosisObservationOption(dimensionId, behaviorId)) return null;
    return { dimensionId, behaviorId };
  });

  if (observations.some((row) => !row)) return null;
  return {
    probeId,
    supportEvent,
    observations: observations as Array<{
      dimensionId: DiagnosisDimensionId;
      behaviorId: string;
    }>,
  };
};

const validateExactProbeDimensions = (
  definition: DiagnosisProbeDefinition,
  result: DiagnosisProbeResult,
): string | null => {
  const expected = definition.dimensions;
  if (result.observations.length !== expected.length) {
    return `${definition.id} must record exactly ${expected.length} evidence dimensions`;
  }

  const observed = result.observations.map((row) => row.dimensionId);
  const unique = new Set(observed);
  if (unique.size !== observed.length) {
    return `${definition.id} contains a duplicate evidence dimension`;
  }

  for (const dimensionId of expected) {
    if (!unique.has(dimensionId)) {
      return `${definition.id} is missing required evidence dimension ${dimensionId}`;
    }
  }

  for (const dimensionId of observed) {
    if (!expected.includes(dimensionId)) {
      return `${definition.id} cannot record evidence dimension ${dimensionId}`;
    }
  }

  return null;
};

export function replayEvidenceCompleteDiagnosis(
  startingPhase: TopicPhase | null,
  rawProbeHistory: unknown,
): EvidenceCompleteDiagnosisReplay {
  if (!Array.isArray(rawProbeHistory)) {
    return { ok: false, error: "probeHistory must be an array" };
  }
  if (rawProbeHistory.length > MAX_EVIDENCE_COMPLETE_DIAGNOSIS_PROBES) {
    return {
      ok: false,
      error: `Diagnosis exceeded the ${MAX_EVIDENCE_COMPLETE_DIAGNOSIS_PROBES}-probe safety limit`,
    };
  }

  let state = createEvidenceCompleteDiagnosisState(startingPhase);
  let decision = evaluateEvidenceCompleteDiagnosis(state);

  for (let index = 0; index < rawProbeHistory.length; index += 1) {
    if (decision.complete) {
      return {
        ok: false,
        failedAtProbeIndex: index,
        error: "Diagnosis cannot continue after the evidence requirement is complete",
      };
    }
    if (!decision.nextProbeId) {
      return {
        ok: false,
        failedAtProbeIndex: index,
        error: "Diagnosis is blocked for evidence review and cannot accept another automatic probe",
      };
    }

    const result = cleanProbeResult(rawProbeHistory[index]);
    if (!result) {
      return {
        ok: false,
        failedAtProbeIndex: index,
        error: `Probe ${index + 1} has an invalid behavioral evidence payload`,
      };
    }

    if (result.probeId !== decision.nextProbeId) {
      return {
        ok: false,
        failedAtProbeIndex: index,
        error: `Probe ${index + 1} must be ${decision.nextProbeId}; received ${result.probeId}`,
      };
    }

    const definition = DIAGNOSIS_PROBES[result.probeId];
    const dimensionError = validateExactProbeDimensions(definition, result);
    if (dimensionError) {
      return { ok: false, failedAtProbeIndex: index, error: dimensionError };
    }

    try {
      state = recordEvidenceCompleteDiagnosisProbe(state, result);
    } catch (error) {
      return {
        ok: false,
        failedAtProbeIndex: index,
        error: error instanceof Error ? error.message : "Probe evidence could not be recorded",
      };
    }
    decision = evaluateEvidenceCompleteDiagnosis(state);
  }

  return {
    ok: true,
    state,
    decision,
    nextProbe: decision.nextProbeId ? DIAGNOSIS_PROBES[decision.nextProbeId] : null,
  };
}

export type EvidenceCompleteDiagnosisLedgerRow = {
  evidence_id: string;
  projection_version: number;
  source_drill_id: string;
  student_id: string;
  tutor_id: string;
  topic: string;
  scheduled_session_id: string | null;
  training_session_run_id: string | null;
  session_group_id: string;
  session_context: "intro" | "active_training" | "handover_verification";
  drill_type: "diagnosis";
  drill_schema_id: string;
  drill_schema_version: number;
  drill_definition_hash: string;
  phase: TopicPhase;
  state_phase_before: null;
  stability_before: null;
  state_phase_after: TopicPhase;
  stability_after: Exclude<TopicStability, "High Maintenance">;
  transition_reason: string;
  block_order: number;
  set_id: DiagnosisProbeId;
  set_order: number;
  rep_id: string;
  rep_number: number;
  dimension_id: DiagnosisDimensionId;
  dimension_order: number;
  field_key: DiagnosisDimensionId;
  option_id: string;
  raw_option: string;
  normalized_level: DiagnosisBehaviorClass;
  score_contribution: number;
  score_contribution_max: number;
  constraint_profile: Record<string, unknown>;
  observed_at: string;
};

export function buildEvidenceCompleteDiagnosisLedgerRows(input: {
  sourceDrillId: string;
  studentId: string;
  tutorId: string;
  topic: string;
  scheduledSessionId?: string | null;
  sessionGroupId?: string | null;
  sessionContext: "intro" | "active_training" | "handover_verification";
  observedAt: string;
  state: EvidenceCompleteDiagnosisState;
  decision: EvidenceCompleteDiagnosisDecision;
}): EvidenceCompleteDiagnosisLedgerRow[] {
  if (!input.decision.complete || !input.decision.placementPhase || !input.decision.stability) {
    throw new Error("Evidence ledger projection requires a complete diagnosis decision");
  }

  const occurrenceByProbe = new Map<DiagnosisProbeId, number>();

  return input.state.probeHistory.flatMap((result, blockIndex) => {
    const definition = DIAGNOSIS_PROBES[result.probeId];
    const occurrence = (occurrenceByProbe.get(result.probeId) || 0) + 1;
    occurrenceByProbe.set(result.probeId, occurrence);
    const supportEvent = result.supportEvent || "none";
    const isContaminated =
      supportEvent === "first_step_confirmation" || supportEvent === "teaching";
    const repId = `${result.probeId}.opportunity_${occurrence}`;
    const blockOrder = blockIndex + 1;

    return result.observations.map((observation) => {
      const dimension = DIAGNOSIS_OBSERVATION_MATRIX[observation.dimensionId];
      const behavior = getDiagnosisObservationOption(
        observation.dimensionId,
        observation.behaviorId,
      );
      if (!behavior) {
        throw new Error(
          `Cannot project unknown behavior ${observation.behaviorId} for ${observation.dimensionId}`,
        );
      }
      const dimensionOrder = definition.dimensions.indexOf(observation.dimensionId) + 1;

      return {
        evidence_id: [
          input.sourceDrillId,
          blockOrder,
          result.probeId,
          repId,
          observation.dimensionId,
        ].join("::"),
        projection_version: 2,
        source_drill_id: input.sourceDrillId,
        student_id: input.studentId,
        tutor_id: input.tutorId,
        topic: input.topic,
        scheduled_session_id: input.scheduledSessionId || null,
        training_session_run_id: null,
        session_group_id:
          input.sessionGroupId || input.scheduledSessionId || input.sourceDrillId,
        session_context: input.sessionContext,
        drill_type: "diagnosis",
        drill_schema_id: EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_ID,
        drill_schema_version: EVIDENCE_COMPLETE_DIAGNOSIS_SCHEMA_VERSION,
        drill_definition_hash: EVIDENCE_COMPLETE_DIAGNOSIS_DEFINITION_HASH,
        phase: dimension.phase,
        state_phase_before: null,
        stability_before: null,
        state_phase_after: input.decision.placementPhase!,
        stability_after: input.decision.stability!,
        transition_reason: "evidence_native_diagnosis",
        block_order: blockOrder,
        set_id: result.probeId,
        set_order: blockOrder,
        rep_id: repId,
        rep_number: occurrence,
        dimension_id: observation.dimensionId,
        dimension_order: dimensionOrder,
        field_key: observation.dimensionId,
        option_id: observation.behaviorId,
        raw_option: behavior.label,
        normalized_level: behavior.behaviorClass,
        // Numeric score fields remain zeroed for ledger schema compatibility only.
        // They have no decision authority in evidence-native diagnosis.
        score_contribution: 0,
        score_contribution_max: 0,
        constraint_profile: {
          ...definition.constraints,
          probeId: result.probeId,
          evidenceQuestion: definition.evidenceQuestion,
          opportunityPurpose: getDiagnosisProbeOpportunityPurpose(
            result.probeId,
            occurrence,
          ),
          supportEvent,
          contaminated: isContaminated,
          behaviorId: observation.behaviorId,
          behaviorLabel: behavior.label,
          behaviorClass: behavior.behaviorClass,
          decisionAuthority: "behavioral_evidence",
          scoreAuthority: false,
        },
        observed_at: input.observedAt,
      };
    });
  });
}
