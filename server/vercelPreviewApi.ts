import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import { registerRoutes } from "./routes.ts";
import { registerEvidenceCompleteDiagnosisRoutes } from "./evidenceCompleteDiagnosisRoutes.ts";
import { registerTpsTimingRoutes } from "./tpsTimingRoutes.ts";
import { registerCapabilityEngineRoutes } from "./routes/capabilityEngine.ts";
import { setupAuth } from "./supabaseAuth.ts";

let appPromise: Promise<Express> | null = null;

function restorePreviewApiPath(req: any) {
  const previewPathRaw = req.query?.__previewPath;
  const previewPath = Array.isArray(previewPathRaw)
    ? previewPathRaw.join("/")
    : String(previewPathRaw || "").trim();

  if (!previewPath) return;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "__previewPath" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }

  const normalizedPath = previewPath.startsWith("api/")
    ? `/${previewPath}`
    : `/api/${previewPath}`;
  const queryString = search.toString();
  req.url = queryString ? `${normalizedPath}?${queryString}` : normalizedPath;
}

async function initializeApp(): Promise<Express> {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  app.options("*", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(200).end();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  await setupAuth(app);

  app.use((req, _res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  registerEvidenceCompleteDiagnosisRoutes(app);
  registerTpsTimingRoutes(app);
  registerCapabilityEngineRoutes(app);
  await registerRoutes(app);

  app.use((req, res) => {
    console.log(`[API] 404 Not Found: ${req.method} ${req.url}`);
    res
      .status(404)
      .json({ error: "Not found", path: req.url, method: req.method });
  });

  return app;
}

function getApp() {
  if (!appPromise) {
    appPromise = initializeApp().catch((error) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  restorePreviewApiPath(req);

  try {
    const app = await getApp();
    console.log(`[Vercel Handler] ${req.method} ${req.url}`);
    return app(req, res);
  } catch (error) {
    const missingEnvironmentVariables = [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SESSION_SECRET",
    ].filter((name) => !process.env[name]);

    console.error("[Vercel Preview API] initialization failed", {
      message: error instanceof Error ? error.message : String(error),
      missingEnvironmentVariables,
      vercelEnv: process.env.VERCEL_ENV || null,
    });

    return res.status(500).json({
      error: "PREVIEW_API_INITIALIZATION_FAILED",
      missingEnvironmentVariables,
      message:
        process.env.VERCEL_ENV === "preview"
          ? error instanceof Error
            ? error.message
            : String(error)
          : "API initialization failed",
    });
  }
}
