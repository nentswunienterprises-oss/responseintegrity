import test from "node:test";
import assert from "node:assert/strict";
import { loadPracticalEntryStatus } from "./practicalEntryStatus";

const assignment = {
  id: "assignment-proof",
  pod_id: "pod-proof",
  operational_mode: "sandbox",
  td_id: "td-proof",
};
const baseReadiness = {
  practicalsReady: false,
  policyStatus: "candidate",
  policyVersion: 2,
  bankKey: "sandbox_stateful_environment",
  bankVersion: 4,
  qualification: {
    policyId: "ri-sandbox-qualification",
    policyVersion: 2,
    qualificationReady: false,
    evidenceFingerprint: "real-evidence-not-ready",
  },
};

test("synthetic readiness fixture opens only the isolated Proof Preview entry gate", async () => {
  const env = process.env;
  const previous = {
    VERCEL_ENV: env.VERCEL_ENV,
    SUPABASE_URL: env.SUPABASE_URL,
    DATABASE_URL: env.DATABASE_URL,
    RI_PROOF_SYNTHETIC_PRACTICALS_V1: env.RI_PROOF_SYNTHETIC_PRACTICALS_V1,
  };
  Object.assign(env, {
    VERCEL_ENV: "preview",
    SUPABASE_URL: "https://jftlxeacphvbnhbsbpxc.supabase.co",
    DATABASE_URL: "postgres://postgres.jftlxeacphvbnhbsbpxc:fixture@aws-0-eu-central-2.pooler.supabase.com:6543/postgres",
    RI_PROOF_SYNTHETIC_PRACTICALS_V1: "true",
  });
  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM tutor_assignments")) return { rows: [assignment] };
      if (sql.includes("FROM public.tutor_sandbox_mock_assessments")) return { rows: [] };
      if (sql.includes("proof_synthetic_practical_readiness_fixtures")) return {
        rows: [{ id: "fixture-id", tutor_id: "specialist-proof", tutor_assignment_id: "assignment-proof",
          td_id: "td-proof", fixture_label: "PROOF SYNTHETIC PRACTICALS ACCEPTANCE" }],
      };
      throw new Error("Unexpected query");
    },
  };
  try {
    const result = await loadPracticalEntryStatus(db, async () => baseReadiness, "assignment-proof", "specialist-proof");
    assert.equal(result.ready, true, JSON.stringify(result));
    assert.equal(result.proofSyntheticPath, true);
    assert.equal(result.signoffId, null);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete (env as Record<string, string | undefined>)[key];
      else (env as Record<string, string | undefined>)[key] = value;
    }
  }
});

test("synthetic readiness fixture is not queried outside Proof Preview", async () => {
  const env = process.env;
  const previous = { VERCEL_ENV: env.VERCEL_ENV, SUPABASE_URL: env.SUPABASE_URL,
    DATABASE_URL: env.DATABASE_URL, RI_PROOF_SYNTHETIC_PRACTICALS_V1: env.RI_PROOF_SYNTHETIC_PRACTICALS_V1 };
  Object.assign(env, { VERCEL_ENV: "production", SUPABASE_URL: "https://jftlxeacphvbnhbsbpxc.supabase.co",
    DATABASE_URL: "postgres://postgres.jftlxeacphvbnhbsbpxc:fixture@aws-0-eu-central-2.pooler.supabase.com:6543/postgres",
    RI_PROOF_SYNTHETIC_PRACTICALS_V1: "true" });
  let fixtureQueried = false;
  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM tutor_assignments")) return { rows: [assignment] };
      if (sql.includes("FROM public.tutor_sandbox_mock_assessments")) return { rows: [] };
      if (sql.includes("proof_synthetic_practical_readiness_fixtures")) fixtureQueried = true;
      return { rows: [] };
    },
  };
  try {
    const result = await loadPracticalEntryStatus(db, async () => baseReadiness, "assignment-proof", "specialist-proof");
    assert.equal(result.ready, false);
    assert.equal(result.proofSyntheticPath, false);
    assert.equal(fixtureQueried, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete (env as Record<string, string | undefined>)[key];
      else (env as Record<string, string | undefined>)[key] = value;
    }
  }
});
