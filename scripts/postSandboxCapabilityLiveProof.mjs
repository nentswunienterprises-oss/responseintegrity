import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";

const { Client } = pg;

const PROOF_REF = "jftlxeacphvbnhbsbpxc";
const PROD_REF = "yzcnavucvwgmulcxgxvw";
const APP_BASE = "https://tt-confidence-41x7wyd8d-relief-works-technologies.vercel.app";
const EXPECTED_APP_SHA = "892c92337a5c62a63e9a240e10772e80e12d4203";
const ASSIGNMENT_ID = "836a839f-2f29-45c7-b8c2-aa501c95e1b0";
const TUTOR_ID = "77977298-7ac9-41f9-a726-9d5fd634540f";

const proofUrl = String(process.env.RI_PROOF_DATABASE_URL || "").trim();
const productionUrl = String(process.env.RI_PRODUCTION_DATABASE_URL || "").trim();
const email = String(process.env.RI_PROOF_SPECIALIST_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_SPECIALIST_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();

assert.ok(proofUrl && productionUrl, "Proof and Production database URLs are required");
assert.ok(email && password, "Encrypted Proof Specialist credentials are required");
assert.ok(proofUrl.includes(PROOF_REF), "Proof database URL does not identify Capability Proof");
assert.ok(productionUrl.includes(PROD_REF), "Production database URL does not identify The Hub");

const masteryBanks = [
  ["how_to_model_mastery_v1", 8, 15, 100, "a2aaa51823c3b8ce7b1035560fb62a90"],
  ["how_to_intervene_mastery_v1", 9, 15, 100, "f55c2d2b00ea22614c86ba805a6e38b8"],
  ["how_to_use_boss_battles_mastery_v1", 10, 15, 100, "561855180abd454229edb74b7fc5ce54"],
  ["what_not_to_do_mastery_v1", 10, 15, 100, "da89e641d7d1e94f3a1d9d5d5e106c88"],
  ["emotional_discipline_under_discomfort_mastery_v1", 10, 15, 100, "bc98158d8ffd13d3542ef8e83680ba19"],
  ["how_to_diagnose_mastery_v1", 19, 15, 100, "b29ff3f49822f0f98797bd0eb0c882d0"],
  ["how_to_interpret_prompts_mastery_v1", 15, 15, 100, "106e6e26789a65c983622ca4647468d6"],
  ["how_baselines_are_established_mastery_v1", 15, 15, 100, "cd392108cb0fd2612d881a5743bc0052"],
  ["how_the_system_resolves_uncertainty_mastery_v1", 14, 15, 100, "f1ed5cf8c6a1bcc21c6a204490ed5bb0"],
  ["intro_session_structure_mastery_v1", 15, 15, 100, "af5b0fd53021e3e5a97ce006d94ebcd1"],
  ["logging_system_mastery_v1", 14, 15, 100, "012cff8049a67a303a0de637b73e29e3"],
  ["session_flow_control_mastery_v1", 14, 15, 100, "9a976b6464e3784bf6df11dc8e0b1195"],
  ["drill_library_mastery_v1", 9, 15, 100, "a73ab327219589907e03a159f55d3351"],
  ["handover_verification_mastery_v1", 10, 15, 100, "389bd5799ed96ce1e4d5c4efba624b10"],
  ["tools_required_mastery_v1", 10, 15, 100, "2bab6216926114ae5a99fcf343faea72"],
];

const cumulativeBanks = [
  ["operating_system_retrieval_v1", 1, 30, 96, "725f35af260e00733267dbc5d78a96c5"],
  ["operating_system_transfer_v1", 1, 30, 96, "28f607934b05ec6c1c8d1c12c2bf016f"],
];

const requiredPrerequisites = [
  ["transformation_phases_retrieval_v1", 10],
  ["transformation_state_transfer_v1", 11],
];

const targetBanks = [...masteryBanks, ...cumulativeBanks];
const ssl = { rejectUnauthorized: true };
const proof = new Client({ connectionString: proofUrl, ssl });
const production = new Client({ connectionString: productionUrl, ssl });
const answerMaps = new Map();

const bankHashSql = `
  select c.active,c.review_mode,c.form_size,c.pass_threshold_percent,
         md5(jsonb_agg(to_jsonb(i)-'created_at'-'bank_version' order by i.item_key)::text) as content_hash
  from private.specialist_capability_assessment_configs c
  join private.specialist_capability_assessment_items i
    on i.assessment_key=c.assessment_key and i.bank_version=c.bank_version
  where c.assessment_key=$1 and c.bank_version=$2
  group by c.active,c.review_mode,c.form_size,c.pass_threshold_percent
`;

async function verifyBank(client, [key, version, formSize, threshold, expectedHash], environmentName) {
  const result = await client.query(bankHashSql, [key, version]);
  assert.equal(result.rowCount, 1, `${environmentName} bank missing: ${key} v${version}`);
  const row = result.rows[0];
  assert.equal(row.active, true, `${environmentName} bank inactive: ${key}`);
  assert.equal(row.review_mode, false, `${environmentName} Review Mode still on: ${key}`);
  assert.equal(Number(row.form_size), formSize, `${environmentName} form size mismatch: ${key}`);
  assert.equal(Number(row.pass_threshold_percent), threshold, `${environmentName} threshold mismatch: ${key}`);
  assert.equal(row.content_hash, expectedHash, `${environmentName} content hash mismatch: ${key}`);
  return row.content_hash;
}

await proof.connect();
await production.connect();
try {
  await proof.query("begin read only");
  await production.query("begin read only");

  for (const bank of targetBanks) {
    const proofHash = await verifyBank(proof, bank, "Proof");
    const productionHash = await verifyBank(production, bank, "Production");
    assert.equal(proofHash, productionHash, `Proof/Production parity mismatch: ${bank[0]}`);

    const items = await production.query(
      `select item_key,correct_option_keys
         from private.specialist_capability_assessment_items
        where assessment_key=$1 and bank_version=$2 and active=true
        order by item_key`,
      [bank[0], bank[1]],
    );
    assert.ok(items.rowCount >= bank[2], `Production item pool too small: ${bank[0]}`);
    answerMaps.set(bank[0], new Map(items.rows.map((row) => [row.item_key, row.correct_option_keys])));
  }

  await proof.query("rollback");
  await production.query("rollback");
} finally {
  await proof.end();
  await production.end();
}

const cookies = new Map();
const baseHeaders = { "content-type": "application/json" };
if (bypass) baseHeaders["x-vercel-protection-bypass"] = bypass;

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
assert.equal(environment.status, 200, "Proof environment endpoint failed");
assert.equal(environment.data.vercelEnv, "preview");
assert.equal(environment.data.supabaseProjectRef, PROOF_REF);
assert.equal(environment.data.commitSha, EXPECTED_APP_SHA, "Immutable Proof deployment commit mismatch");

const login = await request("/api/auth/signin", {
  email,
  password,
  expectedRole: "tutor",
});
assert.equal(login.status, 200, "Proof Specialist login failed");
assert.equal(login.data.dbUser.id, TUTOR_ID);
assert.equal(String(login.data.dbUser.role || "").toLowerCase(), "tutor");

const planPath = "/api/tutor/capability-plan?tutorAssignmentId=" + encodeURIComponent(ASSIGNMENT_ID);

async function getPlan() {
  const response = await request(planPath);
  assert.equal(response.status, 200, "Capability plan failed");
  return response.data;
}

const initialPlan = await getPlan();
for (const [key, version] of requiredPrerequisites) {
  const row = initialPlan.assessments.find((entry) => entry.assessmentKey === key);
  assert.ok(row, `Prerequisite plan row missing: ${key}`);
  assert.equal(row.bankVersion, version);
  assert.equal(row.status, "complete", `Prerequisite is not genuinely complete: ${key}`);
  assert.notEqual(row.reviewMode, true);
}

const report = [];

async function completeAssessment(bank, allowSpacingBlock = false) {
  const [key, version, formSize] = bank;
  const plan = await getPlan();
  const availability = plan.assessments.find((entry) => entry.assessmentKey === key);
  assert.ok(availability, `Plan row missing: ${key}`);
  assert.equal(availability.bankVersion, version, `Bank version drift: ${key}`);
  assert.notEqual(availability.reviewMode, true, `Review Mode unexpectedly on: ${key}`);

  if (availability.status === "complete") {
    report.push({ key, version, alreadyComplete: true });
    return { status: "complete", availability };
  }

  if (availability.status === "locked") {
    if (allowSpacingBlock) {
      assert.equal(availability.reason, "spacing_interval", `Unexpected OS Retrieval lock: ${availability.reason}`);
      return { status: "spacing_blocked", availability };
    }
    throw new Error(`Unexpected locked assessment: ${key} ${availability.reason || "unknown"} ${availability.unlockAt || ""}`);
  }

  assert.equal(availability.status, "available", `Assessment unavailable: ${key}`);

  const path = "/api/tutor/capability-assessments/" + key;
  const formResponse = await request(path + "?tutorAssignmentId=" + encodeURIComponent(ASSIGNMENT_ID));
  assert.equal(formResponse.status, 200, `Capability form failed: ${key}`);
  const form = formResponse.data;
  assert.equal(form.bankVersion, version);
  assert.equal(form.questions.length, formSize);
  assert.doesNotMatch(
    JSON.stringify(form.questions),
    /"(?:correctOptionKeys|criticalFailOptionKeys|explanation)"\s*:/,
    `Private assessment data leaked: ${key}`,
  );

  const repeat = await request(path + "?tutorAssignmentId=" + encodeURIComponent(ASSIGNMENT_ID));
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.formId, form.formId, `Deterministic active form changed: ${key}`);
  assert.deepEqual(repeat.data.questions, form.questions, `Deterministic active questions changed: ${key}`);

  const receipts = [];
  for (const question of form.questions) {
    const accepted = answerMaps.get(key)?.get(question.key);
    assert.ok(Array.isArray(accepted) && accepted.length > 0, `Approved answer mapping missing: ${key}/${question.key}`);
    const selectedOptionKeys = question.kind === "single_choice" ? [accepted[0]] : accepted;
    const confirmation = await request(path + "/question-confirmation", {
      interactionToken: form.interactionToken,
      priorReceipts: receipts,
      questionKey: question.key,
      selectedOptionKeys,
    });
    assert.equal(confirmation.status, 201, `Question confirmation failed: ${key}/${question.key}`);
    assert.equal(confirmation.data.confirmation.correct, true, `Expected correct confirmation: ${key}/${question.key}`);
    receipts.push(confirmation.data.receipt);
  }

  const payload = {
    tutorAssignmentId: ASSIGNMENT_ID,
    interactionToken: form.interactionToken,
    receipts,
  };
  const attempt = await request(path + "/attempt", payload);
  assert.equal(attempt.status, 201, `Attempt submission failed: ${key}`);
  assert.equal(attempt.data.passed, true, `Assessment did not pass: ${key}`);
  assert.equal(attempt.data.hasCriticalFail, false, `Critical fail unexpectedly recorded: ${key}`);
  assert.equal(attempt.data.correctQuestions, formSize, `Full-correct proof expected: ${key}`);

  const replay = await request(path + "/attempt", payload);
  assert.equal(replay.status, 409, `Completed attempt replay was not rejected: ${key}`);

  const reset = await request(path + "/review-reset", { tutorAssignmentId: ASSIGNMENT_ID });
  assert.equal(reset.status, 200, `Review reset endpoint failed: ${key}`);
  assert.equal(reset.data.reviewMode, false, `Review reset reported Review Mode: ${key}`);
  assert.equal(reset.data.reset, false, `Non-review evidence was reset: ${key}`);

  report.push({
    key,
    version,
    attemptId: attempt.data.attemptId,
    correctQuestions: formSize,
    replayRejected: true,
    reviewResetDisabled: true,
  });
  return { status: "complete", availability };
}

