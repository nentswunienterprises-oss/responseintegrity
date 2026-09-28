import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./import-private-capability-bank.ts", import.meta.url), "utf8");

test("private bank validation uses the public capability blueprint before database apply", () => {
  assert.match(source, /validateCapabilityAssessmentAgainstBlueprint/);
  assert.match(source, /summarizeCapabilityBankCoverage/);
  assert.match(source, /blueprint coverage/);
  assert.match(source, /missingEvidenceCells/);
});

test("validation-only mode does not import or open the production database module", () => {
  const topLevelImports = source.slice(0, source.indexOf("const optionSchema"));
  assert.doesNotMatch(topLevelImports, /server\/db/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /No database connection was opened/);
  assert.match(source, /await import\("\.\.\/server\/db"\)/);
});

test("full MVP coverage can be required without forcing incremental authoring to pretend complete", () => {
  assert.match(source, /--require-mvp-coverage/);
  assert.match(source, /requireMvpCoverage && coverage\.missingEvidenceCells\.length > 0/);
  assert.match(source, /Missing \$\{coverage\.missingEvidenceCells\.length\} of 33 required evidence cells/);
});

test("database mutation requires apply and imports banks inactive without rotating the active release", () => {
  assert.match(source, /args\.includes\("--apply"\)/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /staged inactive \$\{assessment\.assessmentKey\}/);
  assert.match(source, /await client\.query\("BEGIN"\)/);
  assert.match(source, /await client\.query\("COMMIT"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
  assert.match(source, /atomic import complete/);
  assert.match(source, /No bank was activated or retired/);
  assert.doesNotMatch(source, /SET active = false/);
  assert.doesNotMatch(source, /SET active = true/);
});


test("private bank validation rejects authoring-only review text from learner-facing copy", () => {
  assert.match(source, /AUTHORING_LEAK_PATTERNS/);
  assert.match(source, /assertNoAuthoringLeak/);
  assert.match(source, /completion-status counter/);
  assert.match(source, /authoring workflow language/);
  assert.match(source, /review-state language/);
  assert.match(source, /reviewer voice/);
  assert.match(source, /authoring heading/);
  assert.match(source, /item\.explanation/);
  assert.match(source, /option-feedback/);
});


test("private bank validation rejects implementation jargon from learner-facing copy", () => {
  assert.match(source, /LEARNER_COPY_JARGON_PATTERNS/);
  assert.match(source, /assertNoLearnerCopyJargon/);
  assert.match(source, /implementation field name/);
  assert.match(source, /implementation authority name/);
  assert.match(source, /implementation vocabulary/);
  assert.match(source, /runner vocabulary/);
  assert.match(source, /plain Specialist language/);
});
