import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = String(process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const email = String(process.env.RI_PROOF_EMAIL || "").trim();
const password = String(process.env.RI_PROOF_PASSWORD || "");
assert.ok(baseUrl, "SMOKE_BASE_URL is required");
assert.ok(email, "RI_PROOF_EMAIL is required");
assert.ok(password, "RI_PROOF_PASSWORD is required");

const evidenceDir = path.resolve("artifacts/pr47-live-ui-proof/mixed");
await fs.mkdir(evidenceDir, { recursive: true });

const PHASES = {
  "Structured Execution": [
    {
      name: "Required Structure",
      fields: [
        ["Start", "delayed", "hesitant", "immediate"],
        ["Step Discipline", "skips", "partial", "full"],
        ["Structure Response", "resists", "accepts", "already structured correctly"],
        ["Independence", "needs help", "light support", "independent"],
      ],
    },
    {
      name: "Independent Execution",
      fields: [
        ["Independence", "needs help", "light support", "independent"],
        ["Repeatability", "breaks", "inconsistent", "stable"],
        ["Step Discipline", "guesses", "partial correction", "no correction needed"],
        ["Start", "delayed", "hesitant", "immediate"],
      ],
    },
    {
      name: "Variation Control",
      fields: [
        ["Transfer", "cannot adapt", "partial", "adapts"],
        ["Step Retention", "lost", "partial", "stable"],
        ["Independence", "fails", "partial", "complete"],
        ["Start", "delayed", "hesitant", "immediate"],
      ],
    },
  ],
  "Controlled Discomfort": [
    {
      name: "Controlled Entry",
      fields: [
        ["Start Control", "freeze", "hesitant", "controlled"],
        ["First-Step Accuracy", "wrong", "partial", "correct"],
        ["Stability", "breaks", "unstable", "stable"],
        ["Rescue Behavior", "frequent", "occasional", "none"],
      ],
    },
    {
      name: "No Rescue",
      fields: [
        ["Independence", "dependent", "partial", "independent"],
        ["Stability", "breaks", "unstable", "stable"],
        ["Recovery", "collapses", "partial", "no recovery needed"],
        ["First-Step Control", "none", "prompted", "independent"],
      ],
    },
    {
      name: "Repeat Exposure",
      fields: [
        ["Consistency", "breaks", "inconsistent", "stable"],
        ["Recovery", "collapses", "partial", "no recovery needed"],
        ["Rescue Behavior", "frequent", "occasional", "none"],
        ["First-Step Control", "none", "prompted", "independent"],
      ],
    },
  ],
  "Time Pressure Stability": [
    {
      name: "Structure Under Timer",
      fields: [
        ["Start", "panic", "hesitant", "controlled"],
        ["Structure", "lost", "partial", "maintained"],
        ["Pace", "rushed", "uneven", "controlled"],
        ["Completion", "fails", "partial", "complete"],
      ],
    },
    {
      name: "Repeated Timed Execution",
      fields: [
        ["Consistency", "breaks", "inconsistent", "stable"],
        ["Pace", "rushed", "uneven", "controlled"],
        ["Structure", "lost", "partial", "maintained"],
        ["Start", "panic", "hesitant", "controlled"],
      ],
    },
    {
      name: "Full Constraint",
      fields: [
        ["Completion", "fails", "partial", "complete"],
        ["Integrity", "collapses", "unstable", "stable"],
        ["Pace", "rushed", "uneven", "controlled"],
        ["Start", "panic", "hesitant", "controlled"],
      ],
    },
  ],
};

const scenarios = [
  {
    id: "clean-high-to-high-maintenance",
    studentId: "6df7d0be-79be-4f30-9d41-86fe9c66e609",
    topic: "Ratios",
    phase: "Time Pressure Stability",
    startStability: "High",
    sessionId: "857ce41e-7463-4d65-9e83-01173073e87d",
    pattern: "clean",
    expectedObserved: "High",
    expectedPhase: "Time Pressure Stability",
    expectedStability: "High Maintenance",
    expectedReason: "high maintenance entry",
  },
  {
    id: "raw-strong-but-timer-confounded",
    studentId: "6df7d0be-79be-4f30-9d41-86fe9c66e609",
    topic: "Ratios",
    phase: "Time Pressure Stability",
    startStability: "High Maintenance",
    sessionId: "6c33845d-d127-4014-ab01-f32564bdb62d",
    pattern: "confounded",
    intervention: "Timer changed",
    expectedObserved: "Medium",
    expectedPhase: "Time Pressure Stability",
    expectedStability: "High",
    expectedReason: "stability regress",
    requireHighCompatibility: true,
    requireIneligibleEvidence: true,
  },
  {
    id: "final-phase-maintenance-hold",
    studentId: "4d08a1d4-bce6-4792-95a4-72f872da3474",
    topic: "Algebra",
    phase: "Time Pressure Stability",
    startStability: "High Maintenance",
    sessionId: "180732ef-97ed-4782-b065-e5c118249d70",
    pattern: "clean",
    expectedObserved: "High",
    expectedPhase: "Time Pressure Stability",
    expectedStability: "High Maintenance",
    expectedReason: "final maintenance hold",
  },
  {
    id: "nonfinal-high-maintenance-phase-progress",
    studentId: "137ab2e5-00af-44c5-a15a-d32dd82beee6",
    topic: "Linear equations",
    phase: "Controlled Discomfort",
    startStability: "High Maintenance",
    sessionId: "a411551d-3a4b-4b79-8e0f-0b4981e06a5a",
    pattern: "clean",
    expectedObserved: "High",
    expectedPhase: "Time Pressure Stability",
    expectedStability: "Low",
    expectedReason: "phase progress",
  },
  {
    id: "persistent-breakdown",
    studentId: "e1c11823-05e7-47a1-a753-e6599954df1a",
    topic: "Fractions",
    phase: "Controlled Discomfort",
    startStability: "High Maintenance",
    sessionId: "46a86ccf-0ae6-449b-a6f8-9339f6753760",
    pattern: "breakdown",
    expectedObserved: "Low",
    expectedPhase: "Controlled Discomfort",
    expectedStability: "High",
    expectedReason: "stability regress",
    requireBreakdownDimension: true,
  },
  {
    id: "conditional-evidence-does-not-pass-as-high",
    studentId: "828a5609-462c-4772-841a-0590ceb6a84e",
    topic: "Geometry",
    phase: "Structured Execution",
    startStability: "High Maintenance",
    sessionId: "9b7f445b-bce7-409a-93fc-2c04c197f0be",
    pattern: "conditional",
    expectedObserved: "Medium",
    expectedPhase: "Structured Execution",
    expectedStability: "High",
    expectedReason: "stability regress",
  },
  {
    id: "early-breakdown-then-clean-recovery",
    studentId: "828a5609-462c-4772-841a-0590ceb6a84e",
    topic: "Geometry",
    phase: "Structured Execution",
    startStability: "High",
    sessionId: "a4d36bc9-9b65-4775-b4c5-b879434b0cc6",
    pattern: "recovery",
    expectedObserved: "High",
    expectedPhase: "Structured Execution",
    expectedStability: "High Maintenance",
    expectedReason: "high maintenance entry",
    requireRecoveredBreakdown: true,
  },
];

const normalize = (value) => String(value || "").trim().toLowerCase();

async function login(page) {
  const loginUrl = `${baseUrl}/operational/signup?role=tutor&mode=login&lock=login&returnTo=/specialist/pod`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#login-email").waitFor({ timeout: 30_000 });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) => candidate.url().includes("/api/auth/signin") && candidate.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: "Login", exact: true }).click(),
  ]);
  const body = await response.json().catch(() => null);
  assert.ok(response.ok(), `Specialist login failed: ${response.status()} ${JSON.stringify(body)}`);
  assert.equal(body?.dbUser?.role, "tutor");
}

