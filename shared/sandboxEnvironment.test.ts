import test from "node:test";
import assert from "node:assert/strict";
import {
  SANDBOX_CAPABILITY_LAYERS,
  compareSandboxTurn,
  evaluateSandboxCapabilityReadiness,
  evaluateSandboxCompletedSession,
  nextSandboxContinuityState,
  projectSandboxOutcomeToCurrentTrainingContract,
  selectSandboxOutcome,
  validateSandboxOutcomeDefinition,
  type SandboxCapabilityOccurrence,
  type SandboxCapabilityReadinessPolicy,
  type SandboxCompletedTurn,
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
import type { TopicPhase } from "./topicConditioningEngine";

const phase: TopicPhase = "Clarity";

function outcomeFor(input: {
  setId: string;
  repNumber: number;
  key: string;
  optionIndex?: number;
  challenge?: "condition_integrity" | "observation_integrity" | "evidence_integrity" | "authority_integrity" | "continuity_integrity";
  trajectoryClass?: SandboxOutcomeDefinition["trajectoryClass"];
}): SandboxOutcomeDefinition {
  const schema = getDrillSchemaDefinition("training", phase);
  const set = schema.sets.find((candidate) => candidate.setId === input.setId);
  if (!set) throw new Error("Missing test set");
  const repIndex = input.repNumber - 1;
  const canonicalObservations = Object.fromEntries(
    set.fields.map((baseField) => {
      const field = getFieldDefinitionForRep(set, repIndex, baseField.fieldKey) || baseField;
      const requested = input.optionIndex ?? field.optionLevels.length - 1;
      const optionIndex = Math.max(0, Math.min(requested, field.optionLevels.length - 1));
      const identity = getEvidenceSelectionIdentity({
        mode: "training",
        phase,
        setName: set.setName,
        repIndex,
        fieldKey: field.fieldKey,
        optionIndex,
      });
      if (!identity) throw new Error("Missing option identity");
      return [field.fieldKey, { optionId: identity.optionId, evidenceStatus: "observed" as const }];
    }),
  );

  return {
    key: input.key,
    version: 1,
    phase,
    setId: set.setId,
    repNumber: input.repNumber,
    studentBehavior: "The simulated student gives a coherent observable response for this rep.",
    canonicalObservations,
    trajectoryClass: input.trajectoryClass || "supported",
    weight: 1,
    challengeCapabilities: input.challenge ? [input.challenge] : [],
    emitsContinuityTags: [input.trajectoryClass || "supported"],
  };
}

function specialistCopy(outcome: SandboxOutcomeDefinition) {
  return Object.fromEntries(
    Object.entries(outcome.canonicalObservations).map(([key, value]) => [
      key,
      { optionId: value.optionId, evidenceStatus: value.evidenceStatus },
    ]),
  );
}

test("Outcome Matrix definition is bound to the live phase/set/rep schema", () => {
  const outcome = outcomeFor({
    setId: "clarity.identification",
    repNumber: 1,
    key: "clarity_identification_rep1_clean",
  });
  assert.doesNotThrow(() => validateSandboxOutcomeDefinition(outcome));

  const broken = { ...outcome, repNumber: 99 };
  assert.throws(() => validateSandboxOutcomeDefinition(broken));
});

test("Sandbox bank V1 observations reconcile by evidence meaning into Training V2", () => {
  const historicalSchema = getDrillSchemaDefinitionByVersion(
    "training",
    "Structured Execution",
    1,
  );
  assert.ok(historicalSchema);
  const historicalSet = historicalSchema!.sets.find(
    (candidate) => candidate.setId === "structured_execution.required_structure",
  );
  assert.ok(historicalSet);

  const historicalObservations = Object.fromEntries(
    historicalSet!.fields.map((baseField) => {
      const field =
        getFieldDefinitionForRep(historicalSet!, 0, baseField.fieldKey) ||
        baseField;
      const optionIndex =
        field.fieldKey === "startBehavior"
          ? 0
          : Math.max(0, field.optionLevels.length - 1);
      return [
        field.fieldKey,
        {
          optionId: `${getRepPurposeId(historicalSet!, 0)}.${field.dimensionId}.option_${optionIndex + 1}`,
          evidenceStatus: "observed" as const,
        },
      ];
    }),
  );

  const historicalOutcome: SandboxOutcomeDefinition = {
    key: "structured_required_rep1_v1_projection",
    version: 1,
    phase: "Structured Execution",
    setId: historicalSet!.setId,
    repNumber: 1,
    studentBehavior:
      "The student delays before producing a valid first execution move.",
    canonicalObservations: historicalObservations,
    trajectoryClass: "conditional",
    weight: 1,
  };

  const projected = projectSandboxOutcomeToCurrentTrainingContract(
    historicalOutcome,
    1,
  );
  assert.doesNotThrow(() => validateSandboxOutcomeDefinition(projected));

  const current = getDrillSchemaDefinition("training", "Structured Execution");
  assert.equal(current.schemaVersion, 2);
  const projectedStart = projected.canonicalObservations.startBehavior;
  const resolved = resolveEvidenceSelection({
    mode: "training",
    phase: "Structured Execution",
    setId: historicalSet!.setId,
    repIndex: 0,
    fieldKey: "startBehavior",
    optionId: projectedStart.optionId,
    schemaVersion: 2,
  });
  assert.equal(resolved?.evidenceClass, "conditional");
  assert.match(
    resolved?.field.optionLabels?.[resolved.optionIndex] || "",
    /guessing|disordered/i,
  );
  assert.match(projectedStart.optionId, /\.option_2$/);
});

test("constrained shuffle is deterministic and can target the earliest unsupported capability", () => {
  const a = outcomeFor({
    setId: "clarity.identification",
    repNumber: 1,
    key: "a",
  });
  const b = outcomeFor({
    setId: "clarity.identification",
    repNumber: 1,
    key: "b",
    challenge: "observation_integrity",
  });
  const context = {
    canonicalPhase: phase,
    canonicalStability: "Low" as const,
    prescribedPhase: phase,
    setId: "clarity.identification",
    repNumber: 1,
    sequenceNumber: 7,
    earliestUnsupportedCapability: "observation_integrity" as const,
  };

  const first = selectSandboxOutcome({ seed: "fixed-seed", outcomes: [a, b], context });
  const second = selectSandboxOutcome({ seed: "fixed-seed", outcomes: [a, b], context });
  assert.equal(first.key, second.key);
  assert.equal(first.key, "b");

  const withoutRepeat = selectSandboxOutcome({
    seed: "fixed-seed",
    outcomes: [a, b, outcomeFor({
      setId: "clarity.identification",
      repNumber: 1,
      key: "c",
    })],
    context: { ...context, recentOutcomeKeys: ["b"] },
  });
  assert.notEqual(withoutRepeat.key, "b");
});

test("continuity tags persist across turns while outcomes can clear stale conditions", () => {
  const first = outcomeFor({
    setId: "clarity.identification",
    repNumber: 1,
    key: "break",
    trajectoryClass: "breakdown",
  });
  first.emitsContinuityTags = ["recent_breakdown"];

  const state1 = nextSandboxContinuityState({ currentTags: [], outcome: first });
  assert.deepEqual(state1.continuityTags, ["recent_breakdown"]);

  const recovery = outcomeFor({
    setId: "clarity.identification",
    repNumber: 2,
    key: "recovery",
    trajectoryClass: "supported",
  });
  recovery.clearsContinuityTags = ["recent_breakdown"];
  recovery.emitsContinuityTags = ["recovery_in_progress"];

  const state2 = nextSandboxContinuityState({
    currentTags: state1.continuityTags,
    outcome: recovery,
  });
  assert.deepEqual(state2.continuityTags, ["recovery_in_progress"]);
});

test("turn comparison separates condition, observation and evidence integrity", () => {
  const outcome = outcomeFor({
    setId: "clarity.identification",
    repNumber: 1,
    key: "turn",
  });
  const specialist = specialistCopy(outcome);
  const firstField = Object.keys(specialist)[0];
  specialist[firstField] = { ...specialist[firstField], evidenceStatus: "confounded" };

  const result = compareSandboxTurn({
    sequenceNumber: 1,
    sessionNumber: 1,
    phase,
    setId: outcome.setId,
    repNumber: outcome.repNumber,
    outcome,
    actualInterventionEvent: "none",
    recordedInterventionEvent: "none",
    conditionConformed: true,
    specialistObservations: specialist,
  });

  assert.equal(result.observationExact, true);
  assert.equal(result.evidenceExact, false);
  assert.equal(
    result.capabilityEvidence.find((item) => item.layer === "condition_integrity")?.evidenceClass,
    "supported",
  );
  assert.equal(
    result.capabilityEvidence.find((item) => item.layer === "observation_integrity")?.evidenceClass,
    "supported",
  );
  assert.equal(
    result.capabilityEvidence.find((item) => item.layer === "evidence_integrity")?.evidenceClass,
    "breakdown",
  );
});

function fullClaritySession(specialistWrong = false): SandboxCompletedTurn[] {
  const schema = getDrillSchemaDefinition("training", phase);
  const turns: SandboxCompletedTurn[] = [];
  let sequence = 0;

  for (const set of schema.sets.filter((candidate) => !candidate.modelingOnly)) {
    for (let repNumber = 1; repNumber <= set.reps; repNumber += 1) {
      sequence += 1;
      const canonical = outcomeFor({
        setId: set.setId,
        repNumber,
        key: `${set.setId}.rep${repNumber}.canonical`,
      });
      let specialist = specialistCopy(canonical);
      if (specialistWrong) {
        specialist = Object.fromEntries(
          set.fields.map((baseField) => {
            const field = getFieldDefinitionForRep(set, repNumber - 1, baseField.fieldKey) || baseField;
            const identity = getEvidenceSelectionIdentity({
              mode: "training",
              phase,
              setName: set.setName,
              repIndex: repNumber - 1,
              fieldKey: field.fieldKey,
              optionIndex: 0,
            });
            if (!identity) throw new Error("Missing weak option");
            return [field.fieldKey, { optionId: identity.optionId, evidenceStatus: "observed" as const }];
          }),
        );
      }

      turns.push({
        sequenceNumber: sequence,
        sessionNumber: 1,
        phase,
        setId: set.setId,
        repNumber,
        outcome: canonical,
        actualInterventionEvent: "none",
        recordedInterventionEvent: "none",
        conditionConformed: true,
        specialistObservations: specialist,
      });
    }
  }
  return turns;
}

test("full Sandbox session runs canonical and Specialist records through the real Training authority", () => {
  const aligned = evaluateSandboxCompletedSession({
    phase,
    canonicalPreviousStability: "Low",
    specialistPreviousStability: "Low",
    turns: fullClaritySession(false),
    priorCompletedSessions: 0,
    priorTracksDiverged: false,
  });
  assert.equal(aligned.systemOutcomeMatched, true);
  assert.equal(
    aligned.capabilityEvidence.find((item) => item.layer === "authority_integrity")?.evidenceClass,
    "supported",
  );

  const diverged = evaluateSandboxCompletedSession({
    phase,
    canonicalPreviousStability: "Low",
    specialistPreviousStability: "Low",
    turns: fullClaritySession(true),
    priorCompletedSessions: 1,
    priorTracksDiverged: false,
  });
  assert.equal(diverged.systemOutcomeMatched, false);
  assert.equal(
    diverged.capabilityEvidence.find((item) => item.layer === "continuity_integrity")?.evidenceClass,
    "breakdown",
  );
});

const policy: SandboxCapabilityReadinessPolicy = {
  policyVersion: 1,
  status: "candidate",
  minimumValidOpportunitiesByCapability: Object.fromEntries(
    SANDBOX_CAPABILITY_LAYERS.map((layer) => [layer, 2]),
  ) as SandboxCapabilityReadinessPolicy["minimumValidOpportunitiesByCapability"],
  breadth: {
    minimumDistinctPhases: 4,
    minimumDistinctSets: 8,
    minimumDistinctRepPositions: 16,
    minimumCompletedSessions: 3,
    requireStateChange: true,
    requireBreakdownRecovery: true,
  },
  nextStage: "practicals",
};

function occurrence(
  layer: SandboxCapabilityOccurrence["layer"],
  evidenceClass: SandboxCapabilityOccurrence["evidenceClass"],
  sequenceNumber: number,
): SandboxCapabilityOccurrence {
  return {
    layer,
    evidenceClass,
    sequenceNumber,
    sessionNumber: Math.ceil(sequenceNumber / 3),
    phase,
    setId: "clarity.identification",
    repNumber: ((sequenceNumber - 1) % 3) + 1,
    reason: "test",
  };
}

test("readiness stops at the earliest unsupported Specialist capability", () => {
  const evidence: SandboxCapabilityOccurrence[] = [];
  for (const layer of SANDBOX_CAPABILITY_LAYERS) {
    evidence.push(occurrence(layer, "supported", 1), occurrence(layer, "supported", 2));
  }
  evidence.splice(
    evidence.findIndex((item) => item.layer === "observation_integrity"),
    2,
    occurrence("observation_integrity", "breakdown", 1),
    occurrence("observation_integrity", "supported", 2),
  );

  const result = evaluateSandboxCapabilityReadiness({
    policy,
    evidence,
    exposure: {
      distinctPhases: 4,
      distinctSets: 8,
      distinctRepPositions: 16,
      completedSessions: 3,
      stateChangeObserved: true,
      breakdownRecoveryObserved: true,
    },
  });

  assert.equal(result.earliestUnsupportedCapability, "observation_integrity");
  assert.equal(result.evidenceReady, false);
  assert.equal(
    result.layers.find((item) => item.layer === "evidence_integrity")?.authoritative,
    false,
  );
});

test("a real Specialist capability breakdown requires a stronger clean recovery suffix", () => {
  const evidence: SandboxCapabilityOccurrence[] = [];
  for (const layer of SANDBOX_CAPABILITY_LAYERS) {
    if (layer === "observation_integrity") {
      evidence.push(
        occurrence(layer, "breakdown", 1),
        occurrence(layer, "supported", 2),
        occurrence(layer, "supported", 3),
        occurrence(layer, "supported", 4),
      );
    } else {
      evidence.push(occurrence(layer, "supported", 1), occurrence(layer, "supported", 2));
    }
  }

  const result = evaluateSandboxCapabilityReadiness({
    policy,
    evidence,
    exposure: {
      distinctPhases: 4,
      distinctSets: 8,
      distinctRepPositions: 16,
      completedSessions: 3,
      stateChangeObserved: true,
      breakdownRecoveryObserved: true,
    },
  });

  assert.equal(result.earliestUnsupportedCapability, null);
  assert.equal(result.evidenceReady, true);
  assert.equal(result.practicalsReady, false);
  assert.match(result.reason, /candidate capability standard/i);
});
