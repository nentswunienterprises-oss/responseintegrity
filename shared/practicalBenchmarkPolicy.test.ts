import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICAL_BENCHMARK_CASE_COUNT,
  projectSpecialistPracticalActionEvent,
  projectPracticalSetupForSpecialist,
  projectSpecialistPracticalCase,
  projectSpecialistPracticalStep,
  resolvePracticalAttempt,
  validatePracticalRecordingDeclaration,
  validateCaseReviews,
  validatePracticalVideoVerification,
} from "./practicalBenchmarkPolicy";

test("all three Practicals keep the same provisional three-case requirement but no duration caps",()=>{
  assert.equal(PRACTICAL_BENCHMARK_CASE_COUNT,3);
  const base={recordingStartedBeforeReveal:true,continuousUneditedRecording:true,setupToolsDemonstrated:true};
  for(const proof of ["prepare","execute","evidence"] as const)
    for(const seconds of [200,900,3600])
      assert.deepEqual(validatePracticalRecordingDeclaration(proof,{...base,durationSeconds:seconds}),[]);
});
test("a complete video needs positive whole-second duration and real continuity attestations",()=>{
  const declaration={durationSeconds:800,recordingStartedBeforeReveal:true,continuousUneditedRecording:true,setupToolsDemonstrated:true};
  assert.deepEqual(validatePracticalRecordingDeclaration("prepare",declaration),[]);
  for(const failure of [
    {...declaration,durationSeconds:0},
    {...declaration,durationSeconds:800.5},
    {...declaration,durationSeconds:-1},
    {...declaration,recordingStartedBeforeReveal:false},
    {...declaration,continuousUneditedRecording:false},
    {...declaration,setupToolsDemonstrated:false},
  ])assert.ok(validatePracticalRecordingDeclaration("prepare",failure).length>0);
});
test("TD must record a comparable, complete judgment for every exact fixed case",()=>{
  const keys=["prepare.clarity_state","prepare.se_drill","prepare.tps_preflight"];
  const reviews=keys.map(caseKey=>({caseKey,judgment:"clear" as const,observedEvidence:"The recording shows specific, directly observable conduct with the issued case.",videoTraceMatched:true}));
  assert.deepEqual(validateCaseReviews(keys,reviews),[]);
  assert.ok(validateCaseReviews(keys,reviews.slice(0,2)).length>0);
  assert.ok(validateCaseReviews(keys,[...reviews.slice(0,2),reviews[0]]).length>0);
  assert.ok(validateCaseReviews(keys,[...reviews.slice(0,2),{...reviews[2],caseKey:"invented"}]).length>0);
});
test("TD cannot approve interrupted, edited, off-camera or invalid-length original media",()=>{
  const clean={
    observedDurationSeconds:900,recordingContinuous:true,recordingBeginsBeforeReveal:true,
    allThreeCasesVisible:true,environmentAndToolsVisible:true,
    specialistScreenFaceVoiceObservable:true,
    recordingConsentVerified:true,recordingAccessRestricted:true,
    noRealStudentDataOrBystanders:true,flaggedCutOrManipulation:false,
    flaggedTechnicalInterruption:false,
  };
  for(const seconds of [200,900,3600])
    assert.deepEqual(validatePracticalVideoVerification("execute",{...clean,observedDurationSeconds:seconds}),[]);
  for(const mutation of [
    {recordingContinuous:false},{recordingBeginsBeforeReveal:false},{allThreeCasesVisible:false},
    {environmentAndToolsVisible:false},{specialistScreenFaceVoiceObservable:false},
    {flaggedCutOrManipulation:true},{flaggedTechnicalInterruption:true},
    {recordingConsentVerified:false},{recordingAccessRestricted:false},
    {noRealStudentDataOrBystanders:false},
    {observedDurationSeconds:0},{observedDurationSeconds:-1},{observedDurationSeconds:900.5}
  ]) assert.ok(validatePracticalVideoVerification("execute",{...clean,...mutation}).length>0);
});

test("Specialist operation history excludes examiner truth and risk flags",()=>{
 const raw={
   stepNumber:1,operationKey:"begin_rep",recordedPayload:{studentFacingResponse:"Candidate own conduct"},
   recordedAt:"2026-10-12T04:00:00Z",
   systemSnapshot:{observedSupport:"unobserved",studentBehavior:"Private future response"},
   riskFlags:["canonical_integrity_breach"],
 };
 const publicView=projectSpecialistPracticalActionEvent(raw);
 assert.equal("systemSnapshot" in publicView,false);
 assert.equal("riskFlags" in publicView,false);
 assert.deepEqual(Object.keys(publicView).sort(),["operationKey","recordedAt","recordedPayload","stepNumber"].sort());
 assert.equal(publicView.recordedPayload.studentFacingResponse,raw.recordedPayload.studentFacingResponse);
});

