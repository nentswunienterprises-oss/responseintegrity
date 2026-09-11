import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const specialistSource = fs.readFileSync(new URL("./capability-practicals.tsx", import.meta.url), "utf8");
const reviewerSource = fs.readFileSync(new URL("../capability-practical-review.tsx", import.meta.url), "utf8");
const standaloneSource = fs.readFileSync(new URL("../../../capabilityStandaloneApp.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../../../main.tsx", import.meta.url), "utf8");

test("Specialist practical workspace is reference-first and never uploads video bytes", () => {
  assert.match(specialistSource, /artifactUrl/);
  assert.match(specialistSource, /HTTPS review link/);
  assert.doesNotMatch(specialistSource, /FileReader/);
  assert.doesNotMatch(specialistSource, /FormData/);
  assert.doesNotMatch(specialistSource, /type="file"/);
});

test("Specialist must explicitly confirm sandbox-only evidence", () => {
  assert.match(specialistSource, /noRealStudentDataConfirmed: true/);
  assert.match(specialistSource, /contains no real student, parent or family data/);
  assert.match(specialistSource, /disabled=\{submitMutation\.isPending \|\| !artifactUrl\.trim\(\) \|\| !artifactType \|\| !sandboxConfirmed\}/);
});

test("Specialist UI blocks resubmission while evidence is pending, approved or under integrity review", () => {
  assert.match(specialistSource, /latest\?\.status === "submitted"/);
  assert.match(specialistSource, /latest\?\.status === "approved"/);
  assert.match(specialistSource, /latest\?\.status === "integrity_review"/);
  assert.match(specialistSource, /latest\.status === "repeat_required"/);
});

test("reviewer UI offers only the three immutable review outcomes", () => {
  assert.match(reviewerSource, /"approved" \| "repeat_required" \| "integrity_review"/);
  assert.match(reviewerSource, />Approve</);
  assert.match(reviewerSource, />Repeat required</);
  assert.match(reviewerSource, />Integrity review</);
  assert.match(reviewerSource, /Record immutable decision/);
});

test("repeat and integrity review require actionable reviewer feedback", () => {
  assert.match(reviewerSource, /feedback\.trim\(\)\.length < 20/);
  assert.match(reviewerSource, /Write at least 20 characters/);
});

test("practical Specialist and reviewer routes are isolated from the central router", () => {
  assert.match(standaloneSource, /\/operational\/specialist\/capability-practicals/);
  assert.match(standaloneSource, /\/operational\/capability-review\/practicals/);
  assert.match(mainSource, /currentPath === "\/operational\/specialist\/capability-practicals"/);
  assert.match(mainSource, /currentPath === "\/operational\/capability-review\/practicals"/);
});
