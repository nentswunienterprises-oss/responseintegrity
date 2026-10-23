import test from "node:test";
import assert from "node:assert/strict";
import {overlaySandboxDiagnosisTopicPlacement} from "./sandboxDiagnosisTopicProjection";
const topics={"Quadratic equations":{phase:"Structured Execution",stability:"High",lastUpdated:"2026-10-18T12:46:00Z",history:[{phase:"Structured Execution",stability:"High",date:"2026-10-18T12:46:00Z"}]}};
const row={active_topic_key:"quadratic equations",specialist_phase:"Structured Execution",specialist_stability:"Medium",source_id:"saved-diagnosis",completed_at:"2026-10-18T17:43:58Z",reason:"Independent execution varies."};
test("completed Sandbox re-diagnosis projects current Map state and preserves previous history",async()=>{
 const original=JSON.stringify(topics);let query="";
 const result=await overlaySandboxDiagnosisTopicPlacement({tutorId:"t",studentId:"s",topics},{query:async(sql)=>{query=sql;return{rows:[row]};}});
 assert.equal(result["Quadratic equations"].stability,"Medium");
 assert.equal(result["Quadratic equations"].history.length,2);
 assert.equal(result["Quadratic equations"].history[1].drillId,"saved-diagnosis");
 assert.equal(result["Quadratic equations"].progressionAuthority,"building");
 assert.equal(JSON.stringify(topics),original);
 assert.match(query,/pe.is_sandbox_account=true/);
 assert.match(query,/r.started_session_number=t.session_number/);
 assert.match(query,/r.tutor_assignment_id=t.tutor_assignment_id/);
 assert.doesNotMatch(query,/private\./);
});
test("live students, absent completed evidence, another topic and later Training are not overwritten",async()=>{
 assert.equal(await overlaySandboxDiagnosisTopicPlacement({tutorId:"t",studentId:"s",topics},{query:async()=>({rows:[]})}),topics);
 assert.equal(await overlaySandboxDiagnosisTopicPlacement({tutorId:"t",studentId:"s",topics},{query:async()=>({rows:[{...row,active_topic_key:"other"}]})}),topics);
 const later={...topics,"Quadratic equations":{...topics["Quadratic equations"],lastUpdated:"2026-10-19T12:00:00Z"}};
 assert.equal(await overlaySandboxDiagnosisTopicPlacement({tutorId:"t",studentId:"s",topics:later},{query:async()=>({rows:[row]})}),later);
});

test("current owned re-diagnosis route overrides a later stale mirror without changing its evidence", async () => {
 const stale={...topics,"Quadratic equations":{...topics["Quadratic equations"],lastUpdated:"2026-10-21T12:00:00Z",requiresTargetedRediagnosis:false}};
 const before=JSON.stringify(stale);
 const queries:string[]=[];
 const result=await overlaySandboxDiagnosisTopicPlacement({tutorId:"t",studentId:"s",topics:stale},{query:async(sql,values)=>{
  queries.push(sql);assert.deepEqual(values,["t","s"]);
  return {rows:[{active_topic_key:"quadratic equations",specialist_route:"targeted_rediagnosis",specialist_targeted_rediagnosis_phase:"Clarity"}]};
 }});
 assert.equal(result["Quadratic equations"].requiresTargetedRediagnosis,true);
 assert.equal(result["Quadratic equations"].targetedRediagnosisStartPhase,"Clarity");
 assert.equal(result["Quadratic equations"].phase,"Structured Execution");
 assert.deepEqual(result["Quadratic equations"].history,stale["Quadratic equations"].history);
 assert.equal(JSON.stringify(stale),before);
 assert.equal(queries.length,1);
 assert.match(queries[0],/pe.is_sandbox_account=true/);
 assert.doesNotMatch(queries[0],/private\./);
});
