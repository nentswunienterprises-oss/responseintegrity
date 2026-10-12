import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICAL_BENCHMARK_CASE_COUNT,
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
    specialistScreenFaceVoiceObservable:true,flaggedCutOrManipulation:false,
    flaggedTechnicalInterruption:false,
  };
  for(const seconds of [200,900,3600])
    assert.deepEqual(validatePracticalVideoVerification("execute",{...clean,observedDurationSeconds:seconds}),[]);
  for(const mutation of [
    {recordingContinuous:false},{recordingBeginsBeforeReveal:false},{allThreeCasesVisible:false},
    {environmentAndToolsVisible:false},{specialistScreenFaceVoiceObservable:false},
    {flaggedCutOrManipulation:true},{flaggedTechnicalInterruption:true},
    {observedDurationSeconds:0},{observedDurationSeconds:-1},{observedDurationSeconds:900.5}
  ]) assert.ok(validatePracticalVideoVerification("execute",{...clean,...mutation}).length>0);
});
