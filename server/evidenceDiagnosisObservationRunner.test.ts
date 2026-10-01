import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runnerSource = readFileSync(
  new URL("../client/src/components/tutor/EvidenceCompleteDiagnosisRunner.tsx", import.meta.url),
  "utf8",
);

test("diagnosis opportunity presents behavioral observations one at a time", () => {
  assert.match(
    runnerSource,
    /const \[activeObservationIndex, setActiveObservationIndex\] = useState\(0\)/,
  );
  assert.match(
    runnerSource,
    /currentProbe\?\.dimensions\[activeObservationIndex\]/,
  );
  assert.match(runnerSource, /activeDimension\.options\.map/);
  assert.doesNotMatch(runnerSource, /activeLayer\.dimensions\.map/);
  assert.match(runnerSource, /Observation \{activeObservationIndex \+ 1\} of/);
  assert.match(runnerSource, /"Previous observation"/);
  assert.match(runnerSource, /"Next observation"/);
  assert.match(
    runnerSource,
    /activeObservationIndex === currentProbe\.dimensions\.length - 1[\s\S]*"Review Opportunity"/,
  );
});
