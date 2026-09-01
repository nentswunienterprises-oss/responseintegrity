import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  TUTOR_BATTLE_TEST_PHASES,
  getBattleTestScoringGuide,
  materializeBattleTestPhaseVariant,
  type BattleTestPhaseDefinition,
  type BattleTestQuestionDefinition,
  type BattleTestVariantKey,
} from "@shared/battleTesting";

type ParsedQuestion = BattleTestQuestionDefinition & { sourceLabel: string };

const ROOT = resolve(process.cwd(), "Battle-Testing Infrastructure");
const TUTOR_BATTLE_TESTING_ROOT = resolve(ROOT, "Tutor Battle-Testing");
const TUTOR_TRANSFORMATION_PHASE_ROOT = resolve(TUTOR_BATTLE_TESTING_ROOT, "Transformation Phases");
const TUTOR_SESSION_INFRASTRUCTURE_ROOT = resolve(TUTOR_BATTLE_TESTING_ROOT, "Session Infrastructure");

function optionalExistingPath(...candidates: string[]) {
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function resolveTransformationPhasePath(fileName: string) {
  return optionalExistingPath(
    resolve(TUTOR_TRANSFORMATION_PHASE_ROOT, `Response Integrity-OS Trasnformation Phases Battle-Testing = ${fileName}.md`),
    resolve(TUTOR_BATTLE_TESTING_ROOT, `Response Integrity-OS Trasnformation Phases Battle-Testing = ${fileName}.md`),
    resolve(TUTOR_TRANSFORMATION_PHASE_ROOT, `TT-OS Trasnformation Phases Battle-Testing = ${fileName}.md`),
    resolve(TUTOR_BATTLE_TESTING_ROOT, `TT-OS Trasnformation Phases Battle-Testing = ${fileName}.md`)
  );
}

const TUTOR_SOURCE_FILES = [
  {
    key: "clarity",
    title: "Clarity Deep Dive",
    description: "Recognition before solving: vocabulary, method, reason, and immediate apply.",
    path: resolveTransformationPhasePath("Clarity"),
  },
  {
    key: "structured_execution",
    title: "Structured Execution Deep Dive",
    description: "Independent, ordered, repeatable method execution without tutor carry.",
    path: resolveTransformationPhasePath("Structured Execution"),
  },
  {
    key: "controlled_discomfort",
    title: "Controlled Discomfort Deep Dive",
    description: "Response stability when uncertainty, difficulty, or unfamiliar forms appear.",
    path: resolveTransformationPhasePath("Controlled Discomfort"),
  },
  {
    key: "time_pressure_stability",
    title: "Time Pressure Stability Deep Dive",
    description: "Method-first execution that survives urgency and timed conditions.",
    path: resolveTransformationPhasePath("Time Pressure Stability"),
  },
  {
    key: "topic_conditioning",
    title: "Topic Conditioning Deep Dive",
    description: "Topic-by-topic phase placement, breakdown fields, and next RI-OS action.",
    path: resolveTransformationPhasePath("Topic Conditioning"),
  },
  {
    key: "intro_session_structure",
    title: "Intro Session Structure",
    description: "Response Integrity-OS BATTLE TEST: INTRO SESSION STRUCTURE (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Intro Session Structure.md")),
  },
  {
    key: "logging_system",
    title: "Logging System",
    description: "Response Integrity-OS BATTLE TEST: LOGGING SYSTEM (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Logging System.md")),
  },
  {
    key: "session_flow_control",
    title: "Session Flow Control",
    description: "Response Integrity-OS BATTLE TEST: SESSION CONTEXT & DRILL FLOW (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Session Flow Control.md")),
  },
  {
    key: "drill_library",
    title: "Drill Library",
    description: "Response Integrity-OS BATTLE TEST: DRILL LIBRARY (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Drill Library.md")),
  },
  {
    key: "handover_verification",
    title: "Handover Verification",
    description: "Response Integrity-OS BATTLE TEST: HANDOVER VERIFICATION (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Handover verification.md")),
  },
  {
    key: "tools_required",
    title: "Tools Required",
    description: "Response Integrity-OS BATTLE TEST: TOOLS REQUIRED (SCORING VERSION)",
    path: optionalExistingPath(resolve(TUTOR_SESSION_INFRASTRUCTURE_ROOT, "Tools Required.md")),
  },
] as const;

