import test from "node:test";
import assert from "node:assert/strict";
import {
  SANDBOX_CAPABILITY_LAYERS,
  compareSandboxTurn,
  evaluateSandboxCapabilityReadiness,
  evaluateSandboxCompletedSession,
  materializeSandboxTrainingEvidence,
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
  getFieldDefinitionsForRep,
  getRepPurposeId,
  resolveEvidenceSelection,
} from "./responseIntegrityDrillRegistry";
import type { TopicPhase } from "./topicConditioningEngine";
import { SANDBOX_BEHAVIOR_PROFILE_MODEL_VERSION, isSandboxBehaviorTransitionPlausible, resolveSandboxBehaviorProfile, sandboxBehaviorObservableSignatureMultiplier, sandboxBehaviorProfileMultiplier, sandboxBehaviorTransitionMultiplier } from "./sandboxBehaviorProfiles";
import {
  getLegacyStatefulSandboxV1ScenarioTruthAudit,
} from "./statefulSandboxV1ScenarioTruthAudit";

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

test("Sandbox bank V1 observations reconcile by evidence meaning into current Training", () => {
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
    key: "structured_execution.required_structure.rep_1.pattern_4",
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
  assert.equal(current.schemaVersion, 4);
  const projectedStart = projected.canonicalObservations.startBehavior;
  const resolved = resolveEvidenceSelection({
    mode: "training",
    phase: "Structured Execution",
    setId: historicalSet!.setId,
    repIndex: 0,
    fieldKey: "startBehavior",
    optionId: projectedStart.optionId,
    schemaVersion: current.schemaVersion,
  });
  assert.equal(resolved?.evidenceClass, "conditional");
  assert.match(
    resolved?.field.optionLabels?.[resolved.optionIndex] || "",
    /guessing|disordered/i,
  );
  assert.match(projectedStart.optionId, /\.option_2$/);
});

test("Stateful Sandbox V1 Clarity patterns are re-audited instead of blindly preserving drifted option classes", () => {
  const historical = getDrillSchemaDefinitionByVersion("training", "Clarity", 1);
  assert.ok(historical);
  const set = historical!.sets.find(
    (candidate) => candidate.setId === "clarity.identification",
  );
  assert.ok(set);

  const historicalObservation = (
    fieldKey: string,
    optionIndex: number,
  ) => {
    const field = getFieldDefinitionForRep(set!, 0, fieldKey);
    assert.ok(field);
    return {
      optionId: `${getRepPurposeId(set!, 0)}.${field!.dimensionId}.option_${optionIndex + 1}`,
      evidenceStatus: "observed" as const,
    };
  };

  const briefHesitation: SandboxOutcomeDefinition = {
    key: "clarity.identification.rep_1.pattern_2",
    version: 1,
    phase: "Clarity",
    setId: set!.setId,
    repNumber: 1,
    studentBehavior:
      "The student recognises the problem and chooses the right method, but pauses and hedges briefly while explaining it before settling and engaging independently.",
    canonicalObservations: {
      vocabulary: historicalObservation("vocabulary", 1),
      method: historicalObservation("method", 2),
      reason: historicalObservation("reason", 1),
      immediateApply: historicalObservation("immediateApply", 2),
    },
    trajectoryClass: "near_stable",
    weight: 1,
  };

  const projectedHesitation = projectSandboxOutcomeToCurrentTrainingContract(
    briefHesitation,
    1,
  );
  const current = getDrillSchemaDefinition("training", "Clarity");
  const resolveProjected = (
    definition: SandboxOutcomeDefinition,
    fieldKey: string,
  ) =>
    resolveEvidenceSelection({
      mode: "training",
      phase: "Clarity",
      setId: definition.setId,
      repIndex: 0,
      fieldKey,
      optionId: definition.canonicalObservations[fieldKey].optionId,
      schemaVersion: current.schemaVersion,
    });

  assert.equal(
    resolveProjected(projectedHesitation, "vocabulary")?.evidenceClass,
    "supported",
  );
  assert.equal(
    resolveProjected(projectedHesitation, "reason")?.evidenceClass,
    "near_stable",
  );

  const partialUnderstanding: SandboxOutcomeDefinition = {
    ...briefHesitation,
    key: "clarity.identification.rep_1.pattern_3",
    studentBehavior:
      "The student identifies some of what matters, but the method choice and explanation remain uncertain. They can begin only after working through visible doubt.",
    canonicalObservations: {
      vocabulary: historicalObservation("vocabulary", 1),
      method: historicalObservation("method", 1),
      reason: historicalObservation("reason", 2),
      immediateApply: historicalObservation("immediateApply", 1),
    },
    trajectoryClass: "conditional",
  };

  const projectedPartial = projectSandboxOutcomeToCurrentTrainingContract(
    partialUnderstanding,
    1,
  );
  for (const fieldKey of ["vocabulary", "method", "reason"]) {
    assert.equal(
      resolveProjected(projectedPartial, fieldKey)?.evidenceClass,
      "conditional",
      `${fieldKey} must preserve the observable partial/uncertain behavior`,
    );
  }
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      projectedPartial.canonicalObservations,
      "immediateApply",
    ),
    false,
    "Identification must not project Immediate Apply into a no-solving set",
  );
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

