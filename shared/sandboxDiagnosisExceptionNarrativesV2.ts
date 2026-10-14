/**
 * Rare worked-example confounds only, versioned for synthetic Diagnosis/Handover V2.
 * All clean student behaviours, legacy V1 bank definitions and diagnostic
 * placement rules remain unchanged. Genuine missing evidence remains a
 * recordable status, never an authored V2 student incident.
 */
export const SANDBOX_DIAGNOSIS_EXCEPTION_NARRATIVE_VERSION = 3 as const;

const EXCEPTION_STORIES: Record<string, string> = {
  "clarity.recognition.pattern_8": "The student identifies the important information, but a worked example beside the page names the appropriate method before they choose it. They close the example, explain the method in their own words, and make a sound written start.",
  "difficulty.recovery.pattern_8": "The student faces a difficult problem while an open notebook already displays the first mathematical move. They use that opening, put the notebook aside, and later work through a separate sticking point without rescue.",
  "execution.repeatability.pattern_8": "The student makes a valid independent start, but a previous worked solution showing the step sequence remains beside the page during the repeat. They glance towards it while working; the method itself never changes.",
  "stack.challenge_no_timer.pattern_8": "The student identifies the important details, but a worked example lying beside the task already names the method. The example is closed before working begins; the student's subsequent unaided execution and response to the hard point are visible.",
  "stack.normal_independent.pattern_8": "The student recognises the quantities, but an open revision page already names the applicable method before they choose it. They put the page aside and carry out the actual working without further cues.",
  "stack.timed_challenge.pattern_8": "Before the timer begins, a visible revision sheet names the appropriate method and the student sees it. The sheet is put away before the timed challenge; they then execute the steps under the clock without using it.",
  "time.consistency.pattern_8": "The student begins the repeated timed solve with a sound first step and controlled pace. A worked example beside the page shows the middle sequence and they glance towards it before completing the prescribed method; the step order does not change."
};

export function renderSandboxDiagnosisExceptionNarrativeV2(
  outcomeKey: string,
): string | null {
  const key = String(outcomeKey || "");
  if (/\.pattern_7$/.test(key)) return null; // Legacy V1-only.
  return EXCEPTION_STORIES[key] || null;
}
