import { z } from "zod";

// Vercel rewrites append transport metadata to the query. These fields are
// never preparation evidence and must not reach the strict domain contract.
const preparationQuerySchema = z.object({
  studentId: z.string().trim().min(1),
  scheduledSessionId: z.string().trim().uuid(),
  topic: z.string().trim().min(1).max(200),
}).strict();

export function parseSandboxPreparationQuery(query: Record<string, unknown>) {
  const { path: _path, host: _host, __previewPath: _previewPath, ...domain } = query;
  return preparationQuerySchema.parse(domain);
}
