import test from "node:test";
import assert from "node:assert/strict";

import {
  interventionConfoundsTrainingDimension,
  resolveTrainingEvidenceEligibility,
} from "./trainingEvidenceCapture";

test("neutral clarification preserves decision eligibility", () => {
  assert.equal(
    interventionConfoundsTrainingDimension({
      phase: "Structured Execution",
      dimensionId: "execution.start",
      interventionEvent: "neutral_clarification",
    }),
    false,
  );
});

test("first-step confirmation only confounds dimensions whose independence it supplied", () => {
  assert.equal(
    interventionConfoundsTrainingDimension({
      phase: "Controlled Discomfort",
      dimensionId: "difficulty.first_step_control",
      interventionEvent: "first_step_confirmation",
    }),
    true,
  );
  assert.equal(
    interventionConfoundsTrainingDimension({
      phase: "Controlled Discomfort",
      dimensionId: "difficulty.tolerance",
      interventionEvent: "first_step_confirmation",
    }),
    false,
  );
});

test("full rescue confounds current-phase capability evidence", () => {
  assert.equal(
    interventionConfoundsTrainingDimension({
      phase: "Time Pressure Stability",
      dimensionId: "time.pace",
      interventionEvent: "full_rescue_or_teaching",
    }),
    true,
  );
});

test("timer changes confound timed evidence", () => {
  assert.equal(
    interventionConfoundsTrainingDimension({
      phase: "Time Pressure Stability",
      dimensionId: "time.structure",
      interventionEvent: "timer_changed",
    }),
    true,
  );
});

test("explicit not-observed outranks an otherwise clean intervention", () => {
  const result = resolveTrainingEvidenceEligibility({
    phase: "Clarity",
    dimensionId: "clarity.reason",
    explicitStatus: "not_observed",
    interventionEvent: "none",
  });

  assert.equal(result.status, "not_observed");
  assert.match(String(result.reason), /not meaningfully observable/i);
});
