import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import {
  getParentDashboardCopyByState,
  NEXT_ACTION_ENGINE,
  type TopicPhase,
  type TopicStability,
} from "@shared/topicConditioningEngine";
import { getMonthlyServicePackage, type MonthlyPackageKey } from "@shared/servicePackages";

interface ProposalData {
  id: string;
  primaryIdentity?: string;
  mathRelationship?: string;
  confidenceTriggers?: string;
  confidenceKillers?: string;
  pressureResponse?: string;
  growthDrivers?: string;
  currentTopics?: string;
  immediateStruggles?: string;
  gapsIdentified?: string;
  tutorNotes?: string;
  futureIdentity?: string;
  wantToRemembered?: string;
  hiddenMotivations?: string;
  internalConflict?: string;
  recommendedPlan: string;
  justification: string;
  childWillWin?: string;
  topicConditioning?: {
    topic?: string | null;
    entryPhase?: string | null;
    stability?: string | null;
  };
  student?: {
    name: string;
    grade: string;
    gender?: string | null;
  };
  tutor?: {
    name: string;
    bio?: string;
    email?: string;
    phone?: string;
  };
  createdAt?: string;
  payment?: {
    provider?: string;
    status?: string;
    amount?: number;
    plan?: string;
    paymentDate?: string | null;
  } | null;
  onboardingType?: "pilot" | "commercial";
  freeSessionsRemaining?: number;
  packageKey?: MonthlyPackageKey;
  packageSessions?: number;
  plannedSessionsPerWeek?: number;
  packageAmount?: number;
  sessionPrice?: number;
}

interface ProposalTopicState {
  topic: string;
  phase?: string | null;
  stability?: string | null;
  lastUpdated?: string | null;
  movement?: "none" | "improved" | "regressed" | "changed";
  bucket?: "active" | "recent" | "older";
}

interface ProposalViewProps {
  proposal: ProposalData;
  topicStates?: ProposalTopicState[];
  forceDiagnosisView?: boolean;
  showActions?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  isProcessing?: boolean;
}

