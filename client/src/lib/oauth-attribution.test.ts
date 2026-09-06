import assert from "node:assert/strict";
import test from "node:test";
import { buildOAuthAttribution, clearOAuthAttribution, OAUTH_ATTRIBUTION_KEYS } from "./oauth-attribution";

function makeStorage(values: Record<string, string>) {
  const removed: string[] = [];
  return {
    removed,
    getItem: (key: string) => values[key] ?? null,
    removeItem: (key: string) => removed.push(key),
  };
}

test("OAuth signup forwards Production Link, pipeline, and UTM attribution", () => {
  const storage = makeStorage({
    oauth_affiliate_code: "CAP001",
    oauth_production_link_code: "CAP001",
    oauth_production_pipeline: "capacity",
    oauth_tracking_source: "instagram",
    oauth_tracking_campaign: "sept-pilot",
  });
  assert.deepEqual(buildOAuthAttribution(storage, "signup"), {
    isSignup: true,
    affiliate_code: "CAP001",
    production_link_code: "CAP001",
    production_pipeline: "capacity",
    tracking_source: "instagram",
    tracking_campaign: "sept-pilot",
  });
});

test("OAuth login sends no new Production Link attribution", () => {
  const storage = makeStorage({
    oauth_affiliate_code: "CAP001",
    oauth_production_link_code: "CAP001",
    oauth_production_pipeline: "capacity",
  });
  const attribution = buildOAuthAttribution(storage, "login");
  assert.equal(attribution.isSignup, false);
  assert.equal(attribution.production_link_code, null);
  assert.equal(attribution.production_pipeline, null);
  assert.equal(attribution.tracking_source, "organic");
});

test("OAuth temporary attribution state is cleared after success", () => {
  const storage = makeStorage({});
  clearOAuthAttribution(storage);
  assert.deepEqual(storage.removed, [...OAUTH_ATTRIBUTION_KEYS]);
});