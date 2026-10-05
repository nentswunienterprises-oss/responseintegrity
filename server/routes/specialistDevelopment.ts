import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { pool } from "../db";
import { getSpecialistCapabilityTrainingState } from "../capabilitySequencing";
import { getSandboxCapabilityReadiness } from "../sandboxEnvironment";
import { getLatestSandboxReadinessAssessment } from "../sandboxReadiness";
import { getSpecialistDevelopmentPathway } from "../specialistDevelopmentPathway";
import { getTrialCaseById } from "../trialCertification";

function isMissingSpecialistDevelopmentPathwayTable(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate?.code || "").trim().toUpperCase();
  const message = String(candidate?.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    (message.includes("specialist_development_pathways") &&
      message.includes("schema cache"))
  );
}

async function loadPathwayForDevelopmentRecord(tutorId: string) {
  try {
    return await getSpecialistDevelopmentPathway(tutorId);
  } catch (error) {
    if (isMissingSpecialistDevelopmentPathwayTable(error)) return null;
    throw error;
  }
}

function requireTd(req: Request, res: Response) {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(dbUser.role || "").toLowerCase() !== "td") {
    res.status(403).json({ message: "TD access required." });
    return null;
  }
  return dbUser;
}

function requireCoo(req: Request, res: Response) {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(dbUser.role || "").toLowerCase() !== "coo") {
    res.status(403).json({ message: "COO access required." });
    return null;
  }
  return dbUser;
}

