import type { TopicPhase } from "./topicConditioningEngine";
import type { TrainingDimensionId } from "./trainingEvidenceContract";
import type { TrainingEvidenceStatus } from "./trainingEvidenceCapture";
import type { TrainingDecisionEvidenceClass } from "./trainingObservationContractV2";
import type { ResponseEvidenceClass } from "./responseEvidenceModel";

export type LegacyStatefulSandboxObservationAudit = {
  evidenceClass: TrainingDecisionEvidenceClass;
  evidenceStatus: TrainingEvidenceStatus;
  behavior: string;
};

export type LegacyStatefulSandboxPatternAudit = {
  trajectoryClass: ResponseEvidenceClass;
  observations: Partial<
    Record<TrainingDimensionId, LegacyStatefulSandboxObservationAudit>
  >;
};

const observed = (
  evidenceClass: TrainingDecisionEvidenceClass,
  behavior: string,
): LegacyStatefulSandboxObservationAudit => ({
  evidenceClass,
  evidenceStatus: "observed",
  behavior,
});

const notObserved = (
  evidenceClass: TrainingDecisionEvidenceClass,
  behavior: string,
): LegacyStatefulSandboxObservationAudit => ({
  evidenceClass,
  evidenceStatus: "not_observed",
  behavior,
});

const confounded = (
  evidenceClass: TrainingDecisionEvidenceClass,
  behavior: string,
): LegacyStatefulSandboxObservationAudit => ({
  evidenceClass,
  evidenceStatus: "confounded",
  behavior,
});

export const LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER: Record<
  TopicPhase,
  TrainingDimensionId[]
> = {
  Clarity: [
    "clarity.vocabulary",
    "clarity.method",
    "clarity.reason",
    "clarity.immediate_apply",
  ],
  "Structured Execution": [
    "execution.start",
    "execution.step_discipline",
    "execution.repeatability",
    "execution.independence",
  ],
  "Controlled Discomfort": [
    "difficulty.initial_response",
    "difficulty.first_step_control",
    "difficulty.tolerance",
    "difficulty.rescue_dependence",
  ],
  "Time Pressure Stability": [
    "time.start",
    "time.structure",
    "time.pace",
    "time.completion_integrity",
  ],
};

export const LEGACY_STATEFUL_SANDBOX_V1_SCENARIO_TRUTH_AUDIT: Record<
  TopicPhase,
  Record<number, LegacyStatefulSandboxPatternAudit>
