import assert from "node:assert/strict";
import test from "node:test";
import { canCapabilityReviewerAccessAssignment, isCapabilityReviewerRole } from "./capabilityReviewerScope";

test("only TD COO and HR are capability reviewer roles", () => {
  assert.equal(isCapabilityReviewerRole("td"), true);
  assert.equal(isCapabilityReviewerRole("coo"), true);
  assert.equal(isCapabilityReviewerRole("hr"), true);
  assert.equal(isCapabilityReviewerRole("tutor"), false);
  assert.equal(isCapabilityReviewerRole("ceo"), false);
});

test("TD access is limited to the TD assigned to the Specialist pod", () => {
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "td-1", reviewerRole: "td", assignmentTdId: "td-1" }), true);
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "td-2", reviewerRole: "td", assignmentTdId: "td-1" }), false);
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "td-1", reviewerRole: "td", assignmentTdId: null }), false);
});

test("COO and HR retain cross-pod shadow review access", () => {
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "coo-1", reviewerRole: "coo", assignmentTdId: "td-1" }), true);
  assert.equal(canCapabilityReviewerAccessAssignment({ reviewerId: "hr-1", reviewerRole: "hr", assignmentTdId: "td-1" }), true);
});
