import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  buildOralDefenseBrief,
  completeOralDefense,
  getSpecialistOralDefenseStatus,
} from "../capabilityOralDefense";
import {
  assertCapabilityTutorAssignmentOwnership,
  getFoundationCapabilityReadiness,
} from "../capabilityReadiness";

const oralProbeSchema = z.object({
  focusKey: z.string().trim().min(1),
  deepDiveKey: z.string().trim().min(1),
  scenarioSummary: z.string().trim().min(30),
  observedResponseSummary: z.string().trim().min(30),
  judgment: z.enum(["clear", "partial", "fail"]),
  integrityConcern: z.boolean(),
});

const completeDefenseSchema = z.object({
  defenseVersion: z.number().int().positive(),
  probes: z.array(oralProbeSchema).min(3).max(5),
  feedback: z.string().trim().max(4000).optional().nullable(),
  sandboxScenarioConfirmed: z.literal(true),
});

function requireSpecialist(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(user.role || "").toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return user;
}

function requireReviewer(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  const role = String(user.role || "").toLowerCase();
  if (!new Set(["td", "coo", "hr"]).has(role)) {
    res.status(403).json({ message: "Capability review access is restricted." });
    return null;
  }
  return { ...user, role };
}

function respondError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Invalid oral defense request.", issues: error.issues });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  const data = (error as any)?.data;
  return res.status(status).json(data ? { message, ...data } : { message });
}

export function registerCapabilityOralDefenseRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-readiness",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        await assertCapabilityTutorAssignmentOwnership(tutorAssignmentId, String(user.id));
        const readiness = await getFoundationCapabilityReadiness(tutorAssignmentId);
        return res.json({ readiness });
      } catch (error) {
        return respondError(res, error, "Failed to load capability readiness.");
      }
    },
  );

  app.get(
    "/api/tutor/capability-oral-defense",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const defense = await getSpecialistOralDefenseStatus({
          tutorAssignmentId,
          tutorId: String(user.id),
        });
        return res.json({ defense });
      } catch (error) {
        return respondError(res, error, "Failed to load Oral Integrity Defense status.");
      }
    },
  );

  app.get(
    "/api/capability-review/oral-defense/:tutorAssignmentId/brief",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;

        const brief = await buildOralDefenseBrief({
          tutorAssignmentId: String(req.params.tutorAssignmentId || "").trim(),
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
        });
        return res.json({ brief });
      } catch (error) {
        return respondError(res, error, "Failed to build Oral Integrity Defense brief.");
      }
    },
  );

  app.post(
    "/api/capability-review/oral-defense/:tutorAssignmentId/complete",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;
        const payload = completeDefenseSchema.parse(req.body);

        const result = await completeOralDefense({
          tutorAssignmentId: String(req.params.tutorAssignmentId || "").trim(),
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
          defenseVersion: payload.defenseVersion,
          probes: payload.probes,
          feedback: payload.feedback,
          sandboxScenarioConfirmed: payload.sandboxScenarioConfirmed,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to record Oral Integrity Defense.");
      }
    },
  );
}
