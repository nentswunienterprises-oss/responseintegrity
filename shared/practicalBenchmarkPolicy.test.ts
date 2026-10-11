import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICAL_BENCHMARK_CASE_COUNT,
  PRACTICAL_RECORDING_WINDOWS,
  validatePracticalRecordingDeclaration,
  validateCaseReviews,
  validatePracticalVideoVerification,
} from "./practicalBenchmarkPolicy";

test("all three Practicals share three standardized cases but have different fixed uncut duration bands",()=>{
  assert.equal(PRACTICAL_BENCHMARK_CASE_COUNT,3);
  assert.deepEqual(PRACTICAL_RECORDING_WINDOWS.prepare,{minSeconds:600,maxSeconds:1080});
  assert.deepEqual(PRACTICAL_RECORDING_WINDOWS.execute,{minSeconds:720,maxSeconds:1320});
  assert.deepEqual(PRACTICAL_RECORDING_WINDOWS.evidence,{minSeconds:600,maxSeconds:1080});
});
test("a verified continuous, pre-reveal recording within range is eligible to submit",()=>{
  const declaration={durationSeconds:800,recordingStartedBeforeReveal:true,continuousUneditedRecording:true,setupToolsDemonstrated:true};
  assert.deepEqual(validatePracticalRecordingDeclaration("prepare",declaration),[]);
  for(const failure of [
    {...declaration,durationSeconds:599},
    {...declaration,durationSeconds:1081},
    {...declaration,durationSeconds:800.5},
    {...declaration,recordingStartedBeforeReveal:false},
    {...declaration,continuousUneditedRecording:false},
    {...declaration,setupToolsDemonstrated:false},
  ])assert.ok(validatePracticalRecordingDeclaration("prepare",failure).length>0);
});
test("TD must record a comparable, complete judgment for every exact fixed case",()=>{
  const keys=["prepare.clarity_state","prepare.se_drill","prepare.tps_preflight"];
  const reviews=keys.map(caseKey=>({caseKey,judgment:"clear" as const,observedEvidence:"The recording shows specific, directly observable conduct with the issued case."}));
  assert.deepEqual(validateCaseReviews(keys,reviews),[]);
  assert.ok(validateCaseReviews(keys,reviews.slice(0,2)).length>0);
  assert.ok(validateCaseReviews(keys,[...reviews.slice(0,2),reviews[0]]).length>0);
  assert.ok(validateCaseReviews(keys,[...reviews.slice(0,2),{...reviews[2],caseKey:"invented"}]).length>0);
});
test("TD cannot approve interrupted, edited, off-camera or wrong-length recordings",()=>{
  const clean={
    observedDurationSeconds:900,recordingContinuous:true,recordingBeginsBeforeReveal:true,
    allThreeCasesVisible:true,environmentAndToolsVisible:true,
    specialistScreenFaceVoiceObservable:true,flaggedCutOrManipulation:false,
    flaggedTechnicalInterruption:false,
  };
  assert.deepEqual(validatePracticalVideoVerification("execute",clean),[]);
  for(const mutation of [
    {recordingContinuous:false},{recordingBeginsBeforeReveal:false},{allThreeCasesVisible:false},
    {environmentAndToolsVisible:false},{specialistScreenFaceVoiceObservable:false},
    {flaggedCutOrManipulation:true},{flaggedTechnicalInterruption:true},
    {observedDurationSeconds:700},{observedDurationSeconds:1350}
  ]) assert.ok(validatePracticalVideoVerification("execute",{...clean,...mutation}).length>0);
});
