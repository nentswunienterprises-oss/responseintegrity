import { supabase } from "./storage";
import {
  evaluateSandboxReadinessGate,
  isSandboxMockChecklistComplete,
  normalizeSandboxMockChecklist,
  type SandboxMockAssessment,
  type SandboxMockDecision,
} from "@shared/sandboxReadiness";

function mapAssessment(row: any): SandboxMockAssessment {
  return {
    id: String(row.id),
    tutorId: String(row.tutor_id),
    tutorAssignmentId: String(row.tutor_assignment_id),
    decision: row.decision as SandboxMockDecision,
    checklist: normalizeSandboxMockChecklist(row.checklist),
    evidenceNote: String(row.evidence_note || ""),
    assessedByUserId: String(row.assessed_by_user_id),
    assessedAt: String(row.assessed_at),
  };
}

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
  decision: SandboxMockDecision;
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
    decision: row.decision as SandboxMockDecision,
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
  decision: SandboxMockDecision;
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
      "Practicals cannot open until the Sandbox capability engine is ready.",
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

export async function loadLatestSandboxMockAssessmentMap(assignmentIds: string[]) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.map(String).filter(Boolean)));
  const result = new Map<string, SandboxMockAssessment>();
  if (!uniqueAssignmentIds.length) return result;

  const { data, error } = await supabase
    .from("tutor_sandbox_mock_assessments")
    .select("*")
    .in("tutor_assignment_id", uniqueAssignmentIds)
    .order("assessed_at", { ascending: false });

  if (error) {
    if (isMissingSandboxMockTable(error)) return result;
    throw new Error(`Failed to load Sandbox Mock assessments: ${error.message}`);
  }

  for (const row of data || []) {
    const assignmentId = String(row.tutor_assignment_id);
    if (!result.has(assignmentId)) result.set(assignmentId, mapAssessment(row));
  }

  return result;
}

export async function getLatestSandboxMockAssessment(tutorAssignmentId: string) {
  const assessments = await loadLatestSandboxMockAssessmentMap([tutorAssignmentId]);
  return assessments.get(tutorAssignmentId) || null;
}

export async function recordSandboxMockAssessment(input: {
  tutorId: string;
  tutorAssignmentId: string;
  decision: SandboxMockDecision;
  checklist: unknown;
  evidenceNote: string;
  assessedByUserId: string;
}) {
  const checklist = normalizeSandboxMockChecklist(input.checklist);
  const evidenceNote = String(input.evidenceNote || "").trim();
  if (!evidenceNote) throw new Error("Sandbox Mock evidence is required.");
  if (input.decision === "passed" && !isSandboxMockChecklistComplete(checklist)) {
    throw new Error("Every Sandbox Mock readiness criterion must pass before Trial opens.");
  }

  const { error } = await supabase.rpc("record_tutor_sandbox_mock_assessment", {
    p_tutor_id: input.tutorId,
    p_tutor_assignment_id: input.tutorAssignmentId,
    p_decision: input.decision,
    p_checklist: checklist,
    p_evidence_note: evidenceNote,
    p_assessed_by_user_id: input.assessedByUserId,
  });

  if (error) throw new Error(`Failed to record Sandbox Mock assessment: ${error.message}`);
  return getLatestSandboxMockAssessment(input.tutorAssignmentId);
}

export function buildSandboxReadinessOverview(input: {
  docsComplete: boolean;
  transformationComplete: boolean;
  sessionInfrastructureComplete: boolean;
  hasActiveFailHealth: boolean;
  sandboxAccountCount: number;
  latestMockAssessment: SandboxMockAssessment | null;
}) {
  return {
    latestMockAssessment: input.latestMockAssessment,
    gate: evaluateSandboxReadinessGate(input),
  };
}
