export type CapabilityQuestionKind = "single_choice" | "multi_select" | "sequence";
export type CapabilityEvidenceKind = "mastery" | "retrieval" | "transfer";
export type CapabilityPracticalLedgerStatus = "submitted" | "approved" | "repeat_required" | "integrity_review";

export interface CapabilityQuestionDefinition {
  key: string;
  competencyKey: string;
  deepDiveKey?: string;
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
  evidenceKind: CapabilityEvidenceKind;
  passThresholdPercent: number;
  questions: CapabilityQuestionDefinition[];
}

export interface CapabilityResponseInput {
  questionKey: string;
  selectedOptionKeys: string[];
}

export interface CapabilityQuestionResult {
  questionKey: string;
  competencyKey: string;
  deepDiveKey: string;
  correct: boolean;
  criticalFail: boolean;
  selectedOptionKeys: string[];
  correctOptionKeys: string[];
  explanation: string;
}

export interface CapabilityAssessmentResult {
  assessmentKey: string;
  assessmentDeepDiveKey: string;
  evidenceKind: CapabilityEvidenceKind;
  coveredDeepDiveKeys: string[];
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  hasCriticalFail: boolean;
  criticalFailQuestionKeys: string[];
  passed: boolean;
  questionResults: CapabilityQuestionResult[];
}

export interface CapabilityLedgerAttempt {
  attemptId: string;
  assessmentKey: string;
  evidenceKind: CapabilityEvidenceKind;
  passed: boolean;
  completedAt: string | Date;
  questionResults: CapabilityQuestionResult[];
}

export interface CapabilityPracticalLedgerRecord {
  evidenceId: string;
  proofKey: string;
  proofVersion: number;
  attemptNumber: number;
  status: CapabilityPracticalLedgerStatus;
  submittedAt: string | Date;
  reviewedAt?: string | Date | null;
  competencyLinks: Array<{
    deepDiveKey: string;
    competencyKey: string;
  }>;
}

export interface CapabilityEvidenceBucket {
  attempts: number;
  passedAttempts: number;
  latestAttemptAt: string | null;
  latestPassedAt: string | null;
}

export interface CapabilityPracticalEvidenceBucket {
  submissions: number;
  approvedSubmissions: number;
  latestSubmittedAt: string | null;
  latestApprovedAt: string | null;
}

export interface CapabilityCompetencyPracticalEvidence {
  submissions: number;
  approvedEvidence: boolean;
  latestApprovedAt: string | null;
  proofKeys: string[];
}

export interface CapabilityCompetencyLedgerEntry {
  competencyKey: string;
  deepDiveKey: string;
  evidence: Record<CapabilityEvidenceKind, {
    attempts: number;
    correctOnPassedAttempt: boolean;
    latestCorrectAt: string | null;
  }>;
  practical: CapabilityCompetencyPracticalEvidence;
}

export interface CapabilityDeepDiveLedgerEntry {
  deepDiveKey: string;
  evidence: Record<CapabilityEvidenceKind, CapabilityEvidenceBucket>;
  practical: CapabilityPracticalEvidenceBucket;
  competencies: CapabilityCompetencyLedgerEntry[];
}

export interface CapabilityLedger {
  deepDives: CapabilityDeepDiveLedgerEntry[];
  practicalProofs: Array<{
    evidenceId: string;
    proofKey: string;
    proofVersion: number;
    attemptNumber: number;
    status: CapabilityPracticalLedgerStatus;
    submittedAt: string;
    reviewedAt: string | null;
  }>;
}

const EVIDENCE_KINDS: CapabilityEvidenceKind[] = ["mastery", "retrieval", "transfer"];

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