const TD_SOURCE_FILE = {
  key: "td_system_integrity",
  title: "TD System Integrity",
  description: "TD BATTLE TEST SYSTEM (STRUCTURE)",
  path: optionalExistingPath(resolve(ROOT, "TD Battle-Testing", "TD System Integrity Drilling.txt")),
} as const;

const AUTO_CRITICAL_REASON_BY_PHASE: Record<string, Record<string, string>> = {
  clarity: {
    Q8: "Treats Specialist-led Modeling as independent student evidence.",
    Q9: "Allows solving to replace the no-solving Identification condition.",
    Q13: "Advances a topic despite material weak evidence instead of following the system result.",
  },
  structured_execution: {
    Q7: "Treats repeatedly prompted performance as independent execution.",
    Q11: "Breaks the no-support Independent Execution condition and still accepts the rep.",
    Q14: "Disguises material Specialist assistance as independent evidence.",
  },
  controlled_discomfort: {
    Q11: "Uses full rescue inside the first-step-only No Rescue condition.",
    Q12: "Adds support to the no-support Repeat Exposure condition.",
    Q13: "Removes the assigned difficulty condition to avoid student discomfort.",
    Q14: "Overrides repeated evidence and system movement with an invented psychological conclusion.",
  },
  time_pressure_stability: {
    Q11: "Treats speed with broken structure or guessing as stable timed evidence.",
    Q12: "Adds panic coaching to a no-support timed condition.",
    Q14: "Treats a rescued timed rep as independent stability evidence.",
  },
  topic_conditioning: {
    Q7: "Assigns phase or stability movement to the Specialist rather than the deterministic system.",
    Q15: "Manually overrides evidence-based topic movement.",
  },
  intro_session_structure: {
    "Scenario 2": "Converts Intro into teaching and scores assisted performance as placement evidence.",
    "Scenario 3": "Bypasses adjacent score-driven placement with Specialist instinct.",
    "Scenario 4": "Allows parent preference to override scored topic placement.",
  },
  logging_system: {
    Q4: "Selects a preferred observation instead of the behaviour that occurred.",
    Q8: "Records assisted performance as independent evidence.",
    Q9: "Invents unobserved behaviour in the evidence record.",
    "Scenario 2": "Retrospectively manufactures missing rep evidence.",
    "Scenario 3": "Changes the evidence claim to override a deterministic hold result.",
  },
  session_flow_control: {
    Q9: "Replaces the system-selected drill with Specialist preference.",
    "Scenario 3": "Erases inherited state and bypasses the Handover Verification context.",
  },
  drill_library: {
    "Scenario 1": "Accepts solving as evidence from a recognition-only Identification set.",
    "Scenario 2": "Adds support to the no-support Variation Control condition.",
    "Scenario 3": "Rescues inside the no-support Repeat Exposure condition.",
    "Scenario 4": "Treats speed with collapsed structure as Full Constraint success.",
  },
  handover_verification: {
    Q9: "Assigns inherited-state movement to the replacement Specialist rather than verification evidence.",
    "Scenario 1": "Erases inherited topic-state and replaces continuity verification with personal re-placement.",
    "Scenario 2": "Manually changes phase from one rep before the authorised verification result.",
    "Scenario 3": "Continues normal training despite an unresolved continuity mismatch.",
  },
  tools_required: {
    "Scenario 1": "Runs and scores a live drill when the written method is not observable.",
    "Scenario 2": "Scores spoken evidence that could not be heard reliably.",
  },
  td_system_integrity: Object.fromEntries(
    ["Q4", "Q5", "Q6", "Q8", "Q9", "Q11", "Q12", "Scenario 1", "Scenario 2", "Scenario 3", "FINAL QUESTION"]
      .map((label) => [label, "Violates a non-negotiable TD system-integrity boundary."]),
  ),
};

