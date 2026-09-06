export const OAUTH_ATTRIBUTION_KEYS = [
  "oauth_role",
  "oauth_mode",
  "oauth_affiliate_code",
  "oauth_production_link_code",
  "oauth_production_pipeline",
  "oauth_tracking_source",
  "oauth_tracking_campaign",
] as const;

type OAuthStorage = Pick<Storage, "getItem" | "removeItem">;

export function buildOAuthAttribution(
  storage: OAuthStorage,
  mode: string | null,
) {
  const isSignup = mode !== "login";
  return {
    isSignup,
    affiliate_code: isSignup ? storage.getItem("oauth_affiliate_code") : null,
    production_link_code: isSignup ? storage.getItem("oauth_production_link_code") : null,
    production_pipeline: isSignup ? storage.getItem("oauth_production_pipeline") : null,
    tracking_source: isSignup ? storage.getItem("oauth_tracking_source") || "organic" : "organic",
    tracking_campaign: isSignup ? storage.getItem("oauth_tracking_campaign") : null,
  };
}

export function clearOAuthAttribution(storage: OAuthStorage) {
  for (const key of OAUTH_ATTRIBUTION_KEYS) {
    storage.removeItem(key);
  }
}
