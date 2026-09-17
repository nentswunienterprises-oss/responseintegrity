import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { buildCapabilityMockDossier } from "../capabilityMockDossier";

function requireCoo(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(user.role || "").toLowerCase() !== "coo") {
    res.status(403).json({ message: "Pre-Mock capability dossier access is restricted to the COO Mock reviewer surface." });
    return null;
  }
  return user;
}

function respondError(res: Response, error: unknown) {
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : "Failed to load the pre-Mock capability dossier.";
  return res.status(status).json({ message });
}

export function registerCapabilityMockDossierRoutes(app: Express) {
  app.get(
    "/api/coo/tutors/:tutorId/capability-dossier",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireCoo(req, res);
        if (!user) return;
        const tutorId = String(req.params.tutorId || "").trim();
        if (!tutorId) return res.status(400).json({ message: "tutorId is required." });

        const dossier = await buildCapabilityMockDossier({
          tutorId,
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
        });
        return res.json({ dossier });
      } catch (error) {
        return respondError(res, error);
      }
    },
  );
}
