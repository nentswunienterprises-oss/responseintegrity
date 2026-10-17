import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { SANDBOX_NATIVE_DRILL_PAYLOAD_SQL } from "./sandboxNativeDrillPayload";

test("native Handover reader accepts both persisted representations without rewriting them", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE historical_drills (id text, drill jsonb)");
    const payload = { drillType: "handover_verification", handoverMode: "verification", phase: "Clarity", sets: [{ observations: [{ vocabulary: "Observed" }] }] };
    const inputs = [payload, JSON.stringify(payload), "broken {", "[]", null, [payload], 42];
    for (let i = 0; i < inputs.length; i++) {
      await db.query("INSERT INTO historical_drills VALUES ($1,$2::jsonb)", [String(i), JSON.stringify(inputs[i])]);
    }
    const result = await db.query<{ id: string; payload: unknown }>(`SELECT h.id,${SANDBOX_NATIVE_DRILL_PAYLOAD_SQL} AS payload FROM historical_drills h ORDER BY h.id`);
    assert.deepEqual(result.rows.slice(0, 2).map(r => r.payload), [payload, payload]);
    assert.deepEqual(result.rows.slice(2).map(r => r.payload), [null, null, null, null, null]);
    const original = await db.query<{ drill: unknown }>("SELECT drill FROM historical_drills WHERE id='1'");
    assert.equal(original.rows[0].drill, JSON.stringify(payload), "Do not migrate or overwrite historical evidence");
  } finally { await db.close(); }
});
