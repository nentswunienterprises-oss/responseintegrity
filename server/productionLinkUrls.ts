import {
  buildProductionLinkUrl as buildProductionLinkUrlWithBase,
  normalizeProductionPipeline,
  type ProductionPipeline,
} from "@shared/productionLinks";

export function getAppBaseUrl() {
  return (
    String(process.env.APP_BASE_URL || "").trim() ||
    "https://app.responseintegrity.co.za"
  );
}

export function buildCanonicalProductionLinkUrl(
  code: string,
  pipeline: ProductionPipeline | string | null | undefined = "demand",
) {
  return buildProductionLinkUrlWithBase(
    getAppBaseUrl(),
    code,
    normalizeProductionPipeline(pipeline),
  );
}
