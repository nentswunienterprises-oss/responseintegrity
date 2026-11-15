import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertProductionDatabaseTarget,
  loadProductionMigrationAuthority,
  selectManagedMigrations,
  verifyProductionMigrationAuthority,
} from "./productionMigrationAuthority";

test("production DB authority locks the verified The Hub baseline", () => {
  const result = verifyProductionMigrationAuthority();
  assert.equal(result.authority.productionProjectName, "The Hub");
  assert.equal(result.authority.productionProjectRef, "yzcnavucvwgmulcxgxvw");
  assert.equal(result.authority.baseline.commit, "a8c1aab29b230ce523c0353cfcc4eb4b1ae07627");
  assert.equal(result.baselineCount, 15);
  assert.equal(result.managedCount, 27);
  assert.deepEqual(result.authority.previewOnlyMigrations?.map((migration) => migration.path), [
    "migrations/20261011_practicals_shared_video_benchmarks_v1.sql",
    "migrations/20261110_practicals_shared_video_benchmarks_v1_preview_compat.sql",
    "migrations/20261111043902_reconcile_scheduled_sessions_view_security.sql",
  ]);
  assert.equal(result.authority.managedMigrations.some((migration) => migration.path === "migrations/20261011_practicals_shared_video_benchmarks_v1.sql"), false);
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
        "migrations/20261109_scheduled_session_timezone_instants.sql",
        "migrations/20261110100000_parent_qualification_assessment.sql",
        "migrations/20261110101000_enforce_four_part_parent_qualification.sql",
        "migrations/20261111120000_sandbox_behavior_model_v2_default.sql",
        "migrations/20261115143000_sandbox_diagnosis_bank_v2_seed.sql",
        "migrations/20261115144000_sandbox_diagnosis_bank_v2_activate.sql"
    ],
  );
});

test("production target guard accepts only a URL carrying The Hub project ref", () => {
  const authority = loadProductionMigrationAuthority();

  assert.doesNotThrow(() =>
    assertProductionDatabaseTarget(
      `postgresql://${authority.productionProjectRef}.invalid/postgres?sslmode=verify-full`,
      authority,
    ),
  );

  assert.throws(
    () =>
      assertProductionDatabaseTarget(
        "postgresql://jftlxeacphvbnhbsbpxc.invalid/postgres?sslmode=verify-full",
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
  assert.match(workflow, /RI_PRODUCTION_MIGRATION_BATCH/);
  assert.match(workflow, /sandbox_diagnosis_v2_activate/);
});

test("production target guard rejects weaker TLS modes", () => {
  const authority = loadProductionMigrationAuthority();
  assert.throws(
    () =>
      assertProductionDatabaseTarget(
        `postgresql://${authority.productionProjectRef}.invalid/postgres?sslmode=require`,
        authority,
      ),
    /sslmode=verify-full/,
  );
});


test("production apply batches are explicit and exclude unrelated pending migrations", () => {
  const authority = loadProductionMigrationAuthority();
  const seed = selectManagedMigrations(authority, "sandbox_diagnosis_v2_seed");
  const activate = selectManagedMigrations(authority, "sandbox_diagnosis_v2_activate");
  assert.deepEqual(seed.map((item) => item.path), [
    "migrations/20261115143000_sandbox_diagnosis_bank_v2_seed.sql",
  ]);
  assert.deepEqual(activate.map((item) => item.path), [
    "migrations/20261115143000_sandbox_diagnosis_bank_v2_seed.sql",
    "migrations/20261115144000_sandbox_diagnosis_bank_v2_activate.sql",
  ]);
  assert.throws(() => selectManagedMigrations(authority, "all"), /Unknown or empty/);
  assert.throws(() => selectManagedMigrations(authority, ""), /must not be empty/);
});

test("V4 production activation is separately guarded and preserves the V1 bank", () => {
  const seed = fs.readFileSync(path.resolve(process.cwd(), "migrations/20261115143000_sandbox_diagnosis_bank_v2_seed.sql"), "utf8");
  const activation = fs.readFileSync(path.resolve(process.cwd(), "migrations/20261115144000_sandbox_diagnosis_bank_v2_activate.sql"), "utf8");
  assert.match(seed, /bank_version = 1[\s\S]*?active = true[\s\S]*?\) <> 56/);
  assert.match(seed, /'runtimeEligible',[\s\S]*?false/);
  assert.match(seed, /V2 must remain inactive/);
  assert.doesNotMatch(seed, /update\s+private\.specialist_sandbox_(?:environment_banks|diagnosis_outcomes|rep_outcomes)/i);
  assert.match(activation, /bank_version=1[\s\S]*?<> 56[\s\S]*?bank_version=1[\s\S]*?<> 264/);
  assert.match(activation, /bank_version=4[\s\S]*?<> 52[\s\S]*?bank_version=4[\s\S]*?<> 264/);
  assert.match(activation, /clarity\.method/);
  assert.match(activation, /When difficulty is introduced/);
  assert.match(activation, /update private\.specialist_sandbox_environment_banks[\s\S]*?bank_version=4/i);
  assert.doesNotMatch(activation, /update\s+private\.specialist_sandbox_(?:diagnosis_outcomes|rep_outcomes)/i);
});