async function topicState(page, scenario) {
  const response = await page.request.get(
    `${baseUrl}/api/tutor/topic-conditioning/${encodeURIComponent(scenario.studentId)}`,
    { timeout: 60_000 },
  );
  const text = await response.text();
  assert.ok(response.ok(), `Topic-state lookup failed for ${scenario.id}: ${response.status()} ${text}`);
  const body = JSON.parse(text);
  const rows = Array.isArray(body) ? body : Array.isArray(body?.topics) ? body.topics : [];
  const row = rows.find((candidate) => normalize(candidate?.topic) === normalize(scenario.topic));
  assert.ok(row, `Topic ${scenario.topic} not found for ${scenario.id}: ${text}`);
  return row;
}

async function assertLaunchReady(page, scenario) {
  const params = new URLSearchParams({ kind: "training", sessionId: scenario.sessionId });
  const response = await page.request.get(
    `${baseUrl}/api/tutor/students/${encodeURIComponent(scenario.studentId)}/drill-session-access?${params.toString()}`,
    { timeout: 60_000 },
  );
  const text = await response.text();
  assert.ok(response.ok(), `Training access failed for ${scenario.id}: ${response.status()} ${text}`);
  const body = JSON.parse(text);
  assert.equal(body?.canLaunch, true, `Training access not launch-ready for ${scenario.id}: ${text}`);
}

