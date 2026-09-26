export type InstructionPromptLabel = "SAY" | "DO THIS NOW";

export function instructionPromptLabelFor(instruction: string): InstructionPromptLabel {
  const normalized = instruction.trim().toLowerCase();
  if (!normalized) return "DO THIS NOW";

  // Meta-instructions tell the Specialist what to do. They are not scripts to quote.
  const isMetaAction =
    /^(show|ask (the )?student|tell (the )?student|teach|observe|present|give|prepare|record)\b/.test(
      normalized,
    );

  if (isMetaAction) return "DO THIS NOW";

  // Direct student-facing language is an exact script and should be displayed as SAY.
  const isDirectSpeech =
    /^(before you\b|solve\b|try\b|continue\b|state\b|pause\b|focus\b|repeat\b|another similar difficulty\b)/.test(
      normalized,
    );

  return isDirectSpeech ? "SAY" : "DO THIS NOW";
}

export function instructionPromptDisplayText(instruction: string): string {
  const trimmed = instruction.trim();
  if (!trimmed) return instruction;

  const label = instructionPromptLabelFor(trimmed);
  const alreadyQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  if (label === "SAY" && !alreadyQuoted) return `"${trimmed}"`;

  return instruction;
}
