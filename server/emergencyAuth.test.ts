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

test("emergency auth records distinct internal reasons while preserving the same public invalid class", async () => {
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

  assert.deepEqual(userResult, { error: "invalid", reason: "password_mismatch" });
  assert.deepEqual(unknownResult, { error: "invalid", reason: "account_not_found" });
  assert.equal(userResult.error, unknownResult.error);
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
    assert.deepEqual(result, { error: "invalid", reason: "account_unavailable" });
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
    { error: "throttled", reason: "throttled" },
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
test("emergency private-credential fallback distinguishes missing credential from wrong password internally", async () => {
  resetEmergencyLoginAttempts();

  let missingQuery = 0;
  const missingCredentialPool = {
    query: async () => {
      missingQuery += 1;
      if (missingQuery === 1) return { rows: [] };
      if (missingQuery === 2) {
        return { rows: [{ id: "public-user-1", email: "public@example.com", role: "tutor" }] };
      }
      return { rows: [] };
    },
  } as any;

  const missingCredentialResult = await authenticateEmergencyUser(
    missingCredentialPool,
    "public@example.com",
    "some-password",
    "127.0.0.1",
  );
  assert.deepEqual(missingCredentialResult, {
    error: "invalid",
    reason: "credential_not_provisioned",
  });

  resetEmergencyLoginAttempts();
  const hash = await bcrypt.hash("correct-password", 4);
  let wrongQuery = 0;
  const wrongPasswordPool = {
    query: async () => {
      wrongQuery += 1;
      if (wrongQuery === 1) return { rows: [] };
      if (wrongQuery === 2) {
        return { rows: [{ id: "public-user-2", email: "public2@example.com", role: "tutor" }] };
      }
      return { rows: [{ user_id: "public-user-2", password_hash: hash }] };
    },
  } as any;

  const wrongPasswordResult = await authenticateEmergencyUser(
    wrongPasswordPool,
    "public2@example.com",
    "wrong-password",
    "127.0.0.1",
  );
  assert.deepEqual(wrongPasswordResult, {
    error: "invalid",
    reason: "password_mismatch",
  });
});


test("preview emergency auth lazily repairs a real sandbox parent missing its private credential", async () => {
  resetEmergencyLoginAttempts();
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  const storedHash = await bcrypt.hash("SandboxPass123!", 4);
  const queries: string[] = [];
  let credentialReadCount = 0;

  const pool = {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes("FROM auth.users")) return { rows: [] };
      if (text.includes("FROM public.users")) {
        return {
          rows: [{
            id: "sandbox-parent-id",
            email: "sandbox-parent-proof@gmail.com",
            role: "parent",
          }],
        };
      }
      if (text.includes("FROM private.emergency_auth_credentials")) {
        credentialReadCount += 1;
        return credentialReadCount === 1
          ? { rows: [] }
          : { rows: [{ user_id: "sandbox-parent-id", password_hash: storedHash }] };
      }
      if (text.includes("FROM public.parent_enrollments")) {
        return { rows: [{ id: "sandbox-enrollment-id" }] };
      }
      if (text.includes("INSERT INTO private.emergency_auth_credentials")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  } as any;

  try {
    const result = await authenticateEmergencyUser(
      pool,
      "sandbox-parent-proof@gmail.com",
      "SandboxPass123!",
      "127.0.0.1",
    );
    assert.equal("authUser" in result, true);
    assert.equal(
      queries.some((text) => text.includes("INSERT INTO private.emergency_auth_credentials")),
      true,
    );
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("preview emergency auth does not repair a sandbox parent when the supplied password is wrong", async () => {
  resetEmergencyLoginAttempts();
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  const queries: string[] = [];

  const pool = {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes("FROM auth.users")) return { rows: [] };
      if (text.includes("FROM public.users")) {
        return {
          rows: [{
            id: "sandbox-parent-id",
            email: "sandbox-parent-proof@gmail.com",
            role: "parent",
          }],
        };
      }
      if (text.includes("FROM private.emergency_auth_credentials")) return { rows: [] };
      if (text.includes("FROM public.parent_enrollments")) {
        return { rows: [{ id: "sandbox-enrollment-id" }] };
      }
      return { rows: [] };
    },
  } as any;

  try {
    const result = await authenticateEmergencyUser(
      pool,
      "sandbox-parent-proof@gmail.com",
      "wrong-password",
      "127.0.0.1",
    );
    assert.deepEqual(result, { error: "invalid", reason: "password_mismatch" });
    assert.equal(
      queries.some((text) => text.includes("INSERT INTO private.emergency_auth_credentials")),
      false,
    );
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});


test("preview emergency auth repairs a recognized synthetic Specialist with the shared sandbox password", async () => {
  resetEmergencyLoginAttempts();
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  const storedHash = await bcrypt.hash("SandboxPass123!", 4);
  const queries: string[] = [];
  let credentialReadCount = 0;

  const pool = {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes("FROM auth.users")) return { rows: [] };
      if (text.includes("FROM public.users")) {
        return {
          rows: [{
            id: "proof-specialist-id",
            email: "proof-shadow-a@responseintegrity.test",
            role: "tutor",
          }],
        };
      }
      if (text.includes("FROM private.emergency_auth_credentials")) {
        credentialReadCount += 1;
        return credentialReadCount === 1
          ? { rows: [] }
          : { rows: [{ user_id: "proof-specialist-id", password_hash: storedHash }] };
      }
      if (text.includes("INSERT INTO private.emergency_auth_credentials")) return { rows: [] };
      return { rows: [] };
    },
  } as any;

  try {
    const result = await authenticateEmergencyUser(
      pool,
      "proof-shadow-a@responseintegrity.test",
      "SandboxPass123!",
      "127.0.0.1",
    );
    assert.equal("authUser" in result, true);
    assert.equal(
      queries.some((text) => text.includes("INSERT INTO private.emergency_auth_credentials")),
      true,
    );
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("preview emergency auth accepts the shared sandbox password for a synthetic persona with stale Supabase Auth", async () => {
  resetEmergencyLoginAttempts();
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  const authUser = await createAuthUser({
    id: "proof-specialist-auth-id",
    email: "ri.proof.specialist@example.com",
    encrypted_password: await bcrypt.hash("old-proof-password", 4),
  });
  const queries: string[] = [];

  const pool = {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes("FROM auth.users")) return { rows: [authUser] };
      if (text.includes("FROM public.users")) return { rows: [{ id: "proof-specialist-auth-id" }] };
      if (text.includes("INSERT INTO private.emergency_auth_credentials")) return { rows: [] };
      return { rows: [] };
    },
  } as any;

  try {
    const result = await authenticateEmergencyUser(
      pool,
      "ri.proof.specialist@example.com",
      "SandboxPass123!",
      "127.0.0.1",
    );
    assert.equal("authUser" in result, true);
    assert.equal(
      queries.some((text) => text.includes("INSERT INTO private.emergency_auth_credentials")),
      true,
    );
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});
