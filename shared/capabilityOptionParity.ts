export interface CapabilityOptionParityItem {
  key: string;
  prompt?: string;
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
  totalAcceptedKeyCount: number;
  maxAcceptedKeyRate: number;
  nearDuplicateAcceptedPairs: number;
  nearDuplicateAcceptedPairKeys: string[];
  reusedAcceptedTruths: Array<{
    label: string;
    itemKeys: string[];
  }>;
  indirectOptionCopy: Array<{
    itemKey: string;
    optionKey: string;
    label: string;
  }>;
  promptShapeMismatches: Array<{
    itemKey: string;
    optionKey: string;
    prompt: string;
    label: string;
  }>;
}

export const CAPABILITY_OPTION_PARITY_MAX_SHORTCUT_RATE = 0.25;
export const CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION = 0.4;
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

const INDIRECT_OPTION_PATTERNS = [
  /\bThat can seem reasonable\b/i,
  /^What matters is that\b/i,
  /^The key is that\b/i,
  /\bbecause part of the response still looks usable\b/i,
  /\bit avoids opening another evidence question\b/i,
] as const;

function hasIndirectOptionCopy(label: string) {
  return INDIRECT_OPTION_PATTERNS.some((pattern) => pattern.test(label));
}

const IMPERATIVE_OPTION_START =
  /^(?:use|keep|record|run|leave|treat|start|stop|preserve|follow|remove|ask|give|mark|move|return|continue|begin|hold|apply|collect|present|watch|finish|freeze|route|strip|allow|do not|don't|take|choose|write|click|say|speak|let|stay|end|wait)\b/i;

type PromptShape =
  | "action"
  | "reason"
  | "who"
  | "interpretation"
  | "yes_no"
  | "other";

function finalQuestionClause(prompt: string) {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  const questionEnd = normalized.lastIndexOf("?");
  if (questionEnd < 0) return normalized;

  const throughQuestion = normalized.slice(0, questionEnd + 1);
  let start = 0;
  const sentenceBoundary = /[.!?][”"'’)]?\s+/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceBoundary.exec(throughQuestion))) {
    if (match.index >= questionEnd) break;
    start = sentenceBoundary.lastIndex;
  }

  return throughQuestion.slice(start).trim();
}

function classifyPromptShape(prompt: string): PromptShape {
  const question = finalQuestionClause(prompt).toLowerCase();

  if (
    /^(?:what should|how should|what happens next|what should happen|what must|which .* should)\b/.test(
      question,
    )
  ) {
    return "action";
  }

  if (
    /^(?:why|what prevents|what makes|which explanation|what is the reason)\b/.test(
      question,
    )
  ) {
    return "reason";
  }

  if (/^who\b/.test(question)) {
    return "who";
  }

  if (
    /^(?:what (?:is|was) (?:the )?(?:risk|concern|problem|issue|purpose|role|boundary|evidence|signal|difference|meaning|definition)|what (?:does|did).*\b(?:mean|show|prove|reveal|indicate)\b|what (?:changed|happened)\b|what is (?:missing|lost)\b)/.test(
      question,
    )
  ) {
    return "interpretation";
  }

  if (
    /^(?:can|should|is|are|does|do|did|has|have|will|would|could|may)\b/.test(
      question,
    )
  ) {
    return "yes_no";
  }

  return "other";
}

function optionShapeMatchesPrompt(prompt: string, label: string) {
  const normalizedLabel = String(label || "").replace(/\s+/g, " ").trim();
  if (!String(prompt || "").trim() || !normalizedLabel) return true;

  const shape = classifyPromptShape(prompt);

  if (
    (shape === "reason" ||
      shape === "who" ||
      shape === "interpretation") &&
    IMPERATIVE_OPTION_START.test(normalizedLabel)
  ) {
    return false;
  }

  if (
    shape === "action" &&
    /^(?:because|since)\b/i.test(normalizedLabel)
  ) {
    return false;
  }

  if (shape === "yes_no" && !/^(?:yes|no)\b/i.test(normalizedLabel)) {
    return false;
  }

  return true;
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
  const acceptedLabelItems = new Map<string, { label: string; itemKeys: string[] }>();
  const indirectOptionCopy: CapabilityOptionParitySummary["indirectOptionCopy"] = [];
  const promptShapeMismatches: CapabilityOptionParitySummary["promptShapeMismatches"] = [];

  for (const item of items) {
    if (
      item.kind !== "single_choice" ||
      item.options.length !== 5 ||
      item.correctOptionKeys.length < 1 ||
      item.correctOptionKeys.length > 2
    ) {
      continue;
    }

    for (const option of item.options) {
      if (hasIndirectOptionCopy(option.label)) {
        indirectOptionCopy.push({
          itemKey: item.key,
          optionKey: option.key,
          label: option.label,
        });
      }
      if (
        item.prompt &&
        !optionShapeMatchesPrompt(item.prompt, option.label)
      ) {
        promptShapeMismatches.push({
          itemKey: item.key,
          optionKey: option.key,
          prompt: item.prompt,
          label: option.label,
        });
      }
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

    for (const option of acceptedOptions) {
      const normalizedLabel = option.label.replace(/\s+/g, " ").trim();
      const wordCount = normalizedWords(normalizedLabel).length;
      if (wordCount < 8) continue;
      const lookupKey = normalizedLabel.toLowerCase();
      const existing = acceptedLabelItems.get(lookupKey) || {
        label: normalizedLabel,
        itemKeys: [],
      };
      if (!existing.itemKeys.includes(item.key)) {
        existing.itemKeys.push(item.key);
      }
      acceptedLabelItems.set(lookupKey, existing);
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
  const totalAcceptedKeyCount = Object.values(acceptedKeyCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const reusedAcceptedTruths = [...acceptedLabelItems.values()]
    .filter((entry) => entry.itemKeys.length >= 3)
    .sort((a, b) => b.itemKeys.length - a.itemKeys.length);

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
    totalAcceptedKeyCount,
    maxAcceptedKeyRate:
      maxAcceptedKeyCount / (totalAcceptedKeyCount || 1),
    nearDuplicateAcceptedPairs,
    nearDuplicateAcceptedPairKeys,
    reusedAcceptedTruths,
    indirectOptionCopy,
    promptShapeMismatches,
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

  if (summary.reusedAcceptedTruths.length > 0) {
    const examples = summary.reusedAcceptedTruths
      .slice(0, 5)
      .map(
        (entry) =>
          `"${entry.label}" reused by ${entry.itemKeys.join(", ")}`,
      )
      .join("; ");
    throw new Error(
      `Capability assessment ${assessmentKey} reuses long accepted-answer truths across multiple prompts. Silent alternate-valid answers must answer the specific prompt rather than act as reusable RI doctrine. ${examples}`,
    );
  }

  if (summary.indirectOptionCopy.length > 0) {
    const examples = summary.indirectOptionCopy
      .slice(0, 5)
      .map(
        (entry) =>
          `${entry.itemKey}/${entry.optionKey}: "${entry.label}"`,
      )
      .join("; ");
    throw new Error(
      `Capability assessment ${assessmentKey} contains answer-option copy that comments on the option instead of answering the prompt directly. Remove meta or reusable filler phrasing such as "That can seem reasonable", "What matters is that", "The key is that", and generic "part of the response still looks usable" rationales. ${examples}`,
    );
  }

  if (summary.promptShapeMismatches.length > 0) {
    const examples = summary.promptShapeMismatches
      .slice(0, 5)
      .map(
        (entry) =>
          `${entry.itemKey}/${entry.optionKey}: prompt="${entry.prompt}" option="${entry.label}"`,
      )
      .join("; ");
    throw new Error(
      `Capability assessment ${assessmentKey} contains answer options whose grammatical shape does not answer the prompt. Every correct and incorrect option must fit the exact question being asked. ${examples}`,
    );
  }

  if (
    summary.maxAcceptedKeyRate >
    CAPABILITY_OPTION_PARITY_MAX_KEY_CONCENTRATION
  ) {
    throw new Error(
      `Capability assessment ${assessmentKey} leaks accepted answers by position: one option key holds ${summary.maxAcceptedKeyCount}/${summary.totalAcceptedKeyCount} accepted-key slots. Rebalance accepted-answer positions before release.`,
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
