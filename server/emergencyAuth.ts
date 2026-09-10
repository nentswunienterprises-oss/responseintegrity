import bcrypt from "bcryptjs";
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID } from "crypto";
import type { Pool } from "pg";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

type LoginAttempt = { failures: number; windowStartedAt: number; blockedUntil: number };

const attempts = new Map<string, LoginAttempt>();

function getAttemptKey(email: string, ip: string) {
  return `${email}\u0000${ip}`;
}

function getAttempt(email: string, ip: string, now: number) {
  const key = getAttemptKey(email, ip);
  const current = attempts.get(key);
  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    const fresh = { failures: 0, windowStartedAt: now, blockedUntil: 0 };
    attempts.set(key, fresh);
    return { key, attempt: fresh };
  }
  return { key, attempt: current };
}

export function resetEmergencyLoginAttempts() {
  attempts.clear();
}

export function isEmergencyLoginRateLimited(email: string, ip: string, now = Date.now()) {
  return getAttempt(email, ip, now).attempt.blockedUntil > now;
}

function recordFailure(key: string, attempt: LoginAttempt, now: number) {
  attempt.failures += 1;
  if (attempt.failures >= MAX_FAILURES) {
    attempt.blockedUntil = now + WINDOW_MS;
  }
  attempts.set(key, attempt);
}

export type EmergencyAuthUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

const EMERGENCY_BCRYPT_WORK_FACTOR = 10;

export function emergencyExpectedRoleMatches(userRole: string, expectedRole?: string | null) {
  return !expectedRole || userRole === expectedRole;
}

export type EmergencyTutorSignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  productionLinkCode?: string | null;
  trackingSource?: string | null;
  trackingCampaign?: string | null;
};

