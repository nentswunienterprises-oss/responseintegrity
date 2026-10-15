import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./sandboxRediagnosis.ts",import.meta.url),"utf8");

test("cross-mode submissions only capture after explicit protected feature activation",()=>{
 assert.match(source,/RI_SANDBOX_CROSSMODE_CAPTURE_V1/);
 assert.match(source,/process\.env\.RI_SANDBOX_CROSSMODE_CAPTURE_V1 === "true"/);
});
test("exact immutable replay is accepted but conflicting observations and truth cannot overwrite",()=>{
 assert.match(source,/ON CONFLICT \(tutor_assignment_id,form_id\) DO NOTHING/);
 assert.match(source,/JOIN private\.specialist_sandbox_live_evidence_truth/);
 assert.match(source,/e\.specialist_submission=\$14::jsonb/);
 assert.match(source,/t\.canonical_observations=\$22::jsonb/);
 assert.match(source,/t\.outcome_version=\$21/);
 assert.match(source,/throw httpError\(409, "The previous Sandbox evidence record conflicts/);
 assert.doesNotMatch(source,/ON CONFLICT \(tutor_assignment_id,form_id\) DO UPDATE/);
});
