export const PRODUCTION_PIPELINES = ["demand", "capacity"] as const;
export type ProductionPipeline = (typeof PRODUCTION_PIPELINES)[number];

export type ProductionLinkRecord = {
  code?: string | null;
  production_link_code?: string | null;
  pipeline_type?: string | null;
  status?: string | null;
};

export function normalizeProductionPipeline(value: unknown): ProductionPipeline {
  return String(value || "").trim().toLowerCase() === "capacity" ? "capacity" : "demand";
}

export function normalizeProductionLinkCode(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase();
  return code || null;
}

export function validateProductionLinkForRole(
  link: ProductionLinkRecord | null | undefined,
  requestedPipeline: unknown,
  role: string,
): string | null {
  if (!link || (link.status && link.status !== "active")) return "Production Link is invalid or inactive";
  const pipeline = normalizeProductionPipeline(requestedPipeline);
  if (link.pipeline_type !== pipeline) return "Production Link pipeline does not match the canonical link";
  if (role === "parent" && pipeline !== "demand") return "Capacity Production Links cannot create parent accounts";
  if (role === "tutor" && pipeline !== "capacity") return "Demand Production Links cannot create specialist accounts";
  return null;
}

export function preserveFirstProductionLink(existingCode: unknown, incomingCode: unknown): string | null {
  const existing = normalizeProductionLinkCode(existingCode);
  const incoming = normalizeProductionLinkCode(incomingCode);
  if (existing && incoming && existing !== incoming) {
    throw new Error("Existing Production Link attribution cannot be reassigned");
  }
  return existing || incoming;
}

export function resolveDurableProductionLink(
  accountCode: unknown,
  applicationCode: unknown,
  incomingCode: unknown,
): string | null {
  const account = normalizeProductionLinkCode(accountCode);
  const application = normalizeProductionLinkCode(applicationCode);
  const durable = preserveFirstProductionLink(account, application);
  return preserveFirstProductionLink(durable, incomingCode);
}

export function buildProductionLinkUrl(baseUrl: string, code: string, pipeline: ProductionPipeline = "demand"): string {
  const url = new URL(baseUrl);
  url.searchParams.set("production", code);
  url.searchParams.set("pipeline", pipeline);
  return url.toString();
}
