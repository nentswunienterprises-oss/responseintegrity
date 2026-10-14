/**
 * Execute Practicals v2: server-selected, sequential simulated student turns.
 * The Specialist never supplies the case, outcome sequence, or future student response.
 * No real student state or billing authority is touched here.
 */
export const EXECUTE_CHALLENGE_VERSION = 2;
export const EXECUTE_CHALLENGE_TURNS = 3;

export type ExecuteIntervention =
  | "none" | "neutral_clarification" | "first_step_confirmation"
  | "method_or_step_prompt" | "full_rescue_or_teaching" | "timer_changed";
export type ExecuteEvidenceStatus = "observed" | "not_observed" | "confounded";
export type ExecuteIndependenceClaim = "independent" | "assisted" | "not_established";
export type ExecuteNextAction = "continue" | "pause_for_evidence" | "escalate";

export interface ExecuteResponse {
  intervention: ExecuteIntervention;
  studentFacingResponse: string;
  observedBehavior: string;
  evidenceStatus: ExecuteEvidenceStatus;
  independenceClaim: ExecuteIndependenceClaim;
  nextAction: ExecuteNextAction;
  decisionReason: string;
}

export type ExecuteEventKind = "uncertainty" | "difficulty" | "observability_interruption" | "adaptive_continuation";
export type ExecuteScenarioTurn = {
  number: 1 | 2 | 3;
  kind: ExecuteEventKind;
  studentBehavior: string;
  evidenceQuestion: string;
};
export type ExecutePlan = {
  version: 1 | 2;
  seed: string;
  caseKey: "controlled_discomfort_no_rescue";
  initialVariant: number;
  branchVariant: number;
  observabilityVariant?: number; // Legacy V1 replay only.
  continuationVariant?: number; // V2 real student response without invented equipment failure.
  privateBank?: {bankKey:string;bankVersion:number; withoutSupport:string; withSupport:string};
};
export type ExecuteTranscriptTurn = {
  number: number;
  situation: ExecuteScenarioTurn;
  response: ExecuteResponse;
  riskFlags: string[];
  recordedAt?: string | Date | null;
};

const INITIAL_BEHAVIORS = [
  "The simulated student stares at the difficult problem, starts the first line, crosses it out and says, 'Can you show me the first step?'",
  "The simulated student opens the correct method but stops at the unfamiliar variation and says, 'I cannot get past this part. What should I write?'",
  "The simulated student tries a plausible but incorrect entry and looks toward the Specialist: 'Is this how I should begin?'",
  "The simulated student waits after seeing the higher-difficulty question and says, 'I know the usual version, but this one is confusing.'",
];
const BRANCH_AFTER_SUPPORT = [
  "After your intervention, the simulated student copies the demonstrated step and finishes. They ask whether this counts as an independent success.",
  "The simulated student follows the structure you supplied and reaches an answer, then says, 'I wouldn't have started without that hint.'",
];
const BRANCH_NO_SUPPORT = [
  "Without receiving a method or first-step hint, the simulated student tries an incorrect route, pauses and asks whether to abandon the problem.",
  "The simulated student continues independently, corrects one step but remains uncertain, and asks for confirmation that the answer is right.",
];
// Historical V1 prompts are replayable for immutable records, never
// selected for newly created V2 Practical assessments.
const INTERRUPTIONS = [
  "The simulated student's notebook moves out of camera view. The student says they have completed the next step, but the written work is not visible.",
  "The connection makes the student's explanation inaudible while their writing is partly obscured. They say, 'I finished it' after audio returns.",
  "The simulated student turns away from the camera, completes work you cannot observe, and returns with a confident answer.",
];

// The third V2 turn measures sustained conduct under the unchanged difficulty
// and support boundary. It cannot silently force a fictional missing observation.
const CONTINUATIONS = [
  "The student tries a different first step without receiving a hint, corrects a misread sign and keeps working through the difficult point.",
  "The student pauses, revisits the previous line and tries to connect it to the next operation, without asking the Specialist to take over.",
  "After another unsuccessful move the student says, 'I am still not sure about the next step,' then makes a new attempt on their own.",
  "The student notices that a prior line did not follow the method, crosses it out and restarts from a valid step without a supplied answer.",
];

function bucket(seed: string, offset: number, size: number) {
  const hex = seed.slice(offset, offset + 8);
  if (!/^[0-9a-f]{8}$/i.test(hex)) throw new Error("Invalid server-generated Execute challenge seed.");
  return Number.parseInt(hex, 16) % size;
}

export function createExecutePlan(seed: string, bank?: {
 bankKey:string;bankVersion:number;behaviors:string[];
}): ExecutePlan {
  if (!/^[0-9a-f]{32,128}$/i.test(seed)) throw new Error("Execute challenge requires server entropy.");
  if(bank && (!bank.bankKey || !Number.isInteger(bank.bankVersion) || bank.bankVersion < 1 ||
    bank.behaviors.length < 6 || bank.behaviors.some(x=>typeof x!=="string" || x.trim().length < 20))) {
    throw new Error("Execute challenge needs an approved, sufficiently varied private Sandbox outcome bank.");
  }
  const first=bank ? bucket(seed,8,bank.behaviors.length) : 0;
  const second=bank ? (first+1+bucket(seed,16,bank.behaviors.length-1))%bank.behaviors.length : 0;
  return {
    version: EXECUTE_CHALLENGE_VERSION, seed, caseKey: "controlled_discomfort_no_rescue",
    initialVariant: bucket(seed, 0, INITIAL_BEHAVIORS.length),
    branchVariant: bucket(seed, 8, 2),
    continuationVariant: bucket(seed, 16, CONTINUATIONS.length),
    ...(bank? { privateBank: {
      bankKey:bank.bankKey,bankVersion:bank.bankVersion,
      withoutSupport:bank.behaviors[first],withSupport:bank.behaviors[second],
    }} : {}),
  };
}

