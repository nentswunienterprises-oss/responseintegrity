import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = String(process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
const pinnedAppSha = String(process.env.PROOF_PINNED_APP_SHA || "").trim();
const harnessSha = String(process.env.GITHUB_SHA || "").trim();

assert.ok(baseUrl && email && password && pinnedAppSha, "Proof runtime configuration is required");

checkpointBoot();
function checkpointBoot() {
  console.log("PR67_PROOF_BOOT=" + JSON.stringify({
    baseUrl,
    bypassConfigured: Boolean(bypass),
    pinnedAppSha,
    harnessSha,
  }));
}

const GEOMETRY_STUDENT = "828a5609-462c-4772-841a-0590ceb6a84e";
const GEOMETRY_TOPIC = "Geometry";
const LEGACY_STUDENT = "e1c11823-05e7-47a1-a753-e6599954df1a";
const LEGACY_TOPIC = "Fractions";
const TPS_REF_KEY = "_tps_timed_attempt_v1";

await mkdir("artifacts/pr67-tps-live-proof", { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(bypass
    ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass } }
    : {}),
});
const page = await context.newPage();

function checkpoint(name, payload = {}) {
  console.log("PR67_" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "=" + JSON.stringify(payload));
}

async function screenshot(name) {
  await page.screenshot({
    path: "artifacts/pr67-tps-live-proof/" + name + ".png",
    fullPage: true,
  });
}

async function proofEnvironment() {
  const response = await page.request.get(baseUrl + "/api/proof-environment", {
    timeout: 60000,
  });
  const text = await response.text();
  assert.ok(response.ok(), "Proof environment failed: " + response.status() + " " + text);
  if (text.trim().startsWith("<!DOCTYPE") || text.includes("Vercel")) {
    throw new Error(
      "Preview deployment protection blocked the live proof. Disable Preview Protection temporarily or configure VERCEL_AUTOMATION_BYPASS_SECRET for this repository.",
    );
  }
  const body = JSON.parse(text);
  assert.equal(body.vercelEnv, "preview");
  assert.equal(body.supabaseProjectRef, "jftlxeacphvbnhbsbpxc");
  assert.ok(
    body.commitSha === pinnedAppSha || body.commitSha === harnessSha,
    "Preview SHA " + body.commitSha + " is neither pinned app SHA " + pinnedAppSha + " nor harness-only SHA " + harnessSha,
  );
  checkpoint("preview_bound", {
    commitSha: body.commitSha,
    pinnedAppSha,
    harnessSha,
    supabaseProjectRef: body.supabaseProjectRef,
  });
  return body;
}

