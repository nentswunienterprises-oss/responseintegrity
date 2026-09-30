const PROOF_PROJECT_REFS = new Set([
  "jftlxeacphvbnhbsbpxc",
  "tzgkiaiwnhmnzznvmbfg",
]);

function supabaseProjectRef(rawUrl?: string) {
  try {
    const hostname = new URL(String(rawUrl || "")).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function databaseProjectRef(rawUrl?: string) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    const username = decodeURIComponent(parsed.username || "");
    const match = username.match(/^postgres\.([a-z0-9]+)$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function isProofDbAuthMode(
  env: Record<string, string | undefined> = process.env,
) {
  const isNonProductionRuntime =
    env.NODE_ENV === "development" || env.VERCEL_ENV === "preview";
  if (!isNonProductionRuntime) return false;

  const supabaseRef = supabaseProjectRef(env.SUPABASE_URL);
  if (!supabaseRef || !PROOF_PROJECT_REFS.has(supabaseRef)) return false;

  const databaseRef = databaseProjectRef(env.DATABASE_URL);
  if (databaseRef && databaseRef !== supabaseRef) return false;

  return true;
}

export function isEmergencyDbMode() {
  // Preview/Proof must never inherit production emergency-mode data behavior.
  // Proof authentication has its own isolated DB-session path via
  // isProofDbAuthMode(), while the rest of the product continues to exercise
  // the normal Proof data path.
  if (process.env.VERCEL_ENV === "preview") {
    return false;
  }

  return process.env.EMERGENCY_DB_MODE === "true";
}
