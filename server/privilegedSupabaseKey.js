function requiresPrivilegedServerSupabaseKey(env = process.env) {
  let hub = false;
  try {
    hub = new URL(env.SUPABASE_URL || "").hostname === "yzcnavucvwgmulcxgxvw.supabase.co";
  } catch {
  }
  return hub || env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview";
}
function isPrivilegedKey(key) {
  if (key.startsWith("sb_secret_") && key.length > 20) return true;
  try {
    const parts = key.split(".");
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}
function selectPrivilegedSupabaseKey(env = process.env) {
  for (const candidate of [env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (candidate?.trim() && isPrivilegedKey(candidate.trim())) return candidate.trim();
  }
  if (requiresPrivilegedServerSupabaseKey(env)) {
    throw new Error("Privileged server Supabase credential required; browser-scoped fallback refused");
  }
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing server Supabase credential");
  return key;
}
export {
  requiresPrivilegedServerSupabaseKey,
  selectPrivilegedSupabaseKey
};
