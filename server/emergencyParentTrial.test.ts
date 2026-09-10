import test from "node:test";
import assert from "node:assert/strict";
import { buildEmergencyParentTrialCaseContract } from "./routes";

test("emergency parent trial contract suppresses commercial families and blocks trial loops", () => {
  assert.deepEqual(buildEmergencyParentTrialCaseContract({ assignment_lane: "commercial" }), {
    case: null,
    unavailable: false,
  });

  assert.deepEqual(buildEmergencyParentTrialCaseContract({ assignment_lane: "trial" }), {
    case: null,
    unavailable: true,
  });
});
