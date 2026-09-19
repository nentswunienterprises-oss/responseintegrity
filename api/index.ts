import 'dotenv/config';
import express, { type Express } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';

let appPromise: Promise<Express> | null = null;

function restorePreviewApiPath(req: VercelRequest) {
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

  // Trust proxy for Vercel
  app.set('trust proxy', 1);

  // CORS configuration - must be before routes
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Handle preflight requests explicitly
  app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  // Delay server-module evaluation until invocation so Vercel can return a
  // structured diagnostic instead of FUNCTION_INVOCATION_FAILED when Preview
  // configuration is incomplete.
  const [
    { setupAuth },
    { registerEvidenceCompleteDiagnosisRoutes },
    { registerRoutes },
  ] = await Promise.all([
    import('../server/supabaseAuth.js'),
    import('../server/evidenceCompleteDiagnosisRoutes.js'),
    import('../server/routes.js'),
  ]);

  // Register auth first. setupAuth installs the session middleware and the
  // /api/auth/* endpoints before all protected application routes.
  await setupAuth(app);

  // Debug middleware to log incoming requests
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  registerEvidenceCompleteDiagnosisRoutes(app);
  registerRoutes(app);

  // Catch-all for unhandled routes
  app.use((req, res) => {
    console.log(`[API] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not found', path: req.url, method: req.method });
  });

  return app;
}

function getApp() {
  if (!appPromise) {
    appPromise = initializeApp().catch((error) => {
      // Allow a later warm invocation to retry after environment/config changes.
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  restorePreviewApiPath(req);

  try {
    const app = await getApp();
    console.log(`[Vercel Handler] ${req.method} ${req.url}`);
    return app(req as any, res as any);
  } catch (error) {
    const missingEnvironmentVariables = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SESSION_SECRET',
    ].filter((name) => !process.env[name]);

    console.error('[Vercel Preview API] initialization failed', {
      message: error instanceof Error ? error.message : String(error),
      missingEnvironmentVariables,
      vercelEnv: process.env.VERCEL_ENV || null,
    });

    const isPreview = process.env.VERCEL_ENV === 'preview';
    return res.status(500).json({
      error: 'PREVIEW_API_INITIALIZATION_FAILED',
      missingEnvironmentVariables,
      message: isPreview
        ? (error instanceof Error ? error.message : String(error))
        : 'API initialization failed',
    });
  }
}
