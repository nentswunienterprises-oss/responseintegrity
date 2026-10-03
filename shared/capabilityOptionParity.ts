export interface CapabilityOptionParityItem {
  key: string;
  kind: "single_choice" | "multi_select" | "sequence";
  options: Array<{ key: string; label: string }>;
  correctOptionKeys: string[];
}

export interface CapabilityOptionParitySummary {
  eligibleSingleChoiceItems: number;
  alternateValidItems: number;
  alternateValidRate: number;
  acceptedClusterLongerBy20Pct: number;
  acceptedClusterLongerBy20PctRate: number;
  acceptedClusterShorterBy20Pct: number;
  acceptedClusterShorterBy20PctRate: number;
  acceptedKeyCounts: Record<string, number>;
  maxAcceptedKeyCount: number;
  maxAcceptedKeyRate: number;
  nearDuplicateAcceptedPairs: number;
  nearDuplicateAcceptedPairKeys: string[];
}

export const CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE = 0.25;
export const CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION = 0.55;
export const CAPABILITY_SILENT_ALTERNATE_MIN_RATE = 0.7;
export const CAPABILITY_SILENT_ALTERNATE_MAX_RATE = 0.9;

function visibleLength(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

function normalizedWords(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function longestSharedWordRun(a: string[], b: string[]) {
  let longest = 0;
  const previous = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        longest = Math.max(longest, current[j]);
      }
    }
    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return longest;
}

function acceptedPairLooksDuplicative(labels: string[]) {
  if (labels.length !== 2) return false;

  const left = normalizedWords(labels[0]);
  const right = normalizedWords(labels[1]);
  const shorter = Math.max(1, Math.min(left.length, right.length));
  const sharedRun = longestSharedWordRun(left, right);

  return sharedRun >= 5 && sharedRun / shorter >= 0.35;
}

export function analyzeCapabilityOptionParity(
  items: CapabilityOptionParityItem[],
): CapabilityOptionParitySummary {
  let eligibleSingleChoiceItems = 0;
  let alternateValidItems = 0;
  let acceptedClusterLongerBy20Pct = 0;
  let acceptedClusterShorterBy20Pct = 0;
  let nearDuplicateAcceptedPairs = 0;
  const nearDuplicateAcceptedPairKeys: string[] = [];
  const acceptedKeyCounts: Record<string, number> = {};

  for (const item of items) {
    if (
      item.kind !== "single_choice" ||
      item.options.length !== 5 ||
      item.correctOptionKeys.length < 1 ||
      item.correctOptionKeys.length > 2
    ) {
      continue;
    }

    const acceptedKeys = new Set(item.correctOptionKeys);
    const acceptedOptions = item.options.filter((option) =>
      acceptedKeys.has(option.key),
    );
    const acceptedLengths = acceptedOptions.map((option) =>
      visibleLength(option.label),
    );
    const distractorLengths = item.options
      .filter((option) => !acceptedKeys.has(option.key))
      .map((option) => visibleLength(option.label));

    if (!acceptedLengths.length || !distractorLengths.length) continue;

    eligibleSingleChoiceItems += 1;
    if (item.correctOptionKeys.length === 2) {
      alternateValidItems += 1;
      if (
        acceptedPairLooksDuplicative(
          acceptedOptions.map((option) => option.label),
        )
      ) {
        nearDuplicateAcceptedPairs += 1;
        nearDuplicateAcceptedPairKeys.push(item.key);
      }
    }

    for (const key of item.correctOptionKeys) {
      acceptedKeyCounts[key] = (acceptedKeyCounts[key] || 0) + 1;
    }

    const shortestAccepted = Math.min(...acceptedLengths);
    const longestAccepted = Math.max(...acceptedLengths);
    const longestDistractor = Math.max(...distractorLengths);
    const shortestDistractor = Math.min(...distractorLengths);

    if (shortestAccepted > longestDistractor * 1.2) {
      acceptedClusterLongerBy20Pct += 1;
    }
    if (longestAccepted < shortestDistractor * 0.8) {
      acceptedClusterShorterBy20Pct += 1;
    }
  }

  const divisor = eligibleSingleChoiceItems || 1;
  const maxAcceptedKeyCount = Math.max(0, ...Object.values(acceptedKeyCounts));

  return {
    eligibleSingleChoiceItems,
    alternateValidItems,
    alternateValidRate: alternateValidItems / divisor,
    acceptedClusterLongerBy20Pct,
    acceptedClusterLongerBy20PctRate: acceptedClusterLongerBy20Pct / divisor,
    acceptedClusterShorterBy20Pct,
    acceptedClusterShorterBy20PctRate: acceptedClusterShorterBy20Pct / divisor,
    acceptedKeyCounts,
    maxAcceptedKeyCount,
    maxAcceptedKeyRate: maxAcceptedKeyCount / divisor,
    nearDuplicateAcceptedPairs,
    nearDuplicateAcceptedPairKeys,
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
    summary.alternateValidRate < CAPABILITY_SILENT_ALTERNATE_MIN_RATE ||
    summary.alternateValidRate > CAPABILITY_SILENT_ALTERNATE_MAX_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} must keep silent alternate-valid single-choice questions around 80% of eligible items. Found ${summary.alternateValidItems}/${summary.eligibleSingleChoiceItems} (${(summary.alternateValidRate * 100).toFixed(1)}%).`,
    );
  }

  if (summary.nearDuplicateAcceptedPairs > 0) {
    throw new Error(
      `Capability assessment ${assessmentKey} contains ${summary.nearDuplicateAcceptedPairs} silent alternate-valid item${summary.nearDuplicateAcceptedPairs === 1 ? "" : "s"} where the two accepted answers substantially repeat the same wording: ${summary.nearDuplicateAcceptedPairKeys.join(", ")}. Re-author the second accepted answer as a genuinely distinct valid truth.`,
    );
  }

  if (
    summary.maxAcceptedKeyRate >
    CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks accepted answers by position: one option key is accepted in ${summary.maxAcceptedKeyCount}/${summary.eligibleSingleChoiceItems} single-choice items. Rebalance accepted-answer positions before release.`,
    );
  }

  if (
    summary.acceptedClusterLongerBy20PctRate >
    CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks accepted answers by length: ${summary.acceptedClusterLongerBy20Pct}/${summary.eligibleSingleChoiceItems} single-choice items make every accepted answer more than 20% longer than every distractor.`,
    );
  }

  if (
    summary.acceptedClusterShorterBy20PctRate >
    CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks accepted answers by length: ${summary.acceptedClusterShorterBy20Pct}/${summary.eligibleSingleChoiceItems} single-choice items make every accepted answer materially shorter than every distractor.`,
    );
  }

  return summary;
}
