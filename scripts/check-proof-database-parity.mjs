import pg from "pg";

const { Client } = pg;

const productionUrl = process.env.RI_PRODUCTION_DATABASE_URL;
const proofUrl = process.env.RI_PROOF_DATABASE_URL;

if (!productionUrl || !proofUrl) {
  console.error(
    "RI_PRODUCTION_DATABASE_URL and RI_PROOF_DATABASE_URL are required. " +
      "Use read-only production credentials where possible.",
  );
  process.exit(2);
}

const QUERIES = {
  extensions: `
    select e.extname, e.extversion, n.nspname as schema_name
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     order by e.extname`,
  columns: `
    select table_schema, table_name, ordinal_position, column_name,
           data_type, udt_schema, udt_name, is_nullable,
           coalesce(column_default, '') as column_default
      from information_schema.columns
     where table_schema in ('public', 'private')
     order by table_schema, table_name, ordinal_position`,
  enums: `
    select n.nspname as schema_name, t.typname as enum_name,
           e.enumsortorder, e.enumlabel
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname in ('public', 'private')
     order by n.nspname, t.typname, e.enumsortorder`,
  constraints: `
    select n.nspname as schema_name, c.relname as table_name,
           con.conname, con.contype,
           pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'private')
     order by n.nspname, c.relname, con.conname`,
  indexes: `
    select schemaname, tablename, indexname, indexdef
      from pg_indexes
     where schemaname in ('public', 'private')
     order by schemaname, tablename, indexname`,
  functions: `
    select n.nspname as schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as arguments,
           pg_get_function_result(p.oid) as result,
           l.lanname as language,
           p.prosecdef as security_definer,
           p.provolatile as volatility,
           p.proparallel as parallel_mode,
           coalesce(p.proacl::text, '') as acl,
           coalesce(array_to_string(p.proconfig, ','), '') as config,
           p.prosrc as source
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname in ('public', 'private')
     order by n.nspname, p.proname, p.oid`,
  triggers: `
    select n.nspname as schema_name, c.relname as table_name,
           tr.tgname, pg_get_triggerdef(tr.oid, true) as definition
      from pg_trigger tr
      join pg_class c on c.oid = tr.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where not tr.tgisinternal
       and n.nspname in ('public', 'private')
     order by n.nspname, c.relname, tr.tgname`,
  rowSecurity: `
    select n.nspname as schema_name, c.relname as table_name,
           c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r'
       and n.nspname in ('public', 'private')
     order by n.nspname, c.relname`,
  policies: `
    select schemaname, tablename, policyname, permissive,
           array_to_string(roles, ',') as roles, cmd,
           coalesce(qual, '') as qual,
           coalesce(with_check, '') as with_check
      from pg_policies
     where schemaname in ('public', 'private')
     order by schemaname, tablename, policyname`,
  grants: `
    select table_schema, table_name, grantee, privilege_type, is_grantable
      from information_schema.role_table_grants
     where table_schema in ('public', 'private')
     order by table_schema, table_name, grantee, privilege_type`,
  views: `
    select n.nspname as schema_name, c.relname as view_name,
           pg_get_viewdef(c.oid, true) as definition,
           coalesce(array_to_string(c.reloptions, ','), '') as options,
           pg_get_userbyid(c.relowner) as owner,
           coalesce(c.relacl::text, '') as acl
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'v'
       and n.nspname in ('public', 'private')
     order by n.nspname, c.relname`,
  sequences: `
    select s.sequence_schema, s.sequence_name, s.data_type,
           s.start_value, s.minimum_value, s.maximum_value,
           s.increment, s.cycle_option,
           coalesce(c.relacl::text, '') as acl,
           pg_get_userbyid(c.relowner) as owner
      from information_schema.sequences s
      join pg_class c on c.relname = s.sequence_name
      join pg_namespace n on n.oid = c.relnamespace
                         and n.nspname = s.sequence_schema
     where s.sequence_schema in ('public', 'private')
     order by s.sequence_schema, s.sequence_name`,
  storageBuckets: `
    select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets
     order by id`,
};

function normalizeCatalogSql(value) {
  return String(value ?? "")
    .replace(/--[^\n\r]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/::character varying/g, "")
    .replace(/::text/g, "")
    .replace(/\(\s*'/g, "'")
    .replace(/'\s*\)/g, "'")
    .trim();
}

function normalizeValue(key, value) {
  if (value === null || value === undefined) return null;
  if (
    key === "definition" ||
    key === "indexdef" ||
    key === "qual" ||
    key === "with_check" ||
    key === "source"
  ) {
    return normalizeCatalogSql(value);
  }
  if (Array.isArray(value)) return value.map((entry) => normalizeValue(key, entry));
  return value;
}

function normalizeRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeValue(key, value)]),
    ),
  );
}

async function takeSnapshot(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "ri-proof-parity-check",
  });
  await client.connect();
  try {
    const snapshot = {};
    for (const [name, query] of Object.entries(QUERIES)) {
      const result = await client.query(query);
      snapshot[name] = normalizeRows(result.rows);
    }
    return snapshot;
  } finally {
    await client.end();
  }
}

function rowIdentity(category, row, index) {
  const preferredKeys = [
    "schema_name",
    "table_schema",
    "schemaname",
    "table_name",
    "tablename",
    "view_name",
    "sequence_name",
    "enum_name",
    "conname",
    "indexname",
    "proname",
    "arguments",
    "tgname",
    "policyname",
    "grantee",
    "privilege_type",
    "id",
  ];
  const parts = preferredKeys
    .filter((key) => row[key] !== undefined && row[key] !== null && row[key] !== "")
    .map((key) => `${key}=${String(row[key])}`);
  return parts.length ? `${category}:${parts.join("|")}` : `${category}:row-${index + 1}`;
}

function diffCategory(category, productionRows, proofRows) {
  const production = new Map(
    productionRows.map((row, index) => [rowIdentity(category, row, index), row]),
  );
  const proof = new Map(
    proofRows.map((row, index) => [rowIdentity(category, row, index), row]),
  );
  const identities = [...new Set([...production.keys(), ...proof.keys()])].sort();
  const differences = [];

  for (const identity of identities) {
    const left = production.get(identity);
    const right = proof.get(identity);
    if (!left) {
      differences.push({ identity, type: "proof_only" });
      continue;
    }
    if (!right) {
      differences.push({ identity, type: "production_only" });
      continue;
    }
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      differences.push({ identity, type: "different" });
    }
  }
  return differences;
}

const [production, proof] = await Promise.all([
  takeSnapshot(productionUrl),
  takeSnapshot(proofUrl),
]);

let failed = false;
for (const category of Object.keys(QUERIES)) {
  const differences = diffCategory(category, production[category], proof[category]);
  if (differences.length === 0) {
    console.log(`PASS ${category}: ${production[category].length} objects`);
    continue;
  }

  failed = true;
  console.error(
    `FAIL ${category}: production=${production[category].length} proof=${proof[category].length} differences=${differences.length}`,
  );
  for (const difference of differences.slice(0, 20)) {
    console.error(`  ${difference.type}: ${difference.identity}`);
  }
  if (differences.length > 20) {
    console.error(`  ... ${differences.length - 20} additional differences omitted`);
  }
}

if (failed) {
  console.error(
    "Proof parity failed. Either restore baseline parity or explicitly document that Proof is candidate-ahead before promotion.",
  );
  process.exit(1);
}

console.log("PASS Response Integrity Proof database matches the Production application database baseline.");
