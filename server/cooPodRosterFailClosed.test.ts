import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync("client/src/pages/executive/coo/pod-detail.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");

function section(source: string, start: string, end: string) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "section boundaries must remain available");
  return source.slice(a, b);
}

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


test("COO Pod statistics use parameterized protected PostgreSQL reads for both sources", () => {
  const stats = section(routes, "// Get pod statistics", "// Get students for a specific tutor (COO view)");
  assert.match(stats, /requireRole\(\["coo"\]\)/);
  assert.match(stats, /pool\.query/);
  assert.match(stats, /FROM public\.parent_enrollments/);
  assert.match(stats, /assigned_tutor_id = ANY\(\$1::varchar\[\]\)/);
  assert.match(stats, /status::text = ANY\(\$2::text\[\]\)/);
  assert.match(stats, /FROM public\.scheduled_sessions/);
  assert.match(stats, /tutor_id = ANY\(\$1::varchar\[\]\)/);
  assert.doesNotMatch(stats, /\.from\(["']parent_enrollments["']\)|\.from\(["']scheduled_sessions["']\)/);
});

test("COO assignment and roster projections do not turn denied reads into empty data", () => {
  const allAssignments = section(routes, "// Get all tutor assignments across all pods", "// Get pod statistics");
  assert.match(allAssignments, /requireRole\(\["coo"\]\)/);
  assert.match(allAssignments, /SELECT tutor_id FROM public\.tutor_assignments/);
  assert.match(allAssignments, /res\.status\(500\)\.json/);
  const loadStats = section(routes, "async function loadTutorAssignmentLoadStats(", "function derivePodOperatingState(");
  assert.match(loadStats, /FROM public\.parent_enrollments/);
  assert.match(loadStats, /assigned_tutor_id = \$1/);
  assert.match(loadStats, /status::text = ANY\(\$2::text\[\]\)/);
  assert.doesNotMatch(loadStats, /assigned_tutor_id = \$1::uuid/);
});
