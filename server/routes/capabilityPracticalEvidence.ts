import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  buildPublicPracticalDefinitions,
  getPracticalReviewQueue,
  getSpecialistPracticalEvidence,
  reviewPracticalCapabilityEvidence,
  submitPracticalCapabilityEvidence,
} from "../capabilityPracticalEvidence";

const practicalSubmissionSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  proofVersion: z.number().int().positive(),
  artifactUrl: z.string().trim().url(),
  artifactType: z.enum(["screen_voice", "screen_video", "video"]),
  declaration: z.record(z.string(), z.unknown()),
  noRealStudentDataConfirmed: z.literal(true),
});

const practicalReviewSchema = z.object({
  outcome: z.enum(["approved", "repeat_required", "integrity_review"]),
  reasonCode: z.string().trim().max(100).optional().nullable(),
  feedback: z.string().trim().max(4000).optional().nullable(),
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
    res.status(403).json({ message: "Capability practical review access is restricted." });
    return null;
  }
  return { ...user, role };
}

function respondError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Invalid practical capability request.", issues: error.issues });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  return res.status(status).json({ message });
}

export function registerCapabilityPracticalEvidenceRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-practicals",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const evidence = await getSpecialistPracticalEvidence({
          tutorAssignmentId,
          tutorId: String(user.id),
        });

        return res.json({
          proofs: buildPublicPracticalDefinitions(),
          evidence,
        });
      } catch (error) {
        return respondError(res, error, "Failed to load practical capability evidence.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-practicals/:proofKey",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const payload = practicalSubmissionSchema.parse(req.body);

        const result = await submitPracticalCapabilityEvidence({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(user.id),
          proofKey: String(req.params.proofKey || "").trim(),
          proofVersion: payload.proofVersion,
          artifactUrl: payload.artifactUrl,
          artifactType: payload.artifactType,
          declaration: payload.declaration,
          noRealStudentDataConfirmed: payload.noRealStudentDataConfirmed,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to submit practical capability evidence.");
      }
    },
  );

  app.get(
    "/api/capability-review/practicals/pending",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;
        const queue = await getPracticalReviewQueue({
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
        });
        return res.json({ queue });
      } catch (error) {
        return respondError(res, error, "Failed to load practical capability review queue.");
      }
    },
  );

  app.post(
    "/api/capability-review/practicals/:evidenceId/review",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;
        const payload = practicalReviewSchema.parse(req.body);

        const result = await reviewPracticalCapabilityEvidence({
          evidenceId: String(req.params.evidenceId || "").trim(),
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
          outcome: payload.outcome,
          reasonCode: payload.reasonCode,
          feedback: payload.feedback,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to review practical capability evidence.");
      }
    },
  );
}
