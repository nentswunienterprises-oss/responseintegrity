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

test("Vercel preview boots from the generated bundled runtime without tsx at request time", () => {
  const bootstrap = readFileSync(resolve(process.cwd(), "api/index.js"), "utf8");
  const runtime = readFileSync(resolve(process.cwd(), "server/vercelPreviewApi.ts"), "utf8");
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

  assert.equal(existsSync(resolve(process.cwd(), "api/index.ts")), false);
  assert.match(bootstrap, /generated\/preview-api-runtime\.mjs/);
  assert.doesNotMatch(bootstrap, /tsx\/esm\/api/);
  assert.doesNotMatch(bootstrap, /server\/vercelPreviewApi\.ts/);
  assert.match(bootstrap, /PREVIEW_BOOTSTRAP_FAILED/);

  assert.match(
    packageJson.scripts?.["build:vercel-api"] || "",
    /esbuild server\/vercelPreviewApi\.ts/,
  );

  assert.match(runtime, /from "\.\/routes\.ts"/);
  assert.match(runtime, /from "\.\/supabaseAuth\.ts"/);
  assert.match(runtime, /from "\.\/evidenceCompleteDiagnosisRoutes\.ts"/);
  assert.match(runtime, /await setupAuth\(app\)/);
  assert.match(runtime, /req\.query\?\.__previewPath/);
  assert.match(runtime, /req\.url = queryString \?/);

  const includeFiles = config.functions?.["api/index.js"]?.includeFiles || "";
  assert.equal(typeof includeFiles, "string");
  assert.match(includeFiles, /generated\/preview-api-runtime\.mjs/);
  assert.doesNotMatch(includeFiles, /node_modules\/\{tsx/);
});

test("Vercel preview sessions stay host-only on the preview hostname", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");

  assert.match(authSource, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(
    authSource,
    /isProduction && !isVercelPreview \? "\.responseintegrity\.co\.za" : undefined/,
  );
});


test("Vercel preview auth health survives session-store failures", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  const modeRouteIndex = authSource.indexOf('app.get("/api/auth/mode"');
  const sessionMiddlewareIndex = authSource.indexOf("app.use(getSession())");

  assert.ok(modeRouteIndex >= 0, "auth mode route must exist");
  assert.ok(sessionMiddlewareIndex > modeRouteIndex, "auth mode must be registered before session middleware");
  assert.match(authSource, /pruneSessionInterval: isVercelRuntime \? false : 900/);
  assert.match(authSource, /SESSION_STORE_UNAVAILABLE/);
  assert.match(authSource, /describeRuntimeDatabaseTarget\(process\.env\.DATABASE_URL\)/);
  assert.match(dbSource, /pool\.on\("error"/);
  assert.match(dbSource, /PostgreSQL pool idle-client error/);
});


test("preview DB diagnostics identify the Supabase project without exposing credentials", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
  }

  try {
    const { describeRuntimeDatabaseTarget } = await import("../server/db");

    const target = describeRuntimeDatabaseTarget(
      "postgresql://postgres.jftlxeacphvbnhbsbpxc:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
    );

    assert.deepEqual(target, {
      host: "aws-1-eu-west-1.pooler.supabase.com",
      port: "6543",
      mode: "transaction",
      projectRef: "jftlxeacphvbnhbsbpxc",
    });
    assert.equal(JSON.stringify(target).includes("secret"), false);
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});


test("preview auth mode can detect DATABASE_URL and SUPABASE_URL project drift", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  assert.match(dbSource, /describeSupabaseApiTarget/);
  assert.match(dbSource, /projectRefMatch = hostname\.match/);
  assert.match(authSource, /supabaseTarget/);
  assert.match(authSource, /runtimeTargetsAligned/);
  assert.match(authSource, /databaseTarget\.projectRef === supabaseTarget\.projectRef/);
});
