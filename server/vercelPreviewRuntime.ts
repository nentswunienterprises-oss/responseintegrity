import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';
import { setupAuth } from '../server/supabaseAuth';
import { registerRoutes } from '../server/routes';

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

let initialized = false;
let initializationPromise: Promise<void> | null = null;

function initializeApp(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await setupAuth(app);
      await registerRoutes(app);

      app.use((req, res) => {
        console.log(`[API] 404 Not Found: ${req.method} ${req.url}`);
        res.status(404).json({ error: 'Not found', path: req.url, method: req.method });
      });

      initialized = true;
    })();
  }
  return initializationPromise;
}

function remapPreviewApiPath(req: VercelRequest) {
  const routedPath = req.query.__ri_path;
  if (typeof routedPath !== 'string' || !routedPath) return;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === '__ri_path' || key === '__ri_internal') continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else if (value !== undefined) {
      query.append(key, String(value));
    }
  }

  const qs = query.toString();
  req.url = `/api/${routedPath}${qs ? `?${qs}` : ''}`;
}

function previewEnvironmentProof(res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  let supabaseProjectRef: string | null = null;
  try {
    supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0] || null;
  } catch {
    supabaseProjectRef = null;
  }

  let databaseHost: string | null = null;
  try {
    databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    databaseHost = null;
  }

  return res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV || null,
    supabaseProjectRef,
    databaseHost,
    requiredEnv: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    },
  });
}

function sanitizePreviewDiagnostic(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/([?&](?:password|token|key|secret)=)[^&\s]+/gi, '$1***')
    .slice(0, 1000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  remapPreviewApiPath(req);

  if (req.url?.split('?')[0] === '/api/__proof/environment') {
    if (process.env.VERCEL_ENV !== 'preview') {
      return res.status(404).json({ error: 'Not found' });
    }
    return previewEnvironmentProof(res);
  }

  try {
    await initializeApp();
  } catch (error) {
    console.error('[Vercel Handler] backend initialization failed', error);
    if (process.env.VERCEL_ENV === 'preview') {
      return res.status(500).json({
        error: 'PREVIEW_BACKEND_INIT_FAILED',
        message: sanitizePreviewDiagnostic(error),
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  console.log(`[Vercel Handler] ${req.method} ${req.url}`);
  return app(req as any, res as any);
}
