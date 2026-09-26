import type { TopicPhase } from "./topicConditioningEngine";
import type { TrainingDimensionId } from "./trainingEvidenceContract";
import type { TrainingEvidenceStatus } from "./trainingEvidenceCapture";
import type { TrainingDecisionEvidenceClass } from "./trainingObservationContractV2";
import type { ResponseEvidenceClass } from "./responseEvidenceModel";
import { TRAINING_OBSERVATION_MATRIX_V2 } from "./trainingObservationContractV2";
import { TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4 } from "./trainingObservationAuthorityV4";

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

export const LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES: Record<
  TopicPhase,
  Record<number, string>
> = {
  Clarity: {
    1: "The student circles the quantities and symbols they will use, names them correctly, and says which procedure they would use. They link that choice to a feature in the problem, then begin arranging the work straight away without looking to the Specialist.",
    2: "The student quickly points out the important pieces and chooses an appropriate procedure. Their explanation is almost complete but skips one small connection; they continue into the work without needing help.",
    3: "The student names a couple of useful pieces but leaves out another that changes how the problem should be read. They suggest one procedure, hesitate, switch to another, and give a related explanation that never quite connects the choice to the whole problem. After rereading twice, they finally put something down.",
    4: "The student overlooks one important term while describing the problem, yet settles on the appropriate procedure immediately. When asked why, they mention a related rule but do not connect it fully to this case, then continue working without waiting for help.",
    5: "The student points out a few correct features but leaves an important one unnamed. They suggest one procedure, cross it out, mention another, and justify the choice with only one piece of the relationship. After a long pause and another read, they start, stop, and restart.",
    6: "The student names features that do not determine the setup and cannot suggest a workable procedure. When asked what makes any approach fit, they have no answer and remain stuck until someone would have to tell them what to do.",
    7: "The student identifies the important parts, chooses an appropriate procedure, and begins using it without help. Just as the Specialist asks why that procedure fits, the call drops; the explanation is never heard before the opportunity ends.",
    8: "The student identifies the important parts of the problem. Before they answer the question about which procedure to use, an on-screen hint briefly flashes the procedure name; after that, they explain the connection in their own words and begin working without help.",
  },
  "Structured Execution": {
    1: "The student makes a sound opening move and keeps the method in order from one line to the next. They continue without turning to the Specialist for reassurance.",
    2: "The student pauses before a sound opening move, then places one step out of order, notices it, and fixes it. They keep ownership of the rest of the work.",
    3: "The student starts with the expected first move but later skips a needed step and has to backtrack. After doing most of the work alone, they ask once, 'Is this still right?' before continuing.",
    4: "The student opens with an operation that does not belong there, notices the problem, and tries to recover. Several later steps still arrive out of order, and they ask for help more than once before enough work is done.",
    5: "The student begins with a guess and recovers pieces of the expected method after trial and error. The sequence remains patchy and they fall back to repeated requests for help.",
    6: "The student waits without making a usable first move, then writes operations disconnected from the known method. They will not continue unless the Specialist starts carrying the work.",
    7: "The student starts on their own, keeps the visible method in order, and does not ask for help. Nothing in the current rep itself prevents a clean execution observation.",
    8: "The student begins with a sound first move. Halfway through, the problem display refreshes and changes the required order of two steps; they continue on their own after the glitch.",
  },
  "Controlled Discomfort": {
    1: "As soon as the problem becomes unfamiliar, the student stays with it and writes a sensible first move. When they hit a sticking point, they keep trying, adjust their work, and continue without asking the Specialist to take over.",
    2: "The harder part makes the student pause and look back at the problem, but they then put down a sensible first move. They wobble again when stuck, yet recover on their own and never ask to be rescued.",
    3: "The student pauses when the difficulty rises, then puts down a first move that is more of a guess than a plan. They stay with the problem and eventually recover some direction, then ask once whether they are on the right track before continuing.",
    4: "At the first difficult turn the student stops completely and does nothing for several seconds. They restart on their own with a sensible first move and stay with the problem for a short stretch before losing engagement again, without asking the Specialist to solve it.",
    5: "The student freezes as soon as the unfamiliar part appears. When they eventually try something, the first move is shaky and they soon disengage again; they ask for help repeatedly before any sustained independent work develops.",
    6: "The student stops at the first sign of difficulty, says they cannot do it, and produces no usable first move. They do not re-enter the work and immediately ask the Specialist to take over.",
    7: "The student meets the difficult part with a sensible first move and keeps responsibility for the work. The session is interrupted shortly afterward, before there is enough time to see what they would do if the difficulty persisted.",
    8: "The student remains engaged as the work becomes harder. Before they make their first mathematical move, an external hint appears on screen; after that interruption they keep working, recover from a later stuck point, and do not ask the Specialist to take over.",
  },
  "Time Pressure Stability": {
    1: "When the timer starts, the student begins straight away with a sound first move and keeps the work in the expected order. Their pace stays even through the attempt, and they finish within the limit without dropping the method.",
    2: "The timer makes the student pause briefly before a sound first move. They keep the sequence intact, speed up a little near the middle without losing control, and still finish with the method intact.",
    3: "The student hesitates briefly at the start, then gets moving with a usable first line. As the clock runs down, a couple of important steps are skipped or compressed; the pace becomes a little rushed, and the final answer is reached with some of the method missing.",
    4: "The student loses several seconds watching the timer and begins with a messy first line before settling. Important parts of the sequence continue to slip, although the pace becomes steadier later; they reach the end only with noticeable pieces of the method missing.",
    5: "The student starts late and the first line is disordered. As the timer drops, they rush through the work, skip steps, make avoidable errors, and reach only part of the solution before time expires.",
    6: "The timer starts and the student freezes, then begins scribbling disconnected work in a rush. The sequence disappears, the pace becomes frantic, and the attempt ends without a usable completion.",
    7: "The student starts promptly, keeps the expected sequence, and reaches the end with the method intact. A video freeze hides most of the middle of the timed attempt, so the rate at which they worked through that section cannot be seen.",
    8: "The student starts promptly and works at a steady rate. Midway through the timed attempt, the problem display refreshes and changes the required step order; after the glitch they continue calmly and finish the remaining work in the new displayed order.",
  },
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

export const LEGACY_STATEFUL_SANDBOX_V1_SET_SPECIFIC_VIGNETTES: Record<
  string,
  Record<number, string>
> = {
  "clarity.identification": {
    1: "The student names the important quantities and symbols, chooses an appropriate procedure, and explains the feature in the problem that makes that procedure fit.",
    2: "The student identifies the important pieces and chooses an appropriate procedure quickly. Their explanation is almost complete but skips one small connection.",
    3: "The student names a couple of useful pieces but leaves out another that changes how the problem should be read. They suggest one procedure, hesitate, switch to another, and give a related explanation that never quite connects the choice to the whole problem.",
    4: "The student overlooks one important term while describing the problem, yet settles on the appropriate procedure immediately. When asked why, they mention a related rule but do not connect it fully to this case.",
    5: "The student points out a few correct features but leaves an important one unnamed. They suggest one procedure, cross it out, mention another, and justify the choice with only one piece of the relationship.",
    6: "The student names features that do not determine the setup, cannot suggest a workable procedure, and has no answer when asked what makes any approach fit.",
    7: "The student identifies the important parts and chooses an appropriate procedure. Just as the Specialist asks why that procedure fits, the call drops and the explanation is never heard.",
    8: "The student identifies the important parts of the problem. Before they answer which procedure they would use, an on-screen hint briefly flashes the procedure name; afterward they explain the connection in their own words.",
  },
};

export const LEGACY_STATEFUL_SANDBOX_V1_REQUIRED_STRUCTURE_STEP_PLAN_AUDIT: Record<
  number,
  LegacyStatefulSandboxObservationAudit
> = {
  1: observed(
    "supported",
    "Before touching the calculation, the student states the sequence they intend to use, including every necessary step in the right order.",
  ),
  2: observed(
    "near_stable",
    "Before solving, the student states the whole sequence but swaps two adjacent steps, notices the issue, and corrects the order.",
  ),
  3: observed(
    "conditional",
    "Before solving, the student names several useful steps but leaves out one the method needs.",
  ),
  4: observed(
    "conditional",
    "Before solving, the student gives a sequence but places a major operation in the wrong position.",
  ),
  5: observed(
    "conditional",
    "Before solving, the student begins listing a plan, stops halfway, and cannot account for the missing middle step.",
  ),
  6: observed(
    "breakdown",
    "Before solving, the student cannot produce a usable sequence and waits for someone else to supply the plan.",
  ),
  7: observed(
    "supported",
    "Before solving, the student states the intended sequence completely and in the right order.",
  ),
  8: confounded(
    "supported",
    "As the student starts to state the plan, an on-screen note flashes the step sequence before their own plan can be heard cleanly.",
  ),
};

const LEGACY_STATEFUL_SANDBOX_V1_EXECUTION_REPEATABILITY_CLAUSES: Record<
  number,
  string
> = {
  1: "Compared with the preceding rep in this set, the same method pattern appears again without meaningful drift.",
  2: "Compared with the preceding rep, the same method appears again with one small wobble that the student corrects.",
  3: "Compared with the preceding rep, some of the method returns but the execution pattern does not hold consistently.",
  4: "Compared with the preceding rep, the method returns only in pieces and the sequence changes materially.",
  5: "The method that appeared earlier in the set does not reproduce on this rep.",
  6: "The earlier execution pattern is absent on this rep.",
  7: "The preceding comparable rep cannot be reviewed because its work disappeared after a connection refresh, so this rep cannot be compared cleanly.",
  8: "Outside the display glitch, the parts that remain comparable follow the same method pattern as the preceding rep.",
};

export const getLegacyStatefulSandboxV1RequiredStructureStepPlanAudit = (
  outcomeKey: string,
): LegacyStatefulSandboxObservationAudit | null => {
  const patternNumber = legacyStatefulSandboxV1PatternNumber(outcomeKey);
  return (
    LEGACY_STATEFUL_SANDBOX_V1_REQUIRED_STRUCTURE_STEP_PLAN_AUDIT[
      patternNumber
    ] || null
  );
};

const setIdFromOutcomeKey = (outcomeKey: string) =>
  String(outcomeKey || "").replace(/\.rep_\d+\.pattern_\d+$/, "");

export function renderLegacyStatefulSandboxV1StudentBehavior(input: {
  phase: TopicPhase;
  setId?: string;
  outcomeKey: string;
  repNumber: number;
  repCount: number;
}): string | null {
  const patternNumber = legacyStatefulSandboxV1PatternNumber(input.outcomeKey);
  const setId = input.setId || setIdFromOutcomeKey(input.outcomeKey);
  const vignette =
    LEGACY_STATEFUL_SANDBOX_V1_SET_SPECIFIC_VIGNETTES[setId]?.[
      patternNumber
    ] ||
    LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES[input.phase]?.[
      patternNumber
    ] ||
    null;
  if (!vignette) return null;

  const additions: string[] = [];
  if (setId === "structured_execution.required_structure") {
    const stepPlan =
      LEGACY_STATEFUL_SANDBOX_V1_REQUIRED_STRUCTURE_STEP_PLAN_AUDIT[
        patternNumber
      ];
    if (!stepPlan) return null;
    additions.push(stepPlan.behavior);
  }
  if (
    input.phase === "Structured Execution" &&
    input.repNumber > 1
  ) {
    const comparison =
      LEGACY_STATEFUL_SANDBOX_V1_EXECUTION_REPEATABILITY_CLAUSES[
        patternNumber
      ];
    if (!comparison) return null;
    additions.push(comparison);
  }

  return [
    vignette,
    ...additions,
    `This is opportunity ${input.repNumber} of ${input.repCount} in the current set.`,
  ].join(" ");
}

const normalizeLeakageText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sentenceCount = (value: string) =>
  String(value || "")
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

const hasSharedRun = (left: string, right: string, runLength = 5) => {
  const a = normalizeLeakageText(left).split(" ").filter(Boolean);
  const b = normalizeLeakageText(right).split(" ").filter(Boolean);
  if (a.length < runLength || b.length < runLength) return false;
  const windows = new Set<string>();
  for (let index = 0; index <= a.length - runLength; index += 1) {
    windows.add(a.slice(index, index + runLength).join(" "));
  }
  for (let index = 0; index <= b.length - runLength; index += 1) {
    if (windows.has(b.slice(index, index + runLength).join(" "))) return true;
  }
  return false;
};

const ANSWER_KEY_JARGON = [
  "breakdown",
  "conditional",
  "near stable",
  "near-stable",
  "supported",
  "decision relevant",
  "decision-relevant",
  "evidence class",
  "not observed",
  "not_observed",
  "confounded",
  "unreliable method",
  "partial understanding",
  "clear vocabulary",
  "method recognition",
];

const validateNaturalVignette = ({
  vignette,
  phase,
  dimensions,
  label,
}: {
  vignette: string;
  phase: TopicPhase;
  dimensions: readonly TrainingDimensionId[];
  label: string;
}) => {
  if (!vignette.trim()) {
    throw new Error(`Sandbox V1 natural vignette is missing ${label}.`);
  }
  if (sentenceCount(vignette) > 3) {
    throw new Error(
      `Sandbox V1 natural vignette over-explains ${label}; use at most three mixed-behavior sentences.`,
    );
  }

  const normalizedVignette = normalizeLeakageText(vignette);
  for (const phrase of ANSWER_KEY_JARGON) {
    if (normalizedVignette.includes(normalizeLeakageText(phrase))) {
      throw new Error(
        `Sandbox V1 natural vignette leaks evaluator language "${phrase}" in ${label}.`,
      );
    }
  }

  for (const dimensionId of dimensions) {
    const definition = TRAINING_OBSERVATION_MATRIX_V2[dimensionId];
    for (const option of definition.options) {
      const normalizedLabel = normalizeLeakageText(option.label);
      const normalizedDetail = normalizeLeakageText(option.detail);
      if (normalizedLabel && normalizedVignette.includes(normalizedLabel)) {
        throw new Error(
          `Sandbox V1 natural vignette copies option label "${option.label}" in ${label}.`,
        );
      }
      if (normalizedDetail && normalizedVignette.includes(normalizedDetail)) {
        throw new Error(
          `Sandbox V1 natural vignette copies evaluator detail for ${dimensionId} in ${label}.`,
        );
      }
      if (
        hasSharedRun(vignette, option.label) ||
        hasSharedRun(vignette, option.detail)
      ) {
        throw new Error(
          `Sandbox V1 natural vignette too closely paraphrases ${dimensionId} evaluator text in ${label}.`,
        );
      }
    }
  }
};

export function validateLegacyStatefulSandboxV1VignetteLeakage() {
  for (const phase of Object.keys(
    LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES,
  ) as TopicPhase[]) {
    const vignettes = LEGACY_STATEFUL_SANDBOX_V1_NATURAL_VIGNETTES[phase];
    for (let patternNumber = 1; patternNumber <= 8; patternNumber += 1) {
      validateNaturalVignette({
        vignette: String(vignettes[patternNumber] || ""),
        phase,
        dimensions: LEGACY_STATEFUL_SANDBOX_V1_DIMENSION_ORDER[phase],
        label: `${phase} pattern ${patternNumber}`,
      });
    }
  }

  for (let patternNumber = 1; patternNumber <= 8; patternNumber += 1) {
    const stepPlan =
      LEGACY_STATEFUL_SANDBOX_V1_REQUIRED_STRUCTURE_STEP_PLAN_AUDIT[
        patternNumber
      ];
    if (!stepPlan?.behavior.trim()) {
      throw new Error(
        `Sandbox V1 Required Structure step-plan behavior is missing pattern ${patternNumber}.`,
      );
    }
    const normalizedStepPlan = normalizeLeakageText(stepPlan.behavior);
    for (const option of Object.values(
      TRAINING_CONDITION_OBSERVATION_DEFINITIONS_V4,
    ).flatMap((definition) => definition.options)) {
      if (
        normalizedStepPlan.includes(normalizeLeakageText(option.label)) ||
        hasSharedRun(stepPlan.behavior, option.label) ||
        hasSharedRun(stepPlan.behavior, option.detail)
      ) {
        throw new Error(
          `Sandbox V1 Required Structure step-plan vignette leaks answer-key text in pattern ${patternNumber}.`,
        );
      }
    }
  }

  const clarityIdentificationDimensions = [
    "clarity.vocabulary",
    "clarity.method",
    "clarity.reason",
  ] as const;
  const identificationVignettes =
    LEGACY_STATEFUL_SANDBOX_V1_SET_SPECIFIC_VIGNETTES[
      "clarity.identification"
    ];
  for (let patternNumber = 1; patternNumber <= 8; patternNumber += 1) {
    validateNaturalVignette({
      vignette: String(identificationVignettes[patternNumber] || ""),
      phase: "Clarity",
      dimensions: clarityIdentificationDimensions,
      label: `clarity.identification pattern ${patternNumber}`,
    });
  }

  return true;
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
validateLegacyStatefulSandboxV1VignetteLeakage();
