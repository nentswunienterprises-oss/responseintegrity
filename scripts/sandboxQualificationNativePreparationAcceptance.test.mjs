import assert from "node:assert/strict";
import { test } from "node:test";
import { runNativePreparationAcceptance } from "./sandboxQualificationNativePreparationAcceptance.mjs";

const SHA = "1".repeat(40);
function environment() {
  return {
    PROOF_BASE_URL: "https://controlled-preview.vercel.app/",
    PROOF_EXPECTED_SHA: SHA,
    RI_PROOF_NATIVE_WRITE_SCOPE: "CONTROLLED_PROOF_PREPARATION_ONLY",
    RI_PROOF_SPECIALIST_EMAIL: "controlled-specialist@example.test",
    RI_PROOF_SPECIALIST_PASSWORD: "example-not-a-secret",
    RI_PROOF_TD_EMAIL: "controlled-td@example.test",
    RI_PROOF_TD_PASSWORD: "example-not-a-secret",
    RI_PROOF_TUTOR_ID: "specialist-1",
    RI_PROOF_STUDENT_ID: "synthetic-student-1",
    RI_PROOF_SESSION_ID: "00000000-0000-4000-8000-000000000001",
    RI_PROOF_TOPIC: "mathematics",
    VERCEL_AUTOMATION_BYPASS_SECRET: "inert-test-value",
  };
}
function mockServer({ sha = SHA, completedReps = 0, exists = false,
  returnWrongRole = false } = {}) {
  let stored = exists;
  let writes = 0;
  const requests = [];
  function json(body, status = 200, cookies = null) {
    return new Response(JSON.stringify(body), {
      status, headers: {
        "content-type": "application/json",
        ...(cookies ? { "set-cookie": cookies + "; HttpOnly; Secure" } : {}),
      },
    });
  }
  async function fakeFetch(url, options = {}) {
    const req = { path: new URL(url).pathname, method: options.method || "GET",
      cookie: String(options.headers?.cookie || ""),
      body: options.body ? JSON.parse(options.body) : null,
      redirect: options.redirect };
    requests.push(req);
    if (req.path === "/api/proof-environment") {
      return json({ vercelEnv: "preview", supabaseProjectRef: "jftlxeacphvbnhbsbpxc",
        commitSha: sha });
    }
    if (req.path === "/api/auth/signin") {
      const role = req.body.expectedRole;
      return json({ dbUser: { id: role === "tutor" ? "specialist-1" : "td-1",
        role: returnWrongRole ? "coo" : role } }, 200, "session=" + role);
    }
    if (req.path === "/api/td/tutors/specialist-1/sandbox-qualification-review") {
      if (!req.cookie.includes("session=td")) return json({}, 403);
      return json({ tutorId: "specialist-1", tutorAssignmentId: "assignment-1",
        qualification: { qualificationReady: false } });
    }
    if (req.path === "/api/tutor/runtime-mode") {
      if (!req.cookie.includes("session=tutor")) return json({}, 403);
      return json({ operationalMode: "sandbox", assignmentId: "assignment-1" });
    }
    if (req.path === "/api/tutor/sandbox-environment/preparation-plan") {
      return json({ captureActive: true, status: "rep_ready",
        planFingerprint: "a".repeat(64), prescribedPhase: "Clarity",
        sessionNumber: 1, completedReps, preparationRecorded: stored,
        sets: [{ setId: "one", reps: 2 }] });
    }
    if (req.path === "/api/tutor/sandbox-environment/preparation") {
      if (!req.cookie) return json({ message: "Login" }, 401);
      if (!req.cookie.includes("session=tutor")) return json({ message: "Forbidden" }, 403);
      if (req.body.planFingerprint !== "a".repeat(64)) return json({ message: "Stale" }, 409);
      if (!req.body.problemPrepared || !req.body.conditionsReviewed ||
        !req.body.evidencePlanReviewed) return json({ message: "Invalid" }, 400);
      writes++; stored = true;
      return json({ recorded: true }, 201);
    }
    throw new Error("Unexpected route: " + req.path);
  }
  return { fakeFetch, requests, get writes() { return writes; } };
}

test("explicit controlled write scope fails before any network call", async () => {
  const e = environment();
  delete e.RI_PROOF_NATIVE_WRITE_SCOPE;
  let called = 0;
  await assert.rejects(
    runNativePreparationAcceptance(e, () => { called++; throw Error("network"); }, () => {}),
    /Explicit separate controlled Proof write authorization/,
  );
  assert.equal(called, 0);
});

test("exact Preview provenance and identity are fail closed before writing", async () => {
  const s = mockServer({ sha: "2".repeat(40) });
  await assert.rejects(runNativePreparationAcceptance(environment(), s.fakeFetch, () => {}));
  assert.equal(s.writes, 0);
  const wrongIdentity = mockServer({ returnWrongRole: true });
  await assert.rejects(runNativePreparationAcceptance(environment(), wrongIdentity.fakeFetch, () => {}));
  assert.equal(wrongIdentity.writes, 0);
});

test("native Map receipt writes exactly once and is verified by fresh readback", async () => {
  const s = mockServer();
  const result = await runNativePreparationAcceptance(environment(), s.fakeFetch, () => {});
  assert.equal(result.recordedNew, true);
  assert.equal(s.writes, 1);
  assert.equal(s.requests.filter(x => x.method === "POST" &&
    x.path === "/api/tutor/sandbox-environment/preparation").length, 4);
  assert.equal(s.requests.some(x => /\/rep$|\/rediagnosis$|sandbox-readiness-assessment$/.test(x.path)), false);
  assert.ok(s.requests.every(x => x.redirect === "manual"));
});

test("existing receipt is only read back, never re-created", async () => {
  const s = mockServer({ exists: true });
  const result = await runNativePreparationAcceptance(environment(), s.fakeFetch, () => {});
  assert.equal(result.recordedNew, false);
  assert.equal(s.writes, 0);
});

test("an in-progress lesson is never mutated", async () => {
  const s = mockServer({ completedReps: 1 });
  await assert.rejects(
    runNativePreparationAcceptance(environment(), s.fakeFetch, () => {}),
    /Do not alter an in-progress lesson/,
  );
  assert.equal(s.writes, 0);
});
