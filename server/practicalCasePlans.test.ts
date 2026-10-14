import test from "node:test";
import assert from "node:assert/strict";
import { getPracticalCasePlan, getPracticalCaseKeysWithPlans } from "./practicalCasePlans";
import { getPracticalBenchmarkCase, getPracticalBenchmarkCaseKeys } from "./practicalBenchmarkBank";
import { getDrillSchemaDefinition, getFieldDefinitionsForRep, getEvidenceSelectionIdentity } from "@shared/responseIntegrityDrillRegistry";

test("all nine issued cases require actual execution and a final documented operating decision",()=>{
 const cases=["prepare","execute","evidence"] as const;
 const canonical=cases.flatMap(key=>getPracticalBenchmarkCaseKeys(key));
 assert.equal(canonical.length,9);
 assert.deepEqual([...getPracticalCaseKeysWithPlans()].sort(),[...canonical].sort());
 for(const proof of cases){
  for(let i=1;i<=3;i++){
   const issued=getPracticalBenchmarkCase(proof,i);
   assert.ok(issued);
   const steps=getPracticalCasePlan(issued!.caseKey);
   assert.deepEqual(issued!.workflowSteps,steps);
   assert.equal(steps.at(-1)!.kind,"decide");
   assert.ok(steps.some(x=>["configure","respond","rep","adaptive"].includes(x.kind)),
     issued!.caseKey+" must have a real executable workflow, not just a description.");
   assert.ok(steps.length>=3,issued!.caseKey+" must contain multiple operations.");
   if(issued!.caseKey.startsWith("evidence.")){
     assert.equal(steps.filter(x=>x.kind==="begin_rep").length,0,
       "Historical evidence cannot create fresh session execution timestamps");
   }else{
     for(let n=0;n<steps.length;n++){
       if(steps[n].kind==="rep"){
         assert.equal(steps[n-1].kind,"begin_rep","Live rep must have a separate server-timestamped start.");
         assert.equal(steps[n-1].repNumber,steps[n].repNumber);
       }
     }
   }
   if(issued!.caseKey==="execute.controlled_discomfort")
     assert.equal(steps.filter(x=>x.kind==="adaptive").length,1);
  }
 }
});
test("every executable rep uses a real versioned training drill and active rep observation fields",()=>{
 for(const key of getPracticalCaseKeysWithPlans()){
  for(const operation of getPracticalCasePlan(key)){
   if(!operation.phase||!operation.setId)continue;
   const schema=getDrillSchemaDefinition("training",operation.phase);
   const set=schema.sets.find(s=>s.setId===operation.setId);
   assert.ok(set,key+" must map to an actual operational training set "+operation.setId);
   assert.ok(schema.definitionHash,"Published training drill must remain versioned");
   if(operation.kind!=="rep")continue;
   const repIndex=(operation.repNumber!-1)%set!.reps;
   const fields=getFieldDefinitionsForRep(set!,repIndex);
   assert.ok(fields.length>0,key+" must require genuine observations");
   for(const field of fields){
     assert.ok(field.optionLabels?.length,field.fieldKey+" must have authentic choices");
     field.optionLabels!.forEach((label,optionIndex)=>{
       const option=getEvidenceSelectionIdentity({
         mode:"training",phase:operation.phase!,setName:set!.setName,repIndex,
         fieldKey:field.fieldKey,optionIndex,
       });
       assert.ok(option?.optionId,key+" "+label+" must resolve to a real evidence selection identity");
     });
   }
  }
 }
});