export async function createEmergencyTutorAccount(
  pool: Pool,
  input: EmergencyTutorSignupInput,
) {
  const client = await pool.connect();
  const userId = randomUUID();
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  try {
    await client.query("BEGIN");
    const duplicateResult = await client.query<{ source: string }>(
      `SELECT source
         FROM (
           SELECT 'auth' AS source FROM auth.users WHERE lower(email) = $1
           UNION ALL
           SELECT 'public' AS source FROM public.users WHERE lower(email) = $1
         ) duplicates
        LIMIT 1`,
      [input.email],
    );
    if (duplicateResult.rows.length > 0) {
      const error = new Error("An account with this email already exists.");
      (error as Error & { code?: string }).code = "DUPLICATE_EMAIL";
      throw error;
    }

    const passwordHash = await bcrypt.hash(input.password, EMERGENCY_BCRYPT_WORK_FACTOR);
    const userResult = await client.query(
      `INSERT INTO public.users (
         id, email, role, first_name, last_name, name,
         production_link_code, tracking_source, tracking_campaign
       )
       VALUES ($1, $2, 'tutor', $3, $4, $5, $6, $7, $8)
       RETURNING id, email, role, first_name, last_name, name`,
      [
        userId,
        input.email,
        input.firstName,
        input.lastName,
        fullName,
        input.productionLinkCode || null,
        input.trackingSource || null,
        input.trackingCampaign || null,
      ],
    );

    await client.query(
      `INSERT INTO private.emergency_auth_credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [userId, passwordHash],
    );
    await client.query("COMMIT");
    return userResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyEmergencyCredential(passwordHash: string, password: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function verifyEmergencyPasswordForUser(passwordHash: string, password: string) {
  return bcrypt.compare(password, passwordHash);
}

export function parseEmergencyDocumentEncryptionKey(rawKey?: string): Buffer {
  if (!rawKey || !rawKey.trim()) {
    throw new Error("EMERGENCY_DOCUMENT_ENCRYPTION_KEY is required for emergency onboarding file encryption.");
  }

  const trimmed = rawKey.trim();
  const candidates = [
    Buffer.from(trimmed, "utf8"),
    (() => {
      try {
        return Buffer.from(trimmed, "base64");
      } catch {
        return null;
      }
    })(),
  ].filter((candidate): candidate is Buffer => Boolean(candidate));

  const key = candidates.find((candidate) => candidate.length === 32) ?? null;
  if (!key) {
    throw new Error("EMERGENCY_DOCUMENT_ENCRYPTION_KEY must resolve to exactly 32 bytes of key material.");
  }

  return key;
}

export function createEmergencyFileBundle(plaintext: Buffer, rawKey: string): {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  sha256: string;
} {
  const key = parseEmergencyDocumentEncryptionKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    iv,
    authTag,
    sha256: createHash("sha256").update(plaintext).digest("hex"),
  };
}

export function decryptEmergencyFileBundle(
  bundle: { ciphertext: Buffer; iv: Buffer; authTag: Buffer },
  rawKey: string,
): Buffer {
  const key = parseEmergencyDocumentEncryptionKey(rawKey);
  const decipher = createDecipheriv("aes-256-gcm", key, bundle.iv);
  decipher.setAuthTag(bundle.authTag);
  return Buffer.concat([decipher.update(bundle.ciphertext), decipher.final()]);
}

export async function authenticateEmergencyUser(
  pool: Pool,
  email: string,
  password: string,
  ip: string,
): Promise<{ authUser: EmergencyAuthUser } | { error: "invalid" | "throttled" }> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const { key, attempt } = getAttempt(normalizedEmail, ip, now);

  if (attempt.blockedUntil > now) {
    return { error: "throttled" };
  }

  const result = await pool.query<EmergencyAuthUser & {
    encrypted_password: string | null;
    banned_until: string | null;
    deleted_at: string | null;
    is_anonymous: boolean | null;
  }>(
    `SELECT id, email, encrypted_password, email_confirmed_at, banned_until,
            deleted_at, is_anonymous, raw_app_meta_data, raw_user_meta_data
       FROM auth.users
      WHERE lower(email) = $1
      LIMIT 1`,
    [normalizedEmail],
  );

  const authUser = result.rows[0];
  const isBanned = authUser?.banned_until && new Date(authUser.banned_until).getTime() > now;
  const authUserMatches = Boolean(
    authUser &&
      authUser.encrypted_password &&
      !authUser.deleted_at &&
      !authUser.is_anonymous &&
      !isBanned &&
      authUser.email_confirmed_at &&
      await verifyEmergencyCredential(authUser.encrypted_password, password),
  );

  if (authUser) {
    if (!authUserMatches) {
      recordFailure(key, attempt, now);
      return { error: attempt.blockedUntil > now ? "throttled" : "invalid" };
    }

    attempts.delete(key);
    return {
      authUser: {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at,
        raw_app_meta_data: authUser.raw_app_meta_data,
        raw_user_meta_data: authUser.raw_user_meta_data,
      },
    };
  }

  const publicUserResult = await pool.query<{ id: string; email: string; role: string }>(
    `SELECT id, email, role
       FROM public.users
      WHERE lower(email) = $1
      LIMIT 1`,
    [normalizedEmail],
  );

  const publicUser = publicUserResult.rows[0];
  if (!publicUser) {
    recordFailure(key, attempt, now);
    return { error: attempt.blockedUntil > now ? "throttled" : "invalid" };
  }

  const credentialResult = await pool.query<{ user_id: string; password_hash: string }>(
    `SELECT user_id, password_hash
       FROM private.emergency_auth_credentials
      WHERE user_id = $1
      LIMIT 1`,
    [publicUser.id],
  );

  const credential = credentialResult.rows[0];
  const fallbackValid = Boolean(
    credential &&
      credential.password_hash &&
      await verifyEmergencyPasswordForUser(credential.password_hash, password),
  );

  if (!fallbackValid) {
    recordFailure(key, attempt, now);
    return { error: attempt.blockedUntil > now ? "throttled" : "invalid" };
  }

  attempts.delete(key);
  return {
    authUser: {
      id: publicUser.id,
      email: publicUser.email,
      email_confirmed_at: null,
      raw_app_meta_data: null,
      raw_user_meta_data: null,
    },
  };
}