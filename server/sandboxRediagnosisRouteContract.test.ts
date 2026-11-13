import assert from "node:assert/strict";
import test from "node:test";
import { parseSandboxRediagnosisActionInput } from "./sandboxRediagnosisRouteContract";
import { buildSandboxRediagnosisTrajectoryLookup } from "./sandboxRediagnosisTrajectoryLookup";
import { selectSandboxRediagnosisTrajectoryCandidate } from "./sandboxRediagnosisEpisode";

const base = {
  tutorAssignmentId: "assignment-1",
  tutorId: "specialist-1",
  studentId: "student-1",
  trajectoryId: "trajectory-v1",
  rediagnosisRunId: "a19ac343-a8b5-4e42-83f1-c9cc39b9518b",
  scheduledSessionId: "c37d2103-85b8-4d89-a1b0-66fc211bc1ef",
};

test("resolve and continue route contract requires and forwards trajectory plus run identity", () => {
  const { tutorId: _tutorId, ...body } = base;
  const parsed = parseSandboxRediagnosisActionInput(body, base.tutorId);
  assert.equal(parsed.trajectoryId, base.trajectoryId);
  assert.equal(parsed.rediagnosisRunId, base.rediagnosisRunId);
  assert.throws(() => parseSandboxRediagnosisActionInput({ ...body, trajectoryId: undefined }, base.tutorId));
  assert.throws(() => parseSandboxRediagnosisActionInput({ ...body, unexpected: true }, base.tutorId));
});

test("trajectory lookup binds explicit trajectory and run IDs to assignment, tutor, and student", () => {
  const { sql, values } = buildSandboxRediagnosisTrajectoryLookup({ ...base, bankKey: "sandbox_stateful_environment" });
  assert.deepEqual(values, [base.tutorAssignmentId, base.tutorId, base.studentId,
    "sandbox_stateful_environment", base.trajectoryId, base.rediagnosisRunId]);
  assert.match(sql, /AND \(\$5::varchar IS NULL OR t\.id = \$5\)/);
  assert.match(sql, /requested_run\.id = \$6 AND requested_run\.trajectory_id = t\.id/);
  assert.match(sql, /requested_run\.tutor_assignment_id = \$1/);
  assert.match(sql, /requested_run\.tutor_id = \$2 AND requested_run\.student_id = \$3/);
  assert.match(sql, /WHERE t\.tutor_assignment_id = \$1[\s\S]*AND t\.tutor_id = \$2[\s\S]*AND t\.student_id = \$3/);
});

test("a missing or unrelated exact identity cannot fall through to an active-bank candidate", () => {
  const lookup = buildSandboxRediagnosisTrajectoryLookup({ ...base, trajectoryId: "stale-trajectory", bankKey: "sandbox_stateful_environment" });
  assert.equal(lookup.values[4], "stale-trajectory");
  const candidates = [
    { id: "new-v2", trajectory_resolution_priority: 2 },
  ];
  assert.equal(selectSandboxRediagnosisTrajectoryCandidate(candidates), candidates[0]);
  assert.equal(selectSandboxRediagnosisTrajectoryCandidate([]), null);
});