function parseDocumentStatuses(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function documentsComplete(row: any) {
  const direct = [
    row?.doc_1_submission_verified,
    row?.doc_2_submission_verified,
    row?.doc_3_submission_verified,
    row?.doc_4_submission_verified,
    row?.doc_5_submission_verified,
    row?.doc_6_submission_verified,
  ].every(Boolean);
  if (direct) return true;
  const statuses = parseDocumentStatuses(row?.documents_status);
  return ["1", "2", "3", "4", "5", "6"].every(
    (step) => String(statuses[step] || "").trim().toLowerCase() === "approved",
  );
}

function deriveCurrentStage(input: {
  operationalMode: string;
  latestSandboxDecision?: string | null;
  trial: any | null;
}) {
  const mode = String(input.operationalMode || "").trim().toLowerCase();

  if (
    mode === "certified_live" ||
    input.trial?.certificationDecision?.decision === "certified"
  ) {
    return "certified_live";
  }

  if (input.trial) {
    if (
      input.trial.gate?.reviewable ||
      input.trial.status === "reviewable"
    ) {
      return "certification";
    }
    return "trial";
  }

  if (
    mode === "sandbox" &&
    String(input.latestSandboxDecision || "").toLowerCase() === "passed"
  ) {
    return "practicals";
  }

  if (mode === "sandbox") return "sandbox";
  if (mode === "trial") return "trial";
  if (mode === "training") return "training";
  return "application";
}

function stageSummary(assessments: any[], stage: string) {
  const rows = assessments.filter((assessment) => assessment.stage === stage);
  return {
    complete: rows.filter((assessment) => assessment.status === "complete").length,
    total: rows.length,
  };
}

async function loadDevelopmentSummaryForAssignment(assignment: any) {
  const tutorId = String(assignment.tutor_id);
  const assignmentId = String(assignment.id);
  const [pathway, latestSandboxAssessment, trialIdResult] = await Promise.all([
    loadPathwayForDevelopmentRecord(tutorId),
    getLatestSandboxReadinessAssessment(assignmentId),
    pool.query(
      `SELECT id
         FROM public.tutor_trial_cases
        WHERE tutor_id = $1
        ORDER BY started_at DESC
        LIMIT 1`,
      [tutorId],
    ),
  ]);

  const trialId = trialIdResult.rows[0]?.id
    ? String(trialIdResult.rows[0].id)
    : null;
  const trial = trialId ? await getTrialCaseById(trialId) : null;
  const currentStage = deriveCurrentStage({
    operationalMode: String(assignment.operational_mode || ""),
    latestSandboxDecision: latestSandboxAssessment?.decision || null,
    trial,
  });

  return [
    tutorId,
    {
      currentStage,
      assignment: {
        operationalMode: String(assignment.operational_mode || ""),
        certificationStatus: String(assignment.certification_status || ""),
      },
      pathway: pathway
        ? {
            status: pathway.status,
            timeline: pathway.timeline,
          }
        : null,
    },
  ] as const;
}

async function loadPodDevelopmentSummaries(podId: string) {
  const assignmentsResult = await pool.query(
    `SELECT id,
            tutor_id,
            operational_mode,
            certification_status
       FROM public.tutor_assignments
      WHERE pod_id = $1
      ORDER BY created_at ASC`,
    [podId],
  );

  const summaries = await Promise.all(
    assignmentsResult.rows.map(loadDevelopmentSummaryForAssignment),
  );
  return Object.fromEntries(summaries);
}

async function loadSpecialistDevelopmentRecordPayload(tutorId: string) {
  const assignmentResult = await pool.query(
    `SELECT ta.id,
            ta.tutor_id,
            ta.pod_id,
            ta.operational_mode,
            ta.certification_status,
            ta.created_at,
            u.name,
            u.email,
            u.first_name,
            u.last_name,
            p.pod_name,
            p.td_id
       FROM public.tutor_assignments ta
       JOIN public.users u ON u.id = ta.tutor_id
       JOIN public.pods p ON p.id = ta.pod_id
      WHERE ta.tutor_id = $1
      ORDER BY ta.created_at DESC
      LIMIT 1`,
    [tutorId],
  );

  const assignment = assignmentResult.rows[0];
  if (!assignment) return null;

  const applicationResult = await pool.query(
    `SELECT id,
            status,
            reviewed_at,
            onboarding_completed_at,
            documents_status,
            doc_1_submission_verified,
            doc_2_submission_verified,
            doc_3_submission_verified,
            doc_4_submission_verified,
            doc_5_submission_verified,
            doc_6_submission_verified,
            created_at
       FROM public.tutor_applications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [tutorId],
  );
  const applicationRow = applicationResult.rows[0] || null;

  const [pathway, trainingState, sandboxReadiness, latestSandboxAssessment] =
    await Promise.all([
      loadPathwayForDevelopmentRecord(tutorId),
      getSpecialistCapabilityTrainingState({
        tutorAssignmentId: String(assignment.id),
        tutorId,
      }),
      getSandboxCapabilityReadiness({
        tutorAssignmentId: String(assignment.id),
        tutorId,
      }),
      getLatestSandboxReadinessAssessment(String(assignment.id)),
    ]);

  const latestAttemptsResult = await pool.query(
    `SELECT DISTINCT ON (assessment_key)
            assessment_key,
            bank_version,
            attempt_number,
            total_questions,
            correct_questions,
            percent,
            has_critical_fail,
            passed,
            completed_at
       FROM public.specialist_capability_assessment_attempts
      WHERE tutor_assignment_id = $1
        AND tutor_id = $2
      ORDER BY assessment_key, completed_at DESC`,
    [String(assignment.id), tutorId],
  );
  const latestAttemptByKey = Object.fromEntries(
    latestAttemptsResult.rows.map((row) => [
      String(row.assessment_key),
      {
        bankVersion: Number(row.bank_version),
        attemptNumber: Number(row.attempt_number),
        totalQuestions: Number(row.total_questions),
        correctQuestions: Number(row.correct_questions),
        percent: Number(row.percent),
        hasCriticalFail: Boolean(row.has_critical_fail),
        passed: Boolean(row.passed),
        completedAt: row.completed_at ? String(row.completed_at) : null,
      },
    ]),
  );

  const trialIdResult = await pool.query(
    `SELECT id
       FROM public.tutor_trial_cases
      WHERE tutor_id = $1
      ORDER BY started_at DESC
      LIMIT 1`,
    [tutorId],
  );
  const trialId = trialIdResult.rows[0]?.id
    ? String(trialIdResult.rows[0].id)
    : null;
  const trial = trialId ? await getTrialCaseById(trialId) : null;

  const certificationResult = await pool.query(
    `SELECT mode, updated_at, last_synced_at
       FROM public.tutor_portable_certification_snapshots
      WHERE tutor_id = $1
      LIMIT 1`,
    [tutorId],
  );
  const certificationRow = certificationResult.rows[0] || null;

  const assessments = trainingState.assessments.map((assessment) => ({
    ...assessment,
    latestAttempt:
      latestAttemptByKey[String(assessment.assessmentKey)] || null,
  }));

  const currentStage = deriveCurrentStage({
    operationalMode: String(assignment.operational_mode || ""),
    latestSandboxDecision: latestSandboxAssessment?.decision || null,
    trial,
  });

  return {
    tdId: String(assignment.td_id || ""),
    payload: {
      specialist: {
        id: tutorId,
        name:
          String(assignment.name || "").trim() ||
          [assignment.first_name, assignment.last_name]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .join(" ") ||
          "Specialist",
        email: String(assignment.email || ""),
      },
      assignment: {
        id: String(assignment.id),
        podId: String(assignment.pod_id),
        podName: String(assignment.pod_name || "Pod"),
        operationalMode: String(assignment.operational_mode || "training"),
        certificationStatus: String(assignment.certification_status || "pending"),
        createdAt: assignment.created_at ? String(assignment.created_at) : null,
      },
      currentStage,
      pathway,
      application: applicationRow
        ? {
            id: String(applicationRow.id),
            status: String(applicationRow.status || "pending"),
            reviewedAt: applicationRow.reviewed_at
              ? String(applicationRow.reviewed_at)
              : null,
            onboardingCompletedAt: applicationRow.onboarding_completed_at
              ? String(applicationRow.onboarding_completed_at)
              : null,
            documentsComplete: documentsComplete(applicationRow),
            createdAt: applicationRow.created_at
              ? String(applicationRow.created_at)
              : null,
          }
        : null,
      training: {
        sandboxReady: trainingState.sandboxReady,
        assessments,
        summary: {
          transformation: stageSummary(assessments, "transformation_mastery"),
          cumulative: {
            complete: assessments.filter(
              (assessment) =>
                (assessment.stage === "transformation_retrieval" ||
                  assessment.stage === "transformation_transfer") &&
                assessment.status === "complete",
            ).length,
            total: assessments.filter(
              (assessment) =>
                assessment.stage === "transformation_retrieval" ||
                assessment.stage === "transformation_transfer",
            ).length,
          },
          executionStandards: stageSummary(
            assessments,
            "execution_standards_mastery",
          ),
          systemIntelligence: stageSummary(
            assessments,
            "system_intelligence_mastery",
          ),
          sessionInfrastructure: stageSummary(
            assessments,
            "session_infrastructure_mastery",
          ),
        },
      },
      sandbox: {
        readiness: sandboxReadiness,
        latestAssessment: latestSandboxAssessment,
      },
      trial,
      certification: certificationRow
        ? {
            mode: String(certificationRow.mode || ""),
            updatedAt: certificationRow.updated_at
              ? String(certificationRow.updated_at)
              : null,
            lastSyncedAt: certificationRow.last_synced_at
              ? String(certificationRow.last_synced_at)
              : null,
          }
        : null,
    },
  };
}

export function registerSpecialistDevelopmentRoutes(app: Express) {
  app.get(
    "/api/td/pods/:podId/specialist-development-summaries",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const td = requireTd(req, res);
        if (!td) return;

        const podId = String(req.params.podId || "").trim();
        if (!podId) {
          return res.status(400).json({ message: "podId is required." });
        }

        const podResult = await pool.query(
          `SELECT td_id
             FROM public.pods
            WHERE id = $1
            LIMIT 1`,
          [podId],
        );
        const pod = podResult.rows[0];
        if (!pod) {
          return res.status(404).json({ message: "Pod not found." });
        }
        if (String(pod.td_id || "") !== String(td.id)) {
          return res.status(403).json({ message: "This Pod is not assigned to you." });
        }

        const summaries = await loadPodDevelopmentSummaries(podId);
        return res.json(summaries);
      } catch (error: any) {
        console.error("Failed to load Specialist development summaries:", error);
        return res.status(500).json({
          message: error?.message || "Failed to load Specialist development summaries.",
        });
      }
    },
  );

  app.get(
    "/api/coo/pods/:podId/specialist-development-summaries",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const coo = requireCoo(req, res);
        if (!coo) return;

        const podId = String(req.params.podId || "").trim();
        if (!podId) {
          return res.status(400).json({ message: "podId is required." });
        }

        const podResult = await pool.query(
          `SELECT id
             FROM public.pods
            WHERE id = $1
            LIMIT 1`,
          [podId],
        );
        if (!podResult.rows[0]) {
          return res.status(404).json({ message: "Pod not found." });
        }

        const summaries = await loadPodDevelopmentSummaries(podId);
        return res.json(summaries);
      } catch (error: any) {
        console.error("Failed to load COO Specialist development summaries:", error);
        return res.status(500).json({
          message: error?.message || "Failed to load Specialist development summaries.",
        });
      }
    },
  );

  app.get(
    "/api/td/tutors/:tutorId/development-record",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const td = requireTd(req, res);
        if (!td) return;

        const tutorId = String(req.params.tutorId || "").trim();
        if (!tutorId) {
          return res.status(400).json({ message: "tutorId is required." });
        }

        const record = await loadSpecialistDevelopmentRecordPayload(tutorId);
        if (!record) {
          return res.status(404).json({ message: "Specialist assignment not found." });
        }
        if (record.tdId !== String(td.id)) {
          return res.status(403).json({ message: "This Specialist is not assigned to your Pod." });
        }

        return res.json(record.payload);
      } catch (error) {
        console.error("Failed to load Specialist development record", error);
        const status = Number((error as any)?.status || 500);
        return res.status(status).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Specialist development record.",
        });
      }
    },
  );

  app.get(
    "/api/coo/tutors/:tutorId/development-record",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const coo = requireCoo(req, res);
        if (!coo) return;

        const tutorId = String(req.params.tutorId || "").trim();
        if (!tutorId) {
          return res.status(400).json({ message: "tutorId is required." });
        }

        const record = await loadSpecialistDevelopmentRecordPayload(tutorId);
        if (!record) {
          return res.status(404).json({ message: "Specialist assignment not found." });
        }

        return res.json(record.payload);
      } catch (error) {
        console.error("Failed to load COO Specialist development record", error);
        const status = Number((error as any)?.status || 500);
        return res.status(status).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to load Specialist development record.",
        });
      }
    },
  );
}
