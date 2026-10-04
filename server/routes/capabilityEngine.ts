import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import {
  confirmCapabilityQuestionStateless,
  getCapabilityAssessmentHistory,
  getSpecialistCapabilityLedger,
  persistCapabilityInteractiveAttempt,
  prepareCapabilityInteractiveAssessmentForm,
  resetCapabilityReviewSession,
  submitCapabilityExperienceFeedback,
} from "../capabilityEngine";
import {
  assertCapabilityAssessmentAvailable,
  getSpecialistCapabilityTrainingState,
  reconcileCapabilitySandboxAuthority,
} from "../capabilitySequencing";

const capabilityAttemptSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  interactionToken: z.string().trim().min(1),
  receipts: z.array(z.string().trim().min(1)).min(1),
});

const capabilityQuestionConfirmationSchema = z.object({
  interactionToken: z.string().trim().min(1),
  priorReceipts: z.array(z.string().trim().min(1)).default([]),
  questionKey: z.string().trim().min(1),
  selectedOptionKeys: z.array(z.string().trim().min(1)).min(1),
});

const capabilityExperienceFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

const capabilityReviewResetSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
});

const capabilityLifecycleProofSchema = z.object({
  tutorAssignmentId: z
    .string()
    .trim()
    .startsWith("proof-capability-lifecycle-"),
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

        const state = await getSpecialistCapabilityTrainingState({
          tutorAssignmentId,
          tutorId: String(dbUser.id),
        });
        return res.json(state);
      } catch (error) {
        return respondError(res, error, "Failed to load capability assessment plan.");
      }
    },
  );

  app.get(
    "/api/tutor/capability-proof/lifecycle",
    async (_req: Request, res: Response) => {
      try {
        if (process.env.VERCEL_ENV !== "preview") {
          return res.status(404).json({ message: "Not found." });
        }

        let proofProjectRef = "";
        try {
          proofProjectRef = new URL(String(process.env.SUPABASE_URL || "")).hostname.split(".")[0] || "";
        } catch {
          proofProjectRef = "";
        }
        if (proofProjectRef !== "jftlxeacphvbnhbsbpxc") {
          return res.status(404).json({ message: "Not found." });
        }

        const tutorId = "77977298-7ac9-41f9-a726-9d5fd634540f";
        const ids = {
          four: "proof-capability-lifecycle-four-20261004",
          spacing: "proof-capability-lifecycle-spacing-20261004",
          retrieval: "proof-capability-lifecycle-retrieval-20261004",
          transfer: "proof-capability-lifecycle-transfer-20261004",
          sandbox: "proof-capability-lifecycle-sandbox-20261004",
        } as const;

        const load = (tutorAssignmentId: string) =>
          getSpecialistCapabilityTrainingState({ tutorAssignmentId, tutorId });

        const [four, spacing, retrieval, transfer, beforeSandbox] = await Promise.all([
          load(ids.four),
          load(ids.spacing),
          load(ids.retrieval),
          load(ids.transfer),
          load(ids.sandbox),
        ]);

        const firstReconcile = await reconcileCapabilitySandboxAuthority({
          tutorAssignmentId: ids.sandbox,
          tutorId,
        });
        const secondReconcile = await reconcileCapabilitySandboxAuthority({
          tutorAssignmentId: ids.sandbox,
          tutorId,
        });
        const afterSandbox = await load(ids.sandbox);

        return res.json({
          proofProjectRef,
          fixtures: {
            four,
            spacing,
            retrieval,
            transfer,
            beforeSandbox,
            afterSandbox,
          },
          reconciliation: {
            first: firstReconcile,
            second: secondReconcile,
          },
        });
      } catch (error) {
        return respondError(res, error, "Failed to run Capability lifecycle proof.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-proof/reconcile-sandbox",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (process.env.VERCEL_ENV !== "preview") {
          return res.status(404).json({ message: "Not found." });
        }

        let proofProjectRef = "";
        try {
          proofProjectRef = new URL(String(process.env.SUPABASE_URL || "")).hostname.split(".")[0] || "";
        } catch {
          proofProjectRef = "";
        }
        if (proofProjectRef !== "jftlxeacphvbnhbsbpxc") {
          return res.status(404).json({ message: "Not found." });
        }

        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const payload = capabilityLifecycleProofSchema.parse(req.body);
        const result = await reconcileCapabilitySandboxAuthority({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
        });

        return res.json(result);
      } catch (error) {
        return respondError(res, error, "Failed to reconcile Capability Sandbox proof.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-assessments/:assessmentKey/review-reset",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const payload = capabilityReviewResetSchema.parse(req.body);
        const assessmentKey = String(req.params.assessmentKey || "").trim();

        const state = await resetCapabilityReviewSession({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
        });

        return res.json(state);
      } catch (error) {
        return respondError(res, error, "Failed to reset Capability review session.");
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

        const form = await prepareCapabilityInteractiveAssessmentForm({
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
    "/api/tutor/capability-assessments/:assessmentKey/question-confirmation",
    async (req: Request, res: Response) => {
      try {
        const payload = capabilityQuestionConfirmationSchema.parse(req.body);
        const assessmentKey = String(req.params.assessmentKey || "").trim();

        const result = confirmCapabilityQuestionStateless({
          assessmentKey,
          interactionToken: payload.interactionToken,
          priorReceipts: payload.priorReceipts,
          questionKey: payload.questionKey,
          selectedOptionKeys: payload.selectedOptionKeys,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to confirm Capability answer.");
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

        const result = await persistCapabilityInteractiveAttempt({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(dbUser.id),
          assessmentKey,
          interactionToken: payload.interactionToken,
          receipts: payload.receipts,
        });

        const progression = result.passed
          ? await reconcileCapabilitySandboxAuthority({
              tutorAssignmentId: payload.tutorAssignmentId,
              tutorId: String(dbUser.id),
            })
          : null;

        return res.status(201).json({
          ...result,
          sandboxReady: progression?.sandboxReady ?? false,
          operationalMode: progression?.mode ?? null,
          sandboxUnlocked: Boolean(progression?.promoted),
        });
      } catch (error) {
        return respondError(res, error, "Failed to save capability assessment attempt.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-attempts/:attemptId/feedback",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialistUser(req, res);
        if (!dbUser) return;

        const payload = capabilityExperienceFeedbackSchema.parse(req.body);
        const feedback = await submitCapabilityExperienceFeedback({
          attemptId: String(req.params.attemptId || "").trim(),
          tutorId: String(dbUser.id),
          rating: payload.rating,
          feedback: payload.feedback,
        });

        return res.status(201).json(feedback);
      } catch (error) {
        return respondError(res, error, "Failed to save Capability Check feedback.");
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
