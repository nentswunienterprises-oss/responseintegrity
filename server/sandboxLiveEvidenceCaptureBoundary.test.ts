import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./sandboxRediagnosis.ts",import.meta.url),"utf8");

test("cross-mode submissions only capture after explicit protected feature activation",()=>{
 assert.match(source,/RI_SANDBOX_CROSSMODE_CAPTURE_V1/);
 assert.match(source,/process\.env\.RI_SANDBOX_CROSSMODE_CAPTURE_V1 === "true"/);
});
test("refresh retries acknowledge an existing immutable turn without replacing its original submission",()=>{
 assert.match(source,/ON CONFLICT \(tutor_assignment_id,form_id\) DO NOTHING/);
 assert.match(source,/JOIN private\.specialist_sandbox_live_evidence_truth/);
 assert.match(source,/t\.canonical_observations=\$18::jsonb/);
 assert.match(source,/t\.outcome_version=\$17/);
 assert.match(source,/alreadyRecorded: true as const/);
 assert.match(source,/The immutable turn already committed/);
 assert.doesNotMatch(source,/e\.specialist_submission=\$14::jsonb/);
 assert.doesNotMatch(source,/ON CONFLICT \(tutor_assignment_id,form_id\) DO UPDATE/);
});

test("conflicting immutable cross-mode replay cannot grant new capability evidence",()=>{
 const capture=source.indexOf('if (process.env.RI_SANDBOX_CROSSMODE_CAPTURE_V1 === "true")');
 const reject=source.indexOf('The previous Sandbox evidence record conflicts with this submission');
 const grant=source.indexOf('await insertCapabilityEvidence({',capture);
 assert.ok(capture>=0&&reject>capture&&grant>reject,
   "Captured truth must be verified before scoring the submitted capability.");
});
