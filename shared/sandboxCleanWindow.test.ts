import { describe, it, expect } from "vitest";
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
    expect(evaluateSandboxCleanWindow(null, [row(1),row(2),row(3)]).qualified).toBe(false);
    expect(evaluateSandboxCleanWindow({...policy,status:"candidate"}, [row(1),row(2),row(3)]).qualified).toBe(false);
  });
  it("qualifies consecutive complete correctly-covered zero-divergence evidence", () => {
    expect(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3)]).qualified).toBe(true);
  });
  it("does not cherry-pick earlier clean sessions after a material divergence", () => {
    expect(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,{authorityAligned:false}),row(4)]).qualified).toBe(false);
  });
  it("blocks incorrect observation, evidence integrity, state and missing truth", () => {
    for(const failure of [{observationExact:false},{evidenceExact:false},{stateTrackAligned:false},{truthPresent:false},{complete:false}]) {
      expect(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,failure)]).qualified).toBe(false);
    }
  });
  it("blocks missing situation coverage and duplicate sessions", () => {
    expect(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(3,{situationTags:["normal"]})]).qualified).toBe(false);
    expect(evaluateSandboxCleanWindow(policy,[row(1),row(2),row(2)]).qualified).toBe(false);
  });
  it("blocks single-session standards even if marked approved", () => {
    expect(evaluateSandboxCleanWindow({...policy,requiredConsecutiveSessions:1},[row(1)]).qualified).toBe(false);
  });
});
