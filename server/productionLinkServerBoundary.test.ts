import assert from "node:assert/strict";
import test from "node:test";
import { claimProductionLeadIfUnattributed } from "./productionLinkPersistence";

function makeLeadClient(result: any) {
  const calls: string[] = [];
  const builder = {
    from(table: string) { calls.push(`from:${table}`); return this; },
    update() { calls.push("update"); return this; },
    eq(column: string, value: unknown) { calls.push(`eq:${column}=${value}`); return this; },
    is(column: string, value: unknown) { calls.push(`is:${column}=${value}`); return this; },
    select() { calls.push("select"); return this; },
    async maybeSingle() { return { data: result, error: null }; },
  };
  return { client: builder, calls };
}

test("server lead claim uses an atomic null predicate", async () => {
  const { client, calls } = makeLeadClient({ id: "lead-1", production_link_code: "DEM001" });
  const claimed = await claimProductionLeadIfUnattributed(client, "lead-1", "owner-1", "DEM001", "email", "pilot");
  assert.equal(claimed.production_link_code, "DEM001");
  assert.deepEqual(calls, [
    "from:leads",
    "update",
    "eq:id=lead-1",
    "is:production_link_code=null",
    "select",
  ]);
});

test("a competing claim that updates zero rows cannot overwrite attribution", async () => {
  const { client } = makeLeadClient(null);
  const claimed = await claimProductionLeadIfUnattributed(client, "lead-1", "owner-2", "DEM002");
  assert.equal(claimed, null);
});