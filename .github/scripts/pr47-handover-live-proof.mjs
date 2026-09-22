import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = String(process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
const expectedCommit = String(
  process.env.PROOF_EXPECTED_APP_SHA || process.env.GITHUB_SHA || "",
).trim();

const studentId = "828a5609-462c-4772-841a-0590ceb6a84e";
const expectedTopic = "Geometry";
const baselinePhase = "Time Pressure Stability";
const baselineStability = "High";

assert.ok(baseUrl && email && password && expectedCommit, "Proof runtime configuration is required");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(bypass
    ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass } }
    : {}),
});
const page = await context.newPage();

const supported = {
  "Start under time": "Started promptly with a valid structured first move",
  "Structure under time": "Method structure held under the timer",
  "Pace control": "Maintained a deliberate, controlled pace",
  "Completion integrity": "Completed while preserving method structure",
};

const structureVariants = {
  conditional: "Important parts of the method drifted under time",
  not_observed: "This was not meaningfully observable",
  confounded: "The observation was confounded",
  breakdown: "Method structure collapsed under time",
};

async function waitForCurrentPreview() {
  let last = null;
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    const response = await page.request.get(baseUrl + "/api/proof-environment", {
      timeout: 60000,
    }).catch(() => null);
    if (response?.ok()) {
      const body = await response.json().catch(() => null);
      last = body;
      if (
        body?.vercelEnv === "preview" &&
        body?.supabaseProjectRef === "jftlxeacphvbnhbsbpxc" &&
        body?.commitSha === expectedCommit
      ) {
        console.log("PR47_HANDOVER_PREVIEW_READY=" + JSON.stringify({
          attempt,
          commitSha: body.commitSha,
          supabaseProjectRef: body.supabaseProjectRef,
        }));
        return body;
      }
    }
    await page.waitForTimeout(5000);
  }
  throw new Error(
    "Preview alias did not reach current commit. Last proof: " + JSON.stringify(last),
  );
}

async function login() {
  await page.goto(
    baseUrl + "/operational/signup?role=tutor&mode=login&lock=login&returnTo=/specialist/pod",
    { waitUntil: "domcontentloaded", timeout: 90000 },
  );
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const [signin] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/signin") &&
        response.request().method() === "POST",
      { timeout: 60000 },
    ),
    page.getByRole("button", { name: "Login", exact: true }).click(),
  ]);
  const signinText = await signin.text();
  assert.ok(
    signin.ok(),
    "Proof Specialist login failed: " + signin.status() + " " + signinText,
  );
  const body = JSON.parse(signinText);
  assert.equal(body?.dbUser?.role, "tutor");
}

async function jsonRequest(method, path, data) {
  const options = { timeout: 60000 };
  if (data !== undefined) options.data = data;
  const response =
    method === "POST"
      ? await page.request.post(baseUrl + path, options)
      : await page.request.get(baseUrl + path, options);
  const text = await response.text();
  assert.ok(
    response.ok(),
    method + " " + path + " failed: " + response.status() + " " + text,
  );
  return text ? JSON.parse(text) : null;
}

async function topicState(topic) {
  const body = await jsonRequest(
    "GET",
    "/api/tutor/topic-conditioning/" + encodeURIComponent(studentId),
  );
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.topics)
      ? body.topics
      : [];
  const row = rows.find(
    (candidate) =>
      String(candidate?.topic || "").trim().toLowerCase() ===
      topic.trim().toLowerCase(),
  );
  assert.ok(row, "Topic missing from canonical state: " + topic);
  return row;
}

async function resetFixture() {
  const fixture = await jsonRequest(
    "POST",
    "/api/proof/handover-fixture/reset",
    {
      studentId,
      topic: expectedTopic,
      restoreCanonicalState: true,
      restorePhase: baselinePhase,
      restoreStability: baselineStability,
    },
  );
  assert.equal(fixture?.studentId, studentId);
  assert.equal(fixture?.topic, expectedTopic);
  assert.equal(fixture?.phase, baselinePhase);
  assert.equal(fixture?.stability, baselineStability);
  assert.equal(fixture?.restoredCanonicalState, true);
  assert.equal(fixture?.session?.type, "handover");
  assert.equal(fixture?.session?.status, "confirmed");
  assert.ok(fixture?.session?.id, "Proof fixture did not return a Handover session ID");

  const state = await topicState(expectedTopic);
  assert.equal(state.phase, baselinePhase);
  assert.equal(state.stability, baselineStability);
  assert.equal(state.requiresTargetedRediagnosis, false);

  return fixture;
}

