import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

type BaselineMigration = { path: string; gitBlobSha: string };
type ManagedMigration = {
  path: string;
  description: string;
  risk: "additive" | "destructive";
};

export type ProductionMigrationAuthority = {
  version: number;
  authority: string;
  productionProjectName: string;
  productionProjectRef: string;
  confirmationPhrase: string;
  baseline: {
    commit: string;
    verifiedAt: string;
    note: string;
    migrations: BaselineMigration[];
  };
  managedMigrations: ManagedMigration[];
};

const ROOT = process.cwd();
const AUTHORITY_PATH = path.resolve(ROOT, "config/production-migration-authority.json");
const LEDGER_TABLE = "private.ri_production_schema_migrations";

function fail(message: string): never {
  throw new Error(message);
}

function migrationPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (
    !normalized.startsWith("migrations/") ||
    !normalized.endsWith(".sql") ||
    normalized.includes("..")
  ) {
    fail("Invalid production migration path: " + value);
  }
  return normalized;
}

export function loadProductionMigrationAuthority(): ProductionMigrationAuthority {
  return JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8")) as ProductionMigrationAuthority;
}

export function gitBlobSha(content: Buffer) {
  return createHash("sha1")
    .update("blob " + content.length + "\0")
    .update(content)
    .digest("hex");
}

export function sqlSha256(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

function readMigration(relativePath: string) {
  const safePath = migrationPath(relativePath);
  const migrationsRoot = path.resolve(ROOT, "migrations") + path.sep;
  const absolutePath = path.resolve(ROOT, safePath);
  if (!absolutePath.startsWith(migrationsRoot)) {
    fail("Migration escaped the migrations directory: " + relativePath);
  }
  if (!fs.existsSync(absolutePath)) {
    fail("Migration file is missing: " + relativePath);
  }
  return fs.readFileSync(absolutePath);
}

function changedMigrationFilesSinceBaseline(authority: ProductionMigrationAuthority) {
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", authority.baseline.commit + "...HEAD", "--", "migrations"],
      { cwd: ROOT, encoding: "utf8" },
    );
    return output
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter((item) => item.endsWith(".sql"));
  } catch {
    fail(
      "Unable to compare migrations against production baseline " +
        authority.baseline.commit +
        ". CI must checkout full history (fetch-depth: 0).",
    );
  }
}

