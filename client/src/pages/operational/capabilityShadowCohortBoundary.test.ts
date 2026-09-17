import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pageSource = fs.readFileSync(
  new URL("./capability-shadow-cohort.tsx", import.meta.url),
  "utf8",
);
const standaloneSource = fs.readFileSync(
  new URL("../../capabilityStandaloneApp.tsx", import.meta.url),
  "utf8",
);
const mainSource = fs.readFileSync(
  new URL("../../main.tsx", import.meta.url),
  "utf8",
);

test("shadow cohort UI is read-only and calls only the GET cohort endpoint", () => {
  assert.match(pageSource, /apiRequest\("GET", "\/api\/capability-review\/shadow-cohort"\)/);
  assert.doesNotMatch(pageSource, /useMutation/);
  assert.doesNotMatch(pageSource, /apiRequest\(\s*"POST"/);
  assert.doesNotMatch(pageSource, /apiRequest\(\s*"PUT"/);
  assert.doesNotMatch(pageSource, /apiRequest\(\s*"PATCH"/);
  assert.doesNotMatch(pageSource, /apiRequest\(\s*"DELETE"/);
});

test("shadow cohort UI keeps fixed denominators visible above filters", () => {
  assert.match(pageSource, /Candidate assignments/);
  assert.match(pageSource, /Comparable/);
  assert.match(pageSource, /Incomplete/);
  assert.match(pageSource, /Agreement among comparable/);
  assert.match(pageSource, /Filters only change the visible rows; the cohort denominators below remain fixed/);
  assert.match(pageSource, /Filters do not alter the headline denominator/);
  assert.match(pageSource, /Showing \{visibleMembers\.length\} of \{cohort\.summary\.candidateAssignments\}/);
});

test("shadow cohort UI exposes missing evidence rather than only agreement", () => {
  assert.match(pageSource, /Battle evidence/);
  assert.match(pageSource, /Capability observed/);
  assert.match(pageSource, /Capability satisfied/);
  assert.match(pageSource, /Practicals/);
  assert.match(pageSource, /Oral V2/);
  assert.match(pageSource, /Simulation/);
  assert.match(pageSource, /Mock outcome/);
  assert.match(pageSource, /Trial decision/);
  assert.match(pageSource, /Missing Deep Dives/);
});

test("shadow cohort UI refuses ranking cutover and readiness authority language", () => {
  assert.match(pageSource, /does not recommend cutover, rank Specialists, or change readiness/);
  assert.match(pageSource, /This is evidence to inspect, not a decision recommendation/);
  assert.match(pageSource, /Descriptive shadow evidence only/);
  assert.match(pageSource, /No statistical analysis plan or authority migration is implied/);
  assert.doesNotMatch(pageSource, /Pass Specialist/);
  assert.doesNotMatch(pageSource, /Ready for cutover/);
  assert.doesNotMatch(pageSource, /Recommend certification/);
});

test("shadow cohort filters use the pure shared filter rather than altering the server query", () => {
  assert.match(pageSource, /filterShadowCohortReviewMembers/);
  assert.match(pageSource, /completeness/);
  assert.match(pageSource, /classification/);
  assert.match(pageSource, /query/);
  assert.doesNotMatch(pageSource, /shadow-cohort\?/);
});

test("shadow cohort reviewer route stays inside the Capability standalone app", () => {
  assert.match(standaloneSource, /CapabilityShadowCohortReview/);
  assert.match(standaloneSource, /\/operational\/capability-review\/shadow-cohort/);
  assert.match(mainSource, /currentPath === "\/operational\/capability-review\/shadow-cohort"/);
});
