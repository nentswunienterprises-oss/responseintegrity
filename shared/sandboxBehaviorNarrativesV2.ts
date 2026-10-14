import type { TopicPhase } from "./topicConditioningEngine";
import {
  getLegacyStatefulSandboxV1RequiredStructureStepPlanAudit,
} from "./statefulSandboxV1ScenarioTruthAudit";

/**
 * V2 Specialist-visible Sandbox narrative authority.
 *
 * Evidence comes exclusively from the versioned private Outcome Matrix and
 * its audited Training V4 projection. These descriptions cannot change
 * canonical fields, intervention truth, transition class or scoring.
 *
 * There are 11 set contexts x 3 turns and 7 V2-eligible patterns
 * (six ordinary patterns and one exceptional worked-example confound):
 * 231 distinct set/rep/outcome narratives. V2 does not fabricate missing
 * observations; historical V1 narration remains untouched.
 */
export const SANDBOX_BEHAVIOR_NARRATIVE_VERSION = 4 as const;

const SET_SCENES: Record<string, readonly [string, string, string]> = {
  "clarity.identification": [
    "The Specialist asks the student to identify what matters before any calculation.",
    "Another recognition prompt is presented without a worked example.",
    "For the final recognition prompt, the student has to choose and explain a method unaided."
  ],
  "clarity.light_apply": [
    "The student is now asked to use their reading of the problem in a short written start.",
    "A second light application checks whether the same understanding reaches the working.",
    "On the last light application, the method must carry into a fresh start."
  ],
  "structured_execution.required_structure": [
    "Before any calculation, the Specialist asks the student to state their intended step order.",
    "A second plan-first problem is given before the student begins solving.",
    "The final plan-first task again requires an ordered method before the first operation."
  ],
  "structured_execution.independent_execution": [
    "The Specialist holds back method hints while the student attempts a complete solve.",
    "Another independent solve begins without a supplied next step.",
    "The last independent attempt requires the student to own the whole method."
  ],
  "structured_execution.variation_control": [
    "The familiar method appears in a changed problem form, without a worked model.",
    "A second changed-form problem calls for the same method in a different presentation.",
    "The final variation is introduced without a step-by-step prompt."
  ],
  "controlled_discomfort.controlled_entry": [
    "The Specialist introduces a challenging problem and watches how the student enters it.",
    "Another unfamiliar point appears while only minimal support remains available.",
    "At the last difficult entry, the student must decide on their first workable move."
  ],
  "controlled_discomfort.no_rescue": [
    "The student meets a difficult point while full rescue is withheld; a first-step confirmation is the support limit.",
    "A second obstacle appears under the same first-step-only boundary.",
    "The last no-rescue attempt retains the boundary against supplied methods and worked steps."
  ],
  "controlled_discomfort.repeat_exposure": [
    "A challenging problem is presented without a model or rescue step.",
    "Another comparable difficult encounter follows, again without Specialist help.",
    "At the final exposure, the student faces the same level of difficulty unaided."
  ],
  "time_pressure.structure_under_timer": [
    "The light timer starts while the student must still show the method in order.",
    "A comparable timed attempt begins with the same requirement to preserve working.",
    "The last structure-under-timer attempt begins without added time or rescue."
  ],
  "time_pressure.repeated_timed_execution": [
    "The student begins a full timed solve under the repeated-timer condition.",
    "Another comparable task is timed, with no change to the support boundary.",
    "The final repeat keeps the timer running while all method steps remain required."
  ],
  "time_pressure.full_constraint": [
    "The tightest prescribed time constraint is applied to a complete solution.",
    "A second full-constraint attempt begins without easing the clock.",
    "The last task retains the full timer and the requirement to complete without help."
  ]
};

