import type { Pool } from "pg";

const SANDBOX_PROVISION_LOCK_PREFIX = "sandbox-account-provision";

export async function withSandboxProvisionLock<T>(
  db: Pick<Pool, "connect">,
  tutorId: string,
  work: () => Promise<T>,
): Promise<T> {
  const normalizedTutorId = String(tutorId || "").trim();
  if (!normalizedTutorId) {
    throw new Error("Sandbox provisioning requires a Specialist identity.");
  }

  const client = await db.connect();
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
