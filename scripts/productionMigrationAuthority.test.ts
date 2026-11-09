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
  assert.equal(result.managedCount, 22);
  assert.deepEqual(
    result.authority.managedMigrations.map((migration) => migration.path),
    [
        "migrations/20260927_diagnosis_activity_context_separation.sql",
        "migrations/2026-09-28_capability_interactive_feedback.sql",
        "migrations/20261001_tps_handover_timing_lineage.sql",
        "migrations/2026-10-02_add_capability_review_mode.sql",
        "migrations/2026-10-03_guard_capability_critical_boundary_requires_fail.sql",
        "migrations/20261004_specialist_development_pathway_authority.sql",
        "migrations/20261009_practicals_evidence_stage_v1.sql",
        "migrations/20261010_neutral_issue_reporting_v1.sql",
        "migrations/20261010_neutral_issue_reporting_service_grants.sql",
        "migrations/20261010_revoke_anon_sensitive_tables.sql",
        "migrations/20261010_trial_35_day_first_session.sql",
        "migrations/20261013_p0_anon_containment.sql",
        "migrations/20261013_p0_confidential_storage_private.sql",
        "migrations/20261014013817_sandbox_topic_state_lanes.sql",
        "migrations/20261014013826_sandbox_progression_authority.sql",
        "migrations/20261014013834_sandbox_behavior_model_v2.sql",
        "migrations/20261025_fix_legacy_battle_test_mode_enum.sql",
        "migrations/20261027_parent_subscription_management.sql",
        "migrations/2026-11-06_supersede_stale_parent_report_diagnoses.sql",
        "migrations/20261108_sandbox_entry_diagnosis_context.sql",
        "migrations/20261108_parent_enrollment_topic_response_symptom_ids.sql",
        "migrations/20261109_scheduled_session_timezone_instants.sql"
    ],
  );
});

test("production target guard accepts only a URL carrying The Hub project ref", () => {
  const authority = loadProductionMigrationAuthority();

  assert.doesNotThrow(() =>
    assertProductionDatabaseTarget(
      "postgresql://postgres.yzcnavucvwgmulcxgxvw:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
      authority,
    ),
  );

  assert.throws(
    () =>
      assertProductionDatabaseTarget(
        "postgresql://postgres.jftlxeacphvbnhbsbpxc:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
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
  assert.match(workflow, /RI_PRODUCTION_DB_CA_CERT/);
  assert.match(workflow, /NODE_EXTRA_CA_CERTS/);
  assert.doesNotMatch(workflow, /NODE_TLS_REJECT_UNAUTHORIZED/);
  assert.match(workflow, /RI_PRODUCTION_MIGRATION_CONFIRMATION/);
});

test("production target guard rejects weaker TLS modes", () => {
  const authority = loadProductionMigrationAuthority();
  assert.throws(
    () =>
      assertProductionDatabaseTarget(
        "postgresql://postgres.yzcnavucvwgmulcxgxvw:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
        authority,
      ),
    /sslmode=verify-full/,
  );
});
