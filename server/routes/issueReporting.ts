import type { Express, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { isAuthenticated } from "../supabaseAuth";
import { getIssueTeam, issueTeamsForRole, issueTeamsVisibleToRole } from "@shared/issueReporting";

const reportSchema = z.object({
  category: z.enum(["technical", "workflow", "service", "people", "other"]),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(12).max(3000),
  locationHint: z.string().trim().max(500).optional().default(""),
  impact: z.enum(["blocked", "affected", "informational"]),
  helpRequested: z.string().trim().max(1000).optional().default(""),
}).strict();

const statusSchema = z.object({
  status: z.enum(["in_progress", "resolved"]),
  note: z.string().trim().max(2000).optional().default(""),
}).strict();

function actor(req: Request) {
  const user = (req as any).dbUser;
  return user?.id ? { id: String(user.id), role: String(user.role || "") } : null;
}

function isValidDescription(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length <= 300;
}

function handleIssueError(res: Response, error: unknown) {
  console.error("Issue reporting operation failed:", error instanceof Error ? error.message : String(error));
  const code = (error as { code?: string })?.code;
  if (code === "42P01") {
    return res.status(503).json({ message: "Issue reporting is temporarily unavailable. Your report was not saved." });
  }
  return res.status(500).json({ message: "Issue reporting is temporarily unavailable. Please try again." });
}

export function registerIssueReportingRoutes(app: Express) {
  // All authors use the same neutral intake. Server assigns ownership, not the browser.
  app.post("/api/issues", isAuthenticated, async (req: Request, res: Response) => {
    const user = actor(req);
    if (!user) return res.status(401).json({ message: "Sign in to report an issue." });
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success || !isValidDescription(parsed.success ? parsed.data.description : "")) {
      return res.status(400).json({ message: "Provide a category, a short title, impact and a description of no more than 300 words." });
    }
    const input = parsed.data;
    const ownerTeam = getIssueTeam(input.category);
    try {
      const result = await pool.query(
        `INSERT INTO public.issue_reports
          (reported_by, category, owner_team, title, description, location_hint, impact, help_requested)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, status, owner_team AS "ownerTeam", created_at AS "createdAt"`,
        [user.id, input.category, ownerTeam, input.title, input.description,
          input.locationHint || null, input.impact, input.helpRequested || null],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      return handleIssueError(res, error);
    }
  });

  // The reporter can check their own status. No peer reports or staff-only notes.
  app.get("/api/issues/mine", isAuthenticated, async (req: Request, res: Response) => {
    const user = actor(req);
    if (!user) return res.status(401).json({ message: "Sign in to see your reports." });
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const result = await pool.query(
        `SELECT id, category, title, impact, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
           FROM public.issue_reports
          WHERE reported_by = $1
          ORDER BY created_at DESC
          LIMIT 30`,
        [user.id],
      );
      res.json({ items: result.rows });
    } catch (error) {
      return handleIssueError(res, error);
    }
  });

  app.get("/api/issues/inbox", isAuthenticated, async (req: Request, res: Response) => {
    const user = actor(req);
    if (!user) return res.status(401).json({ message: "Sign in to see issues." });
    const visibleTeams = issueTeamsVisibleToRole(user.role);
    if (visibleTeams.length === 0) return res.status(403).json({ message: "Forbidden" });
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const result = await pool.query(
        `SELECT i.id, i.category, i.owner_team AS "ownerTeam", i.title,
                i.description, i.location_hint AS "locationHint",
                i.impact, i.help_requested AS "helpRequested",
                i.status, i.resolution_note AS "resolutionNote",
                i.created_at AS "createdAt", i.updated_at AS "updatedAt",
                u.name AS "reporterName", u.email AS "reporterEmail"
           FROM public.issue_reports i
           JOIN public.users u ON u.id = i.reported_by
          WHERE i.owner_team = ANY($1::varchar[])
          ORDER BY (i.status = 'resolved') ASC, i.created_at DESC
          LIMIT 150`,
        [visibleTeams],
      );
      res.json({ items: result.rows.map((issue) => ({
        ...issue,
        canManage: issueTeamsForRole(user.role).includes(issue.ownerTeam),
      })) });
    } catch (error) {
      return handleIssueError(res, error);
    }
  });

  app.patch("/api/issues/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    const user = actor(req);
    if (!user) return res.status(401).json({ message: "Sign in to update an issue." });
    const allowedTeams = issueTeamsForRole(user.role);
    if (allowedTeams.length === 0) return res.status(403).json({ message: "Forbidden" });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success || (parsed.data.status === "resolved" && !parsed.data.note)) {
      return res.status(400).json({ message: "Choose a valid status and provide a resolution note when resolving." });
    }
    const client = await pool.connect().catch((error) => {
      console.error("Issue reporting connection failed:", error instanceof Error ? error.message : String(error));
      return null;
    });
    if (!client) return res.status(503).json({ message: "Issue reporting is temporarily unavailable." });
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id, status FROM public.issue_reports
          WHERE id = $1 AND owner_team = ANY($2::varchar[])
          FOR UPDATE`,
        [req.params.id, allowedTeams],
      );
      const current = existing.rows[0];
      if (!current) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Issue not found." });
      }
      if (current.status === "resolved" || current.status === parsed.data.status) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "This issue has already reached that status or is resolved." });
      }
      await client.query(
        `UPDATE public.issue_reports
            SET status = $1, resolution_note = $2, reviewed_by = $3,
                updated_at = now(), resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE NULL END
          WHERE id = $4`,
        [parsed.data.status, parsed.data.note || null, user.id, req.params.id],
      );
      await client.query(
        `INSERT INTO public.issue_report_status_events
          (issue_report_id, changed_by, from_status, to_status, note)
          VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, user.id, current.status, parsed.data.status, parsed.data.note || null],
      );
      await client.query("COMMIT");
      res.json({ id: req.params.id, status: parsed.data.status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return handleIssueError(res, error);
    } finally {
      client.release();
    }
  });
}
