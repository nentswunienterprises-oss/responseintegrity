export type InstructionPromptLabel = "SAY" | "DO THIS NOW" | "SAY / DO THIS NOW";

export function instructionPromptLabelFor(instruction: string): InstructionPromptLabel {
  const normalized = instruction.trim().toLowerCase();
  if (!normalized) return "DO THIS NOW";

  const asksForSpeech =
    /\bask (the )?student\b/.test(normalized) ||
    /\btell (the )?student\b/.test(normalized) ||
    /^(solve|try|continue|state|pause|focus|repeat)\b/.test(normalized) ||
    normalized.startsWith("another similar difficulty");

  const asksForAction =
    /\b(show|teach|observe|present|give|prepare|record)\b/.test(normalized);

  if (asksForSpeech && asksForAction) return "SAY / DO THIS NOW";
  if (asksForSpeech) return "SAY";
  return "DO THIS NOW";
}
