import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDiagnosisProposalFocus,
  buildDiagnosisProposalJustification,
  buildDiagnosisProposalPriority,
  buildDiagnosisProposalProgressSignals,
  buildDiagnosisProposalRecommendedPlan,
  buildDiagnosisProposalSessionStructure,
  buildDiagnosisProposalWhyEntry,
  normalizeProposalPhaseSupportEvidence,
  normalizeProposalPlacementEvidence,
  normalizeProposalTrainingAction,
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
    nextAction: "Run Clarity High → High Maintenance qualifying drill",
    placementEvidence: ratiosEvidence,
  });

  assert.match(focus, /substantially present and usable/);
  assert.match(focus, /remaining instability/);
  assert.doesNotMatch(focus, /strong, consistent|consistently/i);
  assert.match(priority, /Clarity High → High Maintenance qualifying drill/);
  assert.match(priority, /Reason for the method/);
  assert.match(priority, /before any phase progression/);
});

test("persisted proposal plan and justification stay behavior-native", () => {
  const plan = buildDiagnosisProposalRecommendedPlan({
    topic: "Ratios",
    phase: "Clarity",
    stability: "High",
    nextAction: "Run Clarity High → High Maintenance qualifying drill",
  });
  const justification = buildDiagnosisProposalJustification({
    topic: "Ratios",
    phase: "Clarity",
    stability: "High",
    reason:
      "Clarity is the first response layer with direct clean behavioral evidence that does not meet the support contract.",
    nextAction: "Run Clarity High → High Maintenance qualifying drill",
    placementEvidence: ratiosEvidence,
  });

  assert.match(plan, /Clarity \/ High/);
  assert.match(plan, /Clarity High → High Maintenance qualifying drill/);
  assert.match(justification, /Decisive evidence: Reason for the method/);
  assert.match(
    justification,
    /Gave the right reason with a small gap or imprecision/,
  );
  assert.doesNotMatch(justification, /score|scored|\d+\/100/i);
});


const clarityHighPhaseSupport = normalizeProposalPhaseSupportEvidence(
  [
    {
      phase: "Clarity",
      status: "unsupported",
      dimensions: [
        {
          dimensionId: "clarity.vocabulary",
          status: "supported",
          behaviorHistory: [
            {
              behaviorClass: "supported",
              behaviorLabel: "Identified the important terms accurately",
              contaminated: false,
            },
          ],
        },
        {
          dimensionId: "clarity.method",
          status: "supported",
          behaviorHistory: [
            {
              behaviorClass: "supported",
              behaviorLabel: "Selected the correct method cleanly",
              contaminated: false,
            },
          ],
        },
        {
          dimensionId: "clarity.reason",
          status: "unsupported",
          behaviorHistory: [
            {
              behaviorClass: "near_stable",
              behaviorLabel:
                "Gave the right reason with a small gap or imprecision",
              contaminated: false,
            },
          ],
        },
        {
          dimensionId: "clarity.immediate_apply",
          status: "supported",
          behaviorHistory: [
            {
              behaviorClass: "supported",
              behaviorLabel: "Engaged independently and appropriately",
              contaminated: false,
            },
          ],
        },
      ],
    },
  ],
  "Clarity",
);

test("Clarity High session structure targets the actual gap and preserves cleared behaviors", () => {
  const structure = buildDiagnosisProposalSessionStructure({
    phase: "Clarity",
    stability: "High",
    nextAction: "Run Clarity High → High Maintenance qualifying drill",
    placementEvidence: ratiosEvidence,
    phaseSupportEvidence: clarityHighPhaseSupport,
  });

  const combined = structure.join(" ");
  assert.match(combined, /independent attempt before explanation/i);
  assert.match(combined, /Reason for the method/);
  assert.match(combined, /Problem vocabulary/);
  assert.match(combined, /Method recognition/);
  assert.match(combined, /Immediate use of understanding/);
  assert.match(combined, /Clarity High → High Maintenance qualifying drill/);
  assert.doesNotMatch(combined, /Guided practice with immediate correction/i);
});

