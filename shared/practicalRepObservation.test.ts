import test from "node:test";
import assert from "node:assert/strict";
import {normalizePracticalDimensionObservations} from "./practicalRepObservation";

const fields=[
 {fieldKey:"entry",options:[{optionId:"e1",label:"Changed entry"},{optionId:"e2",label:"Independent entry"}]},
 {fieldKey:"recovery",options:[{optionId:"r1",label:"Observed recovery"}]},
];
test("Observed Sandbox-style dimension evidence preserves real option identities",()=>{
 const result=normalizePracticalDimensionObservations(fields,{
   entry:{evidenceStatus:"observed",optionId:"e2"},
   recovery:{evidenceStatus:"observed",optionId:"r1"},
 });
 assert.deepEqual(result.entry,{optionId:"e2",evidenceStatus:"observed"});
});
test("Unobserved/confounded dimensions never carry fabricated option values",()=>{
 const input={
   entry:{evidenceStatus:"not_observed",optionId:null},
   recovery:{evidenceStatus:"confounded",optionId:null},
 };
 const result=normalizePracticalDimensionObservations(fields,input);
 assert.deepEqual(result,input);
 assert.throws(()=>normalizePracticalDimensionObservations(fields,{
   ...input,recovery:{evidenceStatus:"not_observed",optionId:"r1"},
 }),/must not invent an option/);
});
test("All issued fields require explicit statuses and only published options",()=>{
 for(const bad of [
   {entry:{evidenceStatus:"observed",optionId:"e1"}},
   {entry:{evidenceStatus:"observed",optionId:"invented"},recovery:{evidenceStatus:"observed",optionId:"r1"}},
   {entry:{evidenceStatus:"observed",optionId:null},recovery:{evidenceStatus:"observed",optionId:"r1"}},
   {entry:{evidenceStatus:"unknown",optionId:"e1"},recovery:{evidenceStatus:"observed",optionId:"r1"}},
 ])assert.throws(()=>normalizePracticalDimensionObservations(fields,bad));
});