const QUESTION_PROMPT_VARIANTS: Record<
  string,
  Partial<Record<BattleTestVariantKey, string>>
> = {
  "clarity:Q11": {
    form_b: "In Light Apply, the student answers correctly after the Specialist points to the operation and states the opening step. What does the evidence show?",
    form_c: "A student completes a Light Apply item only after the Specialist supplies the method name and asks a leading first-step question. May the rep be scored as clear Clarity?",
  },
  "structured_execution:Q11": {
    form_b: "In Independent Execution, the Specialist asks, 'What do we always do first?' and the student then completes the problem. Can the rep prove an independent start?",
    form_c: "The student will not begin an Independent Execution rep until the Specialist confirms the operation. How must that rep be interpreted?",
  },
  "controlled_discomfort:Q11": {
    form_b: "In No Rescue, the student stalls and the Specialist demonstrates two steps to settle them. What happened to the evidence condition?",
    form_c: "A student asks for rescue during No Rescue, and the Specialist talks them through the full method. Can the completed answer count as recovery evidence?",
  },
  "time_pressure_stability:Q11": {
    form_b: "A timed rep beats the target, but the student omits working and guesses two answers. What evidence does the result provide?",
    form_c: "The student finishes Full Constraint early by abandoning the trained sequence. Should speed make this a clear rep?",
  },
  "topic_conditioning:Q15": {
    form_b: "A Specialist says, 'The score held the topic, but I advanced it because today's work looked better.' What is the integrity judgment?",
    form_c: "A parent asks for the next phase and the Specialist changes the topic-state without qualifying system evidence. Is that within operator authority?",
  },
  "intro_session_structure:Scenario 2": {
    form_b: "During Intro, the Specialist teaches the method before every response and then uses those responses to place the topic. Is the placement evidence valid?",
    form_c: "An Intro becomes a mini lesson, and the Specialist scores the student's post-explanation answers as independent Diagnosis evidence. What failed?",
  },
  "logging_system:Scenario 2": {
    form_b: "Three rep options were never captured. At session end, the Specialist fills them in from the overall impression so submission can proceed. Is that valid?",
    form_c: "The Specialist notices an incomplete set the next morning and reconstructs the missing observations from memory. What must happen instead?",
  },
  "session_flow_control:Scenario 3": {
    form_b: "A replacement Specialist ignores the continuity workflow and launches a fresh Intro because they have not met the student before. What boundary was crossed?",
    form_c: "The student changes tutors. The new Specialist discards the inherited phase and begins new placement. Which session-context error occurred?",
  },
  "drill_library:Scenario 2": {
    form_b: "In Variation Control, the Specialist names the first operation on all three changed-form reps. What can the set still prove about transfer?",
    form_c: "The student completes changed-form questions only after opening cues from the Specialist. May Variation Control be logged as independent?",
  },
  "handover_verification:Scenario 1": {
    form_b: "The replacement Specialist resets every inherited topic to Clarity before running any continuity check. What failed?",
    form_c: "A new Specialist refuses to use the previous topic-state and performs fresh placement from scratch. Is that Handover Verification?",
  },
  "tools_required:Scenario 1": {
    form_b: "The camera angle hides the student's working area, but the Specialist completes the drill from spoken final answers. Can those reps be used?",
    form_c: "Only the top edge of the page is visible during a live set. The Specialist plans to infer the missing working from the student's explanations. Is the condition valid?",
  },
};

function normalizeLines(raw: string) {
  return normalizeBattleTestCopy(raw)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n");
}

