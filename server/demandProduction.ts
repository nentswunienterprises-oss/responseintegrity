import { z } from "zod";
import { QUALIFICATION_STATUSES, handoverSla, isParentQualificationAssessmentComplete } from "../shared/demandProduction";

const evidenceSchema = z.object({
  parentAccount: z.string().max(3000).optional(),
  evidence: z.string().max(3000).optional(),
  interviewerObservation: z.string().max(3000).optional(),
  followUp: z.string().max(1000).optional(),
  responses: z.record(z.string(), z.string().max(3000)).optional(),
  scriptPresented: z.boolean().optional(),
  pricePresentationDelivered: z.boolean().optional(),
  meetingClosureDelivered: z.boolean().optional(),
}).strict();

const commandSchema = z.object({
  action: z.enum(["qualification", "entry", "handover", "assessment"]),
  assessment: z.record(z.string(), evidenceSchema).optional(),
  status: z.enum(QUALIFICATION_STATUSES).optional(),
  ownerId: z.string().min(1).max(64).optional(),
  entryType: z.enum(["pilot", "commercial"]).optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();

export async function updateDemandProduction(client: any, enrollmentId: string, actorId: string, input: unknown) {
  const command = commandSchema.parse(input);
  if (command.action === "qualification" && (command.status === "qualified" || command.status === "not_qualified")) {
    const { data: enrollment, error: readError } = await client
      .from("parent_enrollments")
      .select("qualification_assessment,demand_flow_version,is_sandbox_account,qualification_completed_at")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!enrollment || enrollment.demand_flow_version !== 1 || enrollment.is_sandbox_account || enrollment.qualification_completed_at) {
      throw new Error("This application is not eligible for a new qualification decision");
    }
    if (!isParentQualificationAssessmentComplete(enrollment.qualification_assessment)) {
      throw new Error("Complete and save all four approved qualification sections before recording a terminal decision");
    }
  }
  if (command.action === "assessment") {
    if (!command.assessment || Object.keys(command.assessment).some((key) => !["parentExperience", "supportPreferences", "riExplanation", "commercialReadiness"].includes(key))) {
      throw new Error("Provide evidence under the four approved qualification sections");
    }
    const { data, error } = await client.rpc("save_parent_qualification_assessment", {
      p_enrollment_id: enrollmentId,
      p_actor_id: actorId,
      p_assessment: command.assessment,
    });
    if (error) throw new Error(error.message);
    return { ...data, handoverSla: handoverSla(data) };
  }
  const { data, error } = await client.rpc("update_demand_production", {
    p_enrollment_id: enrollmentId,
    p_actor_id: actorId,
    p_action: command.action,
    p_status: command.status || null,
    p_owner_id: command.ownerId || null,
    p_entry_type: command.entryType || null,
    p_note: command.note || null,
  });
  if (error) throw new Error(error.message);
  return { ...data, handoverSla: handoverSla(data) };
}

export function registerDemandProductionRoutes(app: any, { client, isAuthenticated, requireRole }: any) {
  app.patch("/api/hr/enrollments/:enrollmentId/demand", isAuthenticated, requireRole(["coo", "hr", "ceo"]), async (req: any, res: any) => {
    try {
      const result = await updateDemandProduction(client, req.params.enrollmentId, req.dbUser.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 409).json({ message: error instanceof Error ? error.message : "Demand update failed" });
    }
  });
}
