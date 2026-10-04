import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("TD Specialist cards keep Development Record as the primary longitudinal entry point", () => {
  const overview = read("client/src/pages/operational/td/overview.tsx");

  assert.match(overview, /specialist-development-summaries/);
  assert.match(overview, />\s*Development\s*</);
  assert.match(overview, /Permission:/);
  assert.match(overview, /Development Record/);
  assert.match(overview, /Specialist Alignment/);
  assert.match(overview, /Assigned Specialists/);

  assert.doesNotMatch(overview, /Tutor Controls/);
  assert.doesNotMatch(overview, /Tutor Audit/);
  assert.doesNotMatch(overview, /Assigned Tutors/);
  assert.doesNotMatch(
    overview,
    /api\/td\/tutors\/\$\{encodeURIComponent\(tutorId\)\}\/development-record/,
  );
});

test("TD pod development summaries use the same stage authority as the full Development Record", () => {
  const routes = read("server/routes/specialistDevelopment.ts");

  assert.match(routes, /specialist-development-summaries/);
  assert.match(routes, /deriveCurrentStage\(\{/);
  assert.match(routes, /getSpecialistDevelopmentPathway/);
  assert.match(routes, /getLatestSandboxReadinessAssessment/);
  assert.match(routes, /getTrialCaseById/);
});