const OBSERVED_RESPONSES: Record<TopicPhase, Record<number, readonly [string, string, string]>> = {
  "Clarity": {
    "1": [
      "They look over the symbols, name the relevant quantities aloud, and choose an appropriate procedure. When asked why it fits, they point to a feature of the prompt without seeking a hint.",
      "They pick out the important quantities again without being directed to them. A suitable method follows, together with the feature that makes it appropriate.",
      "They read the problem, identify the important terms, and explain their method choice in one connected response without looking for confirmation."
    ],
    "2": [
      "They identify the correct quantities and name the method quickly. At the explanation their voice trails off briefly before they give most, but not all, of the link.",
      "They recognise what matters and offer a method without a prompt. Their reason comes after a pause and leaves one connection unsaid before they carry on.",
      "They point to the relevant terms, settle on a fitting approach, and hesitate when explaining it. Most of the reasoning emerges; one link stays implicit."
    ],
    "3": [
      "They pick out two useful parts but overlook another. Their first method suggestion changes after a pause, and their explanation connects to only part of the problem.",
      "They give a few relevant names, stop, reread, and switch procedures. Their reason follows only one part of the relationship, although they eventually attempt to begin.",
      "They identify some needed information, miss another piece, and try one method before offering a different one. The justification does not account for the whole prompt."
    ],
    "4": [
      "They pass over an important term at first glance, yet choose the appropriate procedure. Their explanation cites a related rule without fully showing why it applies here.",
      "They skip a term when naming the problem's pieces, then immediately state a workable method. Asked why, they give a nearby principle rather than the entire link.",
      "They identify enough to select the right procedure but leave one key term unnamed. A partial reason follows; they continue without asking the Specialist to resolve it."
    ],
    "5": [
      "They recognise some elements but cannot account for one important feature. They cross out their first method idea, offer another, and start after a long pause.",
      "They name a few correct parts, then hesitate over the method. Their explanation relies on one clue only; they begin, stop, and revisit the prompt.",
      "They point to what they know, leave a deciding detail aside, and move between two possible approaches. Their eventual start rests on an incomplete explanation."
    ],
    "6": [
      "They list details that do not determine the setup and cannot offer a workable method. Asked why a step might fit, they fall silent instead of beginning.",
      "They look at the prompt again but focus on unhelpful features. No viable procedure is offered, and they wait rather than make a controlled start.",
      "They name peripheral details while missing what determines the method. Their response stalls before a defensible first step appears."
    ],
    "8": [
      "The student identifies the relevant features, but a worked example beside the page names the procedure before they choose it. They select the method and explain why it fits in their own words.",
      "They recognise the quantities, glance at an open notebook heading showing the procedure, and use that method. They independently explain its mathematical connection.",
      "They pick out the terms while a nearby revision sheet displays the correct procedure name. They use that name, then explain its application without reading any explanation."
    ]
  },
  "Structured Execution": {
    "1": [
      "They write an appropriate first line without prompting and carry the next steps in order. Their attention stays on the work rather than the Specialist.",
      "They put down a sound opening operation and continue through the familiar method. No reassurance request interrupts the sequence.",
      "They begin independently, keep the steps connected, and finish the visible work without asking someone to take the next step."
    ],
    "2": [
      "They pause at the opening, put down a sound move, then place one later step too early. They notice and correct the order without help.",
      "The known method emerges after a brief hesitation; one line is out of place. They return to it, correct it, and keep responsibility for the solve.",
      "They begin with the right operation, hesitate over the next sequence, and reorder a small part of the work themselves before continuing."
    ],
    "3": [
      "They write the expected opening, then discover a missing line and insert it. Near the end they glance at the Specialist and ask whether the method is still right.",
      "They start along the known method but leave a gap between two steps. They go back to fill it, then look for a brief reassurance before proceeding.",
      "They organise several lines in order, notice an omitted operation, and retrace the work. An anxious check toward the Specialist precedes their next move."
    ],
    "4": [
      "Their first operation does not belong in the method. They cross it out and try again, but later steps still arrive out of order and they ask for help.",
      "They hesitate, choose the wrong opening move, and correct it. The later sequence drifts again and they repeatedly look for the Specialist to guide it.",
      "They attempt to recover an early misstep, yet the working remains disordered. Several requests for help interrupt the attempted solve."
    ],
    "5": [
      "They write one operation, cross it out, and try another without joining the steps. Twice they ask what should come next before making further progress.",
      "They begin with a small fragment, stop at the next decision, and ask for the next step. The method has gaps they cannot bridge independently.",
      "They attempt the start, erase it, and leave much of the sequence unwritten. Their next move follows another request for direction."
    ],
    "6": [
      "They wait without a usable first line, then write operations disconnected from the known method. Work stops again unless the Specialist supplies direction.",
      "They cannot settle on a first operation and write scattered steps that do not form the taught sequence. They turn the next decision over to the Specialist.",
      "They remain stuck at the start, then add lines that do not connect into a method. The task does not move forward independently."
    ],
    "8": [
      "They begin with a valid step, but an old worked example beside the page shows the next operation. They look at it before continuing in the prescribed method.",
      "They start independently, then glance at a previous model answer lying beside their work during the middle steps. They continue in the original step order.",
      "They make a sound opening move, then consult an earlier worked solution lying open during the middle operations. The taught method itself never changes."
    ]
  },
  "Controlled Discomfort": {
    "1": [
      "They meet the unfamiliar part without handing it over, write a sensible first line, and keep adjusting their work through the stuck point.",
      "After reading the difficult turn, they make an appropriate opening move. When it fails to resolve the whole task, they try again without asking for a rescue.",
      "They remain with the hard problem, begin purposefully, and revise a line while keeping ownership of the next attempt."
    ],
    "2": [
      "They stop writing when the unfamiliar part appears and reread for several seconds. A sensible first move follows; they erase one later line and restart unaided.",
      "They look at the difficult section for a moment before putting anything down. After a sound start they pause again, correct one line, and continue without requesting a solution.",
      "They hesitate at the obstacle, reread it, and eventually begin. A later erasure and restart does not lead them to ask the Specialist to take over."
    ],
    "3": [
      "They hesitate at the difficult turn, try a tentative first line, and replace it. A workable direction follows, along with a quick request to know whether they are on track.",
      "Their first attempt is uncertain and immediately revised. They try several small moves before finding a route, then look for reassurance as they proceed.",
      "They stay engaged but waver through the opening. After changing their initial line and trying again, they ask once whether the direction is right."
    ],
    "4": [
      "They stop completely at the first hard point. They eventually restart on their own and work for a short stretch, but lose their hold on the task again.",
      "The first difficult move leaves them motionless for several seconds. They re-enter with a sensible line, remain engaged briefly, then stop once more.",
      "They initially freeze, recover enough to write a workable first step, and continue a little way. Their engagement fades again before the task is secure."
    ],
    "5": [
      "They look away from the problem at the unfamiliar step and stay silent. One uncertain line appears, followed by another stop and repeated requests for help.",
      "The difficult part halts their work. They put down a tentative line, abandon it, and ask the Specialist what to do more than once.",
      "They pause for several seconds, start a fragment, and withdraw from the work again. Repeated requests for direction interrupt further progress."
    ],
    "6": [
      "They stop when the work becomes difficult, say they cannot do it, and do not produce a usable first step. They immediately ask the Specialist to take over.",
      "At the unfamiliar section they put the pen down and say the problem is impossible for them. No workable start follows without a rescue request.",
      "They refuse a first move at the challenging point, saying they cannot continue. They ask the Specialist to solve it rather than re-enter the task."
    ],
    "8": [
      "They remain engaged, but an open worked example beside the problem already shows its first step. They use that opening, then recover independently at a later difficult point.",
      "They face the hard item while a reference sheet shows a worked first move. They take that opening, then manage a later obstacle without asking the Specialist for a solution.",
      "They approach the challenge willingly, but earlier notes visible beside the page supply the first operation. They later persist through another stuck point without rescue."
    ]
  },
  "Time Pressure Stability": {
    "1": [
      "As the clock starts, they write an appropriate first line and keep the steps in order. Their pace stays even, and the answer is finished within the limit.",
      "They begin as soon as the timer runs, carry the method from one line to the next, and complete the work without hurrying away from the sequence.",
      "They look at the timed prompt and start promptly. Their written structure remains intact through the final step before time expires."
    ],
    "2": [
      "They watch the timer briefly before writing a sound opening line. Later they speed up, yet keep the method in order and finish inside the limit.",
      "A short glance toward the clock delays their start. They then work through the right sequence, picking up pace midway without dropping steps.",
      "They pause at the active timer, make a sound first move, and accelerate as time falls. The steps stay connected through completion."
    ],
    "3": [
      "They begin after a short delay and write a workable opening. With the clock dropping, they compress two steps and reach an answer without showing their earlier full method.",
      "They start with a usable line, then shorten the working as time runs down. The final answer arrives, but intermediate method steps are missing.",
      "A hesitant first move develops into partly ordered work. Near the limit, they skip writing out steps that were present in their earlier method."
    ],
    "4": [
      "They stare at the timer for a few seconds, write a first line, then cross part of it out. After jumping over more steps, they reach an answer with gaps.",
      "Their start is disrupted by the running clock. They revise the opening and speed past several operations before settling into a steadier finish with incomplete working.",
      "They watch the seconds pass, begin hesitantly, and cross out the first attempt. Later they recover some pace, but leave visible holes in the method."
    ],
    "5": [
      "They remain still after the timer starts, then put down disordered working. Their pace quickens, steps are skipped, and time ends before a complete solution.",
      "A long pause consumes the beginning of the timed task. They rush into the method, overwrite an answer, and fail to complete before the clock stops.",
      "They delay their first move, accelerate abruptly, and lose the step order. Several crossings-out follow, with no finished solution by the limit."
    ],
    "6": [
      "They sit motionless as the clock starts, then write disconnected lines rapidly. They abandon one line and begin another; the timer ends before a full solve.",
      "The running timer leaves them stalled at the start. When they finally write, the operations do not form a usable sequence before time expires.",
      "They hesitate for several seconds, rush through fragments of work, and cross out an attempted answer. A complete method never appears within the limit."
    ],
    "8": [
      "They start promptly and keep a controlled pace. A worked example beside the page shows middle steps and they glance at it while solving. They finish on time in the original taught order.",
      "They begin with a valid timed first line. A reference sheet containing the next steps is visible and they look towards it mid-solve. They finish steadily without any change to the prescribed method.",
      "They start on time and continue at an even pace, but consult an old worked solution for some middle operations. They complete all steps within the limit; the task and required sequence never change."
    ]
  }
};