export default function ProposalView({ 
  proposal, 
  topicStates = [],
  forceDiagnosisView = false,
  showActions = false,
  onAccept,
  onDecline,
  isProcessing = false 
}: ProposalViewProps) {
  console.log("📋 ProposalView rendering with data:", proposal);

  const studentName = proposal.student?.name || "Your Child";
  const studentFirstName = studentName.trim().split(/\s+/)[0] || "Your child";
  const isPilotOnboarding = proposal.onboardingType === "pilot";
  const servicePackage = getMonthlyServicePackage(
    proposal.packageKey || (proposal as any).package_key,
  );
  const packageSessions = Number(proposal.packageSessions || servicePackage.sessionsPerMonth);
  const plannedSessionsPerWeek = Number(
    proposal.plannedSessionsPerWeek || servicePackage.plannedSessionsPerWeek,
  );
  const packageAmount = Number(proposal.packageAmount || servicePackage.amountZar);

  type StudentPronounSet = {
    subject: "he" | "she" | "they";
    subjectCapitalized: "He" | "She" | "They";
    object: "him" | "her" | "them";
    possessiveAdjective: "his" | "her" | "their";
    possessivePronoun: "his" | "hers" | "theirs";
    reflexive: "himself" | "herself" | "themselves";
    be: "is" | "are";
    have: "has" | "have";
    need: "needs" | "need";
  };

  const resolveStudentPronouns = (value?: string | null): StudentPronounSet => {
    const normalized = String(value || "").trim().toLowerCase();

    if (["he_him", "he/him", "he him", "he", "male", "boy"].includes(normalized)) {
      return {
        subject: "he",
        subjectCapitalized: "He",
        object: "him",
        possessiveAdjective: "his",
        possessivePronoun: "his",
        reflexive: "himself",
        be: "is",
        have: "has",
        need: "needs",
      };
    }

    if (["she_her", "she/her", "she her", "she", "female", "girl"].includes(normalized)) {
      return {
        subject: "she",
        subjectCapitalized: "She",
        object: "her",
        possessiveAdjective: "her",
        possessivePronoun: "hers",
        reflexive: "herself",
        be: "is",
        have: "has",
        need: "needs",
      };
    }

    return {
      subject: "they",
      subjectCapitalized: "They",
      object: "them",
      possessiveAdjective: "their",
      possessivePronoun: "theirs",
      reflexive: "themselves",
      be: "are",
      have: "have",
      need: "need",
    };
  };

  const studentPronouns = resolveStudentPronouns(proposal.student?.gender || null);
  const pronounForStudent = studentPronouns.subject;
  const pronounCapitalized = studentPronouns.subjectCapitalized;
  const pronounCapitalizedWithVerb = `${studentPronouns.subjectCapitalized} ${studentPronouns.be}`;

  const splitList = (value?: string): string[] => {
    if (!value) return [];
    return value
      .split(/[\n,;|]+/)
      .map((item) => item.replace(/^[-*\u2022\s]+/, "").trim())
      .filter(Boolean);
  };

  const formatListWithAnd = (items: string[]) => {
    const cleaned = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
    if (cleaned.length === 0) return "";
    if (cleaned.length === 1) return cleaned[0];
    if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
    return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
  };

  const extractDiagnosisPhase = (): PhaseLabel | null => {
    const text = [proposal.tutorNotes || "", proposal.justification || ""].join("\n");
    const fromNotes = text.match(/Diagnosis Phase:\s*(Clarity|Structured Execution|Controlled Discomfort|Time Pressure Stability)/i)?.[1];
    if (fromNotes) {
      const normalized = normalizePhaseLabel(fromNotes);
      if (normalized) return normalized;
    }

    const legacyFromNotes = text.match(/\nPhase:\s*(Clarity|Structured Execution|Controlled Discomfort|Time Pressure Stability)/i)?.[1];
    if (legacyFromNotes) {
      const normalized = normalizePhaseLabel(legacyFromNotes);
      if (normalized) return normalized;
    }

    const explicit = text.match(/Diagnosed at\s*(Clarity|Structured Execution|Controlled Discomfort|Time Pressure Stability)/i)?.[1];
    if (explicit) {
      const normalized = normalizePhaseLabel(explicit);
      if (normalized) return normalized;
    }

    const scoredAt = text.match(/scored\s*\d+\/?\d*\s*at\s*(Clarity|Structured Execution|Controlled Discomfort|Time Pressure Stability)\s*phase/i)?.[1];
    if (scoredAt) {
      const normalized = normalizePhaseLabel(scoredAt);
      if (normalized) return normalized;
    }

    return null;
  };

  const extractTopicConditioning = () => {
    if (proposal.topicConditioning) {
      return {
        topic: proposal.topicConditioning.topic?.trim() || null,
        entryPhase: proposal.topicConditioning.entryPhase?.trim() || null,
        stability: proposal.topicConditioning.stability?.trim() || null,
      };
    }

    const noteText = proposal.tutorNotes || "";
    const justificationText = proposal.justification || "";
    const topic = (proposal.currentTopics || "").trim() || null;

    const phaseFromNotes = noteText.match(/Entry Phase:\s*([^\n\r]+)/i)?.[1]?.trim();
    const phaseFromJustification = justificationText.match(/Entry phase\s*([^|\.]+)/i)?.[1]?.trim();
    const stabilityFromNotes = noteText.match(/Stability:\s*([^\n\r]+)/i)?.[1]?.trim();
    const stabilityFromJustification = justificationText.match(/Stability\s*([^|\.]+)/i)?.[1]?.trim();

    return {
      topic,
      entryPhase: phaseFromNotes || phaseFromJustification || null,
      stability: stabilityFromNotes || stabilityFromJustification || null,
    };
  };

  const placeholderTopic = "Onboarding baseline diagnostic";
  const focusTopics =
    proposal.currentTopics && proposal.currentTopics.trim() !== "" && proposal.currentTopics !== placeholderTopic
      ? splitList(proposal.currentTopics)
      : splitList(proposal.immediateStruggles);

  const topicConditioning = extractTopicConditioning();

  const PHASE_SEQUENCE = ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"] as const;
  const STABILITY_SEQUENCE = ["Low", "Medium", "High", "High Maintenance"] as const;
  type PhaseLabel = (typeof PHASE_SEQUENCE)[number];
  type StabilityLabel = (typeof STABILITY_SEQUENCE)[number];

  const deriveTrainingEntryPhase = (diagnosisPhase: PhaseLabel, _stability: StabilityLabel): PhaseLabel => {
    return diagnosisPhase;
  };

  const normalizePhaseLabel = (phase?: string | null): PhaseLabel | null => {
    if (!phase) return null;
    const normalized = phase.trim().toLowerCase();
    return PHASE_SEQUENCE.find((item) => item.toLowerCase() === normalized) || null;
  };

  const normalizeStabilityLabel = (stability?: string | null): StabilityLabel => {
    const value = String(stability || "").toLowerCase();
    if (value.includes("high maintenance")) return "High Maintenance";
    if (value.includes("high")) return "High";
    if (value.includes("medium")) return "Medium";
    return "Low";
  };

  const normalizedDiagnosisPhase =
    extractDiagnosisPhase() ||
    normalizePhaseLabel(topicConditioning.entryPhase) ||
    "Clarity";
  const normalizedStability = normalizeStabilityLabel(topicConditioning.stability);
  const trainingStartPhase = deriveTrainingEntryPhase(normalizedDiagnosisPhase, normalizedStability);

  const personalizeCopy = (text: string) =>
    text
      .replace(/^Your child has\b/i, `${studentFirstName} has`)
      .replace(/^Your child is\b/i, `${studentFirstName} is`)
      .replace(/^Your child can\b/i, `${studentFirstName} can`)
      .replace(/^Your child now\b/i, `${studentFirstName} now`)
      .replace(/^Your child\b/i, studentFirstName)
      .replace(/^They have\b/i, `${studentFirstName} has`)
      .replace(/^They are\b/i, `${studentFirstName} is`)
      .replace(/^They can\b/i, `${studentFirstName} can`)
      .replace(/^They\b/i, studentFirstName)
      .replace(/\bYour child\b/gi, studentFirstName);

  const normalizedLiveTopicStates = Array.from(
    topicStates
      .filter((item) => String(item.topic || "").trim().length > 0)
      .reduce((map, item) => {
        const key = String(item.topic || "").trim().toLowerCase();
        const existing = map.get(key);

        if (!existing) {
          map.set(key, item);
          return map;
        }

        const existingDate = new Date(existing.lastUpdated || 0).getTime();
        const itemDate = new Date(item.lastUpdated || 0).getTime();

        if (itemDate >= existingDate) {
          map.set(key, item);
        }

        return map;
      }, new Map<string, ProposalTopicState>())
      .values()
  );

  const activeLiveTopicStates = normalizedLiveTopicStates.filter((item) => item.bucket === "active");
  const currentLiveTopicStates = activeLiveTopicStates.length > 0 ? activeLiveTopicStates : normalizedLiveTopicStates;
  const isLiveTrainingView = !forceDiagnosisView && currentLiveTopicStates.length > 0;
  const isLiveTrainingStatePending = !forceDiagnosisView && currentLiveTopicStates.length === 0;

  const currentTopicNames = currentLiveTopicStates.map((item) => item.topic);
  const currentTopicSummary = formatListWithAnd(currentTopicNames);
  const hasMultipleLiveTopics = currentLiveTopicStates.length > 1;

  const getCurrentBreakdown = (phase: PhaseLabel) => {
    switch (phase) {
      case "Clarity":
        return `${studentFirstName} is still stabilizing recognition of what the question is asking and what structure belongs first.`;
      case "Structured Execution":
        return `${studentFirstName} can see the path, but still needs stronger independent execution without being carried through the method.`;
      case "Controlled Discomfort":
        return `${studentFirstName} is being pushed into harder or less familiar work and needs to hold structure when the question pushes back.`;
      case "Time Pressure Stability":
        return `${studentFirstName} is now training to preserve method and decision quality while pace pressure is introduced.`;
      default:
        return `${studentFirstName} needs more stable topic conditioning before the next pressure layer is added.`;
    }
  };

  const getPhaseMeaning = (phase: PhaseLabel, stability: StabilityLabel) => {
    if (stability === "High Maintenance") {
      switch (phase) {
        case "Clarity":
          return `${pronounForStudent} ${studentPronouns.be} recognising what the question is asking consistently, and we are now confirming that the next layer can be introduced cleanly.`;
        case "Structured Execution":
          return `${pronounForStudent} ${studentPronouns.be} consistently applying the correct method, and we are now confirming that it holds under repetition.`;
        case "Controlled Discomfort":
          return `${pronounForStudent} ${studentPronouns.be} handling harder work with stability, and we are now confirming that timed pressure can be introduced safely.`;
        case "Time Pressure Stability":
          return `${pronounForStudent} ${studentPronouns.be} keeping structure intact under pace pressure, and we are now preserving that standard across repeated sessions.`;
      }
    }

    switch (phase) {
      case "Clarity":
        return `${pronounForStudent} ${studentPronouns.be} still learning to recognise what the question is asking and to choose the right structure early.`;
      case "Structured Execution":
        return `${pronounForStudent} can see the correct method, but it still needs to hold independently and consistently.`;
      case "Controlled Discomfort":
        return "the method now needs to hold when the work becomes harder or less familiar.";
      case "Time Pressure Stability":
        return "the method now needs to stay intact when pace pressure is introduced.";
      default:
        return "the current training layer still needs to stabilise before the next one is added.";
    }
  };

  const getLivePositionText = (phase: PhaseLabel, stability: StabilityLabel) => {
    const nextAction = NEXT_ACTION_ENGINE[phase as TopicPhase][stability as TopicStability];

    if (stability === "High Maintenance") {
      return nextAction.advanceTo
        ? `${studentFirstName} is no longer learning how to solve. ${pronounCapitalizedWithVerb} now proving that execution holds under repetition.`
        : `${studentFirstName} is now holding a stable standard, and the current job is to confirm that it continues to hold over time.`;
    }

    if (stability === "High") {
      return `${studentFirstName} is showing stable performance here, but it still needs to hold across repeated sessions before it can be treated as secure.`;
    }

    switch (phase) {
      case "Clarity":
        return `${studentFirstName} is still building reliable recognition before faster or harder execution is added.`;
      case "Structured Execution":
        return `${studentFirstName} is no longer just recognising the method. The work now is making that execution hold independently from start to finish.`;
      case "Controlled Discomfort":
        return `${studentFirstName} can work through the method, but the next job is keeping that structure when difficulty rises.`;
      case "Time Pressure Stability":
        return `${studentFirstName} can already work with structure. The current job is keeping that structure intact when time pressure increases.`;
      default:
        return `${studentFirstName} is still stabilising this training layer before progression.`;
    }
  };

  const getLiveObservationLines = (phase: PhaseLabel, stability: StabilityLabel, includeTopic = false, topic?: string) => {
    const topicPrefix = includeTopic && topic ? `${topic}: ` : "";
    const linesByPhase: Record<PhaseLabel, string[]> = {
      Clarity: [
        `${topicPrefix}Clear recognition of what the question is asking`,
        `${topicPrefix}Clear identification of the right structure`,
        `${topicPrefix}Minimal hesitation before the first step`,
      ],
      "Structured Execution": [
        `${topicPrefix}Clear, repeatable method execution`,
        `${topicPrefix}Consistent step order across sessions`,
        `${topicPrefix}Minimal breakdown during guided work`,
      ],
      "Controlled Discomfort": [
        `${topicPrefix}Calm control when the work becomes less familiar`,
        `${topicPrefix}Stable structure as difficulty increases`,
        `${topicPrefix}Minimal emotional drift once the question pushes back`,
      ],
      "Time Pressure Stability": [
        `${topicPrefix}Clear structure under pace pressure`,
        `${topicPrefix}Minimal rushed breakdowns`,
        `${topicPrefix}Reliable decisions while timed`,
      ],
    };

    const stabilityLine =
      stability === "High Maintenance"
        ? `${topicPrefix}Consistency is visible across repeated sessions`
        : stability === "High"
          ? `${topicPrefix}Stable performance is visible across repeated sessions`
          : `${topicPrefix}The current response is not yet fully stable`;

    return [...linesByPhase[phase], stabilityLine];
  };

  const getLiveDirectionText = (phase: PhaseLabel, stability: StabilityLabel) => {
    const nextAction = NEXT_ACTION_ENGINE[phase as TopicPhase][stability as TopicStability];

    if (stability === "High Maintenance" && nextAction.advanceTo) {
      return `We are running maintenance checks to confirm that this stability is reliable enough to introduce pressure. ${nextAction.advanceTo} will only begin once this level is consistently maintained.`;
    }

    switch (phase) {
      case "Clarity":
        return "Sessions are focused on recognition, language, and first-step structure before speed or pressure are added.";
      case "Structured Execution":
        return "Sessions are now focused on holding performance steady, not increasing difficulty yet.";
      case "Controlled Discomfort":
        return "Sessions are now increasing difficulty carefully while protecting structure and calm execution.";
      case "Time Pressure Stability":
        return "Sessions are now introducing pace pressure while keeping structure and decision quality intact.";
      default:
        return `The current action is: ${nextAction.primaryAction}.`;
    }
  };

  const getLiveProgressSignals = (phase: PhaseLabel, stability: StabilityLabel, includeTopic = false, topic?: string) => {
    const topicSuffix = includeTopic && topic ? ` in ${topic}` : "";
    const phaseSignals: Record<PhaseLabel, string[]> = {
      Clarity: [
        `Clearer recognition of what questions are asking${topicSuffix}`,
        `Earlier correct method selection${topicSuffix}`,
      ],
      "Structured Execution": [
        `Faster independent starts${topicSuffix}`,
        `More consistent step order without correction${topicSuffix}`,
      ],
      "Controlled Discomfort": [
        `Calmer starts when questions become less familiar${topicSuffix}`,
        `Better structure holding in harder work${topicSuffix}`,
      ],
      "Time Pressure Stability": [
        `Stronger structure while work is timed${topicSuffix}`,
        `Fewer rushed breakdowns${topicSuffix}`,
      ],
    };

    const stabilitySignal =
      stability === "High" || stability === "High Maintenance"
        ? `Stability holding across repeated sessions${topicSuffix}`
        : `Less volatility from one session to the next${topicSuffix}`;

    return [...phaseSignals[phase], stabilitySignal];
  };

  const stateCopy = {
    status: personalizeCopy(getParentDashboardCopyByState(trainingStartPhase as TopicPhase, normalizedStability as TopicStability).status),
    meaning: personalizeCopy(getParentDashboardCopyByState(trainingStartPhase as TopicPhase, normalizedStability as TopicStability).meaning),
    focus: personalizeCopy(getParentDashboardCopyByState(trainingStartPhase as TopicPhase, normalizedStability as TopicStability).focus),
  };
  const diagnosisObserved = (() => {
    switch (trainingStartPhase) {
      case "Clarity":
        return [
          `${studentFirstName} is not yet reading this topic with full clarity.`,
          `${pronounCapitalized} still ${studentPronouns.need} support to identify the structure and meaning of the work correctly.`,
        ];
      case "Structured Execution":
        return [
          `${studentFirstName} can begin solving, but does not yet hold a stable method independently.`,
          `${pronounCapitalized} can follow the steps in some cases, but still loses consistency without support.`,
        ];
      case "Controlled Discomfort":
        return [
          `${studentFirstName} can work through familiar questions, but becomes less stable when difficulty increases.`,
          `${pronounCapitalized} still ${studentPronouns.need} support to stay composed and structured when the work feels unfamiliar.`,
        ];
      case "Time Pressure Stability":
        return [
          `${studentFirstName} can solve correctly, but timed pressure still affects consistency.`,
          `${pronounCapitalized} ${studentPronouns.need} reinforcement to keep structure stable when speed is added.`,
        ];
      default:
        return [stateCopy.status, stateCopy.meaning];
    }
  })();
  const derivedObserved = isLiveTrainingView ? [stateCopy.status, stateCopy.meaning] : diagnosisObserved;

  const observedResponse = [
    proposal.mathRelationship,
    proposal.pressureResponse,
    proposal.confidenceKillers,
    proposal.confidenceTriggers,
    proposal.immediateStruggles,
    proposal.gapsIdentified,
    ...derivedObserved,
  ]
    .filter(Boolean)
    .flatMap((item) => splitList(item));

  const expectedChanges = splitList(proposal.childWillWin);
  const diagnosisTopic = topicConditioning.topic || focusTopics[0] || "Current school topic";

  const getFirstBreakdown = () => {
    switch (trainingStartPhase) {
      case "Clarity":
        return `${studentFirstName} is not yet consistently identifying what the question is asking or what structure to use first.`;
      case "Structured Execution":
        return `${studentFirstName} can begin work, but does not yet apply a stable method consistently without support.`;
      case "Controlled Discomfort":
        return `${studentFirstName} becomes less stable when the work feels unfamiliar or more difficult.`;
      case "Time Pressure Stability":
        return `${studentFirstName} loses structure when working under time pressure.`;
      default:
        return `${studentFirstName} needs more stability in the current topic before more pressure is added.`;
    }
  };

  const getFirstPriority = () => {
    switch (trainingStartPhase) {
      case "Clarity":
        return `We will first help ${studentFirstName} read problems more clearly, recognise what is being asked, and identify the structure before solving.`;
      case "Structured Execution":
        return `We will first train ${studentFirstName} to start earlier and follow a repeatable method without waiting to be carried through each step.`;
      case "Controlled Discomfort":
        return `We will first train ${studentFirstName} to stay calm and structured when questions become less familiar or more difficult.`;
      case "Time Pressure Stability":
        return `We will first train ${studentFirstName} to keep the same structure and decision-making even when time pressure increases.`;
      default:
        return `We will first strengthen ${studentFirstName}'s consistency inside the current topic.`;
    }
  };

  const progressSignals = expectedChanges.length > 0
    ? expectedChanges
    : trainingStartPhase === "Clarity"
      ? [
          "Clearer recognition of what the question is asking",
          "Earlier correct method selection",
          "Less confusion when beginning problems",
          "More accurate first steps",
        ]
      : trainingStartPhase === "Structured Execution"
        ? [
            "Earlier independent starts",
            "Less hesitation when beginning problems",
            "More consistent method use",
            "More stable step order without prompting",
          ]
        : trainingStartPhase === "Controlled Discomfort"
          ? [
              "Calmer starts when questions feel less familiar",
              "Better structure holding in harder work",
              "Less visible shutdown under challenge",
              "More complete attempts on difficult questions",
            ]
          : [
              "Stronger structure while work is timed",
              "Fewer rushed breakdowns",
              "More reliable decisions under pace pressure",
              "Less instability when speed is added",
            ];

  const liveTopicBlocks = currentLiveTopicStates.map((item) => {
    const phase = normalizePhaseLabel(item.phase) || "Clarity";
    const stability = item.stability ? normalizeStabilityLabel(item.stability) : "Low";

      return {
        topic: item.topic,
        phase,
        stability,
        stateLabel: `${phase} (${stability})`,
        meaning: getPhaseMeaning(phase, stability),
        position: getLivePositionText(phase, stability),
        observations: getLiveObservationLines(phase, stability, false),
        direction: getLiveDirectionText(phase, stability),
        progressSignals: getLiveProgressSignals(phase, stability, false),
      };
  });

  const primaryLiveTopicBlock = liveTopicBlocks[0] || null;
  const liveProgressMarkers = Array.from(
    new Set(
      liveTopicBlocks.flatMap((item) =>
        item.progressSignals.map((signal) =>
          hasMultipleLiveTopics ? `${item.topic}: ${signal}` : signal
        )
      )
    )
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg">
        <h2 className="text-2xl font-bold text-foreground mb-2">{studentFirstName} Training Plan</h2>
        <p className="text-muted-foreground">
          {isLiveTrainingView || isLiveTrainingStatePending ? "Live Operating Plan" : `Structured plan for ${studentName}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "Current Focus" : "Diagnosis Context"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLiveTrainingView ? (
            hasMultipleLiveTopics ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {studentFirstName} is currently training across {currentTopicSummary}.
                </p>
                <p className="text-sm text-muted-foreground">
                  Each topic is being handled from its current position.
                </p>
                <div className="space-y-3">
                  {liveTopicBlocks.map((item) => (
                    <div key={item.topic} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <p className="text-base font-semibold text-foreground">{item.topic}</p>
                      <p className="text-sm text-muted-foreground">
                                {pronounCapitalizedWithVerb} operating at <Badge variant="secondary" className="align-middle ml-1">{item.stateLabel}</Badge> <span className="ml-1">meaning {item.meaning}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : primaryLiveTopicBlock ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {studentFirstName} is currently training in <span className="text-foreground font-medium">{primaryLiveTopicBlock.topic}</span>.
                </p>
                <p>
                  {pronounCapitalizedWithVerb} operating at <span className="text-foreground font-medium">{primaryLiveTopicBlock.stateLabel}</span> - meaning {primaryLiveTopicBlock.meaning}
                </p>
              </div>
            ) : null
          ) : isLiveTrainingStatePending ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Live topic-conditioning state is syncing for {studentFirstName}.
              </p>
              <p>
                This view will refresh from the student's current training position as soon as the latest live topic state is available.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Diagnosis ran on: <span className="text-foreground font-medium">{diagnosisTopic}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {(isLiveTrainingView || isLiveTrainingStatePending || normalizedStability === "Low" || normalizedStability === "Medium") && (
        <Card>
          <CardHeader>
            <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "Current Position" : `Where ${studentFirstName} Currently Gets Stuck`}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLiveTrainingView ? (
              hasMultipleLiveTopics ? (
                <div className="space-y-3">
                  {liveTopicBlocks.map((item) => (
                    <div key={item.topic} className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium text-foreground mb-1">{item.topic}</p>
                      <p className="text-sm text-muted-foreground">{item.position}</p>
                    </div>
                  ))}
                </div>
              ) : primaryLiveTopicBlock ? (
                <p className="text-sm text-muted-foreground">{primaryLiveTopicBlock.position}</p>
              ) : null
            ) : isLiveTrainingStatePending ? (
              <p className="text-sm text-muted-foreground">
                The current live training position will appear here once topic-conditioning state finishes syncing.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{getFirstBreakdown()}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "What We Are Observing" : "What We Have Observed"}</CardTitle>
        </CardHeader>
        <CardContent>
          {(isLiveTrainingView ? liveTopicBlocks : isLiveTrainingStatePending ? [] : Array.from(new Set(observedResponse))).length > 0 ? (
            isLiveTrainingView ? (
              hasMultipleLiveTopics ? (
                <div className="space-y-3">
                  {liveTopicBlocks.map((item) => (
                    <div key={item.topic} className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium text-foreground mb-2">{item.topic}</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {item.observations.map((line) => (
                          <li key={`${item.topic}-${line}`}>- {line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : primaryLiveTopicBlock ? (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {primaryLiveTopicBlock.observations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              ) : null
            ) : (
              <ul className="text-sm text-muted-foreground space-y-1">
                {Array.from(new Set(observedResponse)).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLiveTrainingView || isLiveTrainingStatePending ? "Live topic-conditioning observations will appear here as the current state updates." : "Observed response patterns captured during intro session."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "Training Direction" : "Training Path"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLiveTrainingView ? (
            hasMultipleLiveTopics ? (
              <div className="space-y-3">
                {liveTopicBlocks.map((item) => (
                  <div key={item.topic} className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground mb-1">{item.topic}</p>
                    <p className="text-sm text-muted-foreground">{item.direction}</p>
                  </div>
                ))}
              </div>
            ) : primaryLiveTopicBlock ? (
              <p className="text-sm text-muted-foreground">{primaryLiveTopicBlock.direction}</p>
            ) : null
            ) : isLiveTrainingStatePending ? (
              <p className="text-sm text-muted-foreground">
                Training direction will populate from the latest live topic-conditioning state once it is available.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{getFirstPriority()}</p>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "Structure" : "Conditioning Structure"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLiveTrainingView || isLiveTrainingStatePending ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- {plannedSessionsPerWeek} sessions per week ({packageSessions} per month)</li>
              <li>- Method-first execution</li>
              <li>- Immediate correction where needed</li>
              <li>- Repetition within the active training set</li>
              <li>- Difficulty increases only after stability is proven</li>
            </ul>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Cadence: {plannedSessionsPerWeek} sessions per week ({packageSessions} sessions per month)</li>
              <li>- Clear explanation of the problem structure</li>
              <li>- Guided practice with immediate correction</li>
              <li>- Repeated method-building in the active topic-conditioning set</li>
              <li>- Gradual increase in difficulty when readiness improves</li>
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isLiveTrainingView || isLiveTrainingStatePending ? "How Progress Will Show" : "How Progress Will Be Observed"}</CardTitle>
        </CardHeader>
        <CardContent>
          {(isLiveTrainingView ? liveProgressMarkers : isLiveTrainingStatePending ? [] : progressSignals).length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {(isLiveTrainingView ? liveProgressMarkers : isLiveTrainingStatePending ? [] : progressSignals).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              {(isLiveTrainingStatePending ? ["Live progress markers will appear here once the latest topic-conditioning state is available."] : progressSignals).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <h3 className="font-bold text-lg mb-2">{isLiveTrainingView || isLiveTrainingStatePending ? "Parent Note" : "Parent Alignment"}</h3>
          {isLiveTrainingView ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {hasMultipleLiveTopics ? (
                <>
                  <li>- This plan reflects {studentFirstName}'s current live training position across {currentTopicSummary}.</li>
                  <li>- Each topic advances according to its own stability.</li>
                </>
              ) : (
                <>
                  <li>- This plan reflects {studentFirstName}'s current training position, not a fixed program.</li>
                  <li>- As their execution stabilizes, the training phase will advance.</li>
                </>
              )}
            </ul>
          ) : isLiveTrainingStatePending ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- This view no longer falls back to onboarding-era topic placement once active training has begun.</li>
              <li>- If live state is still syncing, the current training position will appear here as soon as the latest topic-conditioning state is available.</li>
            </ul>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{`This training focuses on how ${studentFirstName} responds when work becomes difficult.
            The goal is to build structured thinking, independent execution, and stability
            under pressure.`}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Progress is measured through behavior and response, not only marks.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Package</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Sessions</p>
              <p className="mt-1 font-semibold text-foreground">{packageSessions} per month</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Planned frequency</p>
              <p className="mt-1 font-semibold text-foreground">{plannedSessionsPerWeek} per week</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Monthly amount</p>
              <p className="mt-1 font-semibold text-foreground">R{packageAmount.toLocaleString("en-ZA")}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            R200 is the per-session pricing basis. The service is delivered and renewed as this monthly package, not as ad-hoc session capacity.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commitment</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Package cadence: {plannedSessionsPerWeek} sessions weekly ({packageSessions} sessions monthly)</li>
            <li>- Consistent sessions are required</li>
            <li>- Student is expected to attempt before receiving guidance</li>
            <li>- Discomfort during learning is part of the process</li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      {showActions && (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg mb-3 text-center">Ready to Begin?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {isPilotOnboarding
                ? `Accept this pilot plan to unlock ${studentName}'s free-session access`
                : `Pay R${packageAmount.toLocaleString("en-ZA")} for the ${packageSessions}-session monthly package to unlock ${studentName}'s training sessions`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={onDecline}
                disabled={isProcessing}
                className="w-full sm:flex-1 gap-2"
                size="lg"
              >
                <X className="w-4 h-4" />
                Decline
              </Button>
              <Button
                onClick={onAccept}
                disabled={isProcessing}
                className="w-full sm:flex-1 gap-2"
                size="lg"
              >
                <Check className="w-4 h-4" />
                {isProcessing
                  ? "Processing..."
                  : isPilotOnboarding
                    ? "Accept Pilot Access"
                    : `Pay R${packageAmount.toLocaleString("en-ZA")} & Accept`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
