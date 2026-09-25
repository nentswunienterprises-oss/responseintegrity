import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  getSandboxGraduationStatus,
  getSandboxSimulationHistory,
  persistSandboxSimulationAttempt,
  prepareSandboxSimulation,
} from "../sandboxSimulation";

const fieldSchema = z.object({
  optionId: z.string().trim().min(1),
  evidenceStatus: z.enum(["observed", "not_observed", "confounded"]).optional(),
});

const submissionSchema = z.object({
  sets: z.array(z.object({
    setId: z.string().trim().min(1),
    reps: z.array(z.object({
      repNumber: z.number().int().positive(),
      observations: z.record(fieldSchema),
    })).min(1),
  })).min(1),
});

const attemptSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
  scenarioFormId: z.string().trim().min(1),
  submission: submissionSchema,
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
    return res.status(400).json({ message: "Invalid Sandbox submission.", issues: error.issues });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  return res.status(status).json({ message });
}

export function registerSandboxSimulationRoutes(app: Express) {
  app.get("/api/tutor/sandbox-simulation", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      if (!tutorAssignmentId) {
        return res.status(400).json({ message: "tutorAssignmentId is required." });
      }
      return res.json(await prepareSandboxSimulation({
        tutorAssignmentId,
        tutorId: String(user.id),
      }));
    } catch (error) {
      return sendError(res, error, "Failed to prepare Sandbox simulation.");
    }
  });

  app.post("/api/tutor/sandbox-simulation/attempt", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const payload = attemptSchema.parse(req.body);
      const result = await persistSandboxSimulationAttempt({
        tutorAssignmentId: payload.tutorAssignmentId,
        tutorId: String(user.id),
        bankVersion: payload.bankVersion,
        scenarioFormId: payload.scenarioFormId,
        submission: payload.submission,
      });
      return res.status(201).json(result);
    } catch (error) {
      return sendError(res, error, "Failed to save Sandbox simulation attempt.");
    }
  });

  app.get("/api/tutor/sandbox-simulation/graduation", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      if (!tutorAssignmentId) {
        return res.status(400).json({ message: "tutorAssignmentId is required." });
      }
      return res.json(await getSandboxGraduationStatus({
        tutorAssignmentId,
        tutorId: String(user.id),
      }));
    } catch (error) {
      return sendError(res, error, "Failed to load Sandbox graduation status.");
    }
  });

  app.get("/api/tutor/sandbox-simulation/history", isAuthenticated, async (req, res) => {
    try {
      const user = requireSpecialist(req, res);
      if (!user) return;
      const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
      if (!tutorAssignmentId) {
        return res.status(400).json({ message: "tutorAssignmentId is required." });
      }
      return res.json({
        attempts: await getSandboxSimulationHistory({
          tutorAssignmentId,
          tutorId: String(user.id),
        }),
      });
    } catch (error) {
      return sendError(res, error, "Failed to load Sandbox simulation history.");
    }
  });
}
