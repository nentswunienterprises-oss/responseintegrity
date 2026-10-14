import type { TopicPhase } from "./topicConditioningEngine";
import type { TrainingPrerequisiteSentinelResult } from "./trainingEvidenceCapture";

type ProbePhase = Exclude<TopicPhase, "Clarity">;

/**
 * An observed breakdown needs its own stripped-constraint observation.
 * Never make that gate depend on choosing artificially strong outcomes.
 */
export function sandboxRequiresPrerequisiteSentinel(
  fields: readonly {
    fieldKey: string;
    options: readonly { optionId: string; requiresPrerequisiteSentinel?: boolean }[];
  }[],
  observations: Record<
    string,
    { optionId?: string | null; evidenceStatus?: string | null } | undefined
  >,
): boolean {
  return fields.some((field) => {
    const recorded = observations[field.fieldKey];
    if (!recorded?.optionId || (recorded.evidenceStatus ?? "observed") !== "observed") {
      return false;
    }
    return field.options.some(
      (option) =>
        option.optionId === recorded.optionId &&
        option.requiresPrerequisiteSentinel === true,
    );
  });
}

/**
 * This is an observable, synthetic response to a *separate* prerequisite
 * opportunity, not a reinterpretation of the timed rep. The private bank has
 * already established its canonical prerequisite outcome. Only this behavioral
 * description reaches the Specialist; the canonical key never does.
 *
 * The user must choose to run the stripped-constraint check before it is shown.
 * A bank outcome without authored prerequisite truth cannot manufacture it.
 */
const PROBE_BEHAVIORS: Record<
  ProbePhase,
  Record<TrainingPrerequisiteSentinelResult, string>
> = {
  "Structured Execution": {
    held:
      "On a comparable familiar problem, the student identifies the method before solving and explains why it fits, without a hint or supplied step.",
    contradicted:
      "On a comparable familiar problem, the student cannot identify a usable method or explain why it fits. No method cue or step was given.",
    not_observed:
      "The student does not produce an observable response to the familiar problem. There is no evidence of method recognition from this check.",
    confounded:
      "Before the student can independently identify the method, an interruption and an unsolicited method hint interfere with the check. Their independent understanding is unclear.",
  },
  "Controlled Discomfort": {
    held:
      "With the difficulty removed, the student selects the known method, starts independently, and carries the ordinary problem through in order without help.",
    contradicted:
      "Even with the difficulty removed, the student cannot sustain an ordered independent attempt on the ordinary problem. They abandon the known method without being helped.",
    not_observed:
      "After the difficulty is removed, there is no observable independent attempt on the ordinary problem. The response cannot be judged.",
    confounded:
      "The ordinary follow-up is interrupted and another person supplies a step before the student responds. Independent execution cannot be established.",
  },
  "Time Pressure Stability": {
    held:
      "The countdown is removed for a comparable untimed problem. The student starts with the known method, keeps the steps in order, and completes independently without a hint.",
    contradicted:
      "The countdown is removed for a comparable untimed problem. The student still writes unrelated steps, changes direction repeatedly, and cannot carry the known method through independently.",
    not_observed:
      "After removing the timer, no independent attempt on a comparable problem becomes observable. There is no untimed response from which to judge the method.",
    confounded:
      "The timer is removed, but an interruption occurs and an outside hint supplies a step before the student's independent attempt can be assessed.",
  },
};

export function renderSandboxPrerequisiteFollowUp(
  phase: TopicPhase,
  canonical: TrainingPrerequisiteSentinelResult | null | undefined,
): string | null {
  if (phase === "Clarity" || !canonical) return null;
  return PROBE_BEHAVIORS[phase][canonical];
}