function assertNoForbiddenSql(relativePath: string, sql: string) {
  const forbidden: Array<[RegExp, string]> = [
    [/\bCOPY\b[\s\S]*\bPROGRAM\b/i, "COPY ... PROGRAM"],
    [/\bpg_read_file\s*\(/i, "pg_read_file"],
    [/\bpg_ls_dir\s*\(/i, "pg_ls_dir"],
    [/\blo_import\s*\(/i, "lo_import"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(sql)) {
      fail(relativePath + " contains forbidden production migration operation: " + label);
    }
  }
}

function assertTransactionCompatible(relativePath: string, sql: string) {
  if (/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(sql)) {
    fail(relativePath + " uses CREATE INDEX CONCURRENTLY and cannot run in the transactional production runner.");
  }
  if (/\bVACUUM\b/i.test(sql)) {
    fail(relativePath + " uses VACUUM and cannot run in the transactional production runner.");
  }
  if (/^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/im.test(sql)) {
    fail(relativePath + " contains explicit transaction control. The production runner owns the transaction boundary.");
  }
}

export function verifyProductionMigrationAuthority() {
  const authority = loadProductionMigrationAuthority();
  if (authority.version !== 1) fail("Unsupported migration authority version: " + authority.version);
  if (!/^[a-f0-9]{40}$/.test(authority.baseline.commit)) {
    fail("Baseline commit must be a full Git SHA.");
  }
  if (!/^[a-z0-9]{20}$/.test(authority.productionProjectRef)) {
    fail("Production project ref is invalid.");
  }

  const baselinePaths = new Set<string>();
  for (const migration of authority.baseline.migrations) {
    const safePath = migrationPath(migration.path);
    if (baselinePaths.has(safePath)) fail("Duplicate baseline migration: " + safePath);
    baselinePaths.add(safePath);
    const actualBlob = gitBlobSha(readMigration(safePath));
    if (actualBlob !== migration.gitBlobSha) {
      fail(
        "Baseline migration drift detected for " +
          safePath +
          ". Expected Git blob " +
          migration.gitBlobSha +
          ", got " +
          actualBlob +
          ". Baseline migrations are immutable.",
      );
    }
  }

  const managedPaths = new Set<string>();
  for (const migration of authority.managedMigrations) {
    const safePath = migrationPath(migration.path);
    if (baselinePaths.has(safePath)) fail("Baseline migration cannot also be managed: " + safePath);
    if (managedPaths.has(safePath)) fail("Duplicate managed migration: " + safePath);
    if (!migration.description.trim()) fail("Managed migration has no description: " + safePath);
    if (!["additive", "destructive"].includes(migration.risk)) {
      fail("Invalid risk for " + safePath);
    }
    managedPaths.add(safePath);
    const sql = readMigration(safePath).toString("utf8");
    assertNoForbiddenSql(safePath, sql);
    assertTransactionCompatible(safePath, sql);
  }

  const changed = changedMigrationFilesSinceBaseline(authority);
  const unmanaged = changed.filter(
    (migration) => !managedPaths.has(migration) && !baselinePaths.has(migration),
  );
  if (unmanaged.length) {
    fail(
      "New or changed SQL migration files are outside production authority:\n" +
        unmanaged.map((item) => " - " + item).join("\n") +
        "\nAdd new migrations to config/production-migration-authority.json. " +
        "Never edit a verified baseline migration.",
    );
  }

  return {
    authority,
    baselineCount: authority.baseline.migrations.length,
    managedCount: authority.managedMigrations.length,
    changedMigrationCount: changed.length,
  };
}

export function assertProductionDatabaseTarget(
  databaseUrl: string,
  authority = loadProductionMigrationAuthority(),
) {
  const raw = String(databaseUrl || "").trim();
  if (!raw) fail("RI_PRODUCTION_DATABASE_URL is required.");
  if (!raw.includes(authority.productionProjectRef)) {
    fail(
      "Production database URL does not contain The Hub project ref " +
        authority.productionProjectRef +
        ". Refusing to connect to a different database.",
    );
  }
}

function migrationRecord(
  pathName: string,
  content: Buffer,
  sourceCommit: string,
  kind: "baseline" | "migration",
) {
  return {
    path: pathName,
    sha256: sqlSha256(content),
    sourceCommit,
    kind,
    bytes: content.length,
  };
}

async function ledgerExists(client: Client) {
  const result = await client.query<{ exists: boolean }>(
    "select to_regclass($1) is not null as exists",
    [LEDGER_TABLE],
  );
  return Boolean(result.rows[0]?.exists);
}

async function loadLedger(client: Client) {
  if (!(await ledgerExists(client))) {
    return new Map<string, { sha256: string; kind: string }>();
  }
  const result = await client.query<{ migration_path: string; sha256: string; kind: string }>(
    "select migration_path, sha256, kind from " + LEDGER_TABLE + " order by migration_path",
  );
  return new Map(
    result.rows.map((row) => [row.migration_path, { sha256: row.sha256, kind: row.kind }]),
  );
}

async function bootstrapLedger(
  client: Client,
  authority: ProductionMigrationAuthority,
  actor: string,
) {
  await client.query("begin");
  try {
    await client.query("create schema if not exists private");
    await client.query(
      "create table if not exists " +
        LEDGER_TABLE +
        " (" +
        "migration_path text primary key," +
        "sha256 text not null," +
        "source_commit text not null," +
        "kind text not null check (kind in ('baseline','migration'))," +
        "sql_bytes integer not null check (sql_bytes >= 0)," +
        "applied_at timestamptz not null default now()," +
        "applied_by text not null" +
        ")",
    );

    for (const item of authority.baseline.migrations) {
      const content = readMigration(item.path);
      const record = migrationRecord(item.path, content, authority.baseline.commit, "baseline");
      await client.query(
        "insert into " +
          LEDGER_TABLE +
          " (migration_path, sha256, source_commit, kind, sql_bytes, applied_by) " +
          "values ($1,$2,$3,$4,$5,$6) on conflict (migration_path) do nothing",
        [record.path, record.sha256, record.sourceCommit, record.kind, record.bytes, actor],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyLedgerAgainstFiles(
  client: Client,
  authority: ProductionMigrationAuthority,
) {
  const ledger = await loadLedger(client);
  for (const item of authority.baseline.migrations) {
    const current = migrationRecord(
      item.path,
      readMigration(item.path),
      authority.baseline.commit,
      "baseline",
    );
    const stored = ledger.get(item.path);
    if (!stored) fail("Production ledger is missing verified baseline migration " + item.path + ".");
    if (stored.sha256 !== current.sha256 || stored.kind !== "baseline") {
      fail("Production ledger checksum/kind mismatch for verified baseline migration " + item.path + ".");
    }
  }

  for (const item of authority.managedMigrations) {
    const current = migrationRecord(
      item.path,
      readMigration(item.path),
      process.env.GITHUB_SHA || "local",
      "migration",
    );
    const stored = ledger.get(item.path);
    if (stored && stored.sha256 !== current.sha256) {
      fail("Production ledger checksum mismatch for managed migration " + item.path + ".");
    }
  }
  return ledger;
}

async function plan() {
  const verification = verifyProductionMigrationAuthority();
  const databaseUrl = String(
    process.env.RI_PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || "",
  );
  assertProductionDatabaseTarget(databaseUrl, verification.authority);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (!(await ledgerExists(client))) {
      console.log(
        "[DB AUTHORITY] The Hub is at verified baseline " +
          verification.authority.baseline.commit +
          ", but the RI ledger has not been bootstrapped yet.",
      );
      console.log("[DB AUTHORITY] Managed migrations pending after baseline: " + verification.managedCount);
      return;
    }

    const ledger = await verifyLedgerAgainstFiles(client, verification.authority);
    const pending = verification.authority.managedMigrations.filter(
      (item) => !ledger.has(item.path),
    );
    console.log("[DB AUTHORITY] Verified baseline entries: " + verification.baselineCount);
    console.log("[DB AUTHORITY] Managed migrations pending: " + pending.length);
    for (const item of pending) {
      console.log(" - " + item.path + " [" + item.risk + "] " + item.description);
    }
  } finally {
    await client.end();
  }
}

async function apply() {
  const verification = verifyProductionMigrationAuthority();
  const authority = verification.authority;
  const confirmation = String(process.env.RI_PRODUCTION_MIGRATION_CONFIRMATION || "");
  if (confirmation !== authority.confirmationPhrase) {
    fail(
      "Production apply requires RI_PRODUCTION_MIGRATION_CONFIRMATION=" +
        authority.confirmationPhrase +
        ".",
    );
  }

  const databaseUrl = String(
    process.env.RI_PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || "",
  );
  assertProductionDatabaseTarget(databaseUrl, authority);

  const actor = String(
    process.env.RI_PRODUCTION_MIGRATION_ACTOR ||
      process.env.GITHUB_ACTOR ||
      process.env.USER ||
      "unknown",
  );
  const sourceCommit = String(process.env.GITHUB_SHA || "local");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (!(await ledgerExists(client))) {
      console.log("[DB AUTHORITY] Bootstrapping the application-owned production migration ledger.");
      await bootstrapLedger(client, authority, actor);
    }

    let ledger = await verifyLedgerAgainstFiles(client, authority);
    for (const item of authority.managedMigrations) {
      const content = readMigration(item.path);
      const record = migrationRecord(item.path, content, sourceCommit, "migration");
      if (ledger.has(item.path)) {
        console.log("[DB AUTHORITY] already applied: " + item.path);
        continue;
      }

      const sql = content.toString("utf8");
      assertNoForbiddenSql(item.path, sql);
      assertTransactionCompatible(item.path, sql);
      console.log("[DB AUTHORITY] applying: " + item.path + " [" + item.risk + "]");

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into " +
            LEDGER_TABLE +
            " (migration_path, sha256, source_commit, kind, sql_bytes, applied_by) " +
            "values ($1,$2,$3,'migration',$4,$5)",
          [record.path, record.sha256, sourceCommit, record.bytes, actor],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      ledger = await verifyLedgerAgainstFiles(client, authority);
    }

    console.log("[DB AUTHORITY] The Hub production migration authority is current.");
  } finally {
    await client.end();
  }
}

async function main() {
  const command = process.argv[2] || "verify";
  if (command === "verify") {
    const result = verifyProductionMigrationAuthority();
    console.log(
      "[DB AUTHORITY] verified " +
        result.baselineCount +
        " immutable baseline migrations and " +
        result.managedCount +
        " managed migrations.",
    );
    return;
  }
  if (command === "plan") return plan();
  if (command === "apply") return apply();
  fail('Unknown command "' + command + '". Use verify, plan, or apply.');
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entry === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
