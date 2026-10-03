import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "scripts/import-private-capability-bank.ts"),
  "utf8",
);

test("private Capability import rejects negative-polarity single-choice traps", () => {
  assert.match(source, /AMBIGUOUS_SINGLE_CHOICE_STEM_PATTERNS/);
  assert.match(source, /Rewrite it as a positive\/diagnostic question/);
});

test("private Capability import requires intentional question-type variation", () => {
  assert.match(source, /flattened into single-choice only/);
  assert.match(source, /multi-select exposes fewer than five options/);
  assert.match(source, /multi-select must contain at least two defensible answers/);
  assert.match(source, /sequence exposes fewer than four ordered steps/);
});

test("private Capability import requires evidence-based authority teaching", () => {
  assert.match(source, /AUTHORITY_COMPETENCY_PATTERN/);
  assert.match(source, /EVIDENCE_AUTHORITY_RATIONALE_PATTERN/);
  assert.match(source, /not obedience to software/);
});


test("private Capability import blocks distractor shortcuts", () => {
  assert.match(source, /assertCapabilityOptionParity/);
  assert.match(source, /option parity max-key/);
});