function normalizeBattleTestCopy(raw: string) {
  return raw
    .replace(/â€œ|â€/g, '"')
    .replace(/'/g, "'")
    .replace(/â€“|â€”/g, "-")
    .replace(/â†’/g, "->")
    .replace(/ðŸ‘‰\s*/g, "")
    .replace(/ðŸ”¹\s*/g, "")
    .replace(/âŒ\s*/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "");
}

function isQuestionStart(line: string) {
  return /^Q\d+\s*$/.test(line) || /^Scenario\s+\d+\s*$/.test(line) || /^FINAL QUESTION\s*$/.test(line);
}

function isSectionHeader(line: string) {
  return line.includes("SECTION ") || /^FINAL TEST\s*$/.test(line);
}

function isPostQuestionMeta(line: string) {
  return /WHAT THIS /i.test(line) || /FINAL TRUTH/i.test(line) || /AUTO-FAIL SIGNALS:/i.test(line) || /^TRUTH$/i.test(line);
}

function extractSectionLabel(line: string) {
  if (/^FINAL TEST\s*$/.test(line.trim())) return "FINAL TEST";
  const sectionIndex = line.indexOf("SECTION ");
  if (sectionIndex === -1) return line.trim();
  return line.slice(sectionIndex).trim();
}

function toQuestionKey(sourceLabel: string) {
  return sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseBattleTestDocument(phaseKey: string, title: string, description: string, raw: string): BattleTestPhaseDefinition {
  const lines = normalizeLines(raw);
  const questions: ParsedQuestion[] = [];

  let i = 0;
  let currentSection = description;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      i += 1;
      continue;
    }

    if (i === 0) {
      i += 1;
      continue;
    }

    if (isSectionHeader(line)) {
      currentSection = extractSectionLabel(line);
      i += 1;
      continue;
    }

    if (!isQuestionStart(line)) {
      i += 1;
      continue;
    }

    const sourceLabel = line;
    i += 1;

    while (i < lines.length && !lines[i].trim()) i += 1;

    const promptLines: string[] = [];
    while (i < lines.length) {
      const next = lines[i].trim();
      if (/^Expected Answer/.test(next)) break;
      promptLines.push(lines[i]);
      i += 1;
    }

    if (i >= lines.length) break;
    i += 1;

    const expectedAnswerLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (/^Fail Answer/.test(next)) break;
        if (isQuestionStart(next) || isSectionHeader(next) || isPostQuestionMeta(next)) break;
        expectedAnswerLines.push(lines[i]);
        i += 1;
      }

    const failIndicators: string[] = [];
    if (i < lines.length && /^Fail Answer/.test(lines[i].trim())) {
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) {
          i += 1;
          continue;
        }
        if (isQuestionStart(next) || isSectionHeader(next) || isPostQuestionMeta(next)) {
          break;
        }
        failIndicators.push(lines[i]);
        i += 1;
      }
    }

    const questionKey =
      phaseKey === "td_system_integrity"
        ? (() => {
            if (/^final question$/i.test(sourceLabel.trim())) return "td_final";
            if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "td_q13";
            if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "td_q14";
            if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "td_q15";
            if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "td_q16";
            return `td_${toQuestionKey(sourceLabel)}`;
          })()
        : (() => {
            if (/^final question$/i.test(sourceLabel.trim())) return `${phaseKey}_final`;
            if (phaseKey === "clarity") {
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "clarity_q15";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "clarity_q16";
            } else if (phaseKey === "structured_execution") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "structured_execution_q15";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "structured_execution_q16";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "structured_execution_q17";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "structured_execution_q18";
            } else if (phaseKey === "controlled_discomfort") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "controlled_discomfort_q15";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "controlled_discomfort_q16";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "controlled_discomfort_q17";
            } else if (phaseKey === "time_pressure_stability") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "time_pressure_stability_q15";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "time_pressure_stability_q16";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "time_pressure_stability_q17";
            } else if (phaseKey === "topic_conditioning") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "topic_conditioning_q15";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "topic_conditioning_q16";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "topic_conditioning_q17";
            } else if (phaseKey === "intro_session_structure") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "intro_session_structure_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "intro_session_structure_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "intro_session_structure_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "intro_session_structure_q14";
            } else if (phaseKey === "logging_system") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "logging_system_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "logging_system_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "logging_system_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "logging_system_q14";
            } else if (phaseKey === "session_flow_control") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "session_flow_control_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "session_flow_control_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "session_flow_control_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "session_flow_control_q14";
            } else if (phaseKey === "drill_library") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "drill_library_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "drill_library_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "drill_library_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "drill_library_q14";
            } else if (phaseKey === "handover_verification") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "handover_verification_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "handover_verification_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "handover_verification_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "handover_verification_q14";
            } else if (phaseKey === "tools_required") {
              if (/^scenario\s+1$/i.test(sourceLabel.trim())) return "tools_required_q11";
              if (/^scenario\s+2$/i.test(sourceLabel.trim())) return "tools_required_q12";
              if (/^scenario\s+3$/i.test(sourceLabel.trim())) return "tools_required_q13";
              if (/^scenario\s+4$/i.test(sourceLabel.trim())) return "tools_required_q14";
            }
            return `${phaseKey}_${toQuestionKey(sourceLabel)}`;
          })();

    const criticalFailReason = AUTO_CRITICAL_REASON_BY_PHASE[phaseKey]?.[sourceLabel];
    const questionDefinition: BattleTestQuestionDefinition = {
      key: questionKey,
      section: currentSection,
      prompt: promptLines.join("\n").trim(),
      promptVariants: QUESTION_PROMPT_VARIANTS[`${phaseKey}:${sourceLabel}`],
      expectedAnswer: expectedAnswerLines.join("\n").trim(),
      failIndicators: failIndicators.map((entry) => entry.trim()).filter(Boolean),
      autoCriticalOnFail: !!criticalFailReason,
      criticalFailReason,
    };

    questions.push({
      ...questionDefinition,
      sourceLabel,
      scoringGuide: getBattleTestScoringGuide(questionDefinition),
    });
  }

  return {
    key: phaseKey,
    title,
    description,
    questions,
  };
}

