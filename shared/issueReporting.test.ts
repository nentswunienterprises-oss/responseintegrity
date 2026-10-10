import test from "node:test";
import assert from "node:assert/strict";
import { ISSUE_CATEGORIES, ISSUE_IMPACTS, getIssueTeam, issueTeamsForRole, issueTeamsVisibleToRole } from "./issueReporting";

test("neutral issue intake includes technical issues without treating them as disputes", () => {
  assert.deepEqual(ISSUE_CATEGORIES.map((item) => item.value), [
    "technical", "workflow", "service", "people", "other",
  ]);
  assert.deepEqual(ISSUE_IMPACTS.map((item) => item.value), [
    "blocked", "affected", "informational",
  ]);
  assert.equal(getIssueTeam("technical"), "technology");
  assert.equal(getIssueTeam("workflow"), "operations");
  assert.equal(getIssueTeam("service"), "operations");
  assert.equal(getIssueTeam("people"), "people");
  assert.equal(getIssueTeam("other"), "operations");
});

test("COO oversight includes all issue teams without giving COO ownership of People cases", () => {
  assert.deepEqual(issueTeamsVisibleToRole("coo"), ["technology", "operations", "people"]);
  assert.deepEqual(issueTeamsForRole("coo"), ["technology", "operations"]);
  assert.equal(issueTeamsForRole("coo").includes("people"), false);
  assert.equal(issueTeamsVisibleToRole("coo").includes("people"), true);
});

test("read visibility and handling authority remain scoped for HR, Technology and other roles", () => {
  assert.deepEqual(issueTeamsVisibleToRole("cto"), ["technology"]);
  assert.deepEqual(issueTeamsForRole("cto"), ["technology"]);
  assert.deepEqual(issueTeamsVisibleToRole("hr"), ["people"]);
  assert.deepEqual(issueTeamsForRole("hr"), ["people"]);
  assert.deepEqual(issueTeamsVisibleToRole("ceo"), ["technology", "operations", "people"]);
  assert.deepEqual(issueTeamsForRole("ceo"), ["technology", "operations", "people"]);
  for (const role of ["tutor", "td", "parent", ""]) {
    assert.deepEqual(issueTeamsVisibleToRole(role), []);
    assert.deepEqual(issueTeamsForRole(role), []);
  }
});
