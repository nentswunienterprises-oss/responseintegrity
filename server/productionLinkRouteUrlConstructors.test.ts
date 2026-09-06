import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const routesSource = readFileSync(resolve("server/routes.ts"), "utf8");

test("COO creation and contributor Production Link responses share the canonical URL builder", () => {
  const expectedUses = [
    "link: buildCanonicalProductionLinkUrl(code, pipelineType)",
    "link: buildCanonicalProductionLinkUrl(codeRecord.code, codeRecord.pipeline_type || pipelineType)",
    "link: buildCanonicalProductionLinkUrl(link.code, link.pipeline_type)",
  ];

  for (const expectedUse of expectedUses) {
    assert.match(routesSource, new RegExp(expectedUse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("server Production Link URLs are not constructed from the incoming API request host", () => {
  const productionUrlConstructors = routesSource
    .split("\n")
    .filter((line) => line.includes("?production="));

  assert.deepEqual(productionUrlConstructors, []);
  assert.doesNotMatch(routesSource, /req\.protocol[^;\n]*\?production=/);
  assert.doesNotMatch(routesSource, /req\.get\("host"\)[^;\n]*\?production=/);
});
