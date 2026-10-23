export function resolveStoredDocumentUrl(value: unknown, apiBaseUrl: string): string {
  const storedUrl = String(value ?? "").trim();
  if (!storedUrl) return "";

  if (/^https?:\/\//i.test(storedUrl)) {
    return storedUrl;
  }

  if (storedUrl.startsWith("/api/")) {
    const normalizedApiBase = String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
    return normalizedApiBase ? `${normalizedApiBase}${storedUrl}` : storedUrl;
  }

  return storedUrl;
}
