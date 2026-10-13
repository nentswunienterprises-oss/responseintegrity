/**
 * Exception-only, versioned language for synthetic Diagnosis/Handover V2.
 * All clean student behaviours, legacy V1 bank definitions and diagnostic
 * placement rules remain unchanged. Real evidence gaps are never capped.
 */
export const SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION = 2 as const;

const EXCEPTION_STORIES: Record<string, string> = {
  "clarity.recognition.pattern_7": "The student identifies the key mathematical details, chooses an appropriate method and explains why it fits. The observation moves on before the Specialist asks for the first independent written application, so that action has not been seen.",
  "clarity.recognition.pattern_8": "The student identifies the important information, but a worked example beside the page names the appropriate method before they choose it. They close the example, explain the method in their own words, and make a sound written start.",
  "difficulty.recovery.pattern_7": "The student meets a difficult point, makes a valid independent first move and works through it visibly. The student's microphone is not carrying audio during part of the challenge, so any request for help during that interval cannot be heard.",
  "difficulty.recovery.pattern_8": "The student faces a difficult problem while an open notebook already displays the first mathematical move. They use that opening, put the notebook aside, and later work through a separate sticking point without rescue.",
  "execution.repeatability.pattern_7": "The student starts independently in view and repeats the taught method with orderly written steps. Part of the previous working position was out of camera view, so whether reference notes were consulted cannot be established from that comparison.",
  "execution.repeatability.pattern_8": "The student makes a valid independent start, but a previous worked solution showing the step sequence remains beside the page during the repeat. They glance towards it while working; the method itself never changes.",
  "stack.challenge_no_timer.pattern_7": "The student recognises the problem, applies the method and works through the unfamiliar point with a controlled response. During part of the difficult segment the microphone is muted; the writing is visible but any request for rescue cannot be heard.",
  "stack.challenge_no_timer.pattern_8": "The student identifies the important details, but a worked example lying beside the task already names the method. The example is closed before working begins; the student's subsequent unaided execution and response to the hard point are visible.",
  "stack.normal_independent.pattern_7": "The student identifies the relevant information and produces correctly ordered working. Their desk is partly outside the camera view while they solve, so use of an unseen reference cannot be ruled in or out; independence is not established by this attempt.",
  "stack.normal_independent.pattern_8": "The student recognises the quantities, but an open revision page already names the applicable method before they choose it. They put the page aside and carry out the actual working without further cues.",
  "stack.timed_challenge.pattern_7": "The student starts the timed challenge promptly and preserves the method while the writing is visible. The camera does not show the final part of the work at the prescribed stop, so a complete valid final response cannot be confirmed.",
  "stack.timed_challenge.pattern_8": "Before the timer begins, a visible revision sheet names the appropriate method and the student sees it. The sheet is put away before the timed challenge; they then execute the steps under the clock without using it.",
  "time.consistency.pattern_7": "The student begins promptly under the timer, keeps the method in order and maintains controlled writing pace. The final part of the completed work is hidden when the timer ends and is not shown before the opportunity closes.",
  "time.consistency.pattern_8": "The student begins the repeated timed solve with a sound first step and controlled pace. A worked example beside the page shows the middle sequence and they glance towards it before completing the prescribed method; the step order does not change."
};

export function renderSandboxDiagnosisExceptionNarrativeV2(
  outcomeKey: string,
): string | null {
  return EXCEPTION_STORIES[String(outcomeKey || "")] || null;
}
