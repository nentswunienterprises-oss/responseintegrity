import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Vercel preview API is routed to the branch Express function before the SPA fallback", () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];

  const previewIndex = rewrites.findIndex(
    (row: any) =>
      row.source === "/api/:path*" &&
      row.destination === "/api/index?__previewPath=:path*" &&
      Array.isArray(row.has) &&
      row.has.some(
        (rule: any) =>
          rule.type === "host" &&
          String(rule.value || "").includes("vercel"),
      ),
  );
  const productionIndex = rewrites.findIndex(
    (row: any) =>
      row.source === "/api/:path*" &&
      String(row.destination || "").includes("api.responseintegrity.co.za"),
  );
  const spaIndex = rewrites.findIndex(
    (row: any) => row.source === "/(.*)" && row.destination === "/index.html",
  );

  assert.ok(previewIndex >= 0, "preview API rewrite must exist");
  assert.ok(productionIndex >= 0, "production API proxy must remain configured");
  assert.ok(spaIndex >= 0, "SPA fallback must remain configured");
  assert.ok(previewIndex < spaIndex, "preview API routing must win before SPA fallback");
  assert.ok(productionIndex < spaIndex, "production API routing must win before SPA fallback");
});

test("Vercel preview packages the API and server source", () => {
  const ignore = readFileSync(resolve(process.cwd(), ".vercelignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim());

  assert.equal(ignore.includes("api/"), false);
  assert.equal(ignore.includes("server/"), false);
});

test("Vercel preview registers auth and restores the public API path before Express", () => {
  const apiIndex = readFileSync(resolve(process.cwd(), "api/index.ts"), "utf8");

  assert.match(apiIndex, /import \{ setupAuth \} from ['"]\.\.\/server\/supabaseAuth['"]/);
  assert.match(apiIndex, /await setupAuth\(app\)/);
  assert.match(apiIndex, /req\.query\?\.__previewPath/);
  assert.match(apiIndex, /req\.url = queryString \?/);
  assert.match(apiIndex, /\/api\/\$\{previewPath\}/);
  assert.doesNotMatch(apiIndex, /app\.use\(getSession\(\)\)/);
});

test("Vercel preview sessions stay host-only on the preview hostname", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");

  assert.match(authSource, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(
    authSource,
    /isProduction && !isVercelPreview \? "\.responseintegrity\.co\.za" : undefined/,
  );
});
