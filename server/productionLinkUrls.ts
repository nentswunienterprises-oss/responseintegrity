import {
  buildProductionLinkUrl as buildProductionLinkUrlWithBase,
  normalizeProductionPipeline,
  type ProductionPipeline,
} from "@shared/productionLinks";

const CANONICAL_APP_BASE_URL = "https://app.responseintegrity.co.za";

function normalizeConfiguredAppBaseUrl(rawValue: string | undefined) {
  const configured = String(rawValue || "").trim();
  if (!configured) return CANONICAL_APP_BASE_URL;

  try {
    const parsed = new URL(configured);
    const hostname = parsed.hostname.toLowerCase();

    // Never emit retired Territorial Tutoring hosts from Production Links,
    // even if a stale deployment environment variable survives a rename.
    if (
      hostname === "territorialtutoring.co.za" ||
      hostname.endsWith(".territorialtutoring.co.za")
    ) {
      return CANONICAL_APP_BASE_URL;
    }

    return parsed.origin;
  } catch {
    return CANONICAL_APP_BASE_URL;
  }
}

export function getAppBaseUrl() {
  return normalizeConfiguredAppBaseUrl(process.env.APP_BASE_URL);
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
