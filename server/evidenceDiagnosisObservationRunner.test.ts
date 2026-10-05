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
  assert.match(runnerSource, />\s*Previous observation\s*<\/button>/);
  assert.match(runnerSource, /"Next observation"/);
  assert.match(
    runnerSource,
    /activeObservationIndex === currentProbe\.dimensions\.length - 1[\s\S]*"Review Opportunity"/,
  );
});


test("diagnosis keeps live execution separate from observation administration", () => {
  assert.match(
    runnerSource,
    /const \[executionFinished, setExecutionFinished\] = useState\(false\)/,
  );
  assert.match(
    runnerSource,
    /\) : !executionFinished \? \([\s\S]*Say \/ do this now[\s\S]*Student Finished/,
  );
  assert.match(
    runnerSource,
    /executionFinished[\s\S]*Record only what this completed opportunity actually exposed/,
  );
  assert.match(
    runnerSource,
    /disabled=\{activeObservationIndex === 0\}[\s\S]*Previous observation/,
  );
  assert.doesNotMatch(
    runnerSource,
    /activeObservationIndex === 0 \? "Back to ready"/,
  );
});

test("diagnosis ready and live surfaces use the shared prescribed probe protocol", () => {
  assert.match(runnerSource, /DIAGNOSIS_PROBE_EXECUTION_PROTOCOLS/);
  assert.match(runnerSource, /Before Begin/);
  assert.match(runnerSource, /After Begin, follow only this protocol/);
  assert.match(runnerSource, /executionProtocol\.liveSteps\.map/);
  assert.match(
    runnerSource,
    /The observation runner stays closed while the student is responding/,
  );
});
