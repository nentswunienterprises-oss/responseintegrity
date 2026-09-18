export function resolvePreviewRequestUrl(
  rawUrl: string | undefined,
  query: Record<string, unknown> | undefined,
): string | null {
  const raw = String(rawUrl || "/");
  const parsed = new URL(raw, "https://preview.local");

  const queryValue = query?.__previewPath;
  const queryPath = Array.isArray(queryValue)
    ? queryValue.map(String).join("/")
    : String(queryValue || "").trim();

  const rawPath = String(parsed.searchParams.get("__previewPath") || "").trim();
  const previewPath = queryPath || rawPath;
  if (!previewPath) return null;

  const search = new URLSearchParams(parsed.searchParams);
  search.delete("__previewPath");

  for (const [key, value] of Object.entries(query || {})) {
    if (key === "__previewPath" || value === undefined) continue;
    search.delete(key);
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }

  const normalizedPath = previewPath.startsWith("api/")
    ? `/${previewPath}`
    : `/api/${previewPath}`;

  const queryString = search.toString();
  return queryString ? `${normalizedPath}?${queryString}` : normalizedPath;
}
