import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sqlPath = new URL("../docs/review-only/sandbox-diagnosis-bank-v2.sql", import.meta.url);
const sql = fs.readFileSync(sqlPath, "utf8");

test("V2 diagnosis bank SQL remains a review artifact outside executable migrations", () => {
  assert.match(sqlPath.pathname, /docs\/review-only\/sandbox-diagnosis-bank-v2\.sql$/);
  assert.doesNotMatch(sql, /^\s*(?:begin|commit)\s*;/im);
  assert.match(sql, /Do not execute directly/i);
  assert.match(sql, /transaction boundary/i);
});

test("V2 draft preserves V1 and refuses unexpected source state", () => {
  assert.match(sql, /bank_version = 1[\s\S]*?active = true[\s\S]*?\) <> 56/);
  assert.match(sql, /select\s+bank_key,\s+2,[\s\S]*?false\s+from private\.specialist_sandbox_environment_banks/i);
  assert.doesNotMatch(sql, /(?:update|delete\s+from)\s+private\.specialist_sandbox_(?:environment_banks|diagnosis_outcomes)/i);
  assert.match(sql, /V2 must remain inactive/i);
});

test("V2 draft consolidates the four known duplicate outcome keys only in the new version", () => {
  for (const key of [
    "clarity.recognition.pattern_5",
    "difficulty.recovery.pattern_5",
    "execution.repeatability.pattern_5",
    "time.consistency.pattern_5",
  ]) assert.ok(sql.includes(key), `missing duplicate exclusion: ${key}`);
  assert.match(sql, /Expected 52 active V2 diagnosis outcomes/);
  assert.match(sql, /V2 contains % duplicate canonical outcome signatures/);
});

test("V2 stacked narratives identify the canonical confounded method dimension", () => {
  for (const key of [
    "stack.challenge_no_timer.pattern_8",
    "stack.normal_independent.pattern_8",
    "stack.timed_challenge.pattern_8",
  ]) {
    assert.ok(sql.includes(key), `missing narrative correction: ${key}`);
  }
  assert.match(sql, /method-understanding behaviour, which is confounded/);
  assert.match(sql, /earlier Clarity and Structured Execution layers are intact/);
});


test("V2 carries the complete active Training bank without changing its observation contract", () => {
  assert.match(sql, /insert into private\.specialist_sandbox_rep_outcomes[\s\S]*?source\.bank_version = 1[\s\S]*?source\.active = true/i);
  assert.match(sql, /copied_training_rows <> source_training_rows/);
  assert.match(sql, /source_training_groups <> 36/);
  assert.ok(sql.includes("outcome_key NOT LIKE '%.pattern_7'"));
  assert.match(sql, /trajectoryClass', ''\) <> 'not_observed'/);
  assert.match(sql, /V2 Training has a phase\/set\/rep group outside the runtime 6-10 eligible outcome contract/i);
  assert.match(sql, /V2 Training phase\/set\/rep coverage differs/i);
});

test("V2 validates complete diagnosis probe coverage before activation", () => {
  for (const probe of [
    "clarity.recognition",
    "difficulty.recovery",
    "execution.repeatability",
    "time.consistency",
    "stack.challenge_no_timer",
    "stack.normal_independent",
    "stack.timed_challenge",
  ]) assert.ok(sql.includes(probe), `missing expected diagnosis probe: ${probe}`);
  assert.match(sql, /count\(distinct probe_id\)[\s\S]*?<> 7/);
  assert.match(sql, /having count\(\*\) < 6 or count\(\*\) > 10/);
});

test("Corrected stacked narratives are tied to canonical clarity.method confounding", () => {
  assert.match(sql, /observation->>'dimensionId' = 'clarity\.method'/);
  assert.match(sql, /observation->>'behaviorId' = 'confounded'/);
  assert.match(sql, /exactly one canonical clarity\.method\/confounded observation each/i);
});
