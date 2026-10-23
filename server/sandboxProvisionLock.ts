import type { Pool } from "pg";

const SANDBOX_PROVISION_LOCK_PREFIX = "sandbox-account-provision";

export async function withSandboxProvisionLock<T>(
  db: Pick<Pool, "connect">,
  tutorId: string,
  work: () => Promise<T>,
  options: { transactionScoped?: boolean } = {},
): Promise<T> {
  const normalizedTutorId = String(tutorId || "").trim();
  if (!normalizedTutorId) {
    throw new Error("Sandbox provisioning requires a Specialist identity.");
  }

  const client = await db.connect();
  if (options.transactionScoped) {
    // Transaction pooling pins the backend only inside BEGIN/COMMIT. A
    // session-level lock/unlock pair can otherwise run on different backends.
    // This versioned namespace is limited by the caller to the isolated proof
    // rollout, whose earlier request failed before entering provision work.
    const key = `${SANDBOX_PROVISION_LOCK_PREFIX}:transaction-v2:${normalizedTutorId}`;
    let destroy = false;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
      const result = await work();
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { destroy = true; }
      throw error;
    } finally {
      client.release(destroy);
    }
  }
  const lockKey = `${SANDBOX_PROVISION_LOCK_PREFIX}:${normalizedTutorId}`;
  let locked = false;
  let destroyConnection = false;

  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended($1, 0))",
      [lockKey],
    );
    locked = true;
    return await work();
  } finally {
    if (locked) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [lockKey],
        );
      } catch (error) {
        destroyConnection = true;
        console.error("Failed to release Sandbox provisioning lock", {
          tutorId: normalizedTutorId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    client.release(destroyConnection);
  }
}
