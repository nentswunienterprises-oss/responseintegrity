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
export const PRACTICAL_BENCHMARK_VERSION = 1;
export const PRACTICAL_BENCHMARK_CASE_COUNT = 3;
export type PracticalBenchmarkProof = "prepare" | "execute" | "evidence";
export type PracticalCaseJudgment = "clear" | "partial" | "fail";

export const PRACTICAL_RECORDING_WINDOWS = {
  prepare: { minSeconds: 10 * 60, maxSeconds: 18 * 60 },
  execute: { minSeconds: 12 * 60, maxSeconds: 22 * 60 },
  evidence: { minSeconds: 10 * 60, maxSeconds: 18 * 60 },
} as const;

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
  const window=PRACTICAL_RECORDING_WINDOWS[proof];
  if (!Number.isInteger(input.durationSeconds)
      || input.durationSeconds < window.minSeconds
      || input.durationSeconds > window.maxSeconds) {
    blockers.push(`The ${proof} recording must be between ${window.minSeconds / 60} and ${window.maxSeconds / 60} minutes.`);
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
  flaggedCutOrManipulation: boolean;
  flaggedTechnicalInterruption: boolean;
};

export function validatePracticalVideoVerification(
  proof:PracticalBenchmarkProof,
  verification:PracticalVideoVerification,
): string[] {
  const blockers:string[]=[];
  const window=PRACTICAL_RECORDING_WINDOWS[proof];
  if(!Number.isInteger(verification.observedDurationSeconds)
    || verification.observedDurationSeconds<window.minSeconds
    || verification.observedDurationSeconds>window.maxSeconds)
    blockers.push("The TD-observed recording duration is outside the fixed range.");
  if(!verification.recordingContinuous || !verification.recordingBeginsBeforeReveal)
    blockers.push("The TD could not verify an uninterrupted recording from before case reveal.");
  if(!verification.allThreeCasesVisible) blockers.push("All three system-assigned situations must be observed.");
  if(!verification.environmentAndToolsVisible)
    blockers.push("The Specialist's delivery environment and relevant tools are not sufficiently observable.");
  if(!verification.specialistScreenFaceVoiceObservable)
    blockers.push("The Specialist's screen, face and voice are not sufficiently observable.");
  if(verification.flaggedCutOrManipulation)
    blockers.push("Suspected cuts, editing or manipulation require integrity review.");
  if(verification.flaggedTechnicalInterruption)
    blockers.push("A recording interruption requires repeat or evidence recovery; it cannot be approved.");
  return blockers;
}
