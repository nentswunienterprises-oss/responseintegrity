import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes.ts", "utf8");
const detail = readFileSync("client/src/pages/executive/coo/pod-detail.tsx", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");

function section(source: string, start: string, end: string) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "section boundaries must remain available");
  return source.slice(a, b);
}

test("Pod #5 roster and operating overview use the same protected Hub assignment load", () => {
  const helper = section(routes, "async function loadTutorAssignmentLoadStats(", "function derivePodOperatingState(");
  assert.match(helper, /if \(isTheHubDatabaseRuntime\(\)\)/);
  assert.match(helper, /FROM public\.parent_enrollments/);
  assert.match(helper, /assigned_tutor_id = \$1::uuid/);
  assert.match(helper, /status = ANY\(\$2::enrollment_status\[\]\)/);
  assert.match(helper, /\[tutorId, \[\.\.\.new Set/);
  assert.match(helper, /throw new Error\(`Failed to load tutor assignment stats:/);
  const roster = section(routes, '"/api/coo/pods/:podId/tutors"', '// Get all tutor assignments across all pods');
  const overview = section(routes, 'async function buildPodOperatingOverview(', 'function usesDirectProofSessionDatabase(');
  assert.match(roster, /requireRole\(\["coo"\]\)/);
  assert.match(roster, /loadTutorAssignmentLoadStats\(assignment\.tutorId\)/);
  assert.match(overview, /loadTutorAssignmentLoadStats\(assignment\.tutorId\)/);
  assert.match(overview, /derivePodOperatingState\(modeCounts, assignments\.length\)/);
});

test("assignment authority does not come from a client-side count or synthetic fixture", () => {
  assert.match(storage, /SELECT id, tutor_id, pod_id, student_count, certification_status, operational_mode, created_at[\s\S]*FROM public\.tutor_assignments[\s\S]*WHERE pod_id = \$1/);
  assert.match(detail, /podStats\.totalTutors !== podTutors\.length/);
  assert.match(detail, /Roster incomplete:/);
  assert.match(detail, /Specialist record unavailable/);
  assert.doesNotMatch(detail, /Array\.from\(\{ length: podStats\?\.totalTutors/);
});

test("roster denies/failures, partial shapes and an actual empty list are distinct", () => {
  const list = section(detail, "{/* Specialists List */}", "{/* Add Specialists Button */}");
  assert.match(list, /podTutorsLoading \?/);
  assert.match(list, /podTutorsError \?/);
  assert.match(list, /!Array\.isArray\(podTutors\)/);
  assert.match(list, /podTutors\.length === 0/);
  assert.match(list, /No Specialists assigned yet/);
  assert.match(list, /Retry roster/);
  assert.match(list, /String\(assignment\.tutorName \|\| "\?"\)/);
});

test("operating state does not remain Loading after a failed or missing projection", () => {
  const sectionText = section(detail, "Pod Operating Model", "{/* Territory Director */}");
  assert.match(sectionText, /operatingOverviewError/);
  assert.match(sectionText, /operatingOverviewLoading/);
  assert.match(sectionText, /"Unavailable"/);
  assert.match(sectionText, /No state has been inferred/);
  assert.match(sectionText, /refetchOperatingOverview/);
});

test("COO-only API boundary and Specialist names-only Pod Team remain separate", () => {
  const overviewRoute = section(routes, '"/api/coo/pods/operating-overview"', '"/api/tutor/students/:studentId/communications"');
  const rosterRoute = section(routes, '"/api/coo/pods/:podId/tutors"', '// Get all tutor assignments across all pods');
  assert.match(overviewRoute, /requireRole\(\["coo"\]\)/);
  assert.match(rosterRoute, /requireRole\(\["coo"\]\)/);
  const podTeam = readFileSync("client/src/pages/operational/tutor/pod.tsx", "utf8");
  assert.match(podTeam, /Pod team view shows names only/);
  assert.doesNotMatch(podTeam, /podTeamData\.territoryDirector\.email/);
});


test("failed operating overview hides stale state metrics", () => {
  const operating = section(detail, "Pod Operating Model", "{/* Territory Director */}");
  assert.ok(operating.includes("!operatingOverviewError && operatingOverview?.operatingState?.key"));
  assert.ok(operating.includes("!operatingOverviewError && operatingOverview?.operatingState?.description"));
  assert.match(operating, /No state has been inferred/);
});

test("zero returned rows never erase four authoritative assignments", () => {
  const list = section(detail, "{/* Specialists List */}", "{/* Add Specialists Button */}");
  assert.ok(list.includes("podTutors.length === 0 && (podStats?.totalTutors || 0) > 0"));
  assert.ok(list.includes("Assigned Specialist roster is incomplete"));
  assert.ok(list.includes("podTutors.filter((assignment: any) => assignment && typeof assignment.id"));
});

test("all-assignment protection never treats a denied read as an empty set", () => {
  const all = section(routes, "// Get all tutor assignments across all pods", "// Get pod statistics");
  assert.ok(all.includes('requireRole(["coo"])'));
  assert.ok(all.includes("if (isTheHubDatabaseRuntime())"));
  assert.ok(all.includes("SELECT tutor_id FROM public.tutor_assignments"));
  assert.ok(all.includes("if (error) throw new Error"));
  assert.ok(all.includes("if (!Array.isArray(data)) throw new Error"));
  assert.ok(all.includes('res.status(500).json({ message: "Failed to fetch tutor assignments" })'));
  assert.ok(!all.includes("if (!assignments)"));
});

test("Pod stats count actual assignments and fail closed on missing sources", () => {
  const stats = section(routes, "// Get pod statistics", "// Get students for a specific tutor (COO view)");
  assert.ok(stats.includes('requireRole(["coo"])'));
  assert.ok(stats.includes("const totalTutors = assignments.length"));
  assert.ok(stats.includes("FROM public.parent_enrollments"));
  assert.ok(stats.includes("FROM public.scheduled_sessions"));
  assert.ok(stats.includes("assigned_tutor_id = ANY($1::uuid[])"));
  assert.ok(stats.includes("status = ANY($2::enrollment_status[])"));
  assert.ok(stats.includes("if (enrollments.error)"));
  assert.ok(stats.includes("if (sessions.error)"));
  assert.ok(stats.includes('res.status(500).json({ message: "Failed to fetch pod statistics" })'));
});

test("COO UI never offers empty roster capacity after a failed read", () => {
  assert.ok(detail.includes("const canEditRoster = !podTutorsError && !podStatsError && !assignedTutorsError"));
  assert.ok(detail.includes("podTutors.length === podStats.totalTutors"));
  assert.ok(detail.includes("const availableSlots = canEditRoster ?"));
  assert.ok(detail.includes('podStatsError ? "Unavailable"'));
  assert.ok(detail.includes("podStats?.totalTutors"));
});
