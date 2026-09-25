import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const environmentSource = readFileSync(
  new URL("../server/sandboxEnvironment.ts", import.meta.url),
  "utf8",
);
const rediagnosisSource = readFileSync(
  new URL("../server/sandboxRediagnosis.ts", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("../client/src/pages/operational/tutor/sandbox-simulation.tsx", import.meta.url),
  "utf8",
);

test("Sandbox public history does not project canonical-named session truth", () => {
  assert.doesNotMatch(environmentSource, /canonicalStateChanged\s*:/);
  assert.doesNotMatch(environmentSource, /canonical_state_changed/);
  assert.match(environmentSource, /stateChangeObserved/);
});

test("Sandbox targeted re-diagnosis does not return canonical placement or canonical decision reason", () => {
  assert.doesNotMatch(rediagnosisSource, /canonicalPlacement\s*:/);
  assert.doesNotMatch(
    rediagnosisSource,
    /decisionReason\s*:\s*planned\.canonicalDecision\.reason/,
  );
  assert.doesNotMatch(clientSource, /canonicalPlacement\s*:/);
  assert.doesNotMatch(clientSource, /decisionReason\?\s*:/);
});

test("canonical re-diagnosis authority remains private server-side", () => {
  assert.match(
    rediagnosisSource,
    /private\.specialist_sandbox_rediagnosis_truth/,
  );
  assert.match(
    rediagnosisSource,
    /private\.specialist_sandbox_rediagnosis_turn_truth/,
  );
  assert.match(
    rediagnosisSource,
    /private\.specialist_sandbox_trajectory_truth/,
  );
  assert.doesNotMatch(
    rediagnosisSource,
    /return\s*\{[\s\S]{0,1200}canonicalDecision\s*:/,
  );
});

test("Sandbox re-diagnosis status write keeps one explicit SQL type for the reused parameter", () => {
  assert.match(rediagnosisSource, /status = \$4::varchar/);
  assert.match(
    rediagnosisSource,
    /CASE WHEN \$4::varchar <> 'active' THEN now\(\) ELSE NULL END/,
  );
});
