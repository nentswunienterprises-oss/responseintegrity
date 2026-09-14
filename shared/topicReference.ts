export const TOPIC_REFERENCE_SCHEMA_VERSION = 1 as const;
export const TOPIC_REFERENCE_FIELD_MAX_LENGTH = 4000;

export type TopicReferenceContent = {
  vocabulary: string;
  method: string;
  steps: string;
  reason: string;
};

export type TopicReference = TopicReferenceContent & {
  schemaVersion: typeof TOPIC_REFERENCE_SCHEMA_VERSION;
  createdAt: string;
  createdByTutorId: string;
};

const TOPIC_REFERENCE_FIELDS: Array<keyof TopicReferenceContent> = [
  "vocabulary",
  "method",
  "steps",
  "reason",
];

export function normalizeTopicReferenceContent(value: unknown): TopicReferenceContent | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const normalized = Object.fromEntries(
    TOPIC_REFERENCE_FIELDS.map((field) => [field, String(source[field] || "").trim()]),
  ) as TopicReferenceContent;

  if (TOPIC_REFERENCE_FIELDS.some((field) => !normalized[field])) return null;
  if (TOPIC_REFERENCE_FIELDS.some((field) => normalized[field].length > TOPIC_REFERENCE_FIELD_MAX_LENGTH)) {
    return null;
  }

  return normalized;
}

export function parseStoredTopicReference(value: unknown): TopicReference | null {
  const content = normalizeTopicReferenceContent(value);
  if (!content || !value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const createdAt = String(source.createdAt || "").trim();
  const createdByTutorId = String(source.createdByTutorId || "").trim();
  if (!createdAt || !createdByTutorId) return null;

  return {
    ...content,
    schemaVersion: TOPIC_REFERENCE_SCHEMA_VERSION,
    createdAt,
    createdByTutorId,
  };
}
