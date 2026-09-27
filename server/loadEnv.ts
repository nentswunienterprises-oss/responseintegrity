import dotenv from "dotenv";

// Load local developer overrides before the shared .env file. Because this
// module is imported for side effects before any database-dependent module,
// DATABASE_URL and other server secrets exist before server/db.ts evaluates.
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();
