import assert from "node:assert/strict";

const APP_BASE = "https://tt-confidence-bzbmqbm4o-relief-works-technologies.vercel.app";
const EXPECTED_SHA = "a8c2259bec8e61ac97510b17f9433739e39c76d0";
const ASSIGNMENT_ID = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";

const email = String(process.env.RI_PROOF_SPECIALIST_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_SPECIALIST_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();

assert.ok(email && password, "Proof Specialist credentials are required");
assert.ok(bypass, "Vercel automation bypass secret is required");

const cookies = new Map();
const baseHeaders = {
  "content-type": "application/json",
  "x-vercel-protection-bypass": bypass,
};

async function request(path, body) {
  const headers = {
    ...baseHeaders,
    cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
  };
  const response = await fetch(APP_BASE + path, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(";")[0];
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { status: response.status, data };
}

async function waitForExactEnvironment() {
  let last = null;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      last = await request("/api/proof-environment");
      if (last.status === 200 && last.data.commitSha === EXPECTED_SHA) return last;
    } catch (error) {
      last = { status: 0, data: { error: String(error) } };
    }
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  throw new Error("Exact Curriculum v2 preview never became ready: " + JSON.stringify(last));
}

await waitForExactEnvironment();

const login = await request("/api/auth/signin", {
  email,
  password,
  expectedRole: "tutor",
});
assert.equal(login.status, 200);

const plan = await request(
  "/api/tutor/capability-plan?tutorAssignmentId=" + encodeURIComponent(ASSIGNMENT_ID),
);
assert.equal(plan.status, 200);

const byKey = new Map(plan.data.assessments.map((entry) => [entry.assessmentKey, entry]));
const retrievalV2 = byKey.get("operating_system_retrieval_v2");
const transferV2 = byKey.get("operating_system_transfer_v2");
const masteryV2 = byKey.get("why_training_continues_beyond_clarity_mastery_v1");
const retrievalV1 = byKey.get("operating_system_retrieval_v1");
const transferV1 = byKey.get("operating_system_transfer_v1");

assert.ok(retrievalV2, "Retrieval v2 is missing from Proof review plan");
assert.ok(transferV2, "Transfer v2 is missing from Proof review plan");
assert.ok(masteryV2, "Curriculum v2 Mastery is missing from Proof plan");
assert.ok(retrievalV1 && transferV1, "Curriculum v1 cumulative gates disappeared");

for (const [row, stage] of [
  [retrievalV2, "operating_system_retrieval"],
  [transferV2, "operating_system_transfer"],
]) {
  assert.equal(row.bankVersion, 1);
  assert.equal(row.status, "available");
  assert.equal(row.reviewMode, true);
  assert.equal(row.formSize, 32);
  assert.equal(row.passThresholdPercent, 96);
  assert.equal(row.stage, stage);
}

assert.equal(masteryV2.status, "unavailable");
assert.notEqual(retrievalV1.reviewMode, true);
assert.notEqual(transferV1.reviewMode, true);
assert.equal(retrievalV1.formSize, 30);
assert.equal(transferV1.formSize, 30);

async function verifyForm(assessmentKey) {
  const path =
    "/api/tutor/capability-assessments/" +
    assessmentKey +
    "?tutorAssignmentId=" +
    encodeURIComponent(ASSIGNMENT_ID);

  const first = await request(path);
  assert.equal(first.status, 200);
  assert.equal(first.data.bankVersion, 1);
  assert.equal(first.data.questions.length, 32);
  assert.doesNotMatch(
    JSON.stringify(first.data.questions),
    /"(?:correctOptionKeys|criticalFailOptionKeys|criticalBoundaryKeys|explanation|optionFeedback)"\s*:/,
    assessmentKey + " leaked private assessment authority",
  );

  const second = await request(path);
  assert.equal(second.status, 200);
  assert.equal(second.data.formId, first.data.formId);
  assert.deepEqual(second.data.questions, first.data.questions);

  return {
    assessmentKey,
    formSize: first.data.questions.length,
    deterministicForm: true,
    privateAuthorityLeak: false,
  };
}

const forms = [];
forms.push(await verifyForm("operating_system_retrieval_v2"));
forms.push(await verifyForm("operating_system_transfer_v2"));

console.log(
  "CURRICULUM_V2_CUMULATIVE_REVIEW_SMOKE_PASS=" +
    JSON.stringify({
      appSha: EXPECTED_SHA,
      retrievalV2: {
        status: retrievalV2.status,
        reviewMode: retrievalV2.reviewMode,
        formSize: retrievalV2.formSize,
      },
      transferV2: {
        status: transferV2.status,
        reviewMode: transferV2.reviewMode,
        formSize: transferV2.formSize,
      },
      approvedMasteryV2Inactive: masteryV2.status === "unavailable",
      curriculumV1StillReal: retrievalV1.reviewMode !== true && transferV1.reviewMode !== true,
      forms,
      attemptsSubmitted: 0,
    }),
);
