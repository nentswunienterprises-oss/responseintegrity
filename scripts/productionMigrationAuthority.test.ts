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
  assert.equal(result.managedCount, 9);
  assert.deepEqual(result.authority.managedMigrations, [
    {
      path: "migrations/20260927_diagnosis_activity_context_separation.sql",
      description:
        "Add generated session-container and activity-kind semantics for diagnosis and evidence lineage without changing legacy context storage.",
      risk: "additive",
    },
    {
      path: "migrations/2026-09-28_capability_interactive_feedback.sql",
      description:
        "Add persisted per-question confirmations and assessment reflection fields for interactive Specialist Capability checks.",
      risk: "additive",
    },
    {
      path: "migrations/20261001_tps_handover_timing_lineage.sql",
      description:
        "Allow the dedicated Time Pressure Stability Handover continuity set ID while preserving the existing timed-attempt lineage table.",
      risk: "additive",
    },
    {
      path: "migrations/2026-10-02_add_capability_review_mode.sql",
      description:
        "Add the optional Capability review-mode flag used by Specialist Capability sequencing and isolated Proof review controls.",
      risk: "additive",
    },
    {
      path: "migrations/2026-10-03_guard_capability_critical_boundary_requires_fail.sql",
      description:
        "Add a fail-closed database guard requiring any Capability item tagged with a critical boundary to include at least one critical-fail option.",
      risk: "additive",
    },
    {
      path: "migrations/20261004_specialist_development_pathway_authority.sql",
      description:
        "Restore the public Specialist Development Pathway table required by the longitudinal development record and existing Trial governance, with server-only Data API access and non-retroactive backfill inside the current 90-day maximum window.",
      risk: "additive",
    },
    {
      path: "migrations/20261009_practicals_evidence_stage_v1.sql",
      description:
        "Create governed post-Sandbox Practicals submission and TD review evidence, server-only stateful Execute challenge truth and append-only live response transcript without changing Trial or live permission.",
      risk: "additive",
    },
    {
      path: "migrations/20261010_neutral_issue_reporting_v1.sql",
      description:
        "Add role-scoped neutral issue reporting for Technology, Operations, and People with protected intake, status ledger and no browser table access.",
      risk: "additive",
    },
    {
      path: "migrations/20261010_neutral_issue_reporting_service_grants.sql",
      description:
        "Restrict default Supabase service_role grants to required intake and append-only issue history permissions.",
      risk: "additive",
    },
  ]);
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
