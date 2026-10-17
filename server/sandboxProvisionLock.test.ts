import assert from "node:assert/strict";
import test from "node:test";
import { withSandboxProvisionLock } from "./sandboxProvisionLock";

test("Sandbox provisioning holds one Specialist-scoped advisory lock around the work", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      return { rows: [] };
    },
    release(destroy?: boolean) {
      calls.push({ sql: `release:${String(Boolean(destroy))}` });
    },
  };
  const db = { async connect() { return client; } };

  const result = await withSandboxProvisionLock(db as any, " specialist-1 ", async () => {
    calls.push({ sql: "work" });
    return "complete";
  });

  assert.equal(result, "complete");
  assert.deepEqual(calls, [
    {
      sql: "SELECT pg_advisory_lock(hashtextextended($1, 0))",
      values: ["sandbox-account-provision:specialist-1"],
    },
    { sql: "work" },
    {
      sql: "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
      values: ["sandbox-account-provision:specialist-1"],
    },
    { sql: "release:false" },
  ]);
});

test("Sandbox provisioning releases its advisory lock when provision work fails", async () => {
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql);
      return { rows: [] };
    },
    release(destroy?: boolean) {
      calls.push(`release:${String(Boolean(destroy))}`);
    },
  };
  const db = { async connect() { return client; } };

  await assert.rejects(
    withSandboxProvisionLock(db as any, "specialist-2", async () => {
      calls.push("work");
      throw new Error("provision failed");
    }),
    /provision failed/,
  );

  assert.deepEqual(calls, [
    "SELECT pg_advisory_lock(hashtextextended($1, 0))",
    "work",
    "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
    "release:false",
  ]);
});

test("Sandbox provisioning rejects an empty Specialist identity before connecting", async () => {
  let connected = false;
  const db = { async connect() { connected = true; throw new Error("unexpected"); } };

  await assert.rejects(
    withSandboxProvisionLock(db as any, " ", async () => undefined),
    /requires a Specialist identity/,
  );
  assert.equal(connected, false);
});
