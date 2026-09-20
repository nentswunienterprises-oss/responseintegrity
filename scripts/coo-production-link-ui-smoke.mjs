import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
assert.ok(baseUrl, "SMOKE_BASE_URL is required");
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const email = `coo.link.smoke.${runId}@smoke.responseintegrity.co.za`;
const password = `RiCooSmoke!${runId}`;
const ownerName = `COO Link Smoke ${runId}`;
const campaignName = `coo-link-smoke-${runId}`;
const evidenceDir = path.resolve("artifacts/coo-production-link-ui-smoke");
await fs.mkdir(evidenceDir, { recursive: true });
const evidence = { runId, baseUrl, email, ownerName, campaignName, checkpoints: [], consoleErrors: [] };
function checkpoint(name, details = {}) {
  evidence.checkpoints.push({ name, at: new Date().toISOString(), ...details });
  console.log("CHECKPOINT", name, JSON.stringify(details));
}
async function saveEvidence() {
  await fs.writeFile(path.join(evidenceDir, "journey.json"), JSON.stringify(evidence, null, 2), "utf8");
}

const browser = await chromium.launch({ headless: true });
const cooContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const cooPage = await cooContext.newPage();
cooPage.on("console", (message) => { if (message.type() === "error") evidence.consoleErrors.push(message.text()); });

try {
  await cooPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const signupResponse = await cooPage.request.post(`${baseUrl}/api/auth/signup`, {
    data: {
      email,
      password,
      role: "coo",
      first_name: "COO",
      last_name: "Link Smoke",
      tracking_source: "coo-ui-smoke",
      tracking_campaign: campaignName,
    },
    timeout: 60_000,
  });
  const signupBody = await signupResponse.json().catch(() => null);
  assert.ok(signupResponse.ok(), `Preview COO provisioning failed: ${signupResponse.status()} ${JSON.stringify(signupBody)}`);
  checkpoint("preview-coo-session-created", { status: signupResponse.status(), userId: signupBody?.user?.id || null, role: signupBody?.user?.role || null });

  await cooPage.goto(`${baseUrl}/coo/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await cooPage.getByText("Generate Production Link", { exact: true }).waitFor({ timeout: 60_000 });
  checkpoint("coo-dashboard-opened", { url: cooPage.url() });
  await cooPage.screenshot({ path: path.join(evidenceDir, "01-coo-dashboard.png"), fullPage: true });

  await cooPage.getByPlaceholder("Campaign or source name").fill(ownerName);
  await cooPage.getByPlaceholder("Campaign identifier").fill(campaignName);
  await cooPage.getByPlaceholder("Enter person name").fill("COO Link Smoke");

  const [createResponse] = await Promise.all([
    cooPage.waitForResponse((response) => response.url().includes("/api/coo/create-affiliate-code") && response.request().method() === "POST", { timeout: 60_000 }),
    cooPage.getByRole("button", { name: "Generate Code & Link", exact: true }).click(),
  ]);
  const createBody = await createResponse.json().catch(() => null);
  assert.ok(createResponse.ok(), `COO Production Link creation failed: ${createResponse.status()} ${JSON.stringify(createBody)}`);

  await cooPage.getByText("Canonical Production Link", { exact: true }).waitFor({ timeout: 30_000 });
  const readOnly = cooPage.locator("input[readonly]");
  assert.ok((await readOnly.count()) >= 2, "Expected generated code and canonical link");
  const generatedCode = await readOnly.nth(0).inputValue();
  const generatedLink = await readOnly.nth(1).inputValue();
  assert.equal(generatedCode, createBody?.code);
  assert.equal(generatedLink, createBody?.link);

  const canonical = new URL(generatedLink);
  assert.equal(canonical.origin, "https://app.responseintegrity.co.za");
  assert.equal(canonical.pathname, "/");
  assert.equal(canonical.searchParams.get("production"), generatedCode);
  assert.equal(canonical.searchParams.get("pipeline"), "demand");

  evidence.generatedCode = generatedCode;
  evidence.generatedLink = generatedLink;
  checkpoint("dashboard-generated-canonical-demand-link", { code: generatedCode, link: generatedLink, pipeline: createBody?.pipelineType || "demand" });
  await cooPage.screenshot({ path: path.join(evidenceDir, "02-generated-link.png"), fullPage: true });

  const parentContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const parentPage = await parentContext.newPage();
  await parentPage.goto(generatedLink, { waitUntil: "domcontentloaded", timeout: 90_000 });

  const opened = new URL(parentPage.url());
  assert.equal(opened.searchParams.get("production"), generatedCode);
  assert.equal(opened.searchParams.get("pipeline"), "demand");

  const signupCtas = parentPage.locator("[data-signup-link]");
  const count = await signupCtas.count();
  assert.ok(count >= 1, "Canonical Production Link landing must expose signup CTAs");
  const hrefs = await signupCtas.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
  for (const href of hrefs) {
    assert.ok(href);
    const target = new URL(href, "https://app.responseintegrity.co.za");
    assert.equal(target.pathname, "/client/signup");
    assert.equal(target.searchParams.get("production"), generatedCode);
    assert.equal(target.searchParams.get("pipeline"), "demand");
  }
  checkpoint("canonical-link-opened-as-parent", { url: parentPage.url(), ctaHrefs: hrefs });
  await parentPage.screenshot({ path: path.join(evidenceDir, "03-parent-landing.png"), fullPage: true });

  await signupCtas.first().click();
  await parentPage.waitForURL(/\/client\/signup/, { timeout: 30_000 });
  const signupUrl = new URL(parentPage.url());
  assert.equal(signupUrl.searchParams.get("production"), generatedCode);
  assert.equal(signupUrl.searchParams.get("pipeline"), "demand");
  await parentPage.getByText("Parent Portal", { exact: true }).first().waitFor({ timeout: 30_000 });
  checkpoint("parent-reached-attributed-signup", { url: parentPage.url(), production: signupUrl.searchParams.get("production"), pipeline: signupUrl.searchParams.get("pipeline") });
  await parentPage.screenshot({ path: path.join(evidenceDir, "04-attributed-signup.png"), fullPage: true });

  await parentContext.close();
  evidence.result = "PASS";
  await saveEvidence();
  console.log(`COO_LINK_SMOKE_EMAIL=${email}`);
  console.log(`COO_LINK_SMOKE_CODE=${generatedCode}`);
  console.log(`COO_LINK_SMOKE_URL=${generatedLink}`);
  console.log("COO_PRODUCTION_LINK_UI_SMOKE=PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.failure = error instanceof Error ? error.stack || error.message : String(error);
  await saveEvidence();
  console.error("COO_PRODUCTION_LINK_UI_SMOKE=FAIL");
  console.error(evidence.failure);
  throw error;
} finally {
  await cooContext.close().catch(() => undefined);
  await browser.close();
}
