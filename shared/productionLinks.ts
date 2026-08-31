export const PRODUCTION_PIPELINES = ["demand", "capacity"] as const;
export type ProductionPipeline = (typeof PRODUCTION_PIPELINES)[number];

export function normalizeProductionPipeline(value: unknown): ProductionPipeline {
  return String(value || "").trim().toLowerCase() === "capacity" ? "capacity" : "demand";
}

export function normalizeProductionLinkCode(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase();
  return code || null;
}

export function buildProductionLinkUrl(baseUrl: string, code: string, pipeline: ProductionPipeline = "demand"): string {
  const url = new URL(baseUrl);
  url.searchParams.set("production", code);
  url.searchParams.set("pipeline", pipeline);
  return url.toString();
}
