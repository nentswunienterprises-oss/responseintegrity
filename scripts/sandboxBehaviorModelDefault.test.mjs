import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("new Sandbox trajectory truth defaults to Behaviour Model V2 without rewriting history", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA private;
      CREATE TABLE private.specialist_sandbox_trajectory_truth (
        trajectory_id text PRIMARY KEY,
        behavior_model_version smallint NOT NULL DEFAULT 1,
        CONSTRAINT specialist_sandbox_behavior_model_version_ck
          CHECK (behavior_model_version IN (1, 2))
      );
      INSERT INTO private.specialist_sandbox_trajectory_truth
        (trajectory_id, behavior_model_version)
      VALUES ('historical-v1', 1), ('existing-v2', 2);
    `);

    const migration = await readFile(
      new URL("../migrations/20261111120000_sandbox_behavior_model_v2_default.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);

    const historical = await db.query(`
      SELECT trajectory_id, behavior_model_version
      FROM private.specialist_sandbox_trajectory_truth
      ORDER BY trajectory_id
    `);
    assert.deepEqual(historical.rows, [
      { trajectory_id: "existing-v2", behavior_model_version: 2 },
      { trajectory_id: "historical-v1", behavior_model_version: 1 },
    ]);

    await db.query(`
      INSERT INTO private.specialist_sandbox_trajectory_truth (trajectory_id)
      VALUES ('new-specialist')
    `);
    const created = await db.query(`
      SELECT behavior_model_version
      FROM private.specialist_sandbox_trajectory_truth
      WHERE trajectory_id = 'new-specialist'
    `);
    assert.equal(created.rows[0]?.behavior_model_version, 2);

    await assert.rejects(
      db.query(`
        INSERT INTO private.specialist_sandbox_trajectory_truth
          (trajectory_id, behavior_model_version)
        VALUES ('invalid-version', 3)
      `),
      /violates check constraint|check constraint/i,
    );
  } finally {
    await db.close();
  }
});
