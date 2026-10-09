import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createExecutePlan, nextExecuteTurn, executeCaseBrief, executeRiskFlags,
  validateExecuteResponse, EXECUTE_CHALLENGE_TURNS,
  type ExecuteResponse, type ExecuteTranscriptTurn,
} from "./practicalExecuteChallenge";

const validResponse:ExecuteResponse={
  intervention:"none",
  studentFacingResponse:"Keep working within the assigned no-rescue set; observe the next independent step.",
  observedBehavior:"The student paused, attempted a step and did not demonstrate an independent solution yet.",
  evidenceStatus:"observed",
  independenceClaim:"not_established",
  nextAction:"continue",
  decisionReason:"The existing condition must remain intact because there is not yet sufficient clean response evidence.",
};
function trace(number:number,situation:NonNullable<ReturnType<typeof nextExecuteTurn>>,response:ExecuteResponse):ExecuteTranscriptTurn{
 return {number,situation,response,riskFlags:executeRiskFlags(situation,response)};
}

test("Execute challenge is deterministic after server assignment, variable between seeds, and has no client-controlled case selection",()=>{
 const p=createExecutePlan("0123456789abcdef0123456789abcdef");
 const repeat=createExecutePlan("0123456789abcdef0123456789abcdef");
 assert.deepEqual(nextExecuteTurn(p,[]),nextExecuteTurn(repeat,[]));
 assert.equal(p.version,1);
 assert.equal(executeCaseBrief().totalTurns,EXECUTE_CHALLENGE_TURNS);
 assert.throws(()=>createExecutePlan("user-choice"),/server entropy/);
 const variations=new Set(Array.from({length:40},(_,i)=>createExecutePlan(i.toString(16).padStart(8,"0").repeat(8))).map(x=>nextExecuteTurn(x,[])?.studentBehavior));
 assert.ok(variations.size>1,"server entropy must vary the first simulated turn");
});

test("Later student response depends on the Specialist's actual saved intervention",()=>{
 const p=createExecutePlan("0123456789abcdef0123456789abcdef");
 const first=nextExecuteTurn(p,[])!;
 const noRescue=nextExecuteTurn(p,[trace(1,first,validResponse)])!;
 const rescue=nextExecuteTurn(p,[trace(1,first,{...validResponse,intervention:"method_or_step_prompt",independenceClaim:"assisted"})])!;
 assert.notEqual(noRescue.studentBehavior,rescue.studentBehavior);
 assert.equal(noRescue.number,2);
 assert.equal(rescue.number,2);
 assert.match(rescue.studentBehavior,/step|structure|hint/i);
});

test("Third turn always introduces unpredictable observability failure and future turns remain withheld",()=>{
 const p=createExecutePlan("ffffffff00000000ffffffff00000000");
 const first=nextExecuteTurn(p,[])!;
 assert.equal(first.kind,"uncertainty");
 const one=trace(1,first,validResponse);
 const second=nextExecuteTurn(p,[one])!;
 assert.equal(second.kind,"difficulty");
 const two=trace(2,second,validResponse);
 const third=nextExecuteTurn(p,[one,two])!;
 assert.equal(third.kind,"observability_interruption");
 assert.match(third.studentBehavior,/not visible|obscured|cannot observe|inaudible/i);
 assert.equal(nextExecuteTurn(p,[one,two,trace(3,third,{...validResponse,evidenceStatus:"not_observed"})]),null);
 assert.throws(()=>nextExecuteTurn(p,[{...one,number:2}]),/turn sequence/);
});

test("Objective contradictions are exposed to TD instead of deleted or converted to clean answers",()=>{
 const p=createExecutePlan("0123456789abcdef0123456789abcdef");
 const first=nextExecuteTurn(p,[])!;
 assert.deepEqual(executeRiskFlags(first,{...validResponse,intervention:"full_rescue_or_teaching",independenceClaim:"independent"}),
  ["assisted_recorded_as_independent","no_rescue_condition_broken"]);
 assert.deepEqual(executeRiskFlags(first,{...validResponse,intervention:"timer_changed"}),["unauthorised_condition_change"]);
 const t2=nextExecuteTurn(p,[trace(1,first,validResponse)])!;
 const last=nextExecuteTurn(p,[trace(1,first,validResponse),trace(2,t2,validResponse)])!;
 assert.deepEqual(executeRiskFlags(last,validResponse),["unobservable_work_claimed_as_observed"]);
 assert.deepEqual(executeRiskFlags(last,{...validResponse,evidenceStatus:"not_observed"}),[]);
});

test("All responses need explicit observable evidence and meaningful next-action rationale",()=>{
 assert.deepEqual(validateExecuteResponse(validResponse),validResponse);
 assert.throws(()=>validateExecuteResponse({...validResponse,observedBehavior:"Great job!"}),/30/);
 assert.throws(()=>validateExecuteResponse({...validResponse,intervention:"invented" as any}),/Unsupported/);
});

test("Boundaries: server chooses case, stores private plan, enforces three-turn provenance and never changes live-family permissions",()=>{
 const path=readFileSync("server/practicalExecuteChallenge.ts","utf8");
 const migration=readFileSync("migrations/20261009_practicals_evidence_stage_v1.sql","utf8");
 const practicals=readFileSync("server/capabilityPracticalEvidence.ts","utf8");
 const routes=readFileSync("server/routes/capabilityPracticalEvidence.ts","utf8");
 assert.match(path,/randomBytes\(32\)/);
 assert.match(path,/FOR UPDATE OF c/);
 assert.match(path,/getPracticalEntryStatus/);
 assert.match(path,/private\.specialist_practical_execute_challenge_truth/);
 assert.match(path,/INSERT INTO public\.specialist_practical_execute_turns/);
 assert.doesNotMatch(path,/UPDATE\s+(?:public\.)?(?:students|parent_enrollments|tutor_assignments|tutor_trial_cases)/i);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/g);
 assert.match(migration,/REVOKE ALL ON private\.specialist_practical_execute_challenge_truth FROM PUBLIC,anon,authenticated/);
 assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS uq_practical_execute_link/);
 assert.match(migration,/trg_validate_practical_execute_link/);
 assert.match(practicals,/assertCompletedExecuteChallenge/);
 assert.match(practicals,/anyCritical && derived.outcome !== "integrity_review"/);
 assert.match(routes,/execute-challenge\/start/);
 assert.match(routes,/execute-challenge\/:challengeId\/turn/);
});