async function chooseBehavior(label, option) {
  const labelNode = page.locator("label").filter({ hasText: label }).first();
  await labelNode.waitFor({ state: "visible", timeout: 30000 });
  const block = labelNode.locator("..");
  const button = block.getByRole("button").filter({ hasText: option }).first();
  await button.waitFor({ state: "visible", timeout: 30000 });
  await button.click();
}

async function chooseOpportunity(kind = "supported") {
  const values = { ...supported };
  if (kind !== "supported") {
    values["Structure under time"] = structureVariants[kind];
  }
  for (const [label, option] of Object.entries(values)) {
    await chooseBehavior(label, option);
  }
}

async function openHandoverScenario(scenarioName) {
  const fixture = await resetFixture();
  const sessionId = String(fixture.session.id);
  const handoverUrl =
    baseUrl +
    "/specialist/intro-session/" +
    encodeURIComponent(studentId) +
    "?mode=handover&topic=" +
    encodeURIComponent(expectedTopic) +
    "&phase=" +
    encodeURIComponent(baselinePhase) +
    "&stability=" +
    encodeURIComponent(baselineStability) +
    "&scheduledSessionId=" +
    encodeURIComponent(sessionId);

  await page.goto(handoverUrl, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  await page.getByText("Handover Prep", { exact: true }).waitFor({
    state: "visible",
    timeout: 60000,
  });
  await page
    .getByText(/Extra prepared problems are reserve only, not a completion target/i)
    .waitFor({ state: "visible", timeout: 30000 });

  const confirmations = [
    "I reviewed the inherited Time Pressure Stability",
    "I prepared a small reserve bank of clean continuity problems",
    "I will verify continuity only and will not restart or train forward",
  ];
  for (const confirmation of confirmations) {
    const button = page.getByRole("button").filter({ hasText: confirmation }).first();
    await button.waitFor({ state: "visible", timeout: 30000 });
    await button.click();
  }
  await page.getByRole("button", { name: "Start Verification", exact: true }).click();

  await page.getByRole("heading", {
    name: "Handover Verification - Time Pressure Stability",
    exact: true,
  }).waitFor({ state: "visible", timeout: 60000 });
  await page.getByText("EVIDENCE OPPORTUNITY 1", { exact: true })
    .waitFor({ state: "visible", timeout: 30000 });

  console.log("PR47_HANDOVER_SCENARIO_START=" + JSON.stringify({
    scenario: scenarioName,
    sessionId,
    inheritedState: baselinePhase + " / " + baselineStability,
  }));

  return fixture;
}

async function evaluateForContinuation(completedOpportunity) {
  await page.getByRole("button", {
    name: "Evaluate Continuity Evidence",
    exact: true,
  }).click();
  const nextOpportunity = completedOpportunity + 1;
  await page.getByText("EVIDENCE OPPORTUNITY " + nextOpportunity, { exact: true })
    .waitFor({ state: "visible", timeout: 30000 });
  await page
    .getByText(
      new RegExp(
        "Continuity evidence is not yet sufficient after opportunity " +
          completedOpportunity,
        "i",
      ),
    )
    .waitFor({ state: "visible", timeout: 30000 });
}

async function evaluateFinal() {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/tutor/handover-verification-drill") &&
      response.request().method() === "POST",
    { timeout: 120000 },
  );
  await page.getByRole("button", {
    name: "Evaluate Continuity Evidence",
    exact: true,
  }).click();
  const response = await responsePromise;
  const text = await response.text();
  assert.ok(
    response.ok(),
    "Handover submission failed: " + response.status() + " " + text,
  );
  const result = JSON.parse(text);
  const summary = result?.summary || {};
  assert.equal(summary.decisionAuthority, "evidence_native");
  assert.equal(summary.scoreAuthority, false);
  await page.getByText("Response Evidence Decision", { exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
  await page.getByText(
    "No compatibility score decided this Handover outcome. The decision above comes from the recorded Response Evidence behavior classes.",
    { exact: true },
  ).waitFor({ state: "visible", timeout: 30000 });
  return summary;
}

function dimension(summary, dimensionId) {
  const item = (summary.dimensions || []).find(
    (candidate) => candidate.dimensionId === dimensionId,
  );
  assert.ok(item, "Missing dimension " + dimensionId);
  return item;
}

async function cleanHoldScenario() {
  await openHandoverScenario("clean_hold");
  await chooseOpportunity("supported");
  await evaluateForContinuation(1);
  await chooseOpportunity("supported");
  const summary = await evaluateFinal();

  assert.equal(summary.verificationOutcome, "hold");
  assert.equal(summary.resultingPhase, baselinePhase);
  assert.equal(summary.resultingStability, baselineStability);
  assert.equal(summary.reDiagnosisRequired, false);
  assert.equal(
    summary.dimensions.every((item) => item.state === "SUPPORTED"),
    true,
  );

  const completed = await jsonRequest(
    "POST",
    "/api/tutor/students/" + studentId + "/workflow/handover-completed",
    {},
  );
  assert.equal(completed?.handoverCompleted, true);
  const workflow = await jsonRequest(
    "GET",
    "/api/tutor/students/" + studentId + "/workflow-state",
  );
  assert.equal(workflow?.handoverVerificationRequired, false);
  assert.equal(workflow?.handoverCompleted, true);

  console.log("PR47_HANDOVER_SCENARIO_PASS=clean_hold");
}

async function recoverableMixedScenario() {
  await openHandoverScenario("recoverable_mixed");
  await chooseOpportunity("conditional");
  await evaluateForContinuation(1);
  await chooseOpportunity("supported");
  await evaluateForContinuation(2);
  await chooseOpportunity("supported");
  const summary = await evaluateFinal();

  assert.equal(summary.verificationOutcome, "hold");
  assert.equal(summary.resultingStability, baselineStability);
  assert.equal(summary.reDiagnosisRequired, false);
  const structure = dimension(summary, "time.structure");
  assert.equal(structure.state, "SUPPORTED");
  assert.equal(structure.conditionalCount, 1);
  assert.equal(structure.supportedCount, 2);

  console.log("PR47_HANDOVER_SCENARIO_PASS=recoverable_mixed");
}

async function ineligibleEvidenceScenario() {
  await openHandoverScenario("not_observed_confounded");
  await chooseOpportunity("not_observed");
  await evaluateForContinuation(1);
  await chooseOpportunity("confounded");
  await evaluateForContinuation(2);

  await page.getByText("EVIDENCE OPPORTUNITY 3", { exact: true })
    .waitFor({ state: "visible", timeout: 30000 });
  const state = await topicState(expectedTopic);
  assert.equal(state.phase, baselinePhase);
  assert.equal(state.stability, baselineStability);

  console.log("PR47_HANDOVER_SCENARIO_PASS=not_observed_confounded");
}

async function persistentConditionalScenario() {
  await openHandoverScenario("persistent_conditional");
  for (let opportunity = 1; opportunity <= 5; opportunity += 1) {
    await chooseOpportunity("conditional");
    if (opportunity < 5) {
      await evaluateForContinuation(opportunity);
    } else {
      const summary = await evaluateFinal();
      assert.equal(summary.verificationOutcome, "stability_adjust");
      assert.equal(summary.resultingPhase, baselinePhase);
      assert.equal(summary.resultingStability, "Medium");
      assert.equal(summary.reDiagnosisRequired, false);
      const structure = dimension(summary, "time.structure");
      assert.equal(structure.state, "CONDITIONAL");
      assert.equal(structure.conditionalCount, 5);
    }
  }

  const state = await topicState(expectedTopic);
  assert.equal(state.phase, baselinePhase);
  assert.equal(state.stability, "Medium");

  console.log("PR47_HANDOVER_SCENARIO_PASS=persistent_conditional");
}

async function confirmedBreakdownScenario() {
  await openHandoverScenario("confirmed_breakdown");
  await chooseOpportunity("supported");
  await evaluateForContinuation(1);
  await chooseOpportunity("breakdown");
  const summary = await evaluateFinal();

  assert.equal(summary.verificationOutcome, "targeted_re_diagnosis_required");
  assert.equal(summary.resultingPhase, baselinePhase);
  assert.equal(summary.resultingStability, baselineStability);
  assert.equal(summary.reDiagnosisRequired, true);
  const structure = dimension(summary, "time.structure");
  assert.equal(structure.state, "BREAKDOWN");
  await page.getByText("Targeted re-diagnosis required", { exact: true })
    .waitFor({ state: "visible", timeout: 30000 });

  console.log("PR47_HANDOVER_SCENARIO_PASS=confirmed_breakdown");
}

try {
  await waitForCurrentPreview();
  await login();

  await cleanHoldScenario();
  await recoverableMixedScenario();
  await ineligibleEvidenceScenario();
  await persistentConditionalScenario();
  await confirmedBreakdownScenario();

  console.log("PR47_HANDOVER_LIVE_MATRIX=PASS " + JSON.stringify({
    studentId,
    topic: expectedTopic,
    baseline: baselinePhase + " / " + baselineStability,
    scenarios: [
      "clean_hold",
      "recoverable_mixed",
      "not_observed_confounded",
      "persistent_conditional",
      "confirmed_breakdown",
    ],
    evidenceAuthority: "evidence_native",
  }));
} finally {
  await browser.close();
}
