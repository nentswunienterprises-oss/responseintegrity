import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  sandboxV1ToV2BoundaryReached,
  sandboxV1ToV2EvidenceAccepted,
  type SandboxBoundaryEvidence,
} from "./sandboxModelTransitionPolicy";

test("V1 stays in V1 until the session has actually finalized", () => {
  const base={currentVersion:1,planStatus:"pending" as const,completingSession:4};
  assert.equal(sandboxV1ToV2BoundaryReached({...base,currentSession:4}),"not_yet");
  assert.equal(sandboxV1ToV2BoundaryReached({...base,currentSession:5}),"eligible");
  assert.equal(sandboxV1ToV2BoundaryReached({...base,currentSession:6}),"invalid");
  assert.equal(sandboxV1ToV2BoundaryReached({...base,currentVersion:2,currentSession:5}),"invalid");
  assert.equal(sandboxV1ToV2BoundaryReached({
    currentVersion:2,planStatus:"activated",completingSession:4,currentSession:5,
  }),"already_active");
});

const accepted:SandboxBoundaryEvidence={
  expectedTotalReps:27, recordedTotalReps:27, pairedPrivateTruthRows:27,
  boundaryReps:9, requiredBoundaryReps:9, followingSessionReps:0,
  evaluatedSessions:4,boundarySessionNumber:4,bookedSessionCompletions:1,
  lastEventSequence:27,lastOutcomeKey:"time_pressure.full_constraint.rep_3.pattern_3",
};

test("Only genuine observed final V1 evidence can trigger a V2 transition", () => {
  assert.equal(sandboxV1ToV2EvidenceAccepted(accepted),true);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,recordedTotalReps:26}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,pairedPrivateTruthRows:26}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,boundaryReps:8}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,followingSessionReps:1}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,evaluatedSessions:3}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,bookedSessionCompletions:0}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,bookedSessionCompletions:2}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({...accepted,lastEventSequence:26}),false);
  assert.equal(sandboxV1ToV2EvidenceAccepted({
    ...accepted,lastOutcomeKey:"time_pressure.full_constraint.rep_3.pattern_8",
  }),false,"A rejected fictional confound can never unlock the new model.");
  assert.equal(sandboxV1ToV2EvidenceAccepted({
    ...accepted,lastOutcomeKey:"time_pressure.full_constraint.rep_3.pattern_7",
  }),false,"An authored missing-observation incident can never unlock the new model.");
  assert.equal(sandboxV1ToV2EvidenceAccepted({
    ...accepted,lastOutcomeKey:"time_pressure.full_constraint.rep_3.pattern_6",
  }),true,"A valid breakdown is evidence, not an excuse to force success.");
});

test("V1 pending rep is reissued without fictional incidents, and only the current model changes", () => {
  const runner = readFileSync(new URL("../server/sandboxEnvironment.ts",import.meta.url),"utf8");
  const transition = readFileSync(new URL("../server/sandboxModelTransition.ts",import.meta.url),"utf8");
  const migration = readFileSync(new URL("../migrations/20261014122500_sandbox_v1_v2_boundary_transition.sql",import.meta.url),"utf8");
  assert.ok(runner.includes("retiredV1Incident"));
  assert.ok(runner.includes("v1-retired-fictional-exceptions-v1"));
  assert.ok(runner.includes("activateApprovedSandboxModelTransition"));
  assert.ok(transition.includes("SELECT to_regclass($1)"));
  assert.ok(transition.includes("sandbox-complete:"));
  assert.ok(transition.includes("sandboxV1ToV2EvidenceAccepted"));
  assert.ok(transition.includes("private.specialist_sandbox_trajectory_truth"));
  assert.ok(transition.includes("private.specialist_sandbox_behavior_model_transitions"));
  assert.ok(!transition.includes("UPDATE public.specialist_sandbox_rep_events"));
  assert.ok(!transition.includes("DELETE FROM"));
  assert.ok(!transition.includes("TRUNCATE"));
  assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
  assert.ok(migration.includes("REVOKE ALL ON TABLE"));
  assert.ok(migration.includes("REFERENCES public.specialist_sandbox_trajectories"));
});
