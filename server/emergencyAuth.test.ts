import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  authenticateEmergencyUser,
  createEmergencyTutorAccount,
  resetEmergencyLoginAttempts,
} from "./emergencyAuth";

const password = "existing-password";

function createPool(rows: unknown[]) {
  return {
    query: async () => ({ rows }),
  } as any;
}

function createTransactionalPool(options: { failCredentialInsert?: boolean; duplicateSource?: string } = {}) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") return { rows: [] };
      if (text.includes("FROM auth.users")) {
        return { rows: options.duplicateSource ? [{ source: options.duplicateSource }] : [] };
      }
      if (text.includes("INSERT INTO public.users")) {
        return { rows: [{ id: "new-tutor-id", email: "new@example.com", role: "tutor" }] };
      }
      if (options.failCredentialInsert) throw new Error("credential insert failed");
      return { rows: [] };
    },
    release: () => undefined,
  };
  return {
    pool: { connect: async () => client } as any,
    queries,
  };
}

async function createAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "auth-user-1",
    email: "user@example.com",
    encrypted_password: await bcrypt.hash(password, 4),
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    banned_until: null,
    deleted_at: null,
    is_anonymous: false,
    raw_app_meta_data: {},
    raw_user_meta_data: {},
    ...overrides,
  };
}

test("emergency auth accepts a valid confirmed password", async () => {
  resetEmergencyLoginAttempts();
  const result = await authenticateEmergencyUser(
    createPool([await createAuthUser()]),
    " USER@EXAMPLE.COM ",
    password,
    "127.0.0.1",
  );

  assert.equal("authUser" in result, true);
  if ("authUser" in result) assert.equal(result.authUser.id, "auth-user-1");
});

test("emergency auth rejects wrong and unknown credentials generically", async () => {
  resetEmergencyLoginAttempts();
  const userResult = await authenticateEmergencyUser(
    createPool([await createAuthUser()]),
    "user@example.com",
    "wrong-password",
    "127.0.0.1",
  );
  const unknownResult = await authenticateEmergencyUser(
    createPool([]),
    "unknown@example.com",
    "wrong-password",
    "127.0.0.1",
  );

  assert.deepEqual(userResult, { error: "invalid" });
  assert.deepEqual(unknownResult, { error: "invalid" });
});

test("emergency auth rejects deleted, banned, anonymous, and unconfirmed users", async () => {
  for (const overrides of [
    { deleted_at: "2026-01-01T00:00:00.000Z" },
    { banned_until: "2099-01-01T00:00:00.000Z" },
    { is_anonymous: true },
    { email_confirmed_at: null },
    { encrypted_password: null },
  ]) {
    resetEmergencyLoginAttempts();
    const result = await authenticateEmergencyUser(
      createPool([await createAuthUser(overrides)]),
      "user@example.com",
      password,
      "127.0.0.1",
    );
    assert.deepEqual(result, { error: "invalid" });
  }
});

test("emergency auth throttles repeated failures by email and IP", async () => {
  resetEmergencyLoginAttempts();
  const pool = createPool([]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await authenticateEmergencyUser(pool, "user@example.com", "wrong-password", "127.0.0.1");
  }

  assert.deepEqual(
    await authenticateEmergencyUser(pool, "user@example.com", password, "127.0.0.1"),
    { error: "throttled" },
  );
  assert.equal(
    "authUser" in await authenticateEmergencyUser(
      createPool([await createAuthUser()]),
      "user@example.com",
      password,
      "127.0.0.2",
    ),
    true,
  );
});

test("emergency tutor signup uses one transaction and persists only a bcrypt credential", async () => {
  const { pool, queries } = createTransactionalPool();
  const result = await createEmergencyTutorAccount(pool, {
    email: "new@example.com",
    password: "StrongPass!123",
    firstName: "New",
    lastName: "Tutor",
    trackingSource: "organic",
  });

  assert.equal(result.id, "new-tutor-id");
  const userInsert = queries.find(({ text }) => text.includes("INSERT INTO public.users"));
  const credentialInsert = queries.find(({ text }) => text.includes("private.emergency_auth_credentials"));
  assert.ok(userInsert);
  assert.ok(credentialInsert);
  assert.equal(userInsert?.text.includes("password"), false);
  assert.equal(credentialInsert?.values?.includes("StrongPass!123"), false);
  assert.match(String(credentialInsert?.values?.[1]), /^\$2[aby]\$/);
  assert.equal(queries.at(-1)?.text, "COMMIT");
});

test("emergency tutor signup rolls back when credential persistence fails", async () => {
  const { pool, queries } = createTransactionalPool({ failCredentialInsert: true });
  await assert.rejects(() => createEmergencyTutorAccount(pool, {
    email: "rollback@example.com",
    password: "StrongPass!123",
    firstName: "Rollback",
    lastName: "Tutor",
  }));
  assert.equal(queries.at(-1)?.text, "ROLLBACK");
  assert.equal(queries.some(({ text }) => text === "COMMIT"), false);
});

test("emergency-created tutor can authenticate through the private credential fallback", async () => {
  const hash = await bcrypt.hash("StrongPass!123", 4);
  let queryNumber = 0;
  const pool = {
    query: async () => {
      queryNumber += 1;
      if (queryNumber === 1) return { rows: [] };
      if (queryNumber === 2) return { rows: [{ id: "new-tutor-id", email: "new@example.com", role: "tutor" }] };
      return { rows: [{ user_id: "new-tutor-id", password_hash: hash }] };
    },
  } as any;

  const result = await authenticateEmergencyUser(pool, "new@example.com", "StrongPass!123", "127.0.0.1");
  assert.equal("authUser" in result, true);
  if ("authUser" in result) {
    assert.equal(result.authUser.id, "new-tutor-id");
    assert.equal(result.authUser.email_confirmed_at, null);
  }
});

for (const duplicateSource of ["auth", "public"]) {
  test(`emergency tutor signup rejects duplicate ${duplicateSource} email`, async () => {
    const { pool, queries } = createTransactionalPool({ duplicateSource });
    await assert.rejects(
      () => createEmergencyTutorAccount(pool, {
        email: "duplicate@example.com",
        password: "StrongPass!123",
        firstName: "Duplicate",
        lastName: "Tutor",
      }),
      (error: unknown) => (error as { code?: string }).code === "DUPLICATE_EMAIL",
    );
    assert.equal(queries.at(-1)?.text, "ROLLBACK");
    assert.equal(queries.some(({ text }) => text.includes("INSERT INTO public.users")), false);
  });
}