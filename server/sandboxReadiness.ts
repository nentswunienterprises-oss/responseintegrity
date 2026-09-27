import { supabase } from "./storage";
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
    assessedAt: String(row.assessed_at),
    capabilitySnapshot,
  };
}

export async function getLatestSandboxReadinessAssessment(
  tutorAssignmentId: string,
) {
  const { data, error } = await supabase
    .from("tutor_sandbox_mock_assessments")
    .select("*")
    .eq("tutor_assignment_id", tutorAssignmentId)
    .order("assessed_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingSandboxMockTable(error)) return null;
    throw new Error(`Failed to load Sandbox readiness assessments: ${error.message}`);
  }

  const row = (data || []).find((candidate: any) => {
    const checklist =
      candidate?.checklist && typeof candidate.checklist === "object"
        ? candidate.checklist
        : {};
    return checklist.assessment_version === 2 && checklist.assessment_owner === "td";
  });

  return row ? mapTdReadinessAssessment(row) : null;
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

  const { error } = await supabase.from("tutor_sandbox_mock_assessments").insert({
    tutor_id: input.tutorId,
    tutor_assignment_id: input.tutorAssignmentId,
    decision: input.decision,
    checklist: {
      assessment_version: 2,
      assessment_owner: "td",
      next_stage: "practicals",
      capability_snapshot: input.capabilitySnapshot,
    },
    evidence_note: evidenceNote,
    assessed_by_user_id: input.assessedByUserId,
  });

  if (error) {
    throw new Error(`Failed to record Sandbox readiness assessment: ${error.message}`);
  }

  return getLatestSandboxReadinessAssessment(input.tutorAssignmentId);
}
