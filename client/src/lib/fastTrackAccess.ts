const FAST_TRACK_PARAM_KEY = "fastTrack";
const ENABLED_VALUES = new Set(["1", "true", "dev", "exec"]);

export type FastTrackAccessMode = "dev" | "exec" | "local" | null;

function readFastTrackValue(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(FAST_TRACK_PARAM_KEY)?.toLowerCase() ?? null;
}

export function getFastTrackAccessMode(search: string): FastTrackAccessMode {
  const value = readFastTrackValue(search);

  if (value && ENABLED_VALUES.has(value)) {
    return value === "exec" ? "exec" : "dev";
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (import.meta.env.DEV || host === "localhost" || host === "127.0.0.1") {
      return "local";
    }
  }

  return null;
}

export function isFastTrackAccessEnabled(search: string) {
  return getFastTrackAccessMode(search) !== null;
}

export function getFastTrackParamValue(search: string) {
  const mode = getFastTrackAccessMode(search);

  if (!mode) {
    return null;
  }

  return mode === "exec" ? "exec" : "dev";
}

export function getFastTrackExtraParams(search: string) {
  const fastTrack = getFastTrackParamValue(search);
  return fastTrack ? { fastTrack } : {};
}

export function getFastTrackBadgeLabel(search: string) {
  const mode = getFastTrackAccessMode(search);

  if (mode === "exec") {
    return "Private Access";
  }

  if (mode) {
    return "Private Access";
  }

  return null;
}

export function getFastTrackDescription(search: string) {
  const mode = getFastTrackAccessMode(search);

  if (mode === "exec") {
    return "This path is available by invitation while the public intake gate remains unchanged.";
  }

  if (mode) {
    return "This path is available by invitation while the public intake gate remains unchanged.";
  }

  return null;
}
