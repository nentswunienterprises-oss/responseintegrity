import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { storage, supabase } from "../storage";
import { pool } from "../db";
import { isEmergencyDbMode } from "../emergencyMode";
import { buildTpsTimerRuntimeStatus, type StoredTpsDrillRow } from "../../shared/capabilityTpsTimerRuntime";

const requireSpecialist = (req: Request, res: Response) => {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(dbUser.role || "").trim().toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return dbUser;
};

const loadRecentDrillRows = async (studentId: string): Promise<StoredTpsDrillRow[]> => {
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT id, student_id, tutor_id, submitted_at, drill
         FROM public.intro_session_drills
        WHERE student_id = $1
        ORDER BY submitted_at DESC
        LIMIT 250`,
      [studentId],
    );
    return result.rows || [];
  }

  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, drill")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(250);

  if (error) throw new Error(`Failed to load timing lineage: ${error.message}`);
  return (data || []) as StoredTpsDrillRow[];
};

export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {
  app.get(
    "/api/tutor/students/:studentId/tps-timer-contract",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const dbUser = requireSpecialist(req, res);
        if (!dbUser) return;

        const studentId = String(req.params.studentId || "").trim();
        const topic = String(req.query.topic || "").trim();
        if (!studentId || !topic) {
          return res.status(400).json({ message: "studentId and topic are required." });
        }

        // Authorization follows the student's current assignment, while the timing lineage follows
        // the student/topic itself. Historical eligible reps from a previous Specialist remain part
        // of the same student's baseline after a legitimate handover.
        const student = await storage.getStudent(studentId);
        if (!student || String(student.tutorId || "") !== String(dbUser.id)) {
          return res.status(403).json({ message: "Unauthorized: Student does not belong to this Specialist." });
        }

        const rows = await loadRecentDrillRows(studentId);
        const status = buildTpsTimerRuntimeStatus({
          rows,
          studentId,
          topic,
        });

        return res.json({
          topic,
          ...status,
        });
      } catch (error) {
        console.error("[TPS_TIMER_RUNTIME] Failed to derive timer contract", error);
        return res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to derive TPS timer contract.",
        });
      }
    },
  );
}
