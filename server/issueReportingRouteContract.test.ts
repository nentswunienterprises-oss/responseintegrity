import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

const modal = source("client/src/components/LogDisputeModal.tsx");
const routes = source("server/routes/issueReporting.ts");
const migration = source("migrations/20261010_neutral_issue_reporting_v1.sql");
const inbox = source("client/src/pages/executive/issues.tsx");
const app = source("client/src/App.tsx");
const serverEntry = source("server/index.ts");
const vercelEntry = source("server/vercelPreviewApi.ts");
const portalRoutes = source("shared/portals.ts");

test("Log Issue is neutral, technical-aware and submit gating uses actual form state", () => {
  assert.match(modal, /\/api\/issues/);
  assert.match(modal, /ISSUE_CATEGORIES/);
  assert.match(modal, /What happened\?/);
  assert.match(modal, /Where did you encounter it\?/);
  assert.match(modal, /What would help\?/);
  assert.match(modal, /formData\.title\.trim\(\)\.length >= 5/);
  assert.match(modal, /formData\.description\.trim\(\)\.length >= 12/);
  assert.doesNotMatch(modal, /Involved Parties \*/);
  assert.doesNotMatch(modal, /Apology|Separation|disputeType:|desiredOutcome:|formData\.involvedParties\.length/);
  assert.doesNotMatch(modal, /\/api\/disputes\/log/);
});

test("issue intake is server-owned, role-scoped, and does not leak People reports to Technology", () => {
  assert.match(routes, /app\.post\("\/api\/issues", isAuthenticated/);
  assert.match(routes, /app\.get\("\/api\/issues\/mine", isAuthenticated/);
  assert.match(routes, /app\.get\("\/api\/issues\/inbox", isAuthenticated/);
  assert.match(routes, /app\.patch\("\/api\/issues\/:id\/status", isAuthenticated/);
  assert.match(routes, /const ownerTeam = getIssueTeam\(input\.category\)/);
  assert.match(routes, /issueTeamsForRole\(user\.role\)/);
  assert.match(routes, /owner_team = ANY\(\$1::varchar\[\]\)/);
  assert.match(routes, /owner_team = ANY\(\$2::varchar\[\]\)/);
  assert.match(routes, /reported_by = \$1/);
  assert.match(routes, /FOR UPDATE/);
  assert.match(routes, /issue_report_status_events/);
  assert.match(routes, /BEGIN/);
  assert.match(routes, /COMMIT/);
  assert.doesNotMatch(routes, /from\("disputes"\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.issue_reports FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.issue_report_status_events FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /issue_reports_routing_authority/);
  assert.doesNotMatch(migration, /GRANT .* TO (anon|authenticated)/);
});

test("the issue inbox is registered and reachable by only the relevant executive roles", () => {
  assert.match(serverEntry, /registerIssueReportingRoutes\(app\)/);
  assert.match(vercelEntry, /registerIssueReportingRoutes\(app\)/);
  for (const role of ["coo", "hr", "cto", "ceo"]) {
    assert.match(app, new RegExp('/executive/' + role + '/issues'));
    assert.match(portalRoutes, new RegExp('/executive/' + role + '/issues'));
  }
  assert.match(inbox, /\/api\/issues\/inbox/);
  assert.match(inbox, /Record resolution/);
  assert.doesNotMatch(inbox, /\/api\/hr\/disputes/);
});
