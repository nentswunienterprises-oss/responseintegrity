export function resolveStoredDocumentUrl(value: unknown, apiBaseUrl: string): string {
  const storedUrl = String(value ?? "").trim();
  if (!storedUrl) return "";

  if (storedUrl.startsWith("ri-storage://") ||
      /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/(tutor-documents|coo-brain-library)\//i.test(storedUrl)) {
    const base = String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
    return base + "/api/confidential-file?reference=" + encodeURIComponent(storedUrl);
  }

  if (/^https?:\/\//i.test(storedUrl)) {
    return storedUrl;
  }

  if (storedUrl.startsWith("/api/")) {
    const normalizedApiBase = String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
    return normalizedApiBase ? `${normalizedApiBase}${storedUrl}` : storedUrl;
  }

  return storedUrl;
}
