import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = String(process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
const vercelBypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
assert.ok(baseUrl, "SMOKE_BASE_URL is required");
assert.ok(email, "RI_PROOF_EMAIL is required");
assert.ok(password, "RI_PROOF_PASSWORD is required");

const evidenceDir = path.resolve("artifacts/pr47-live-ui-proof");
await fs.mkdir(evidenceDir, { recursive: true });
const evidence = {
  baseUrl,
  startedAt: new Date().toISOString(),
  checkpoints: [],
  consoleErrors: [],
  inventory: null,
};
const checkpoint = (name, details = {}) => {
  evidence.checkpoints.push({ name, at: new Date().toISOString(), ...details });
  console.log(`CHECKPOINT ${name}`, JSON.stringify(details));
};
const save = async () => fs.writeFile(
  path.join(evidenceDir, "inventory.json"),
  JSON.stringify(evidence, null, 2),
  "utf8",
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(vercelBypass
    ? { extraHTTPHeaders: { "x-vercel-protection-bypass": vercelBypass } }
    : {}),
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") evidence.consoleErrors.push(message.text());
});

try {
  const proofResponse = await page.request.get(`${baseUrl}/api/__proof/environment`, { timeout: 60_000 });
  const proofText = await proofResponse.text();
  assert.ok(proofResponse.ok(), `Proof environment probe failed: ${proofResponse.status()} ${proofText}`);
  const proof = JSON.parse(proofText);
  assert.equal(proof.vercelEnv, "preview", `Expected preview Vercel environment: ${proofText}`);
  assert.ok(
    new Set(["jftlxeacphvbnhbsbpxc", "tzgkiaiwnhmnzznvmbfg"]).has(proof.supabaseProjectRef),
    `Preview is not routed to an approved Proof Supabase project: ${proofText}`,
  );
  checkpoint("proof-environment-certified", {
    vercelEnv: proof.vercelEnv,
    supabaseProjectRef: proof.supabaseProjectRef,
  });

  const loginUrl = `${baseUrl}/operational/signup?role=tutor&mode=login&lock=login&returnTo=/specialist/pod`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#login-email").waitFor({ timeout: 30_000 });
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
  assert.ok(signinResponse.ok(), `Specialist login failed: ${signinResponse.status()} ${JSON.stringify(signinBody)}`);
  checkpoint("specialist-login-succeeded", {
    status: signinResponse.status(),
    role: signinBody?.dbUser?.role || null,
    userId: signinBody?.dbUser?.id || null,
  });

  await page.waitForTimeout(1500);
  await page.goto(`${baseUrl}/specialist/pod`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.screenshot({ path: path.join(evidenceDir, "01-specialist-pod.png"), fullPage: true });

  const authUserResponse = await page.request.get(`${baseUrl}/api/auth/user`, { timeout: 60_000 });
  const authUserText = await authUserResponse.text();
  assert.ok(authUserResponse.ok(), `Authenticated user probe failed: ${authUserResponse.status()} ${authUserText}`);
  const authUser = JSON.parse(authUserText);

  const podResponse = await page.request.get(`${baseUrl}/api/tutor/pod`, { timeout: 60_000 });
  const podText = await podResponse.text();
  assert.ok(podResponse.ok(), `Tutor pod inventory failed: ${podResponse.status()} ${podText}`);
  const pod = JSON.parse(podText);
  const students = Array.isArray(pod) ? pod : Array.isArray(pod?.students) ? pod.students : [];

  const studentInventory = [];
  for (const student of students) {
    const studentId = String(student?.id || "").trim();
    if (!studentId) continue;
    const name = String(student?.name || student?.fullName || student?.full_name || "").trim();

    const [topicsResponse, accessResponse] = await Promise.all([
      page.request.get(`${baseUrl}/api/tutor/topic-conditioning/${encodeURIComponent(studentId)}`, { timeout: 60_000 }).catch(() => null),
      page.request.get(`${baseUrl}/api/tutor/students/${encodeURIComponent(studentId)}/drill-session-access?kind=training`, { timeout: 60_000 }).catch(() => null),
    ]);

    const topics = topicsResponse
      ? await topicsResponse.json().catch(async () => ({ error: await topicsResponse.text().catch(() => "") }))
      : { error: "request_failed" };
    const trainingAccess = accessResponse
      ? await accessResponse.json().catch(async () => ({ error: await accessResponse.text().catch(() => "") }))
      : { error: "request_failed" };

    studentInventory.push({
      id: studentId,
      name,
      operationalMode: student?.operationalMode || student?.operational_mode || null,
      topics,
      trainingAccess,
    });
  }

  evidence.inventory = {
    authUser: {
      id: authUser?.id || authUser?.user?.id || null,
      role: authUser?.role || authUser?.user?.role || null,
    },
    studentCount: studentInventory.length,
    students: studentInventory,
  };
  checkpoint("live-sandbox-inventory-captured", {
    studentCount: studentInventory.length,
    sandboxStudents: studentInventory.filter((student) => /sandbox/i.test(student.name)).map((student) => student.name),
  });
  evidence.result = "PASS";
  evidence.finishedAt = new Date().toISOString();
  await save();
  console.log("PR47_LIVE_UI_INVENTORY=PASS");
} catch (error) {
  evidence.result = "FAIL";
  evidence.failure = error instanceof Error ? error.stack || error.message : String(error);
  evidence.finishedAt = new Date().toISOString();
  await save();
  console.error("PR47_LIVE_UI_INVENTORY=FAIL");
  console.error(evidence.failure);
  throw error;
} finally {
  await browser.close();
}
