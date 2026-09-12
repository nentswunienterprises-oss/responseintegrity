import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.ts";
import { registerCapabilityEngineRoutes } from "./routes/capabilityEngine";
import { registerCapabilityPracticalEvidenceRoutes } from "./routes/capabilityPracticalEvidence";
import { registerCapabilityOralDefenseRoutes } from "./routes/capabilityOralDefense";
import { registerCapabilitySandboxSimulationRoutes } from "./routes/capabilitySandboxSimulation";
import { registerCapabilityMockDossierRoutes } from "./routes/capabilityMockDossier";
import { setupAuth } from "./supabaseAuth";
import cors from 'cors';

// Only import Vite-related stuff in development
const isDev = process.env.NODE_ENV === 'development';

const app = express();

// CORS configuration - allow localhost for dev, same-origin in production
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'https://responseintegrity.co.za',
      'https://www.responseintegrity.co.za',
      'https://app.responseintegrity.co.za',
      'https://api.responseintegrity.co.za',
      'http://localhost:5173',
    ];
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (
      isLocal ||
      allowedOrigins.includes(origin) ||
      (origin?.endsWith?.('.vercel.app'))
    ) {
      return callback(null, true);
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));


// Session configuration is handled by setupAuth() in supabaseAuth.ts
// DO NOT add session middleware here - it will conflict with the one in setupAuth()

// Handle all OPTIONS preflight requests globally to ensure CORS headers are sent
app.options('*', cors(corsOptions));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(`[express] ${logLine}`);
    }
  });

  next();
});


(async () => {
  await setupAuth(app); // Ensure session/auth middleware is active before routes
  registerCapabilityEngineRoutes(app);
  registerCapabilityPracticalEvidenceRoutes(app);
  registerCapabilityOralDefenseRoutes(app);
  registerCapabilitySandboxSimulationRoutes(app);
  registerCapabilityMockDossierRoutes(app);
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite/static serving LAST, after all API routes
  // Only needed in development - in production, Vercel serves the frontend
  // NOTE: Dynamic import is commented out for production build
  // In development, run with tsx which handles this properly
  // if (isDev) {
  //   const { setupVite } = await import("./vite");
  //   await setupVite(app, server);
  // }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const portEnv = process.env.PORT;
  console.log(`[express] PORT env value: "${portEnv}"`);
  const port = portEnv ? parseInt(portEnv, 10) : 5000;
  if (isNaN(port) || port < 0 || port > 65535) {
    console.error(`Invalid PORT: ${portEnv}, using 5000`);
  }
  const finalPort = isNaN(port) ? 5000 : port;
  server.listen({
    port: finalPort,
    host: "0.0.0.0"
  }, () => {
    console.log(`[express] serving on port ${finalPort}`);
  });
})();