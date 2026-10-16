import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

/**
 * Protected, deliberately bounded native Proof mutation:
 * record only the original Map pre-session preparation acknowledgement for
 * one controlled synthetic Sandbox booking. It NEVER submits a rep, a TD
 * decision, a stage transition, a package mutation or future canonical truth.
 * A separate full longitudinal Specialist/TD journey is still required.
 */
export async function runNativePreparationAcceptance(
  e = process.env, fetchImpl = fetch, log = console.log,
) {
  const required = [
    "PROOF_BASE_URL", "PROOF_EXPECTED_SHA", "RI_PROOF_SPECIALIST_EMAIL",
    "RI_PROOF_SPECIALIST_PASSWORD", "RI_PROOF_TD_EMAIL",
    "RI_PROOF_TD_PASSWORD", "RI_PROOF_TUTOR_ID", "RI_PROOF_STUDENT_ID",
    "RI_PROOF_SESSION_ID", "RI_PROOF_TOPIC", "VERCEL_AUTOMATION_BYPASS_SECRET",
  ];
  for (const k of required) {
    assert.ok(String(e[k] || "").trim(), k + " required from protected environment");
  }
  assert.equal(
    e.RI_PROOF_NATIVE_WRITE_SCOPE, "CONTROLLED_PROOF_PREPARATION_ONLY",
    "Explicit separate controlled Proof write authorization required",
  );
  assert.match(e.PROOF_EXPECTED_SHA, /^[0-9a-f]{40}$/);
  const base = new URL(e.PROOF_BASE_URL);
  assert.equal(base.protocol, "https:");
  assert.equal(base.pathname, "/");
  assert.equal(base.username, "");
  assert.equal(base.password, "");
  assert.equal(base.port, "");
  assert.equal(base.search, "");
  assert.equal(base.hash, "");
  assert.match(base.hostname, /^[a-z0-9-]+\.vercel\.app$/);
  assert.notEqual(
    e.RI_PROOF_SPECIALIST_EMAIL.toLowerCase(),
    e.RI_PROOF_TD_EMAIL.toLowerCase(), "Roles must use distinct controlled identities",
  );
  assert.match(e.RI_PROOF_SESSION_ID, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);

  async function api(path, options = {}) {
    assert.ok(path.startsWith("/api/"), "Only explicitly scoped API routes allowed");
    const response = await fetchImpl(new URL(path, base), {
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: {
        "x-vercel-protection-bypass": e.VERCEL_AUTOMATION_BYPASS_SECRET,
        ...(options.headers || {}),
      },
    });
    const readJson = async () => {
      assert.match(response.headers.get("content-type") || "",
        /application\/json/, "Expected JSON, not a redirect or protection HTML");
      return response.json();
    };
    return { response, readJson };
  }

  const prov = await api("/api/proof-environment");
  assert.equal(prov.response.status, 200, "Preview provenance inaccessible");
  const info = await prov.readJson();
  assert.equal(info.vercelEnv, "preview");
  assert.equal(info.commitSha, e.PROOF_EXPECTED_SHA);
  assert.equal(info.supabaseProjectRef, "jftlxeacphvbnhbsbpxc");

  async function signIn(email, password, role) {
    const result = await api("/api/auth/signin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, expectedRole: role }),
    });
    assert.equal(result.response.status, 200, role + " authentication failed");
    const user = await result.readJson();
    assert.equal(user.dbUser?.role, role);
    if (role === "tutor") {
      assert.equal(String(user.dbUser.id), e.RI_PROOF_TUTOR_ID);
    }
    const cookies = result.response.headers.getSetCookie?.() ||
      [result.response.headers.get("set-cookie") || ""];
    const cookie = cookies.filter(Boolean).map(s => s.split(";")[0]).join("; ");
    assert.ok(cookie, role + " session cookie required");
    return cookie;
  }

  const specialist = await signIn(
    e.RI_PROOF_SPECIALIST_EMAIL, e.RI_PROOF_SPECIALIST_PASSWORD, "tutor",
  );
  const td = await signIn(e.RI_PROOF_TD_EMAIL, e.RI_PROOF_TD_PASSWORD, "td");

  const reviewPath = "/api/td/tutors/" +
    encodeURIComponent(e.RI_PROOF_TUTOR_ID) + "/sandbox-qualification-review";
  const review = await api(reviewPath, { headers: { cookie: td } });
  assert.equal(review.response.status, 200, "Assigned TD scope not established");
  const history = await review.readJson();
  assert.equal(history.tutorId, e.RI_PROOF_TUTOR_ID);
  assert.equal(history.qualification?.qualificationReady, false);
  assert.ok(!JSON.stringify(history).includes("canonical_observations"));
  const mode = await api("/api/tutor/runtime-mode", { headers: { cookie: specialist } });
  assert.equal(mode.response.status, 200);
  const runtime = await mode.readJson();
  assert.equal(runtime.operationalMode, "sandbox");
  assert.ok(runtime.assignmentId);
  assert.equal(runtime.assignmentId, history.tutorAssignmentId);

  const qs = new URLSearchParams({
    studentId: e.RI_PROOF_STUDENT_ID,
    scheduledSessionId: e.RI_PROOF_SESSION_ID,
    topic: e.RI_PROOF_TOPIC,
  });
  const path = "/api/tutor/sandbox-environment/preparation-plan?" + qs;
  const getPlan = async () => {
    const p = await api(path, { headers: { cookie: specialist } });
    assert.equal(p.response.status, 200, "Map preparation plan unavailable");
    return p.readJson();
  };
  const initial = await getPlan();
  assert.equal(initial.captureActive, true);
  assert.equal(initial.status, "rep_ready",
    "Controlled booking must be at an unstarted Training first rep");
  assert.equal(initial.completedReps, 0, "Do not alter an in-progress lesson");
  assert.match(initial.planFingerprint || "", /^[0-9a-f]{64}$/);
  assert.ok(["Clarity", "Structured Execution", "Controlled Discomfort",
    "Time Pressure Stability"].includes(initial.prescribedPhase));
  assert.ok(Number.isInteger(initial.sessionNumber) && initial.sessionNumber > 0);
  assert.ok(Array.isArray(initial.sets) && initial.sets.length > 0);
  assert.ok(!JSON.stringify(initial).includes("canonicalObservations"));
  assert.ok(!JSON.stringify(initial).includes("studentBehavior"));

  const body = {
    studentId: e.RI_PROOF_STUDENT_ID, scheduledSessionId: e.RI_PROOF_SESSION_ID,
    topic: e.RI_PROOF_TOPIC, attestedPhase: initial.prescribedPhase,
    planFingerprint: initial.planFingerprint, problemPrepared: true,
    conditionsReviewed: true, evidencePlanReviewed: true,
  };
  const writePath = "/api/tutor/sandbox-environment/preparation";
  const post = (cookie, payload) => api(writePath, {
    method: "POST", headers: {
      ...(cookie ? { cookie } : {}), "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Fail closed on role and plan integrity BEFORE any valid preparation receipt.
  const anonymous = await post(null, body);
  assert.ok([401, 403].includes(anonymous.response.status),
    "Anonymous preparation write must be denied");
  const asTd = await post(td, body);
  assert.equal(asTd.response.status, 403, "TD cannot write Specialist preparation");
  const bad = await post(specialist, {
    ...body,
    planFingerprint: initial.planFingerprint === "0".repeat(64) ?
      "1".repeat(64) : "0".repeat(64),
  });
  assert.equal(bad.response.status, 409, "Stale/tampered preparation must be rejected");

  if (!initial.preparationRecorded) {
    const saved = await post(specialist, body);
    assert.ok([200, 201].includes(saved.response.status),
      "Native preparation receipt submission failed");
    assert.equal((await saved.readJson()).recorded, true);
  }

  const persisted = await getPlan();
  assert.equal(persisted.preparationRecorded, true,
    "Native preparation receipt did not persist through a fresh read");
  assert.equal(persisted.planFingerprint, initial.planFingerprint,
    "Preparation lineage changed unexpectedly");
  assert.equal(persisted.prescribedPhase, initial.prescribedPhase);
  assert.equal(persisted.sessionNumber, initial.sessionNumber);
  assert.equal(persisted.completedReps, 0, "No rep may be submitted by this runner");
  log(initial.preparationRecorded ?
    "EXISTING_NATIVE_PREPARATION_RECEIPT_READBACK=PASS" :
    "NATIVE_MAP_PREPARATION_RECEIPT_AND_READBACK=PASS");
  log("NO_REP_OR_TD_OR_STAGE_MUTATION_PERFORMED=PASS");
  return { recordedNew: !initial.preparationRecorded, sessionNumber: persisted.sessionNumber };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runNativePreparationAcceptance();
}
