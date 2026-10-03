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

export function analyzeCapabilityOptionParity(
  items: CapabilityOptionParityItem[],
): CapabilityOptionParitySummary {
  let eligibleSingleChoiceItems = 0;
  let alternateValidItems = 0;
  let acceptedClusterLongerBy20Pct = 0;
  let acceptedClusterShorterBy20Pct = 0;
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
    const acceptedLengths = item.options
      .filter((option) => acceptedKeys.has(option.key))
      .map((option) => visibleLength(option.label));
    const distractorLengths = item.options
      .filter((option) => !acceptedKeys.has(option.key))
      .map((option) => visibleLength(option.label));

    if (!acceptedLengths.length || !distractorLengths.length) continue;

    eligibleSingleChoiceItems += 1;
    if (item.correctOptionKeys.length === 2) alternateValidItems += 1;

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
