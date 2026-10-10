import assert from "node:assert/strict";

const APP_BASE = "https://tt-confidence-683w63b6o-relief-works-technologies.vercel.app";
const EXPECTED_SHA = "3cdcb1bc6aabfdcba043f8ae04110955fb94d480";
const ASSIGNMENT_ID = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";
const ASSESSMENT_KEY = "why_training_continues_beyond_clarity_mastery_v1";

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

const environment = await request("/api/proof-environment");
assert.equal(environment.status, 200);
assert.equal(environment.data.commitSha, EXPECTED_SHA);

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
const row = plan.data.assessments.find(
  (entry) => entry.assessmentKey === ASSESSMENT_KEY,
);
assert.ok(row, "Curriculum v2 review Mastery is missing from Proof plan");
assert.equal(row.bankVersion, 1);
assert.equal(row.status, "available");
assert.equal(row.reviewMode, true);
assert.equal(row.formSize, 15);
assert.equal(row.passThresholdPercent, 100);
assert.equal(row.stage, "system_intelligence_mastery");

const path =
  "/api/tutor/capability-assessments/" +
  ASSESSMENT_KEY +
  "?tutorAssignmentId=" +
  encodeURIComponent(ASSIGNMENT_ID);

const first = await request(path);
assert.equal(first.status, 200);
assert.equal(first.data.bankVersion, 1);
assert.equal(first.data.questions.length, 15);
assert.doesNotMatch(
  JSON.stringify(first.data.questions),
  /"(?:correctOptionKeys|criticalFailOptionKeys|criticalBoundaryKeys|explanation|optionFeedback)"\s*:/,
  "Private assessment authority leaked to the client",
);

const second = await request(path);
assert.equal(second.status, 200);
assert.equal(second.data.formId, first.data.formId);
assert.deepEqual(second.data.questions, first.data.questions);

console.log(
  "CURRICULUM_V2_MASTERY_REVIEW_SMOKE_PASS=" +
    JSON.stringify({
      assessmentKey: ASSESSMENT_KEY,
      bankVersion: 1,
      reviewMode: true,
      status: row.status,
      stage: row.stage,
      formSize: first.data.questions.length,
      deterministicForm: true,
      privateAuthorityLeak: false,
      appSha: EXPECTED_SHA,
      attemptsSubmitted: 0,
    }),
);
