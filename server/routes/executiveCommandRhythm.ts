import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { supabase } from "../storage";
import { pool } from "../db";
import { isEmergencyDbMode } from "../emergencyMode";

const EXECUTIVE_ROLES = ["ceo", "coo", "hr", "cto", "cmo"] as const;
const EXECUTIVE_PROOF_TYPES = ["link", "screenshot", "image", "doc"] as const;
const APPROVER_ROLES = new Set(["ceo", "coo"]);

type ExecutiveRole = (typeof EXECUTIVE_ROLES)[number];
type ExecutiveDepartment = ExecutiveRole;
type ExecutiveProofType = (typeof EXECUTIVE_PROOF_TYPES)[number];

type ExecutiveUser = {
  id: string;
  email: string;
  name: string;
  role: ExecutiveRole;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExecutiveProfile = {
  id: string;
  userId: string;
  department: ExecutiveDepartment;
  title: string;
  mission: string | null;
  reportingLine: string | null;
  authorityLevel: string | null;
  coreResponsibilities: string[];
  communicationRhythm: string | null;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  contributionStatus: "not_contributing" | "building" | "contributing" | "at_risk";
  doctrineAcknowledged: boolean;
  consequenceLogicAcknowledged: boolean;
  onboardingCompletedAt: string | null;
  contributionActivatedAt: string | null;
  lastContributionAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExecutiveTask = {
  id: string;
  title: string;
  description: string | null;
  department: ExecutiveDepartment;
  ownerUserId: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  supportingUserIds: string[];
  deadline: string;
  priority: "critical" | "high" | "normal" | "low";
  requiredProof: string;
  proofRequiredForApproval: boolean;
  status: "not_started" | "in_progress" | "blocked" | "submitted" | "approved" | "missed";
  completionPercent: number;
  blockerSummary: string | null;
  blockerNeeds: string | null;
  blockerDecisionNeeded: string | null;
  blockerReportedAt: string | null;
  ceoVisible: boolean;
  ceoNotes: string | null;
  cooNotes: string | null;
  consequenceIfIncomplete: string | null;
  completionResult: "done" | "delayed" | "failed" | "moved" | null;
  directionSource: string | null;
  weekStartDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  lastUpdatedAt: string | null;
  createdAt: string | null;
};

type ExecutiveTaskTimeLog = {
  id: string;
  taskId: string;
  userId: string;
  workDate: string;
  minutesSpent: number;
  outcomeProduced: string;
  proofReference: string | null;
  roleAligned: boolean;
  valueType: "strategic" | "support" | "activity";
  createdAt: string | null;
};

type ExecutiveTaskProof = {
  id: string;
  taskId: string;
  submittedByUserId: string;
  reviewedByUserId: string | null;
  label: string;
  proofType: string;
  proofUrl: string;
  notes: string | null;
  status: "submitted" | "approved" | "rejected";
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

type ExecutiveWeeklyRecord = {
  id: string;
  weekStartDate: string;
  recordType:
    | "coo_operational_report"
    | "ceo_feedback_record"
    | "executive_direction_report"
    | "department_report";
  department: ExecutiveDepartment | null;
  createdByUserId: string;
  title: string;
  summary: string;
  keyDecisions: string | null;
  risks: string | null;
  nextDirections: string | null;
  needsAttention: string | null;
  sourceTaskIds: string[];
  payload: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExecutiveRoleAppointment = {
  id: string;
  role: ExecutiveRole;
  appointedUserId: string | null;
  appointedByUserId: string | null;
  notes: string | null;
  appointedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const ROLE_META: Record<
  ExecutiveRole,
  {
    department: ExecutiveDepartment;
    title: string;
    mission: string;
    reportingLine: string;
    authorityLevel: string;
    coreResponsibilities: string[];
  }
> = {
  ceo: {
    department: "ceo",
    title: "Chief Executive Officer",
    mission: "Set direction, review truth, and strengthen the institution week by week.",
    reportingLine: "Founder / Board",
    authorityLevel: "Company-wide command",
    coreResponsibilities: [
      "Set weekly direction",
      "Review company truth",
      "Make executive decisions",
    ],
  },
  coo: {
    department: "coo",
    title: "Chief Operating Officer",
    mission: "Turn direction into tracked execution and keep deadlines visible.",
    reportingLine: "CEO",
    authorityLevel: "Company-wide operational control",
    coreResponsibilities: [
      "Convert direction into work",
      "Track execution across departments",
      "Produce the Friday operational report",
    ],
  },
  hr: {
    department: "hr",
    title: "Head of Human Resources",
    mission: "Protect role health, onboarding integrity, and contribution visibility.",
    reportingLine: "CEO",
    authorityLevel: "People systems and accountability",
    coreResponsibilities: [
      "Track onboarding vs contribution",
      "Surface drift and silence",
      "Protect staffing quality",
    ],
  },
  cto: {
    department: "cto",
    title: "Chief Technology Officer",
    mission: "Build systems that make direction, proof, and reporting operational.",
    reportingLine: "CEO",
    authorityLevel: "Technology and infrastructure ownership",
    coreResponsibilities: [
      "Ship systems and automations",
      "Resolve technical blockers",
      "Document technical execution truth",
    ],
  },
  cmo: {
    department: "cmo",
    title: "Chief Marketing Officer",
    mission: "Convert brand and attention efforts into visible, provable output.",
    reportingLine: "CEO",
    authorityLevel: "Marketing and growth execution",
    coreResponsibilities: [
      "Ship content and campaigns",
      "Track experiments and outcomes",
      "Provide proof of market-facing work",
    ],
  },
};

const executiveTaskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  department: z.enum(EXECUTIVE_ROLES),
  ownerUserId: z.string().min(1),
  supportingUserIds: z.array(z.string().min(1)).optional().default([]),
  deadline: z.coerce.date(),
  priority: z.enum(["critical", "high", "normal", "low"]).default("normal"),
  requiredProof: z.string().min(1),
  proofRequiredForApproval: z.boolean().optional().default(true),
  ceoVisible: z.boolean().optional().default(true),
  ceoNotes: z.string().optional().nullable(),
  cooNotes: z.string().optional().nullable(),
  consequenceIfIncomplete: z.string().optional().nullable(),
  directionSource: z.string().optional().nullable(),
  weekStartDate: z.coerce.date().optional().nullable(),
});

const executiveTaskUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  deadline: z.coerce.date().optional(),
  priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  requiredProof: z.string().min(1).optional(),
  status: z.enum(["not_started", "in_progress", "blocked", "submitted", "approved", "missed"]).optional(),
  completionPercent: z.number().int().min(0).max(100).optional(),
  blockerSummary: z.string().optional().nullable(),
  blockerNeeds: z.string().optional().nullable(),
  blockerDecisionNeeded: z.string().optional().nullable(),
  ceoNotes: z.string().optional().nullable(),
  cooNotes: z.string().optional().nullable(),
  consequenceIfIncomplete: z.string().optional().nullable(),
  completionResult: z.enum(["done", "delayed", "failed", "moved"]).optional().nullable(),
});

const executiveTimeLogSchema = z.object({
  workDate: z.coerce.date().optional(),
  minutesSpent: z.number().int().min(1),
  outcomeProduced: z.string().min(1),
  proofReference: z.string().optional().nullable(),
  roleAligned: z.boolean().optional().default(true),
  valueType: z.enum(["strategic", "support", "activity"]).optional().default("support"),
});

const executiveProofSchema = z.object({
  label: z.string().min(1),
  proofType: z.enum(EXECUTIVE_PROOF_TYPES).optional().default("link"),
  proofUrl: z.string().optional(),
  fileData: z.string().optional(),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  notes: z.string().optional().nullable(),
});

const executiveWeeklyRecordSchema = z.object({
  weekStartDate: z.coerce.date(),
  recordType: z.enum([
    "coo_operational_report",
    "ceo_feedback_record",
    "executive_direction_report",
    "department_report",
  ]),
  department: z.enum(EXECUTIVE_ROLES).optional().nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  keyDecisions: z.string().optional().nullable(),
  risks: z.string().optional().nullable(),
  nextDirections: z.string().optional().nullable(),
  needsAttention: z.string().optional().nullable(),
  sourceTaskIds: z.array(z.string().min(1)).optional().default([]),
  payload: z.record(z.any()).optional().default({}),
});

const executiveProfileUpsertSchema = z.object({
  title: z.string().min(1).optional(),
  mission: z.string().optional().nullable(),
  reportingLine: z.string().optional().nullable(),
  authorityLevel: z.string().optional().nullable(),
  coreResponsibilities: z.array(z.string().min(1)).optional(),
  communicationRhythm: z.string().optional().nullable(),
  onboardingStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
  contributionStatus: z.enum(["not_contributing", "building", "contributing", "at_risk"]).optional(),
  doctrineAcknowledged: z.boolean().optional(),
  consequenceLogicAcknowledged: z.boolean().optional(),
});

const executiveAppointmentSchema = z.object({
  appointedUserId: z.string().min(1).nullable(),
  notes: z.string().optional().nullable(),
});

function isExecutiveRole(role: string | undefined | null): role is ExecutiveRole {
  return !!role && EXECUTIVE_ROLES.includes(role as ExecutiveRole);
}

function requireExecutiveRole() {
  return async (req: Request, res: Response, next: Function) => {
    const role = (req as any).dbUser?.role;
    if (!isExecutiveRole(role)) {
      return res.status(403).json({ message: "Executive access required" });
    }
    next();
  };
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  return result;
}

function isoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isMissingExecutiveInfrastructureError(error: any) {
  const code = String(error?.code || "");
  const message = `${String(error?.message || "")} ${String(error?.details || "")}`.toLowerCase();

  if (code === "42P01" || code === "42703" || code === "PGRST205") {
    return true;
  }

  return [
    "executive_profiles",
    "executive_command_tasks",
    "executive_task_time_logs",
    "executive_task_proofs",
    "executive_weekly_records",
    "executive_role_appointments",
    "schema cache",
    "could not find the table",
    "relation",
    "column",
  ].some((fragment) => message.includes(fragment));
}

function normalizeProofUrlOrThrow(value: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("Proof link must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Proof link must use http or https");
  }

  return parsedUrl.toString();
}

