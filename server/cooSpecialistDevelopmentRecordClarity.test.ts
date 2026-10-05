import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("COO Specialist cards use the canonical development hierarchy", () => {
  const source = read("client/src/pages/executive/coo/pod-detail.tsx");

  assert.match(source, /specialist-development-summaries/);
  assert.match(source, />\s*Development\s*</);
  assert.match(source, /Permission:/);
  assert.match(source, /Development Record/);
  assert.match(source, /Specialist Alignment/);
  assert.match(source, /Operating Responsibility/);
  assert.match(source, /Assigned Specialists/);

  assert.doesNotMatch(source, /Tutor Journey/);
  assert.doesNotMatch(source, /Tutor Audit/);
});

test("TD and COO Development Record routes share the same record builder", () => {
  const routes = read("server/routes/specialistDevelopment.ts");

  assert.match(routes, /loadSpecialistDevelopmentRecordPayload/);
  assert.match(routes, /"\/api\/td\/tutors\/:tutorId\/development-record"/);
  assert.match(routes, /"\/api\/coo\/tutors\/:tutorId\/development-record"/);
  assert.match(routes, /"\/api\/coo\/pods\/:podId\/specialist-development-summaries"/);
});

test("Specialist Development Record selects TD or COO read authority from the route", () => {
  const page = read("client/src/pages/operational/td/specialist-development.tsx");
  const app = read("client/src/App.tsx");

  assert.match(page, /const isCooView/);
  assert.match(page, /const recordApiBase = isCooView \? "\/api\/coo" : "\/api\/td"/);
  assert.match(page, /!isCooView && record\.assignment\.operationalMode === "sandbox"/);
  assert.match(app, /executive\/coo\/pods\/:podId\/specialists\/:tutorId\/development/);
  assert.match(app, /coo\/pods\/:podId\/specialists\/:tutorId\/development/);
});
