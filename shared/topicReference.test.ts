import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTopicReferenceContent,
  parseStoredTopicReference,
  TOPIC_REFERENCE_FIELD_MAX_LENGTH,
} from "./topicReference";

test("normalizes a complete topic reference", () => {
  assert.deepEqual(
    normalizeTopicReferenceContent({
      vocabulary: "  coefficient  ",
      method: "  isolate the variable  ",
      steps: "  1. Simplify\n2. Balance  ",
      reason: "  both sides remain equal  ",
    }),
    {
      vocabulary: "coefficient",
      method: "isolate the variable",
      steps: "1. Simplify\n2. Balance",
      reason: "both sides remain equal",
    },
  );
});

test("rejects incomplete or oversized topic references", () => {
  assert.equal(
    normalizeTopicReferenceContent({ vocabulary: "terms", method: "method", steps: "steps", reason: "" }),
    null,
  );
  assert.equal(
    normalizeTopicReferenceContent({
      vocabulary: "x".repeat(TOPIC_REFERENCE_FIELD_MAX_LENGTH + 1),
      method: "method",
      steps: "steps",
      reason: "reason",
    }),
    null,
  );
});

test("parses only stored references with creation lineage", () => {
  assert.equal(
    parseStoredTopicReference({ vocabulary: "terms", method: "method", steps: "steps", reason: "reason" }),
    null,
  );
  assert.deepEqual(
    parseStoredTopicReference({
      vocabulary: "terms",
      method: "method",
      steps: "steps",
      reason: "reason",
      schemaVersion: 1,
      createdAt: "2026-09-03T12:00:00.000Z",
      createdByTutorId: "specialist-1",
    }),
    {
      vocabulary: "terms",
      method: "method",
      steps: "steps",
      reason: "reason",
      schemaVersion: 1,
      createdAt: "2026-09-03T12:00:00.000Z",
      createdByTutorId: "specialist-1",
    },
  );
});