test("Sandbox student behavior profile is deterministic and changes phase tendencies without suppressing evidence anomalies", () => {
  const seed = "student-profile-seed";
  const first = resolveSandboxBehaviorProfile(seed);
  const second = resolveSandboxBehaviorProfile(seed);
  assert.equal(first, second);

  const decisionMultipliers = [
    sandboxBehaviorProfileMultiplier({
      seed,
      phase: "Clarity",
      trajectoryClass: "supported",
    }),
    sandboxBehaviorProfileMultiplier({
      seed,
      phase: "Clarity",
      trajectoryClass: "conditional",
    }),
  ];
  assert.ok(decisionMultipliers.some((value) => value !== 1));

  assert.equal(
    sandboxBehaviorProfileMultiplier({
      seed,
      phase: "Clarity",
      trajectoryClass: "not_observed",
    }),
    1,
  );
  assert.equal(
    sandboxBehaviorProfileMultiplier({
      seed,
      phase: "Clarity",
      trajectoryClass: "confounded",
    }),
    1,
  );
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

test("three distinct evidence-native Sandbox sessions establish High, repeatability eligibility, then phase exit", () => {
  let previous = {
    phase: "Clarity" as TopicPhase,
    stability: "Low" as "Low" | "Medium" | "High",
    progressionAuthority: "building" as "building" | "exit_confirmation_eligible" | "transfer_maintenance",
  };

  const expected = [
    { phase: "Clarity", stability: "High", progressionAuthority: "building" },
    { phase: "Clarity", stability: "High", progressionAuthority: "exit_confirmation_eligible" },
    { phase: "Structured Execution", stability: "Low", progressionAuthority: "building" },
  ] as const;

  for (let i = 0; i < expected.length; i += 1) {
    const turns = fullClaritySession().map((turn) => ({
      ...turn,
      sessionNumber: i + 1,
    }));
    const result = evaluateSandboxCompletedSession({
      phase: previous.phase,
      canonicalPreviousStability: previous.stability,
      specialistPreviousStability: previous.stability,
      canonicalPreviousProgressionAuthority: previous.progressionAuthority,
      specialistPreviousProgressionAuthority: previous.progressionAuthority,
      turns,
      priorCompletedSessions: i,
      priorTracksDiverged: false,
    });
    assert.equal(result.systemOutcomeMatched, true);
    assert.deepEqual(result.canonicalNext, expected[i]);
    assert.deepEqual(result.specialistNext, expected[i]);
    assert.equal(
      result.capabilityEvidence.find((item) => item.layer === "continuity_integrity")?.evidenceClass,
      i === 0 ? "not_observed" : "supported",
    );
    previous = result.canonicalNext;
  }
});

test("legacy checkpoint and separated checkpoint give identical held continuity, without false state changes", () => {
  const turns = fullClaritySession();
  const priorSessions = 2;
  const legacy = evaluateSandboxCompletedSession({
    phase: "Clarity",
    canonicalPreviousStability: "High Maintenance",
    specialistPreviousStability: "High Maintenance",
    turns,
    priorCompletedSessions: priorSessions,
    priorTracksDiverged: false,
  });
  const canonical = evaluateSandboxCompletedSession({
    phase: "Clarity",
    canonicalPreviousStability: "High",
    specialistPreviousStability: "High",
    canonicalPreviousProgressionAuthority: "exit_confirmation_eligible",
    specialistPreviousProgressionAuthority: "exit_confirmation_eligible",
    turns,
    priorCompletedSessions: priorSessions,
    priorTracksDiverged: false,
  });
  assert.deepEqual(legacy.canonicalNext, canonical.canonicalNext);
  assert.equal(legacy.systemOutcomeMatched, canonical.systemOutcomeMatched);
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


test("versioned Sandbox behavioural continuity preserves legacy assignments and V1 selection", () => {
  // These V1 seed mappings must not shift when the authored PROFILES array changes.
  assert.equal(SANDBOX_BEHAVIOR_PROFILE_MODEL_VERSION, 1);
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-0"), "uneven_performer");
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-1"), "fast_recovery");
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-2"), "clarity_fragile");
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-3"), "quietly_strong");
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-4"), "pressure_fragile");
  assert.equal(resolveSandboxBehaviorProfile("identity-v1-5"), "reassurance_seeker");

  const supported = outcomeFor({
    setId: "clarity.identification", repNumber: 1, key: "legacy-clean",
    trajectoryClass: "supported",
  });
  const ctx = {
    canonicalPhase: "Clarity" as const,
    canonicalStability: "Low" as const,
    prescribedPhase: "Clarity" as const,
    setId: "clarity.identification",
    repNumber: 1,
    sequenceNumber: 5,
    previousTrajectoryClass: "breakdown" as const,
    continuityTags: ["recent_breakdown"],
  };
  // Already-issued V1 encounters must not acquire a new hidden answer.
  assert.equal(
    selectSandboxOutcome({ seed: "identity-v1-0", outcomes: [supported], context: ctx }).key,
    supported.key,
  );
  assert.equal(
    selectSandboxOutcome({ seed: "identity-v1-0", outcomes: [supported],
      context: { ...ctx, behaviorModelVersion: 1 } }).key,
    supported.key,
  );
});

test("V2 Sandbox cannot erase a breakdown without an observable intermediate response", () => {
  const setId = "clarity.identification";
  const supported = outcomeFor({ setId, repNumber: 1, key: "clean", trajectoryClass: "supported" });
  const nearStable = outcomeFor({ setId, repNumber: 1, key: "self-correction", trajectoryClass: "near_stable" });
  const conditional = outcomeFor({ setId, repNumber: 1, key: "still-dependent", trajectoryClass: "conditional" });
  const confounded = outcomeFor({ setId, repNumber: 1, key: "external-hint", trajectoryClass: "confounded" });
  const unseen = outcomeFor({ setId, repNumber: 1, key: "not-visible", trajectoryClass: "not_observed" });
  const base = {
    canonicalPhase: "Clarity" as const,
    canonicalStability: "Low" as const,
    prescribedPhase: "Clarity" as const,
    setId, repNumber: 1, sequenceNumber: 6,
    behaviorModelVersion: 2 as const,
    previousTrajectoryClass: "breakdown" as const,
    continuityTags: ["recent_breakdown"],
  };
  assert.ok(!isSandboxBehaviorTransitionPlausible({
    previousTrajectoryClass: "breakdown", trajectoryClass: "supported",
  }));
  assert.equal(selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [supported, nearStable], context: base,
  }).key, nearStable.key);
  assert.throws(() => selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [supported], context: base,
  }), /no plausible behavioural continuation/);
  // Unknown evidence is not recovery from an earlier observed breakdown.
  assert.equal(selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [supported, confounded, unseen],
    context: { ...base, previousTrajectoryClass: "confounded" },
  }).trajectoryClass !== "supported", true);
  // A genuinely observed intermediate recovery may precede a clean response.
  assert.equal(selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [supported],
    context: { ...base, previousTrajectoryClass: "near_stable" },
  }).key, supported.key);
  assert.equal(selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [conditional, nearStable],
    context: base,
  }).key, selectSandboxOutcome({
    seed: "identity-v1-1", outcomes: [conditional, nearStable],
    context: base,
  }).key);
});

