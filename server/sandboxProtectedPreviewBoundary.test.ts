import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const script=new URL("../scripts/sandboxQualificationProtectedPreview.mjs",import.meta.url);
const workflow=readFileSync(new URL("../.github/workflows/sandbox-qualification-protected-preview.yml",import.meta.url),"utf8");

test("protected Preview script is valid JavaScript",()=>{
 assert.doesNotThrow(()=>execFileSync(process.execPath,["--check",script.pathname],{stdio:"pipe"}));
});
test("new acceptance does not submit reps, change readiness, update stages or mutate Proof DB",()=>{
 const body=readFileSync(script,"utf8");
 assert.doesNotMatch(body,/fetchApi\([^\n]*\b(PUT|PATCH|DELETE)\b/);
 assert.doesNotMatch(body,/\/api\/tutor\/sandbox-environment\/rep/);
 assert.doesNotMatch(body,/\/api\/td\/tutors\/[^\"']*assessment/);
 assert.doesNotMatch(body,/\/api\/tutor\/sandbox-environment\/preparation\",\s*\{/);
 assert.match(body,/PROOF_EXPECTED_SHA/);
 assert.match(body,/supabaseProjectRef/);
 assert.match(body,/sandbox-qualification-review/);
});
test("acceptance requires protected manually dispatched environment, not PR secrets",()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/environment: capability-proof-acceptance/);
 assert.doesNotMatch(workflow,/pull_request:/);
 assert.doesNotMatch(workflow,/push:/);
 assert.match(workflow,/secrets\.RI_PROOF_TD_EMAIL/);
 assert.match(workflow,/secrets\.RI_PROOF_SPECIALIST_EMAIL/);
});