const EXECUTION_COMPARISON: Record<number, string> = {
  "1": "Against the earlier comparable attempt, the same method appears without a meaningful change in order.",
  "2": "The method reappears; one small sequencing slip is noticed and corrected.",
  "3": "Some of the earlier structure returns, but it does not remain consistent through the attempt.",
  "4": "The method returns only in pieces, with the ordering still changing materially.",
  "5": "The earlier method pattern fails to repeat without further prompting.",
  "6": "The previous usable sequence does not emerge during this attempt.",
  "8": "The prescribed method remains unchanged, but the visible worked example prevents an independent method comparison."
};

export function renderSandboxBehaviorNarrativeV2(input: {
  phase: TopicPhase;
  setId: string;
  outcomeKey: string;
  repNumber: number;
}): string | null {
  if (!Number.isInteger(input.repNumber) || input.repNumber < 1 || input.repNumber > 3) return null;
  const expectedKey = input.setId + ".rep_" + input.repNumber + ".pattern_";
  if (!input.outcomeKey.startsWith(expectedKey)) return null;
  const pattern = Number(input.outcomeKey.slice(expectedKey.length));
  // Pattern 7 is historical V1-only: "not observed" is an evidence status,
  // never a generated simulated-student encounter in V2.
  if (!Number.isInteger(pattern) || pattern < 1 || pattern > 8 || pattern === 7) return null;
  const phaseFromSet =
    input.setId.startsWith("clarity.") ? "Clarity" :
    input.setId.startsWith("structured_execution.") ? "Structured Execution" :
    input.setId.startsWith("controlled_discomfort.") ? "Controlled Discomfort" :
    input.setId.startsWith("time_pressure.") ? "Time Pressure Stability" : null;
  if (phaseFromSet !== input.phase) return null;
  const scene = SET_SCENES[input.setId]?.[input.repNumber - 1];
  const action = OBSERVED_RESPONSES[input.phase]?.[pattern]?.[input.repNumber - 1];
  if (!scene || !action) return null;
  const additions: string[] = [];
  if (input.setId === "structured_execution.required_structure") {
    const observedPlan = getLegacyStatefulSandboxV1RequiredStructureStepPlanAudit(input.outcomeKey)?.behavior;
    if (!observedPlan) return null;
    additions.push(pattern === 8 ? "An earlier worked example beside the page already shows the step plan. The taught method does not change." : observedPlan);
  }
  if (input.phase === "Structured Execution" && input.repNumber > 1) {
    const comparison = EXECUTION_COMPARISON[pattern];
    if (!comparison) return null;
    additions.push(comparison);
  }
  return [scene, action, ...additions].join(" ");
}
