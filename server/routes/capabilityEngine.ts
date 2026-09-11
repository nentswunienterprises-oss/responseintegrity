import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  buildPublicCapabilityAssessment,
  getCapabilityAssessmentDefinition,
  getCapabilityAssessmentHistory,
  getSpecialistCapabilityLedger,
  persistCapabilityAssessmentAttempt,
} from "../capabilityEngine";

const capabilityResponseSchema = z.object({
  questionKey: z.string().trim().min(1),
  selectedOptionKeys: z.array(z.string().trim().min(1)).min(1),
});

const capabilityAttemptSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  responses: z.array(capabilityResponseSchema).min(1),
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

export function registerCapabilityEngineRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-assessments/:assessmentKey",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const dbUser = requireSpecialistUser(req, res);
      if (!dbUser) return;

      const definition = getCapabilityAssessmentDefinition(String(req.params.assessmentKey || ""));
      if (!definition) {
        return res.status(404).json({ message: "Unknown capability assessment." });
      }

      return res.json(buildPublicCapabilityAssessment(definition));
    }
  );

  app.post(
    "/api/tutor/capability-assessments/:assessmentKey/attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const payload = capabilityAttemptSchema.parse(req.body);
        const result = await persistCapabilityAssessmentAttempt({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey: String(req.params.assessmentKey || ""),
          responses: payload.responses,
        });

        return res.status(201).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid capability assessment attempt.",
            issues: error.issues,
          });
        }

        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to save capability assessment attempt.";
        return res.status(status).json({ message });
      }
    }
  );

  app.get(
    "/api/tutor/capability-assessments/:assessmentKey/history",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const assessmentKey = String(req.params.assessmentKey || "").trim();
        if (!getCapabilityAssessmentDefinition(assessmentKey)) {
          return res.status(404).json({ message: "Unknown capability assessment." });
        }

        const attempts = await getCapabilityAssessmentHistory({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
        });

        return res.json({ attempts });
      } catch (error) {
        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to load capability assessment history.";
        return res.status(status).json({ message });
      }
    }
  );

  app.get(
    "/api/tutor/capability-ledger",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const ledger = await getSpecialistCapabilityLedger({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
        });

        return res.json({ ledger });
      } catch (error) {
        const status = Number((error as any)?.status || 500);
        const message = error instanceof Error ? error.message : "Failed to load capability ledger.";
        return res.status(status).json({ message });
      }
    }
  );
}
