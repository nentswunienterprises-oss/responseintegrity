import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync("client/src/pages/executive/coo/pod-detail.tsx", "utf8");

test("COO roster distinguishes failed reads from a genuinely empty roster", () => {
  assert.match(detail, /isError: assignedTutorsError/);
  assert.match(detail, /isError: podTutorsError/);
  assert.match(detail, /isError: podStatsError/);
  assert.match(detail, /Assigned Specialist roster could not be loaded/);
  assert.match(detail, /Specialist roster returned an invalid response/);
  assert.match(detail, /Assigned Specialist roster is incomplete/);
  assert.match(detail, /No Specialists assigned yet/);
});

test("COO roster edits require complete, matching authoritative reads", () => {
  assert.match(detail, /const canEditRoster = !podTutorsError && !podStatsError && !assignedTutorsError/);
  assert.match(detail, /podTutors\.length === podStats\.totalTutors/);
  assert.match(detail, /Array\.isArray\(assignedTutorIds\)/);
  assert.match(detail, /const availableSlots = canEditRoster \?/);
  assert.match(detail, /canEditRoster && availableSlots > 0/);
  assert.match(detail, /disabled=\{!canEditRoster \|\| removeTutorMutation\.isPending\}/);
  assert.match(detail, /isExpanded && canEditRoster/);
});

test("COO operating state never reports Loading or stale metrics after a failed projection", () => {
  assert.match(detail, /isError: operatingOverviewError/);
  assert.match(detail, /Operating state unavailable\. No state has been inferred\./);
  assert.match(detail, /!operatingOverviewError && operatingOverview\?\.operatingState\?\.key/);
  assert.match(detail, /refetchOperatingOverview/);
});

test("malformed Specialist records cannot crash the roster identity display", () => {
  assert.match(detail, /String\(assignment\.tutorName \|\| "\?"\)/);
  assert.match(detail, /assignment\.tutorName \|\| "Specialist record unavailable"/);
});
