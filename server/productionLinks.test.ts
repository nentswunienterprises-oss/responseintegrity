import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductionLinkUrl,
  normalizeProductionLinkCode,
  normalizeProductionPipeline,
} from "../shared/productionLinks";

test("production links preserve pipeline identity", () => {
  assert.equal(normalizeProductionPipeline("CAPACITY"), "capacity");
  assert.equal(normalizeProductionPipeline("unknown"), "demand");
  assert.equal(normalizeProductionLinkCode(" afix123 "), "AFIX123");
  assert.equal(
    buildProductionLinkUrl("https://responseintegrity.co.za/", "AFIX123", "capacity"),
    "https://responseintegrity.co.za/?production=AFIX123&pipeline=capacity",
  );
});
