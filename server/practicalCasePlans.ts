import type { TopicPhase } from "@shared/topicConditioningEngine";

/**
 * PRIVATE, VERSIONED PRACTICALS WORKFLOWS.
 * System-issued actions are performed in an isolated examination record.
 * Drill/set identities come from the same training registry used by Sandbox.
 * This is not a writable student or training session.
 */
export type PracticalWorkStep = Readonly<{
  kind: "configure" | "respond" | "rep" | "adaptive" | "decide";
  label: string;
  prompt: string;
  phase?: TopicPhase;
  setId?: string;
  repNumber?: number;
  studentBehavior?: string;
  observedSupport?: "none" | "first_step_confirmation" | "method_or_step_prompt" | "unobserved" | "timer_interrupted";
}>;

const step = (
  kind: PracticalWorkStep["kind"], label: string, prompt: string,
  extras: Partial<PracticalWorkStep> = {},
): PracticalWorkStep => Object.freeze({ kind, label, prompt, ...extras });

const clarity:TopicPhase="Clarity";
const se:TopicPhase="Structured Execution";
const cd:TopicPhase="Controlled Discomfort";
const tps:TopicPhase="Time Pressure Stability";

export const PRACTICAL_WORKFLOW_BANK_VERSION = 1;

const workflows: Record<string, readonly PracticalWorkStep[]> = {
  "prepare.clarity_entry": [
    step("configure","Open the Clarity session condition","Use the real training drill registry to configure the Clarity entry, visibility and allowed support.",{phase:clarity,setId:"clarity.identification"}),
    step("respond","Open the simulated student opportunity","The student asks what the changed question requires. Deliver your actual student-facing instruction aloud.",{phase:clarity,studentBehavior:"I know this topic, but I cannot work out what this question is asking me to do."}),
    step("rep","Log the observed Clarity opportunity","The student names the topic but hesitates before choosing a method. Capture the rep in the actual Clarity observation fields.",{phase:clarity,setId:"clarity.identification",repNumber:1,studentBehavior:"Names topic, pauses on method, makes one tentative first step.",observedSupport:"none"}),
    step("decide","Close the Clarity entry","Select the next authorised action and explain what this observed evidence does and does not establish."),
  ],
  "prepare.structured_execution": [
    step("configure","Configure the no-support SE set","Open the system-selected independent execution drill; do not substitute worked examples or a lower support condition.",{phase:se,setId:"structured_execution.independent_execution"}),
    step("rep","Run and log independent rep one","Simulated student works through the assigned problem with an incomplete method, without a Specialist cue.",{phase:se,setId:"structured_execution.independent_execution",repNumber:1,studentBehavior:"Starts alone, follows two steps, then guesses the final step.",observedSupport:"none"}),
    step("rep","Run and log independent rep two","Simulated student re-attempts the same-form opportunity without any support.",{phase:se,setId:"structured_execution.independent_execution",repNumber:2,studentBehavior:"Starts without cue, maintains method, needs time to verify last step.",observedSupport:"none"}),
    step("decide","Record the independent set result","Preserve what each rep actually proved, without averaging or upgrading independence."),
  ],
  "prepare.tps_baseline": [
    step("configure","Prepare clean baseline acquisition","TPS has no authorised three-rep SE baseline. Configure an independent, same-form SE set with passive timing only.",{phase:se,setId:"structured_execution.independent_execution"}),
    step("rep","Capture baseline candidate one","First independently completed same-form SE opportunity; collect the observed response and timing evidence.",{phase:se,setId:"structured_execution.independent_execution",repNumber:1,studentBehavior:"Completes first same-form rep independently; passive time reference is visible.",observedSupport:"none"}),
    step("rep","Capture baseline candidate two","Second same-form opportunity. Preserve rep-specific observations and passive time reference.",{phase:se,setId:"structured_execution.independent_execution",repNumber:2,studentBehavior:"Completes second comparable rep without prompts; passive timing visible.",observedSupport:"none"}),
    step("rep","Capture baseline candidate three","Third same-form opportunity. Do not assert a TPS target until the system validates all three.",{phase:se,setId:"structured_execution.independent_execution",repNumber:3,studentBehavior:"Completes third comparable rep without support; passive timing visible.",observedSupport:"none"}),
    step("decide","Return baseline evidence to the system","Select the authorised next step without inventing a timer contract or advancing TPS yourself."),
  ],
  "execute.clarity_ambiguity": [
    step("configure","Open Clarity's assigned condition","Configure the real Clarity recognition/entry drill and a visible response surface.",{phase:clarity,setId:"clarity.identification"}),
    step("respond","Speak to the confused simulated student","The student is uncertain what action the question requests. Respond as though they were present, preserving the no-method-rescue boundary.",{phase:clarity,studentBehavior:"I can read the question but I cannot tell what it wants me to find or name."}),
    step("rep","Capture the response actually observed","The student identifies the operation after a neutral instruction but still hesitates on method. Log the rep, including your intervention.",{phase:clarity,setId:"clarity.identification",repNumber:1,studentBehavior:"Names the requested action after clarification; method remains uncertain.",observedSupport:"first_step_confirmation"}),
    step("decide","Choose Clarity's next action","Explain why the observed response does or does not justify stronger capability."),
  ],
  "execute.controlled_discomfort": [
    step("configure","Open the CD no-rescue condition","Configure the existing CD no-rescue training set; preserve the assigned difficulty and work visibility.",{phase:cd,setId:"controlled_discomfort.no_rescue"}),
    step("adaptive","Execute the stateful student interaction","Run all three server-revealed adaptive turns in the existing Execute challenge. Your saved interventions and observations must match the recording.",{phase:cd}),
    step("rep","Log the observable CD evidence","The student requests rescue and later work becomes difficult to observe. Capture an actual rep and its limits.",{phase:cd,setId:"controlled_discomfort.no_rescue",repNumber:1,studentBehavior:"Student seeks help, tries one step, then work view becomes unavailable.",observedSupport:"unobserved"}),
    step("decide","Close the no-rescue sequence","Preserve intervention history, observability and the system-owned next action."),
  ],
  "execute.tps_interruption": [
    step("configure","Open the governed timed condition","Demonstrate actual timer/work-view controls in the existing TPS training set.",{phase:tps,setId:"time_pressure.structure_under_timer"}),
    step("respond","Handle the injected interruption live","The timed response loses the work camera and the timer cue stops being reliable. Speak to the student; do not treat unseen work as measured independence.",{phase:tps,studentBehavior:"The camera froze and the timer jumped. I finished everything while you could not see; can you mark it independent?"}),
    step("rep","Log the interrupted timed opportunity","The student claims completion during an unobservable interval with unreliable timing. Record the evidence and time status.",{phase:tps,setId:"time_pressure.structure_under_timer",repNumber:1,studentBehavior:"Work view missing and timer unreliable; completion claimed but not verifiable.",observedSupport:"timer_interrupted"}),
    step("decide","Preserve interruption and recovery","Choose a legitimate recovery/escalation path; do not silently restart the clock or claim stability."),
  ],
  "evidence.assistance": [
    step("rep","Log assisted rep 1","Rep 1 completed after a first-step confirmation. Record the genuine intervention and evidence status.",{phase:se,setId:"structured_execution.independent_execution",repNumber:1,studentBehavior:"Starts only after first-step prompt and completes task.",observedSupport:"first_step_confirmation"}),
    step("rep","Log assisted rep 2","Rep 2 needed a method reminder. Do not present its completion as independent.",{phase:se,setId:"structured_execution.independent_execution",repNumber:2,studentBehavior:"Completes task after a method/step reminder.",observedSupport:"method_or_step_prompt"}),
    step("rep","Log clean rep 3","Rep 3 completed independently, without support. Preserve the difference from the earlier reps.",{phase:se,setId:"structured_execution.independent_execution",repNumber:3,studentBehavior:"Completes set with no intervention and visible work.",observedSupport:"none"}),
    step("decide","Correct the session evidence conclusion","Record what is established and what remains unsupported without erasing the assisted history."),
  ],
  "evidence.not_observed": [
    step("rep","Record unobserved rep 1","Camera disconnected; final answer appears when the view returns. The work itself was not seen.",{phase:cd,setId:"controlled_discomfort.no_rescue",repNumber:1,studentBehavior:"Answer correct after the camera disconnect; no response steps observed.",observedSupport:"unobserved"}),
    step("rep","Record unobserved rep 2","Another answer appears during the camera outage; no evidence of independent response conduct.",{phase:cd,setId:"controlled_discomfort.no_rescue",repNumber:2,studentBehavior:"Second correct answer obtained with no work visibility.",observedSupport:"unobserved"}),
    step("rep","Record supported rep 3","Work view returns, but a first-step prompt is needed. Preserve assistance.",{phase:cd,setId:"controlled_discomfort.no_rescue",repNumber:3,studentBehavior:"Visible completion after a first-step prompt.",observedSupport:"first_step_confirmation"}),
    step("decide","Correct the unsupported stability conclusion","Choose evidence recovery or another authorised action; do not claim phase stability."),
  ],
  "evidence.phase_exit": [
    step("rep","Log clean TPS rep 1","First clean, fully observed same-form timed opportunity.",{phase:tps,setId:"time_pressure.structure_under_timer",repNumber:1,studentBehavior:"Independent, fully observed timed completion.",observedSupport:"none"}),
    step("rep","Log clean TPS rep 2","Second clean same-form timed opportunity.",{phase:tps,setId:"time_pressure.structure_under_timer",repNumber:2,studentBehavior:"Independent, fully observed timed completion.",observedSupport:"none"}),
    step("rep","Log invalid timer rep 3","Timer ends early. Completion cannot be treated as a valid timed response.",{phase:tps,setId:"time_pressure.structure_under_timer",repNumber:3,studentBehavior:"Task completed, but the timer stopped before the response ended.",observedSupport:"timer_interrupted"}),
    step("rep","Log assisted rep 4","Unrecorded help was provided. Preserve this as contaminated evidence.",{phase:tps,setId:"time_pressure.structure_under_timer",repNumber:4,studentBehavior:"Completion after an undocumented method reminder.",observedSupport:"method_or_step_prompt"}),
    step("decide","Reject unsupported phase exit","Select the system-owned confirmation boundary and identify the missing qualifying evidence."),
  ],
};

export function getPracticalCasePlan(caseKey:string):readonly PracticalWorkStep[] {
  const plan=workflows[caseKey];
  if(!plan || plan.length<2)throw new Error("Practicals case has no governed execution plan: "+caseKey);
  return plan;
}
export function getPracticalCaseKeysWithPlans(){return Object.keys(workflows)}
