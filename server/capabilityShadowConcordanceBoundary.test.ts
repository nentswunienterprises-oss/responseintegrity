import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const coreSource = fs.readFileSync(
  new URL("../shared/capabilityShadowConcordance.ts", import.meta.url),
  "utf8",
);
const serviceSource = fs.readFileSync(
  new URL("./capabilityShadowConcordance.ts", import.meta.url),
  "utf8",
);
const routeSource = fs.readFileSync(
  new URL("./routes/capabilityShadowConcordance.ts", import.meta.url),
  "utf8",
);
const serverIndexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const apiIndexSource = fs.readFileSync(new URL("../api/index.ts", import.meta.url), "utf8");

function sourceSection(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  assert.ok(end > start, `Missing source end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("shadow concordance route is authenticated GET-only reviewer analysis", () => {
  assert.match(routeSource, /app\.get\(/);
  assert.match(routeSource, /isAuthenticated/);
  assert.match(routeSource, /shadow-concordance\/:tutorAssignmentId/);
  assert.doesNotMatch(routeSource, /app\.(post|put|patch|delete)\(/);
  assert.doesNotMatch(routeSource, /apiRequest/);
});

test("persisted concordance service reuses existing reviewer scope and production Battle Test derivation", () => {
  assert.match(serviceSource, /assertCapabilityReviewerAccessToAssignment/);
  assert.match(serviceSource, /buildTutorDeepDiveProgress/);
  assert.match(serviceSource, /battle_test_runs/);
  assert.match(serviceSource, /specialist_capability_assessment_attempts/);
  assert.match(serviceSource, /specialist_capability_practical_evidence/);
  assert.match(serviceSource, /specialist_capability_oral_defenses/);
  assert.match(serviceSource, /specialist_capability_sandbox_simulation_attempts/);
  assert.match(serviceSource, /getLatestSandboxMockAssessment/);
  assert.match(serviceSource, /tutor_trial_cases/);
  assert.match(serviceSource, /tutor_certification_decisions/);
  assert.match(serviceSource, /buildShadowSpecialistConcordance/);
});

test("shadow concordance service contains no authority write path", () => {
  for (const source of [serviceSource, routeSource]) {
    assert.doesNotMatch(source, /INSERT\s+INTO/i);
    assert.doesNotMatch(source, /UPDATE\s+[a-z_]/i);
    assert.doesNotMatch(source, /DELETE\s+FROM/i);
    assert.doesNotMatch(source, /\.insert\s*\(/);
    assert.doesNotMatch(source, /\.update\s*\(/);
    assert.doesNotMatch(source, /\.delete\s*\(/);
    assert.doesNotMatch(source, /recordSandboxMockAssessment/);
    assert.doesNotMatch(source, /record_tutor_sandbox_mock_assessment/);
    assert.doesNotMatch(source, /createTrialCase/);
    assert.doesNotMatch(source, /reviewTrialPlacement/);
    assert.doesNotMatch(source, /recordTrialCertificationDecision/);
    assert.doesNotMatch(source, /certification_status\s*=/i);
    assert.doesNotMatch(source, /operational_mode\s*=/i);
    assert.doesNotMatch(source, /student_state\s*=/i);
  }
});

test("shadow concordance uses current-version Capability evidence and keeps simulation contextual", () => {
  assert.match(serviceSource, /private\.specialist_capability_assessment_configs/);
  assert.match(serviceSource, /Number\(row\.bank_version\) === bankVersion/);
  assert.match(serviceSource, /proof_version\) === proof\.version/);
  assert.match(serviceSource, /defense_version\) === ORAL_DEFENSE_VERSION/);
  assert.match(serviceSource, /activeSimulationBankVersion/);
  assert.match(coreSource, /capabilitySimulationEvidence: input\.capabilityEvidence\.sandboxSimulation/);
  const capabilityOverallSection = sourceSection(
    coreSource,
    "function normalizeCapabilityOverallState",
    "export function buildShadowSpecialistConcordance",
  );
  assert.doesNotMatch(capabilityOverallSection, /sandboxSimulation/);
});

test("shadow concordance is descriptive only with no hard-coded equivalence threshold or cutover authority", () => {
  assert.match(coreSource, /authoritative: false/);
  assert.match(coreSource, /cutoverDecision: null/);
  assert.match(coreSource, /analysisKind: "descriptive_shadow_concordance"/);
  assert.match(coreSource, /statisticalAnalysisPlanDefined: false/);
  assert.match(coreSource, /equivalenceEstablished: false/);
  assert.match(coreSource, /superiorityEstablished: false/);
  assert.match(coreSource, /predictiveValidityEstablished: false/);
  assert.match(coreSource, /strongCutoverClaimAllowed: false/);
  assert.doesNotMatch(coreSource, /MIN_DIRECTIONAL_SAMPLE/);
  assert.doesNotMatch(coreSource, /MIN_FORMAL_EQUIVALENCE_SAMPLE/);
  assert.doesNotMatch(coreSource, /formalEquivalenceAnalysisEligible/);
});

test("Mock and Trial are observational targets rather than inputs to pathway state", () => {
  assert.match(coreSource, /outcomeTarget: input\.outcomeTarget/);
  const aggregateSection = sourceSection(
    coreSource,
    "function aggregateOverallState",
    "function normalizeCapabilityOverallState",
  );
  const capabilityOverallSection = sourceSection(
    coreSource,
    "function normalizeCapabilityOverallState",
    "export function buildShadowSpecialistConcordance",
  );
  assert.doesNotMatch(aggregateSection, /outcomeTarget/);
  assert.doesNotMatch(capabilityOverallSection, /outcomeTarget/);
});

test("shadow concordance route is registered in Express and Vercel runtimes", () => {
  assert.match(serverIndexSource, /registerCapabilityShadowConcordanceRoutes/);
  assert.match(apiIndexSource, /registerCapabilityShadowConcordanceRoutes/);
});
