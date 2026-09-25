import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  getSandboxEnvironmentHistory,
  prepareSandboxEnvironment,
  submitSandboxEnvironmentRep,
} from "../sandboxEnvironment";

const evidenceStatusSchema = z.enum(["observed", "not_observed", "confounded"]);

const repSubmissionSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
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
      if (!tutorAssignmentId) {
        return res.status(400).json({ message: "tutorAssignmentId is required." });
      }
      return res.json(await prepareSandboxEnvironment({
        tutorAssignmentId,
        tutorId: String(user.id),
      }));
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

  app.get("/api/tutor/sandbox-environment/history", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      if (!tutorAssignmentId) {
        return res.status(400).json({ message: "tutorAssignmentId is required." });
      }
      return res.json(await getSandboxEnvironmentHistory({
        tutorAssignmentId,
        tutorId: String(user.id),
      }));
    } catch (error) {
      return sendError(res, error, "Failed to load Sandbox environment history.");
    }
  });
}
