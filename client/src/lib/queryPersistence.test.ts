import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { shouldPersistQuery } from "./queryPersistence";

test("offline cache excludes canonical dossiers while preserving ordinary successful queries", () => {
  const client = new QueryClient();
  client.setQueryData(["/api/td/tutors", "specialist", "sandbox-evidence-dossier"], { canonicalAuthority: "PRIVATE" });
  client.setQueryData(["/api/td/tutors", "specialist", "sandbox-qualification-review"], { hiddenProfile: "PRIVATE-COVERAGE" });
  client.setQueryData(["/api/ordinary-progress"], { complete: true });
  const persisted = dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery });
  assert.equal(persisted.queries.length, 1);
  assert.deepEqual(persisted.queries[0].queryKey, ["/api/ordinary-progress"]);
  assert.doesNotMatch(JSON.stringify(persisted), /PRIVATE|canonicalAuthority|hiddenProfile/);
  client.clear();
});
