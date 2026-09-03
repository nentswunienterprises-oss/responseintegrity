import test from "node:test";
import assert from "node:assert/strict";
import {
  MONTHLY_SERVICE_PACKAGES,
  buildPackagePayoutState,
  getMonthlyServicePackage,
} from "./servicePackages";

test("monthly packages preserve the R200 / R130 / R70 unit economics", () => {
  assert.deepEqual(
    Object.values(MONTHLY_SERVICE_PACKAGES).map((servicePackage) => ({
      sessions: servicePackage.sessionsPerMonth,
      frequency: servicePackage.plannedSessionsPerWeek,
      amount: servicePackage.amountZar,
      specialist: servicePackage.specialistAllocationZar,
      responseIntegrity: servicePackage.responseIntegrityAllocationZar,
    })),
    [
      { sessions: 8, frequency: 2, amount: 1600, specialist: 1040, responseIntegrity: 560 },
      { sessions: 12, frequency: 3, amount: 2400, specialist: 1560, responseIntegrity: 840 },
      { sessions: 16, frequency: 4, amount: 3200, specialist: 2080, responseIntegrity: 1120 },
    ],
  );
});

test("legacy Premium values resolve to the 8-session package", () => {
  assert.equal(getMonthlyServicePackage("Premium").key, "monthly_8");
});

test("specialist allocation accrues per evidence-backed session but is payable only at package completion", () => {
  assert.deepEqual(buildPackagePayoutState({
    packageKey: "monthly_12",
    eligibleSessionCount: 11,
    consumedSessionCount: 11,
  }), {
    packageKey: "monthly_12",
    requiredSessionCount: 12,
    eligibleSessionCount: 11,
    consumedSessionCount: 11,
    accruedAmountZar: 1430,
    payableAmountZar: 0,
    payoutStatus: "accruing",
  });

  assert.equal(buildPackagePayoutState({
    packageKey: "monthly_12",
    eligibleSessionCount: 11,
    consumedSessionCount: 12,
  }).payoutStatus, "evidence_blocked");

  assert.deepEqual(buildPackagePayoutState({
    packageKey: "monthly_12",
    eligibleSessionCount: 12,
    consumedSessionCount: 12,
  }), {
    packageKey: "monthly_12",
    requiredSessionCount: 12,
    eligibleSessionCount: 12,
    consumedSessionCount: 12,
    accruedAmountZar: 1560,
    payableAmountZar: 1560,
    payoutStatus: "payable",
  });
});
