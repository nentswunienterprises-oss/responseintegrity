import 'dotenv/config';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { registerRoutes } from '../server/routes';
import { registerEvidenceCompleteDiagnosisRoutes } from '../server/evidenceCompleteDiagnosisRoutes';
import { setupAuth } from '../server/supabaseAuth';
import cors from 'cors';

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

// Register auth first. setupAuth installs the session middleware and the
// /api/auth/* endpoints before all protected application routes.
await setupAuth(app);

// Debug middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Register API routes
registerEvidenceCompleteDiagnosisRoutes(app);
registerRoutes(app);

// Catch-all for unhandled routes
app.use((req, res) => {
  console.log(`[API] 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not found', path: req.url, method: req.method });
});

// Vercel serverless handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  const previewPathRaw = req.query?.__previewPath;
  const previewPath = Array.isArray(previewPathRaw)
    ? previewPathRaw.join("/")
    : String(previewPathRaw || "").trim();

  if (previewPath) {
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

  console.log(`[Vercel Handler] ${req.method} ${req.url}`);
  return app(req as any, res as any);
}
