/**
 * Read-only release gate: run inside the production Render backend on startup.
 * Never print Supabase keys, user details, bearer tokens, raw API errors, or URLs.
 * Remove this temporary instrumentation after P0 #178 release acceptance.
 */
import { createClient } from "@supabase/supabase-js";
import { selectPrivilegedSupabaseKey } from "./privilegedSupabaseKey";

export const P0_RENDER_SERVICE = "srv-d544dnu3jp1c739139vg";
export const P0_HUB_REST_ORIGIN = "https://yzcnavucvwgmulcxgxvw.supabase.co";
const P0_HUB_PROJECT_REF = "yzcnavucvwgmulcxgxvw";

type Environment = Record<string, string | undefined>;
type ProbeStatus = "PASS" | "BLOCKED" | "NOT_RUN";

export interface P0RenderCredentialReceipt {
  event: "P0_RENDER_PRIVILEGED_CREDENTIAL";
  serviceId: string;
  sourceCommit: string | null;
  restProjectRef: string;
  credentialKind: "secret" | "service_role" | "unavailable";
  status: "PASS" | "BLOCKED";
  adminProbe: ProbeStatus;
  restProbe: ProbeStatus;
  reason: string | null;
}

/** No direct database writes, metadata changes, migrations, or HTTP endpoints. */
export async function verifyP0RenderPrivilegedCredential(
  env: Environment = process.env,
  makeClient: typeof createClient = createClient,
): Promise<P0RenderCredentialReceipt | null> {
  if (env.RENDER_SERVICE_ID !== P0_RENDER_SERVICE) return null;

  const basic: P0RenderCredentialReceipt = {
    event: "P0_RENDER_PRIVILEGED_CREDENTIAL",
    serviceId: P0_RENDER_SERVICE,
    sourceCommit: env.RENDER_GIT_COMMIT || null,
    restProjectRef: P0_HUB_PROJECT_REF,
    credentialKind: "unavailable",
    status: "BLOCKED",
    adminProbe: "NOT_RUN",
    restProbe: "NOT_RUN",
    reason: "target_unverified",
  };

  let origin: string;
  try {
    origin = new URL(env.SUPABASE_URL || "").origin;
  } catch {
    return { ...basic, reason: "missing_or_invalid_rest_target" };
  }
  if (origin !== P0_HUB_REST_ORIGIN) {
    return { ...basic, reason: "wrong_rest_project" };
  }

  let key: string;
  try {
    // Uses the exact privileged-key selector reviewed in security PR #192.
    // It never falls back to the browser publishable/anon key in The Hub.
    key = selectPrivilegedSupabaseKey(env);
  } catch {
    return { ...basic, reason: "missing_or_invalid_privileged_credential" };
  }

  const credentialKind = key.startsWith("sb_secret_") ? "secret" : "service_role";
  const selected = { ...basic, credentialKind };

  let client: ReturnType<typeof createClient>;
  try {
    client = makeClient(origin, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return { ...selected, reason: "client_initialization_failed" };
  }

  // Supabase Auth Admin is server-only; discard the returned user data.
  try {
    const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return { ...selected, reason: "admin_probe_denied" };
  } catch {
    return { ...selected, reason: "admin_probe_failed" };
  }

  const withAdmin = { ...selected, adminProbe: "PASS" as const };
  // A zero-row read proves REST role/grants without retrieving any user rows.
  try {
    const { error } = await client.from("users").select("id").limit(0);
    if (error) return { ...withAdmin, reason: "rest_probe_denied" };
  } catch {
    return { ...withAdmin, reason: "rest_probe_failed" };
  }

  return {
    ...withAdmin,
    restProbe: "PASS",
    status: "PASS",
    reason: null,
  };
}
