import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

export type DiagnosisDimensionId =
  | "clarity.vocabulary"
  | "clarity.method"
  | "clarity.reason"
  | "clarity.immediate_apply"
  | "execution.start"
  | "execution.step_discipline"
  | "execution.repeatability"
  | "execution.independence"
  | "difficulty.initial_response"
  | "difficulty.first_step_control"
  | "difficulty.tolerance"
  | "difficulty.rescue_dependence"
  | "time.start"
  | "time.structure"
  | "time.pace"
  | "time.completion_integrity";

export type DiagnosisBehaviorClass =
  | "breakdown"
  | "conditional"
  | "near_stable"
  | "supported"
  | "not_observed"
  | "confounded";

export type DiagnosisObservationOption = {
  id: string;
  label: string;
  detail: string;
  behaviorClass: DiagnosisBehaviorClass;
};

export type DiagnosisObservationDimensionDefinition = {
  id: DiagnosisDimensionId;
  phase: TopicPhase;
  label: string;
  observationQuestion: string;
  requiredSupportedObservations: number;
  options: DiagnosisObservationOption[];
};

const option = (
  id: string,
  label: string,
  behaviorClass: DiagnosisBehaviorClass,
  detail: string,
): DiagnosisObservationOption => ({ id, label, behaviorClass, detail });

const commonTail = (
  notObservedDetail: string,
  confoundedDetail = "The behavior cannot be interpreted cleanly because assistance or another condition changed what was being observed.",
): DiagnosisObservationOption[] => [
  option("not_observed", "This was not meaningfully observable", "not_observed", notObservedDetail),
  option("confounded", "The observation was confounded", "confounded", confoundedDetail),
];

const dimension = (
  id: DiagnosisDimensionId,
  phase: TopicPhase,
  label: string,
  observationQuestion: string,
  options: DiagnosisObservationOption[],
  requiredSupportedObservations = 1,
): DiagnosisObservationDimensionDefinition => ({
  id,
  phase,
  label,
  observationQuestion,
  requiredSupportedObservations,
  options,
});

export const DIAGNOSIS_OBSERVATION_MATRIX: Record<
  DiagnosisDimensionId,
  DiagnosisObservationDimensionDefinition
