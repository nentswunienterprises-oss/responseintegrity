import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
assert.ok(baseUrl, "SMOKE_BASE_URL is required");

const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const email = `demand.smoke.${runId}@example.com`;
const password = `RiSmoke!${crypto.randomBytes(18).toString("hex")}`;
const evidenceDir = path.resolve("artifacts/demand-preview-e2e");
await fs.mkdir(evidenceDir, { recursive: true });

const evidence = {
  runId,
  baseUrl,
  email,
  productionLink: "DEMAND01",
  pipeline: "demand",
  trackingSource: "smoke",
  trackingCampaign: "demand-gateway-smoke",
  checkpoints: [],
  consoleErrors: [],
};

function checkpoint(name, details = {}) {
  evidence.checkpoints.push({ name, at: new Date().toISOString(), ...details });
  console.log(`CHECKPOINT ${name}`, JSON.stringify(details));
}

async function saveEvidence() {
  await fs.writeFile(path.join(evidenceDir, "journey.json"), JSON.stringify(evidence, null, 2), "utf8");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

page.on("console", (message) => {
  if (message.type() === "error") evidence.consoleErrors.push(message.text());
});

try {
  const intakeUrl =
    `${baseUrl}/client/intake?fastTrack=exec&production=DEMAND01&pipeline=demand&utm_source=smoke&utm_campaign=demand-gateway-smoke`;

  const intakeResponse = await page.goto(intakeUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const intakeBody = await page.locator("body").innerText();
  assert.ok(intakeBody.toLowerCase().includes("parent intake gateway"), `Expected RI intake page, got ${page.url()} / ${await page.title()}`);
  checkpoint("fast-track-intake-opened", { url: page.url(), status: intakeResponse?.status() ?? null });
  await page.screenshot({ path: path.join(evidenceDir, "01-fast-track-intake.png"), fullPage: true });

  const continueButton = page.getByRole("button", { name: "Continue to Parent Sign Up" }).first();
  await continueButton.waitFor({ timeout: 30_000 });
  await continueButton.click();
  await page.waitForURL(/\/client\/signup/, { timeout: 30_000 });

  const signupUrl = new URL(page.url());
  assert.equal(signupUrl.searchParams.get("fastTrack"), "exec");
  assert.equal(signupUrl.searchParams.get("production"), "DEMAND01");
  assert.equal(signupUrl.searchParams.get("pipeline"), "demand");
  assert.equal(signupUrl.searchParams.get("utm_source"), "smoke");
  assert.equal(signupUrl.searchParams.get("utm_campaign"), "demand-gateway-smoke");
  checkpoint("tracking-survived-intake-to-signup", {
    pathname: signupUrl.pathname,
    production: signupUrl.searchParams.get("production"),
    pipeline: signupUrl.searchParams.get("pipeline"),
    source: signupUrl.searchParams.get("utm_source"),
    campaign: signupUrl.searchParams.get("utm_campaign"),
  });

  await page.locator("#firstName").fill("Demand");
  await page.locator("#lastName").fill("Smoke");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/api/auth/signup") && response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: "Sign Up", exact: true }).click(),
  ]);
  const signupBody = await signupResponse.json().catch(() => null);
  assert.ok(signupResponse.ok(), `Signup failed: ${signupResponse.status()} ${JSON.stringify(signupBody)}`);
  checkpoint("parent-signup-created", { status: signupResponse.status(), email });
  console.log(`SMOKE_EMAIL=${email}`);
  console.log("SMOKE_SIGNUP_COMPLETE=true");
  await page.screenshot({ path: path.join(evidenceDir, "02-signup-created.png"), fullPage: true });

  const loginUrl =
    `${baseUrl}/client/signup?mode=login&fastTrack=exec&production=DEMAND01&pipeline=demand&utm_source=smoke&utm_campaign=demand-gateway-smoke`;

  let loggedIn = false;
  let lastSignin = null;
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);

    const [signinResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("/api/auth/signin") && response.request().method() === "POST",
        { timeout: 60_000 },
      ),
      page.getByRole("button", { name: "Login", exact: true }).click(),
    ]);
    const signinBody = await signinResponse.json().catch(() => null);
    lastSignin = { attempt, status: signinResponse.status(), message: signinBody?.message || null };

    try {
      await page.waitForURL(/\/client\/parent\/gateway/, { timeout: 6_000 });
      loggedIn = true;
      break;
    } catch {
      console.log(`LOGIN_WAIT attempt=${attempt} status=${signinResponse.status()} message=${signinBody?.message || "none"}`);
      await page.waitForTimeout(4_000);
    }
  }
  assert.ok(loggedIn, `Parent login did not reach Gateway. Last signin: ${JSON.stringify(lastSignin)}`);
  checkpoint("parent-login-reached-gateway", { url: page.url(), lastSignin });

  await page.getByText("Application Form", { exact: true }).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: path.join(evidenceDir, "03-gateway-application.png"), fullPage: true });

  await page.getByPlaceholder("Your full name").fill("Demand Smoke Parent");
  await page.getByPlaceholder("+27 71 234 5678").fill("+27 71 000 0001");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("Your city").fill("Johannesburg");
  await page.getByPlaceholder("Student's name").fill("Demand Smoke Student");
  await page.getByRole("button", { name: "Grade 8", exact: true }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByPlaceholder("School name").fill("Demand Smoke School");
  await page.getByRole("button", { name: "Timed work", exact: true }).click();

  await page.getByPlaceholder("Type one math topic, then add it").fill("Algebra");
  await page.getByRole("button", { name: /Add$/ }).click();
  await page.getByRole("button", {
    name: "My child often does not understand what the question is asking",
    exact: true,
  }).click();

  await page.getByRole("button", { name: "No - this will be their first time", exact: true }).click();
  await page.getByRole("button", { name: "Yes, always", exact: true }).click();

  const processPrompt = page.getByText(
    "Are you willing for your child to be trained to solve problems independently, without relying on constant encouragement or guidance?",
    { exact: false },
  );
  const processContainer = processPrompt.locator("xpath=..");
  await processContainer.getByRole("button", { name: "Yes", exact: true }).click();

  await page.getByRole("button", { name: "I agree to the above terms", exact: true }).click();

  const submitButton = page.getByRole("button", { name: "Submit Application", exact: true });
  assert.equal(await submitButton.isEnabled(), true, "Gateway application should be submittable");

  const [enrollmentResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/api/parent/enroll") && response.request().method() === "POST",
      { timeout: 60_000 },
    ),
    submitButton.click(),
  ]);
  const enrollmentBody = await enrollmentResponse.json().catch(() => null);
  assert.ok(enrollmentResponse.ok(), `Enrollment submission failed: ${enrollmentResponse.status()} ${JSON.stringify(enrollmentBody)}`);

  await page.getByText("Application received. We're assessing fit.", { exact: true }).waitFor({ timeout: 30_000 });
  checkpoint("gateway-application-submitted", {
    status: enrollmentResponse.status(),
    url: page.url(),
    confirmation: "Application received. We're assessing fit.",
  });
  await page.screenshot({ path: path.join(evidenceDir, "04-application-pending-review.png"), fullPage: true });

  evidence.result = "PASS";
  await saveEvidence();
  console.log("DEMAND_PREVIEW_E2E=PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.failure = error instanceof Error ? error.stack || error.message : String(error);
  await saveEvidence();
  console.error("DEMAND_PREVIEW_E2E=FAIL");
  console.error(evidence.failure);
  throw error;
} finally {
  await browser.close();
}