function iso(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid capability evidence timestamp: ${String(value)}`);
  }
  return parsed.toISOString();
}

function emptyEvidenceBucket(): CapabilityEvidenceBucket {
  return {
    attempts: 0,
    passedAttempts: 0,
    latestAttemptAt: null,
    latestPassedAt: null,
  };
}

function emptyPracticalEvidenceBucket(): CapabilityPracticalEvidenceBucket {
  return {
    submissions: 0,
    approvedSubmissions: 0,
    latestSubmittedAt: null,
    latestApprovedAt: null,
  };
}

function emptyCompetencyEvidence() {
  return {
    mastery: { attempts: 0, correctOnPassedAttempt: false, latestCorrectAt: null },
    retrieval: { attempts: 0, correctOnPassedAttempt: false, latestCorrectAt: null },
    transfer: { attempts: 0, correctOnPassedAttempt: false, latestCorrectAt: null },
  } satisfies CapabilityCompetencyLedgerEntry["evidence"];
}

function emptyCompetencyPracticalEvidence(): CapabilityCompetencyPracticalEvidence {
  return {
    submissions: 0,
    approvedEvidence: false,
    latestApprovedAt: null,
    proofKeys: [],
  };
}

export function validateCapabilityAssessmentDefinition(definition: CapabilityAssessmentDefinition) {
  if (!definition.questions.length) {
    throw new Error("Capability assessment must contain questions.");
  }
  if (!EVIDENCE_KINDS.includes(definition.evidenceKind)) {
    throw new Error(`Unknown capability evidence kind: ${String(definition.evidenceKind)}`);
  }
  if (definition.passThresholdPercent <= 0 || definition.passThresholdPercent > 100) {
    throw new Error("Capability assessment pass threshold must be between 0 and 100.");
  }

  const seenQuestionKeys = new Set<string>();
  for (const question of definition.questions) {
    if (seenQuestionKeys.has(question.key)) {
      throw new Error(`Duplicate capability question key: ${question.key}`);
    }
    seenQuestionKeys.add(question.key);

    if (!(question.deepDiveKey || definition.deepDiveKey).trim()) {
      throw new Error(`Capability question ${question.key} must resolve to a Deep Dive.`);
    }

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
      deepDiveKey: question.deepDiveKey || definition.deepDiveKey,
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
    assessmentDeepDiveKey: definition.deepDiveKey,
    evidenceKind: definition.evidenceKind,
    coveredDeepDiveKeys: uniqueSorted(questionResults.map((result) => result.deepDiveKey)),
    totalQuestions: definition.questions.length,
    correctQuestions,
    percent,
    hasCriticalFail,
    criticalFailQuestionKeys,
    passed: percent >= definition.passThresholdPercent && !hasCriticalFail,
    questionResults,
  };
}

export function buildCapabilityLedger(
  attempts: CapabilityLedgerAttempt[],
  practicalRecords: CapabilityPracticalLedgerRecord[] = [],
): CapabilityLedger {
  const deepDiveMap = new Map<string, CapabilityDeepDiveLedgerEntry>();
  const countedAttemptDeepDives = new Set<string>();
  const countedPracticalDeepDives = new Set<string>();
  const countedPracticalCompetencies = new Set<string>();

  const ensureDeepDive = (deepDiveKey: string) => {
    let entry = deepDiveMap.get(deepDiveKey);
    if (!entry) {
      entry = {
        deepDiveKey,
        evidence: {
          mastery: emptyEvidenceBucket(),
          retrieval: emptyEvidenceBucket(),
          transfer: emptyEvidenceBucket(),
        },
        practical: emptyPracticalEvidenceBucket(),
        competencies: [],
      };
      deepDiveMap.set(deepDiveKey, entry);
    }
    return entry;
  };

  const ensureCompetency = (deepDive: CapabilityDeepDiveLedgerEntry, competencyKey: string) => {
    let competency = deepDive.competencies.find((entry) => entry.competencyKey === competencyKey);
    if (!competency) {
      competency = {
        competencyKey,
        deepDiveKey: deepDive.deepDiveKey,
        evidence: emptyCompetencyEvidence(),
        practical: emptyCompetencyPracticalEvidence(),
      };
      deepDive.competencies.push(competency);
    }
    return competency;
  };

  for (const attempt of attempts) {
    const completedAt = iso(attempt.completedAt);
    const attemptDeepDiveKeys = uniqueSorted(attempt.questionResults.map((result) => result.deepDiveKey));

    for (const deepDiveKey of attemptDeepDiveKeys) {
      const deepDive = ensureDeepDive(deepDiveKey);
      const bucket = deepDive.evidence[attempt.evidenceKind];
      const attemptDeepDiveIdentity = `${attempt.attemptId}:${deepDiveKey}`;
      if (!countedAttemptDeepDives.has(attemptDeepDiveIdentity)) {
        countedAttemptDeepDives.add(attemptDeepDiveIdentity);
        bucket.attempts += 1;
        if (attempt.passed) bucket.passedAttempts += 1;
        if (!bucket.latestAttemptAt || completedAt > bucket.latestAttemptAt) bucket.latestAttemptAt = completedAt;
        if (attempt.passed && (!bucket.latestPassedAt || completedAt > bucket.latestPassedAt)) {
          bucket.latestPassedAt = completedAt;
        }
      }

      for (const questionResult of attempt.questionResults.filter((result) => result.deepDiveKey === deepDiveKey)) {
        const competency = ensureCompetency(deepDive, questionResult.competencyKey);
        const competencyEvidence = competency.evidence[attempt.evidenceKind];
        competencyEvidence.attempts += 1;
        if (attempt.passed && questionResult.correct) {
          competencyEvidence.correctOnPassedAttempt = true;
          if (!competencyEvidence.latestCorrectAt || completedAt > competencyEvidence.latestCorrectAt) {
            competencyEvidence.latestCorrectAt = completedAt;
          }
        }
      }
    }
  }

  for (const practical of practicalRecords) {
    const submittedAt = iso(practical.submittedAt);
    const reviewedAt = practical.reviewedAt ? iso(practical.reviewedAt) : null;
    const approved = practical.status === "approved";

    for (const link of practical.competencyLinks) {
      const deepDive = ensureDeepDive(link.deepDiveKey);
      const practicalDeepDiveIdentity = `${practical.evidenceId}:${link.deepDiveKey}`;
      if (!countedPracticalDeepDives.has(practicalDeepDiveIdentity)) {
        countedPracticalDeepDives.add(practicalDeepDiveIdentity);
        deepDive.practical.submissions += 1;
        if (approved) deepDive.practical.approvedSubmissions += 1;
        if (!deepDive.practical.latestSubmittedAt || submittedAt > deepDive.practical.latestSubmittedAt) {
          deepDive.practical.latestSubmittedAt = submittedAt;
        }
        if (approved && reviewedAt && (!deepDive.practical.latestApprovedAt || reviewedAt > deepDive.practical.latestApprovedAt)) {
          deepDive.practical.latestApprovedAt = reviewedAt;
        }
      }

      const competency = ensureCompetency(deepDive, link.competencyKey);
      const practicalCompetencyIdentity = `${practical.evidenceId}:${link.deepDiveKey}:${link.competencyKey}`;
      if (!countedPracticalCompetencies.has(practicalCompetencyIdentity)) {
        countedPracticalCompetencies.add(practicalCompetencyIdentity);
        competency.practical.submissions += 1;
        competency.practical.proofKeys = uniqueSorted([...competency.practical.proofKeys, practical.proofKey]);
        if (approved) {
          competency.practical.approvedEvidence = true;
          if (reviewedAt && (!competency.practical.latestApprovedAt || reviewedAt > competency.practical.latestApprovedAt)) {
            competency.practical.latestApprovedAt = reviewedAt;
          }
        }
      }
    }
  }

  return {
    deepDives: Array.from(deepDiveMap.values())
      .map((entry) => ({
        ...entry,
        competencies: [...entry.competencies].sort((a, b) => a.competencyKey.localeCompare(b.competencyKey)),
      }))
      .sort((a, b) => a.deepDiveKey.localeCompare(b.deepDiveKey)),
    practicalProofs: practicalRecords
      .map((record) => ({
        evidenceId: record.evidenceId,
        proofKey: record.proofKey,
        proofVersion: record.proofVersion,
        attemptNumber: record.attemptNumber,
        status: record.status,
        submittedAt: iso(record.submittedAt),
        reviewedAt: record.reviewedAt ? iso(record.reviewedAt) : null,
      }))
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt)),
  };
}
