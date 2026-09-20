import { z } from "zod";
import { QUALIFICATION_STATUSES, handoverSla } from "../shared/demandProduction";

const commandSchema = z.object({
  action: z.enum(["qualification", "entry", "handover"]),
  status: z.enum(QUALIFICATION_STATUSES).optional(),
  ownerId: z.string().min(1).max(64).optional(),
  entryType: z.enum(["pilot", "commercial"]).optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();

export async function updateDemandProduction(client: any, enrollmentId: string, actorId: string, input: unknown) {
  const command = commandSchema.parse(input);
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
