import assert from "node:assert/strict";
import test from "node:test";
import type { createClient } from "@supabase/supabase-js";
import {
  P0_HUB_REST_ORIGIN,
  P0_RENDER_SERVICE,
  verifyP0RenderPrivilegedCredential,
} from "./p0RenderRuntimePreflight";

const SECRET = "sb_secret_fake_for_isolated_contract_test_no_network_12345";
const ENV = {
  RENDER_SERVICE_ID: P0_RENDER_SERVICE,
  RENDER_GIT_COMMIT: "fictional-commit",
  SUPABASE_URL: P0_HUB_REST_ORIGIN,
  SUPABASE_SECRET_KEY: SECRET,
};

function fakeClient(adminFailure = false, restFailure = false) {
  const calls: string[] = [];
  const create = ((url: string, key: string) => {
    assert.equal(url, P0_HUB_REST_ORIGIN);
    assert.equal(key, SECRET);
    return {
      auth: {
        admin: {
          async listUsers(params: {page: number, perPage: number}) {
            calls.push("admin");
            assert.deepEqual(params, {page:1,perPage:1});
            return {error: adminFailure ? {message:"authorization failed"} : null};
          },
        },
      },
      from(table: string) {
        calls.push("from");
        assert.equal(table, "users");
        return {
          select(column: string) {
            assert.equal(column, "id");
            return {
              async limit(n: number) {
                calls.push("rest");
                assert.equal(n, 0);
                return {error: restFailure ? {message:"permission denied"} : null};
              },
            };
          },
        };
      },
    };
  }) as unknown as typeof createClient;
  return { create, calls };
}

test("does not run in other services, Proof, Vercel, or local tests", async () => {
  const fake = fakeClient();
  const output = await verifyP0RenderPrivilegedCredential(
    { ...ENV, RENDER_SERVICE_ID: "other-service" }, fake.create
  );
  assert.equal(output, null);
  assert.deepEqual(fake.calls, []);
});

test("blocks wrong Supabase target before selecting credentials", async () => {
  const fake = fakeClient();
  const output = await verifyP0RenderPrivilegedCredential(
    { ...ENV, SUPABASE_URL: "https://other.supabase.co" }, fake.create
  );
  assert.equal(output?.status, "BLOCKED");
  assert.equal(output?.reason, "wrong_rest_project");
  assert.deepEqual(fake.calls, []);
});

test("blocks when only a publishable credential is available", async () => {
  const fake = fakeClient();
  const output = await verifyP0RenderPrivilegedCredential(
    { ...ENV, SUPABASE_SECRET_KEY: "", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake_123" },
    fake.create,
  );
  assert.equal(output?.status, "BLOCKED");
  assert.equal(output?.reason, "missing_or_invalid_privileged_credential");
  assert.deepEqual(fake.calls, []);
});

test("failed admin probe does not continue to REST", async () => {
  const fake = fakeClient(true);
  const output = await verifyP0RenderPrivilegedCredential(ENV, fake.create);
  assert.equal(output?.reason, "admin_probe_denied");
  assert.equal(output?.adminProbe, "NOT_RUN");
  assert.deepEqual(fake.calls, ["admin"]);
});

test("failed privileged REST probe cannot be reported as successful", async () => {
  const fake = fakeClient(false, true);
  const output = await verifyP0RenderPrivilegedCredential(ENV, fake.create);
  assert.equal(output?.status, "BLOCKED");
  assert.equal(output?.adminProbe, "PASS");
  assert.equal(output?.reason, "rest_probe_denied");
  assert.deepEqual(fake.calls, ["admin", "from", "rest"]);
});

test("passes only admin and REST and emits no secret or personal data", async () => {
  const fake = fakeClient();
  const output = await verifyP0RenderPrivilegedCredential(ENV, fake.create);
  assert.equal(output?.status, "PASS");
  assert.equal(output?.credentialKind, "secret");
  assert.equal(output?.sourceCommit, "fictional-commit");
  assert.equal(output?.adminProbe, "PASS");
  assert.equal(output?.restProbe, "PASS");
  assert.equal(output?.reason, null);
  const log = JSON.stringify(output);
  assert.ok(!log.includes(SECRET));
  assert.ok(!log.includes("user@example.com"));
  assert.deepEqual(fake.calls, ["admin", "from", "rest"]);
});
