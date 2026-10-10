import type { TutorTrainingMode } from "@shared/battleTesting";
import { storage, supabase } from "./storage";
import { pool } from "./db";

export const ACTIVE_PARENT_ENROLLMENT_STATUSES = [
  "awaiting_tutor_acceptance",
  "assigned",
  "proposal_sent",
  "session_booked",
  "report_received",
  "confirmed",
] as const;

const REASSIGNMENT_RESUME_PREFIX = "reassignment_resume:";

type TutorEnrollmentUnassignOptions = {
  notificationMessage?: string;
  cleanupArtifacts?: boolean;
};

function buildCompactSandboxSeed(seed: string | null | undefined) {
  return (
    String(seed || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "parent"
  );
}

function buildCompactSandboxEmailPrefix(prefix: string, seed: string | null | undefined) {
  return `${prefix}-${buildCompactSandboxSeed(seed)}-`;
}

function buildReassignmentResumeStep(status: string | null | undefined): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return `${REASSIGNMENT_RESUME_PREFIX}assigned`;
  return `${REASSIGNMENT_RESUME_PREFIX}${normalized}`;
}

function isHeuristicSandboxEnrollment(enrollment: any, tutorId?: string) {
  const parentEmail = String(enrollment?.parent_email || "").trim().toLowerCase();
  const parentName = String(enrollment?.parent_full_name || "").trim().toLowerCase();
  const studentName = String(enrollment?.student_full_name || "").trim().toLowerCase();
  const expectedEmailPrefix = tutorId
    ? buildCompactSandboxEmailPrefix("sandbox-parent", tutorId)
    : "sandbox-parent-";

  return (
    (parentEmail.startsWith(expectedEmailPrefix) && parentEmail.endsWith("@gmail.com")) ||
    parentName.startsWith("sandbox ") ||
    studentName.startsWith("sandbox ")
  );
}

function buildDetachedEnrollmentState(enrollment: any) {
  const preserveTrainingProgress = !!enrollment?.proposal_id;
  return {
    preserveTrainingProgress,
    preservedCurrentStep: preserveTrainingProgress
      ? buildReassignmentResumeStep(enrollment?.status || enrollment?.current_step || "assigned")
      : "awaiting_assignment",
  };
}

async function detachEnrollmentAssignment(enrollment: any) {
  const nowIso = new Date().toISOString();
  const detachedState = buildDetachedEnrollmentState(enrollment);

  let { error: unassignError } = await supabase
    .from("parent_enrollments")
    .update({
      assigned_tutor_id: null,
      status: "awaiting_assignment",
      current_step: detachedState.preservedCurrentStep,
      proposal_id: detachedState.preserveTrainingProgress ? enrollment?.proposal_id : null,
      updated_at: nowIso,
    })
    .eq("id", enrollment.id);

  if (unassignError) {
    const message = String((unassignError as any)?.message || "").toLowerCase();
    const missingOptionalColumn = message.includes("current_step") || message.includes("proposal_id");

    if (missingOptionalColumn) {
      const fallback = await supabase
        .from("parent_enrollments")
        .update({
          assigned_tutor_id: null,
          status: "awaiting_assignment",
          proposal_id: detachedState.preserveTrainingProgress ? enrollment?.proposal_id : null,
          updated_at: nowIso,
        })
        .eq("id", enrollment.id);

      unassignError = fallback.error as any;
    }
  }

  if (unassignError) {
    throw new Error(`Failed to unassign tutor from enrollment ${enrollment.id}: ${unassignError.message}`);
  }
}

async function restoreEnrollmentAssignment(enrollment: any, tutorId: string) {
  const nowIso = new Date().toISOString();

  let { error: restoreError } = await supabase
    .from("parent_enrollments")
    .update({
      assigned_tutor_id: tutorId,
      status: enrollment?.status || "assigned",
      current_step: enrollment?.current_step || null,
      proposal_id: enrollment?.proposal_id || null,
      updated_at: nowIso,
    })
    .eq("id", enrollment.id);

  if (restoreError) {
    const message = String((restoreError as any)?.message || "").toLowerCase();
    const missingOptionalColumn = message.includes("current_step") || message.includes("proposal_id");

    if (missingOptionalColumn) {
      const fallback = await supabase
        .from("parent_enrollments")
        .update({
          assigned_tutor_id: tutorId,
          status: enrollment?.status || "assigned",
          updated_at: nowIso,
        })
        .eq("id", enrollment.id);

      restoreError = fallback.error as any;
    }
  }

  if (restoreError) {
    throw new Error(`Failed to restore tutor on enrollment ${enrollment.id}: ${restoreError.message}`);
  }
}

async function restoreStudentTutorLink(studentId: string, tutorId: string) {
  const student = await storage.getStudent(studentId);
  if (!student) return;

  await storage.updateStudent(studentId, {
    tutorId,
    updatedAt: new Date().toISOString(),
  } as any);
}

