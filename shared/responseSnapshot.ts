import type { ObservationLevel } from "./observationScoring";
import {
  getDrillSchemaDefinition,
  getDrillSchemaDefinitionByVersion,
  getEvidenceSetById,
  getEvidenceSetByName,
  getFieldDefinitionForRep,
  type EvidenceDrillMode,
  type SubmittedEvidenceSet,
} from "./responseIntegrityDrillRegistry";
import type { TopicPhase, TopicStability } from "./topicConditioningEngine";

export type ResponseSnapshotDisplayLevel = "weak" | "partial" | "strong" | "not_scored";

export type ResponseSnapshotEvidence = {
  dimensionId: string;
  dimensionLabel: string;
  selectedOptionId: string;
  selectedRawOption: string;
  normalizedLevel: ObservationLevel;
  humanClause: string;
  weight: number;
  contribution: number;
};

export type ResponseSnapshotRep = {
  repPurposeId: string;
  repNumber: number;
  repPurposeText: string;
  score: number | null;
  responseLevel: ResponseSnapshotDisplayLevel;
  responseLabel: string;
  resultText: string;
  evidence: ResponseSnapshotEvidence[];
};

export type ResponseSnapshotSet = {
  setId: string;
  setOrder: number;
  setName: string;
  purposeId: string;
  purposeText: string;
  score: number | null;
  responseLevel: ResponseSnapshotDisplayLevel;
  responseLabel: string;
  patternCode: string | null;
  resultText: string;
  reps: ResponseSnapshotRep[];
};

export type ResponseSnapshotV1 = {
  version: "response-snapshot-v1";
  generatedBy: "deterministic-server" | "deterministic-client-demo";
  generatedAt: string;
  source: {
    sourceDrillId: string | null;
    schemaId: string | null;
    schemaVersion: number | null;
    definitionHash: string | null;
    topic: string;
    mode: "training" | "diagnosis" | "handover_verification" | "handover_rediagnosis";
    observedPhase: TopicPhase;
  };
  drill: {
    purposeId: string;
    purposeText: string;
    score: number | null;
    responseLevel: ResponseSnapshotDisplayLevel;
    responseLabel: string;
    patternCode: string | null;
    resultText: string;
  };
  sets: ResponseSnapshotSet[];
  engineOutcomeRef: {
    phaseBefore: TopicPhase | null;
    stabilityBefore: TopicStability | null;
    phaseAfter: TopicPhase | null;
    stabilityAfter: TopicStability | null;
    transitionReason: string | null;
  };
  reportingLineage: {
    evidenceIds: string[];
    reportProjectionVersion: null;
  };
};

type BuildResponseSnapshotInput = {
  sourceDrillId?: string | null;
  generatedBy?: ResponseSnapshotV1["generatedBy"];
  generatedAt?: string;
  topic: string;
  mode: EvidenceDrillMode | "handover_verification" | "handover_rediagnosis";
  phase: TopicPhase;
  sets: SubmittedEvidenceSet[];
  drillScore?: number | null;
  setScores?: number[];
  engineOutcomeRef?: Partial<ResponseSnapshotV1["engineOutcomeRef"]>;
};

const DISPLAY_LABEL_BY_LEVEL: Record<ResponseSnapshotDisplayLevel, string> = {
  weak: "Weak response",
  partial: "Partial response",
  strong: "Strong response",
  not_scored: "Not scored",
};

const REP_PATTERN_SENTENCE: Record<string, string> = {
  WWW: "The response remained weak across all three reps; the target behavior did not become stable in this set.",
  WWP: "The first two reps were weak and the final rep improved to partial; the set ended with emerging control, not stability.",
  WWS: "The first two reps were weak before a strong final response; the breakthrough still needs repetition.",
  WPW: "The response improved from weak to partial, then fell back to weak; the change did not hold.",
  WPP: "The response moved from weak to partial and held partial; improvement emerged but remained incomplete.",
  WPS: "The response strengthened on each rep from weak to partial to strong; it finished well without repeated strength.",
  WSW: "A strong middle rep appeared between two weak reps; the strong response was isolated.",
  WSP: "The response jumped from weak to strong, then softened to partial; improvement appeared but did not finish stable.",
  WSS: "The response began weak, then became strong and held strong; repeatable strength emerged after the first breakdown.",
  PWW: "The response began partial, then deteriorated to weak and remained weak; the set lost control under repetition.",
  PWP: "The response dropped from partial to weak, then recovered to partial; recovery occurred but remained incomplete.",
  PWS: "The response dropped to weak on the second rep, then recovered strongly; consistency remains unproven.",
  PPW: "The response remained partial for two reps, then broke to weak; the set ended less stable than it began.",
  PPP: "The response stayed partial across all three reps; the target behavior was present but consistently incomplete.",
  PPS: "The response stayed partial for two reps and finished strong; the final strength still needs confirmation.",
  PSW: "The response improved to strong on the second rep, then broke to weak; the improvement did not survive.",
  PSP: "The response moved from partial to strong and back to partial; partial performance remained the stable pattern.",
  PSS: "The response began partial, then became strong and held strong; stable strength emerged after the first rep.",
  SWW: "The response began strong, then collapsed to weak and remained weak; the initial strength did not survive repetition.",
  SWP: "The response began strong, broke to weak, and recovered only to partial; the set ended below the opening level.",
  SWS: "Strong responses appeared on the first and final reps with a weak breakdown between them; capability is present but unstable.",
  SPW: "The response deteriorated on each rep from strong to partial to weak; the target behavior weakened under repetition.",
  SPP: "The response began strong, then settled at partial for two reps; the initial strength was not sustained.",
  SPS: "The response was strong on the first and final reps with a partial dip in the middle; strength largely held.",
  SSW: "The response was strong for the first two reps, then broke on the final rep; the set did not finish stable.",
  SSP: "The response was strong for two reps and softened to partial on the final rep; strength was present but not fully maintained.",
  SSS: "The response remained strong across all three reps; the target behavior was repeatable within this set.",
};