test("original evidence submissions do not define the attempt number after an interrupted recording",()=>{
 const makeRun=(attempt_number:number,status:"active"|"complete"|"abandoned",
   recovery_decision:string|null=null,recovery_request_id:string|null=null)=>({
     attempt_number,status,recovery_decision,recovery_request_id,
   });
 assert.deepEqual(resolvePracticalAttempt(null,null),
   {allowed:true,reason:null,attemptNumber:1});
 assert.deepEqual(resolvePracticalAttempt(null,makeRun(1,"active")),
   {allowed:true,reason:null,attemptNumber:1});
 // The unsubmitted, TD-authorized abandoned first recording must issue AND
 // submit against attempt 2, not attempt 1.
 assert.deepEqual(resolvePracticalAttempt(null,makeRun(1,"abandoned","approve_repeat","request-1")),
   {allowed:true,reason:null,attemptNumber:2});
 assert.deepEqual(resolvePracticalAttempt(null,makeRun(2,"complete")),
   {allowed:true,reason:null,attemptNumber:2});
 // Recovered attempt 2 following an ordinary reviewed repeat of attempt 1.
 assert.deepEqual(resolvePracticalAttempt(
   {attempt_number:1,outcome:"repeat_required"},
   makeRun(2,"abandoned","approve_repeat","request-2")),
   {allowed:true,reason:null,attemptNumber:3});
 assert.equal(resolvePracticalAttempt(null,makeRun(1,"abandoned",null,"request-1")).allowed,false);
 assert.equal(resolvePracticalAttempt(null,makeRun(1,"abandoned","deny","request-1")).allowed,false);
 assert.equal(resolvePracticalAttempt(null,makeRun(1,"active","integrity_review","request-1")).allowed,false);
});
test("already submitted, approved or integrity-held Practical cannot silently issue or submit another attempt",()=>{
 for(const outcome of [null,"approved","integrity_review","submitted"]){
   const result=resolvePracticalAttempt({attempt_number:1,outcome},
     {attempt_number:1,status:"complete",recovery_request_id:null,recovery_decision:null});
   assert.equal(result.allowed,false);
   assert.equal(result.attemptNumber,0);
 }
 assert.equal(resolvePracticalAttempt({attempt_number:1,outcome:"repeat_required"},
   {attempt_number:1,status:"complete",recovery_request_id:null,recovery_decision:null}).attemptNumber,2);
});

test("candidate setup never reveals the canonical assigned drill, even before a save",()=>{
 const sealed={kind:"configure",phase:"Clarity",setId:"clarity.identification",
   prompt:"Select the correct drill from the issued training registry."};
 const candidate=projectPracticalSetupForSpecialist(sealed);
 assert.equal("setId" in candidate,false);
 assert.equal(candidate.kind,"configure");
 assert.equal(candidate.phase,"Clarity");
 assert.equal(candidate.prompt,sealed.prompt);
 assert.equal(sealed.setId,"clarity.identification");
});

test("private case fields never leak into the Specialist benchmark projection",()=>{
 const secret={
   phase:"Clarity",assessedCapability:"Clarity operational proof",
   title:"A private CI case",situation:"Synthetic case context",
   systemDirection:"Carry out real steps",liveDemonstration:"Perform the scenario",
   fictionalOnly:true as const,workflowSteps:[{kind:"rep"}],
   canonicalTruth:{correctSupport:"none"},futureUnreleasedCase:"never show",
 };
 const projected=projectSpecialistPracticalCase(secret);
 assert.equal("workflowSteps" in projected,false);
 assert.equal("canonicalTruth" in projected,false);
 assert.equal("futureUnreleasedCase" in projected,false);
 assert.equal(projected.title,secret.title);
});
test("configure and begin-rep Specialist steps cannot reveal answer keys or future behaviour",()=>{
 const shared={label:"Issued CI step",prompt:"Perform the simulated action",phase:"Clarity",
   setId:"clarity.correct_hidden",repNumber:1,
   studentBehavior:"Unreleased response",observedSupport:"unobserved",
   canonicalTruth:"secret",futureBehavior:"secret future branch",
 };
 const configure=projectSpecialistPracticalStep({...shared,kind:"configure"});
 const begin=projectSpecialistPracticalStep({...shared,kind:"begin_rep"});
 for(const projected of [configure,begin]){
   assert.equal("canonicalTruth" in projected,false);
   assert.equal("futureBehavior" in projected,false);
   assert.equal("observedSupport" in projected,false);
   assert.equal("studentBehavior" in projected,false);
 }
 assert.equal("setId" in configure,false);
 assert.equal(begin.setId,shared.setId);
 const rep=projectSpecialistPracticalStep({...shared,kind:"rep"});
 assert.equal(rep.studentBehavior,shared.studentBehavior);
 assert.equal("observedSupport" in rep,false);
});
