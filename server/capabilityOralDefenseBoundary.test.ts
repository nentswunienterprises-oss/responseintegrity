import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const oralService = fs.readFileSync(new URL("./capabilityOralDefense.ts", import.meta.url), "utf8");
const oralCore = fs.readFileSync(new URL("./capabilityOralDefenseCore.ts", import.meta.url), "utf8");
const readinessService = fs.readFileSync(new URL("./capabilityReadiness.ts", import.meta.url), "utf8");
const evidenceSelector = fs.readFileSync(new URL("../shared/capabilityEvidenceSelection.ts", import.meta.url), "utf8");
const reviewerScope = fs.readFileSync(new URL("../shared/capabilityReviewerScope.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityOralDefense.ts", import.meta.url), "utf8");
const readinessContract = fs.readFileSync(new URL("../shared/capabilityReadiness.ts", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);

test("oral brief uses internal evidence risk but never exposes answer keys or stored item wording", () => {
  assert.match(oralService, /question_results/);
  assert.match(oralCore, /incorrectCount/);
  assert.match(oralCore, /criticalFailCount/);
  assert.match(oralCore, /practicalRepeatCount/);
  assert.doesNotMatch(oralCore, /correctOptionKeys/);
  assert.doesNotMatch(oralCore, /selectedOptionKeys/);
  assert.doesNotMatch(oralCore, /explanation:/);
  assert.match(oralCore, /Do not reuse a known assessment item/);
});

test("oral defense remains bounded to three baseline probes plus at most two evidence-risk probes", () => {
  assert.match(oralCore, /\.slice\(0, 2\)/);
  assert.match(oralCore, /ORAL_DEFENSE_ALWAYS_PROBE/);
  assert.match(routeSource, /\.min\(3\)\.max\(5\)/);
});

test("human oral defense cannot open before automated and practical prerequisites are satisfied", () => {
  assert.ok((oralService.match(/assertPreOralCapabilityEvidenceReady/g) || []).length >= 2);
  assert.match(readinessService, /requirement\.kind !== "oral_defense" && !requirement\.satisfied/);
  assert.match(readinessService, /missingRequirementCodes/);
});

test("shadow readiness uses the shared latest/current-version evidence selector", () => {
  assert.match(readinessService, /selectCurrentCapabilityReadinessEvidence/);
  assert.match(readinessService, /WHERE active = true/);
  assert.match(readinessService, /CAPABILITY_PRACTICAL_PROOFS/);
  assert.match(evidenceSelector, /latestByKey/);
  assert.match(evidenceSelector, /activeAssessmentVersions\.get\(record\.assessmentKey\) === record\.bankVersion/);
  assert.match(evidenceSelector, /currentPracticalVersions\.get\(record\.proofKey\) === record\.proofVersion/);
  assert.match(evidenceSelector, /latestOralDefense\.defenseVersion === input\.currentOralDefenseVersion/);
});

test("issued oral brief is bound to current evidence state and attempt identity", () => {
  assert.match(oralService, /buildCapabilityEvidenceFingerprint/);
  assert.match(oralService, /buildCapabilityOralBriefId/);
  assert.match(oralService, /input\.briefId !== brief\.briefId/);
  assert.match(oralService, /input\.attemptNumber !== brief\.attemptNumber/);
  assert.match(routeSource, /briefId: z\.string/);
  assert.match(routeSource, /attemptNumber: z\.number\(\)\.int\(\)\.positive\(\)/);
});

test("historical practical repeat or integrity outcomes can target the oral defense", () => {
  assert.match(oralService, /competency_links/);
  assert.match(oralCore, /practical\.outcome !== "repeat_required" && practical\.outcome !== "integrity_review"/);
  assert.match(oralCore, /practicalIntegrityCount/);
});

test("TD access is delegated to the shared pod-scope rule", () => {
  assert.match(readinessService, /canCapabilityReviewerAccessAssignment/);
  assert.match(reviewerScope, /input\.reviewerRole === "td"/);
  assert.match(reviewerScope, /input\.assignmentTdId/);
  assert.match(reviewerScope, /input\.reviewerId/);
});

test("oral defense evidence is immutable and sandbox-only", () => {
  assert.match(oralService, /INSERT INTO specialist_capability_oral_defenses/);
  assert.doesNotMatch(oralService, /UPDATE specialist_capability_oral_defenses/);
  assert.match(routeSource, /sandboxScenarioConfirmed: z\.literal\(true\)/);
  assert.match(migrationSource, /sandbox_scenario_confirmed boolean NOT NULL CHECK \(sandbox_scenario_confirmed = true\)/);
});

test("review queue only surfaces candidates whose non-oral evidence is complete", () => {
  assert.match(oralService, /listOralDefenseCandidates/);
  assert.match(oralService, /requirement\.kind !== "oral_defense" && !requirement\.satisfied/);
  assert.match(routeSource, /oral-defense\/candidates/);
});

test("shadow readiness is structurally non-authoritative", () => {
  assert.match(readinessContract, /authoritative: false/);
  assert.doesNotMatch(readinessService, /UPDATE tutor_assignments/);
  assert.doesNotMatch(readinessService, /certification_status/);
  assert.doesNotMatch(readinessService, /operational_mode/);
  assert.doesNotMatch(oralService, /UPDATE tutor_assignments/);
  assert.doesNotMatch(oralService, /certification_status/);
  assert.doesNotMatch(oralService, /operational_mode/);
});

test("all oral/readiness routes require authentication and role boundaries", () => {
  assert.ok((routeSource.match(/isAuthenticated/g) || []).length >= 6);
  assert.match(routeSource, /Specialist access required/);
  assert.match(routeSource, /Capability review access is restricted/);
});
