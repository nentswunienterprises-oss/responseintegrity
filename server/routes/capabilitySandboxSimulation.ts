import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  getSandboxSimulationHistory,
  persistSandboxSimulationAttempt,
  prepareSandboxSimulation,
} from "../capabilitySandboxSimulation";

const simulationResponseSchema = z.object({
  decisionKey: z.string().trim().min(1),
  selectedOptionKeys: z.array(z.string().trim().min(1)).min(1),
});

const simulationAttemptSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
  simulationFormId: z.string().trim().min(1),
  responses: z.array(simulationResponseSchema).min(1),
});

function requireSpecialistUser(req: Request, res: Response) {
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

export function registerCapabilitySandboxSimulationRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-sandbox-simulation",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const simulation = await prepareSandboxSimulation({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
        });
        return res.json(simulation);
      } catch (error) {
        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to prepare Sandbox simulation.";
        return res.status(status).json({ message });
      }
    },
  );

  app.post(
    "/api/tutor/capability-sandbox-simulation/attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;
        const payload = simulationAttemptSchema.parse(req.body);
        const result = await persistSandboxSimulationAttempt({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          bankVersion: payload.bankVersion,
          simulationFormId: payload.simulationFormId,
          responses: payload.responses,
        });
        return res.status(201).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid Sandbox simulation attempt.",
            issues: error.issues,
          });
        }
        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to save Sandbox simulation attempt.";
        return res.status(status).json({ message });
      }
    },
  );

  app.get(
    "/api/tutor/capability-sandbox-simulation/history",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const attempts = await getSandboxSimulationHistory({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
        });
        return res.json({ attempts });
      } catch (error) {
        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to load Sandbox simulation history.";
        return res.status(status).json({ message });
      }
    },
  );
}
