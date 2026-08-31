import test from "node:test";
import assert from "node:assert/strict";

import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  getFieldDefinitionForRep,
  getRepPurposeId,
} from "../shared/responseIntegrityDrillRegistry";
import type { EvidenceLedgerProjectionInput } from "../shared/responseIntegrityEvidenceLedger";
import {
  buildEvidenceLedgerProjectionInputFromStoredDrillRow,
  persistResponseIntegrityEvidenceLedgerShadow,
} from "./responseIntegrityEvidenceLedger";

const buildProjectionInput = (): EvidenceLedgerProjectionInput => {
  const phase = "Clarity" as const;
  const schema = getDrillSchemaDefinition("diagnosis", phase);
  const definition = schema.sets[0];
  const observations = Array.from({ length: definition.reps }, (_, repIndex) => {
    const rep: Record<string, string> = {
      _rep_id: getRepPurposeId(definition, repIndex),
      _rep_number: String(repIndex + 1),
    };
    definition.fields.forEach((baseField) => {
      const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey)!;
      const optionIndex = field.optionLevels.length - 1;
      const identity = getEvidenceSelectionIdentity({
        mode: "diagnosis",
        phase,
        setName: definition.setName,
        repIndex,
        fieldKey: field.fieldKey,
        optionIndex,
      })!;
      rep[field.fieldKey] = field.optionLabels![optionIndex];
      rep[`${field.fieldKey}_option_id`] = identity.optionId;
      rep[`${field.fieldKey}_dimension_id`] = identity.dimensionId;
      rep[`${field.fieldKey}_level`] = identity.level;
    });
    return rep;
  });

  return {
    sourceDrillId: "11111111-1111-4111-8111-111111111111",
    studentId: "22222222-2222-4222-8222-222222222222",
    tutorId: "33333333-3333-4333-8333-333333333333",
    topic: "Fractions",
    scheduledSessionId: "44444444-4444-4444-8444-444444444444",
    sessionContext: "intro",
    drillType: "diagnosis",
    observedPhase: phase,
    statePhaseBefore: phase,
    statePhaseAfter: phase,
    stabilityAfter: "High",
    transitionReason: "remain",
    observedAt: "2026-08-29T10:00:00.000Z",
    sets: [{
      phase,
      setName: definition.setName,
      setId: definition.setId,
      setOrder: 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: definition.constraints,
      observations,
    }],
  };
};

test("shadow persistence uses insert-only conflict handling for deterministic evidence IDs", async () => {
  const calls: Array<{ table: string; rows: Array<Record<string, unknown>>; options: unknown }> = [];
  const client = {
    from: (table: string) => ({
      upsert: async (rows: Array<Record<string, unknown>>, options: unknown) => {
        calls.push({ table, rows, options });
        return { error: null };
      },
    }),
  };

  const first = await persistResponseIntegrityEvidenceLedgerShadow(client as any, buildProjectionInput());
  const retry = await persistResponseIntegrityEvidenceLedgerShadow(client as any, buildProjectionInput());

  assert.deepEqual(first, { status: "projected", entryCount: 12 });
  assert.deepEqual(retry, first);
  assert.equal(calls[0].table, "response_integrity_evidence_ledger");
  assert.deepEqual(calls[0].options, { onConflict: "evidence_id", ignoreDuplicates: true });
  assert.deepEqual(calls[1].rows, calls[0].rows);
  assert.equal(new Set(calls[0].rows.map((row) => row.evidence_id)).size, 12);
});

test("shadow persistence reports a missing migration without blocking through an exception", async () => {
  const client = {
    from: () => ({
      upsert: async () => ({
        error: { code: "PGRST205", message: "Table is not in the schema cache" },
      }),
    }),
  };

  const result = await persistResponseIntegrityEvidenceLedgerShadow(client as any, buildProjectionInput());
  assert.equal(result.status, "persistence_failed");
  assert.equal(result.errorCode, "PGRST205");
  assert.equal(result.entryCount, 0);
});

test("stored training drill rows build projection input with session and state lineage", () => {
  const input = buildProjectionInput();
  const row = {
    id: input.sourceDrillId,
    student_id: input.studentId,
    tutor_id: input.tutorId,
    scheduled_session_id: input.scheduledSessionId,
    training_session_run_id: "55555555-5555-4555-8555-555555555555",
    submitted_at: input.observedAt,
    drill: JSON.stringify({
      trainingTopic: input.topic,
      phase: "Structured Execution",
      drillType: "training",
      sets: input.sets,
      summary: {
        observedPhase: "Structured Execution",
        previousStability: "High",
        phase: "Structured Execution",
        stability: "High Maintenance",
        transitionReason: "stability advance",
      },
    }),
  };

  const result = buildEvidenceLedgerProjectionInputFromStoredDrillRow(row);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.sessionContext, "active_training");
  assert.equal(result.input.drillType, "training");
  assert.equal(result.input.trainingSessionRunId, "55555555-5555-4555-8555-555555555555");
  assert.equal(result.input.stabilityBefore, "High");
  assert.equal(result.input.stabilityAfter, "High Maintenance");
});

test("stored handover verification rows build projection input as verification evidence", () => {
  const input = buildProjectionInput();
  const row = {
    id: input.sourceDrillId,
    student_id: input.studentId,
    tutor_id: input.tutorId,
    scheduled_session_id: input.scheduledSessionId,
    submitted_at: input.observedAt,
    drill: {
      handoverTopic: input.topic,
      phase: "Clarity",
      previousStability: "High",
      drillType: "handover_verification",
      handoverMode: "verification",
      sets: input.sets,
      summary: {
        phase: "Clarity",
        resultingPhase: "Clarity",
        resultingStability: "High",
        verificationOutcome: "hold",
      },
    },
  };

  const result = buildEvidenceLedgerProjectionInputFromStoredDrillRow(row);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.sessionContext, "handover_verification");
  assert.equal(result.input.drillType, "verification");
  assert.equal(result.input.statePhaseBefore, "Clarity");
  assert.equal(result.input.transitionReason, "hold");
});
