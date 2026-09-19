import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("Vercel preview uses a CommonJS bootstrap with raw TypeScript runtime sources", () => {
  const bootstrap = readFileSync(resolve(process.cwd(), "api/index.js"), "utf8");
  const runtime = readFileSync(resolve(process.cwd(), "server/vercelPreviewApi.ts"), "utf8");
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

  assert.equal(existsSync(resolve(process.cwd(), "api/index.ts")), false);
  assert.match(bootstrap, /tsx\/esm\/api/);
  assert.match(bootstrap, /server\/vercelPreviewApi\.ts/);
  assert.match(bootstrap, /PREVIEW_BOOTSTRAP_FAILED/);
  assert.match(bootstrap, /function tracePreviewRuntimeForVercel\(\)/);
  assert.match(bootstrap, /import\("\.\.\/server\/vercelPreviewApi\.ts"\)/);
  assert.match(bootstrap, /void tracePreviewRuntimeForVercel/);

  assert.match(runtime, /from "\.\/routes\.ts"/);
  assert.match(runtime, /from "\.\/supabaseAuth\.ts"/);
  assert.match(runtime, /from "\.\/evidenceCompleteDiagnosisRoutes\.ts"/);
  assert.match(runtime, /await setupAuth\(app\)/);
  assert.match(runtime, /req\.query\?\.__previewPath/);
  assert.match(runtime, /req\.url = queryString \?/);

  const includeFiles = config.functions?.["api/index.js"]?.includeFiles || "";
  assert.equal(typeof includeFiles, "string");
  assert.match(includeFiles, /server\/\*\*\/\*\.ts/);
  assert.match(includeFiles, /shared\/\*\*\/\*\.ts/);
  assert.match(includeFiles, /tsconfig\.json/);
});

test("Vercel preview sessions stay host-only on the preview hostname", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");

  assert.match(authSource, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(
    authSource,
    /isProduction && !isVercelPreview \? "\.responseintegrity\.co\.za" : undefined/,
  );
});
