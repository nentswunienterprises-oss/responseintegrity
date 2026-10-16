import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const server=readFileSync(new URL("./sandboxEnvironment.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("./routes/sandboxEnvironment.ts",import.meta.url),"utf8");
const client=readFileSync(new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx",import.meta.url),"utf8");
const map=readFileSync(new URL("../client/src/components/tutor/StudentTopicConditioningDialog.tsx",import.meta.url),"utf8");
const sql=readFileSync(new URL("../docs/migration-proposals/20261015_sandbox_coverage_crossmode_evidence.sql",import.meta.url),"utf8");

test("preparation capture stays dormant without explicit Proof-approved feature activation",()=>{
 assert.match(server,/RI_SANDBOX_PREPARATION_CAPTURE_V1 === "true"/);
 assert.match(server,/RI_SANDBOX_PREPARATION_CAPTURE_V1 !== "true"/);
 assert.match(route,/app\.post\("\/api\/tutor\/sandbox-environment\/preparation", isAuthenticated/);
 assert.match(route,/requireSpecialist\(req, res\)/);
 assert.match(route,/z\.literal\(true\)/);
});
test("first Sandbox rep cannot start without the exact native preparation plan",()=>{
 assert.match(server,/planned\.completedInSession === 0/);
 assert.match(server,/form\.rep\.repNumber !== 1/);
 assert.match(server,/form\.prescribedPhase !== input\.attestedPhase/);
 assert.match(server,/actualFingerprint !== input\.planFingerprint/);
 assert.match(server,/form\.eventFormId/);
 assert.match(server,/condition_contract_sha256=\$11/);
 assert.match(server,/Confirm the prescribed pre-session plan before the first Sandbox rep/);
});
test("no simulated student behavior is exposed before preparation is accepted",()=>{
 assert.match(server,/studentBehavior: preparationCaptureEnabled &&/);
 assert.match(server,/planned\.completedInSession === 0 && !preparationRecorded/);
 assert.match(server,/\? ""\s*:\s*planned\.selected\.studentBehavior/);
});

test("existing Map is the only preparation confirmation; Sandbox runner never repeats the checkbox",()=>{
 assert.match(map,/sessionPrepChecks/);
 assert.match(map,/\/api\/tutor\/sandbox-environment\/preparation"/);
 assert.match(map,/sandboxMapPreparationQuery/);
 assert.match(map,/planFingerprint: plan\.planFingerprint/);
 assert.doesNotMatch(client,/setPrepProblemReady|setPrepConditionsReady|recordPreparation\.mutate/);
 assert.doesNotMatch(client,/\/api\/tutor\/sandbox-environment\/preparation"/);
 assert.match(client,/Return to Pod and Map/);
 assert.match(client,/form\.preparationCaptureEnabled/);
 assert.match(client,/form\.preparationRecorded/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.specialist_sandbox_preparation_events/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.specialist_sandbox_preparation_events FROM PUBLIC, anon, authenticated/);
 assert.doesNotMatch(sql,/GRANT SELECT ON .*specialist_sandbox_preparation_events TO authenticated/);
});

test("Map preparation receipt requires assigned Sandbox mode and rejects browser-supplied rep lineage",()=>{
 assert.match(route,/authority\.mode !== "sandbox"/);
 assert.match(route,/tutorAssignmentId: authority\.assignmentId/);
 assert.match(route,/parseSandboxPreparationQuery\(req\.query\)/);
 assert.match(route,/planFingerprint: z\.string\(\)\.regex/);
 assert.match(server,/sandboxPreparationFingerprint\(\{/);
 assert.match(map,/setSessionPrepChecks\(\{\}\)/);
 assert.match(map,/sandboxPreparationPending/);
});

test("partially completed Sandbox lessons resume without a new preparation receipt",()=>{
 assert.match(server,/completedReps: form\.sessionProgress\.completedReps/);
 assert.match(map,/plan\.status === "rep_ready" && \(plan\.completedReps \?\? 0\) === 0/);
 assert.match(map,/Resume.*Sandbox Training/);
 assert.match(map,/setSessionPrepChecks\(\{\}\)/);
});
test("Map uses safe current prescribed sets, not historical projected phase as evidence truth",()=>{
 assert.match(route,/getSandboxSessionPreparationPreview/);
 assert.match(server,/getSandboxSessionPreparationPreview\(input:/);
 assert.match(server,/sets: schema\.sets\.map\(set =>/);
 assert.match(map,/Current Sandbox prescription/);
 assert.match(map,/sandboxMapPreparationQuery\.data\.prescribedPhase/);
 assert.doesNotMatch(map,/studentBehavior:.*sandboxMapPreparationQuery/);
});
