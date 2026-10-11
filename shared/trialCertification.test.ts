import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveTrialPlacementProgress,
  deriveTrialWindow,
  evaluateTrialCertificationGate,
  type TrialPlacementGateInput,
} from "./trialCertification";

function buildSessions(count: number, options?: { missingLogAt?: number; duplicate?: boolean }) {
  const sessions = Array.from({ length: count }, (_, index) => ({
    id: `session-${index + 1}`,
    status: "completed",
    scheduledAt: `2026-08-${String(index + 2).padStart(2, "0")}T10:00:00.000Z`,
    hasRequiredLog: options?.missingLogAt !== index + 1,
  }));

  return options?.duplicate ? [...sessions, { ...sessions[0] }] : sessions;
}

function buildReports() {
  return [
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `weekly-${index + 1}`,
      reportType: "weekly" as const,
      reportWindowKey: `weekly-${index + 1}`,
      sourceSessionIds: [`session-${index * 2 + 1}`, `session-${index * 2 + 2}`],
    })),
    {
      id: "monthly-1",
      reportType: "monthly" as const,
      reportWindowKey: "monthly-1",
      sourceSessionIds: Array.from({ length: 8 }, (_, index) => `session-${index + 1}`),
    },
  ];
}

test("trial progress counts unique completed sessions with logs inside the placement boundary", () => {
  const progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    sessions: buildSessions(9, { duplicate: true }),
    reports: buildReports(),
  });

  assert.equal(progress.qualifyingSessionCount, 9);
  assert.equal(progress.evidenceComplete, true);
});

test("an incomplete or duplicate drill record cannot increase trial progress", () => {
  const progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    sessions: buildSessions(9, { missingLogAt: 9, duplicate: true }),
    reports: buildReports(),
  });

  assert.equal(progress.completedSessionCount, 9);
  assert.equal(progress.qualifyingSessionCount, 8);
  assert.equal(progress.missingLogCount, 1);
  assert.equal(progress.evidenceComplete, false);
});

test("Trial session evidence after the 35-day first-session window cannot count", () => {
  const progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    qualificationEndsAt: "2026-09-05T00:00:00.000Z",
    sessions: buildSessions(9).map((session, index) =>
      index === 8 ? { ...session, scheduledAt: "2026-09-06T10:00:00.000Z" } : session,
    ),
    reports: buildReports(),
  });

  assert.equal(progress.qualifyingSessionCount, 8);
  assert.equal(progress.evidenceComplete, false);
});

test("the Trial window is 35 days and starts only on first completed Trial session", () => {
  assert.equal(deriveTrialWindow({}).state, "awaiting_first_session");

  const window = deriveTrialWindow({
    windowStartedAt: "2026-08-01T00:00:00.000Z",
    now: "2026-08-10T00:00:00.000Z",
  });

  assert.equal(window.standardEndsAt, "2026-09-05T00:00:00.000Z");
  assert.equal(window.state, "active");
  assert.equal(window.daysRemaining, 26);
});

test("an incomplete Trial requires a documented COO extension after day 35", () => {
  const window = deriveTrialWindow({
    windowStartedAt: "2026-08-01T00:00:00.000Z",
    now: "2026-09-06T00:00:00.000Z",
  });
  const second = eligiblePlacement("placement-2", "family-2");
  second.progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    sessions: buildSessions(8),
    reports: buildReports(),
  });

  const result = evaluateTrialCertificationGate({
    placements: [eligiblePlacement("placement-1", "family-1"), second],
    riskState: "clear",
    window,
  });

  assert.equal(result.reviewable, false);
  assert.match(result.blockers.join(" "), /35-day Trial window/);
});

function eligiblePlacement(id: string, familyKey: string): TrialPlacementGateInput {
  return {
    id,
    familyKey,
    progress: deriveTrialPlacementProgress({
      placementStartedAt: "2026-08-01T00:00:00.000Z",
      sessions: buildSessions(9),
      reports: buildReports(),
    }),
    feedbackState: "received",
    reviewDecision: "positive",
  };
}