> = {
  Clarity: {
    1: {
      trajectoryClass: "supported",
      observations: {
        "clarity.vocabulary": observed(
          "supported",
          "The student identifies the important mathematical terms and symbols accurately.",
        ),
        "clarity.method": observed(
          "supported",
          "They select the correct method cleanly without being given it.",
        ),
        "clarity.reason": observed(
          "supported",
          "They clearly explain why that method fits the problem.",
        ),
        "clarity.immediate_apply": observed(
          "supported",
          "They engage independently and appropriately from that understanding.",
        ),
      },
    },
    2: {
      trajectoryClass: "near_stable",
      observations: {
        "clarity.vocabulary": observed(
          "supported",
          "The student identifies the important mathematical terms and symbols accurately.",
        ),
        "clarity.method": observed(
          "supported",
          "They select the correct method cleanly without being given it.",
        ),
        "clarity.reason": observed(
          "near_stable",
          "Their explanation is substantially correct but contains one small decision-relevant gap or imprecision.",
        ),
        "clarity.immediate_apply": observed(
          "supported",
          "They engage independently and appropriately from that understanding.",
        ),
      },
    },
    3: {
      trajectoryClass: "conditional",
      observations: {
        "clarity.vocabulary": observed(
          "conditional",
          "The student identifies only fragments of the important mathematical terms and misses decision-relevant vocabulary.",
        ),
        "clarity.method": observed(
          "conditional",
          "They move between plausible methods without a clear basis for selecting one.",
        ),
        "clarity.reason": observed(
          "conditional",
          "They give a partly relevant reason, but the logic remains incomplete.",
        ),
        "clarity.immediate_apply": observed(
          "conditional",
          "They engage only after extended uncertainty and wavering.",
        ),
      },
    },
    4: {
      trajectoryClass: "conditional",
      observations: {
        "clarity.vocabulary": observed(
          "conditional",
          "The student misses important mathematical terms even though some vocabulary is correct.",
        ),
        "clarity.method": observed(
          "supported",
          "They nevertheless select the correct method cleanly without being given it.",
        ),
        "clarity.reason": observed(
          "conditional",
          "They give a partly relevant reason, but the explanation cannot yet justify the method reliably.",
        ),
        "clarity.immediate_apply": observed(
          "supported",
          "They engage independently and appropriately once they have chosen the method.",
        ),
      },
    },
    5: {
      trajectoryClass: "conditional",
      observations: {
        "clarity.vocabulary": observed(
          "conditional",
          "The student recognises fragments of the important mathematical terms but misses decision-relevant vocabulary.",
        ),
        "clarity.method": observed(
          "conditional",
          "They propose a plausible method, then waver between approaches without a reliable basis.",
        ),
        "clarity.reason": observed(
          "conditional",
          "They offer some relevant reasoning, but the logic remains incomplete and unreliable.",
        ),
        "clarity.immediate_apply": observed(
          "conditional",
          "They begin only after extended uncertainty and continue wavering.",
        ),
      },
    },
    6: {
      trajectoryClass: "breakdown",
      observations: {
        "clarity.vocabulary": observed(
          "breakdown",
          "The student cannot identify the important mathematical terms or symbols.",
        ),
        "clarity.method": observed(
          "breakdown",
          "They cannot identify a relevant method without it being supplied.",
        ),
        "clarity.reason": observed(
          "breakdown",
          "They cannot give a relevant reason connecting the problem structure to a method.",
        ),
        "clarity.immediate_apply": observed(
          "breakdown",
          "They cannot engage with the problem from their own understanding.",
        ),
      },
    },
    7: {
      trajectoryClass: "not_observed",
      observations: {
        "clarity.vocabulary": observed(
          "supported",
          "The student identifies the important mathematical terms and symbols accurately.",
        ),
        "clarity.method": observed(
          "supported",
          "They select the correct method cleanly without being given it.",
        ),
        "clarity.reason": notObserved(
          "supported",
          "The opportunity ends before the student is able to explain why the method fits, so reason evidence is not meaningfully observed.",
        ),
        "clarity.immediate_apply": observed(
          "supported",
          "Before the interruption, they engage independently and appropriately from their understanding.",
        ),
      },
    },
    8: {
      trajectoryClass: "confounded",
      observations: {
        "clarity.vocabulary": observed(
          "supported",
          "The student identifies the important mathematical terms and symbols accurately.",
        ),
        "clarity.method": confounded(
          "supported",
          "Before they commit to a method, an external cue names the method, so their method-recognition evidence cannot be interpreted cleanly.",
        ),
        "clarity.reason": observed(
          "supported",
          "They then independently explain clearly why that method fits the problem.",
        ),
        "clarity.immediate_apply": observed(
          "supported",
          "They engage independently and appropriately from the understanding they can still demonstrate.",
        ),
      },
    },
  },
  "Structured Execution": {
    1: {
      trajectoryClass: "supported",
      observations: {
        "execution.start": observed(
          "supported",
          "The student produces a valid first execution move independently.",
        ),
        "execution.step_discipline": observed(
          "supported",
          "They maintain the intended method structure throughout the work.",
        ),
        "execution.repeatability": observed(
          "supported",
          "The method repeats cleanly against the earlier comparable opportunity.",
        ),
        "execution.independence": observed(
          "supported",
          "They work throughout without seeking rescue or confirmation.",
        ),
      },
    },
    2: {
      trajectoryClass: "near_stable",
      observations: {
        "execution.start": observed(
          "near_stable",
          "The student produces a valid first move after noticeable hesitation.",
        ),
        "execution.step_discipline": observed(
          "near_stable",
          "The method structure mostly holds with only a small sequencing drift that they self-correct.",
        ),
        "execution.repeatability": observed(
          "near_stable",
          "The method repeats with only minor drift compared with the earlier comparable opportunity.",
        ),
        "execution.independence": observed(
          "supported",
          "They continue independently without seeking rescue or confirmation.",
        ),
      },
    },
    3: {
      trajectoryClass: "conditional",
      observations: {
        "execution.start": observed(
          "supported",
          "The student begins with a valid method-aligned first move.",
        ),
        "execution.step_discipline": observed(
          "conditional",
          "Important steps drift or are lost even though some method structure remains.",
        ),
        "execution.repeatability": observed(
          "conditional",
          "The method repeats only inconsistently compared with the earlier comparable opportunity.",
        ),
        "execution.independence": observed(
          "near_stable",
          "They work independently first, then briefly seek confirmation before continuing.",
        ),
      },
    },
    4: {
      trajectoryClass: "conditional",
      observations: {
        "execution.start": observed(
          "conditional",
          "The student starts with a guessing or structurally unrelated first move.",
        ),
        "execution.step_discipline": observed(
          "conditional",
          "They recover some method structure, but important steps continue to drift.",
        ),
        "execution.repeatability": observed(
          "conditional",
          "The method repeats only inconsistently against the earlier comparable opportunity.",
        ),
        "execution.independence": observed(
          "conditional",
          "They repeatedly seek help before making enough meaningful independent progress.",
        ),
      },
    },
    5: {
      trajectoryClass: "breakdown",
      observations: {
        "execution.start": observed(
          "conditional",
          "The student begins with a guessing or structurally unrelated first move.",
        ),
        "execution.step_discipline": observed(
          "conditional",
          "Some method structure appears, but important steps repeatedly drift or are lost.",
        ),
        "execution.repeatability": observed(
          "breakdown",
          "The method that had appeared earlier breaks on this repeat opportunity.",
        ),
        "execution.independence": observed(
          "conditional",
          "They repeatedly seek help before enough meaningful independent work occurs.",
        ),
      },
    },
    6: {
      trajectoryClass: "breakdown",
      observations: {
        "execution.start": observed(
          "breakdown",
          "The student waits for help or cannot produce a usable first execution move.",
        ),
        "execution.step_discipline": observed(
          "breakdown",
          "Working becomes random or disconnected from the known method structure.",
        ),
        "execution.repeatability": observed(
          "breakdown",
          "The earlier method pattern does not repeat on this opportunity.",
        ),
        "execution.independence": observed(
          "breakdown",
          "They will not continue without the Specialist carrying the execution.",
        ),
      },
    },
    7: {
      trajectoryClass: "not_observed",
      observations: {
        "execution.start": observed(
          "supported",
          "The student produces a valid first execution move independently.",
        ),
        "execution.step_discipline": observed(
          "supported",
          "They maintain the intended method structure throughout the visible work.",
        ),
        "execution.repeatability": notObserved(
          "supported",
          "There is no valid comparable prior opportunity available for this rep, so repeatability cannot be meaningfully observed.",
        ),
        "execution.independence": observed(
          "supported",
          "They work throughout without seeking rescue or confirmation.",
        ),
      },
    },
    8: {
      trajectoryClass: "confounded",
      observations: {
        "execution.start": observed(
          "supported",
          "The student produces a valid first execution move independently.",
        ),
        "execution.step_discipline": confounded(
          "supported",
          "Midway through the attempt, the problem display changes the required step sequence, so step-discipline evidence cannot be interpreted cleanly.",
        ),
        "execution.repeatability": observed(
          "supported",
          "Outside that changed segment, the method repeats cleanly against the earlier comparable opportunity.",
        ),
        "execution.independence": observed(
          "supported",
          "They continue without seeking rescue or confirmation.",
        ),
      },
    },
  },
  "Controlled Discomfort": {
    1: {
      trajectoryClass: "supported",
      observations: {
        "difficulty.initial_response": observed(
          "supported",
          "When the work becomes meaningfully difficult, the student attempts without losing behavioral control.",
        ),
        "difficulty.first_step_control": observed(
          "supported",
          "They produce a controlled valid first mathematical step independently.",
        ),
        "difficulty.tolerance": observed(
          "supported",
          "They stay engaged and recover independently when stuck.",
        ),
        "difficulty.rescue_dependence": observed(
          "supported",
          "They continue without requesting rescue.",
        ),
      },
    },
    2: {
      trajectoryClass: "near_stable",
      observations: {
        "difficulty.initial_response": observed(
          "near_stable",
          "The student briefly hesitates when difficulty rises, then makes a controlled attempt.",
        ),
        "difficulty.first_step_control": observed(
          "supported",
          "They produce a controlled valid first mathematical step independently.",
        ),
        "difficulty.tolerance": observed(
          "near_stable",
          "They remain engaged and recover, but with visible instability.",
        ),
        "difficulty.rescue_dependence": observed(
          "supported",
          "They continue without requesting rescue.",
        ),
      },
    },
    3: {
      trajectoryClass: "conditional",
      observations: {
        "difficulty.initial_response": observed(
          "near_stable",
          "The student briefly hesitates when difficulty rises, then attempts.",
        ),
        "difficulty.first_step_control": observed(
          "conditional",
          "Their first mathematical move is guessing or materially unstable.",
        ),
        "difficulty.tolerance": observed(
          "near_stable",
          "They stay engaged and partly recover, but visible instability remains.",
        ),
        "difficulty.rescue_dependence": observed(
          "near_stable",
          "They make a meaningful independent attempt before briefly seeking confirmation.",
        ),
      },
    },
    4: {
      trajectoryClass: "breakdown",
      observations: {
        "difficulty.initial_response": observed(
          "breakdown",
          "At first contact with difficulty, the student freezes and productive engagement stops.",
        ),
        "difficulty.first_step_control": observed(
          "supported",
          "After re-entering the task on their own, they produce a controlled valid first mathematical step.",
        ),
        "difficulty.tolerance": observed(
          "conditional",
          "They stay with the difficult work only briefly before engagement breaks again.",
        ),
        "difficulty.rescue_dependence": observed(
          "supported",
          "They do not request rescue while attempting to re-engage.",
        ),
      },
    },
    5: {
      trajectoryClass: "breakdown",
      observations: {
        "difficulty.initial_response": observed(
          "breakdown",
          "At first contact with difficulty, the student freezes or withdraws from the task.",
        ),
        "difficulty.first_step_control": observed(
          "conditional",
          "When they re-enter, their first mathematical move is guessing or materially unstable.",
        ),
        "difficulty.tolerance": observed(
          "breakdown",
          "They repeatedly lose engagement and cannot recover productive contact with the difficulty.",
        ),
        "difficulty.rescue_dependence": observed(
          "conditional",
          "They seek help repeatedly before a meaningful independent attempt is established.",
        ),
      },
    },
    6: {
      trajectoryClass: "breakdown",
      observations: {
        "difficulty.initial_response": observed(
          "breakdown",
          "The student freezes, withdraws, or gives up immediately when difficulty appears.",
        ),
        "difficulty.first_step_control": observed(
          "breakdown",
          "They cannot produce a controlled first mathematical step.",
        ),
        "difficulty.tolerance": observed(
          "breakdown",
          "They cannot remain productively engaged or recover from the difficult point.",
        ),
        "difficulty.rescue_dependence": observed(
          "breakdown",
          "They request rescue immediately or refuse to continue without help.",
        ),
      },
    },
    7: {
      trajectoryClass: "not_observed",
      observations: {
        "difficulty.initial_response": observed(
          "supported",
          "The student meets the difficult work with a controlled attempt.",
        ),
        "difficulty.first_step_control": observed(
          "supported",
          "They produce a controlled valid first mathematical step independently.",
        ),
        "difficulty.tolerance": notObserved(
          "supported",
          "The opportunity ends before enough sustained difficult work occurs to observe whether tolerance and recovery would hold.",
        ),
        "difficulty.rescue_dependence": observed(
          "supported",
          "At the meaningful stuck point that is visible, they retain responsibility and do not request rescue.",
        ),
      },
    },
    8: {
      trajectoryClass: "confounded",
      observations: {
        "difficulty.initial_response": observed(
          "supported",
          "The student meets the difficult work with a controlled attempt.",
        ),
        "difficulty.first_step_control": confounded(
          "supported",
          "Before the first mathematical move, an external hint appears, so first-step control cannot be interpreted cleanly.",
        ),
        "difficulty.tolerance": observed(
          "supported",
          "After that event, they stay engaged and recover independently when stuck.",
        ),
        "difficulty.rescue_dependence": observed(
          "supported",
          "They continue without requesting rescue.",
        ),
      },
    },
  },
  "Time Pressure Stability": {
    1: {
      trajectoryClass: "supported",
      observations: {
        "time.start": observed(
          "supported",
          "With the timer active, the student starts promptly with a valid structured first move.",
        ),
        "time.structure": observed(
          "supported",
          "They maintain the method structure throughout the timed work.",
        ),
        "time.pace": observed(
          "supported",
          "They regulate pace deliberately without uncontrolled rushing.",
        ),
        "time.completion_integrity": observed(
          "supported",
          "They complete while preserving the method structure.",
        ),
      },
    },
    2: {
      trajectoryClass: "near_stable",
      observations: {
        "time.start": observed(
          "near_stable",
          "The student produces a valid timed start with visible timer-related hesitation.",
        ),
        "time.structure": observed(
          "supported",
          "They maintain the method structure throughout the timed work.",
        ),
        "time.pace": observed(
          "near_stable",
          "They become slightly rushed but retain overall pace control.",
        ),
        "time.completion_integrity": observed(
          "supported",
          "They complete while preserving the method structure.",
        ),
      },
    },
    3: {
      trajectoryClass: "conditional",
      observations: {
        "time.start": observed(
          "near_stable",
          "The student produces a valid timed start with visible timer-related hesitation.",
        ),
        "time.structure": observed(
          "conditional",
          "Important parts of the method drift under time even though some structure remains.",
        ),
        "time.pace": observed(
          "near_stable",
          "They become slightly rushed but retain overall pace control.",
        ),
        "time.completion_integrity": observed(
          "conditional",
          "They finish only partly or complete with material structure loss.",
        ),
      },
    },
    4: {
      trajectoryClass: "conditional",
      observations: {
        "time.start": observed(
          "conditional",
          "The timer causes a late or disordered first move before the student settles.",
        ),
        "time.structure": observed(
          "conditional",
          "Important parts of the method drift under time even though some structure remains.",
        ),
        "time.pace": observed(
          "near_stable",
          "They become slightly rushed but retain overall pace control.",
        ),
        "time.completion_integrity": observed(
          "conditional",
          "They finish only partly or complete with material structure loss.",
        ),
      },
    },
    5: {
      trajectoryClass: "breakdown",
      observations: {
        "time.start": observed(
          "conditional",
          "The timer causes a late or disordered first move.",
        ),
        "time.structure": observed(
          "conditional",
          "Important parts of the method drift under time even though some structure remains.",
        ),
        "time.pace": observed(
          "breakdown",
          "Panic or uncontrolled rushing drives the response.",
        ),
        "time.completion_integrity": observed(
          "conditional",
          "They finish only partly or complete with material structure loss.",
        ),
      },
    },
    6: {
      trajectoryClass: "breakdown",
      observations: {
        "time.start": observed(
          "breakdown",
          "The student freezes, panics, or cannot begin under the active timer.",
        ),
        "time.structure": observed(
          "breakdown",
          "Method structure collapses under the timed condition.",
        ),
        "time.pace": observed(
          "breakdown",
          "Panic or uncontrolled rushing drives the response.",
        ),
        "time.completion_integrity": observed(
          "breakdown",
          "They cannot complete with a usable method structure under time.",
        ),
      },
    },
    7: {
      trajectoryClass: "not_observed",
      observations: {
        "time.start": observed(
          "supported",
          "The student starts promptly with a valid structured first move under the active timer.",
        ),
        "time.structure": observed(
          "supported",
          "They maintain the method structure throughout the visible timed work.",
        ),
        "time.pace": notObserved(
          "supported",
          "A video or telemetry gap hides the rate of work through the timed middle, so pace regulation is not meaningfully observed.",
        ),
        "time.completion_integrity": observed(
          "supported",
          "They complete while preserving the method structure.",
        ),
      },
    },
    8: {
      trajectoryClass: "confounded",
      observations: {
        "time.start": observed(
          "supported",
          "The student starts promptly with a valid structured first move under the active timer.",
        ),
        "time.structure": confounded(
          "supported",
          "Midway through the timed attempt, the problem display changes the required step order, so structure-under-time evidence cannot be interpreted cleanly.",
        ),
        "time.pace": observed(
          "supported",
          "They continue at a deliberate, controlled pace.",
        ),
        "time.completion_integrity": observed(
          "supported",
          "They still reach completion without losing control of the final response.",
        ),
      },
    },
  },
};

