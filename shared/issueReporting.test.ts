import test from "node:test";
import assert from "node:assert/strict";
import { ISSUE_CATEGORIES, ISSUE_IMPACTS, getIssueTeam, issueTeamsForRole } from "./issueReporting";

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

test("team review scope prevents the People and Technology queues leaking across seats", () => {
  assert.deepEqual(issueTeamsForRole("cto"), ["technology"]);
  assert.deepEqual(issueTeamsForRole("hr"), ["people"]);
  assert.deepEqual(issueTeamsForRole("coo"), ["technology", "operations"]);
  assert.deepEqual(issueTeamsForRole("ceo"), ["technology", "operations", "people"]);
  assert.deepEqual(issueTeamsForRole("tutor"), []);
  assert.deepEqual(issueTeamsForRole("td"), []);
  assert.deepEqual(issueTeamsForRole("parent"), []);
  assert.deepEqual(issueTeamsForRole(""), []);
});
