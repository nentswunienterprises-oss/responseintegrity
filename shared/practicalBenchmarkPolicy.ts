/**
 * Founder-approved Practicals video-observed common benchmarks.
 *
 * Every Specialist receives the same versioned THREE cases per Practical
 * (one continuous recording per Practical). Never expose case content in
 * browser bundles before the server reveals it during a recording.
 *
 * One unique random case per Specialist is not a comparable assessment bank.
 * Case IDs + outcomes must remain available to authorized TDs for longitudinal
 * cohort comparisons without revealing family or student data.
 */
// v1 prototype cases were exposed in a public repository and are invalid as unseen exams.
// v2+ must be privately authored and provided through the sealed database only.
export const PRACTICAL_BENCHMARK_VERSION = 2;
export const PRACTICAL_BENCHMARK_CASE_COUNT = 3;
export type PracticalBenchmarkProof = "prepare" | "execute" | "evidence";
export type PracticalCaseJudgment = "clear" | "partial" | "fail";

/**
 * One attempt authority for issuance, adaptive Execute and final submission.
 * A recording recovery has no evidence row, so submission counts alone are
 * never a safe attempt-number source.
 */
export type PracticalEvidenceAttempt={attempt_number:number;outcome:string|null};
export type PracticalRunAttempt={
  attempt_number:number;status:string;
  recovery_request_id:string|null;recovery_decision:string|null;
};
export type PracticalAttemptDecision={
  allowed:boolean;reason:string|null;attemptNumber:number;
};
export function resolvePracticalAttempt(
  evidence:PracticalEvidenceAttempt|null,
  run:PracticalRunAttempt|null,
):PracticalAttemptDecision {
  if(evidence&&evidence.outcome!=="repeat_required"){
    const reason=evidence.outcome==="approved"
      ?"This Practical was already approved."
      :evidence.outcome==="integrity_review"
      ?"Integrity review must be resolved by its authorised reviewer."
      :"This Practical is already awaiting its TD review.";
    return {allowed:false,reason,attemptNumber:0};
  }
  const minAttempt=Number(evidence?.attempt_number||0)+1;
  if(!run||Number(run.attempt_number)<minAttempt)
    return {allowed:true,reason:null,attemptNumber:minAttempt};
  if(run.status==="abandoned"){
    if(run.recovery_decision!=="approve_repeat")
      return {allowed:false,reason:"An abandoned recording has no authorised TD recovery.",attemptNumber:0};
    return {allowed:true,reason:null,attemptNumber:Number(run.attempt_number)+1};
  }
  if(run.recovery_request_id&&run.recovery_decision==="integrity_review")
    return {allowed:false,reason:"The recording incident is under integrity review.",attemptNumber:0};
  if(run.status!=="active"&&run.status!=="complete")
    return {allowed:false,reason:"An unrecognised recording state cannot qualify.",attemptNumber:0};
  return {allowed:true,reason:null,attemptNumber:Number(run.attempt_number)};
}


/** Candidate setup shows available drill choices, never the sealed correct ID. */
export function projectPracticalSetupForSpecialist<T extends {setId?:string}>(step:T){
  const {setId:_examinerOnly,...visible}=step;
  return visible;
}

/** Specialists never receive sealed scenario truth or examiner-only integrity flags. */
export function projectSpecialistPracticalActionEvent(input:{
  stepNumber:number;operationKey:string;
  recordedPayload:Record<string,unknown>;recordedAt:string;
  systemSnapshot?:unknown;riskFlags?:unknown;
}) {
  return {
    stepNumber:input.stepNumber,
    operationKey:input.operationKey,
    recordedPayload:input.recordedPayload,
    recordedAt:input.recordedAt,
  };
}

// Initial engineering time guesses are non-binding. Durations are recorded for
// calibration; observable work and integrity govern approval.

/** Specialists are evaluated on professional readiness, not their home or possessions. */
export const PRACTICAL_VIDEO_REQUIREMENTS = [
  "Begin one continuous screen, face/camera and microphone recording BEFORE the first case is revealed.",
  "Show the working setup, relevant devices, visible response/work surface, audio, internet and session tools before starting.",
  "Keep relevant on-screen case, camera and audible Specialist response observable throughout all three cases.",
  "No cuts, edits, restarts, pauses, splicing, time compression or missing assessment intervals.",
  "Keep the unique attempt reference and each system-revealed case visible on the recording.",
  "Exclude real student data, household members, private spaces, credentials and unrelated personal information.",
  "End the recording AFTER the system confirms completion; share a privately accessible original-length video with your assigned TD.",
] as const;

