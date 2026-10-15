import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const server=readFileSync(new URL("./sandboxEnvironment.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("./routes/sandboxEnvironment.ts",import.meta.url),"utf8");
const client=readFileSync(new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx",import.meta.url),"utf8");
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
 assert.match(server,/form\.eventFormId !== input\.eventFormId/);
 assert.match(server,/form\.rep\.setId !== input\.attestedSetId/);
 assert.match(server,/condition_contract_sha256=\$11/);
 assert.match(server,/Confirm the prescribed pre-session plan before the first Sandbox rep/);
});
test("no simulated student behavior is exposed before preparation is accepted",()=>{
 assert.match(server,/studentBehavior: preparationCaptureEnabled &&/);
 assert.match(server,/planned\.completedInSession === 0 && !preparationRecorded/);
 assert.match(server,/\? ""\s*:\s*planned\.selected\.studentBehavior/);
});

test("preparation UI captures explicit checks and protected tables do not expose private canonical truth",()=>{
 assert.match(client,/form\.preparationCaptureEnabled/);
 assert.match(client,/form\.preparationRecorded/);
 assert.match(client,/\/api\/tutor\/sandbox-environment\/preparation/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.specialist_sandbox_preparation_events/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.specialist_sandbox_preparation_events FROM PUBLIC, anon, authenticated/);
 assert.doesNotMatch(sql,/GRANT SELECT ON .*specialist_sandbox_preparation_events TO authenticated/);
});
