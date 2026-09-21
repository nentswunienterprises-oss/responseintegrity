export function isEmergencyDbMode() {
  // Preview/Proof must never inherit production emergency-mode behavior.
  // Vercel Preview is isolated to Proof and should always exercise the normal
  // Supabase-auth path used by the real product.
  if (process.env.VERCEL_ENV === "preview") {
    return false;
  }

  return process.env.EMERGENCY_DB_MODE === "true";
}
