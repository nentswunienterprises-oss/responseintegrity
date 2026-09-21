export type TrainingSessionCancellationReasonOption = {
  code: string;
  label: string;
  description: string;
};

export const TRAINING_SESSION_CANCELLATION_OTHER_CODE = "other";

export const TUTOR_TRAINING_SESSION_CANCELLATION_REASONS: TrainingSessionCancellationReasonOption[] = [
  {
    code: "tutor_unavailable",
    label: "Specialist unavailable",
    description: "Use when the Specialist can no longer deliver the confirmed lesson.",
  },
  {
    code: "schedule_conflict",
    label: "Schedule conflict",
    description: "Use when the confirmed time is no longer operationally workable.",
  },
  {
    code: "technical_issue",
    label: "Technical or platform issue",
    description: "Use when platform, device, connectivity, or account issues block delivery.",
  },
  {
    code: "emergency_or_illness",
    label: "Emergency or illness",
    description: "Use when an unexpected disruption prevents the session from running.",
  },
  {
    code: "parent_requested_cancellation",
    label: "Parent requested cancellation",
    description: "Use when the parent asked for the confirmed lesson to be cancelled.",
  },
  {
    code: TRAINING_SESSION_CANCELLATION_OTHER_CODE,
    label: "Other",
    description: "Add a short note so the cancellation trail stays clear.",
  },
];

export const PARENT_TRAINING_SESSION_CANCELLATION_REASONS: TrainingSessionCancellationReasonOption[] = [
  {
    code: "parent_unavailable",
    label: "Parent unavailable",
    description: "Use when the parent cannot support or host the confirmed lesson.",
  },
  {
    code: "student_unavailable",
    label: "Student unavailable",
    description: "Use when the student cannot attend the confirmed lesson.",
  },
  {
    code: "schedule_conflict",
    label: "Schedule conflict",
    description: "Use when the confirmed time is no longer workable for the family.",
  },
  {
    code: "technical_issue",
    label: "Technical or platform issue",
    description: "Use when device, internet, account, or platform issues block attendance.",
  },
  {
    code: "emergency_or_illness",
    label: "Emergency or illness",
    description: "Use when an unexpected disruption prevents attendance.",
  },
  {
    code: TRAINING_SESSION_CANCELLATION_OTHER_CODE,
    label: "Other",
    description: "Add a short note so the cancellation trail stays clear.",
  },
];

export function buildTrainingSessionCancellationNote(
  actorLabel: string,
  reasonOptions: TrainingSessionCancellationReasonOption[],
  reasonCodes: string[],
  reasonNote?: string | null,
) {
  const trimmedNote = String(reasonNote || "").trim();
  if (trimmedNote) {
    return trimmedNote;
  }

  const reasonLabels = reasonCodes
    .map((code) => reasonOptions.find((option) => option.code === code)?.label)
    .filter((label): label is string => !!label);

  if (reasonLabels.length === 0) {
    return `${actorLabel} cancelled the confirmed training session.`;
  }

  return `${actorLabel} cancelled the confirmed training session. Reasons: ${reasonLabels.join("; ")}.`;
}
