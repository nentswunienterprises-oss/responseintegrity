/**
 * Cross-mode Sandbox evidence capture is disabled by default.
 * Preview retains its existing branch-scoped acceptance behavior.
 * Production and local deployments require an explicit tutor-ID allowlist so
 * a narrowly authorized capture exercise cannot silently include other
 * Sandbox Specialists.
 */
export function isSandboxCrossModeCaptureEnabled(
  tutorId: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.RI_SANDBOX_CROSSMODE_CAPTURE_V1 !== "true") return false;
  if (env.VERCEL_ENV === "preview") return true;

  const id = String(tutorId || "").trim();
  if (!id) return false;

  const allowed = new Set(
    String(env.RI_SANDBOX_CROSSMODE_CAPTURE_TUTOR_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowed.has(id);
}
