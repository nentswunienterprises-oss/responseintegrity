import { v4 as uuidv4 } from "uuid";
import { supabase } from "./storage";
import {
  SPECIALIST_PATHWAY_MAXIMUM_DAYS,
  SPECIALIST_PATHWAY_STANDARD_DAYS,
  addUtcDays,
  deriveSpecialistPathwayTimeline,
  type SpecialistDevelopmentPathwayOverview,
  type SpecialistPathwayStatus,
} from "@shared/specialistDevelopmentPathway";

function mapPathway(row: any): SpecialistDevelopmentPathwayOverview {
  const status = row.status as SpecialistPathwayStatus;
  const startedAt = String(row.started_at);
  const standardEndsAt = String(
    row.standard_ends_at || addUtcDays(startedAt, SPECIALIST_PATHWAY_STANDARD_DAYS),
  );
  const maximumEndsAt = String(
    row.maximum_ends_at || addUtcDays(startedAt, SPECIALIST_PATHWAY_MAXIMUM_DAYS),
  );
  const extensionApprovedAt = row.extension_approved_at ? String(row.extension_approved_at) : null;

  return {
    id: String(row.id),
    tutorId: String(row.tutor_id),
    applicationId: row.application_id ? String(row.application_id) : null,
    tutorAssignmentId: row.tutor_assignment_id ? String(row.tutor_assignment_id) : null,
    status,
    startedAt,
    standardEndsAt,
    maximumEndsAt,
    extensionApprovedAt,
    extensionReason: row.extension_reason || null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    timeline: deriveSpecialistPathwayTimeline({
      status,
      startedAt,
      standardEndsAt,
      maximumEndsAt,
      extensionApprovedAt,
    }),
  };
}

export async function getSpecialistDevelopmentPathway(tutorId: string) {
  const { data, error } = await supabase
    .from("specialist_development_pathways")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Specialist Development Pathway: ${error.message}`);
  return data ? mapPathway(data) : null;
}

export async function ensureSpecialistDevelopmentPathway(input: {
  tutorId: string;
  applicationId: string;
  startedAt?: string | Date | null;
}) {
  const existing = await getSpecialistDevelopmentPathway(input.tutorId);
  if (existing?.status === "active" || existing?.applicationId === input.applicationId) return existing;

  const startDate = input.startedAt ? new Date(input.startedAt) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new Error("A valid pathway start date is required.");
  const startedAt = startDate.toISOString();

  const { data, error } = await supabase
    .from("specialist_development_pathways")
    .insert({
      id: uuidv4(),
      tutor_id: input.tutorId,
      application_id: input.applicationId,
      status: "active",
      started_at: startedAt,
      standard_ends_at: addUtcDays(startedAt, SPECIALIST_PATHWAY_STANDARD_DAYS),
      maximum_ends_at: addUtcDays(startedAt, SPECIALIST_PATHWAY_MAXIMUM_DAYS),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to start Specialist Development Pathway: ${error.message}`);
  return mapPathway(data);
}

export async function linkSpecialistPathwayAssignment(tutorId: string, tutorAssignmentId: string) {
  const { error } = await supabase
    .from("specialist_development_pathways")
    .update({ tutor_assignment_id: tutorAssignmentId, updated_at: new Date().toISOString() })
    .eq("tutor_id", tutorId)
    .eq("status", "active");
  if (error) throw new Error(`Failed to link Specialist pathway assignment: ${error.message}`);
}

export async function approveSpecialistPathwayExtension(input: {
  tutorId: string;
  approvedByUserId: string;
  reason: string;
}) {
  const pathway = await getSpecialistDevelopmentPathway(input.tutorId);
  if (!pathway || pathway.status !== "active") throw new Error("No active Specialist Development Pathway was found.");
  if (!pathway.timeline.canApproveExtension) throw new Error("This pathway cannot receive another extension.");
  const reason = String(input.reason || "").trim();
  if (!reason) throw new Error("A documented extension reason is required.");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("specialist_development_pathways")
    .update({
      extension_approved_at: nowIso,
      extension_approved_by_user_id: input.approvedByUserId,
      extension_reason: reason,
      updated_at: nowIso,
    })
    .eq("id", pathway.id)
    .eq("status", "active")
    .select("*")
    .single();

  if (error) throw new Error(`Failed to approve Specialist pathway extension: ${error.message}`);
  return mapPathway(data);
}
