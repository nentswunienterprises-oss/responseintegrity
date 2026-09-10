import test from "node:test";
import assert from "node:assert/strict";
import { buildEmergencyEnrollmentStatusFilter } from "./emergencyPodQuery";

test("emergency tutor enrollment filter casts text arrays to enrollment_status", () => {
  const filter = buildEmergencyEnrollmentStatusFilter(2);

  assert.equal(filter, "status = ANY($2::enrollment_status[])");
  assert.equal(filter.includes("::text[]"), false);
});