const DRILL_PURPOSE_BY_PHASE: Record<TopicPhase, string> = {
  Clarity: "Building usable recognition before solving by checking vocabulary, method recognition, reason awareness, and light application.",
  "Structured Execution": "Building independent, repeatable execution of a known method across required structure, independence, and variation.",
  "Controlled Discomfort": "Building a controlled response under difficulty by testing entry, low-rescue execution, recovery, and repeated exposure.",
  "Time Pressure Stability": "Building stable method execution under time by testing controlled starts, structure retention, pace, completion, and tighter constraint.",
};

const REP_PURPOSE_TEXT: Record<string, string> = {
  "clarity.recognition_probe.cold_name": "the student could name and recognize the topic from a cold first look without solving",
  "clarity.recognition_probe.second_look": "recognition and step awareness would hold on a second look",
  "clarity.recognition_probe.confirmation": "phase-level clarity could be confirmed across the verification block",
  "structured_execution.start_and_structure.cold_start": "the student could begin a known method from a cold start before help was available",
  "structured_execution.start_and_structure.execution_under_observation": "step discipline and independence would hold while the student remained under observation",
  "structured_execution.start_and_structure.finish_alone_check": "the student could complete the method and finish alone across the verification block",
  "controlled_discomfort.first_contact.cold_contact": "the student could meet the first difficult problem without freezing or immediately seeking rescue",
  "controlled_discomfort.first_contact.persistence_under_hold": "persistence, first-step control, and emotional regulation would hold through the discomfort window",
  "controlled_discomfort.first_contact.reengagement": "the student could re-engage and finish the verification block with controlled behavior",
  "time_pressure.light_timer.first_timer": "the student could begin the first timed attempt without freezing and preserve the method",
  "time_pressure.light_timer.adjustment": "start, structure, pace, and completion would adjust on a second timed attempt",
  "time_pressure.light_timer.consistency_check": "the timed response could be confirmed across the verification block",
  "clarity.identification.opportunity_1": "the student could identify the type, recall the steps, and explain the reason before solving",
  "clarity.identification.opportunity_2": "recognition and explanation would hold on another unsolved example",
  "clarity.identification.opportunity_3": "clarity could be confirmed as repeatable before active solving",
  "clarity.light_apply.opportunity_1": "the student's clarity would carry into the first light solving attempt",
  "clarity.light_apply.opportunity_2": "clarity would hold while applying the method again with minimal guidance",
  "clarity.light_apply.opportunity_3": "clarity could be confirmed during independent light application",
  "structured_execution.required_structure.opportunity_1": "the student could pause, state the required method, and execute from the first attempt",
  "structured_execution.required_structure.opportunity_2": "required step discipline would hold on repetition",
  "structured_execution.required_structure.opportunity_3": "the required structure could be treated as repeatable within the set",
  "structured_execution.independent_execution.opportunity_1": "execution could begin and continue without tutor help",
  "structured_execution.independent_execution.opportunity_2": "independence and error handling would hold on repetition",
  "structured_execution.independent_execution.opportunity_3": "independent execution was repeatable rather than isolated",
  "structured_execution.variation_control.opportunity_1": "the method would survive the first changed problem form",
  "structured_execution.variation_control.opportunity_2": "step retention would hold through another variation",
  "structured_execution.variation_control.opportunity_3": "transfer could be confirmed across the variation set",
  "controlled_discomfort.controlled_entry.opportunity_1": "the student could pause and produce a controlled first action under difficulty",
  "controlled_discomfort.controlled_entry.opportunity_2": "first-step control and stability would hold under another difficult entry",
  "controlled_discomfort.controlled_entry.opportunity_3": "controlled entry could be confirmed across the set",
  "controlled_discomfort.no_rescue.opportunity_1": "the student could continue under difficulty without being rescued",
  "controlled_discomfort.no_rescue.opportunity_2": "independence and recovery would hold after difficulty continued",
  "controlled_discomfort.no_rescue.opportunity_3": "the no-rescue response could be confirmed across repetition",
  "controlled_discomfort.repeat_exposure.opportunity_1": "the student could meet repeated difficulty at the same level",
  "controlled_discomfort.repeat_exposure.opportunity_2": "stability would hold through another difficult exposure",
  "controlled_discomfort.repeat_exposure.opportunity_3": "difficulty tolerance could be confirmed as repeatable",
  "time_pressure.structure_under_timer.opportunity_1": "the student could meet the first timed attempt with control, structure, pace, and completion",
  "time_pressure.structure_under_timer.opportunity_2": "the student could adjust to the same timer without sacrificing structure",
  "time_pressure.structure_under_timer.opportunity_3": "method structure and pace control could be confirmed across the first timed set",
  "time_pressure.repeated_timed_execution.opportunity_1": "the timed response would repeat after initial timed exposure",
  "time_pressure.repeated_timed_execution.opportunity_2": "pace or structure would drift on another attempt under the same timer",
  "time_pressure.repeated_timed_execution.opportunity_3": "timed consistency could be confirmed across repetition",
  "time_pressure.full_constraint.opportunity_1": "structure and completion would survive the first tighter-time attempt",
  "time_pressure.full_constraint.opportunity_2": "the response would stabilize under a second full-constraint attempt",
  "time_pressure.full_constraint.opportunity_3": "controlled pace, structure, and completion could be confirmed under the maximum intended constraint",
};

