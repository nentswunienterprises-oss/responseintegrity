import { pool } from "./db";
import type { SandboxReadinessDecision } from "@shared/sandboxReadiness";

function isMissingSandboxMockTable(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("tutor_sandbox_mock_assessments") && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    String(error?.code || "") === "42P01"
  );
}

export interface SandboxTdReadinessAssessment {
  id: string;
  tutorId: string;
  tutorAssignmentId: string;
  decision: SandboxReadinessDecision;
  evidenceNote: string;
  assessedByUserId: string;
  assessedAt: string;
  capabilitySnapshot: Record<string, unknown> | null;
}

function mapTdReadinessAssessment(row: any): SandboxTdReadinessAssessment {
  const rawChecklist =
    row?.checklist && typeof row.checklist === "object" ? row.checklist : {};
  const capabilitySnapshot =
    rawChecklist?.capability_snapshot &&
    typeof rawChecklist.capability_snapshot === "object"
      ? rawChecklist.capability_snapshot
      : null;

  return {
    id: String(row.id),
    tutorId: String(row.tutor_id),
    tutorAssignmentId: String(row.tutor_assignment_id),
    decision: row.decision as SandboxReadinessDecision,
    evidenceNote: String(row.evidence_note || ""),
    assessedByUserId: String(row.assessed_by_user_id),
    assessedAt: row.assessed_at instanceof Date ? row.assessed_at.toISOString() : String(row.assessed_at),
    capabilitySnapshot,
  };
}

export async function getLatestSandboxReadinessAssessment(
  tutorAssignmentId: string,
) {
  try {
    // TD readiness evidence is server-only. Do not read it through the
    // publishable-key Supabase client, which has no table privileges.
    const result = await pool.query(
      `SELECT id, tutor_id, tutor_assignment_id, decision, checklist,
              evidence_note, assessed_by_user_id, assessed_at
         FROM public.tutor_sandbox_mock_assessments
        WHERE tutor_assignment_id = $1
          AND checklist->>'assessment_version' = '2'
          AND checklist->>'assessment_owner' = 'td'
        ORDER BY assessed_at DESC, id DESC
        LIMIT 1`,
      [tutorAssignmentId],
    );
    return result.rows[0] ? mapTdReadinessAssessment(result.rows[0]) : null;
  } catch (error) {
    if (isMissingSandboxMockTable(error)) return null;
    throw new Error(
      `Failed to load Sandbox readiness assessments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
export async function recordSandboxReadinessAssessment(input: {
  tutorId: string;
  tutorAssignmentId: string;
  decision: SandboxReadinessDecision;
  evidenceNote: string;
  assessedByUserId: string;
  capabilitySnapshot: Record<string, unknown>;
}) {
  const evidenceNote = String(input.evidenceNote || "").trim();
  if (!evidenceNote) {
    throw new Error("TD readiness evidence note is required.");
  }

  if (
    input.decision === "passed" &&
    input.capabilitySnapshot?.practicalsReady !== true
  ) {
    throw new Error(
      "TD readiness cannot be approved until the Sandbox capability engine is Practicals-ready.",
    );
  }

  const checklist = {
    assessment_version: 2,
    assessment_owner: "td",
    next_stage: "practicals",
    capability_snapshot: input.capabilitySnapshot,
  };
  try {
    await pool.query(
      `INSERT INTO public.tutor_sandbox_mock_assessments
          (tutor_id, tutor_assignment_id, decision, checklist, evidence_note, assessed_by_user_id)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        input.tutorId,
        input.tutorAssignmentId,
        input.decision,
        JSON.stringify(checklist),
        evidenceNote,
        input.assessedByUserId,
      ],
    );
  } catch (error) {
    throw new Error(
      `Failed to record Sandbox readiness assessment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return getLatestSandboxReadinessAssessment(input.tutorAssignmentId);
}
