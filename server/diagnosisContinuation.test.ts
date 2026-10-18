import test from "node:test";
import assert from "node:assert/strict";
import { authorizeDiagnosisContinuation, diagnosisContinuationContext, diagnosisDecisionWithContext } from "./diagnosisContinuation";
import { createEvidenceCompleteDiagnosisState, evaluateEvidenceCompleteDiagnosis, recordEvidenceCompleteDiagnosisProbe, DIAGNOSIS_PROBES } from "../shared/evidenceCompleteDiagnosis";
import { DIAGNOSIS_OBSERVATION_MATRIX } from "../shared/diagnosisObservationMatrix";
const history=Array.from({length:2},()=>({probeId:"clarity.recognition" as const, observations:DIAGNOSIS_PROBES["clarity.recognition"].dimensions.map(d=>({dimensionId:d,behaviorId:"not_observed"}))}));
let state=createEvidenceCompleteDiagnosisState("Clarity");
for(const probe of history)state=recordEvidenceCompleteDiagnosisProbe(state,probe);
const decision=evaluateEvidenceCompleteDiagnosis(state);
const context={legacyPrefixLength:0,sessions:[{scheduledSessionId:"old",startProbeIndex:0}]};
const input={tutorId:"tutor",studentId:"student",scheduledSessionId:"next",context,historyLength:2,decision};
test("continuation retains the anchor and requires a later confirmed owned lesson",async()=>{
 let query="";let params:any[]=[];
 const next=await authorizeDiagnosisContinuation(input,{query:async(sql,values)=>{query=sql;params=values;return {rows:[{id:"next"}]};}});
 assert.deepEqual(next.sessions,[...context.sessions,{scheduledSessionId:"next",startProbeIndex:2}]);
 assert.equal(context.sessions.length,1);
 assert.match(query,/next.scheduled_time > previous.scheduled_time/);
 assert.match(query,/next.tutor_id::text = \$2 AND next.student_id::text = \$3/);
 assert.match(query,/next.status IN \('confirmed', 'ready', 'live'\)/);
 assert.deepEqual(params,["next","tutor","student","old"]);
 await assert.rejects(authorizeDiagnosisContinuation(input,{query:async()=>({rows:[]})}),/later confirmed lesson/);
});
test("same-session resets and premature continuation are rejected before database access",async()=>{
 const db={query:async()=>{throw new Error("must not query");}};
 await assert.rejects(authorizeDiagnosisContinuation({...input,scheduledSessionId:"old"},db),/cannot be reset/);
 await assert.rejects(authorizeDiagnosisContinuation({...input,decision:evaluateEvidenceCompleteDiagnosis(createEvidenceCompleteDiagnosisState("Clarity"))},db),/Finish the current/);
});
test("policy reinterpretation stores the previous decision and server-owned session lineage",()=>{
 const previous={complete:false,reason:"previous conflict"};
 const restored=diagnosisContinuationContext(previous,5,"old");
 assert.equal(restored.legacyPrefixLength,5);
 const saved=diagnosisDecisionWithContext(decision,restored,previous);
 assert.deepEqual(saved.previousDecision,previous);
 assert.equal(diagnosisContinuationContext(saved,5,"forged-new-session"),restored);
});
