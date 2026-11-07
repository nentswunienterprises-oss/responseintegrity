export function resolveStoredDocumentUrl(value: unknown, apiBaseUrl: string): string {
  const storedUrl = String(value ?? "").trim();
  if (!storedUrl) return "";

  const normalizedApiBase = String(apiBaseUrl ?? "").trim().replace(/\\/+$/, "");

  if (/^https?:\\/\\//i.test(storedUrl)) {
    // Historical Supabase public-object URLs must be routed through the
    // authenticated file proxy. The server validates the project origin and
    // persisted record before returning any bytes.
    try {
      const url = new URL(storedUrl);
      const isSupabaseHost = /(^|\\.)supabase\\.co$/i.test(url.hostname);
      const match = url.pathname.match(/^\\/storage\\/v1\\/object\\/public\\/(tutor-documents|coo-brain-library|executive-task-proofs)\\/(.+)$/);
      if (isSupabaseHost && match && !url.search && !url.hash && normalizedApiBase) {
        return `${normalizedApiBase}/api/confidential-file?reference=${encodeURIComponent(storedUrl)}`;
      }
    } catch {
      // Preserve non-document URLs as entered; malformed targets are not
      // converted into trusted storage references.
    }
    return storedUrl;
  }

  if (storedUrl.startsWith("/api/")) {
    return normalizedApiBase ? `${normalizedApiBase}${storedUrl}` : storedUrl;
  }

  return storedUrl;
}
