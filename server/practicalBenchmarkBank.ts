import {
  PRACTICAL_BENCHMARK_VERSION,
  PRACTICAL_BENCHMARK_CASE_COUNT,
  type PracticalBenchmarkProof,
} from "@shared/practicalBenchmarkPolicy";

/**
 * PRIVATE UNTIL REVEAL.
 *
 * All Specialists in a comparable cohort receive the same numbered case
 * situations in the same order. The observations, errors and support actually
 * demonstrated by each Specialist remain individual. Change the whole bank
 * version if a benchmark is exposed; never quietly edit a historical case.
 *
 * This module is server-only; do not import it from the client.
 */
export type IssuedPracticalBenchmarkCase = Readonly<{
  caseKey: string;
  caseVersion: number;
  sequence: number;
  phase: string;
  assessedCapability: string;
  title: string;
  situation: string;
  systemDirection: string;
  liveDemonstration: string;
  fictionalOnly: true;
}>;

type DraftCase = Omit<IssuedPracticalBenchmarkCase,"caseVersion"|"sequence"|"fictionalOnly">;
const cases:Record<PracticalBenchmarkProof,readonly DraftCase[]> = {
  prepare:[
    {
      caseKey:"prepare.clarity_entry",
      phase:"Clarity",assessedCapability:"Clarity / session identity / evidence observability",
      title:"Prepare a Clarity entry under uncertainty",
      situation:"Fictional student has seen the topic before but cannot identify the first legitimate step in a changed question. The latest clean Clarity evidence is inconclusive; there is no authorization to assume Structure is stable.",
      systemDirection:"Remain in Clarity and prepare the system-assigned condition. No new phase placement or stronger capability claim may be invented.",
      liveDemonstration:"On camera, open the provided state, set up the task and working surface, explain the allowed instructions, preflight visibility/audio, and identify exactly what actions and student behaviour must be observable.",
    },
    {
      caseKey:"prepare.structured_execution",
      phase:"Structured Execution",assessedCapability:"Structured Execution / independent repetition / support boundaries",
      title:"Prepare an independent-execution set",
      situation:"A fictional student's latest supported attempts succeed; independent execution is inconsistent. The current instruction is a no-support Structured Execution set, not more worked examples.",
      systemDirection:"Preserve the independent set, the assigned drill, and the no-rescue support boundary. Do not choose an easier exercise in the recording.",
      liveDemonstration:"Prepare materials and evidence conditions for genuinely independent responses, explain what will and will not count as independence, and demonstrate the tools and workspace arrangement needed to observe written and spoken work.",
    },
    {
      caseKey:"prepare.tps_baseline",
      phase:"Time Pressure Stability",assessedCapability:"TPS / baseline integrity / timing preflight",
      title:"Prepare a timed opportunity when the baseline is missing",
      situation:"The fictional student's most recent Structured Execution independent reps have not produced three clean comparable timing references. A proposed TPS set lacks an authoritative baseline.",
      systemDirection:"Do not invent a time target. Prepare a targeted clean baseline evidence opportunity and the passive timing/observability controls before any TPS pressure work.",
      liveDemonstration:"Show how the timer and work-view are prepared, identify the exact baseline evidence required, describe the contingency if recording or timing fails and leave actual TPS readiness to the system.",
    },
  ],
  execute:[
    {
      caseKey:"execute.clarity_ambiguity",
      phase:"Clarity",assessedCapability:"Clarity / student-facing explanation / neutral support",
      title:"Respond when the student cannot interpret the prompt",
      situation:"The simulated student reads a new problem and says they do not know which action the question asks them to perform. The system is observing Clarity, not supplying the full method.",
      systemDirection:"Deliver clear, bounded student-facing instructions without doing the work for the student. Show what you would observe and record before any further action.",
      liveDemonstration:"On camera, speak to the fictional student as in a real session, preserve the assigned Clarity boundary, respond to the student's confusion and state the next justified action.",
    },
    {
      caseKey:"execute.controlled_discomfort",
      phase:"Controlled Discomfort",assessedCapability:"Controlled Discomfort / adaptive no-rescue / evidence fidelity",
      title:"Respond to the live three-turn no-rescue challenge",
      situation:"A fictional student encounters deliberately accessible difficulty, seeks assistance, then becomes harder to observe. Responses are released one at a time through the protected live Execute challenge.",
      systemDirection:"Open the existing three-turn Execute challenge while recording. You cannot select a future response, change an earlier intervention, or claim hidden student work as observed.",
      liveDemonstration:"Carry out all three adaptive system turns in this recording; match your spoken conduct to the saved turn record and preserve support boundaries, independence and observability truth.",
    },
    {
      caseKey:"execute.tps_interruption",
      phase:"Time Pressure Stability",assessedCapability:"TPS / timer stability / interruptions and escalation",
      title:"Handle a timing and camera interruption",
      situation:"During a simulated timed response, the work view disappears and a time cue is unreliable. The student claims that they finished independently during the gap.",
      systemDirection:"Do not infer a clean timed performance or silently restart/rewrite timing. Make a student-facing intervention, preserve the unresolved observation and identify the authorised recovery or escalation.",
      liveDemonstration:"Demonstrate aloud and on-screen what you would do at the interruption boundary, including the actual statement to the student, evidence status, timing record and next step.",
    },
  ],
  evidence:[
    {
      caseKey:"evidence.assistance",
      phase:"Structured Execution",assessedCapability:"logging / independence contamination / rep lineage",
      title:"Correct an assisted rep reported as independent",
      situation:"Fictional session record: Rep 1 used a first-step prompt, Rep 2 used a method reminder, Rep 3 had no support and was clean. A draft summary calls all three independent successes.",
      systemDirection:"Preserve each rep and the exact support given. Do not rewrite assisted completions as clean independent evidence.",
      liveDemonstration:"Inspect the fixed case live, say aloud which reps are genuinely independent, demonstrate the defensible log entries and identify what the system may or may not conclude.",
    },
    {
      caseKey:"evidence.not_observed",
      phase:"Controlled Discomfort",assessedCapability:"observability / missing work / confounded evidence",
      title:"Handle apparent progress that was not observed",
      situation:"A fictional student's working camera disconnects for two reps. They return with the correct final answers and a later fully observed but supported rep. A report claims the student stabilized under difficulty.",
      systemDirection:"Treat hidden work as not observed, assisted rep as assisted, and do not infer phase exit from the stronger-looking final answers.",
      liveDemonstration:"Record and explain the actual visibility limitations, flag the unsafe conclusion and identify the evidence recovery or escalation that would be needed.",
    },
    {
      caseKey:"evidence.phase_exit",
      phase:"Time Pressure Stability",assessedCapability:"phase-exit integrity / mixed evidence / justified next action",
      title:"Reconcile mixed evidence before a phase-exit decision",
      situation:"The fictional student has two clean timed reps in the same form, one rep with an early timer stop, and one rep that received unrecorded help. A draft note says the phase is complete and live-ready.",
      systemDirection:"Keep the clean reps distinct from confounded and assisted reps. Do not issue a phase-exit or live readiness decision without the system's specific confirmation gate.",
      liveDemonstration:"Work the evidence case live and explain what is established, what remains unresolved, what should be logged and which decision stays system-owned.",
    },
  ],
};

for(const [proof,bank] of Object.entries(cases)){
  if(bank.length!==PRACTICAL_BENCHMARK_CASE_COUNT
     || new Set(bank.map(b=>b.caseKey)).size!==PRACTICAL_BENCHMARK_CASE_COUNT)
    throw new Error(`Incomplete or duplicate shared ${proof} benchmark cases`);
}

export function getPracticalBenchmarkCase(
  proof:PracticalBenchmarkProof,
  oneBasedSequence:number,
): IssuedPracticalBenchmarkCase|null {
  const found=cases[proof]?.[oneBasedSequence-1];
  if(!found)return null;
  return {...found,caseVersion:PRACTICAL_BENCHMARK_VERSION,sequence:oneBasedSequence,fictionalOnly:true};
}

/** TD-only projection after issue: current and earlier cases, never unrevealed future tasks. */
export function getPracticalBenchmarkCaseKeys(proof:PracticalBenchmarkProof):string[]{
  return cases[proof].map(c=>c.caseKey);
}
