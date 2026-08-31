import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  projectResponseIntegrityEvidenceLedger,
  type EvidenceLedgerProjectionResult,
  type ResponseIntegrityEvidenceLedgerEntry,
} from "../shared/responseIntegrityEvidenceLedger";
import {
  buildEvidenceLedgerProjectionInputFromStoredDrillRow,
  toEvidenceLedgerPersistenceRow,
  type StoredDrillLedgerRow,
} from "../server/responseIntegrityEvidenceLedger";

type CliOptions = {
  write: boolean;
  limit: number | null;
  pageSize: number;
  studentId: string | null;
  tutorId: string | null;
  sourceDrillId: string | null;
};

type AuditIssue = {
  sourceDrillId: string;
  code: string;
  message: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    write: false,
    limit: null,
    pageSize: 250,
    studentId: null,
    tutorId: null,
    sourceDrillId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value.trim();
    };

    if (arg === "--write") options.write = true;
    else if (arg === "--limit") options.limit = Number(readValue());
    else if (arg === "--page-size") options.pageSize = Number(readValue());
    else if (arg === "--student-id") options.studentId = readValue();
    else if (arg === "--tutor-id") options.tutorId = readValue();
    else if (arg === "--source-drill-id") options.sourceDrillId = readValue();
    else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: npm run backfill:ri-evidence-ledger -- [--write] [--limit N] [--page-size N]",
        "       [--student-id ID] [--tutor-id ID] [--source-drill-id ID]",
        "",
        "Default mode is audit-only. Add --write to upsert projected ledger rows.",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize <= 0 || options.pageSize > 1000) {
    throw new Error("--page-size must be an integer from 1 to 1000");
  }

  return options;
};

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv("SUPABASE_ANON_KEY"),
);

const buildQuery = (options: CliOptions, from: number, to: number) => {
  let query = supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, scheduled_session_id, training_session_run_id, submitted_at, drill")
    .order("submitted_at", { ascending: true })
    .range(from, to);

  if (options.studentId) query = query.eq("student_id", options.studentId);
  if (options.tutorId) query = query.eq("tutor_id", options.tutorId);
  if (options.sourceDrillId) query = query.eq("id", options.sourceDrillId);

  return query;
};

const expectedEntryCountBySource = (entries: ResponseIntegrityEvidenceLedgerEntry[]) => {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    counts.set(entry.sourceDrillId, (counts.get(entry.sourceDrillId) || 0) + 1);
  });
  return counts;
};

const fetchExistingLedgerCounts = async (sourceDrillIds: string[]) => {
  const counts = new Map<string, number>();
  for (let index = 0; index < sourceDrillIds.length; index += 100) {
    const batch = sourceDrillIds.slice(index, index + 100);
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from("response_integrity_evidence_ledger")
      .select("source_drill_id")
      .in("source_drill_id", batch);
    if (error) throw error;
    (data || []).forEach((row: any) => {
      const sourceDrillId = String(row?.source_drill_id || "").trim();
      if (sourceDrillId) counts.set(sourceDrillId, (counts.get(sourceDrillId) || 0) + 1);
    });
  }
  return counts;
};

const summarizeProjection = (projection: EvidenceLedgerProjectionResult) => {
  if (projection.status !== "projected") return { entryCount: 0, duplicateEvidenceIds: 0 };
  const evidenceIds = projection.entries.map((entry) => entry.evidenceId);
  return {
    entryCount: projection.entries.length,
    duplicateEvidenceIds: evidenceIds.length - new Set(evidenceIds).size,
  };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allProjectedEntries: ResponseIntegrityEvidenceLedgerEntry[] = [];
  const issues: AuditIssue[] = [];
  const sourceIds: string[] = [];
  let scanned = 0;
  let projectedDrills = 0;
  let legacyUnprojectedDrills = 0;
  let invalidDrills = 0;
  let duplicateEvidenceIds = 0;

  for (let offset = 0; ; offset += options.pageSize) {
    const remaining = options.limit === null ? options.pageSize : Math.min(options.pageSize, options.limit - scanned);
    if (remaining <= 0) break;

    const { data, error } = await buildQuery(options, offset, offset + remaining - 1);
    if (error) throw error;
    const rows = (data || []) as StoredDrillLedgerRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const sourceDrillId = String(row.id || "").trim();
      sourceIds.push(sourceDrillId);
      const built = buildEvidenceLedgerProjectionInputFromStoredDrillRow(row);
      if ("issue" in built) {
        invalidDrills += 1;
        issues.push({ sourceDrillId, code: built.issue.code, message: built.issue.message });
        continue;
      }

      const projection = projectResponseIntegrityEvidenceLedger(built.input);
      const summary = summarizeProjection(projection);
      duplicateEvidenceIds += summary.duplicateEvidenceIds;

      if (projection.status === "legacy_unprojected") {
        legacyUnprojectedDrills += 1;
      } else if (projection.status === "invalid") {
        invalidDrills += 1;
        projection.issues.forEach((issue) => {
          issues.push({ sourceDrillId, code: issue.code, message: issue.message });
        });
      } else {
        projectedDrills += 1;
        allProjectedEntries.push(...projection.entries);
      }
    }

    if (options.limit !== null && scanned >= options.limit) break;
    if (rows.length < remaining) break;
  }

  const expectedCounts = expectedEntryCountBySource(allProjectedEntries);
  let existingLedgerCounts = new Map<string, number>();
  try {
    existingLedgerCounts = await fetchExistingLedgerCounts([...expectedCounts.keys()]);
  } catch (error) {
    issues.push({
      sourceDrillId: "",
      code: "ledger_count_unavailable",
      message: error instanceof Error ? error.message : "Could not read existing ledger counts",
    });
  }

  const missingOrPartialSources = [...expectedCounts.entries()].filter(([sourceDrillId, expected]) => {
    const existing = existingLedgerCounts.get(sourceDrillId) || 0;
    return existing !== expected;
  }).length;

  let writtenEntries = 0;
  if (options.write && allProjectedEntries.length > 0) {
    const rows = allProjectedEntries.map(toEvidenceLedgerPersistenceRow);
    for (let index = 0; index < rows.length; index += 500) {
      const batch = rows.slice(index, index + 500);
      const { error } = await supabase
        .from("response_integrity_evidence_ledger")
        .upsert(batch, { onConflict: "evidence_id", ignoreDuplicates: true });
      if (error) throw error;
      writtenEntries += batch.length;
    }
  }

  console.log(JSON.stringify({
    mode: options.write ? "write" : "audit",
    scannedDrills: scanned,
    projectedDrills,
    legacyUnprojectedDrills,
    invalidDrills,
    projectedEntries: allProjectedEntries.length,
    duplicateEvidenceIds,
    sourcesNeedingLedgerRows: missingOrPartialSources,
    attemptedWrittenEntries: writtenEntries,
    issueCount: issues.length,
    sampleIssues: issues.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
