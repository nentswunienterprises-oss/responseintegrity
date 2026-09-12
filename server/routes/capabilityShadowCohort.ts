import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { buildPersistedShadowCohortReview } from "../capabilityShadowCohort";

function requireAuthenticatedReviewer(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  return user;
}

function respondError(res: Response, error: unknown) {
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error
    ? error.message
    : "Failed to build the Capability Engine shadow cohort review.";
  return res.status(status).json({ message });
}

export function registerCapabilityShadowCohortRoutes(app: Express) {
  app.get(
    "/api/capability-review/shadow-cohort",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireAuthenticatedReviewer(req, res);
        if (!user) return;

        const cohort = await buildPersistedShadowCohortReview({
          reviewerId: String(user.id),
          reviewerRole: String(user.role || ""),
        });
        return res.json({ cohort });
      } catch (error) {
        return respondError(res, error);
      }
    },
  );
}
