import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authoritySource = readFileSync(
  new URL("./tpsTimingAuthority.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("./tpsTimingRoutes.ts", import.meta.url),
  "utf8",
);
const runnerSource = readFileSync(
  new URL("../client/src/components/tutor/IntroSessionDrillRunner.tsx", import.meta.url),
  "utf8",
);

test("TPS timed evidence is recovered by immutable contract/set/rep slot after reload", () => {
  assert.match(authoritySource, /loadLatestTpsTimedAttemptForSlot/);
  assert.match(
    authoritySource,
    /contract_id = \$1[\s\S]*set_id = \$2[\s\S]*rep_number = \$3[\s\S]*ORDER BY attempt_number DESC/,
  );
  assert.match(
    authoritySource,
    /TPS_TIMED_ATTEMPT_SLOT_ALREADY_RECORDED/,
  );

  assert.match(
    routeSource,
    /app\.get\([\s\S]*\/api\/tutor\/students\/:studentId\/tps-timed-attempt/,
  );
  assert.match(routeSource, /loadLatestTpsTimedAttemptForSlot/);

  assert.match(runnerSource, /loadTpsAttemptForSlot/);
  assert.match(
    runnerSource,
    /TPS timing was already recorded for this opportunity/,
  );
  assert.match(
    runnerSource,
    /encodeTpsTimedAttemptEvidenceRef\([\s\S]*attemptId: recoveredAttempt\.attemptId/,
  );
  assert.match(
    runnerSource,
    /setRepStarted\(true\)/,
  );
});

test("technical-invalid TPS lineage restores reserve authority instead of rerunning the exposed attempt", () => {
  assert.match(
    runnerSource,
    /timing_invalid_technical[\s\S]*nextAttemptNumber: recoveredAttempt\.attemptNumber \+ 1/,
  );
  assert.match(
    runnerSource,
    /replacementForAttemptId: recoveredAttempt\.attemptId/,
  );
  assert.match(
    runnerSource,
    /freshPreparedEquivalentConfirmed: false/,
  );
});

test("deterministic TPS contract rejections do not offer endless save retry", () => {
  assert.match(
    runnerSource,
    /status >= 400 && status < 500/,
  );
  assert.match(runnerSource, /Timing Save Blocked/);
  assert.match(runnerSource, /Retry Saving Frozen Evidence/);
  assert.doesNotMatch(runnerSource, /Retry Timing Save/);
});
