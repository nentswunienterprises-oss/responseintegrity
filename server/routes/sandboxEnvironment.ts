import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  getSandboxEnvironmentHistory,
  prepareSandboxEnvironment,
  submitSandboxEnvironmentRep,
} from "../sandboxEnvironment";
import {
  prepareSandboxRediagnosis,
  submitSandboxRediagnosisProbe,
} from "../sandboxRediagnosis";

const evidenceStatusSchema = z.enum(["observed", "not_observed", "confounded"]);

const repSubmissionSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
  trajectoryId: z.string().trim().min(1),
  eventSequence: z.number().int().positive(),
  eventFormId: z.string().trim().min(1),
  submission: z.object({
    interventionEvent: z.enum([
      "none",
      "neutral_clarification",
      "first_step_confirmation",
      "method_or_step_prompt",
      "full_rescue_or_teaching",
      "timer_changed",
    ]),
    observations: z.record(z.object({
      optionId: z.string().trim().min(1),
      evidenceStatus: evidenceStatusSchema.optional(),
    })),
    prerequisiteSentinel: z.enum([
      "held",
      "contradicted",
      "not_observed",
      "confounded",
    ]).optional(),
    inheritedRescueSignal: z.enum([
      "none",
      "isolated",
      "repeated",
      "not_observed",
      "confounded",
    ]).optional(),
  }),
});


const rediagnosisSubmissionSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
  trajectoryId: z.string().trim().min(1),
  rediagnosisRunId: z.string().trim().min(1),
  sequenceNumber: z.number().int().positive(),
  turnFormId: z.string().trim().min(1),
  submission: z.object({
    probeId: z.enum([
      "stack.timed_challenge",
      "stack.challenge_no_timer",
      "stack.normal_independent",
      "clarity.recognition",
      "execution.repeatability",
      "difficulty.recovery",
      "time.consistency",
    ]),
    supportEvent: z.enum([
      "none",
      "neutral_clarification",
      "first_step_confirmation",
      "teaching",
    ]),
    observations: z.array(z.object({
      dimensionId: z.string().trim().min(1),
      behaviorId: z.string().trim().min(1),
    })).min(1),
  }),
});

function requireSpecialist(req: Request, res: Response) {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(dbUser.role || "").toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return dbUser;
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Invalid Sandbox environment submission.", issues: error.issues });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  return res.status(status).json({ message });
}

export function registerSandboxEnvironmentRoutes(app: Express) {
  app.get("/api/tutor/sandbox-environment", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      const studentId = String(req.query.studentId || "").trim();
      if (!tutorAssignmentId || !studentId) {
        return res.status(400).json({ message: "tutorAssignmentId and studentId are required." });
      }
      const environment = await prepareSandboxEnvironment({
        tutorAssignmentId,
        tutorId: String(user.id),
        studentId,
      });
      if (environment.status === "targeted_rediagnosis_required") {
        const rediagnosis = await prepareSandboxRediagnosis({
          tutorAssignmentId,
          tutorId: String(user.id),
          studentId,
        });
        return res.json({
          ...environment,
          ...rediagnosis,
          bankKey: environment.bankKey,
          bankVersion: environment.bankVersion,
          bankTitle: environment.bankTitle,
          readiness: environment.readiness,
        });
      }
      return res.json(environment);
    } catch (error) {
      return sendError(res, error, "Failed to prepare the Sandbox environment.");
    }
  });

  app.post("/api/tutor/sandbox-environment/rep", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const payload = repSubmissionSchema.parse(req.body);
      const result = await submitSandboxEnvironmentRep({
        tutorAssignmentId: payload.tutorAssignmentId,
        tutorId: String(user.id),
        studentId: payload.studentId,
        bankVersion: payload.bankVersion,
        trajectoryId: payload.trajectoryId,
        eventSequence: payload.eventSequence,
        eventFormId: payload.eventFormId,
        submission: payload.submission,
      });
      return res.status(201).json(result);
    } catch (error) {
      return sendError(res, error, "Failed to save Sandbox rep evidence.");
    }
  });


  app.post("/api/tutor/sandbox-environment/rediagnosis", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const payload = rediagnosisSubmissionSchema.parse(req.body);
      const result = await submitSandboxRediagnosisProbe({
        tutorAssignmentId: payload.tutorAssignmentId,
        tutorId: String(user.id),
        studentId: payload.studentId,
        bankVersion: payload.bankVersion,
        trajectoryId: payload.trajectoryId,
        rediagnosisRunId: payload.rediagnosisRunId,
        sequenceNumber: payload.sequenceNumber,
        turnFormId: payload.turnFormId,
        submission: {
          probeId: payload.submission.probeId,
          supportEvent: payload.submission.supportEvent,
          observations: payload.submission.observations as any,
        },
      });
      return res.status(201).json(result);
    } catch (error) {
      return sendError(res, error, "Failed to save Sandbox targeted re-diagnosis evidence.");
    }
  });

  app.get("/api/tutor/sandbox-environment/history", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      const studentId = String(req.query.studentId || "").trim();
      if (!tutorAssignmentId || !studentId) {
        return res.status(400).json({ message: "tutorAssignmentId and studentId are required." });
      }
      return res.json(await getSandboxEnvironmentHistory({
        tutorAssignmentId,
        tutorId: String(user.id),
        studentId,
      }));
    } catch (error) {
      return sendError(res, error, "Failed to load Sandbox environment history.");
    }
  });
}