test("Sandbox V2 profiles bias observable signatures and recovery without fabricating evidence", () => {
  const candidate = (seed: string, phase: TopicPhase, trajectoryClass: SandboxOutcomeDefinition["trajectoryClass"],
    outcomeKey: string, previousTrajectoryClass?: SandboxOutcomeDefinition["trajectoryClass"]) => ({
      seed, phase, trajectoryClass, outcomeKey, previousTrajectoryClass,
    });
  assert.ok(sandboxBehaviorObservableSignatureMultiplier(candidate(
    "identity-v1-5", "Structured Execution", "conditional",
    "structured_execution.required_structure.rep_1.pattern_3",
  )) > 1, "the reassurance seeker should favour authored help-seeking conduct");
  assert.ok(sandboxBehaviorObservableSignatureMultiplier(candidate(
    "identity-v1-4", "Time Pressure Stability", "breakdown",
    "time.pressure.rep_1.pattern_5",
  )) > 1, "pressure fragility must be visible under a timer");
  assert.equal(sandboxBehaviorObservableSignatureMultiplier(candidate(
    "identity-v1-4", "Time Pressure Stability", "confounded",
    "time.pressure.rep_1.pattern_5",
  )), 1, "a confounder is not an actual student trait observation");
  assert.ok(sandboxBehaviorTransitionMultiplier(candidate(
    "identity-v1-1", "Structured Execution", "near_stable",
    "structured_execution.required_structure.rep_1.pattern_2", "breakdown",
  )) > sandboxBehaviorTransitionMultiplier(candidate(
    "identity-v1-1", "Structured Execution", "conditional",
    "structured_execution.required_structure.rep_1.pattern_3", "breakdown",
  )), "fast recovery favours a visible self-correction over remaining dependent");
  assert.ok(sandboxBehaviorTransitionMultiplier(candidate(
    "identity-v1-0", "Clarity", "conditional", "clarity.identification.rep_1.pattern_3", "supported",
  )) > sandboxBehaviorTransitionMultiplier(candidate(
    "identity-v1-0", "Clarity", "supported", "clarity.identification.rep_1.pattern_1", "supported",
  )), "uneven performance should not merely be a lower average score");
});