export type PracticalRecordingDeclaration = {
  durationSeconds: number;
  recordingStartedBeforeReveal: boolean;
  continuousUneditedRecording: boolean;
  setupToolsDemonstrated: boolean;
};

export function validatePracticalRecordingDeclaration(
  proof: PracticalBenchmarkProof,
  input: PracticalRecordingDeclaration,
): string[] {
  const blockers:string[]=[];
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    blockers.push("The original recording must have a positive measured whole-second duration.");
  }
  if (input.recordingStartedBeforeReveal !== true) {
    blockers.push("The recording must begin before the first case is revealed.");
  }
  if (input.continuousUneditedRecording !== true) {
    blockers.push("Only one continuous, unedited recording may be submitted.");
  }
  if (input.setupToolsDemonstrated !== true) {
    blockers.push("The working environment, relevant tools and observability preflight must be shown.");
  }
  return blockers;
}

export type PracticalCaseReview = {
  caseKey: string;
  judgment: PracticalCaseJudgment;
  observedEvidence: string;
  videoTraceMatched: boolean;
};

export function validateCaseReviews(caseKeys: readonly string[], reviews: readonly PracticalCaseReview[]): string[] {
  const blockers:string[]=[];
  if (caseKeys.length !== PRACTICAL_BENCHMARK_CASE_COUNT || new Set(caseKeys).size !== PRACTICAL_BENCHMARK_CASE_COUNT) {
    return ["A complete, versioned three-case benchmark is required."];
  }
  if (reviews.length !== caseKeys.length || new Set(reviews.map(r=>r.caseKey)).size !== caseKeys.length) {
    blockers.push("The TD must judge every benchmark case exactly once.");
  }
  for(const key of caseKeys) {
    const review=reviews.find(r=>r.caseKey===key);
    if(!review || !["clear","partial","fail"].includes(review.judgment)) {
      blockers.push(`The TD has not judged case ${key}.`);
    }else if(review.observedEvidence.trim().length<30){
      blockers.push(`Case ${key} needs at least 30 characters of observable video evidence.`);
    }
  }
  if(reviews.some(r=>!caseKeys.includes(r.caseKey))) blockers.push("The TD supplied a case not in the system-issued benchmark.");
  return blockers;
}

export type PracticalVideoVerification = {
  observedDurationSeconds: number;
  recordingContinuous: boolean;
  recordingBeginsBeforeReveal: boolean;
  allThreeCasesVisible: boolean;
  environmentAndToolsVisible: boolean;
  specialistScreenFaceVoiceObservable: boolean;
  recordingConsentVerified: boolean;
  recordingAccessRestricted: boolean;
  noRealStudentDataOrBystanders: boolean;
  flaggedCutOrManipulation: boolean;
  flaggedTechnicalInterruption: boolean;
};

export function validatePracticalVideoVerification(
  proof:PracticalBenchmarkProof,
  verification:PracticalVideoVerification,
): string[] {
  const blockers:string[]=[];
  if(!Number.isSafeInteger(verification.observedDurationSeconds)
    || verification.observedDurationSeconds<=0)
    blockers.push("TD must verify the positive measured duration of the full original recording.");
  if(!verification.recordingContinuous || !verification.recordingBeginsBeforeReveal)
    blockers.push("The TD could not verify an uninterrupted recording from before case reveal.");
  if(!verification.allThreeCasesVisible) blockers.push("All three system-assigned situations must be observed.");
  if(!verification.environmentAndToolsVisible)
    blockers.push("The Specialist's delivery environment and relevant tools are not sufficiently observable.");
  if(!verification.specialistScreenFaceVoiceObservable)
    blockers.push("The Specialist's screen, face and voice are not sufficiently observable.");
  if(!verification.recordingConsentVerified)
    blockers.push("Recording consent must be verified against the issued assessment declaration.");
  if(!verification.recordingAccessRestricted)
    blockers.push("The original recording link must be demonstrably private to its authorised reviewer.");
  if(!verification.noRealStudentDataOrBystanders)
    blockers.push("Do not approve recordings exposing real student data or unrelated people.");
  if(verification.flaggedCutOrManipulation)
    blockers.push("Suspected cuts, editing or manipulation require integrity review.");
  if(verification.flaggedTechnicalInterruption)
    blockers.push("A recording interruption requires repeat or evidence recovery; it cannot be approved.");
  return blockers;
}
