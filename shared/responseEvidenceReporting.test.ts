import test from "node:test";
import assert from "node:assert/strict";
import {
  extractAuthoritativeResponseEvidenceSignals,
  reportClaimLabelsFromEvidence,
} from "./responseEvidenceReporting";

test("training reporting uses resolved dimension state and preserves recovery", () => {
  const signals = extractAuthoritativeResponseEvidenceSignals({
    drillType: "training",
    responseSnapshot: { source: { sourceDrillId: "drill-1" } },
    summary: {
      decisionAuthority: "evidence_native",
      evidence: {
        status: "evaluated",
        dimensions: [
          {
            dimensionId: "execution.step_discipline",
            state: "SUPPORTED",
            breakdownCount: 1,
            recoveredAfterBreakdown: true,
            evidence: [
              { evidenceClass: "breakdown", rawOption: "skips" },
              { evidenceClass: "supported", rawOption: "full" },
              { evidenceClass: "supported", rawOption: "full" },
              { evidenceClass: "supported", rawOption: "full" },
            ],
          },
        ],
      },
    },
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0].polarity, "strong");
  assert.equal(signals[0].label, "reliable step execution");
  assert.equal(signals[0].recoveredAfterBreakdown, true);
  assert.deepEqual(reportClaimLabelsFromEvidence(signals), ["reliable step execution"]);
});

test("unresolved or contaminated training dimensions cannot authorize report claims", () => {
  const signals = extractAuthoritativeResponseEvidenceSignals({
    drillType: "training",
    summary: {
      decisionAuthority: "evidence_native",
      evidence: {
        status: "evaluated",
        dimensions: [
          {
            dimensionId: "time.structure",
            state: "UNRESOLVED",
            evidence: [{ evidenceClass: "confounded", rawOption: "maintained" }],
          },
        ],
      },
    },
  });

  assert.equal(signals[0].polarity, "ineligible");
  assert.equal(signals[0].claimEligible, false);
  assert.deepEqual(reportClaimLabelsFromEvidence(signals), []);
});

test("evidence-complete diagnosis reporting reads behavioral dimension authority", () => {
  const signals = extractAuthoritativeResponseEvidenceSignals({
    drillType: "diagnosis",
    responseSnapshot: { sourceDrillId: "diag-1" },
    summary: {
      decisionAuthority: "behavioral_evidence",
      phaseStates: [
        {
          phase: "Clarity",
          dimensions: [
            {
              dimensionId: "clarity.method",
              behaviorHistory: [
                {
                  behaviorId: "no_method",
                  behaviorLabel: "Could not identify a relevant method",
                  behaviorClass: "breakdown",
                  contaminated: false,
                },
              ],
            },
            {
              dimensionId: "clarity.vocabulary",
              behaviorHistory: [
                {
                  behaviorId: "clear_terms",
                  behaviorLabel: "Identified the important terms",
                  behaviorClass: "supported",
                  contaminated: false,
                },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    signals.map((signal) => [signal.dimensionId, signal.polarity, signal.label]),
    [
      ["clarity.method", "weak", "clarity breakdown"],
      ["clarity.vocabulary", "strong", "clear concept recall"],
    ],
  );
});
