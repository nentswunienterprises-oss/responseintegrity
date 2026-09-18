import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Vercel preview API uses the native catch-all function, not an /api/index rewrite", () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];

  assert.equal(
    rewrites.some((row: any) => row.destination === "/api/index?__previewPath=:path*"),
    false,
  );

  const productionProxy = rewrites.find(
    (row: any) =>
      row.source === "/api/:path*" &&
      String(row.destination || "").includes("api.responseintegrity.co.za"),
  );
  assert.ok(productionProxy, "production API proxy must remain configured");
  assert.ok(
    Array.isArray(productionProxy.has) &&
      productionProxy.has.some((rule: any) => rule.type === "host"),
    "production API proxy must stay host-scoped",
  );

  const catchAll = readFileSync(
    resolve(process.cwd(), "api/[...path].ts"),
    "utf8",
  );
  assert.match(catchAll, /import handler from "\.\/index"/);
  assert.match(catchAll, /export default handler/);
});
