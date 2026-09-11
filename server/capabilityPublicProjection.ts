import type {
  CapabilityAssessmentDefinition,
  CapabilityAssessmentResult,
} from "@shared/capabilityEngine";

export function projectCapabilityAssessmentForSpecialist(input: {
  definition: CapabilityAssessmentDefinition;
  formId: string;
  bankVersion: number;
  attemptNumber: number;
  maxAttempts: number;
}) {
  return {
    key: input.definition.key,
    deepDiveKey: input.definition.deepDiveKey,
    title: input.definition.title,
    evidenceKind: input.definition.evidenceKind,
    passThresholdPercent: input.definition.passThresholdPercent,
    totalQuestions: input.definition.questions.length,
    formId: input.formId,
    bankVersion: input.bankVersion,
    attemptNumber: input.attemptNumber,
    maxAttempts: input.maxAttempts,
    questions: input.definition.questions.map((question) => ({
      key: question.key,
      prompt: question.prompt,
      kind: question.kind,
      options: question.options.map((option) => ({ ...option })),
    })),
  };
}

export function projectCapabilityAttemptResultForSpecialist(input: {
  attemptId?: string;
  completedAt: unknown;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
  result: CapabilityAssessmentResult;
}) {
  return {
    attemptId: input.attemptId,
    completedAt: input.completedAt,
    bankVersion: input.bankVersion,
    attemptNumber: input.attemptNumber,
    formId: input.formId,
    assessmentKey: input.result.assessmentKey,
    evidenceKind: input.result.evidenceKind,
    totalQuestions: input.result.totalQuestions,
    correctQuestions: input.result.correctQuestions,
    percent: input.result.percent,
    passed: input.result.passed,
    hasCriticalFail: input.result.hasCriticalFail,
  };
}
