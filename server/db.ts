import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Always enforce SSL for Supabase.
// Keep the application pool below the Supabase session-pooler client ceiling.
// Session storage reuses this same pool so one process cannot accidentally
// reserve two independent sets of PostgreSQL connections.
const parsedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || "5", 10);
const poolMax =
  Number.isFinite(parsedPoolMax) && parsedPoolMax > 0
    ? Math.min(parsedPoolMax, 10)
    : 5;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
