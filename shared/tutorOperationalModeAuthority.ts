export type TutorOperationalModeAuthorityInput = {
  assignmentMode?: string | null;
  lifecycleMode?: string | null;
};

const normalizeMode = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase();

export function resolveTutorOperationalModeAuthority(
  input: TutorOperationalModeAuthorityInput,
) {
  const assignmentMode = normalizeMode(input.assignmentMode);
  const lifecycleMode = normalizeMode(input.lifecycleMode);
  const mode = lifecycleMode || assignmentMode || "training";

  return {
    mode,
    assignmentMode: assignmentMode || null,
    lifecycleMode: lifecycleMode || null,
    drift: Boolean(
      assignmentMode &&
      lifecycleMode &&
      assignmentMode !== lifecycleMode
    ),
  };
}
