import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  getCapabilityAssessmentHistory,
  getSpecialistCapabilityLedger,
  persistCapabilityAssessmentAttempt,
  prepareCapabilityAssessmentForm,
} from "../capabilityEngine";
import {
  assertCapabilityAssessmentAvailable,
  getSpecialistCapabilityPlanStatus,
} from "../capabilitySequencing";

const capabilityResponseSchema = z.object({
  questionKey: z.string().trim().min(1),
  selectedOptionKeys: z.array(z.string().trim().min(1)).min(1),
});

const capabilityAttemptSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  formId: z.string().trim().min(1),
  bankVersion: z.number().int().positive(),
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

function respondError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid capability assessment attempt.",
      issues: error.issues,
    });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  const data = (error as any)?.data;
  return res.status(status).json(data ? { message, ...data } : { message });
}

export function registerCapabilityEngineRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-plan",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const assessments = await getSpecialistCapabilityPlanStatus({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
        });
        return res.json({ assessments });
      } catch (error) {
        return respondError(res, error, "Failed to load capability assessment plan.");
      }
    },
  );

  app.get(
    "/api/tutor/capability-assessments/:assessmentKey",
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

        await assertCapabilityAssessmentAvailable({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
        });

        const form = await prepareCapabilityAssessmentForm({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
        });

        return res.json(form);
      } catch (error) {
        return respondError(res, error, "Failed to prepare capability assessment.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-assessments/:assessmentKey/attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const payload = capabilityAttemptSchema.parse(req.body);
        const assessmentKey = String(req.params.assessmentKey || "").trim();

        await assertCapabilityAssessmentAvailable({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
        });

        const result = await persistCapabilityAssessmentAttempt({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
          formId: payload.formId,
          bankVersion: payload.bankVersion,
          responses: payload.responses.map((response) => ({
            questionKey: response.questionKey!,
            selectedOptionKeys: response.selectedOptionKeys!,
          })),
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to save capability assessment attempt.");
      }
    },
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

        const attempts = await getCapabilityAssessmentHistory({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey: String(req.params.assessmentKey || "").trim(),
        });

        return res.json({ attempts });
      } catch (error) {
        return respondError(res, error, "Failed to load capability assessment history.");
      }
    },
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
        return respondError(res, error, "Failed to load capability ledger.");
      }
    },
  );
}