export function executeCaseBrief() {
  return {
    phase: "Controlled Discomfort",
    context: "Stateful simulated training set, no rescue condition",
    student: "Fictional student, no personal data",
    operatingBoundary:
      "The assigned difficulty must remain intact. Do not teach the answer, supply the method or imply independent performance after assistance. Record only the response that occurs, preserve intervention truth, and leave progression to RI-OS.",
    totalTurns: EXECUTE_CHALLENGE_TURNS,
  };
}

export function nextExecuteTurn(
  plan: ExecutePlan,
  previous: readonly ExecuteTranscriptTurn[],
): ExecuteScenarioTurn | null {
  if (plan.version !== 1 && plan.version !== EXECUTE_CHALLENGE_VERSION) throw new Error("Unsupported Execute challenge version.");
  const turn = previous.length + 1;
  if (turn > EXECUTE_CHALLENGE_TURNS) return null;
  if (previous.some((entry, index) => entry.number !== index + 1))
    throw new Error("Execute challenge transcript has an invalid turn sequence.");
  if (turn === 1) return {
    number: 1, kind: "uncertainty", studentBehavior: INITIAL_BEHAVIORS[plan.initialVariant],
    evidenceQuestion: "What did the student actually demonstrate under the no-rescue condition?",
  };
  if (turn === 2) {
    const intervention = previous[0].response.intervention;
    const materialSupport = ["first_step_confirmation", "method_or_step_prompt", "full_rescue_or_teaching"].includes(intervention);
    return {
      number: 2, kind: "difficulty",
      studentBehavior: plan.privateBank
        ? `${materialSupport
          ? "After a step or method cue, the simulated student responds under the assisted condition:"
          : "Without a step or method cue, the simulated student responds under the unchanged condition:"} ${materialSupport ? plan.privateBank.withSupport : plan.privateBank.withoutSupport}`
        : (materialSupport ? BRANCH_AFTER_SUPPORT : BRANCH_NO_SUPPORT)[plan.branchVariant],
      evidenceQuestion: "What is directly observable? Has any assistance changed the independence claim?",
    };
  }
  if (plan.version === 1) {
    // Historical challenge records retain their exact authored V1 third turn.
    return {
      number: 3, kind: "observability_interruption",
      studentBehavior: INTERRUPTIONS[plan.observabilityVariant ?? 0],
      evidenceQuestion: "What can be recorded now, and what must remain unobserved or confounded?",
    };
  }
  return {
    number: 3, kind: "adaptive_continuation",
    studentBehavior: CONTINUATIONS[plan.continuationVariant ?? 0],
    evidenceQuestion: "What did the student actually attempt and correct, and what remains independently established under the original condition?",
  };
}

const INTERVENTIONS: ExecuteIntervention[] = [
  "none", "neutral_clarification", "first_step_confirmation",
  "method_or_step_prompt", "full_rescue_or_teaching", "timer_changed",
];
const EVIDENCE: ExecuteEvidenceStatus[] = ["observed", "not_observed", "confounded"];
const CLAIMS: ExecuteIndependenceClaim[] = ["independent", "assisted", "not_established"];
const ACTIONS: ExecuteNextAction[] = ["continue", "pause_for_evidence", "escalate"];

export function validateExecuteResponse(value: ExecuteResponse): ExecuteResponse {
  if (!INTERVENTIONS.includes(value.intervention) || !EVIDENCE.includes(value.evidenceStatus)
    || !CLAIMS.includes(value.independenceClaim) || !ACTIONS.includes(value.nextAction)) {
    throw new Error("Unsupported Execute response category.");
  }
  const fields = ["studentFacingResponse", "observedBehavior", "decisionReason"] as const;
  for (const field of fields) {
    const text = String(value[field] || "").trim();
    if (text.length < 30 || text.length > 2000)
      throw new Error(`Execute ${field} requires 30–2000 characters of directly recorded evidence.`);
  }
  return {
    ...value,
    studentFacingResponse: value.studentFacingResponse.trim(),
    observedBehavior: value.observedBehavior.trim(),
    decisionReason: value.decisionReason.trim(),
  };
}

/** Flags are evidence for the TD to review, never an automated certification. */
export function executeRiskFlags(
  event: ExecuteScenarioTurn,
  response: ExecuteResponse,
): string[] {
  const flags: string[] = [];
  const materialSupport = ["first_step_confirmation", "method_or_step_prompt", "full_rescue_or_teaching"].includes(response.intervention);
  if (materialSupport && response.independenceClaim === "independent")
    flags.push("assisted_recorded_as_independent");
  if (response.intervention === "full_rescue_or_teaching")
    flags.push("no_rescue_condition_broken");
  if (response.intervention === "timer_changed")
    flags.push("unauthorised_condition_change");
  if (response.evidenceStatus !== "observed" && response.independenceClaim === "independent")
    flags.push("independence_claim_without_clean_observation");
  if (event.kind === "observability_interruption" && response.evidenceStatus === "observed")
    flags.push("unobservable_work_claimed_as_observed");
  if (event.kind === "adaptive_continuation" && response.evidenceStatus === "not_observed")
    flags.push("observable_student_work_marked_unobserved");
  return flags;
}
