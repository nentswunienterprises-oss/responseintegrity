import { defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";

// Canonical Sandbox evidence must be re-authorized online, never restored offline.
export function shouldPersistQuery(query: Query) {
  return !query.queryKey.includes("sandbox-evidence-dossier") &&
    !query.queryKey.includes("sandbox-qualification-review") &&
    !query.queryKey.includes("sandbox-map-preparation-plan") && defaultShouldDehydrateQuery(query);
}
