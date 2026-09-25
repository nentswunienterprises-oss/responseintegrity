export interface CapabilityOptionParityItem {
  key: string;
  kind: "single_choice" | "multi_select" | "sequence";
  options: Array<{ key: string; label: string }>;
  correctOptionKeys: string[];
}

export interface CapabilityOptionParitySummary {
  eligibleSingleChoiceItems: number;
  correctUniquelyLongest: number;
  correctUniquelyShortest: number;
  correctUniquelyLongestRate: number;
  correctUniquelyShortestRate: number;
}

export const CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE = 0.5;

function visibleLength(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

export function analyzeCapabilityOptionParity(
  items: CapabilityOptionParityItem[],
): CapabilityOptionParitySummary {
  let eligibleSingleChoiceItems = 0;
  let correctUniquelyLongest = 0;
  let correctUniquelyShortest = 0;

  for (const item of items) {
    if (
      item.kind !== "single_choice" ||
      item.options.length !== 4 ||
      item.correctOptionKeys.length !== 1
    ) {
      continue;
    }

    const correctKey = item.correctOptionKeys[0];
    const correct = item.options.find((option) => option.key === correctKey);
    if (!correct) continue;

    const correctLength = visibleLength(correct.label);
    const distractorLengths = item.options
      .filter((option) => option.key !== correctKey)
      .map((option) => visibleLength(option.label));

    if (distractorLengths.length !== 3) continue;

    eligibleSingleChoiceItems += 1;
    if (correctLength > Math.max(...distractorLengths)) {
      correctUniquelyLongest += 1;
    }
    if (correctLength < Math.min(...distractorLengths)) {
      correctUniquelyShortest += 1;
    }
  }

  const divisor = eligibleSingleChoiceItems || 1;
  return {
    eligibleSingleChoiceItems,
    correctUniquelyLongest,
    correctUniquelyShortest,
    correctUniquelyLongestRate: correctUniquelyLongest / divisor,
    correctUniquelyShortestRate: correctUniquelyShortest / divisor,
  };
}

export function assertCapabilityOptionParity(
  assessmentKey: string,
  items: CapabilityOptionParityItem[],
): CapabilityOptionParitySummary {
  const summary = analyzeCapabilityOptionParity(items);

  if (summary.eligibleSingleChoiceItems < 15) {
    return summary;
  }

  if (
    summary.correctUniquelyLongestRate >
    CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks the answer by option length: ${summary.correctUniquelyLongest}/${summary.eligibleSingleChoiceItems} single-choice items make the correct answer uniquely longest. Reconcile option parity before release.`,
    );
  }

  if (
    summary.correctUniquelyShortestRate >
    CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks the answer by option length: ${summary.correctUniquelyShortest}/${summary.eligibleSingleChoiceItems} single-choice items make the correct answer uniquely shortest. Reconcile option parity before release.`,
    );
  }

  return summary;
}