async function ensurePublicBucket(bucketName: string) {
  const { error } = await supabase.storage.createBucket(bucketName, { public: true });
  if (error && !/already exists|duplicate/i.test(String(error.message || ""))) {
    throw error;
  }
}

function normalizeBase64Payload(raw: string) {
  return raw.includes(",") ? raw.split(",").pop() || "" : raw;
}

function getAllowedProofUpload(contentType: string, proofType: ExecutiveProofType) {
  const normalizedType = String(contentType || "").toLowerCase();

  if (proofType === "screenshot" || proofType === "image") {
    if (!normalizedType.startsWith("image/")) {
      throw new Error(`${proofType === "screenshot" ? "Screenshot" : "Image"} proof must be an image file`);
    }

    return {
      bucketName: "executive-task-proofs",
      maxBytes: 10 * 1024 * 1024,
    };
  }

  if (proofType === "doc") {
    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ]);

    if (!allowedTypes.has(normalizedType)) {
      throw new Error("Document proof must be a PDF, DOC, DOCX, TXT, or Markdown file");
    }

    return {
      bucketName: "executive-task-proofs",
      maxBytes: 25 * 1024 * 1024,
    };
  }

  throw new Error("Uploaded proof type is not supported");
}

function normalizeExecutiveUser(row: any): ExecutiveUser {
  return {
    id: row.id,
    email: String(row.email || ""),
    name: String(row.name || row.email || "Executive"),
    role: row.role as ExecutiveRole,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

function normalizeExecutiveProfile(row: any): ExecutiveProfile {
  return {
    id: row.id,
    userId: row.user_id,
    department: row.department,
    title: row.title,
    mission: row.mission || null,
    reportingLine: row.reporting_line || null,
    authorityLevel: row.authority_level || null,
    coreResponsibilities: Array.isArray(row.core_responsibilities) ? row.core_responsibilities : [],
    communicationRhythm: row.communication_rhythm || null,
    onboardingStatus: row.onboarding_status,
    contributionStatus: row.contribution_status,
    doctrineAcknowledged: Boolean(row.doctrine_acknowledged),
    consequenceLogicAcknowledged: Boolean(row.consequence_logic_acknowledged),
    onboardingCompletedAt: isoOrNull(row.onboarding_completed_at),
    contributionActivatedAt: isoOrNull(row.contribution_activated_at),
    lastContributionAt: isoOrNull(row.last_contribution_at),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

function normalizeExecutiveTask(row: any): ExecutiveTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    department: row.department,
    ownerUserId: row.owner_user_id,
    createdByUserId: row.created_by_user_id,
    approvedByUserId: row.approved_by_user_id || null,
    supportingUserIds: Array.isArray(row.supporting_user_ids) ? row.supporting_user_ids : [],
    deadline: isoOrNull(row.deadline) || new Date().toISOString(),
    priority: row.priority,
    requiredProof: row.required_proof,
    proofRequiredForApproval: Boolean(row.proof_required_for_approval),
    status: row.status,
    completionPercent: Number(row.completion_percent || 0),
    blockerSummary: row.blocker_summary || null,
    blockerNeeds: row.blocker_needs || null,
    blockerDecisionNeeded: row.blocker_decision_needed || null,
    blockerReportedAt: isoOrNull(row.blocker_reported_at),
    ceoVisible: Boolean(row.ceo_visible),
    ceoNotes: row.ceo_notes || null,
    cooNotes: row.coo_notes || null,
    consequenceIfIncomplete: row.consequence_if_incomplete || null,
    completionResult: row.completion_result || null,
    directionSource: row.direction_source || null,
    weekStartDate: isoOrNull(row.week_start_date),
    submittedAt: isoOrNull(row.submitted_at),
    approvedAt: isoOrNull(row.approved_at),
    lastUpdatedAt: isoOrNull(row.last_updated_at),
    createdAt: isoOrNull(row.created_at),
  };
}

function normalizeExecutiveTimeLog(row: any): ExecutiveTaskTimeLog {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    workDate: isoOrNull(row.work_date) || new Date().toISOString(),
    minutesSpent: Number(row.minutes_spent || 0),
    outcomeProduced: row.outcome_produced,
    proofReference: row.proof_reference || null,
    roleAligned: Boolean(row.role_aligned),
    valueType: row.value_type,
    createdAt: isoOrNull(row.created_at),
  };
}

function normalizeExecutiveProof(row: any): ExecutiveTaskProof {
  return {
    id: row.id,
    taskId: row.task_id,
    submittedByUserId: row.submitted_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id || null,
    label: row.label,
    proofType: row.proof_type,
    proofUrl: row.proof_url,
    notes: row.notes || null,
    status: row.status,
    rejectionReason: row.rejection_reason || null,
    submittedAt: isoOrNull(row.submitted_at),
    reviewedAt: isoOrNull(row.reviewed_at),
  };
}

function normalizeExecutiveWeeklyRecord(row: any): ExecutiveWeeklyRecord {
  return {
    id: row.id,
    weekStartDate: isoOrNull(row.week_start_date) || new Date().toISOString(),
    recordType: row.record_type,
    department: row.department || null,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    summary: row.summary,
    keyDecisions: row.key_decisions || null,
    risks: row.risks || null,
    nextDirections: row.next_directions || null,
    needsAttention: row.needs_attention || null,
    sourceTaskIds: Array.isArray(row.source_task_ids) ? row.source_task_ids : [],
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

function normalizeExecutiveAppointment(row: any): ExecutiveRoleAppointment {
  return {
    id: row.id,
    role: row.role,
    appointedUserId: row.appointed_user_id || null,
    appointedByUserId: row.appointed_by_user_id || null,
    notes: row.notes || null,
    appointedAt: isoOrNull(row.appointed_at),
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
  };
}

async function getExecutiveCandidateUsers() {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at, updated_at
         FROM public.users
        WHERE role::text = ANY($1::text[])`,
      [EXECUTIVE_ROLES],
    );
    return result.rows.map(normalizeExecutiveUser);
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role, created_at, updated_at")
    .in("role", [...EXECUTIVE_ROLES]);

  if (error) throw error;
  return (data || []).map(normalizeExecutiveUser);
}

async function getExecutiveAppointments() {
  if (isEmergencyDbMode()) {
    try {
      const result = await pool.query(
        `SELECT id, role, appointed_user_id, appointed_by_user_id, notes,
                appointed_at, created_at, updated_at
           FROM public.executive_role_appointments
          ORDER BY role ASC`,
      );
      return result.rows.map(normalizeExecutiveAppointment);
    } catch (error) {
      if (isMissingExecutiveInfrastructureError(error)) return [];
      throw error;
    }
  }

  const { data, error } = await supabase
    .from("executive_role_appointments")
    .select("*")
    .order("role", { ascending: true });

  if (error) {
    if (isMissingExecutiveInfrastructureError(error)) {
      console.warn("[executive-command-rhythm] executive_role_appointments missing; returning empty roster");
      return [];
    }
    throw error;
  }

  return (data || []).map(normalizeExecutiveAppointment);
}

export function buildExecutiveRosterFromRows(
  currentUserId: string,
  currentUserRole: ExecutiveRole,
  candidateUsers: ExecutiveUser[],
  appointments: ExecutiveRoleAppointment[],
) {
  const candidatesById = new Map(candidateUsers.map((user) => [user.id, user]));
  const appointmentRecordByRole = new Map(appointments.map((appointment) => [appointment.role, appointment]));
  const appointmentByRole = new Map(
    appointments
      .filter((appointment) => appointment.appointedUserId)
      .map((appointment) => [appointment.role, appointment])
  );

  const activeAppointments = EXECUTIVE_ROLES.map((role) => appointmentByRole.get(role)).filter(
    (appointment): appointment is ExecutiveRoleAppointment => Boolean(appointment?.appointedUserId)
  );
  const bootstrapMode = activeAppointments.length === 0;
  const currentUser = candidatesById.get(currentUserId) || null;
  const ceoSeatAppointment = appointmentRecordByRole.get("ceo") || null;
  const isCeoSeatVacant = !ceoSeatAppointment?.appointedUserId;
  const isCurrentUserAppointed =
    currentUserRole === "ceo" && bootstrapMode
      ? true
      : appointmentByRole.get(currentUserRole)?.appointedUserId === currentUserId;
  const canManageAppointments =
    currentUserRole === "ceo" &&
    (bootstrapMode || isCeoSeatVacant || appointmentByRole.get("ceo")?.appointedUserId === currentUserId);

  const appointedExecutives = activeAppointments
    .map((appointment) => appointment.appointedUserId ? candidatesById.get(appointment.appointedUserId) || null : null)
    .filter((entry): entry is ExecutiveUser => Boolean(entry));

  const executives =
    appointedExecutives.length > 0
      ? appointedExecutives
      : currentUserRole === "ceo" && currentUser
        ? [currentUser]
        : [];

  const seats = EXECUTIVE_ROLES.map((role) => {
    const appointment = appointmentByRole.get(role) || null;
    const appointedUser = appointment?.appointedUserId
      ? candidatesById.get(appointment.appointedUserId) || null
      : null;

    return {
      role,
      title: ROLE_META[role].title,
      appointment,
      appointedUser,
      isFilled: Boolean(appointedUser),
      candidates: candidateUsers.filter((user) => user.role === role),
    };
  });

  return {
    candidateUsers,
    currentUser,
    executives,
    seats,
    bootstrapMode,
    canManageAppointments,
    isCurrentUserAppointed,
  };
}

async function buildExecutiveRoster(currentUserId: string, currentUserRole: ExecutiveRole) {
  const [candidateUsers, appointments] = await Promise.all([
    getExecutiveCandidateUsers(),
    getExecutiveAppointments(),
  ]);

  return buildExecutiveRosterFromRows(currentUserId, currentUserRole, candidateUsers, appointments);
}

async function ensureExecutiveProfiles(users: ExecutiveUser[]) {
  const { data: existing, error } = await supabase.from("executive_profiles").select("*");
  if (error) {
    if (isMissingExecutiveInfrastructureError(error)) {
      console.warn("[executive-command-rhythm] executive_profiles missing; using virtual profiles");
      return users.map((user) => {
        const meta = ROLE_META[user.role];
        return {
          id: `virtual-${user.id}`,
          userId: user.id,
          department: meta.department,
          title: meta.title,
          mission: meta.mission,
          reportingLine: meta.reportingLine,
          authorityLevel: meta.authorityLevel,
          coreResponsibilities: meta.coreResponsibilities,
          communicationRhythm: "Friday operational report -> CEO feedback -> next week execution",
          onboardingStatus: "not_started",
          contributionStatus: "not_contributing",
          doctrineAcknowledged: false,
          consequenceLogicAcknowledged: false,
          onboardingCompletedAt: null,
          contributionActivatedAt: null,
          lastContributionAt: null,
          createdAt: null,
          updatedAt: null,
        } satisfies ExecutiveProfile;
      });
    }
    throw error;
  }

  const existingByUserId = new Map(
    (existing || []).map((row: any) => [String(row.user_id), normalizeExecutiveProfile(row)])
  );

  const missingRows = users
    .filter((user) => !existingByUserId.has(user.id))
    .map((user) => {
      const meta = ROLE_META[user.role];
      return {
        user_id: user.id,
        department: meta.department,
        title: meta.title,
        mission: meta.mission,
        reporting_line: meta.reportingLine,
        authority_level: meta.authorityLevel,
        core_responsibilities: meta.coreResponsibilities,
        communication_rhythm: "Friday operational report -> CEO feedback -> next week execution",
      };
    });

  if (missingRows.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("executive_profiles")
      .upsert(missingRows, { onConflict: "user_id" })
      .select("*");

    if (insertError) {
      if (isMissingExecutiveInfrastructureError(insertError)) {
        console.warn("[executive-command-rhythm] executive_profiles insert unavailable; using virtual profiles");
      } else {
        throw insertError;
      }
    }

    for (const row of inserted || []) {
      existingByUserId.set(String(row.user_id), normalizeExecutiveProfile(row));
    }
  }

  return users.map((user) => {
    const existingProfile = existingByUserId.get(user.id);
    if (existingProfile) return existingProfile;

    const meta = ROLE_META[user.role];
    return {
      id: `virtual-${user.id}`,
      userId: user.id,
      department: meta.department,
      title: meta.title,
      mission: meta.mission,
      reportingLine: meta.reportingLine,
      authorityLevel: meta.authorityLevel,
      coreResponsibilities: meta.coreResponsibilities,
      communicationRhythm: "Friday operational report -> CEO feedback -> next week execution",
      onboardingStatus: "not_started",
      contributionStatus: "not_contributing",
      doctrineAcknowledged: false,
      consequenceLogicAcknowledged: false,
      onboardingCompletedAt: null,
      contributionActivatedAt: null,
      lastContributionAt: null,
      createdAt: null,
      updatedAt: null,
    } satisfies ExecutiveProfile;
  });
}

async function getExecutiveTaskBundle() {
  const { data: taskRows, error: taskError } = await supabase
    .from("executive_command_tasks")
    .select("*")
    .order("deadline", { ascending: true });
  if (taskError) {
    if (isMissingExecutiveInfrastructureError(taskError)) {
      console.warn("[executive-command-rhythm] executive task tables missing; returning empty task bundle");
      return { tasks: [], timeLogs: [], proofs: [] };
    }
    throw taskError;
  }

  const tasks = (taskRows || []).map(normalizeExecutiveTask);
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length === 0) {
    return { tasks: [], timeLogs: [], proofs: [] };
  }

  const [{ data: timeLogRows, error: timeLogError }, { data: proofRows, error: proofError }] =
    await Promise.all([
      supabase
        .from("executive_task_time_logs")
        .select("*")
        .in("task_id", taskIds)
        .order("work_date", { ascending: false }),
      supabase
        .from("executive_task_proofs")
        .select("*")
        .in("task_id", taskIds)
        .order("submitted_at", { ascending: false }),
    ]);

  if (timeLogError && !isMissingExecutiveInfrastructureError(timeLogError)) throw timeLogError;
  if (proofError && !isMissingExecutiveInfrastructureError(proofError)) throw proofError;
  if (timeLogError) {
    console.warn("[executive-command-rhythm] executive_task_time_logs missing; returning empty time logs");
  }
  if (proofError) {
    console.warn("[executive-command-rhythm] executive_task_proofs missing; returning empty proofs");
  }

  return {
    tasks,
    timeLogs: (timeLogRows || []).map(normalizeExecutiveTimeLog),
    proofs: (proofRows || []).map(normalizeExecutiveProof),
  };
}

async function getWeeklyRecords() {
  const { data, error } = await supabase
    .from("executive_weekly_records")
    .select("*")
    .order("week_start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingExecutiveInfrastructureError(error)) {
      console.warn("[executive-command-rhythm] executive_weekly_records missing; returning empty archive");
      return [];
    }
    throw error;
  }
  return (data || []).map(normalizeExecutiveWeeklyRecord);
}

function getEffectiveTaskStatus(task: ExecutiveTask) {
  if (task.status === "approved" || task.status === "missed") return task.status;
  if (new Date(task.deadline).getTime() < Date.now()) return "missed";
  return task.status;
}

function buildHydratedTasks(args: {
  tasks: ExecutiveTask[];
  proofs: ExecutiveTaskProof[];
  timeLogs: ExecutiveTaskTimeLog[];
  executives: ExecutiveUser[];
}) {
  const proofsByTaskId = args.proofs.reduce<Record<string, ExecutiveTaskProof[]>>((acc, proof) => {
    acc[proof.taskId] = [...(acc[proof.taskId] || []), proof];
    return acc;
  }, {});

  const timeLogsByTaskId = args.timeLogs.reduce<Record<string, ExecutiveTaskTimeLog[]>>((acc, log) => {
    acc[log.taskId] = [...(acc[log.taskId] || []), log];
    return acc;
  }, {});

  const executivesById = new Map(args.executives.map((executive) => [executive.id, executive]));

  return args.tasks.map((task) => {
    const proofs = proofsByTaskId[task.id] || [];
    const timeLogs = timeLogsByTaskId[task.id] || [];
    const owner = executivesById.get(task.ownerUserId) || null;
    const supporters = task.supportingUserIds
      .map((userId) => executivesById.get(userId))
      .filter((entry): entry is ExecutiveUser => Boolean(entry));
    const createdBy = executivesById.get(task.createdByUserId) || null;
    const approvedBy = task.approvedByUserId ? executivesById.get(task.approvedByUserId) || null : null;
    const totalMinutesSpent = timeLogs.reduce((sum, log) => sum + log.minutesSpent, 0);
    const effectiveStatus = getEffectiveTaskStatus(task);
    const latestUpdateAt = [
      task.lastUpdatedAt,
      task.approvedAt,
      task.submittedAt,
      ...proofs.map((proof) => proof.reviewedAt || proof.submittedAt),
      ...timeLogs.map((log) => log.createdAt || log.workDate),
    ]
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

    return {
      ...task,
      effectiveStatus,
      totalMinutesSpent,
      proofCount: proofs.length,
      approvedProofCount: proofs.filter((proof) => proof.status === "approved").length,
      proofs,
      timeLogs,
      owner,
      supporters,
      createdBy,
      approvedBy,
      latestUpdateAt,
      isOverdue: effectiveStatus === "missed",
    };
  });
}

function buildExecutiveSummaryTable(args: {
  executives: ExecutiveUser[];
  profiles: ExecutiveProfile[];
  tasks: ReturnType<typeof buildHydratedTasks>;
  timeLogs: ExecutiveTaskTimeLog[];
}) {
  const profileByUserId = new Map(args.profiles.map((profile) => [profile.userId, profile]));
  const currentWeekStart = startOfWeek(new Date()).getTime();

  return args.executives.map((executive) => {
    const ownedTasks = args.tasks.filter((task) => task.ownerUserId === executive.id);
    const activeTasks = ownedTasks.filter((task) =>
      ["not_started", "in_progress", "blocked", "submitted"].includes(task.effectiveStatus)
    );
    const delayedTasks = ownedTasks.filter((task) => task.effectiveStatus === "missed");
    const approvedTasks = ownedTasks.filter((task) => task.effectiveStatus === "approved");
    const blockedTasks = ownedTasks.filter((task) => task.effectiveStatus === "blocked");
    const thisWeekMinutes = args.timeLogs
      .filter((log) => log.userId === executive.id && startOfWeek(new Date(log.workDate)).getTime() === currentWeekStart)
      .reduce((sum, log) => sum + log.minutesSpent, 0);
    const completionRate = ownedTasks.length
      ? Math.round((approvedTasks.length / ownedTasks.length) * 100)
      : 0;
    const latestUpdateAt = ownedTasks
      .map((task) => task.latestUpdateAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

    let riskLevel: "low" | "medium" | "high" = "low";
    if (blockedTasks.length > 0 || delayedTasks.length > 0) riskLevel = "medium";
    if (blockedTasks.length > 1 || delayedTasks.length > 1) riskLevel = "high";

    return {
      executive,
      profile: profileByUserId.get(executive.id) || null,
      activePriorities: activeTasks.length,
      completionRate,
      delayedTasks: delayedTasks.length,
      blockedTasks: blockedTasks.length,
      lastUpdateAt: latestUpdateAt,
      thisWeekMinutes,
      riskLevel,
    };
  });
}

function buildCompanySummary(tasks: ReturnType<typeof buildHydratedTasks>, weeklyRecords: ExecutiveWeeklyRecord[]) {
  const activeTasks = tasks.filter((task) =>
    ["not_started", "in_progress", "blocked", "submitted"].includes(task.effectiveStatus)
  );
  const awaitingReview = tasks.filter((task) => task.effectiveStatus === "submitted");
  const missedTasks = tasks.filter((task) => task.effectiveStatus === "missed");
  const blockedTasks = tasks.filter((task) => task.effectiveStatus === "blocked");
  const totalMinutesSpent = tasks.reduce((sum, task) => sum + task.totalMinutesSpent, 0);

  return {
    totalTasks: tasks.length,
    activeTasks: activeTasks.length,
    awaitingReview: awaitingReview.length,
    missedTasks: missedTasks.length,
    blockedTasks: blockedTasks.length,
    approvedTasks: tasks.filter((task) => task.effectiveStatus === "approved").length,
    totalMinutesSpent,
    weeklyRecordCount: weeklyRecords.length,
  };
}

async function buildOverviewPayload(currentUserId: string) {
  const currentUserRecord = await supabase
    .from("users")
    .select("id, email, name, role, created_at, updated_at")
    .eq("id", currentUserId)
    .maybeSingle();

  if (currentUserRecord.error) throw currentUserRecord.error;
  const currentUser = currentUserRecord.data ? normalizeExecutiveUser(currentUserRecord.data) : null;
  if (!currentUser || !isExecutiveRole(currentUser.role)) {
    throw new Error("Executive user not found");
  }

  const roster = await buildExecutiveRoster(currentUserId, currentUser.role);
  const executives = roster.executives;
  const profiles = await ensureExecutiveProfiles(executives);
  const { tasks, timeLogs, proofs } = await getExecutiveTaskBundle();
  const weeklyRecords = await getWeeklyRecords();
  const hydratedTasks = buildHydratedTasks({ tasks, proofs, timeLogs, executives });
  const executiveSummaryTable = buildExecutiveSummaryTable({
    executives,
    profiles,
    tasks: hydratedTasks,
    timeLogs,
  });
  const myProfile = profiles.find((profile) => profile.userId === currentUserId) || null;

  return {
    executives,
    seats: roster.seats.map((seat) => ({
      role: seat.role,
      title: seat.title,
      isFilled: seat.isFilled,
      appointedUser: seat.appointedUser,
      appointment: seat.appointment,
    })),
    canManageAppointments: roster.canManageAppointments,
    bootstrapMode: roster.bootstrapMode,
    profiles,
    myProfile,
    tasks: hydratedTasks,
    weeklyRecords,
    companySummary: buildCompanySummary(hydratedTasks, weeklyRecords),
    executiveSummaryTable,
  };
}

async function getTaskById(taskId: string) {
  const { data, error } = await supabase
    .from("executive_command_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeExecutiveTask(data) : null;
}

async function getProofsForTask(taskId: string) {
  const { data, error } = await supabase
    .from("executive_task_proofs")
    .select("*")
    .eq("task_id", taskId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeExecutiveProof);
}

async function getTimeLogsForTask(taskId: string) {
  const { data, error } = await supabase
    .from("executive_task_time_logs")
    .select("*")
    .eq("task_id", taskId)
    .order("work_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeExecutiveTimeLog);
}

function canCreateWeeklyRecord(role: ExecutiveRole, recordType: ExecutiveWeeklyRecord["recordType"]) {
  if (recordType === "ceo_feedback_record") return role === "ceo";
  if (recordType === "coo_operational_report") return role === "coo" || role === "ceo";
  if (recordType === "executive_direction_report") return role === "coo" || role === "ceo";
  return true;
}

export function registerExecutiveCommandRhythmRoutes(app: Express, isAuthenticated: RequestHandler) {
  const requireExecutive = requireExecutiveRole();
  const executiveRoleOptions = EXECUTIVE_ROLES.map((role) => ({
    role,
    title: ROLE_META[role].title,
  }));

  async function getExecutiveContext(req: Request) {
    const currentUser = (req as any).dbUser as ExecutiveUser;
    if (!currentUser?.id || !isExecutiveRole(currentUser.role)) {
      throw new Error("Executive access required");
    }

    const roster = await buildExecutiveRoster(currentUser.id, currentUser.role);
    return { currentUser, roster };
  }

  async function enforceCommandSeat(req: Request, res: Response) {
    const context = await getExecutiveContext(req);
    if (!context.roster.isCurrentUserAppointed) {
      res.status(403).json({
        message: "Executive appointment required before entering the command rhythm.",
      });
      return null;
    }

    return context;
  }

  app.get(
    "/api/executive/gateway",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const { currentUser, roster } = await getExecutiveContext(req);
        const mySeat = roster.seats.find((seat) => seat.role === currentUser.role) || null;

        res.json({
          executiveRoleOptions,
          currentUser,
          mySeat: mySeat
            ? {
                role: mySeat.role,
                title: mySeat.title,
                isFilled: mySeat.isFilled,
                isCurrentUserAppointed: roster.isCurrentUserAppointed,
                appointedUser: mySeat.appointedUser,
                appointment: mySeat.appointment,
              }
            : null,
          bootstrapMode: roster.bootstrapMode,
          canManageAppointments: roster.canManageAppointments,
          dashboardRoute: `/executive/${currentUser.role}/dashboard`,
          seats: roster.seats.map((seat) => ({
            role: seat.role,
            title: seat.title,
            isFilled: seat.isFilled,
            appointedUser: seat.appointedUser,
            appointment: seat.appointment,
            candidates: seat.candidates,
          })),
        });
      } catch (error) {
        console.error("Failed to load executive gateway:", error);
        res.status(500).json({ message: "Failed to load executive gateway" });
      }
    }
  );

  app.put(
    "/api/executive/appointments/:role",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const requestedRole = req.params.role;
        if (!isExecutiveRole(requestedRole)) {
          return res.status(400).json({ message: "Unknown executive role" });
        }

        const parsed = executiveAppointmentSchema.parse(req.body || {});
        const { currentUser, roster } = await getExecutiveContext(req);

        if (!roster.canManageAppointments) {
          return res.status(403).json({ message: "Only the appointed CEO can manage executive seats" });
        }

        let appointedUserId: string | null = parsed.appointedUserId;
        if (appointedUserId) {
          const candidate = roster.candidateUsers.find((user) => user.id === appointedUserId);
          if (!candidate) {
            return res.status(400).json({ message: "Selected user does not exist" });
          }
          if (candidate.role !== requestedRole) {
            return res.status(400).json({ message: `Selected user is not registered as ${requestedRole.toUpperCase()}` });
          }
        }

        const { data, error } = await supabase
          .from("executive_role_appointments")
          .upsert({
            role: requestedRole,
            appointed_user_id: appointedUserId,
            appointed_by_user_id: appointedUserId ? currentUser.id : null,
            notes: parsed.notes || null,
            appointed_at: appointedUserId ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "role" })
          .select("*")
          .single();

        if (error) throw error;
        res.json(normalizeExecutiveAppointment(data));
      } catch (error) {
        console.error("Failed to manage executive appointment:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to manage appointment" });
      }
    }
  );

  app.get(
    "/api/executive/command-rhythm/overview",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const payload = await buildOverviewPayload(context.currentUser.id);
        res.json(payload);
      } catch (error) {
        console.error("Failed to load executive command rhythm overview:", error);
        res.status(500).json({ message: "Failed to load executive command rhythm overview" });
      }
    }
  );

  app.get(
    "/api/executive/command-rhythm/tasks",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const payload = await buildOverviewPayload(context.currentUser.id);
        res.json(payload.tasks);
      } catch (error) {
        console.error("Failed to load executive tasks:", error);
        res.status(500).json({ message: "Failed to load executive tasks" });
      }
    }
  );

  app.post(
    "/api/executive/command-rhythm/tasks",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const parsed = executiveTaskCreateSchema.parse(req.body || {});
        const owner = context.roster.executives.find((executive) => executive.id === parsed.ownerUserId);

        if (!owner) {
          return res.status(400).json({ message: "Owner must be the currently appointed seat holder for that role" });
        }
        if (owner.role !== parsed.department) {
          return res.status(400).json({ message: "Owner must match the selected executive department" });
        }

        const { data, error } = await supabase
          .from("executive_command_tasks")
          .insert({
            title: parsed.title,
            description: parsed.description || null,
            department: parsed.department,
            owner_user_id: parsed.ownerUserId,
            created_by_user_id: currentUser.id,
            supporting_user_ids: parsed.supportingUserIds,
            deadline: parsed.deadline.toISOString(),
            priority: parsed.priority,
            required_proof: parsed.requiredProof,
            proof_required_for_approval: parsed.proofRequiredForApproval,
            ceo_visible: parsed.ceoVisible,
            ceo_notes: parsed.ceoNotes || null,
            coo_notes: parsed.cooNotes || null,
            consequence_if_incomplete: parsed.consequenceIfIncomplete || null,
            direction_source: parsed.directionSource || null,
            week_start_date: parsed.weekStartDate ? parsed.weekStartDate.toISOString() : null,
          })
          .select("*")
          .single();

        if (error) throw error;
        res.json(normalizeExecutiveTask(data));
      } catch (error) {
        console.error("Failed to create executive task:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create task" });
      }
    }
  );

  app.patch(
    "/api/executive/command-rhythm/tasks/:taskId",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const parsed = executiveTaskUpdateSchema.parse(req.body || {});
        const task = await getTaskById(req.params.taskId);

        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const proofs = await getProofsForTask(task.id);
        const timeLogs = await getTimeLogsForTask(task.id);

        if (parsed.status === "not_started" && (timeLogs.length > 0 || proofs.length > 0)) {
          return res.status(400).json({ message: "Tasks with evidence cannot be reset to not started" });
        }

        if (parsed.status === "blocked" && !String(parsed.blockerSummary || "").trim()) {
          return res.status(400).json({ message: "Blocked tasks require a specific blocker summary" });
        }

        if (parsed.status === "submitted" && proofs.length === 0) {
          return res.status(400).json({ message: "Completion claims require proof before submission" });
        }

        if (parsed.status === "approved") {
          if (!APPROVER_ROLES.has(currentUser.role)) {
            return res.status(403).json({ message: "Only the CEO or COO can mark a task as complete" });
          }

          if (proofs.length === 0) {
            return res.status(400).json({ message: "Marking a task as complete requires at least one submitted proof" });
          }

          const { error: proofApprovalError } = await supabase
            .from("executive_task_proofs")
            .update({
              status: "approved",
              reviewed_by_user_id: currentUser.id,
              reviewed_at: new Date().toISOString(),
              rejection_reason: null,
            })
            .eq("task_id", task.id)
            .eq("status", "submitted");

          if (proofApprovalError) throw proofApprovalError;
        }

        const updatePayload: Record<string, unknown> = {
          last_updated_at: new Date().toISOString(),
        };

        if (parsed.title !== undefined) updatePayload.title = parsed.title;
        if (parsed.description !== undefined) updatePayload.description = parsed.description || null;
        if (parsed.deadline !== undefined) updatePayload.deadline = parsed.deadline.toISOString();
        if (parsed.priority !== undefined) updatePayload.priority = parsed.priority;
        if (parsed.requiredProof !== undefined) updatePayload.required_proof = parsed.requiredProof;
        if (parsed.completionPercent !== undefined) updatePayload.completion_percent = parsed.completionPercent;
        if (parsed.blockerSummary !== undefined) updatePayload.blocker_summary = parsed.blockerSummary || null;
        if (parsed.blockerNeeds !== undefined) updatePayload.blocker_needs = parsed.blockerNeeds || null;
        if (parsed.blockerDecisionNeeded !== undefined) {
          updatePayload.blocker_decision_needed = parsed.blockerDecisionNeeded || null;
        }
        if (parsed.ceoNotes !== undefined) updatePayload.ceo_notes = parsed.ceoNotes || null;
        if (parsed.cooNotes !== undefined) updatePayload.coo_notes = parsed.cooNotes || null;
        if (parsed.consequenceIfIncomplete !== undefined) {
          updatePayload.consequence_if_incomplete = parsed.consequenceIfIncomplete || null;
        }
        if (parsed.completionResult !== undefined) updatePayload.completion_result = parsed.completionResult;

        if (parsed.status !== undefined) {
          updatePayload.status = parsed.status;
          if (parsed.status === "blocked") {
            updatePayload.blocker_reported_at = new Date().toISOString();
          }
          if (parsed.status === "submitted") {
            updatePayload.submitted_at = new Date().toISOString();
          }
          if (parsed.status === "approved") {
            updatePayload.approved_at = new Date().toISOString();
            updatePayload.approved_by_user_id = currentUser.id;
            updatePayload.completion_percent = 100;
          }
        }

        const { data, error } = await supabase
          .from("executive_command_tasks")
          .update(updatePayload)
          .eq("id", task.id)
          .select("*")
          .single();

        if (error) throw error;
        res.json(normalizeExecutiveTask(data));
      } catch (error) {
        console.error("Failed to update executive task:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update task" });
      }
    }
  );

  app.post(
    "/api/executive/command-rhythm/tasks/:taskId/time-logs",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const task = await getTaskById(req.params.taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const parsed = executiveTimeLogSchema.parse(req.body || {});
        const workDate = parsed.workDate || new Date();

        const { data, error } = await supabase
          .from("executive_task_time_logs")
          .insert({
            task_id: task.id,
            user_id: currentUser.id,
            work_date: workDate.toISOString(),
            minutes_spent: parsed.minutesSpent,
            outcome_produced: parsed.outcomeProduced,
            proof_reference: parsed.proofReference || null,
            role_aligned: parsed.roleAligned,
            value_type: parsed.valueType,
          })
          .select("*")
          .single();

        if (error) throw error;

        if (task.status === "not_started") {
          const { error: taskUpdateError } = await supabase
            .from("executive_command_tasks")
            .update({
              status: "in_progress",
              last_updated_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          if (taskUpdateError) throw taskUpdateError;
        }

        if (isExecutiveRole(currentUser.role)) {
          const { error: profileUpdateError } = await supabase
            .from("executive_profiles")
            .update({
              last_contribution_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", currentUser.id);

          if (profileUpdateError) {
            console.warn("Failed to refresh executive profile contribution timestamp:", profileUpdateError);
          }
        }

        res.json(normalizeExecutiveTimeLog(data));
      } catch (error) {
        console.error("Failed to create executive time log:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to log time" });
      }
    }
  );

  app.post(
    "/api/executive/command-rhythm/tasks/:taskId/proofs",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const task = await getTaskById(req.params.taskId);
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        const parsed = executiveProofSchema.parse(req.body || {});
        let persistedProofUrl = "";

        if (parsed.proofType === "link") {
          if (!parsed.proofUrl?.trim()) {
            return res.status(400).json({ message: "Proof link is required" });
          }

          persistedProofUrl = normalizeProofUrlOrThrow(parsed.proofUrl.trim());
        } else {
          if (!parsed.fileData || !parsed.fileName || !parsed.contentType) {
            return res.status(400).json({ message: "Uploaded proof file is required for this proof type" });
          }

          const safeFileName = parsed.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const { bucketName, maxBytes } = getAllowedProofUpload(parsed.contentType, parsed.proofType);
          const buffer = Buffer.from(normalizeBase64Payload(parsed.fileData), "base64");

          if (!buffer.byteLength) {
            return res.status(400).json({ message: "Uploaded proof file was empty" });
          }

          if (buffer.byteLength > maxBytes) {
            const maxMb = Math.round(maxBytes / (1024 * 1024));
            return res.status(400).json({ message: `Uploaded proof must be ${maxMb} MB or smaller` });
          }

          await ensurePublicBucket(bucketName);

          const storagePath = `task-proofs/${task.id}/${Date.now()}-${safeFileName}`;
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(storagePath, buffer, {
              contentType: parsed.contentType,
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Failed to upload proof file: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
          if (!urlData?.publicUrl) {
            throw new Error("Proof upload succeeded but file URL could not be generated");
          }

          persistedProofUrl = urlData.publicUrl;
        }

        const { data, error } = await supabase
          .from("executive_task_proofs")
          .insert({
            task_id: task.id,
            submitted_by_user_id: currentUser.id,
            label: parsed.label,
            proof_type: parsed.proofType,
            proof_url: persistedProofUrl,
            notes: parsed.notes || null,
          })
          .select("*")
          .single();

        if (error) throw error;

        const { error: taskUpdateError } = await supabase
          .from("executive_command_tasks")
          .update({
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        if (taskUpdateError) throw taskUpdateError;
        res.json(normalizeExecutiveProof(data));
      } catch (error) {
        console.error("Failed to submit executive proof:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit proof" });
      }
    }
  );

  app.get(
    "/api/executive/command-rhythm/weekly-records",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const records = await getWeeklyRecords();
        res.json(records);
      } catch (error) {
        console.error("Failed to load weekly records:", error);
        res.status(500).json({ message: "Failed to load weekly records" });
      }
    }
  );

  app.post(
    "/api/executive/command-rhythm/weekly-records",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const parsed = executiveWeeklyRecordSchema.parse(req.body || {});

        if (!canCreateWeeklyRecord(currentUser.role, parsed.recordType)) {
          return res.status(403).json({ message: "You cannot create this type of weekly record" });
        }

        const { data, error } = await supabase
          .from("executive_weekly_records")
          .insert({
            week_start_date: parsed.weekStartDate.toISOString(),
            record_type: parsed.recordType,
            department: parsed.department || null,
            created_by_user_id: currentUser.id,
            title: parsed.title,
            summary: parsed.summary,
            key_decisions: parsed.keyDecisions || null,
            risks: parsed.risks || null,
            next_directions: parsed.nextDirections || null,
            needs_attention: parsed.needsAttention || null,
            source_task_ids: parsed.sourceTaskIds,
            payload: parsed.payload || {},
          })
          .select("*")
          .single();

        if (error) throw error;
        res.json(normalizeExecutiveWeeklyRecord(data));
      } catch (error) {
        console.error("Failed to create weekly record:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create weekly record" });
      }
    }
  );

  app.get(
    "/api/executive/command-rhythm/profiles",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const profiles = await ensureExecutiveProfiles(context.roster.executives);
        res.json(profiles);
      } catch (error) {
        console.error("Failed to load executive profiles:", error);
        res.status(500).json({ message: "Failed to load executive profiles" });
      }
    }
  );

  app.patch(
    "/api/executive/command-rhythm/profiles/:userId",
    isAuthenticated,
    requireExecutive,
    async (req: Request, res: Response) => {
      try {
        const context = await enforceCommandSeat(req, res);
        if (!context) return;

        const currentUser = context.currentUser;
        const targetUserId = req.params.userId;
        const parsed = executiveProfileUpsertSchema.parse(req.body || {});

        if (
          currentUser.id !== targetUserId &&
          !["ceo", "coo", "hr"].includes(String(currentUser.role || ""))
        ) {
          return res.status(403).json({ message: "You can only edit your own profile" });
        }

        const targetExecutive = context.roster.executives.find((executive) => executive.id === targetUserId);
        if (!targetExecutive) {
          return res.status(404).json({ message: "Appointed executive not found" });
        }

        const meta = ROLE_META[targetExecutive.role];
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (parsed.title !== undefined) updatePayload.title = parsed.title;
        if (parsed.mission !== undefined) updatePayload.mission = parsed.mission || null;
        if (parsed.reportingLine !== undefined) updatePayload.reporting_line = parsed.reportingLine || null;
        if (parsed.authorityLevel !== undefined) updatePayload.authority_level = parsed.authorityLevel || null;
        if (parsed.coreResponsibilities !== undefined) {
          updatePayload.core_responsibilities = parsed.coreResponsibilities;
        }
        if (parsed.communicationRhythm !== undefined) {
          updatePayload.communication_rhythm = parsed.communicationRhythm || null;
        }
        if (parsed.onboardingStatus !== undefined) {
          updatePayload.onboarding_status = parsed.onboardingStatus;
          if (parsed.onboardingStatus === "completed") {
            updatePayload.onboarding_completed_at = new Date().toISOString();
          }
        }
        if (parsed.contributionStatus !== undefined) {
          updatePayload.contribution_status = parsed.contributionStatus;
          if (parsed.contributionStatus === "contributing") {
            updatePayload.contribution_activated_at = new Date().toISOString();
          }
        }
        if (parsed.doctrineAcknowledged !== undefined) {
          updatePayload.doctrine_acknowledged = parsed.doctrineAcknowledged;
        }
        if (parsed.consequenceLogicAcknowledged !== undefined) {
          updatePayload.consequence_logic_acknowledged = parsed.consequenceLogicAcknowledged;
        }

        const { data, error } = await supabase
          .from("executive_profiles")
          .upsert(
            {
              user_id: targetExecutive.id,
              department: meta.department,
              title: parsed.title || meta.title,
              mission: parsed.mission !== undefined ? parsed.mission : meta.mission,
              reporting_line:
                parsed.reportingLine !== undefined ? parsed.reportingLine : meta.reportingLine,
              authority_level:
                parsed.authorityLevel !== undefined ? parsed.authorityLevel : meta.authorityLevel,
              core_responsibilities: parsed.coreResponsibilities || meta.coreResponsibilities,
              communication_rhythm:
                parsed.communicationRhythm !== undefined
                  ? parsed.communicationRhythm
                  : "Friday operational report -> CEO feedback -> next week execution",
              ...updatePayload,
            },
            { onConflict: "user_id" }
          )
          .select("*")
          .single();

        if (error) throw error;
        res.json(normalizeExecutiveProfile(data));
      } catch (error) {
        console.error("Failed to update executive profile:", error);
        res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update executive profile" });
      }
    }
  );
}
