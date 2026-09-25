import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertProductionDatabaseTarget,
  loadProductionMigrationAuthority,
  verifyProductionMigrationAuthority,
} from "./productionMigrationAuthority";

test("production DB authority locks the verified The Hub baseline", () => {
  const result = verifyProductionMigrationAuthority();
  assert.equal(result.authority.productionProjectName, "The Hub");
  assert.equal(result.authority.productionProjectRef, "yzcnavucvwgmulcxgxvw");
  assert.equal(result.authority.baseline.commit, "a8c1aab29b230ce523c0353cfcc4eb4b1ae07627");
  assert.equal(result.baselineCount, 15);
  assert.equal(result.managedCount, 0);
});

test("production target guard accepts only a URL carrying The Hub project ref", () => {
  const authority = loadProductionMigrationAuthority();

  assert.doesNotThrow(() =>
    assertProductionDatabaseTarget(
      "postgresql://postgres.yzcnavucvwgmulcxgxvw:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require",
      authority,
    ),
  );

  assert.throws(
    () =>
      assertProductionDatabaseTarget(
        "postgresql://postgres.jftlxeacphvbnhbsbpxc:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require",
        authority,
      ),
    /Refusing to connect to a different database/,
  );
});

test("production promotion workflow is manual-only", () => {
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), ".github/workflows/production-db-promotion.yml"),
    "utf8",
  );

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /environment: production-db/);
  assert.match(workflow, /RI_PRODUCTION_DATABASE_URL/);
  assert.match(workflow, /RI_PRODUCTION_MIGRATION_CONFIRMATION/);
});
