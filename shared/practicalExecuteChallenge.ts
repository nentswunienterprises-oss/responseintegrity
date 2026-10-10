/**
 * Execute Practicals v2: server-selected, sequential simulated student turns.
 * The Specialist never supplies the case, outcome sequence, or future student response.
 * No real student state or billing authority is touched here.
 */
export const EXECUTE_CHALLENGE_VERSION = 1;
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

export type ExecuteEventKind = "uncertainty" | "difficulty" | "observability_interruption";
export type ExecuteScenarioTurn = {
  number: 1 | 2 | 3;
  kind: ExecuteEventKind;
  studentBehavior: string;
  evidenceQuestion: string;
};
export type ExecutePlan = {
  version: 1;
  seed: string;
  caseKey: "controlled_discomfort_no_rescue";
  initialVariant: number;
  branchVariant: number;
  observabilityVariant: number;
  privateBank?: {bankKey:string;bankVersion:number; withoutSupport:string; withSupport:string};
};
export type ExecuteTranscriptTurn = {
  number: number;
  situation: ExecuteScenarioTurn;
  response: ExecuteResponse;
  riskFlags: string[];
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
const INTERRUPTIONS = [
  "The simulated student's notebook moves out of camera view. The student says they have completed the next step, but the written work is not visible.",
  "The connection makes the student's explanation inaudible while their writing is partly obscured. They say, 'I finished it' after audio returns.",
  "The simulated student turns away from the camera, completes work you cannot observe, and returns with a confident answer.",
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
    version: 1, seed, caseKey: "controlled_discomfort_no_rescue",
    initialVariant: bucket(seed, 0, INITIAL_BEHAVIORS.length),
    branchVariant: bucket(seed, 8, 2),
    observabilityVariant: bucket(seed, 16, INTERRUPTIONS.length),
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
      "The assigned difficulty must remain intact. Do not teach the answer, supply the method or imply independent performance after assistance. If observability fails, do not manufacture evidence or choose progression.",
    totalTurns: EXECUTE_CHALLENGE_TURNS,
  };
}

export function nextExecuteTurn(
  plan: ExecutePlan,
  previous: readonly ExecuteTranscriptTurn[],
): ExecuteScenarioTurn | null {
  if (plan.version !== EXECUTE_CHALLENGE_VERSION) throw new Error("Unsupported Execute challenge version.");
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
  return {
    number: 3, kind: "observability_interruption",
    studentBehavior: INTERRUPTIONS[plan.observabilityVariant],
    evidenceQuestion: "What can be recorded now, and what must remain unobserved or confounded?",
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
  return flags;
}
