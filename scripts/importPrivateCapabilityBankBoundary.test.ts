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

test("database mutation still requires the explicit apply flag", () => {
  assert.match(source, /args\.includes\("--apply"\)/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /activated \$\{assessment\.assessmentKey\}/);
});