export async function restoreDetachedEnrollmentToTutor(enrollment: any, tutorId: string) {
  await restoreEnrollmentAssignment(enrollment, tutorId);

  const restoredStudentIds = new Set<string>();

  if (enrollment.assigned_student_id) {
    restoredStudentIds.add(String(enrollment.assigned_student_id));
    await restoreStudentTutorLink(String(enrollment.assigned_student_id), tutorId);
  }

  const linkedStudentsResult = await pool.query(
    `SELECT id FROM public.students WHERE parent_enrollment_id = $1`,
    [enrollment.id],
  );
  const linkedStudents = linkedStudentsResult.rows;

  for (const linkedStudent of linkedStudents || []) {
    const studentId = String(linkedStudent.id || "");
    if (!studentId || restoredStudentIds.has(studentId)) continue;
    restoredStudentIds.add(studentId);
    await restoreStudentTutorLink(studentId, tutorId);
  }

  const fallbackStudentsResult = await pool.query(
    `SELECT id
       FROM public.students
      WHERE parent_id = $1
        AND name = $2`,
    [enrollment.user_id, enrollment.student_full_name],
  );
  const fallbackStudents = fallbackStudentsResult.rows;

  for (const fallbackStudent of fallbackStudents || []) {
    const studentId = String(fallbackStudent.id || "");
    if (!studentId || restoredStudentIds.has(studentId)) continue;
    restoredStudentIds.add(studentId);
    await restoreStudentTutorLink(studentId, tutorId);
  }
}

export async function cleanupDetachedEnrollmentArtifacts(enrollment: any, previousTutorId: string) {
  const nowIso = new Date().toISOString();

  const clearWorkflow = async (studentId: string) => {
    const student = await storage.getStudent(studentId);
    if (!student) return;

    const existingProfile = (student.personalProfile as any) || {};
    const updatedProfile = {
      ...existingProfile,
      workflow: {
        ...(existingProfile.workflow || {}),
        assignmentAcceptedAt: null,
        assignmentDeclinedAt: null,
      },
    };

    const parentId = (student as any).parentId || null;
    const staleSessionIds = new Set<string>();

    const tutorStudentSessionsResult = await pool.query(
      `SELECT id, status
         FROM public.scheduled_sessions
        WHERE tutor_id = $1
          AND student_id = $2
          AND type = ANY($3::text[])`,
      [previousTutorId, studentId, ["intro", "training"]],
    );
    const tutorStudentSessions = tutorStudentSessionsResult.rows;

    for (const row of tutorStudentSessions || []) {
      if (String(row.status || "").toLowerCase() !== "completed") {
        staleSessionIds.add(String(row.id));
      }
    }

    if (parentId) {
      const parentOnlyIntroSessionsResult = await pool.query(
        `SELECT id, status
           FROM public.scheduled_sessions
          WHERE tutor_id = $1
            AND parent_id = $2
            AND student_id IS NULL
            AND type = 'intro'`,
        [previousTutorId, parentId],
      );
      const parentOnlyIntroSessions = parentOnlyIntroSessionsResult.rows;

      for (const row of parentOnlyIntroSessions || []) {
        if (String(row.status || "").toLowerCase() !== "completed") {
          staleSessionIds.add(String(row.id));
        }
      }
    }

    if (staleSessionIds.size > 0) {
      await pool.query(
        `DELETE FROM public.scheduled_sessions WHERE id = ANY($1::varchar[])`,
        [Array.from(staleSessionIds)],
      );
    }

    await storage.updateStudent(studentId, {
      personalProfile: updatedProfile,
      tutorId: null,
      updatedAt: nowIso,
    } as any);
  };

  if (enrollment.assigned_student_id) {
    try {
      await clearWorkflow(enrollment.assigned_student_id);
    } catch (error) {
      console.error("Failed to clear workflow for assigned student:", error);
    }
  }

  const linkedStudentsResult = await pool.query(
    `SELECT id
       FROM public.students
      WHERE tutor_id = $1
        AND parent_enrollment_id = $2`,
    [previousTutorId, enrollment.id],
  );
  const linkedStudents = linkedStudentsResult.rows;

  for (const linkedStudent of linkedStudents || []) {
    try {
      await clearWorkflow(linkedStudent.id);
    } catch (error) {
      console.error("Failed to clear workflow for linked student:", linkedStudent.id, error);
    }
  }

  const fallbackStudentsResult = await pool.query(
    `SELECT id
       FROM public.students
      WHERE tutor_id = $1
        AND parent_id = $2
        AND name = $3`,
    [previousTutorId, enrollment.user_id, enrollment.student_full_name],
  );
  const fallbackStudents = fallbackStudentsResult.rows;

  for (const fallbackStudent of fallbackStudents || []) {
    if (!linkedStudents?.some((ls) => ls.id === fallbackStudent.id)) {
      try {
        await clearWorkflow(fallbackStudent.id);
      } catch (error) {
        console.error("Failed to clear workflow for fallback student:", fallbackStudent.id, error);
      }
    }
  }
}

