import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalProductionLinkUrl, getAppBaseUrl } from "./productionLinkUrls";

const ORIGINAL_APP_BASE_URL = process.env.APP_BASE_URL;

function withAppBaseUrl(value: string | undefined, assertion: () => void) {
  if (value === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = value;
  }

  try {
    assertion();
  } finally {
    if (ORIGINAL_APP_BASE_URL === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = ORIGINAL_APP_BASE_URL;
    }
  }
}

test("Demand canonical Production Links use the app host", () => {
  withAppBaseUrl(undefined, () => {
    const url = buildCanonicalProductionLinkUrl("AFIX7RU1D0", "demand");
    assert.equal(url, "https://app.responseintegrity.co.za/?production=AFIX7RU1D0&pipeline=demand");
    assert.doesNotMatch(url, /api\.responseintegrity\.co\.za/);
  });
});

test("Capacity canonical Production Links use the app host", () => {
  withAppBaseUrl(undefined, () => {
    const url = buildCanonicalProductionLinkUrl("CODE", "capacity");
    assert.equal(url, "https://app.responseintegrity.co.za/?production=CODE&pipeline=capacity");
    assert.doesNotMatch(url, /api\.responseintegrity\.co\.za/);
  });
});

test("Production Link canonical host remains configurable through APP_BASE_URL", () => {
  withAppBaseUrl("https://preview.responseintegrity.co.za/path", () => {
    assert.equal(getAppBaseUrl(), "https://preview.responseintegrity.co.za/path");
    assert.equal(
      buildCanonicalProductionLinkUrl("AFIX123", "demand"),
      "https://preview.responseintegrity.co.za/path?production=AFIX123&pipeline=demand",
    );
  });
});
