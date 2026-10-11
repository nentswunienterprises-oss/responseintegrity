import test from "node:test";
import assert from "node:assert/strict";
import {getPracticalBenchmarkCase,getPracticalBenchmarkCaseKeys} from "./practicalBenchmarkBank";
import {PRACTICAL_BENCHMARK_VERSION} from "@shared/practicalBenchmarkPolicy";

test("every Specialist sees the exact same THREE fixed, versioned cases per assessment",()=>{
  for(const proof of ["prepare","execute","evidence"] as const) {
    const cases=[1,2,3].map(index=>getPracticalBenchmarkCase(proof,index));
    assert.ok(cases.every(Boolean));
    assert.deepEqual(cases.map(x=>x!.caseKey),getPracticalBenchmarkCaseKeys(proof));
    assert.equal(new Set(cases.map(x=>x!.phase)).size,3);
    assert.equal(new Set(cases.map(x=>x!.caseKey)).size,3);
    assert.ok(cases.every(x=>x!.caseVersion===PRACTICAL_BENCHMARK_VERSION));
    assert.ok(cases.every(x=>x!.fictionalOnly===true));
    assert.deepEqual(cases.map(x=>x!.situation),
      [1,2,3].map(index=>getPracticalBenchmarkCase(proof,index)!.situation));
    assert.equal(getPracticalBenchmarkCase(proof,4),null);
    assert.equal(getPracticalBenchmarkCase(proof,0),null);
  }
});
test("system gives cross-phase comparable observations, not a single lucky situation",()=>{
 assert.deepEqual([1,2,3].map(i=>getPracticalBenchmarkCase("prepare",i)!.phase),["Clarity","Structured Execution","Time Pressure Stability"]);
 assert.deepEqual([1,2,3].map(i=>getPracticalBenchmarkCase("execute",i)!.phase),["Clarity","Controlled Discomfort","Time Pressure Stability"]);
 assert.deepEqual([1,2,3].map(i=>getPracticalBenchmarkCase("evidence",i)!.phase),["Structured Execution","Controlled Discomfort","Time Pressure Stability"]);
});