function optionFor(pattern, setIndex, repIndex, field) {
  if (pattern === "breakdown") return field[1];
  if (pattern === "conditional") return field[2];
  if (pattern === "recovery" && setIndex === 0 && repIndex === 0) return field[1];
  return field[3];
}

async function chooseField(page, label, option) {
  const labelNode = page.locator("label").filter({ hasText: label }).first();
  await labelNode.waitFor({ state: "visible", timeout: 20_000 });
  const block = labelNode.locator("..");
  const button = block.getByRole("button", { name: option, exact: true });
  await button.waitFor({ state: "visible", timeout: 20_000 });
  await button.click();
}

async function runScenario(page, scenario) {
  const before = await topicState(page, scenario);
  assert.equal(before.phase, scenario.phase, `${scenario.id}: unexpected starting phase`);
  assert.equal(before.stability, scenario.startStability, `${scenario.id}: unexpected starting stability`);
  await assertLaunchReady(page, scenario);

  const url =
    `${baseUrl}/specialist/intro-session/${encodeURIComponent(scenario.studentId)}` +
    `?mode=training&topic=${encodeURIComponent(scenario.topic)}` +
    `&phase=${encodeURIComponent(scenario.phase)}` +
    `&stability=${encodeURIComponent(scenario.startStability)}` +
    `&scheduledSessionId=${encodeURIComponent(scenario.sessionId)}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByRole("heading", { name: `Training Drill - ${scenario.phase}`, exact: true })
    .waitFor({ state: "visible", timeout: 60_000 });

  const phaseSets = PHASES[scenario.phase];
  assert.ok(phaseSets, `Unsupported test phase: ${scenario.phase}`);

  for (let setIndex = 0; setIndex < phaseSets.length; setIndex += 1) {
    const set = phaseSets[setIndex];
    for (let repIndex = 0; repIndex < 3; repIndex += 1) {
      const repNumber = repIndex + 1;
      const begin = page.getByRole("button", { name: `Begin Rep ${repNumber}`, exact: true });
      await begin.waitFor({ state: "visible", timeout: 30_000 });
      await begin.click();

      if (scenario.intervention) {
        await page.getByRole("button", { name: "Change support", exact: true }).click();
        await page.getByRole("button", { name: new RegExp("^" + scenario.intervention) }).click();
      }

      for (const field of set.fields) {
        await chooseField(page, field[0], optionFor(scenario.pattern, setIndex, repIndex, field));
      }

      const isLastSet = setIndex === phaseSets.length - 1;
      const isLastRep = repIndex === 2;
      if (isLastSet && isLastRep) {
        const responsePromise = page.waitForResponse(
          (candidate) =>
            candidate.url().includes("/api/tutor/training-session-drill") &&
            candidate.request().method() === "POST",
          { timeout: 120_000 },
        );
        await page.getByRole("button", { name: "Submit Drill", exact: true }).click();
        const response = await responsePromise;
        const responseText = await response.text();
        assert.ok(
          response.ok(),
          `${scenario.id}: training submission failed ${response.status()} ${responseText}`,
        );
        const result = JSON.parse(responseText);

        await page.getByText("Drill submitted. Evidence decision complete.", { exact: true })
          .waitFor({ state: "visible", timeout: 60_000 });

        const rows = Array.isArray(result?.scoring) ? result.scoring : [];
        assert.ok(rows.length > 0, `${scenario.id}: no scoring rows returned`);
        const decision = rows[rows.length - 1];
        assert.equal(decision.decisionAuthority, "evidence_native", `${scenario.id}: wrong decision authority`);
        assert.equal(decision.observedStability, scenario.expectedObserved, `${scenario.id}: observed stability mismatch`);
        assert.equal(decision.phase, scenario.expectedPhase, `${scenario.id}: resulting phase mismatch`);
        assert.equal(decision.stability, scenario.expectedStability, `${scenario.id}: resulting stability mismatch`);
        assert.equal(decision.transitionReason, scenario.expectedReason, `${scenario.id}: transition reason mismatch`);

        const summary = result?.drillResults?.[0]?.summary || null;
        const evidence = summary?.evidence || summary?.evidenceShadow || null;
        assert.equal(summary?.decisionAuthority, "evidence_native", `${scenario.id}: summary authority mismatch`);

        if (scenario.requireHighCompatibility) {
          assert.ok(Number(decision.sessionScore) >= 90, `${scenario.id}: compatibility score was not high`);
        }
        if (scenario.requireIneligibleEvidence) {
          assert.ok(Number(evidence?.ineligibleEvidenceCount || 0) > 0, `${scenario.id}: confounded evidence was not excluded`);
        }
        if (scenario.requireBreakdownDimension) {
          assert.ok(
            (evidence?.dimensions || []).some((dimension) => dimension.state === "BREAKDOWN"),
            `${scenario.id}: persistent breakdown did not resolve to a BREAKDOWN dimension`,
          );
        }
        if (scenario.requireRecoveredBreakdown) {
          const dimensions = evidence?.dimensions || [];
          assert.ok(dimensions.length > 0, `${scenario.id}: missing evidence dimensions`);
          assert.ok(
            dimensions.some((dimension) => Number(dimension.breakdownCount || 0) > 0),
            `${scenario.id}: recovery case did not contain an earlier breakdown`,
          );
          assert.ok(
            dimensions.every((dimension) => dimension.state === "SUPPORTED"),
            `${scenario.id}: recovery did not end with all dimensions SUPPORTED`,
          );
        }

        const nowRow = page.getByText("Now", { exact: true }).last().locator("..");
        const nowText = await nowRow.innerText();
        assert.ok(
          nowText.includes(scenario.expectedPhase) && nowText.includes(scenario.expectedStability),
          `${scenario.id}: UI Now state did not match authority decision: ${nowText}`,
        );

        const persisted = await topicState(page, scenario);
        assert.equal(persisted.phase, scenario.expectedPhase, `${scenario.id}: persisted phase mismatch`);
        assert.equal(persisted.stability, scenario.expectedStability, `${scenario.id}: persisted stability mismatch`);

        const screenshotPath = path.join(evidenceDir, `${scenario.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        return {
          id: scenario.id,
          start: { phase: before.phase, stability: before.stability },
          evidence: {
            observedStability: decision.observedStability,
            ineligibleEvidenceCount: evidence?.ineligibleEvidenceCount ?? null,
            dimensions: (evidence?.dimensions || []).map((dimension) => ({
              dimensionId: dimension.dimensionId,
              state: dimension.state,
              validOpportunityCount: dimension.validOpportunityCount,
              supportedCount: dimension.supportedCount,
              conditionalCount: dimension.conditionalCount,
              breakdownCount: dimension.breakdownCount,
            })),
          },
          compatibilityScore: decision.sessionScore,
          decisionAuthority: decision.decisionAuthority,
          transitionReason: decision.transitionReason,
          result: { phase: decision.phase, stability: decision.stability },
          persisted: { phase: persisted.phase, stability: persisted.stability },
          uiNow: nowText,
          scheduledSessionId: scenario.sessionId,
          screenshot: path.relative(process.cwd(), screenshotPath),
          pass: true,
        };
      }

      const nextLabel = isLastRep ? "Confirm Set" : "Confirm Rep";
      await page.getByRole("button", { name: nextLabel, exact: true }).click();
    }
  }

  throw new Error(`${scenario.id}: scenario loop ended without submission`);
}

