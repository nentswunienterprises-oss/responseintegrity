import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { proposalRequiresConfirmedIntroSession } from "./proposalBookingGate";

test("proposal booking requirement matches the Specialist scheduling mode", () => {
  assert.equal(proposalRequiresConfirmedIntroSession("training"), false);
  assert.equal(proposalRequiresConfirmedIntroSession("sandbox"), false);
  assert.equal(proposalRequiresConfirmedIntroSession("trial"), true);
  assert.equal(proposalRequiresConfirmedIntroSession("certified_live"), true);
});

test("proposal route keeps assignment and completed-diagnosis gates when booking is optional", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const proposalStart = routesSource.indexOf('app.post("/api/tutor/proposal"');
  const proposalEnd = routesSource.indexOf("// Get proposal by ID (Parent or Tutor)", proposalStart);
  const proposalRoute = routesSource.slice(proposalStart, proposalEnd);

  assert.ok(proposalStart >= 0);
  assert.ok(proposalEnd > proposalStart);
  assert.match(proposalRoute, /getTutorOperationalMode\(tutorId\)/);
  assert.match(proposalRoute, /proposalRequiresConfirmedIntroSession\(operationalMode\)/);
  assert.match(proposalRoute, /Accept this assignment before sending a proposal/);
  assert.match(proposalRoute, /Diagnosis finalization is incomplete/);
  assert.match(proposalRoute, /status = 'completed'/);
  assert.match(proposalRoute, /source_drill_id::text = id::text/);
});