async function login() {
  await page.goto(
    baseUrl +
      "/operational/signup?role=tutor&mode=login&lock=login&returnTo=/specialist/pod",
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
  assert.ok(signin.ok(), "Login failed: " + signin.status() + " " + signinText);
  const body = JSON.parse(signinText);
  checkpoint("login", {
    userId: String(body?.dbUser?.id || body?.user?.id || "").trim(),
  });
}

async function resetTrainingFixture(studentId, topic, phase, stability) {
  const response = await page.request.post(
    baseUrl + "/api/proof/training-fixture/reset",
    {
      data: {
        studentId,
        topic,
        restorePhase: phase,
        restoreStability: stability,
        requiresTargetedRediagnosis: false,
      },
      timeout: 60000,
    },
  );
  const text = await response.text();
  assert.ok(
    response.ok(),
    "Training fixture reset failed: " + response.status() + " " + text,
  );
  const body = JSON.parse(text);
  assert.equal(body.restoredCanonicalState, true);
  assert.ok(body?.session?.id);
  checkpoint("fixture_reset", {
    studentId,
    topic: body.topic,
    phase: body.phase,
    stability: body.stability,
    sessionId: body.session.id,
  });
  return body;
}

async function getTimerContract(studentId, topic, expectOk = true) {
  const response = await page.request.get(
    baseUrl +
      "/api/tutor/students/" +
      encodeURIComponent(studentId) +
      "/tps-timer-contract?topic=" +
      encodeURIComponent(topic),
    { timeout: 60000 },
  );
  const text = await response.text();
  if (!expectOk) {
    return { response, text, body: text ? JSON.parse(text) : null };
  }
  assert.ok(
    response.ok(),
    "Timer Contract lookup failed: " + response.status() + " " + text,
  );
  const body = JSON.parse(text);
  assert.ok(body?.contract?.contractId, "Timer Contract response is missing contractId");
  return body.contract;
}

async function openTraining(studentId, topic, phase, stability, sessionId) {
  const url =
    baseUrl +
    "/specialist/intro-session/" +
    encodeURIComponent(studentId) +
    "?mode=training&topic=" +
    encodeURIComponent(topic) +
    "&phase=" +
    encodeURIComponent(phase) +
    "&stability=" +
    encodeURIComponent(stability) +
    "&scheduledSessionId=" +
    encodeURIComponent(sessionId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByText("Training Drill - " + phase, { exact: true }).waitFor({
    state: "visible",
    timeout: 60000,
  });
}

async function chooseStrongestTrainingOptions() {
  const labels = page.locator("form label");
  const count = await labels.count();
  assert.ok(count > 0, "No Training observation fields are visible");
  for (let index = 0; index < count; index += 1) {
    const label = labels.nth(index);
    if (!(await label.isVisible())) continue;
    const field = label.locator("xpath=../..");
    const buttons = field.locator("button");
    const buttonCount = await buttons.count();
    assert.ok(buttonCount > 0, "Observation field has no selectable behaviors");
    await buttons.nth(buttonCount - 1).click();
  }
}

async function clickAdvanceAndMaybeCaptureSubmission() {
  const advance = page.getByRole("button", {
    name: /^(Confirm Rep|Confirm Set|Submit Drill)$/,
  });
  await advance.waitFor({ state: "visible", timeout: 30000 });
  const label = String(await advance.textContent()).trim();
  if (label === "Submit Drill") {
    const [request, response] = await Promise.all([
      page.waitForRequest(
        (candidate) =>
          candidate.url().includes("/api/tutor/training-session-drill") &&
          candidate.method() === "POST",
        { timeout: 60000 },
      ),
      page.waitForResponse(
        (candidate) =>
          candidate.url().includes("/api/tutor/training-session-drill") &&
          candidate.request().method() === "POST",
        { timeout: 60000 },
      ),
      advance.click(),
    ]);
    const text = await response.text();
    assert.ok(
      response.ok(),
      "Training submission failed: " + response.status() + " " + text,
    );
    await page.getByRole("button", { name: "Submitted", exact: true }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    return {
      requestPayload: request.postDataJSON(),
      responseBody: text ? JSON.parse(text) : null,
    };
  }
  await advance.click();
  return null;
}

async function completeStructuredExecutionTraining(fixture) {
  await openTraining(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Structured Execution",
    "High Maintenance",
    fixture.session.id,
  );

  let finalSubmission = null;
  for (let setIndex = 0; setIndex < 3; setIndex += 1) {
    for (let repIndex = 0; repIndex < 3; repIndex += 1) {
      const repNumber = repIndex + 1;
      const begin = page.getByRole("button", {
        name: "Begin Rep " + repNumber,
        exact: true,
      });
      await begin.waitFor({ state: "visible", timeout: 30000 });
      await begin.click();

      if (setIndex === 1) {
        await page.getByText("Passive baseline measurement", { exact: true }).waitFor({
          state: "visible",
          timeout: 30000,
        });

        if (repIndex === 0) {
          await page.waitForTimeout(500);
          await page.getByRole("button", {
            name: "Record Technical Timing Failure",
            exact: true,
          }).click();
          await page.getByText(
            /Technical passive-timing failure preserved as non-decision-eligible lineage/,
          ).waitFor({ state: "visible", timeout: 30000 });
          const seReserveBegin = page.getByRole("button", {
            name: "Begin Reserve Opportunity for Rep 1",
            exact: true,
          });
          assert.equal(
            await seReserveBegin.isDisabled(),
            true,
            "SE replacement started without fresh pre-prepared reserve confirmation",
          );
          await page.getByRole("button", {
            name: "Confirm fresh pre-prepared equivalent reserve",
            exact: true,
          }).click();
          assert.equal(
            await seReserveBegin.isEnabled(),
            true,
            "SE replacement did not unlock after reserve confirmation",
          );
          await screenshot("01-se-passive-technical-failure");
          await seReserveBegin.click();
          await page.getByText("Passive baseline measurement", {
            exact: true,
          }).waitFor({ state: "visible", timeout: 30000 });
        }

        await page.waitForTimeout(5100);
        await page.getByRole("button", {
          name: "Student Finished",
          exact: true,
        }).click();
        await page.getByRole("button", {
          name: "Student Finished ✓",
          exact: true,
        }).waitFor({ state: "visible", timeout: 30000 });
      }

      await chooseStrongestTrainingOptions();
      const maybeSubmission = await clickAdvanceAndMaybeCaptureSubmission();
      if (maybeSubmission) finalSubmission = maybeSubmission;
    }
  }

  assert.ok(finalSubmission, "Structured Execution did not submit");
  await screenshot("02-se-complete");

  const contract = await getTimerContract(GEOMETRY_STUDENT, GEOMETRY_TOPIC, true);
  assert.equal(contract.baselineSource, "training_independent_execution");
  assert.ok(contract.baselineSeconds >= 4 && contract.baselineSeconds <= 8);

  const submittedDrill = finalSubmission.requestPayload?.sessionDrills?.find(
    (entry) => String(entry?.trainingTopic || "").trim() === GEOMETRY_TOPIC,
  );
  const independentSet = submittedDrill?.drill?.find(
    (set) => set?.setId === "structured_execution.independent_execution",
  );
  const passiveAttemptRefs = (independentSet?.observations || []).map((rep) => {
    const raw = rep?._passive_execution_attempt_v1;
    assert.ok(raw, "Independent Execution rep is missing passive attempt lineage");
    return JSON.parse(raw);
  });
  assert.equal(passiveAttemptRefs.length, 3);
  assert.equal(passiveAttemptRefs[0].attemptNumber, 2);
  assert.equal(passiveAttemptRefs[1].attemptNumber, 1);
  assert.equal(passiveAttemptRefs[2].attemptNumber, 1);
  assert.equal(new Set(passiveAttemptRefs.map((ref) => ref.attemptId)).size, 3);
  assert.ok(
    passiveAttemptRefs.every(
      (ref) =>
        ref.timingValidity === "valid" &&
        ref.endReason === "student_finished",
    ),
  );

  const timingAuthority = finalSubmission.responseBody?.drillResults?.find(
    (result) => String(result?.topic || "").trim() === GEOMETRY_TOPIC,
  )?.timingAuthority;
  assert.ok(timingAuthority?.contractId, "Training submission did not return frozen timing authority");
  assert.equal(timingAuthority.contractId, contract.contractId);
  assert.equal(timingAuthority.baselineSeconds, contract.baselineSeconds);
  assert.equal(timingAuthority.source, contract.baselineSource);

  checkpoint("se_timer_contract", {
    contractId: contract.contractId,
    baselineSeconds: contract.baselineSeconds,
    baselineAttemptIds: passiveAttemptRefs.map((ref) => ref.attemptId),
    replacementAttemptNumber: passiveAttemptRefs[0].attemptNumber,
    fullConstraintSeconds: contract.fullConstraintSeconds,
  });
  return contract;
}

function parseCountdown(text) {
  const value = String(text || "").trim();
  if (/^\d+s$/.test(value)) return Number(value.slice(0, -1));
  const match = value.match(/^(\d+):(\d{2})$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  throw new Error("Unrecognized countdown: " + value);
}

async function finishTimedRepEarly() {
  const button = page.getByRole("button", { name: "Student Finished", exact: true });
  await button.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(500);
  await button.click();
  await page.getByText(
    /Student execution boundary recorded/,
  ).waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
}

async function completeTpsTraining(fixture, contract) {
  await openTraining(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Time Pressure Stability",
    "High",
    fixture.session.id,
  );

  await page.getByText("Individualized Timer Contract", { exact: true }).waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByText(
    "Baseline: " + contract.baselineSeconds + "s",
    { exact: false },
  ).waitFor({ state: "visible", timeout: 30000 });

  let finalSubmission = null;

  for (let setIndex = 0; setIndex < 3; setIndex += 1) {
    for (let repIndex = 0; repIndex < 3; repIndex += 1) {
      const repNumber = repIndex + 1;
      await page.getByRole("button", {
        name: "Begin Rep " + repNumber,
        exact: true,
      }).click();

      await page.getByText(/System timer · /).waitFor({
        state: "visible",
        timeout: 30000,
      });

      if (setIndex === 0 && repIndex === 0) {
        const countdown = page.locator("div.text-4xl").first();
        const initial = parseCountdown(await countdown.textContent());
        await page.waitForTimeout(1100);
        const later = parseCountdown(await countdown.textContent());
        assert.ok(later < initial, "TPS countdown did not decrement");
        await screenshot("03-tps-countdown-running");

        await page.getByRole("button", {
          name: "Record Technical Timer Failure",
          exact: true,
        }).click();
        await page.getByText(
          /Technical timer failure preserved as non-decision-eligible lineage/,
        ).waitFor({ state: "visible", timeout: 30000 });
        const tpsReserveBegin = page.getByRole("button", {
          name: "Begin Reserve Opportunity for Rep 1",
          exact: true,
        });
        assert.equal(
          await tpsReserveBegin.isDisabled(),
          true,
          "TPS replacement started without fresh pre-prepared reserve confirmation",
        );
        await page.getByRole("button", {
          name: "Confirm fresh pre-prepared equivalent reserve",
          exact: true,
        }).click();
        assert.equal(
          await tpsReserveBegin.isEnabled(),
          true,
          "TPS replacement did not unlock after reserve confirmation",
        );
        await tpsReserveBegin.click();
        await page.getByText(/System timer · /).waitFor({
          state: "visible",
          timeout: 30000,
        });
        await finishTimedRepEarly();
      } else if (setIndex === 0 && repIndex === 1) {
        const timeoutMs = (contract.structureUnderTimerSeconds + 4) * 1000;
        await page
          .getByText(/System timer · /)
          .waitFor({ state: "hidden", timeout: timeoutMs });
        checkpoint("timer_expiry_observed", {
          set: "Structure Under Timer",
          rep: 2,
          prescribedSeconds: contract.structureUnderTimerSeconds,
        });
        await screenshot("04-tps-expiry-recorded");
      } else {
        await finishTimedRepEarly();
      }

      await chooseStrongestTrainingOptions();
      const maybeSubmission = await clickAdvanceAndMaybeCaptureSubmission();
      if (maybeSubmission) finalSubmission = maybeSubmission;
    }
  }

  assert.ok(finalSubmission, "TPS Training did not submit");
  await screenshot("05-tps-training-submitted");
  checkpoint("tps_submission", {
    sessionId: fixture.session.id,
    responseKeys: Object.keys(finalSubmission.responseBody || {}),
  });
  return finalSubmission.requestPayload;
}

async function proveServerRejectsMissingAndStaleTimedLineage(validPayload) {
  const missingFixture = await resetTrainingFixture(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Time Pressure Stability",
    "High",
  );
  const missingPayload = structuredClone(validPayload);
  missingPayload.scheduledSessionId = missingFixture.session.id;
  const firstObservation =
    missingPayload.sessionDrills?.[0]?.drill?.[0]?.observations?.[0];
  assert.ok(firstObservation?.[TPS_REF_KEY], "Captured TPS payload is missing timed lineage");
  delete firstObservation[TPS_REF_KEY];

  const missingResponse = await page.request.post(
    baseUrl + "/api/tutor/training-session-drill",
    { data: missingPayload, timeout: 60000 },
  );
  const missingText = await missingResponse.text();
  assert.equal(missingResponse.status(), 409, "Missing timed lineage was not rejected");
  assert.match(missingText, /TPS_TIMED_EVIDENCE_INVALID|missing/i);

  const staleFixture = await resetTrainingFixture(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Time Pressure Stability",
    "High",
  );
  const stalePayload = structuredClone(validPayload);
  stalePayload.scheduledSessionId = staleFixture.session.id;
  const staleObservation =
    stalePayload.sessionDrills?.[0]?.drill?.[0]?.observations?.[0];
  const staleRef = JSON.parse(staleObservation[TPS_REF_KEY]);
  staleRef.attemptId = "missing-proof-attempt-" + Date.now();
  staleObservation[TPS_REF_KEY] = JSON.stringify(staleRef);

  const staleResponse = await page.request.post(
    baseUrl + "/api/tutor/training-session-drill",
    { data: stalePayload, timeout: 60000 },
  );
  const staleText = await staleResponse.text();
  assert.equal(staleResponse.status(), 409, "Stale timed lineage was not rejected");
  assert.match(staleText, /TPS_TIMED_EVIDENCE_INVALID|missing|persisted/i);

  checkpoint("server_rejection", {
    missingStatus: missingResponse.status(),
    staleStatus: staleResponse.status(),
  });
}

async function proveLegacyAboveSeRoutesToDiagnosis() {
  const fixture = await resetTrainingFixture(
    LEGACY_STUDENT,
    LEGACY_TOPIC,
    "Controlled Discomfort",
    "High",
  );

  const contract = await getTimerContract(LEGACY_STUDENT, LEGACY_TOPIC, false);
  assert.equal(
    contract.response.status(),
    404,
    "Legacy proof topic unexpectedly has a Timer Contract",
  );
  assert.equal(contract.body?.code, "TPS_TIMER_BASELINE_INCOMPLETE");

  await openTraining(
    LEGACY_STUDENT,
    LEGACY_TOPIC,
    "Controlled Discomfort",
    "High",
    fixture.session.id,
  );

  await page.getByText("Timing readiness required", { exact: true }).waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByText(
    /does not have valid individualized timing authority/,
  ).waitFor({ state: "visible", timeout: 30000 });

  const begin = page.getByRole("button", { name: "Begin Rep 1", exact: true });
  if (await begin.count()) {
    assert.equal(await begin.isDisabled(), true);
  }

  await screenshot("06-legacy-timing-readiness-block");

  await page.getByRole("button", {
    name: "Open Targeted Re-Diagnosis",
    exact: true,
  }).click();

  await page.waitForURL(
    (url) =>
      url.pathname.includes("/specialist/intro-session/" + LEGACY_STUDENT) &&
      url.searchParams.get("rediagnosis") === "1" &&
      url.searchParams.get("phase") === "Structured Execution",
    { timeout: 30000 },
  );

  await page.getByText("Evidence-native response diagnosis", { exact: true }).waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByText("Passive baseline measurement", { exact: true }).waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByText(/Baseline evidence:\s*0\s*\/\s*3/).waitFor({
    state: "visible",
    timeout: 30000,
  });

  await screenshot("07-targeted-diagnosis-passive-baseline");
  checkpoint("legacy_route", {
    studentId: LEGACY_STUDENT,
    topic: LEGACY_TOPIC,
    route: page.url(),
  });
}

try {
  await proofEnvironment();
  await login();

  const seFixture = await resetTrainingFixture(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Structured Execution",
    "High Maintenance",
  );
  const contract = await completeStructuredExecutionTraining(seFixture);

  const tpsFixture = await resetTrainingFixture(
    GEOMETRY_STUDENT,
    GEOMETRY_TOPIC,
    "Time Pressure Stability",
    "High",
  );
  const validTpsPayload = await completeTpsTraining(tpsFixture, contract);

  await proveServerRejectsMissingAndStaleTimedLineage(validTpsPayload);
  await proveLegacyAboveSeRoutesToDiagnosis();

  checkpoint("proof_complete", {
    timerContractId: contract.contractId,
    baselineSeconds: contract.baselineSeconds,
  });
} finally {
  await browser.close();
}
