import assert from "node:assert/strict";

const APP_BASE = "https://tt-confidence-i0wdx97e2-relief-works-technologies.vercel.app";
const EXPECTED_SHA = "3c2b9b8b790d27b576f34db8ed1ef1d9f35964a4";
const ASSIGNMENT_ID = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";

const email = String(process.env.RI_PROOF_SPECIALIST_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_SPECIALIST_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();

assert.ok(email && password, "Proof Specialist credentials are required");
assert.ok(bypass, "Vercel automation bypass secret is required");

const cookies = new Map();

async function request(path, body) {
  const headers = {
    "content-type": "application/json",
    "x-vercel-protection-bypass": bypass,
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

const rows = plan.data.assessments;
const byKey = new Map(rows.map((row) => [row.assessmentKey, row]));
const masteries = rows.filter((row) => row.evidenceKind === "mastery");
const systemIntelligence = rows.filter((row) => row.stage === "system_intelligence_mastery");

assert.equal(masteries.length, 21);
assert.equal(systemIntelligence.length, 5);

const newMastery = byKey.get("why_training_continues_beyond_clarity_mastery_v1");
const retrievalV2 = byKey.get("operating_system_retrieval_v2");
const transferV2 = byKey.get("operating_system_transfer_v2");

assert.ok(newMastery);
assert.ok(retrievalV2);
assert.ok(transferV2);
assert.equal(newMastery.status, "unavailable");
assert.equal(retrievalV2.status, "unavailable");
assert.equal(transferV2.status, "unavailable");
assert.equal(byKey.has("operating_system_retrieval_v1"), false);
assert.equal(byKey.has("operating_system_transfer_v1"), false);

console.log("CURRICULUM_V2_RELEASE_PREVIEW_PASS=" + JSON.stringify({
  appSha: EXPECTED_SHA,
  masteryCount: masteries.length,
  systemIntelligenceMasteryCount: systemIntelligence.length,
  newMasteryStatusBeforeBankActivation: newMastery.status,
  retrievalV2StatusBeforeBankActivation: retrievalV2.status,
  transferV2StatusBeforeBankActivation: transferV2.status,
  v1CumulativeAbsentFromLivePlan:
    !byKey.has("operating_system_retrieval_v1") &&
    !byKey.has("operating_system_transfer_v1"),
  attemptsSubmitted: 0,
}));
