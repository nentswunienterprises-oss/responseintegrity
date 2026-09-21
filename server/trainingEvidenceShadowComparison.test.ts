import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrainingEvidenceShadowComparisonId,
  persistTrainingEvidenceShadowComparison,
  toTrainingEvidenceShadowDatasetRow,
  type TrainingEvidenceShadowDatasetInput,
} from "./trainingEvidenceShadowComparison";

const buildInput = (): TrainingEvidenceShadowDatasetInput => ({
  sourceDrillId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222222",
  tutorId: "33333333-3333-4333-8333-333333333333",
  topic: "Fractions",
  scheduledSessionId: "44444444-4444-4444-8444-444444444444",
  trainingSessionRunId: "55555555-5555-4555-8555-555555555555",
  phase: "Clarity",
  previousStability: "High",
  observedAt: "2026-09-18T14:00:00.000Z",
  evidenceShadow: {
    status: "evaluated",
    authority: "evidence_native",
    phase: "Clarity",
    previousStability: "High",
    observedStability: "Medium",
    dimensions: [],
    highMaintenanceEntryQualified: false,
    exitQualified: false,
    predictedTransition: {
      nextPhase: "Clarity",
      nextStability: "Medium",
      transitionReason: "stability regress",
    },
    ineligibleEvidenceCount: 1,
    interventionEvents: ["first_step_confirmation"],
    prerequisiteContradiction: {
      status: "not_evaluable_with_current_training_capture",
      reason: "Not enough cross-layer evidence.",
    },
  },
  comparison: {
    authority: "shadow_only",
    available: true,
    diverged: true,
    stateDiverged: true,
    reasonDiverged: true,
    legacy: {
      score: 92,
      nextPhase: "Clarity",
      nextStability: "High Maintenance",
      transitionReason: "stability advance",
    },
    evidence: {
      observedStability: "Medium",
      nextPhase: "Clarity",
      nextStability: "Medium",
      transitionReason: "stability regress",
      highMaintenanceEntryQualified: false,
      exitQualified: false,
      ineligibleEvidenceCount: 1,
    },
    reason:
      "The legacy score transition and evidence-native shadow transition disagree.",
  },
});

test("comparison identity is deterministic and evaluator/contract-versioned", () => {
  assert.equal(
    buildTrainingEvidenceShadowComparisonId(buildInput().sourceDrillId),
    "11111111-1111-4111-8111-111111111111::evaluator::1::contract::2",
  );
});

test("dataset row preserves both decisions while remaining shadow-only", () => {
  const row = toTrainingEvidenceShadowDatasetRow(buildInput());
  assert.equal(row.authority, "shadow_only");
  assert.equal(row.contract_version, 2);
  assert.equal(row.legacy_score, 92);
  assert.equal(row.legacy_next_stability, "High Maintenance");
  assert.equal(row.evidence_observed_stability, "Medium");
  assert.equal(row.evidence_next_stability, "Medium");
  assert.equal(row.diverged, true);
  assert.deepEqual(row.intervention_events, ["first_step_confirmation"]);
});

test("supabase persistence is insert-only and idempotent", async () => {
  const calls: any[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (rows: any[], options: any) => {
        calls.push({ table, rows, options });
        return { error: null };
      },
    }),
  };

  const first = await persistTrainingEvidenceShadowComparison(client as any, buildInput());
  const retry = await persistTrainingEvidenceShadowComparison(client as any, buildInput());

  assert.equal(first.status, "persisted");
  assert.deepEqual(retry, first);
  assert.equal(calls[0].table, "training_evidence_shadow_comparisons");
  assert.deepEqual(calls[0].options, {
    onConflict: "comparison_id",
    ignoreDuplicates: true,
  });
  assert.deepEqual(calls[0].rows, calls[1].rows);
});

test("missing proof migration degrades without affecting live training", async () => {
  const client = {
    from: () => ({
      upsert: async () => ({
        error: { code: "PGRST205", message: "Table is not in the schema cache" },
      }),
    }),
  };

  const result = await persistTrainingEvidenceShadowComparison(client as any, buildInput());
  assert.equal(result.status, "persistence_failed");
  assert.equal(result.errorCode, "PGRST205");
});
