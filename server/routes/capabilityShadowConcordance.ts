import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { buildPersistedShadowConcordanceSnapshot } from "../capabilityShadowConcordance";

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
    : "Failed to build the Capability Engine shadow concordance snapshot.";
  return res.status(status).json({ message });
}

export function registerCapabilityShadowConcordanceRoutes(app: Express) {
  app.get(
    "/api/capability-review/shadow-concordance/:tutorAssignmentId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireAuthenticatedReviewer(req, res);
        if (!user) return;
        const tutorAssignmentId = String(req.params.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const snapshot = await buildPersistedShadowConcordanceSnapshot({
          tutorAssignmentId,
          reviewerId: String(user.id),
          reviewerRole: String(user.role || ""),
        });
        return res.json({ snapshot });
      } catch (error) {
        return respondError(res, error);
      }
    },
  );
}
