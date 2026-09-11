export type CapabilityQuestionKind = "single_choice" | "multi_select" | "sequence";

export interface CapabilityQuestionDefinition {
  key: string;
  competencyKey: string;
  prompt: string;
  kind: CapabilityQuestionKind;
  options: Array<{ key: string; label: string }>;
  correctOptionKeys: string[];
  criticalFailOptionKeys?: string[];
  explanation: string;
}

export interface CapabilityAssessmentDefinition {
  key: string;
  deepDiveKey: string;
  title: string;
  masteryThresholdPercent: number;
  questions: CapabilityQuestionDefinition[];
}

export interface CapabilityResponseInput {
  questionKey: string;
  selectedOptionKeys: string[];
}

export interface CapabilityQuestionResult {
  questionKey: string;
  competencyKey: string;
  correct: boolean;
  criticalFail: boolean;
  selectedOptionKeys: string[];
  correctOptionKeys: string[];
  explanation: string;
}

export interface CapabilityAssessmentResult {
  assessmentKey: string;
  deepDiveKey: string;
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  hasCriticalFail: boolean;
  criticalFailQuestionKeys: string[];
  mastered: boolean;
  questionResults: CapabilityQuestionResult[];
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();
}

function sameStringSet(left: string[], right: string[]) {
  const normalizedLeft = uniqueSorted(left);
  const normalizedRight = uniqueSorted(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function isSequenceCorrect(selected: string[], expected: string[]) {
  const normalizedSelected = selected.map((value) => String(value).trim()).filter(Boolean);
  const normalizedExpected = expected.map((value) => String(value).trim()).filter(Boolean);
  return (
    normalizedSelected.length === normalizedExpected.length &&
    normalizedSelected.every((value, index) => value === normalizedExpected[index])
  );
}

export function validateCapabilityAssessmentDefinition(definition: CapabilityAssessmentDefinition) {
  if (!definition.questions.length) {
    throw new Error("Capability assessment must contain questions.");
  }

  const seenQuestionKeys = new Set<string>();
  for (const question of definition.questions) {
    if (seenQuestionKeys.has(question.key)) {
      throw new Error(`Duplicate capability question key: ${question.key}`);
    }
    seenQuestionKeys.add(question.key);

    const optionKeys = new Set(question.options.map((option) => option.key));
    if (!question.correctOptionKeys.length) {
      throw new Error(`Capability question ${question.key} must define a correct answer.`);
    }
    for (const optionKey of [...question.correctOptionKeys, ...(question.criticalFailOptionKeys || [])]) {
      if (!optionKeys.has(optionKey)) {
        throw new Error(`Capability question ${question.key} references unknown option ${optionKey}.`);
      }
    }
  }
}

export function evaluateCapabilityAssessment(
  definition: CapabilityAssessmentDefinition,
  responses: CapabilityResponseInput[]
): CapabilityAssessmentResult {
  validateCapabilityAssessmentDefinition(definition);

  if (responses.length !== definition.questions.length) {
    throw new Error(`Expected ${definition.questions.length} capability responses, received ${responses.length}.`);
  }

  const responseMap = new Map<string, CapabilityResponseInput>();
  for (const response of responses) {
    if (responseMap.has(response.questionKey)) {
      throw new Error(`Duplicate capability response: ${response.questionKey}`);
    }
    responseMap.set(response.questionKey, response);
  }

  const questionResults = definition.questions.map((question) => {
    const response = responseMap.get(question.key);
    if (!response) {
      throw new Error(`Missing capability response: ${question.key}`);
    }

    const selectedOptionKeys = response.selectedOptionKeys.map((value) => String(value).trim()).filter(Boolean);
    if (!selectedOptionKeys.length) {
      throw new Error(`Capability response ${question.key} must select at least one option.`);
    }

    const validOptionKeys = new Set(question.options.map((option) => option.key));
    for (const selectedOptionKey of selectedOptionKeys) {
      if (!validOptionKeys.has(selectedOptionKey)) {
        throw new Error(`Capability response ${question.key} selected unknown option ${selectedOptionKey}.`);
      }
    }

    const correct =
      question.kind === "sequence"
        ? isSequenceCorrect(selectedOptionKeys, question.correctOptionKeys)
        : sameStringSet(selectedOptionKeys, question.correctOptionKeys);

    const criticalFail = selectedOptionKeys.some((optionKey) =>
      (question.criticalFailOptionKeys || []).includes(optionKey)
    );

    return {
      questionKey: question.key,
      competencyKey: question.competencyKey,
      correct,
      criticalFail,
      selectedOptionKeys,
      correctOptionKeys: [...question.correctOptionKeys],
      explanation: question.explanation,
    } satisfies CapabilityQuestionResult;
  });

  const correctQuestions = questionResults.filter((result) => result.correct).length;
  const percent = Math.round((correctQuestions / definition.questions.length) * 10000) / 100;
  const criticalFailQuestionKeys = questionResults
    .filter((result) => result.criticalFail)
    .map((result) => result.questionKey);
  const hasCriticalFail = criticalFailQuestionKeys.length > 0;

  return {
    assessmentKey: definition.key,
    deepDiveKey: definition.deepDiveKey,
    totalQuestions: definition.questions.length,
    correctQuestions,
    percent,
    hasCriticalFail,
    criticalFailQuestionKeys,
    mastered: percent >= definition.masteryThresholdPercent && !hasCriticalFail,
    questionResults,
  };
}
