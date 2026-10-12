import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");
const runtimePaths=["server/practicalBenchmarkRuns.ts","server/practicalCaseWork.ts"];

test("qualifying case issuance and execution never import public prototype workflows",()=>{
  for(const path of runtimePaths){
    const source=read(path);
    assert.doesNotMatch(source,/from\s+["']\.\/practicalBenchmarkBank["']/);
    assert.doesNotMatch(source,/from\s+["']\.\/practicalCasePlans["']/);
    assert.match(source,/privatePracticalBenchmarkBank/);
  }
});
test("private bank v2 is fail-closed and real case content is not published in migrations",()=>{
  const source=read("server/privatePracticalBenchmarkBank.ts");
  const migration=read("migrations/20261011_practicals_shared_video_benchmarks_v1.sql");
  const policy=read("shared/practicalBenchmarkPolicy.ts");
  assert.match(source,/private\.specialist_practical_benchmark_private_cases/);
  assert.match(source,/confidential Practicals assessment bank is not provisioned|confidential Practicals assessment bank|private Practicals bank/i);
  assert.match(migration,/CREATE TABLE private\.specialist_practical_benchmark_private_cases/);
  assert.match(migration,/CHECK \(bank_version >= 2\)/);
  assert.match(migration,/REVOKE ALL ON private\.specialist_practical_benchmark_private_cases FROM PUBLIC,anon,authenticated/);
  assert.match(policy,/PRACTICAL_BENCHMARK_VERSION = 2/);
  assert.doesNotMatch(migration,/INSERT INTO private\.specialist_practical_benchmark_private_cases/);
});
