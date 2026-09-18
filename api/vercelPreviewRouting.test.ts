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


test("Vercel preview packages the API and server source", () => {
  const ignore = readFileSync(resolve(process.cwd(), ".vercelignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());

  assert.equal(ignore.includes("api/"), false);
  assert.equal(ignore.includes("server/"), false);
});

test("Vercel preview registers the real auth routes before protected routes", () => {
  const apiIndex = readFileSync(resolve(process.cwd(), "api/index.ts"), "utf8");

  assert.match(apiIndex, /import \{ setupAuth \} from ['"]\.\.\/server\/supabaseAuth['"]/);
  assert.match(apiIndex, /await setupAuth\(app\)/);
  assert.doesNotMatch(apiIndex, /app\.use\(getSession\(\)\)/);
});

test("Vercel preview sessions stay host-only on the preview hostname", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");

  assert.match(authSource, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(authSource, /isProduction && !isVercelPreview \? "\.responseintegrity\.co\.za" : undefined/);
});
