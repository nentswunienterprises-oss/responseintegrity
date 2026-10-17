import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSandboxCleanWindow, type SandboxSessionEvidence } from "./sandboxCleanWindow";

const policy = {
  version: 1, status: "approved" as const, requiredConsecutiveSessions: 3,
  requiredPhases: ["Clarity", "Structured Execution"], requiredSituationTags: ["normal", "breakdown", "recovery"],
};
const row = (n: number, overrides: Partial<SandboxSessionEvidence> = {}): SandboxSessionEvidence => ({
  id: String(n), sessionNumber:n, phase:n === 1 ? "Clarity" : "Structured Execution",
  situationTags:n === 1 ? ["normal"] : n === 2 ? ["breakdown"] : ["recovery"],
  authorityAligned:true, stateTrackAligned:true, observationExact:true, evidenceExact:true,
  complete:true, truthPresent:true, ...overrides,
});
describe("zero-divergence graduation gate", () => {
  it("fails closed before explicit numeric policy approval", () => {
    assert.equal(evaluateSandboxCleanWindow(null, [row(1),row(2),row(3)]).qualified, false);
    assert.equal(evaluateSandboxCleanWindow({...policy,status:"candidate"}, [row(1),row(2),row(3)]).qualified, false);
  });
  it("qualifies consecutive complete correctly-covered zero-divergence evidence", () => {
    assert.equal(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3)]).qualified, true);
  });
  it("does not cherry-pick earlier clean sessions after a material divergence", () => {
    assert.equal(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,{authorityAligned:false}),row(4)]).qualified, false);
  });
  it("blocks incorrect observation, evidence integrity, state and missing truth", () => {
    for(const failure of [{observationExact:false},{evidenceExact:false},{stateTrackAligned:false},{truthPresent:false},{complete:false}]) {
      assert.equal(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,failure)]).qualified, false);
    }
  });
  it("blocks missing situation coverage and duplicate sessions", () => {
    assert.equal(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,{situationTags:["normal"]})]).qualified, false);
    assert.equal(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(2)]).qualified, false);
  });
  it("blocks single-session standards even if marked approved", () => {
    assert.equal(evaluateSandboxCleanWindow({...policy,requiredConsecutiveSessions:1},[row(1)]).qualified, false);
  });
});