// Submit only missing post-Sandbox Masteries. Existing six Session Infrastructure passes are retained.
for (const bank of masteryBanks) {
  await completeAssessment(bank, false);
}

const afterMastery = await getPlan();
for (const [key, version] of masteryBanks) {
  const row = afterMastery.assessments.find((entry) => entry.assessmentKey === key);
  assert.ok(row, `Post-Mastery plan row missing: ${key}`);
  assert.equal(row.bankVersion, version);
  assert.equal(row.status, "complete", `Post-Sandbox Mastery not complete: ${key}`);
  assert.notEqual(row.reviewMode, true);
}

const retrievalBank = cumulativeBanks[0];
const retrievalState = await completeAssessment(retrievalBank, true);

if (retrievalState.status === "spacing_blocked") {
  const blocked = {
    status: "SPACING_BLOCKED",
    scope: "15 post-Sandbox Masteries -> 24h -> OS Retrieval -> OS Transfer",
    fixture: "dedicated Proof Specialist",
    appSha: EXPECTED_APP_SHA,
    proofProject: PROOF_REF,
    productionAuthorityProject: PROD_REF,
    productionReadOnly: true,
    reviewMode: false,
    mastered: masteryBanks.map(([key, version]) => ({ key, version, status: "complete" })),
    newlySubmitted: report.filter((entry) => !entry.alreadyComplete),
    operatingSystemRetrieval: {
      key: retrievalBank[0],
      version: retrievalBank[1],
      status: "locked",
      reason: retrievalState.availability.reason,
      unlockAt: retrievalState.availability.unlockAt,
    },
    operatingSystemTransfer: {
      key: cumulativeBanks[1][0],
      version: cumulativeBanks[1][1],
      status: "not_attempted",
    },
  };
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/post-sandbox-capability-live-proof.json", JSON.stringify(blocked, null, 2));
  console.log("POST_SANDBOX_CAPABILITY_SPACING_BLOCK=" + JSON.stringify(blocked));
  process.exit(0);
}

await completeAssessment(cumulativeBanks[1], false);

const finalPlan = await getPlan();
for (const bank of targetBanks) {
  const row = finalPlan.assessments.find((entry) => entry.assessmentKey === bank[0]);
  assert.ok(row, `Final plan row missing: ${bank[0]}`);
  assert.equal(row.bankVersion, bank[1]);
  assert.equal(row.status, "complete", `Final Capability gate not complete: ${bank[0]}`);
  assert.notEqual(row.reviewMode, true);
}

const finalResult = {
  status: "PASS",
  scope: "15 post-Sandbox Masteries -> 24h -> OS Retrieval -> OS Transfer",
  fixture: "dedicated Proof Specialist",
  appSha: EXPECTED_APP_SHA,
  proofProject: PROOF_REF,
  productionAuthorityProject: PROD_REF,
  productionReadOnly: true,
  reviewMode: false,
  modules: report,
  allFifteenMasteriesComplete: true,
  operatingSystemRetrievalComplete: true,
  operatingSystemTransferComplete: true,
};
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/post-sandbox-capability-live-proof.json", JSON.stringify(finalResult, null, 2));
console.log("POST_SANDBOX_CAPABILITY_LIVE_PROOF_PASS=" + JSON.stringify(finalResult));
