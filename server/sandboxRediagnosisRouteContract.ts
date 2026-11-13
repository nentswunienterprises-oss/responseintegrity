import { z } from "zod";

export const sandboxRediagnosisActionRequestSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  trajectoryId: z.string().trim().min(1),
  rediagnosisRunId: z.string().uuid(),
  scheduledSessionId: z.string().uuid(),
}).strict();

export function parseSandboxRediagnosisActionInput(body: unknown, tutorId: string) {
  const parsed = sandboxRediagnosisActionRequestSchema.parse(body);
  return {
    tutorAssignmentId: parsed.tutorAssignmentId,
    studentId: parsed.studentId,
    trajectoryId: parsed.trajectoryId,
    rediagnosisRunId: parsed.rediagnosisRunId,
    scheduledSessionId: parsed.scheduledSessionId,
    tutorId,
  };
}