test("complete Structured Execution Sandbox session respects rep-specific V4 field eligibility", () => {
  const phase = "Structured Execution" as const;
  const schema = getDrillSchemaDefinition("training", phase);
  let seq = 0;
  const turns: SandboxCompletedTurn[] = schema.sets
    .filter(set => !set.modelingOnly)
    .flatMap(set => Array.from({length:set.reps},(_,repIndex) => {
      const canonicalObservations = Object.fromEntries(
        getFieldDefinitionsForRep(set,repIndex).map(field => {
          const optionIndex = field.optionLevels.length - 1;
          const identity = getEvidenceSelectionIdentity({
            mode:"training",phase,setName:set.setName,repIndex,
            fieldKey:field.fieldKey,optionIndex,
          });
          assert.ok(identity, "Missing registered V4 option ID");
          return [field.fieldKey, {optionId:identity.optionId,evidenceStatus:"observed" as const}];
        }),
      );
      const outcome: SandboxOutcomeDefinition = {
        key:`sandbox-v4-regression.${set.setId}.${repIndex + 1}`,
        version:1, phase,setId:set.setId,repNumber:repIndex+1,
        studentBehavior:"The student executes the independently observed response.",
        canonicalObservations, trajectoryClass:"supported",weight:1,
      };
      return {
        sequenceNumber:++seq, sessionNumber:1, phase,setId:set.setId,
        repNumber:repIndex+1,outcome,actualInterventionEvent:"none" as const,
        recordedInterventionEvent:"none" as const,conditionConformed:true,
        specialistObservations:canonicalObservations,
      };
    }));
  const submitted=materializeSandboxTrainingEvidence({phase,turns,source:"canonical"});
  assert.equal(turns.length,9);
  assert.equal(submitted.length,3);
  const firstSet=submitted.find(set => set.setId === "structured_execution.required_structure");
  assert.ok(firstSet);
  assert.equal("repeatability" in firstSet.observations[0],false,
    "Rep 1 cannot require unobserved repeatability");
  assert.ok("repeatability" in firstSet.observations[1],
    "Rep 2 must retain decision-eligible repeatability evidence");
  const result=evaluateSandboxCompletedSession({
    phase,canonicalPreviousStability:"Low",specialistPreviousStability:"Low",
    turns,priorCompletedSessions:0,priorTracksDiverged:false,
  });
  assert.equal(result.systemOutcomeMatched,true);
});


