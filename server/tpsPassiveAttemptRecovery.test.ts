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
  new URL("../client/src/components/tutor/EvidenceCompleteDiagnosisRunner.tsx", import.meta.url),
  "utf8",
);

test("passive diagnosis timing is recovered by immutable opportunity slot after reload", () => {
  assert.match(authoritySource, /loadLatestTpsPassiveAttemptForSlot/);
  assert.match(
    authoritySource,
    /source_context_id = \$4[\s\S]*source_item_id = \$5[\s\S]*slot_number = \$6[\s\S]*ORDER BY attempt_number DESC/,
  );
  assert.match(
    authoritySource,
    /TPS_PASSIVE_ATTEMPT_SLOT_ALREADY_RECORDED/,
  );

  assert.match(
    routeSource,
    /app\.get\([\s\S]*\/api\/tutor\/students\/:studentId\/tps-passive-attempt/,
  );
  assert.match(routeSource, /loadLatestTpsPassiveAttemptForSlot/);

  assert.match(runnerSource, /loadPassiveAttemptForSlot/);
  assert.match(
    runnerSource,
    /Student execution timing was already recorded for this opportunity/,
  );
  assert.match(
    runnerSource,
    /setPassiveTimingAttempt\([\s\S]*attemptId: recoveredPassiveAttempt\.attemptId/,
  );
  assert.match(
    runnerSource,
    /setOpportunityStarted\(true\)/,
  );
});


test("legacy per-probe diagnosis slot numbering remains recoverable without mutating immutable timing evidence", () => {
  assert.match(
    routeSource,
    /legacySlotNumber/,
  );
  assert.match(
    routeSource,
    /source === "diagnosis"[\s\S]*legacySlotNumber !== slotNumber[\s\S]*loadLatestTpsPassiveAttemptForSlot/,
  );
  assert.match(
    runnerSource,
    /nextProbeOccurrenceNumber[\s\S]*legacySlotNumber: nextProbeOccurrenceNumber/,
  );
  assert.match(
    authoritySource,
    /legacyProbeOccurrenceNumber[\s\S]*validatePassiveAttemptReference/,
  );
});

test("diagnosis response numbering uses global opportunity position rather than per-probe occurrence", () => {
  const diagnosisRouteSource = readFileSync(
    new URL("./evidenceCompleteDiagnosisRoutes.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    diagnosisRouteSource,
    /const opportunityNumber = nextProbeId[\s\S]*replay\.state\.probeHistory\.length \+ 1/,
  );
  assert.match(
    diagnosisRouteSource,
    /probeOccurrenceNumber[\s\S]*getDiagnosisProbeOpportunityPurpose/,
  );
});