export const legacyStatefulSandboxV1PatternNumber = (outcomeKey: string) => {
  const match = String(outcomeKey || "").match(/\.pattern_(\d+)$/);
  return Number(match?.[1] || 0);
};

export function getLegacyStatefulSandboxV1ScenarioTruthAudit(input: {
  phase: TopicPhase;
  outcomeKey: string;
}): LegacyStatefulSandboxPatternAudit | null {
  const patternNumber = legacyStatefulSandboxV1PatternNumber(input.outcomeKey);
  if (!patternNumber) return null;
  return (
    LEGACY_STATEFUL_SANDBOX_V1_SCENARIO_TRUTH_AUDIT[input.phase]?.[
      patternNumber
    ] || null
  );
}

export function renderLegacyStatefulSandboxV1StudentBehavior(input: {
  phase: TopicPhase;
  outcomeKey: string;
  repNumber: number;
  repCount: number;
}): string | null {
  const audit = getLegacyStatefulSandboxV1ScenarioTruthAudit(input);
  if (!audit) return null;
  const dimensions = LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER[input.phase];
  const sentences = dimensions.map((dimensionId) => {
    const observation = audit.observations[dimensionId];
    if (!observation) {
      throw new Error(
        `Sandbox V1 scenario-truth audit is missing ${input.phase} / ${input.outcomeKey} / ${dimensionId}.`,
      );
    }
    return observation.behavior;
  });
  return [
    ...sentences,
    `This is opportunity ${input.repNumber} of ${input.repCount} in the current set.`,
  ].join(" ");
}

