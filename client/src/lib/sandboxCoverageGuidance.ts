export type SandboxCoverageGuidance = {
  whatToDo: string;
  whatCounts: string;
};

const PHASES = ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"] as const;

export function getSandboxCoverageGuidance(key: string, category: string, label: string): SandboxCoverageGuidance {
  if (key.startsWith("preparation:diagnosis:")) {
    const phase = key.slice("preparation:diagnosis:".length);
    if ((PHASES as readonly string[]).includes(phase)) {
      return {
        whatToDo: `In Sandbox Map, prepare the native Diagnosis session for ${phase}. Review the assigned topic, phase, and conditions; confirm preparation before launching, then complete the Diagnosis probes for that session.`,
        whatCounts: `A distinct preparation confirmation recorded for Diagnosis: ${phase} and linked to verified native Diagnosis evidence at that same phase. A generic Training confirmation does not satisfy this item.`,
      };
    }
  }

  if (key === "preparation:training") {
    return {
      whatToDo: "In Sandbox Map, open the student's next regular Training session. Review the assigned topic, phase, and conditions, confirm preparation, then launch and complete that Training session.",
      whatCounts: "A distinct pre-session confirmation for the Training context. A completed Training session proves the Map confirmation happened; if the count stays at 0, inspect its saved evidence link rather than asking the Specialist to confirm again.",
    };
  }
  if (key === "preparation:targeted_rediagnosis") {
    return {
      whatToDo: "Open a Sandbox student whose trajectory is on the Targeted Rediagnosis route. In Map, review the prescribed target phase, topic, and conditions; confirm preparation specifically for that re-diagnosis, then launch and complete the targeted probes.",
      whatCounts: "A distinct preparation confirmation linked to the Targeted Rediagnosis context. A regular Training or Diagnosis preparation does not count for this item; if the completed re-diagnosis is missing here, inspect the context receipt linked to that run.",
    };
  }

  if (key.startsWith("mode:")) {
    const mode = key.slice("mode:".length);
    const modes: Record<string, SandboxCoverageGuidance> = {
      preparation: {
        whatToDo: "Use Sandbox Map to prepare a session: review its assigned topic, phase, and conditions, confirm preparation, then launch the session.",
        whatCounts: "A distinct, saved preparation opportunity. A completed session proves its required pre-session Map confirmation occurred; it should be linked to this evidence.",
      },
      training: {
        whatToDo: "Open a Sandbox student's assigned Training session, complete the guided reps for the student's current phase, and submit the observations and evidence requested in the runner.",
        whatCounts: "A distinct completed Training opportunity with the required observations, evidence, conditions, and system state preserved.",
      },
      session_closure: {
        whatToDo: "Complete a booked Sandbox session through the Specialist Sessions flow and finish its session close-out. Do not stop after completing standalone Training reps.",
        whatCounts: "A completed Sandbox session linked to its scheduled booking and recorded close-out. Standalone reps without a linked booking do not establish this item.",
      },
      continuity: {
        whatToDo: "Continue with the same Sandbox student and same topic in the next session. Complete the follow-up so the trajectory carries forward from the prior session.",
        whatCounts: "A distinct same-topic follow-up with both consecutive session records aligned to the system's authority and student-state records. Merely completing two unrelated sessions does not count.",
      },
      targeted_rediagnosis: {
        whatToDo: "When a Sandbox student's route calls for Targeted Rediagnosis, open the prescribed target phase, complete the required probes, record the observed evidence, and finish the re-diagnosis through its system-directed resolution.",
        whatCounts: "A completed targeted re-diagnosis with complete specialist and canonical decisions that agree on the resulting phase and stability. A partial or blocked probe run does not count.",
      },
    };
    return modes[mode] || {
      whatToDo: `Complete the Sandbox workflow for “${label}” shown on the student's current trajectory, following the runner's prescribed steps.`,
      whatCounts: "A distinct completed opportunity with saved, valid evidence for this exact requirement.",
    };
  }

  if (key.startsWith("situation:")) {
    const situation = key.slice("situation:".length);
    const situations: Record<string, SandboxCoverageGuidance> = {
      independent_execution: {
        whatToDo: "In Sandbox Training, complete the guided rep identified for independent execution. Observe the student's actual response and submit the requested evidence without adding unrecorded support.",
        whatCounts: "A distinct completed independent-execution rep whose observation and evidence are valid and whose prescribed condition was kept.",
      },
      conditional: {
        whatToDo: "Continue the guided Sandbox opportunity until the simulated student's conditional response is presented. Complete that rep and record the response and support that actually occurred.",
        whatCounts: "A distinct completed opportunity the system identifies as Conditional, with valid observations and evidence. Do not label a different response as conditional to fill the counter.",
      },
      breakdown: {
        whatToDo: "Continue the guided Sandbox opportunity through the student's breakdown response. Record what the student did and the support that actually occurred, then complete the rep.",
        whatCounts: "A distinct completed opportunity the system identifies as a breakdown, with valid observations and evidence and the prescribed condition preserved.",
      },
      recovery: {
        whatToDo: "Use the Sandbox follow-up after a breakdown and continue the guided rep through the student's recovery response. Record the recovery behavior that is actually observed.",
        whatCounts: "A distinct completed opportunity with a recorded recovery response and valid linked evidence. The recovery must be observable in the saved record.",
      },
      prerequisite: {
        whatToDo: "Complete a guided Sandbox rep that presents an earlier-layer prerequisite check. Record the student's response to that check and the support actually given.",
        whatCounts: "A distinct completed opportunity with the prerequisite evidence captured and validated for the rep.",
      },
      routing: {
        whatToDo: "Complete the prescribed Sandbox re-diagnosis or follow-up when the trajectory requires a route decision. Submit the probes and apply the system-directed result; do not choose or force the route yourself.",
        whatCounts: "A distinct completed opportunity with the resulting route recorded and the specialist and canonical outcomes aligned.",
      },
      state_change: {
        whatToDo: "Complete a follow-up session for the same Sandbox student and topic after the earlier session. Record the student's resulting state and any breakdown recovery shown in the session.",
        whatCounts: "A distinct completed session where the saved evidence records a student-state change or breakdown recovery. A phase label changing by itself is not sufficient.",
      },
      timed_pressure: {
        whatToDo: "Open a Sandbox student whose current phase is Time Pressure Stability. Complete the guided Training reps under the prescribed timed-pressure conditions and record the student's actual responses.",
        whatCounts: "A distinct completed opportunity from Time Pressure Stability with the timed condition preserved and valid observation and evidence.",
      },
    };
    return situations[situation] || {
      whatToDo: `Complete a guided Sandbox opportunity that presents “${label}”, then record the response and evidence requested by the runner.`,
      whatCounts: "A distinct completed opportunity that the system validates for this exact situation.",
    };
  }

  return {
    whatToDo: `Complete the Sandbox workflow for “${label}” using the session type and phase shown in the runner.`,
    whatCounts: `A distinct, completed opportunity with valid saved evidence for this ${category.toLowerCase()} requirement. Repeating the same underlying opportunity does not add another count.`,
  };
}
