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
  return databaseUrl.replace(
    /(\.pooler\.supabase\.com):5432(?=\/|\?|$)/i,
    "$1:6543",
  );
}

const configuredDatabaseUrl = process.env.DATABASE_URL;
const runtimeDatabaseUrl = normalizeRuntimeDatabaseUrl(configuredDatabaseUrl);
const usingSupabaseTransactionPooler = runtimeDatabaseUrl !== configuredDatabaseUrl;

if (usingSupabaseTransactionPooler) {
  console.log("[DB] Supabase shared pooler: transaction mode (6543)");
}

const parsedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || "5", 10);
const poolMax =
  Number.isFinite(parsedPoolMax) && parsedPoolMax > 0
    ? Math.min(parsedPoolMax, 10)
    : 5;

export const pool = new Pool({
  connectionString: runtimeDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
