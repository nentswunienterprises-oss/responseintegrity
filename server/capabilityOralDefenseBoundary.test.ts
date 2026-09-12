import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const oralService = fs.readFileSync(new URL("./capabilityOralDefense.ts", import.meta.url), "utf8");
const oralCore = fs.readFileSync(new URL("./capabilityOralDefenseCore.ts", import.meta.url), "utf8");
const readinessService = fs.readFileSync(new URL("./capabilityReadiness.ts", import.meta.url), "utf8");
const evidenceSelector = fs.readFileSync(new URL("../shared/capabilityEvidenceSelection.ts", import.meta.url), "utf8");
const reviewerScope = fs.readFileSync(new URL("../shared/capabilityReviewerScope.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("./routes/capabilityOralDefense.ts", import.meta.url), "utf8");
const sharedOral = fs.readFileSync(new URL("../shared/capabilityOralDefense.ts", import.meta.url), "utf8");
const readinessContract = fs.readFileSync(new URL("../shared/capabilityReadiness.ts", import.meta.url), "utf8");
const migrationSource = fs.readFileSync(
  new URL("../migrations/2026-09-11_add_capability_assessment_attempts.sql", import.meta.url),
  "utf8",
);

test("oral brief uses internal evidence risk but never exposes assessment answer keys", () => {
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

test("shadow readiness uses current Oral Defense version and shared current-evidence selector", () => {
  assert.match(readinessService, /selectCurrentCapabilityReadinessEvidence/);
  assert.match(readinessService, /ORAL_DEFENSE_VERSION/);
  assert.match(readinessService, /currentOralDefenseVersion: ORAL_DEFENSE_VERSION/);
  assert.match(evidenceSelector, /latestOralDefense\.defenseVersion === input\.currentOralDefenseVersion/);
  assert.match(sharedOral, /ORAL_DEFENSE_VERSION = 2/);
});

test("reviewer service selects latest attempt inside the current Oral Defense version", () => {
  assert.match(oralService, /getLatestCurrentOralDefense/);
  assert.match(oralService, /AND defense_version = \$2/);
  assert.match(oralService, /\[tutorAssignmentId, ORAL_DEFENSE_VERSION\]/);
  assert.doesNotMatch(oralService, /const currentVersionAttempt = Number\(latestDefense\?\.defense_version\)/);
});

test("issued oral brief is bound to current evidence, version, attempt, and rubric contract", () => {
  assert.match(oralService, /buildCapabilityEvidenceFingerprint/);
  assert.match(oralService, /buildCapabilityOralBriefId/);
  assert.match(oralService, /input\.briefId !== brief\.briefId/);
  assert.match(oralService, /input\.attemptNumber !== brief\.attemptNumber/);
  assert.match(oralCore, /rubric: probe\.rubric/);
  assert.match(oralCore, /JSON\.stringify\(probeContract\)/);
  assert.match(routeSource, /briefId: z\.string/);
  assert.match(routeSource, /attemptNumber: z\.number\(\)\.int\(\)\.positive\(\)/);
});

test("historical practical repeat or integrity outcomes can target the oral defense", () => {
  assert.match(oralService, /competency_links/);
  assert.match(oralCore, /practical\.outcome !== "repeat_required" && practical\.outcome !== "integrity_review"/);
  assert.match(oralCore, /practicalIntegrityCount/);
});

test("API accepts only observable probe evidence and rejects reviewer-selected integrity or outcome fields", () => {
  const probeSchemaStart = routeSource.indexOf("const oralProbeSchema");
  const probeSchemaEnd = routeSource.indexOf("const completeDefenseSchema", probeSchemaStart);
  const completionSchemaStart = probeSchemaEnd;
  const completionSchemaEnd = routeSource.indexOf("function requireSpecialist", completionSchemaStart);
  assert.notEqual(probeSchemaStart, -1);
  assert.notEqual(probeSchemaEnd, -1);
  assert.notEqual(completionSchemaEnd, -1);

  const probeSchema = routeSource.slice(probeSchemaStart, probeSchemaEnd);
  const completionSchema = routeSource.slice(completionSchemaStart, completionSchemaEnd);
  assert.match(probeSchema, /judgment: z\.enum\(\["clear", "partial", "fail"\]\)/);
  assert.match(probeSchema, /\.strict\(\)/);
  assert.doesNotMatch(probeSchema, /integrityConcern/);
  assert.match(completionSchema, /\.strict\(\)/);
  assert.doesNotMatch(completionSchema, /outcome:/);
  assert.match(oralService, /evaluateOralDefenseProbes\(brief\.probes, input\.probes\)/);
  assert.doesNotMatch(oralService, /input\.integrityConcern/);
  assert.doesNotMatch(oralService, /input\.outcome/);
});

test("integrity escalation is derived only from failed issued critical rubrics", () => {
  assert.match(sharedOral, /entry\.observation\.judgment === "fail" && entry\.issued\.rubric\.criticalOnFail/);
  assert.match(sharedOral, /criticalFailCount > 0/);
  assert.match(sharedOral, /"integrity_review"/);
  assert.match(oralService, /evaluation\.criticalFailCount/);
  assert.match(oralService, /evaluation\.criticalFailProbeKeys/);
});

test("non-approved defense requires actionable reviewer feedback", () => {
  assert.match(oralService, /evaluation\.outcome !== "approved" && feedback\.length < 20/);
  assert.match(oralService, /Actionable reviewer feedback is required/);
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
  assert.match(oralService, /JSON\.stringify\(brief\)/);
  assert.match(oralService, /JSON\.stringify\(input\.probes\)/);
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