const OPTION_CLAUSES: Record<string, string> = {
  "cannot name": "could not name the relevant terms",
  wrong: "misidentified the target response",
  none: "recorded no usable response in this dimension",
  avoids: "avoided engaging with the prompt",
  incorrect: "used an incorrect response",
  random: "used random steps",
  "random / guessing": "used random or guessed steps",
  "cannot start": "could not start",
  delayed: "started only after delay",
  freeze: "froze at first contact",
  panic: "reacted with panic",
  frequent: "sought rescue repeatedly",
  dependent: "remained dependent on rescue",
  lost: "lost the method structure",
  fails: "did not complete the problem",
  skips: "skipped required steps",
  resists: "resisted correction",
  guesses: "guessed instead of correcting structurally",
  "needs help": "needed tutor help",
  "cannot adapt": "could not adapt the method",
  collapses: "allowed the response to collapse",
  partial: "held this dimension only partially",
  hesitant: "started with hesitation",
  "partial steps": "used only part of the required sequence",
  "minor errors": "kept the order with minor errors",
  "asks after trying": "attempted before asking for help",
  unsure: "engaged but remained unsure",
  weak: "showed weak reason awareness",
  inconsistent: "held the response inconsistently",
  accepts: "accepted correction but did not fully adjust",
  "light support": "worked with light support",
  "partial correction": "corrected only partially",
  unstable: "kept the response only unstably",
  occasional: "sought rescue occasionally",
  prompted: "produced the first step only after prompting",
  rushed: "rushed and lost pace control",
  uneven: "worked at an uneven pace",
  tension: "remained engaged but tense",
  "short attempt": "made only a short attempt",
  clear: "stated the required response clearly",
  correct: "kept the correct response",
  engages: "engaged with the prompt",
  present: "showed the reason in use",
  starts: "started independently",
  immediate: "started immediately",
  "full structure": "used the full method structure",
  independent: "worked independently",
  structured: "worked structurally",
  full: "recalled the full method",
  complete: "completed the problem",
  adjusts: "adjusted correction into the structure",
  "already structured correctly": "was already structured correctly",
  stable: "kept the response stable",
  adapts: "adapted the method to the changed form",
  controlled: "kept control",
  attempt: "made an active attempt",
  "no rescue": "did not seek rescue",
  maintained: "maintained the method structure",
  composed: "stayed composed",
  confident: "answered with confidence",
  "no correction needed": "did not need correction",
  recovers: "recovered and re-entered the method",
  "no recovery needed": "did not lose control, so recovery was not required",
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export const displayLevelForScore = (score: number | null | undefined): ResponseSnapshotDisplayLevel => {
  if (typeof score !== "number" || Number.isNaN(score)) return "not_scored";
  if (score < 45) return "weak";
  if (score < 70) return "partial";
  return "strong";
};

export const responseLabelForLevel = (level: ResponseSnapshotDisplayLevel) => DISPLAY_LABEL_BY_LEVEL[level];

export const formatSnapshotPurposeText = (value: string) =>
  String(value || "").trim().replace(/^Build\b/, "Building");

export const formatSnapshotResultText = (value: string, purposeText?: string | null) => {
  let text = String(value || "").trim();
  const purpose = String(purposeText || "").trim();
  const displayPurpose = formatSnapshotPurposeText(purpose);

  [purpose, displayPurpose].filter(Boolean).forEach((candidate) => {
    if (text.startsWith(`${candidate} `)) {
      text = text.slice(candidate.length).trim();
    }
  });

  text = text
    .replace(/^When testing whether ([^,]+), the student produced a ([^:]+): /, "This rep checked whether $1. The student produced a $2: ")
    .replace(/^When testing whether ([^,]+), the response was ([^:]+): /, "This rep checked whether $1. The response was $2: ")
    .replace(/, with ([^.]+)\.$/, ". The remaining logged observation was that the student $1.")
    .replace(/\b(Vocabulary|Method|Reason|First response|Start|Step execution|Repeatability|Independence|Initial response|First-step control|Discomfort tolerance|Rescue behavior|Start under time|Structure under time|Pace control|Completion): /g, "")
    .replace("The partial evidence was that the student", "The remaining logged observation was that the student")
    .replace("The student showed a", "Across the drill, the student produced a")
    .replace("in Clarity evidence across the scored drill", "across the Clarity checks")
    .replace("in Structured Execution evidence across the scored drill", "across the Structured Execution checks")
    .replace("in Controlled Discomfort evidence across the scored drill", "across the Controlled Discomfort checks")
    .replace("in Time Pressure Stability evidence across the scored drill", "across the Time Pressure Stability checks")
    .replace("Any partial or weak evidence remains visible in the set and rep log below.", "The set and rep log below shows exactly where the response was still incomplete.");

  return text;
};

const clearNarrativeForRep = (repPurposeId: string, evidence: ResponseSnapshotEvidence[]) => {
  const hasClear = (dimensionLabel: string) =>
    evidence.some((item) => item.dimensionLabel === dimensionLabel && item.normalizedLevel === "clear");

  if (repPurposeId === "clarity.identification.opportunity_1" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["recognized the problem type and recalled the method before solving"];
  }
  if (repPurposeId === "clarity.identification.opportunity_2" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["recognition and method recall held on the second example"];
  }
  if (repPurposeId === "clarity.identification.opportunity_3" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["recognition and method recall repeated again before active solving"];
  }
  if (repPurposeId === "clarity.light_apply.opportunity_1" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["the first light solving attempt kept the vocabulary and method intact"];
  }
  if (repPurposeId === "clarity.light_apply.opportunity_2" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["clarity carried into the repeated solving attempt"];
  }
  if (repPurposeId === "clarity.light_apply.opportunity_3" && hasClear("Vocabulary") && hasClear("Method")) {
    return ["clarity held through the final independent application check"];
  }

  return evidence
    .filter((item) => item.normalizedLevel === "clear")
    .map((item) => item.humanClause)
    .slice(0, 2);
};

export const formatSnapshotRepResult = (rep: Pick<ResponseSnapshotRep, "repPurposeId" | "repPurposeText" | "responseLevel" | "evidence" | "resultText">) => {
  if (Array.isArray(rep.evidence) && rep.evidence.length > 0) {
    return buildRepResultText(rep.repPurposeText, rep.responseLevel, rep.evidence, rep.repPurposeId);
  }
  return formatSnapshotResultText(rep.resultText);
};

const OBSERVED_RESPONSE_CLEAR_LABELS: Record<string, string> = {
  Vocabulary: "recognition",
  Method: "method recall",
  Reason: "reason awareness",
  "First response": "active first response",
  Start: "controlled start",
  "Step execution": "step execution",
  Repeatability: "repeatability",
  Independence: "independent execution",
  "Initial response": "controlled entry",
  "First-step control": "first-step control",
  "Discomfort tolerance": "difficulty tolerance",
  "Rescue behavior": "low-rescue execution",
  "Start under time": "timed start",
  "Structure under time": "timed structure",
  "Pace control": "pace control",
  Completion: "completion",
};

const summarizeClearEvidence = (snapshot: Pick<ResponseSnapshotV1, "sets" | "source">) => {
  const clearDimensions = new Set<string>();
  snapshot.sets.forEach((set) => {
    set.reps.forEach((rep) => {
      rep.evidence.forEach((item) => {
        if (item.normalizedLevel === "clear") {
          clearDimensions.add(item.dimensionLabel);
        }
      });
    });
  });

  if (snapshot.source.observedPhase === "Clarity") {
    const hasVocabulary = clearDimensions.has("Vocabulary");
    const hasMethod = clearDimensions.has("Method");
    const hasReason = clearDimensions.has("Reason");
    const clauses: string[] = [];
    if (hasVocabulary && hasMethod) {
      clauses.push("clear recognition and method recall");
    } else if (hasVocabulary) {
      clauses.push("clear recognition");
    } else if (hasMethod) {
      clauses.push("clear method recall");
    }
    if (hasReason) clauses.push("clear reason awareness");
    return naturalJoin(clauses);
  }

  const clauses = Array.from(clearDimensions)
    .map((dimension) => OBSERVED_RESPONSE_CLEAR_LABELS[dimension])
    .filter(Boolean)
    .slice(0, 3);

  return naturalJoin(clauses);
};

const limitationPhraseForEvidence = (evidence: ResponseSnapshotEvidence) => {
  const raw = evidence.selectedRawOption.toLowerCase();
  if (evidence.dimensionLabel === "Reason" && raw === "weak") return "weak reason awareness";
  if (evidence.dimensionLabel === "Reason" && raw === "none") return "missing reason awareness";
  if (evidence.dimensionLabel === "Reason" && raw === "partial") return "partial reason awareness";
  return cleanEvidenceClause(evidence.humanClause);
};

export const summarizeSnapshotObservedResponse = (snapshot?: ResponseSnapshotV1 | null) => {
  if (!snapshot || !Array.isArray(snapshot.sets)) return null;

  const limitationCounts = new Map<string, number>();
  snapshot.sets.forEach((set) => {
    set.reps.forEach((rep) => {
      rep.evidence
        .filter((item) => item.normalizedLevel === "weak" || item.normalizedLevel === "partial")
        .forEach((item) => {
          const phrase = limitationPhraseForEvidence(item);
          if (phrase) {
            limitationCounts.set(phrase, (limitationCounts.get(phrase) || 0) + 1);
          }
        });
    });
  });

  const clearSummary = summarizeClearEvidence(snapshot);
  const limitationClauses = Array.from(limitationCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([phrase, count]) =>
      count > 1
        ? `${phrase} was still logged across the reps`
        : `${phrase} was still logged on one rep`
    );

  if (clearSummary && limitationClauses.length > 0) {
    return `The student showed ${clearSummary} during the drill, while ${naturalJoin(limitationClauses)}.`;
  }
  if (clearSummary) {
    return `The student showed ${clearSummary} during the drill.`;
  }
  if (limitationClauses.length > 0) {
    return `The drill logged ${naturalJoin(limitationClauses)}.`;
  }
  return null;
};

const patternCharForLevel = (level: ResponseSnapshotDisplayLevel) =>
  level === "strong" ? "S" : level === "partial" ? "P" : level === "weak" ? "W" : "N";

const naturalJoin = (values: string[]) => {
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  if (filtered.length <= 1) return filtered[0] || "";
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")}, and ${filtered[filtered.length - 1]}`;
};

const cleanEvidenceClause = (value: string) =>
  String(value || "")
    .trim()
    .replace(/^(Vocabulary|Method|Reason|First response|Start|Step execution|Repeatability|Independence|Initial response|First-step control|Discomfort tolerance|Rescue behavior|Start under time|Structure under time|Pace control|Completion):\s*/i, "");

const scoreContribution = (weight: number, level: ObservationLevel) =>
  level === "clear" ? weight : level === "partial" ? Math.round(weight * 0.6) : 0;

const CONTEXTUAL_OPTION_CLAUSES: Record<string, Record<string, string>> = {
  Vocabulary: {
    wrong: "misread the problem type",
    hesitant: "recognized the problem type with hesitation",
    correct: "recognized the problem type correctly",
    incorrect: "used the vocabulary incorrectly",
    partial: "used only part of the required vocabulary",
    clear: "named the relevant terms clearly",
    "cannot name": "could not name the relevant terms",
  },
  Method: {
    missing: "could not recall the method steps",
    partial: "recalled only part of the method",
    clear: "recalled the method clearly",
    skips: "skipped required method steps",
    inconsistent: "used the method inconsistently",
    structured: "used the method structurally",
    random: "used random steps",
  },
  Reason: {
    none: "could not explain the reason",
    weak: "showed weak reason awareness",
    clear: "explained the reason clearly",
    absent: "left the reason out",
    present: "kept the reason visible while working",
    partial: "explained only part of the reason",
  },
  "First response": {
    "avoids answering": "avoided answering",
    "unsure but tries": "tried while still unsure",
    confident: "answered with confidence",
    avoids: "avoided engaging with the prompt",
    unsure: "engaged but remained unsure",
    engages: "engaged with the prompt",
    delayed: "started only after delay",
    hesitant: "started with hesitation",
    immediate: "started immediately",
  },
  Start: {
    delayed: "started only after delay",
    hesitant: "started with hesitation",
    immediate: "started immediately",
    avoids: "avoided the start",
    "cannot finish": "could not finish",
    partial: "finished only part of the work",
    complete: "completed the work",
  },
  "Step execution": {
    skips: "skipped required steps",
    partial: "used only part of the step sequence",
    full: "kept the full step sequence",
    "full structure": "used the full method structure",
    "random / guessing": "used random or guessed steps",
    guesses: "guessed instead of correcting structurally",
    "partial correction": "corrected only part of the error",
    "structured correction": "corrected the error structurally",
    "no correction needed": "did not need correction",
    "cannot adapt": "could not adapt the method",
    adapts: "adapted the method to the changed form",
    lost: "lost the step sequence",
    maintained: "maintained the method structure",
    stable: "kept the method structure stable",
    collapses: "allowed the method structure to collapse",
  },
  Repeatability: {
    resists: "resisted correction",
    accepts: "accepted correction but did not fully adjust",
    adjusts: "adjusted correction into the structure",
    "already structured correctly": "was already structured correctly",
    breaks: "broke on repetition",
    "breaks each time": "broke repeatedly",
    inconsistent: "held inconsistently",
    stable: "held steadily",
    incorrect: "used an incorrect order",
    "minor errors": "kept the order with minor errors",
    correct: "kept the correct order",
    lost: "lost the method on variation",
    partial: "held only part of the method",
  },
  Independence: {
    "needs help": "needed tutor help",
    "light support": "worked with light support",
    independent: "worked independently",
    "waits for help": "waited for the tutor to carry the start",
    "asks after trying": "attempted before asking for help",
    guessing: "guessed instead of working independently",
    careless: "corrected carelessly",
    structured: "worked structurally",
    fails: "did not complete independently",
    partial: "completed only part independently",
    complete: "completed independently",
  },
  "Initial response": {
    freeze: "froze at first contact",
    hesitate: "hesitated before engaging",
    hesitant: "hesitated before engaging",
    attempt: "made an active attempt",
    controlled: "entered with control",
    collapses: "collapsed after the difficulty increased",
    partial: "recovered only partially",
    recovers: "recovered and re-entered the method",
    "no recovery needed": "did not lose control, so recovery was not required",
  },
  "First-step control": {
    none: "could not produce a first step",
    prompted: "produced the first step only after a prompt",
    independent: "produced the first step independently",
    wrong: "produced the wrong first step",
    partial: "produced only part of the first step",
    correct: "produced the correct first step",
    breaks: "lost first-step control",
    maintained: "maintained first-step control",
  },
  "Discomfort tolerance": {
    panic: "reacted with panic",
    tension: "remained engaged but tense",
    controlled: "kept emotional control",
    breaks: "lost stability under difficulty",
    unstable: "kept stability only unevenly",
    stable: "stayed stable under difficulty",
    "gives up": "gave up under difficulty",
    "short attempt": "made only a short attempt",
    "stays engaged": "stayed engaged under difficulty",
    inconsistent: "held difficulty tolerance inconsistently",
  },
  "Rescue behavior": {
    frequent: "sought rescue repeatedly",
    occasional: "sought rescue occasionally",
    none: "did not seek rescue",
    dependent: "remained dependent on rescue",
    partial: "reduced rescue-seeking only partially",
    independent: "continued without rescue",
    "asks immediately": "asked for rescue immediately",
    "asks later": "worked for a period before asking for rescue",
    "no rescue": "did not seek rescue",
  },
  "Start under time": {
    freeze: "froze when the timer began",
    delayed: "started only after delay under time",
    immediate: "started immediately under time",
    panic: "reacted to the timer with panic",
    hesitant: "started under the timer with hesitation",
    controlled: "started under the timer with control",
    tension: "started tense but engaged",
    composed: "stayed composed under time",
  },
  "Structure under time": {
    breaks: "lost the method structure under time",
    lost: "lost the method structure under time",
    partial: "kept only part of the method structure",
    maintained: "maintained the method structure under time",
    collapses: "allowed the method structure to collapse",
    unstable: "kept the method only unstably",
    stable: "kept the method structure stable",
  },
  "Pace control": {
    panic: "allowed the timer to trigger panic",
    rushed: "rushed and lost pace control",
    uneven: "worked at an uneven pace",
    controlled: "kept a controlled pace",
  },
  Completion: {
    fails: "did not complete the problem",
    partial: "completed only part of the problem",
    complete: "completed the problem",
    breaks: "lost completion integrity",
    inconsistent: "completed timed work inconsistently",
    stable: "kept completion stable",
    collapses: "lost completion integrity under the constraint",
  },
};

const resolveHumanClause = (dimensionLabel: string, selectedRawOption: string) => {
  const lower = selectedRawOption.toLowerCase();
  return CONTEXTUAL_OPTION_CLAUSES[dimensionLabel]?.[lower] || OPTION_CLAUSES[lower] || `recorded ${selectedRawOption}`;
};

const buildRepResultText = (
  repPurposeText: string,
  responseLevel: ResponseSnapshotDisplayLevel,
  evidence: ResponseSnapshotEvidence[],
  repPurposeId = "",
) => {
  const clearClauses = clearNarrativeForRep(repPurposeId, evidence).map(cleanEvidenceClause);
  const partialClauses = evidence.filter((item) => item.normalizedLevel === "partial").map((item) => cleanEvidenceClause(item.humanClause)).slice(0, 1);
  const weakClauses = evidence.filter((item) => item.normalizedLevel === "weak").map((item) => cleanEvidenceClause(item.humanClause)).slice(0, 2);
  const label = responseLabelForLevel(responseLevel).replace(" response", "").toLowerCase();

  if (clearClauses.length && !partialClauses.length && !weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The student produced a strong response: ${naturalJoin(clearClauses)}.`;
  }
  if (clearClauses.length && partialClauses.length && !weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The student produced a ${label} response: ${naturalJoin(clearClauses)}. The remaining logged observation was that the student ${naturalJoin(partialClauses)}.`;
  }
  if (clearClauses.length && weakClauses.length && !partialClauses.length) {
    return `This rep checked whether ${repPurposeText}. The response was ${label} overall: ${naturalJoin(clearClauses)}. The limiting evidence was that the student ${naturalJoin(weakClauses)}.`;
  }
  if (clearClauses.length && partialClauses.length && weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The response was ${label}: ${naturalJoin(clearClauses)}. The remaining logged observation was that the student ${naturalJoin(partialClauses)}, while the limiting evidence was that the student ${naturalJoin(weakClauses)}.`;
  }
  if (!clearClauses.length && partialClauses.length && !weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The student produced a partial response: every measured part was present but incomplete.`;
  }
  if (!clearClauses.length && partialClauses.length && weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The response was ${label}: the student ${naturalJoin(partialClauses)}, while also showing ${naturalJoin(weakClauses)}.`;
  }
  if (weakClauses.length) {
    return `This rep checked whether ${repPurposeText}. The response was weak: the student ${naturalJoin(weakClauses)}.`;
  }
  return `This rep checked whether ${repPurposeText}. No scored evidence was available for this rep.`;
};

const drillModeForRegistry = (mode: BuildResponseSnapshotInput["mode"]): EvidenceDrillMode =>
  mode === "handover_verification" || mode === "handover_rediagnosis" ? "verification" : mode;

export const buildResponseSnapshotV1 = ({
  sourceDrillId = null,
  generatedBy = "deterministic-server",
  generatedAt = new Date().toISOString(),
  topic,
  mode,
  phase,
  sets,
  drillScore = null,
  setScores,
  engineOutcomeRef,
}: BuildResponseSnapshotInput): ResponseSnapshotV1 => {
  const registryMode = drillModeForRegistry(mode);
  const liveSchema = getDrillSchemaDefinition(registryMode, phase);
  const schemaVersion = Number(sets.find((set) => set.drillSchemaVersion)?.drillSchemaVersion || liveSchema.schemaVersion);
  const schema = getDrillSchemaDefinitionByVersion(registryMode, phase, schemaVersion) || liveSchema;
  const snapshotSets: ResponseSnapshotSet[] = [];

  sets.forEach((submittedSet, setIndex) => {
    const submittedSetPhase = String((submittedSet as any).phase || "");
    const setPhase = submittedSetPhase === "Clarity" ||
      submittedSetPhase === "Structured Execution" ||
      submittedSetPhase === "Controlled Discomfort" ||
      submittedSetPhase === "Time Pressure Stability"
      ? submittedSetPhase
      : phase;
    const definition =
      (submittedSet.setId && getEvidenceSetById(registryMode, setPhase, submittedSet.setId)) ||
      getEvidenceSetByName(registryMode, setPhase, submittedSet.setName);
    if (!definition?.fields?.length || definition.modelingOnly) return;

    const reps: ResponseSnapshotRep[] = (submittedSet.observations || []).map((repObs, repIndex) => {
      const evidence = definition.fields.map((baseField) => {
        const field = getFieldDefinitionForRep(definition, repIndex, baseField.fieldKey) || baseField;
        const selectedRawOption = String(repObs?.[field.fieldKey] || "").trim();
        const normalizedLevel = String(repObs?.[`${field.fieldKey}_level`] || "") as ObservationLevel;
        const contribution = scoreContribution(field.scoreWeight, normalizedLevel);
        return {
          dimensionId: String(repObs?.[`${field.fieldKey}_dimension_id`] || field.dimensionId),
          dimensionLabel: fieldLabel(field.fieldKey),
          selectedOptionId: String(repObs?.[`${field.fieldKey}_option_id`] || ""),
          selectedRawOption,
          normalizedLevel,
          humanClause: resolveHumanClause(fieldLabel(field.fieldKey), selectedRawOption),
          weight: field.scoreWeight,
          contribution,
        };
      });
      const score = clampScore(evidence.reduce((sum, item) => sum + item.contribution, 0));
      const responseLevel = displayLevelForScore(score);
      const repPurposeId = String(repObs?._rep_id || definition.repPurposeIds[repIndex] || `${definition.setId}.opportunity_${repIndex + 1}`);
      const repPurposeText = REP_PURPOSE_TEXT[repPurposeId] || `the target response would hold on rep ${repIndex + 1}`;
      return {
        repPurposeId,
        repNumber: Number(repObs?._rep_number || repIndex + 1),
        repPurposeText,
        score,
        responseLevel,
        responseLabel: responseLabelForLevel(responseLevel),
        resultText: buildRepResultText(repPurposeText, responseLevel, evidence, repPurposeId),
        evidence,
      };
    });

    const computedSetScore = reps.length
      ? clampScore(reps.reduce((sum, rep) => sum + Number(rep.score || 0), 0) / reps.length)
      : null;
    const score = typeof setScores?.[snapshotSets.length] === "number"
      ? clampScore(setScores[snapshotSets.length])
      : computedSetScore;
    const responseLevel = displayLevelForScore(score);
    const patternCode = reps.map((rep) => patternCharForLevel(rep.responseLevel)).join("");
    const patternSentence = REP_PATTERN_SENTENCE[patternCode] || "The set pattern was recorded from scored reps.";

    snapshotSets.push({
      setId: definition.setId,
      setOrder: Number(submittedSet.setOrder || setIndex + 1),
      setName: definition.setName,
      purposeId: definition.setId,
      purposeText: definition.purpose,
      score,
      responseLevel,
      responseLabel: responseLabelForLevel(responseLevel),
      patternCode,
      resultText: patternSentence,
      reps,
    });
  });

  const score = typeof drillScore === "number"
    ? clampScore(drillScore)
    : snapshotSets.length
      ? clampScore(snapshotSets.reduce((sum, set) => sum + Number(set.score || 0), 0) / snapshotSets.length)
      : null;
  const responseLevel = displayLevelForScore(score);
  const patternCode = snapshotSets.map((set) => patternCharForLevel(set.responseLevel)).join("") || null;
  const limitation = snapshotSets.some((set) =>
    set.reps.some((rep) => rep.evidence.some((item) => item.normalizedLevel === "weak" || item.normalizedLevel === "partial"))
  )
    ? " The set and rep log below shows exactly where the response was still incomplete."
    : "";

  return {
    version: "response-snapshot-v1",
    generatedBy,
    generatedAt,
    source: {
      sourceDrillId,
      schemaId: schema.schemaId,
      schemaVersion: schema.schemaVersion,
      definitionHash: schema.definitionHash,
      topic,
      mode: mode === "verification" ? "handover_verification" : mode,
      observedPhase: phase,
    },
    drill: {
      purposeId: `drill.${phase.toLowerCase().replace(/\s+/g, "_")}`,
      purposeText: DRILL_PURPOSE_BY_PHASE[phase],
      score,
      responseLevel,
      responseLabel: responseLabelForLevel(responseLevel),
      patternCode,
      resultText: `Across this ${phase} drill, the student produced a ${responseLabelForLevel(responseLevel).toLowerCase()} against the predefined response checks.${limitation}`,
    },
    sets: snapshotSets,
    engineOutcomeRef: {
      phaseBefore: engineOutcomeRef?.phaseBefore || null,
      stabilityBefore: engineOutcomeRef?.stabilityBefore || null,
      phaseAfter: engineOutcomeRef?.phaseAfter || null,
      stabilityAfter: engineOutcomeRef?.stabilityAfter || null,
      transitionReason: engineOutcomeRef?.transitionReason || null,
    },
    reportingLineage: {
      evidenceIds: snapshotSets.flatMap((set) =>
        set.reps.flatMap((rep) => rep.evidence.map((item) => item.selectedOptionId).filter(Boolean))
      ),
      reportProjectionVersion: null,
    },
  };
};

const fieldLabel = (fieldKey: string) => {
  const labels: Record<string, string> = {
    vocabulary: "Vocabulary",
    method: "Method",
    reason: "Reason",
    immediateApply: "First response",
    startBehavior: "Start",
    stepExecution: "Step execution",
    repeatability: "Repeatability",
    independence: "Independence",
    initialResponse: "Initial response",
    firstStepControl: "First-step control",
    discomfortTolerance: "Discomfort tolerance",
    rescueDependence: "Rescue behavior",
    startUnderTime: "Start under time",
    structureUnderTime: "Structure under time",
    paceControl: "Pace control",
    completionIntegrity: "Completion",
  };
  return labels[fieldKey] || fieldKey;
};