test("Clarity High progress signals track the diagnosed reason gap instead of generic clarity", () => {
  const signals = buildDiagnosisProposalProgressSignals({
    phase: "Clarity",
    stability: "High",
    nextAction: "Run Clarity High → High Maintenance qualifying drill",
    placementEvidence: ratiosEvidence,
    phaseSupportEvidence: clarityHighPhaseSupport,
  });

  const combined = signals.join(" ");
  assert.match(combined, /Reason for the method.*clean and precise/i);
  assert.match(combined, /gap or imprecision/i);
  assert.match(combined, /Problem vocabulary/);
  assert.match(combined, /Method recognition/);
  assert.match(combined, /Immediate use of understanding/);
  assert.match(combined, /earn High Maintenance/i);
  assert.match(combined, /later independent confirmation/i);
  assert.doesNotMatch(combined, /Less confusion when beginning problems/i);
});


test("session structure and progress observation stay evidence-native across all four phase entries", () => {
  const cases = [
    {
      phase: "Clarity",
      target: "Reason for the method",
      supported: "Method recognition",
      action: "Run Clarity High → High Maintenance qualifying drill",
    },
    {
      phase: "Structured Execution",
      target: "Step discipline",
      supported: "Independent start",
      action: "Run Structured Execution High → High Maintenance qualifying drill",
    },
    {
      phase: "Controlled Discomfort",
      target: "Difficulty tolerance",
      supported: "First-step control",
      action: "Run Controlled Discomfort High → High Maintenance qualifying drill",
    },
    {
      phase: "Time Pressure Stability",
      target: "Pace control",
      supported: "Structure under time",
      action: "Run Time Pressure Stability High → High Maintenance qualifying drill",
    },
  ] as const;

  for (const entry of cases) {
    for (const stability of ["Low", "Medium", "High"] as const) {
      const placementEvidence = [
        {
          dimensionLabel: entry.target,
          behaviorLabel:
            stability === "High"
              ? "Capability held with a small gap or imprecision"
              : stability === "Medium"
                ? "Capability was materially conditional"
                : "Capability broke at meaningful exposure",
          behaviorClass:
            stability === "High"
              ? "near_stable"
              : stability === "Medium"
                ? "conditional"
                : "breakdown",
        },
      ];
      const phaseSupportEvidence = {
        phase: entry.phase,
        supportedDimensions: [
          {
            dimensionLabel: entry.supported,
            supportingBehaviors: ["Observed cleanly without support"],
          },
        ],
      };
      const nextAction =
        stability === "High"
          ? entry.action
          : `Run ${entry.phase} drill`;

      const structure = buildDiagnosisProposalSessionStructure({
        phase: entry.phase,
        stability,
        nextAction,
        placementEvidence,
        phaseSupportEvidence,
      });
      const progress = buildDiagnosisProposalProgressSignals({
        phase: entry.phase,
        stability,
        nextAction,
        placementEvidence,
        phaseSupportEvidence,
      });

      const structureText = structure.join(" ");
      const progressText = progress.join(" ");

      assert.match(structureText, new RegExp(entry.target, "i"));
      assert.match(structureText, new RegExp(entry.supported, "i"));
      assert.match(structureText, new RegExp(entry.phase, "i"));
      assert.match(progressText, new RegExp(entry.target, "i"));
      assert.match(progressText, new RegExp(entry.supported, "i"));

      if (stability === "High") {
        assert.match(structureText, /High → High Maintenance qualifying drill/);
        assert.match(progressText, /earn High Maintenance/i);
        assert.match(progressText, /later independent confirmation/i);
      }
    }
  }
});


test("legacy stored High actions are read as qualifying moves rather than existing High Maintenance state", () => {
  const cases = [
    [
      "Run Clarity High Maintenance drill",
      "Run Clarity High → High Maintenance qualifying drill",
    ],
    [
      "Run Structured Execution High Maintenance drill",
      "Run Structured Execution High → High Maintenance qualifying drill",
    ],
    [
      "Run Controlled Discomfort High Maintenance drill",
      "Run Controlled Discomfort High → High Maintenance qualifying drill",
    ],
    [
      "Run Time Pressure Stability High Maintenance drill",
      "Run Time Pressure Stability High → High Maintenance qualifying drill",
    ],
  ] as const;

  for (const [legacy, expected] of cases) {
    assert.equal(normalizeProposalTrainingAction(legacy), expected);
  }
});
