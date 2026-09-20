import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDiagnosisProposalFocus,
  buildDiagnosisProposalJustification,
  buildDiagnosisProposalPriority,
  buildDiagnosisProposalRecommendedPlan,
  buildDiagnosisProposalWhyEntry,
  normalizeProposalPlacementEvidence,
} from "./diagnosisProposalCopy";

const ratiosEvidence = normalizeProposalPlacementEvidence([
  {
    dimensionLabel: "Reason for the method",
    behaviorLabel: "Gave the right reason with a small gap or imprecision",
    behaviorClass: "near_stable",
  },
]);

test("proposal copy preserves the exact diagnosis behavior that determined entry", () => {
  const whyEntry = buildDiagnosisProposalWhyEntry({
    phase: "Clarity",
    placementEvidence: ratiosEvidence,
  });

  assert.match(whyEntry, /Reason for the method/);
  assert.match(
    whyEntry,
    /Gave the right reason with a small gap or imprecision/,
  );
  assert.doesNotMatch(whyEntry, /score|scored|100/);
});

test("Clarity High proposal does not overclaim sustained or consistent performance", () => {
  const focus = buildDiagnosisProposalFocus({
    studentFirstName: "Sandbox",
    phase: "Clarity",
    stability: "High",
  });
  const priority = buildDiagnosisProposalPriority({
    studentFirstName: "Sandbox",
    phase: "Clarity",
    stability: "High",
    nextAction: "Run Clarity High Maintenance drill",
    placementEvidence: ratiosEvidence,
  });

  assert.match(focus, /substantially present and usable/);
  assert.match(focus, /remaining instability/);
  assert.doesNotMatch(focus, /strong, consistent|consistently/i);
  assert.match(priority, /Clarity High Maintenance drill/);
  assert.match(priority, /Reason for the method/);
  assert.match(priority, /before any phase progression/);
});

test("persisted proposal plan and justification stay behavior-native", () => {
  const plan = buildDiagnosisProposalRecommendedPlan({
    topic: "Ratios",
    phase: "Clarity",
    stability: "High",
    nextAction: "Run Clarity High Maintenance drill",
  });
  const justification = buildDiagnosisProposalJustification({
    topic: "Ratios",
    phase: "Clarity",
    stability: "High",
    reason:
      "Clarity is the first response layer with direct clean behavioral evidence that does not meet the support contract.",
    nextAction: "Run Clarity High Maintenance drill",
    placementEvidence: ratiosEvidence,
  });

  assert.match(plan, /Clarity \/ High/);
  assert.match(plan, /Clarity High Maintenance drill/);
  assert.match(justification, /Decisive evidence: Reason for the method/);
  assert.match(
    justification,
    /Gave the right reason with a small gap or imprecision/,
  );
  assert.doesNotMatch(justification, /score|scored|\d+\/100/i);
});
