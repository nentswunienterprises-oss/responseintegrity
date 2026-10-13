import type { ComponentProps } from "react";
import type { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";

// Public formative practice only. These interactions never submit Capability evidence.
export const SESSION_INFRASTRUCTURE_TEACHING = {
  "intro_session_structure": [
    {
      "prompt": "Two newly activated topics are being diagnosed. One has enough clean evidence for placement; the other still lacks an observed opening response. What is the correct next action?",
      "options": [
        {
          "key": "a",
          "label": "Keep both topics open until they have completed the same number of diagnostic opportunities.",
          "feedback": "Equal rep counts are not the completion rule; each topic has its own evidence question."
        },
        {
          "key": "b",
          "label": "Place both topics from the stronger topic’s result because the same student completed both.",
          "feedback": "One topic’s behavior cannot establish another topic’s state."
        },
        {
          "key": "c",
          "label": "Close the resolved topic and present only the next check requested for the unresolved topic.",
          "feedback": "Each topic stops when its own entry-state evidence is complete."
        },
        {
          "key": "d",
          "label": "Teach the unresolved topic’s opening method before collecting its missing diagnosis evidence.",
          "feedback": "Teaching supplies the capability the diagnosis is trying to observe."
        },
        {
          "key": "e",
          "label": "Assign the unresolved topic a weak opening response from the other topic's clean result.",
          "feedback": "Another topic's clean response cannot establish the missing topic's behaviour or placement."
        }
      ],
      "correctOptionKey": "c",
      "truth": "Diagnosis is topic-specific and evidence-complete. Preserve missing evidence honestly and follow only the next requested check."
    },
    {
      "prompt": "A diagnosis resolves a topic at Structured Execution / High. How should its first Training session start?",
      "options": [
        {
          "key": "a",
          "label": "Begin Controlled Discomfort because High placement proves the next phase is already available.",
          "feedback": "A diagnosed entry state does not authorize immediate progression."
        },
        {
          "key": "b",
          "label": "Begin Structured Execution at the resolved entry state and deliver its prescribed Training sequence.",
          "feedback": "Training begins at the diagnosed state; its own evidence governs later movement."
        },
        {
          "key": "c",
          "label": "Begin Clarity for reassurance, then return to the diagnosed phase once the student looks confident.",
          "feedback": "Personal reassurance cannot replace the established entry state."
        },
        {
          "key": "d",
          "label": "Let the Specialist select whichever phase best suits the prepared problems for that scheduled Training session.",
          "feedback": "Prepared materials must follow the authorized state, not select it."
        },
        {
          "key": "e",
          "label": "Repeat the whole diagnosis before every session so the topic’s placement always feels current.",
          "feedback": "A trustworthy active state continues into Training rather than routine fresh placement."
        }
      ],
      "correctOptionKey": "b",
      "truth": "Entry-state placement determines where Training starts. It is not a shortcut through that phase’s required work."
    }
  ],
  "logging_system": [
    {
      "prompt": "The student starts independently. Later, the Specialist supplies the mathematical step needed to continue. How should the record describe this?",
      "options": [
        {
          "key": "a",
          "label": "Mark the entire response independent because its opening did not require Specialist support.",
          "feedback": "A clean start does not make the supported continuation independent."
        },
        {
          "key": "b",
          "label": "Mark the opening weak because the later prompt changes the meaning of every earlier observation in the same response.",
          "feedback": "Do not overwrite genuine earlier behavior with a later intervention."
        },
        {
          "key": "c",
          "label": "Record only the correct final answer because it summarizes the completed execution accurately.",
          "feedback": "Final output omits the behavior and support that determine evidence meaning."
        },
        {
          "key": "d",
          "label": "Preserve the independent start and record the later step prompt against the affected continuation.",
          "feedback": "Behavior and intervention remain separate and tied to when they occurred."
        },
        {
          "key": "e",
          "label": "Leave the prompt out if it was short and the student carried out most of the remaining work.",
          "feedback": "The amount of speech does not determine whether mathematical direction was supplied."
        }
      ],
      "correctOptionKey": "d",
      "truth": "Record concrete behavior and each intervention separately. Preserve clean observations while keeping prompted behavior from proving independence."
    },
    {
      "prompt": "During an independent Training rep, the student completes a valid start. An old worked solution remains open beside the page, and they look at it before continuing the remaining steps. What should the Specialist record?",
      "options": [
        {
          "key": "a",
          "label": "Preserve the independent start, record the visible worked-example cue, and leave the affected continuation confounded.",
          "feedback": "Clean behaviour before a reference cue remains clean; the reference-assisted continuation cannot prove independence."
        },
        {
          "key": "b",
          "label": "Mark every step independent because the completed answer is correct.",
          "feedback": "Correctness cannot erase the observed cue or establish independent continuation."
        },
        {
          "key": "c",
          "label": "Record a breakdown because looking at an example always proves inability.",
          "feedback": "A contaminated observation cannot be converted into a clean capability failure."
        },
        {
          "key": "d",
          "label": "Ignore the glance because the example was only used briefly.",
          "feedback": "The presence of a mathematical step or method cue matters, not how briefly it was seen."
        },
        {
          "key": "e",
          "label": "Ask the student whether they knew the method, then overwrite the original result.",
          "feedback": "A retrospective answer cannot make the earlier reference-assisted work independent."
        }
      ],
      "correctOptionKey": "a",
      "truth": "A visible worked example can confound the independence of affected work. Record the cue, preserve unrelated clean evidence, and follow RI-OS for any additional qualifying opportunity."
    }
  ],
  "session_flow_control": [
    {
      "prompt": "Today’s Training reveals a requirement for targeted re-diagnosis at the next booking. How should today’s session be recorded?",
      "options": [
        {
          "key": "a",
          "label": "Relabel today’s prepared Training as diagnosis because the next session now has that purpose.",
          "feedback": "A future requirement does not change the conditions under which today’s evidence was collected."
        },
        {
          "key": "b",
          "label": "Discard today’s observations because a re-diagnosis requirement makes all of today’s Training evidence unusable.",
          "feedback": "Valid exposure and observations retain their actual context."
        },
        {
          "key": "c",
          "label": "Lower the phase immediately so the next booking can begin without a separate diagnosis route.",
          "feedback": "The Specialist cannot assign backward movement to bypass evidence."
        },
        {
          "key": "d",
          "label": "Keep scheduling ordinary Training until the Specialist feels sure the earlier layer is weak.",
          "feedback": "Follow the raised requirement rather than personal confidence."
        },
        {
          "key": "e",
          "label": "Preserve today’s Training context and open the next scheduled session in required targeted diagnosis.",
          "feedback": "The next booking changes operating purpose; today’s source context stays accurate."
        }
      ],
      "correctOptionKey": "e",
      "truth": "A requirement raised during Training governs the next scheduled session. Preserve today’s evidence under its original conditions."
    },
    {
      "prompt": "A genuine connection failure ends Training early after several valid opportunities. What follows for those observations?",
      "options": [
        {
          "key": "a",
          "label": "Delete them because every Training session must produce its entire planned sequence to count at all.",
          "feedback": "Genuine partial evidence can remain valid even when the session is interrupted."
        },
        {
          "key": "b",
          "label": "Retain valid partial evidence and let the authorized next session follow the resulting operating state.",
          "feedback": "An interruption does not erase clean evidence or automatically create leftover rep debt."
        },
        {
          "key": "c",
          "label": "Automatically add every unfinished opportunity to the next session before its ordinary required work for the active phase.",
          "feedback": "Leftover inventory is not an independent authority for the next drill."
        },
        {
          "key": "d",
          "label": "Declare the phase complete because the delivered opportunities were strong before the interruption.",
          "feedback": "Strong partial observations do not prove that the required exposure was completed."
        },
        {
          "key": "e",
          "label": "Reclassify the partial session as Handover so it can finish under an evidence-complete stopping rule.",
          "feedback": "Changing the label cannot change the purpose and conditions of the collected evidence."
        }
      ],
      "correctOptionKey": "b",
      "truth": "Training uses prescribed exposure. A genuine interruption preserves valid partial evidence without forced completion or invented carry-forward quotas."
    }
  ],
  "drill_library": [
    {
      "prompt": "A prepared timed reserve is available. The student times out on a rep while the timer and connection work correctly. What should happen?",
      "options": [
        {
          "key": "a",
          "label": "Use the reserve under an easier timer to discover whether the student can finish with less pressure.",
          "feedback": "Student weakness does not authorize a different timing condition."
        },
        {
          "key": "b",
          "label": "Reuse the exposed problem because the student did not finish and has not yet shown the full trained mathematical method.",
          "feedback": "An exposed problem is not fresh replacement evidence."
        },
        {
          "key": "c",
          "label": "Keep the genuine timeout as real evidence under the assigned timer and leave the technical reserve unused.",
          "feedback": "A working timer preserves a genuine student outcome."
        },
        {
          "key": "d",
          "label": "Use the reserve under the same timer because spare materials always permit another clean attempt.",
          "feedback": "Reserve inventory is only a contingency for an untrustworthy technical attempt."
        },
        {
          "key": "e",
          "label": "Omit this attempt and report only the completed timed responses to avoid a distorted picture.",
          "feedback": "Removing a genuine weak outcome distorts the evidence history."
        }
      ],
      "correctOptionKey": "c",
      "truth": "Technical failure and student difficulty are different. Only the authorized technical replacement path uses a fresh equivalent prepared reserve."
    },
    {
      "prompt": "A Variation Control set is assigned. What must the Specialist preserve when choosing problems?",
      "options": [
        {
          "key": "a",
          "label": "A changed problem form and independent execution, with the set’s assigned difficulty and pressure unchanged.",
          "feedback": "The set tests whether the method survives changed form without Specialist help."
        },
        {
          "key": "b",
          "label": "The original problem form and a first-step prompt so the student can establish an easy clean start.",
          "feedback": "That removes the changed-form question and adds support."
        },
        {
          "key": "c",
          "label": "A harder problem and a tighter timer because variation means increasing every constraint together.",
          "feedback": "Variation is not permission to change difficulty and timing."
        },
        {
          "key": "d",
          "label": "Any suitable worksheet with verbal reassurance because the set title alone fixes its intended evidence meaning.",
          "feedback": "The actual conditions determine what the response can prove."
        },
        {
          "key": "e",
          "label": "A familiar form with a model beforehand so correct answers demonstrate the method’s transferability.",
          "feedback": "Familiar exposure with modelling does not establish independent changed-form execution."
        }
      ],
      "correctOptionKey": "a",
      "truth": "Drill meaning depends on the actual support, form, difficulty, and pressure. Preserve all of the assigned conditions."
    }
  ],
  "handover_verification": [
    {
      "prompt": "A replacement Specialist inherits strong independent execution. In the first continuity rep, the student begins unaided but then looks at an old worked solution showing the next steps. What is the correct response?",
      "options": [
        {
          "key": "a",
          "label": "Restart Intro and discard the inherited record because the new Specialist saw a reference cue.",
          "feedback": "Handover preserves inherited evidence and checks present continuity; it does not restart placement."
        },
        {
          "key": "b",
          "label": "Treat the later steps as clean because the inherited state previously supported them.",
          "feedback": "History cannot make a new reference-assisted response independent."
        },
        {
          "key": "c",
          "label": "Lower the topic immediately because consulting an example proves a breakdown.",
          "feedback": "Confounded evidence is not a clean demonstration of incapability."
        },
        {
          "key": "d",
          "label": "Preserve the independent start and inherited history, log the later reference cue, and follow the next RI-OS continuity check.",
          "feedback": "Only affected independence claims are confounded; RI-OS decides how the unresolved part is checked."
        },
        {
          "key": "e",
          "label": "Teach the remainder and keep checking until the student reproduces the inherited strength.",
          "feedback": "Teaching forward would change the continuity question rather than verify it."
        }
      ],
      "correctOptionKey": "d",
      "truth": "Handover preserves inherited evidence and a clean observed start while recording any reference-contaminated continuation. It cannot manufacture independence or manually re-place the student."
    },
    {
      "prompt": "Continuity is resolved with clean evidence supporting a stability adjustment inside the inherited phase. What does this authorize?",
      "options": [
        {
          "key": "a",
          "label": "Moving to the next phase because any positive Handover result should count as Training progression.",
          "feedback": "Handover verifies continuity; it does not train the topic forward."
        },
        {
          "key": "b",
          "label": "Following the same-phase stability decision while preserving the inherited phase and evidence history.",
          "feedback": "Clean continuity evidence may support bounded stability adjustment."
        },
        {
          "key": "c",
          "label": "Keeping the old stability label unchanged because Handover can only repeat the inherited description.",
          "feedback": "Trustworthy evidence can support adjustment within the phase."
        },
        {
          "key": "d",
          "label": "Selecting a new phase manually because the replacement Specialist now owns the topic’s judgment.",
          "feedback": "The Specialist records evidence; RI-OS derives the state."
        },
        {
          "key": "e",
          "label": "Continuing extra checks until both the inherited and adjusted stability labels produce identical behavior.",
          "feedback": "Resolved continuity does not authorize open-ended reassurance sampling."
        }
      ],
      "correctOptionKey": "b",
      "truth": "Handover may preserve state, adjust stability within the inherited phase, or require targeted re-diagnosis. It does not independently authorize phase progression."
    }
  ],
  "tools_required": [
    {
      "prompt": "The Clarity Modelling set finishes and Identification begins. Which setup should now be used?",
      "options": [
        {
          "key": "a",
          "label": "Keep the rear camera on the Specialist’s notebook until every Clarity set has been completed.",
          "feedback": "Identification already requires student response rather than continued demonstration."
        },
        {
          "key": "b",
          "label": "Turn the laptop into the student call while the phone replaces the dedicated live evidence-entry workspace.",
          "feedback": "Keep the dedicated phone call and laptop observation-and-logging roles."
        },
        {
          "key": "c",
          "label": "Keep demonstrating the opening method whenever the student pauses during Identification.",
          "feedback": "A model supplies the recognition that this set needs to observe without help."
        },
        {
          "key": "d",
          "label": "Use a recorded model instead of the live call so the Specialist can enter observations afterward.",
          "feedback": "Recorded exposure cannot replace live student observation and reliable evidence capture."
        },
        {
          "key": "e",
          "label": "Return the phone upright in selfie Observation mode while the laptop supports observation and logging.",
          "feedback": "Observation starts within Clarity when the student executes."
        }
      ],
      "correctOptionKey": "e",
      "truth": "Camera mode follows the active set. Modelling exposes Specialist execution; Identification and Light Apply use student Observation within Clarity."
    },
    {
      "prompt": "The correct equipment is present, but glare hides the Specialist’s written steps during Modelling. What should happen?",
      "options": [
        {
          "key": "a",
          "label": "Correct the phone and light position until the full live method is readable before continuing the model.",
          "feedback": "The equipment must actually expose the required work."
        },
        {
          "key": "b",
          "label": "Continue with a clear spoken explanation because the required phone and light are already installed.",
          "feedback": "Equipment presence and audio do not make hidden written execution visible."
        },
        {
          "key": "c",
          "label": "Show the completed answer afterward because it allows the student to infer the hidden written steps.",
          "feedback": "Modelling requires seeing the method unfold, not inferring it from output."
        },
        {
          "key": "d",
          "label": "Switch permanently to a face view because it creates the most consistent camera setup for every Training drill.",
          "feedback": "One fixed view cannot serve both modelling and observation."
        },
        {
          "key": "e",
          "label": "Continue and mark the exposure complete because glare is a setup issue rather than student weakness.",
          "feedback": "A setup defect can prevent the intended exposure even when it is not student weakness."
        }
      ],
      "correctOptionKey": "a",
      "truth": "Check the functional view, two-way audio, prepared materials, and live logging before evidence begins. Correct defects that hide required behavior."
    }
  ]
} satisfies Record<string, ComponentProps<typeof DeepDiveTeachingInteraction>[]>;
