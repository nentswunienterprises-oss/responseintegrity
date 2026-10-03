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
  correctOverLongestDistractorBy20Pct: number;
  correctUniquelyLongestRate: number;
  correctUniquelyShortestRate: number;
  correctOverLongestDistractorBy20PctRate: number;
  correctKeyCounts: Record<string, number>;
  maxCorrectKeyCount: number;
  maxCorrectKeyRate: number;
}

export const CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE = 0.25;
export const CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION = 0.4;

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
  let correctOverLongestDistractorBy20Pct = 0;
  const correctKeyCounts: Record<string, number> = {};

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
    correctKeyCounts[correctKey] = (correctKeyCounts[correctKey] || 0) + 1;

    const longestDistractor = Math.max(...distractorLengths);
    const shortestDistractor = Math.min(...distractorLengths);

    if (correctLength > longestDistractor) {
      correctUniquelyLongest += 1;
    }
    if (correctLength < shortestDistractor) {
      correctUniquelyShortest += 1;
    }
    if (correctLength > longestDistractor * 1.2) {
      correctOverLongestDistractorBy20Pct += 1;
    }
  }

  const divisor = eligibleSingleChoiceItems || 1;
  const maxCorrectKeyCount = Math.max(0, ...Object.values(correctKeyCounts));

  return {
    eligibleSingleChoiceItems,
    correctUniquelyLongest,
    correctUniquelyShortest,
    correctOverLongestDistractorBy20Pct,
    correctUniquelyLongestRate: correctUniquelyLongest / divisor,
    correctUniquelyShortestRate: correctUniquelyShortest / divisor,
    correctOverLongestDistractorBy20PctRate:
      correctOverLongestDistractorBy20Pct / divisor,
    correctKeyCounts,
    maxCorrectKeyCount,
    maxCorrectKeyRate: maxCorrectKeyCount / divisor,
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
    summary.maxCorrectKeyRate >
    CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks the answer by position: one option key is correct for ${summary.maxCorrectKeyCount}/${summary.eligibleSingleChoiceItems} single-choice items. Rebalance correct-answer positions before release.`,
    );
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
    summary.correctOverLongestDistractorBy20PctRate >
    CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks the answer by exaggerated option length: ${summary.correctOverLongestDistractorBy20Pct}/${summary.eligibleSingleChoiceItems} single-choice items make the correct answer more than 20% longer than every distractor. Re-author distractors to comparable specificity before release.`,
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
