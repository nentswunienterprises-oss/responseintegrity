/**
 * Founder-approved evidence-integrity authoring boundary, 2026-10-13.
 *
 * Missing evidence remains a real *recording status*, not a staged
 * simulated-student incident. For learner-facing simulated confounds, the
 * defensible scenario is a visible worked mathematical example supplying the
 * intended independent method/step. Technical preflight and real incident
 * recovery remain separate operating skills and are not prohibited here.
 *
 * Preserve archived banks as historical evidence. Apply to new authoring.
 */
const EVIDENCE_SENSITIVE_BANK = /^(?:handover_verification|how_the_system_resolves_uncertainty|how_to_diagnose|how_to_interpret_prompts|intro_session_structure|logging_system|what_not_to_do)_mastery_v1$|^operating_system_(?:retrieval|transfer)_v2$/;

const INVENTED_EVIDENCE_INCIDENTS: Array<{label:string;pattern:RegExp}> = [
  {label:"camera or phone freeze as a student observation",pattern:/\b(?:camera|phone|video) (?:freez(?:e|es)|glitch(?:es)?)\b.{0,130}\b(?:student|rep|step|method|work)/i},
  {label:"audio dropout as a simulated student observation",pattern:/\baudio drops? out\b|\bmicrophone cuts? out\b/i},
  {label:"missing independent work due to camera angle",pattern:/\b(?:camera angle|camera view) (?:hides?|misses?|lost|unreliable)\b.{0,130}\b(?:student|step|work|response)/i},
  {label:"student disappears from camera during evidence",pattern:/\b(?:student (?:moves?|goes?) off.camera|working surface (?:leaves|moves out of) (?:the )?(?:camera|view|frame))\b/i},
  {label:"fictional connectivity incident used as evidence gap",pattern:/\b(?:device|connection|loud) interruption\b.{0,125}\b(?:student|step|behavior|evidence|rep|response)/i},
  {label:"Specialist forgets to observe the required dimension",pattern:/\b(?:forgot to watch|failed to elicit|never (?:asked|elicited) (?:the )?explanation)\b/i},
  {label:"fictional mathematics-changing display incident",pattern:/\b(?:display refreshes|screen glitch|new displayed order|changes the required step order)\b/i},
];

export function supersededEvidenceScenarioReason(input:{
  assessmentKey:string;
  itemKey:string;
  competencyKey:string;
  text:string;
}): string | null {
  if (!EVIDENCE_SENSITIVE_BANK.test(input.assessmentKey)) return null;

  // Setup, demonstration, and genuine incident-recovery training are still
  // essential Specialist operating work, not routine student exceptions.
  if (/(?:^|_)(?:tools?|model|session_flow|baselines|technical_recovery)(?:_|$)/.test(input.itemKey)) return null;
  if (/^(?:tools|session_flow|baselines)\./.test(input.competencyKey)) return null;

  for(const candidate of INVENTED_EVIDENCE_INCIDENTS) {
    if(candidate.pattern.test(input.text)) return candidate.label;
  }
  return null;
}

export function assertNoSupersededEvidenceScenario(input:{
  assessmentKey:string;
  itemKey:string;
  competencyKey:string;
  text:string;
}): void {
  const issue=supersededEvidenceScenarioReason(input);
  if(issue) throw new Error(
    "Capability bank "+input.assessmentKey+"/"+input.itemKey+
    " teaches a superseded evidence-exception scenario ("+issue+
    "). Not-observed is a narrow evidence status; do not fictionalize missed observations. "+
    "Use a rare visible worked mathematical example when teaching an actual confounded independence claim."
  );
}