export async function safelyUnassignEnrollmentFromTutor(
  enrollment: any,
  previousTutorId: string,
  options?: TutorEnrollmentUnassignOptions
) {
  const studentName = String(enrollment?.student_full_name || "Student").trim() || "Student";
  const parentName = String(enrollment?.parent_full_name || "Parent").trim() || "Parent";
  await detachEnrollmentAssignment(enrollment);

  if (options?.cleanupArtifacts !== false) {
    await cleanupDetachedEnrollmentArtifacts(enrollment, previousTutorId);
  }

  try {
    await storage.createNotification({
      recipientUserId: previousTutorId,
      channel: "informational",
      title: "Assignment Unassigned",
      message:
        options?.notificationMessage ||
        `${studentName} from ${parentName} has been unassigned from your active tutor view. This happened because your current certification mode does not allow live parent assignments. The enrollment has been preserved for reassignment.`,
      link: "/operational/tutor/updates",
      entityType: "assignment_unassigned",
      entityId: String(enrollment.id),
    });
  } catch (error) {
    console.error("Failed to create tutor unassignment notification:", error);
  }
}

export async function cleanupLegacyLiveEnrollmentsForNonLiveTutor(
  tutorId: string,
  certificationMode: TutorTrainingMode
) {
  if (certificationMode === "certified_live") {
    return { detachedCount: 0, detachedEnrollments: [] as any[] };
  }

  let protectedTrialEnrollmentIds = new Set<string>();
  if (certificationMode === "trial") {
    let trialCases: any[] = [];
    try {
      const trialCasesResult = await pool.query(
        `SELECT id
           FROM public.tutor_trial_cases
          WHERE tutor_id = $1
            AND status = ANY($2::text[])`,
        [tutorId, ["active", "reviewable", "remediation_required"]],
      );
      trialCases = trialCasesResult.rows;
    } catch (trialCaseError) {
      console.error("Failed to verify governed Trial placements during assignment cleanup:", trialCaseError);
      return { detachedCount: 0, detachedEnrollments: [] as any[] };
    }

    const trialCaseIds = trialCases.map((trialCase: any) => String(trialCase.id));
    if (trialCaseIds.length > 0) {
      const { data: trialPlacements, error: trialPlacementError } = await supabase
        .from("tutor_trial_placements")
        .select("enrollment_id")
        .in("case_id", trialCaseIds)
        .in("status", ["active", "completed"]);

      if (trialPlacementError) {
        console.error("Failed to verify governed Trial placements during assignment cleanup:", trialPlacementError);
        return { detachedCount: 0, detachedEnrollments: [] as any[] };
      }

      protectedTrialEnrollmentIds = new Set(
        (trialPlacements || []).map((placement: any) => String(placement.enrollment_id)),
      );
    }
  }

  let liveEnrollments: any[] | null = null;
  let liveEnrollmentsError: any = null;
  {
    const initial = await supabase
      .from("parent_enrollments")
      .select("id, user_id, student_full_name, assigned_tutor_id, assigned_student_id, status, proposal_id, current_step, is_sandbox_account, parent_full_name, parent_email, student_grade, school_name, previous_tutoring, internet_access, parent_motivation")
      .eq("assigned_tutor_id", tutorId)
      .eq("is_sandbox_account", false);

    liveEnrollments = initial.data as any;
    liveEnrollmentsError = initial.error as any;
  }

  if (liveEnrollmentsError) {
    const message = String((liveEnrollmentsError as any)?.message || "").toLowerCase();
    const missingOptionalColumn =
      message.includes("assigned_student_id") ||
      message.includes("current_step") ||
      message.includes("proposal_id") ||
      message.includes("is_sandbox_account");

    if (missingOptionalColumn) {
      const fallback = await supabase
        .from("parent_enrollments")
        .select("id, user_id, student_full_name, assigned_tutor_id, status, parent_full_name, parent_email, student_grade, school_name, previous_tutoring, internet_access, parent_motivation")
        .eq("assigned_tutor_id", tutorId);

      liveEnrollments = (fallback.data || []).filter(
        (enrollment: any) =>
          !Boolean(enrollment?.is_sandbox_account) && !isHeuristicSandboxEnrollment(enrollment, tutorId)
      );
      liveEnrollmentsError = fallback.error as any;
    }
  }

  if (liveEnrollmentsError) {
    throw new Error(`Failed to load live enrollments for tutor cleanup: ${liveEnrollmentsError.message}`);
  }

  const detachedEnrollments: any[] = [];
  for (const enrollment of liveEnrollments || []) {
    if (certificationMode === "trial" && protectedTrialEnrollmentIds.has(String(enrollment.id))) {
      continue;
    }
    await safelyUnassignEnrollmentFromTutor(enrollment, tutorId);
    detachedEnrollments.push(enrollment);
  }

  return { detachedCount: detachedEnrollments.length, detachedEnrollments };
}
