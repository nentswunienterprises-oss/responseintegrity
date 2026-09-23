import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Render is IPv4-only and Supabase's shared pooler supports both:
// - session mode on 5432 (one database connection per client)
// - transaction mode on 6543 (connections are shared per transaction)
//
// Emergency mode performs many short independent queries in parallel, so keeping
// Render on session mode can exhaust Supavisor's session client limit even when
// the local pg.Pool is bounded. Normalize only Supabase shared-pooler URLs from
// 5432 to transaction mode; direct database URLs and non-Supabase hosts are left
// untouched.
export function normalizeRuntimeDatabaseUrl(databaseUrl: string) {
  // PostgreSQL defaults to 5432 when the port is omitted, so treat a shared
  // Supabase pooler URL with no explicit port as session mode too.
  return databaseUrl.replace(
    /(\.pooler\.supabase\.com)(?::5432)?(?=\/|\?|$)/i,
    "$1:6543",
  );
}

export function describeRuntimeDatabaseTarget(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    const effectivePort = parsed.port || "5432";
    const mode =
      parsed.hostname.toLowerCase().endsWith(".pooler.supabase.com")
        ? (effectivePort === "6543" ? "transaction" : "session")
        : "direct-or-custom";
    const username = decodeURIComponent(parsed.username || "");
    const projectRefMatch = username.match(/^postgres\.([a-z0-9]+)$/i);
    return {
      host: parsed.hostname,
      port: effectivePort,
      mode,
      ...(projectRefMatch ? { projectRef: projectRefMatch[1] } : {}),
    };
  } catch {
    return { host: "unparseable", port: "unknown", mode: "unknown" };
  }
}

export function describeSupabaseApiTarget(supabaseUrl: string) {
  try {
    const parsed = new URL(supabaseUrl);
    const hostname = parsed.hostname.toLowerCase();
    const projectRefMatch = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return {
      host: hostname,
      ...(projectRefMatch ? { projectRef: projectRefMatch[1] } : {}),
    };
  } catch {
    return { host: "unparseable" };
  }
}

const configuredDatabaseUrl = process.env.DATABASE_URL;
const runtimeDatabaseUrl = normalizeRuntimeDatabaseUrl(configuredDatabaseUrl);

// Keep every runtime consumer on the same normalized target. A few legacy
// maintenance paths still read DATABASE_URL directly instead of importing pool.
process.env.DATABASE_URL = runtimeDatabaseUrl;

const runtimeTarget = describeRuntimeDatabaseTarget(runtimeDatabaseUrl);
console.log(
  `[DB] PostgreSQL target ${runtimeTarget.host}:${runtimeTarget.port} mode=${runtimeTarget.mode}`,
);

const isVercelRuntime = process.env.VERCEL === "1";

// Local/emergency mode fans out several parent-dashboard reads at once. Five
// shared clients were not enough once Express session reads and route queries
// competed for the same pool. Keep serverless conservative, but allow local
// application queries enough concurrency to complete without acquisition
// timeouts.
const defaultAppPoolMax = isVercelRuntime ? 5 : 10;
const parsedPoolMax = Number.parseInt(
  process.env.DB_POOL_MAX || String(defaultAppPoolMax),
  10,
);
const poolMax =
  Number.isFinite(parsedPoolMax) && parsedPoolMax > 0
    ? Math.min(parsedPoolMax, 10)
    : defaultAppPoolMax;

export const pool = new Pool({
  connectionString: runtimeDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: "response-integrity-api",
});

// Session persistence is isolated from application-query capacity. Session
// lookups are short, so a small dedicated pool is enough and prevents a burst
// of authenticated requests from starving the route handlers themselves.
const defaultSessionPoolMax = isVercelRuntime ? 2 : 3;
const parsedSessionPoolMax = Number.parseInt(
  process.env.DB_SESSION_POOL_MAX || String(defaultSessionPoolMax),
  10,
);
const sessionPoolMax =
  Number.isFinite(parsedSessionPoolMax) && parsedSessionPoolMax > 0
    ? Math.min(parsedSessionPoolMax, 5)
    : defaultSessionPoolMax;

export const sessionPool = new Pool({
  connectionString: runtimeDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: sessionPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: "response-integrity-session-store",
});

export function getDatabasePoolStats() {
  return {
    application: {
      max: poolMax,
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
    session: {
      max: sessionPoolMax,
      total: sessionPool.totalCount,
      idle: sessionPool.idleCount,
      waiting: sessionPool.waitingCount,
    },
  };
}

console.log("[DB] Pool capacity", getDatabasePoolStats());

// node-postgres emits idle-client failures as an "error" event on the Pool.
// Without a listener Node treats that event as uncaught and a serverless
// invocation can terminate before Express has a chance to return JSON.
pool.on("error", (error) => {
  console.error("[DB] PostgreSQL pool idle-client error", {
    message: error instanceof Error ? error.message : String(error),
    target: runtimeTarget,
    pools: getDatabasePoolStats(),
  });
});

sessionPool.on("error", (error) => {
  console.error("[DB] PostgreSQL session pool idle-client error", {
    message: error instanceof Error ? error.message : String(error),
    target: runtimeTarget,
    pools: getDatabasePoolStats(),
  });
});

export const db = drizzle(pool, { schema });