test("nine sessions with one family cannot open certification", () => {
  const result = evaluateTrialCertificationGate({
    placements: [eligiblePlacement("placement-1", "family-1")],
    riskState: "clear",
  });

  assert.equal(result.reviewable, false);
});

test("ten and eight sessions cannot be treated as two complete placements", () => {
  const second = eligiblePlacement("placement-2", "family-2");
  second.progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    sessions: buildSessions(8),
    reports: buildReports(),
  });

  const result = evaluateTrialCertificationGate({
    placements: [eligiblePlacement("placement-1", "family-1"), second],
    riskState: "clear",
  });

  assert.equal(result.reviewable, false);
  assert.match(result.blockers.join(" "), /8\/9/);
});

test("two positive 9-session family reviews make a case reviewable but do not certify it", () => {
  const result = evaluateTrialCertificationGate({
    placements: [
      eligiblePlacement("placement-1", "family-1"),
      eligiblePlacement("placement-2", "family-2"),
    ],
    riskState: "clear",
  });

  assert.deepEqual(result, { reviewable: true, blockers: [] });
});

test("missing outcome review, pending feedback, or unresolved risk blocks the gate", () => {
  const second = eligiblePlacement("placement-2", "family-2");
  second.feedbackState = "pending";
  second.reviewDecision = null;

  const result = evaluateTrialCertificationGate({
    placements: [eligiblePlacement("placement-1", "family-1"), second],
    riskState: "remediation",
  });

  assert.equal(result.reviewable, false);
  assert.match(result.blockers.join(" "), /feedback/);
  assert.match(result.blockers.join(" "), /positive COO outcome review/);
  assert.match(result.blockers.join(" "), /remediation/);
});

test("an unlogged completion cannot consume one of the nine qualifying Trial slots", () => {
  const progress = deriveTrialPlacementProgress({
    placementStartedAt: "2026-08-01T00:00:00.000Z",
    qualificationEndsAt: "2026-09-05T00:00:00.000Z",
    sessions: buildSessions(10, { missingLogAt: 1 }).map((session, index) =>
      index === 9 ? { ...session, scheduledAt: "2026-08-20T10:00:00.000Z" } : session,
    ),
    reports: buildReports(),
  });
  assert.equal(progress.completedSessionCount, 10);
  assert.equal(progress.loggedSessionCount, 9);
  assert.equal(progress.qualifyingSessionCount, 9);
  assert.equal(progress.missingLogCount, 1);
  assert.equal(progress.evidenceComplete, true);
});

test("the 35-day expiry is independent of when the second family was assigned", () => {
  const window = deriveTrialWindow({
    windowStartedAt: "2026-08-01T10:00:00.000Z",
    now: "2026-09-05T09:59:59.000Z",
  });
  assert.equal(window.standardEndsAt, "2026-09-05T10:00:00.000Z");
  assert.equal(window.isExpired, false);
  const expired = deriveTrialWindow({
    windowStartedAt: "2026-08-01T10:00:00.000Z",
    now: "2026-09-05T10:00:00.000Z",
  });
  assert.equal(expired.state, "extension_required");
  assert.equal(expired.isExpired, true);
});

test("a corrupted lower per-family session requirement never reduces the 2 x 9 certification gate", () => {
  const first = eligiblePlacement("placement-1", "family-1");
  const second = eligiblePlacement("placement-2", "family-2");
  second.progress = { ...second.progress, requiredSessionCount: 8, qualifyingSessionCount: 8 };
  const result = evaluateTrialCertificationGate({
    placements: [first,second],
    riskState: "clear",
  });
  assert.equal(result.reviewable, false);
  assert.match(result.blockers.join(" "), /exactly nine/);
  assert.match(result.blockers.join(" "), /8\/9/);
});
