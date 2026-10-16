import test from "node:test";
import assert from "node:assert/strict";
import { parseSandboxPreparationQuery } from "./sandboxPreparationQuery.ts";

const domain = {
  studentId: "synthetic-student",
  scheduledSessionId: "11111111-2222-4333-8444-555555555555",
  topic: "qa clarity",
};
test("preparation accepts native and Vercel forwarded queries identically", () => {
  assert.deepEqual(parseSandboxPreparationQuery(domain), domain);
  assert.deepEqual(parseSandboxPreparationQuery({
    ...domain, path: "tutor/sandbox-environment/preparation-plan",
    host: "synthetic-preview.vercel.app",
    __previewPath: ["tutor","sandbox-environment","preparation-plan"],
  }), domain);
});
test("transport fields cannot replace missing domain evidence", () => {
  const { studentId, ...withoutStudent } = domain;
  assert.throws(() => parseSandboxPreparationQuery({ ...withoutStudent, path: studentId, host: studentId }));
});
test("browser-supplied authority and rep lineage still fail strict validation", () => {
  for (const key of ["tutorId", "tutorAssignmentId", "eventFormId", "phase", "canonicalObservations"]) {
    assert.throws(() => parseSandboxPreparationQuery({ ...domain, [key]: "forged" }));
  }
});
test("malformed session UUID and duplicate query values remain invalid", () => {
  assert.throws(() => parseSandboxPreparationQuery({ ...domain, scheduledSessionId: "not-a-uuid" }));
  assert.throws(() => parseSandboxPreparationQuery({ ...domain, scheduledSessionId: [domain.scheduledSessionId, domain.scheduledSessionId] }));
});
