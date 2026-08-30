import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTutorDeepDiveProgress,
  choosePreferredDeepDiveProgress,
  hasCompleteTutorDocumentation,
  reconcileTutorTrainingMode,
} from "./battleTesting";
import type { TutorBattleTestDeepDiveProgress, TutorBattleTestModuleProgress } from "@shared/battleTesting";

test("reconcileTutorTrainingMode keeps applicant when documentation is incomplete", () => {
  const moduleProgress: TutorBattleTestModuleProgress[] = [
    {
      moduleKey: "transformation_phases",
      title: "Transformation Phases",
      completedCount: 5,
      totalCount: 5,
      completed: true,
    },
    {
      moduleKey: "session_infrastructure",
      title: "Session Infrastructure",
      completedCount: 6,
      totalCount: 6,
      completed: true,
    },
  ];

  const deepDiveProgress: TutorBattleTestDeepDiveProgress[] = [];

  assert.equal(
    reconcileTutorTrainingMode({
      persistedMode: "training",
      moduleProgress,
      deepDiveProgress,
      currentState: "locked",
      docsComplete: false,
    }),
    "applicant"
  );
});

test("reconcileTutorTrainingMode moves a preparation-complete tutor into Trial", () => {
  const moduleProgress: TutorBattleTestModuleProgress[] = [
    {
      moduleKey: "transformation_phases",
      title: "Transformation Phases",
      completedCount: 5,
      totalCount: 5,
      completed: true,
    },
    {
      moduleKey: "session_infrastructure",
      title: "Session Infrastructure",
      completedCount: 6,
      totalCount: 6,
      completed: true,
    },
  ];

  const deepDiveProgress: TutorBattleTestDeepDiveProgress[] = [];

  assert.equal(
    reconcileTutorTrainingMode({
      persistedMode: "applicant",
      moduleProgress,
      deepDiveProgress,
      currentState: "locked",
      docsComplete: true,
    }),
    "trial"
  );
});

test("reconcileTutorTrainingMode preserves a grandfathered Certified Live decision", () => {
  const moduleProgress: TutorBattleTestModuleProgress[] = [
    {
      moduleKey: "transformation_phases",
      title: "Transformation Phases",
      completedCount: 5,
      totalCount: 5,
      completed: true,
    },
    {
      moduleKey: "session_infrastructure",
      title: "Session Infrastructure",
      completedCount: 6,
      totalCount: 6,
      completed: true,
    },
  ];

  assert.equal(
    reconcileTutorTrainingMode({
      persistedMode: "certified_live",
      moduleProgress,
      deepDiveProgress: [],
      currentState: "locked",
      docsComplete: true,
    }),
    "certified_live",
  );
});

test("hasCompleteTutorDocumentation accepts legacy records that only stored approved document statuses", () => {
  assert.equal(
    hasCompleteTutorDocumentation({
      doc_1_submission_verified: false,
      doc_2_submission_verified: false,
      doc_3_submission_verified: false,
      doc_4_submission_verified: false,
      doc_5_submission_verified: false,
      doc_6_submission_verified: false,
      documents_status: {
        "1": "approved",
        "2": "approved",
        "3": "approved",
        "4": "approved",
        "5": "approved",
        "6": "approved",
      },
    }),
    true
  );
});

test("buildTutorDeepDiveProgress clears a resolved critical fail after later clean passes", () => {
  const runs = [
    {
      completed_at: "2026-07-12T15:29:12.812Z",
      has_critical_fail: true,
      critical_fail_reasons: ["Clarity Deep Dive: broke the recognition rule"],
      phase_scores: [
        {
          phaseKey: "clarity",
          title: "Clarity Deep Dive",
          percent: 80,
        },
      ],
    },
    {
      completed_at: "2026-07-13T09:03:49.059Z",
      has_critical_fail: false,
      critical_fail_reasons: [],
      phase_scores: [
        {
          phaseKey: "clarity",
          title: "Clarity Deep Dive",
          percent: 100,
        },
      ],
    },
    {
      completed_at: "2026-07-13T09:06:19.806Z",
      has_critical_fail: false,
      critical_fail_reasons: [],
      phase_scores: [
        {
          phaseKey: "clarity",
          title: "Clarity Deep Dive",
          percent: 100,
        },
      ],
    },
    {
      completed_at: "2026-07-13T09:07:56.688Z",
      has_critical_fail: false,
      critical_fail_reasons: [],
      phase_scores: [
        {
          phaseKey: "clarity",
          title: "Clarity Deep Dive",
          percent: 100,
        },
      ],
    },
  ] as any[];

  const progress = buildTutorDeepDiveProgress(
    [
      {
        phaseKey: "clarity",
        title: "Clarity Deep Dive",
        pointsEarned: 15,
        pointsPossible: 15,
        percent: 100,
        state: "locked",
      },
    ],
    runs as any
  );

  const clarity = progress.find((entry) => entry.phaseKey === "clarity");
  assert.ok(clarity);
  assert.equal(clarity.criticalFlag, false);
  assert.equal(clarity.currentStreak, 3);
  assert.equal(clarity.historicalState, "completed");
});

test("choosePreferredDeepDiveProgress favors recomputed progress when persisted data is stale", () => {
  const computed: TutorBattleTestDeepDiveProgress[] = [
    {
      phaseKey: "clarity",
      title: "Clarity Deep Dive",
      moduleKey: "transformation_phases",
      moduleTitle: "Transformation Phases",
      historicalState: "completed",
      currentHealthState: "locked",
      currentStreak: 3,
      consecutiveDriftCount: 0,
      latestScore: 100,
      completedAt: "2026-07-13T09:03:49.059Z",
      lastTestedAt: "2026-07-13T09:07:56.688Z",
      attemptsCount: 4,
      criticalFlag: false,
    },
  ];

  const persisted: TutorBattleTestDeepDiveProgress[] = [
    {
      ...computed[0],
      criticalFlag: true,
    },
  ];

  assert.deepEqual(choosePreferredDeepDiveProgress(computed, persisted), computed);
});