> = {
  "clarity.vocabulary": dimension(
    "clarity.vocabulary",
    "Clarity",
    "Problem vocabulary",
    "What did the student actually show when identifying the mathematical objects, terms, or symbols?",
    [
      option("no_recognition", "Could not identify the important terms or symbols", "breakdown", "The student could not name what was present or named unrelated features."),
      option("fragmented_recognition", "Identified only fragments and missed important terms", "conditional", "Some vocabulary was available, but the problem could not yet be described reliably."),
      option("mostly_accurate_with_imprecision", "Identified the important terms with a small imprecision", "near_stable", "Recognition was substantially present but not completely clean."),
      option("accurate_recognition", "Identified the important terms accurately", "supported", "The student named the decision-relevant mathematical features without help."),
      ...commonTail("The task did not create a fair vocabulary observation, or prior content exposure was too uncertain to interpret the response."),
    ],
  ),
  "clarity.method": dimension(
    "clarity.method",
    "Clarity",
    "Method recognition",
    "What did the student actually do when deciding which method or mathematical approach applies?",
    [
      option("no_method", "Could not identify a relevant method", "breakdown", "No usable method was produced without being supplied."),
      option("guessed_or_competing_methods", "Guessed or moved between methods without a clear basis", "conditional", "A method signal existed, but selection was unstable or speculative."),
      option("correct_but_hesitant", "Selected the correct method after visible uncertainty", "near_stable", "The right method was present, but recognition was not yet automatic or clean."),
      option("correct_method_cleanly", "Selected the correct method cleanly", "supported", "The student independently identified the appropriate method."),
      ...commonTail("The problem did not require a meaningful method choice, or content exposure made the choice uninterpretable."),
    ],
  ),
  "clarity.reason": dimension(
    "clarity.reason",
    "Clarity",
    "Reason for the method",
    "What did the student actually show when explaining why the chosen method fits this problem?",
    [
      option("no_reason", "Could not give a relevant reason", "breakdown", "The student could not connect the problem structure to the method."),
      option("partial_reason", "Gave a partly relevant reason but the logic was incomplete", "conditional", "The explanation contained some correct structure but could not yet justify the method reliably."),
      option("correct_reason_imprecise", "Gave the right reason with a small gap or imprecision", "near_stable", "The causal logic was substantially correct but not fully clean."),
      option("clear_reason", "Explained clearly why the method fits", "supported", "The student connected the problem structure and method without help."),
      ...commonTail("A reason was not meaningfully requested or the student lacked enough content exposure to make the explanation diagnostic."),
    ],
  ),
  "clarity.immediate_apply": dimension(
    "clarity.immediate_apply",
    "Clarity",
    "Immediate use of understanding",
    "Once the problem was understood, what did the student actually do with that understanding?",
    [
      option("cannot_engage", "Could not engage with the problem from their own understanding", "breakdown", "The student avoided, stalled completely, or had no usable response."),
      option("engages_only_after_extended_uncertainty", "Engaged only after extended uncertainty", "conditional", "Understanding was present only conditionally and did not translate reliably into action."),
      option("engages_with_brief_hesitation", "Engaged independently after a brief hesitation", "near_stable", "The response was usable but not yet clean and immediate."),
      option("engages_cleanly", "Engaged independently and appropriately", "supported", "Understanding translated into an appropriate response without support."),
      ...commonTail("The task ended before immediate application could be observed, or the problem did not require it."),
    ],
  ),

  "execution.start": dimension(
    "execution.start",
    "Structured Execution",
    "Independent start",
    "What happened at the first execution move when no method prompt was provided?",
    [
      option("no_start", "Waited for help or could not produce a first move", "breakdown", "Independent execution did not begin."),
      option("guessing_or_disordered_start", "Started by guessing or with a structurally unrelated move", "conditional", "The student acted, but the start did not reliably express the known method."),
      option("valid_start_after_hesitation", "Produced a valid first move after noticeable hesitation", "near_stable", "The start was method-aligned but not yet clean or automatic."),
      option("valid_independent_start", "Produced a valid first move independently", "supported", "Execution began from the correct structure without support."),
      ...commonTail("The opportunity did not require an independent first move, or an earlier intervention removed the cold-start condition."),
    ],
  ),
  "execution.step_discipline": dimension(
    "execution.step_discipline",
    "Structured Execution",
    "Step discipline",
    "What happened to the method structure while the student worked through the problem?",
    [
      option("structure_collapses", "Working became random, structurally broken, or disconnected from the method", "breakdown", "The method structure was not maintained."),
      option("material_step_drift", "Some method structure was present but important steps drifted or were lost", "conditional", "Execution was partly structured but unreliable."),
      option("minor_step_drift", "Structure mostly held with a small sequencing or discipline drift", "near_stable", "The method was substantially maintained but not completely clean."),
      option("structure_maintained", "Maintained the method structure throughout", "supported", "Execution preserved the intended sequence without prompting."),
      ...commonTail("The attempt did not continue far enough to observe step discipline."),
    ],
  ),
  "execution.repeatability": dimension(
    "execution.repeatability",
    "Structured Execution",
    "Execution repeatability",
    "Compared with the earlier comparable opportunity, what happened when the student had to execute the method again?",
    [
      option("repeat_breaks", "The method broke on the repeat opportunity", "breakdown", "The earlier successful execution did not repeat."),
      option("repeat_inconsistent", "The method repeated only inconsistently", "conditional", "Some structure returned, but the execution pattern was not reliable."),
      option("repeat_with_minor_drift", "The method repeated with only minor drift", "near_stable", "Repeatability is substantially present but not yet clean."),
      option("repeat_clean", "The method repeated cleanly without method prompting", "supported", "Independent execution held across the comparison."),
      ...commonTail("There was not yet a valid comparable prior opportunity, so repeatability cannot be claimed."),
    ],
  ),
  "execution.independence": dimension(
    "execution.independence",
    "Structured Execution",
    "Independence",
    "How did the student behave in relation to help while executing?",
    [
      option("waits_for_rescue", "Waited for help or would not continue without it", "breakdown", "The response depended on external carrying."),
      option("frequent_help_seeking", "Repeatedly sought help before meaningful independent work", "conditional", "Some execution was present, but dependence materially shaped the response."),
      option("attempts_then_checks", "Worked independently first, then sought confirmation", "near_stable", "Independence was substantially present but still leaned on reassurance."),
      option("independent_throughout", "Worked independently without seeking rescue", "supported", "The student carried the method without external support."),
      ...commonTail("The attempt ended before help-seeking or independence could be meaningfully observed."),
    ],
  ),

  "difficulty.initial_response": dimension(
    "difficulty.initial_response",
    "Controlled Discomfort",
    "First response to difficulty",
    "What happened immediately when the work became meaningfully difficult or unfamiliar?",
    [
      option("withdraws_or_freezes", "Withdrew, froze, or gave up immediately", "breakdown", "Difficulty stopped productive engagement at first contact."),
      option("avoidant_hesitation", "Hesitated substantially and showed avoidance before attempting", "conditional", "The student remained present but difficulty materially disrupted engagement."),
      option("brief_hesitation_then_attempt", "Briefly hesitated, then made a controlled attempt", "near_stable", "Difficulty was felt but did not fully control the response."),
      option("controlled_attempt", "Attempted without losing behavioral control", "supported", "The student stayed oriented to the problem at first contact with difficulty."),
      ...commonTail("The problem did not become meaningfully difficult for this student, so a difficulty response was not actually tested."),
    ],
  ),
  "difficulty.first_step_control": dimension(
    "difficulty.first_step_control",
    "Controlled Discomfort",
    "First-step control under difficulty",
    "When difficulty was present, what happened to the student's first mathematical move?",
    [
      option("no_controlled_step", "Could not produce a controlled first step", "breakdown", "Difficulty prevented a usable first move."),
      option("unstable_or_guessing_step", "Produced a guessing or materially unstable first step", "conditional", "The student acted, but structure was not sufficiently controlled."),
      option("plausible_step_with_uncertainty", "Produced a plausible first step with visible uncertainty", "near_stable", "Control was substantially present but not fully stable."),
      option("controlled_independent_step", "Produced a controlled valid first step independently", "supported", "The student preserved a method-aligned first move under difficulty."),
      ...commonTail("The problem never created a valid difficult first-step moment, or support was given before it could be observed."),
    ],
  ),
  "difficulty.tolerance": dimension(
    "difficulty.tolerance",
    "Controlled Discomfort",
    "Difficulty tolerance and recovery",
    "Across the difficult part of the attempt, what happened to engagement and recovery?",
    [
      option("exits_difficulty", "Gave up, exited the task, or could not re-engage", "breakdown", "The student could not remain in productive contact with difficulty."),
      option("brief_hold_then_break", "Stayed briefly but then lost engagement or required relief", "conditional", "Tolerance existed for a short window but did not hold."),
      option("holds_with_visible_instability", "Stayed engaged or recovered, but with visible instability", "near_stable", "The student substantially tolerated difficulty but the response was not yet fully stable."),
      option("holds_and_recovers", "Stayed engaged and recovered independently when stuck", "supported", "The student remained productively engaged through difficulty."),
      ...commonTail("The task did not create enough sustained difficulty to observe tolerance or recovery."),
    ],
    2,
  ),
  "difficulty.rescue_dependence": dimension(
    "difficulty.rescue_dependence",
    "Controlled Discomfort",
    "Rescue dependence",
    "When the student became stuck or uncomfortable, what did they actually do about help?",
    [
      option("immediate_rescue", "Requested rescue immediately or refused to continue without help", "breakdown", "Difficulty immediately transferred responsibility to the Specialist."),
      option("early_repeated_rescue", "Sought help repeatedly before a meaningful independent attempt", "conditional", "Some persistence existed, but rescue dependence still shaped the response."),
      option("meaningful_attempt_then_checks", "Made a meaningful attempt before seeking confirmation", "near_stable", "The student carried difficulty substantially before leaning on reassurance."),
      option("no_rescue", "Continued without requesting rescue", "supported", "The student retained responsibility for the attempt."),
      ...commonTail("No meaningful stuck point or rescue opportunity occurred."),
    ],
  ),

  "time.start": dimension(
    "time.start",
    "Time Pressure Stability",
    "Start under time",
    "What happened to the student's start once a real timer or time constraint was active?",
    [
      option("timed_freeze", "Froze, panicked, or could not begin under the timer", "breakdown", "Time pressure prevented a usable start."),
      option("timed_disordered_delay", "Started late or with a disordered first move because of the timer", "conditional", "The student began, but time materially disrupted the start."),
      option("timed_valid_with_disruption", "Produced a valid start with visible timer-related hesitation", "near_stable", "The start remained usable but was not fully stable under time."),
      option("timed_controlled_start", "Started promptly with a valid structured first move", "supported", "The timer did not disrupt the start."),
      ...commonTail("The timer was not meaningfully active at the start, or the attempt ended before a timed start could be observed."),
    ],
  ),
  "time.structure": dimension(
    "time.structure",
    "Time Pressure Stability",
    "Structure under time",
    "What happened to method structure while the timer was active?",
    [
      option("timed_structure_collapse", "Method structure collapsed under time", "breakdown", "Urgency displaced the method."),
      option("timed_material_drift", "Important parts of the method drifted under time", "conditional", "Structure was partly retained but not reliably."),
      option("timed_minor_drift", "Structure mostly held with minor timer-related drift", "near_stable", "The method substantially survived time pressure but was not fully stable."),
      option("timed_structure_maintained", "Method structure held under the timer", "supported", "Urgency did not displace the execution structure."),
      ...commonTail("The attempt did not continue long enough under time to observe structure."),
    ],
    2,
  ),
  "time.pace": dimension(
    "time.pace",
    "Time Pressure Stability",
    "Pace control",
    "How did the student regulate pace once urgency was present?",
    [
      option("panic_pace", "Panic or uncontrolled rushing drove the response", "breakdown", "Pace control was lost."),
      option("uneven_pace_with_cost", "Pace became uneven enough to cause skipping, errors, or loss of control", "conditional", "The student remained active but urgency materially distorted pacing."),
      option("slightly_rushed_but_controlled", "Became slightly rushed but retained overall control", "near_stable", "Pacing was substantially regulated but not fully stable."),
      option("controlled_pace", "Maintained a deliberate, controlled pace", "supported", "The student regulated urgency without sacrificing response control."),
      ...commonTail("The attempt ended before pace regulation could be meaningfully observed."),
    ],
  ),
  "time.completion_integrity": dimension(
    "time.completion_integrity",
    "Time Pressure Stability",
    "Completion integrity",
    "By the end of the timed attempt, what happened to completion and method integrity?",
    [
      option("timed_non_completion", "Could not complete because the response broke under time", "breakdown", "The timed condition prevented a usable completion."),
      option("completion_with_structure_loss", "Completed only partly or finished with material structure loss", "conditional", "Completion occurred without sufficient integrity."),
      option("completion_with_minor_drift", "Completed with only minor integrity drift", "near_stable", "The response substantially held to completion but was not fully stable."),
      option("complete_with_structure", "Completed while preserving method structure", "supported", "The timed response reached completion without sacrificing the method."),
      ...commonTail("The task design or session interruption prevented a fair completion observation."),
    ],
    2,
  ),
};