test("all four Training phases evaluate V4 rep-specific Sandbox observations without inventing fields", () => {
  for (const currentPhase of [
    "Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability",
  ] as TopicPhase[]) {
    const schema = getDrillSchemaDefinition("training", currentPhase);
    let sequence=0;
    const turns:SandboxCompletedTurn[] = schema.sets
      .filter(set=>!set.modelingOnly)
      .flatMap(set=>Array.from({length:set.reps},(_,repIndex)=>{
        const canonicalObservations=Object.fromEntries(
          getFieldDefinitionsForRep(set,repIndex).map(field=>{
            const identity=getEvidenceSelectionIdentity({
              mode:"training",phase:currentPhase,setName:set.setName,
              repIndex,fieldKey:field.fieldKey,
              optionIndex:field.optionLevels.length-1,
            });
            assert.ok(identity);
            return [field.fieldKey,{
              optionId:identity.optionId,evidenceStatus:"observed" as const,
            }];
          }),
        );
        const outcome:SandboxOutcomeDefinition={
          key:`all-phases.${currentPhase}.${set.setId}.${repIndex}`,
          version:1,phase:currentPhase,setId:set.setId,repNumber:repIndex+1,
          studentBehavior:"The simulated response is directly observable.",
          canonicalObservations,trajectoryClass:"supported",weight:1,
        };
        return {
          sequenceNumber:++sequence,sessionNumber:1,phase:currentPhase,
          setId:set.setId,repNumber:repIndex+1,
          outcome,actualInterventionEvent:"none" as const,
          recordedInterventionEvent:"none" as const,conditionConformed:true,
          specialistObservations:canonicalObservations,
        };
      }));
    const canonical=materializeSandboxTrainingEvidence({
      phase:currentPhase,turns,source:"canonical",
    });
    const specialist=materializeSandboxTrainingEvidence({
      phase:currentPhase,turns,source:"specialist",
    });
    assert.equal(canonical.length,schema.sets.length);
    assert.deepEqual(canonical,specialist);
    for(const set of canonical){
      const definition=schema.sets.find(item=>item.setId===set.setId);
      assert.ok(definition);
      if(definition.modelingOnly)continue;
      for(let repIndex=0;repIndex<set.observations.length;repIndex++){
        const required=getFieldDefinitionsForRep(definition,repIndex).map(field=>field.fieldKey);
        for(const field of definition.fields){
          assert.equal(field.fieldKey in set.observations[repIndex],
            required.includes(field.fieldKey),
            `Unexpected field ${field.fieldKey} at ${set.setId} rep ${repIndex+1}`);
        }
      }
    }
    const evaluated=evaluateSandboxCompletedSession({
      phase:currentPhase,canonicalPreviousStability:"Low",
      specialistPreviousStability:"Low",turns,
      priorCompletedSessions:0,priorTracksDiverged:false,
    });
    assert.equal(evaluated.systemOutcomeMatched,true,
      currentPhase+" produced divergent authority from identical evidence");
  }
});
