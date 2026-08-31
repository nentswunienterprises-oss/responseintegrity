const TRACKING_PARAM_KEYS = ["affiliate", "production", "pipeline", "utm_source", "utm_campaign"] as const;

function readParams(search: string) {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function buildTrackedPath(
  pathname: string,
  search: string,
  extraParams: Record<string, string | null | undefined> = {},
) {
  const sourceParams = readParams(search);
  const nextParams = new URLSearchParams();

  for (const key of TRACKING_PARAM_KEYS) {
    const value = sourceParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(extraParams)) {
    if (value) {
      nextParams.set(key, value);
    }
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildTrackedReturnTo(pathname: string, search: string) {
  return buildTrackedPath(pathname, search);
}

export function resolveTrackedBackTarget(search: string, fallback = "/") {
  const params = readParams(search);
  const returnTo = params.get("returnTo");

  if (returnTo && returnTo.startsWith("/")) {
    return returnTo;
  }

  return buildTrackedPath(fallback, search);
}
