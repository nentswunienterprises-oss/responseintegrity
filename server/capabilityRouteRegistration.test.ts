import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverIndex = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const vercelIndex = fs.readFileSync(new URL("../api/index.ts", import.meta.url), "utf8");

for (const [name, source] of [
  ["server", serverIndex],
  ["vercel", vercelIndex],
] as const) {
  test(`${name} entrypoint registers all Capability Engine routes`, () => {
    assert.match(source, /registerCapabilityEngineRoutes/);
    assert.match(source, /registerCapabilityPracticalEvidenceRoutes/);
    assert.match(source, /registerCapabilityOralDefenseRoutes/);
    assert.match(source, /registerCapabilityEngineRoutes\(app\)/);
    assert.match(source, /registerCapabilityPracticalEvidenceRoutes\(app\)/);
    assert.match(source, /registerCapabilityOralDefenseRoutes\(app\)/);
  });
}
