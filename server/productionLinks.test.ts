import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductionLinkUrl,
  normalizeProductionLinkCode,
  normalizeProductionPipeline,
  preserveFirstProductionLink,
  resolveDurableProductionLink,
  validateProductionLinkForRole,
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

test("canonical pipeline wins over a mismatched URL pipeline", () => {
  assert.equal(
    validateProductionLinkForRole(
      { code: "DEM001", pipeline_type: "demand", status: "active" },
      "capacity",
      "tutor",
    ),
    "Production Link pipeline does not match the canonical link",
  );
});

test("existing Production Link attribution is immutable", () => {
  assert.equal(preserveFirstProductionLink("CAP001", "CAP001"), "CAP001");
  assert.throws(() => preserveFirstProductionLink("CAP001", "CAP002"), /cannot be reassigned/);
});

test("durable account attribution survives application submission without transport state", () => {
  assert.equal(resolveDurableProductionLink("CAP001", null, null), "CAP001");
  assert.equal(resolveDurableProductionLink("CAP001", "CAP001", null), "CAP001");
  assert.throws(() => resolveDurableProductionLink("CAP001", null, "CAP002"), /cannot be reassigned/);
});