export const TUTOR_BATTLE_TEST_PHASES_EXACT: BattleTestPhaseDefinition[] = TUTOR_SOURCE_FILES.flatMap((file) => {
  if (!file.path) {
    console.warn(`[battleTestingBanks] Missing tutor battle test source for ${file.key}`);
    return [];
  }

  return [
    parseBattleTestDocument(file.key, file.title, file.description, readFileSync(file.path, "utf8")),
  ];
});

export const TUTOR_BATTLE_TEST_PHASES_SAFE: BattleTestPhaseDefinition[] = TUTOR_BATTLE_TEST_PHASES.map((fallbackPhase) => {
  const exactPhase = TUTOR_BATTLE_TEST_PHASES_EXACT.find((phase) => phase.key === fallbackPhase.key) || null;
  return exactPhase?.questions.length ? exactPhase : fallbackPhase;
});

export const TD_BATTLE_TEST_PHASE_EXACT: BattleTestPhaseDefinition = TD_SOURCE_FILE.path
  ? parseBattleTestDocument(
      TD_SOURCE_FILE.key,
      TD_SOURCE_FILE.title,
      TD_SOURCE_FILE.description,
      readFileSync(TD_SOURCE_FILE.path, "utf8")
    )
  : {
      key: TD_SOURCE_FILE.key,
      title: TD_SOURCE_FILE.title,
      description: TD_SOURCE_FILE.description,
      questions: [],
    };

export function getTutorBattleTestPhaseDefinitionsExact(
  phaseKeys: string[],
  variantKeysByPhase: Partial<Record<string, BattleTestVariantKey>> = {},
) {
  return phaseKeys
    .map((phaseKey) => {
      const exactPhase = TUTOR_BATTLE_TEST_PHASES_EXACT.find((phase) => phase.key === phaseKey) || null;
      const phase = exactPhase?.questions.length
        ? exactPhase
        : TUTOR_BATTLE_TEST_PHASES.find((entry) => entry.key === phaseKey) || null;
      const variantKey = variantKeysByPhase[phaseKey];
      return phase && variantKey
        ? materializeBattleTestPhaseVariant(phase, variantKey)
        : phase;
    })
    .filter((phase): phase is BattleTestPhaseDefinition => Boolean(phase));
}