export function validateLegacyStatefulSandboxV1ScenarioTruthAudit() {
  for (const [phase, dimensions] of Object.entries(
    LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER,
  ) as Array<[TopicPhase, TrainingDimensionId[]]>) {
    const patterns = LEGACY_STATEFUL_SANDBOX_V1_SCENARIO_TRUTH_AUDIT[phase];
    for (let patternNumber = 1; patternNumber <= 8; patternNumber += 1) {
      const pattern = patterns[patternNumber];
      if (!pattern) {
        throw new Error(
          `Sandbox V1 scenario-truth audit is missing ${phase} pattern ${patternNumber}.`,
        );
      }
      for (const dimensionId of dimensions) {
        const observation = pattern.observations[dimensionId];
        if (!observation) {
          throw new Error(
            `Sandbox V1 scenario-truth audit is missing ${phase} pattern ${patternNumber} dimension ${dimensionId}.`,
          );
        }
        if (!observation.behavior.trim()) {
          throw new Error(
            `Sandbox V1 scenario-truth audit has empty behavior for ${phase} pattern ${patternNumber} dimension ${dimensionId}.`,
          );
        }
        if (
          observation.evidenceStatus !== "observed" &&
          observation.evidenceStatus !== "not_observed" &&
          observation.evidenceStatus !== "confounded"
        ) {
          throw new Error(
            `Sandbox V1 scenario-truth audit has invalid evidence status for ${phase} pattern ${patternNumber} dimension ${dimensionId}.`,
          );
        }
      }
      const expectedNonObserved =
        pattern.trajectoryClass === "not_observed"
          ? dimensions.filter(
              (dimensionId) =>
                pattern.observations[dimensionId]?.evidenceStatus ===
                "not_observed",
            ).length
          : 0;
      const expectedConfounded =
        pattern.trajectoryClass === "confounded"
          ? dimensions.filter(
              (dimensionId) =>
                pattern.observations[dimensionId]?.evidenceStatus ===
                "confounded",
            ).length
          : 0;
      if (pattern.trajectoryClass === "not_observed" && expectedNonObserved !== 1) {
        throw new Error(
          `Sandbox V1 not-observed pattern must name exactly one unobserved dimension: ${phase} pattern ${patternNumber}.`,
        );
      }
      if (pattern.trajectoryClass === "confounded" && expectedConfounded !== 1) {
        throw new Error(
          `Sandbox V1 confounded pattern must name exactly one confounded dimension: ${phase} pattern ${patternNumber}.`,
        );
      }
    }
  }
  return true;
}

validateLegacyStatefulSandboxV1ScenarioTruthAudit();