const report = {
  baseUrl,
  startedAt: new Date().toISOString(),
  scenarios: [],
  failures: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

try {
  await login(page);

  const proof = await page.request.get(`${baseUrl}/api/proof-environment`, { timeout: 60_000 });
  const proofBody = await proof.json();
  assert.equal(proofBody?.vercelEnv, "preview");
  assert.equal(proofBody?.supabaseProjectRef, "jftlxeacphvbnhbsbpxc");
  assert.equal(proofBody?.requiredEnv?.SUPABASE_SERVICE_ROLE_KEY, true);

  const failedIds = new Set();
  const scenarioFilter = String(process.env.PR47_SCENARIO_FILTER || "").trim();
  const selectedScenarios = scenarioFilter
    ? scenarios.filter((scenario) => scenario.id === scenarioFilter)
    : scenarios;
  assert.ok(selectedScenarios.length > 0, scenarioFilter ? `Unknown PR47 scenario filter: ${scenarioFilter}` : "No scenarios configured");
  for (const scenario of selectedScenarios) {
    const dependencies = [];
    if (scenario.id === "raw-strong-but-timer-confounded") dependencies.push("clean-high-to-high-maintenance");
    if (scenario.id === "early-breakdown-then-clean-recovery") dependencies.push("conditional-evidence-does-not-pass-as-high");

    if (dependencies.some((id) => failedIds.has(id))) {
      report.failures.push({ id: scenario.id, skipped: true, reason: "dependency failed" });
      failedIds.add(scenario.id);
      continue;
    }

    try {
      console.log("PR47_SCENARIO_BEGIN=" + scenario.id);
      const result = await runScenario(page, scenario);
      report.scenarios.push(result);
      console.log("PR47_SCENARIO_PASS=" + scenario.id + " " + JSON.stringify({
        observedStability: result.evidence.observedStability,
        compatibilityScore: result.compatibilityScore,
        transitionReason: result.transitionReason,
        result: result.result,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      failedIds.add(scenario.id);
      report.failures.push({ id: scenario.id, message });
      console.error("PR47_SCENARIO_FAIL=" + scenario.id);
      console.error(message);
      await page.screenshot({
        path: path.join(evidenceDir, `${scenario.id}-FAIL.png`),
        fullPage: true,
      }).catch(() => undefined);
      await page.goto(`${baseUrl}/specialist/pod`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
    }
  }

  report.finishedAt = new Date().toISOString();
  report.pass = report.failures.length === 0;
  await fs.writeFile(
    path.join(evidenceDir, "mixed-scenarios.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.log("PR47_MIXED_SCENARIO_SUMMARY=" + JSON.stringify({
    pass: report.pass,
    passed: report.scenarios.map((scenario) => scenario.id),
    failures: report.failures.map((failure) => failure.id),
  }));

  assert.equal(report.failures.length, 0, `${report.failures.length} PR47 mixed UI scenario(s) failed`);
} finally {
  await browser.close();
}