export const DIAGNOSIS_STABILITY_MEANINGS: Record<TopicStability, string> = {
  Low: "The phase-defining capability is substantially absent or breaks at first meaningful exposure.",
  Medium: "The capability exists, but is conditional, inconsistent, support-dependent, or materially unstable.",
  High: "The capability is substantially present and usable; only minor instability and/or insufficient confirmation prevents the phase from being considered sustained.",
  "High Maintenance": "The capability has met the strong-performance threshold in training and is being confirmed in a later qualifying exposure before progression. Diagnosis cannot mint this state.",
};

export function getDiagnosisObservationOption(
  dimensionId: DiagnosisDimensionId,
  behaviorId: string,
): DiagnosisObservationOption | null {
  return (
    DIAGNOSIS_OBSERVATION_MATRIX[dimensionId]?.options.find((item) => item.id === behaviorId) ||
    null
  );
}

export function behaviorClassToEvidenceStatus(
  behaviorClass: DiagnosisBehaviorClass,
): "supported" | "unsupported" | "unresolved" | "confounded" {
  if (behaviorClass === "supported") return "supported";
  if (
    behaviorClass === "breakdown" ||
    behaviorClass === "conditional" ||
    behaviorClass === "near_stable"
  ) {
    return "unsupported";
  }
  if (behaviorClass === "confounded") return "confounded";
  return "unresolved";
}

export function behaviorClassToDiagnosisStability(
  behaviorClass: DiagnosisBehaviorClass,
): Exclude<TopicStability, "High Maintenance"> | null {
  if (behaviorClass === "breakdown") return "Low";
  if (behaviorClass === "conditional") return "Medium";
  if (behaviorClass === "near_stable") return "High";
  return null;
}

export function behaviorClassToLegacyLevel(
  behaviorClass: DiagnosisBehaviorClass,
): "weak" | "partial" | "clear" | null {
  if (behaviorClass === "breakdown") return "weak";
  if (behaviorClass === "conditional" || behaviorClass === "near_stable") return "partial";
  if (behaviorClass === "supported") return "clear";
  return null;
}
