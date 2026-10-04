import { v4 as uuidv4 } from "uuid";
import { pool } from "./db";
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

function databaseErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function getSpecialistDevelopmentPathway(tutorId: string) {
  try {
    const result = await pool.query(
      `SELECT *
         FROM public.specialist_development_pathways
        WHERE tutor_id = $1
        ORDER BY started_at DESC
        LIMIT 1`,
      [tutorId],
    );
    const row = result.rows[0];
    return row ? mapPathway(row) : null;
  } catch (error) {
    throw new Error(
      `Failed to load Specialist Development Pathway: ${databaseErrorMessage(error)}`,
    );
  }
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

  try {
    const result = await pool.query(
      `INSERT INTO public.specialist_development_pathways (
         id,
         tutor_id,
         application_id,
         status,
         started_at,
         standard_ends_at,
         maximum_ends_at,
         updated_at
       )
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
       RETURNING *`,
      [
        uuidv4(),
        input.tutorId,
        input.applicationId,
        startedAt,
        addUtcDays(startedAt, SPECIALIST_PATHWAY_STANDARD_DAYS),
        addUtcDays(startedAt, SPECIALIST_PATHWAY_MAXIMUM_DAYS),
        new Date().toISOString(),
      ],
    );
    return mapPathway(result.rows[0]);
  } catch (error) {
    throw new Error(
      `Failed to start Specialist Development Pathway: ${databaseErrorMessage(error)}`,
    );
  }
}

export async function linkSpecialistPathwayAssignment(tutorId: string, tutorAssignmentId: string) {
  try {
    await pool.query(
      `UPDATE public.specialist_development_pathways
          SET tutor_assignment_id = $2,
              updated_at = $3
        WHERE tutor_id = $1
          AND status = 'active'`,
      [tutorId, tutorAssignmentId, new Date().toISOString()],
    );
  } catch (error) {
    throw new Error(
      `Failed to link Specialist pathway assignment: ${databaseErrorMessage(error)}`,
    );
  }
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

  try {
    const result = await pool.query(
      `UPDATE public.specialist_development_pathways
          SET extension_approved_at = $2,
              extension_approved_by_user_id = $3,
              extension_reason = $4,
              updated_at = $2
        WHERE id = $1
          AND status = 'active'
        RETURNING *`,
      [pathway.id, nowIso, input.approvedByUserId, reason],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("No active Specialist Development Pathway was found.");
    }
    return mapPathway(row);
  } catch (error) {
    throw new Error(
      `Failed to approve Specialist pathway extension: ${databaseErrorMessage(error)}`,
    );
  }
}
