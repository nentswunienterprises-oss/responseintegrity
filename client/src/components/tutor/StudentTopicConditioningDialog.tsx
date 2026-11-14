Warning: truncated output (original token count: 44810)
Total output lines: 3476

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getQueryFn } from "@/lib/queryClient";
import { Target, AlertCircle, Info, ChevronDown, MoreHorizontal } from "lucide-react";
import { useStudentWorkflowState } from "@/hooks/useStudentWorkflowState";
import { getPendingTutorConfirmationSessions, getTrainingSessionWeekKey, isScheduledTrainingSessionUpcoming } from "@/lib/trainingSessionWeek";
// Removed TutorSessionLogForm import (manual session logging is deprecated)
import {
  PHASES,
  getNextActionData,
  nextActionFor,
  phaseIndex,
  topicPriorityScore,
  trendFromHistory,
  getPriorityReason,
  nextMoveRecommendation,
} from "./topicConditioningEngine";
import { Progress } from "../ui/progress";
import { sandboxTargetedRediagnosisCopy } from "@shared/sandboxCompletionDirection";
import { displayTopicStability, topicStabilityConfirmationLabel, topicStabilityConfirmationExplanation } from "@shared/topicStabilityPresentation";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { PhaseLabel, StabilityLabel, TopicTrend } from "./topicConditioningEngine";
import { useConfirmTrainingSession, useRespondTrainingSession, useRetryScheduledSessionMeetSync, useTrainingSessions } from "@/hooks/useScheduledSession";
import { TrainingSessionCancellationDialog } from "@/components/scheduling/TrainingSessionCancellationDialog";
import {
  TUTOR_TRAINING_SESSION_CANCELLATION_REASONS,
  buildTrainingSessionCancellationNote,
} from "@/lib/trainingSessionCancellation";
import {
  evaluateTrainingPackageQuota,
  resolveTrainingTabAvailability,
} from "@shared/trainingPackageQuota";

type TopicConditioningMap = {
  topic?: string | null;
  entry_phase?: string | null;
  stability?: string | null;
};

type ObservationKind = "diagnosis" | "training" | "observation";

type TopicRow = {
  topic: string;
  phase: PhaseLabel;
  stability: StabilityLabel;
  progressionAuthority: "building" | "exit_confirmation_eligible" | "transfer_maintenance" | null;
  hasObservedState: boolean;
  requiresTargetedRediagnosis: boolean;
  targetedRediagnosisStartPhase: PhaseLabel | null;
  systemNextAction: string | null;
  prerequisiteContradictionReason: string | null;
  stateSource: "observed" | "seeded" | "activated";
  lastSession: string;
  trend: TopicTrend;
  entryDiagnosis: string;
  recentLogs: string[];
  timeline: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel; kind: ObservationKind }>;
  parentReported?: boolean;
  parentReportedSymptoms?: string[];
  parentRecommendedPhase?: string | null;
};

/**
 * Bridge the independent progression gate into historical next-action copy.
 * Only the next-action logic receives the compound compatibility value.
 * Stability display and persisted state remain Low / Medium / High.
 */
function nextActionStabilityFor(row: Pick<TopicRow, "phase" | "stability" | "progressionAuthority">): StabilityLabel {
  if (row.progressionAuthority === "building") {
    return row.stability === "High Maintenance" ? "High" : row.stability;
  }
  if (
    row.stability === "High" &&
    (row.progressionAuthority === "exit_confirmation_eligible" ||
      (row.progressionAuthority === "transfer_maintenance" && row.phase === "Time Pressure Stability"))
  ) {
    return "High Maintenance";
  }
  return row.stability;
}

type TutorSessionRecord = {
  id: string;
  studentId?: string;
  date: string;
  notes?: string | null;
  methodNotes?: string | null;
  studentResponse?: string | null;
};

type ObservationOption = { label: string; score: number };
type ObservationCategory = { key: string; label: string; options: ObservationOption[] };

type StabilityThresholds = {
  low: { remainMax: number; mediumMax: number; highMin: number };
  medium: { regressMax: number; remainMax: number; highMin: number };
  high: { regressMax: number; remainMax: number; advanceReadyMin: number };
  maintenance: { regressMax: number; highMax: number; advanceReadyMin: number };
};

const PHASE_OBSERVATION_CONFIG: Record<
  PhaseLabel,
  {
    categories: ObservationCategory[];
    interventions: string[];
    thresholds: StabilityThresholds;
    highGate: (selections: Record<string, string>) => boolean;
  }
> = {
  Clarity: {
    categories: [
      {
        key: "vocabulary_precision",
        label: "A. Vocabulary Precision",
        options: [
          { label: "Correctly named key terms without help", score: 30 },
          { label: "Named some terms but needed prompting", score: 20 },
          { label: "Used vague language often", score: 10 },
          { label: "Could not identify key terms", score: 0 },
        ],
      },
      {
        key: "method_recognition",
        label: "B. Method Recognition",
        options: [
          { label: "Identified full method correctly", score: 30 },
          { label: "Identified method partially", score: 18 },
          { label: "Confused the method sequence", score: 8 },
          { label: "Could not identify what to do", score: 0 },
        ],
      },
      {
        key: "reason_clarity",
        label: "C. Reason Clarity",
        options: [
          { label: "Explained why the method works clearly", score: 20 },
          { label: "Gave partial reason", score: 12 },
          { label: "Knew steps but not why", score: 6 },
          { label: "Could not explain why at all", score: 0 },
        ],
      },
      {
        key: "immediate_apply_response",
        label: "D. Immediate Apply Response",
        options: [
          { label: "Repeated modeled process independently", score: 20 },
          { label: "Repeated with minor prompting", score: 14 },
          { label: "Repeated with heavy prompting", score: 6 },
          { label: "Could not repeat after modeling", score: 0 },
        ],
      },
    ],
    interventions: [
      "Re-modeled vocabulary",
      "Re-modeled method",
      "Re-modeled reason",
      "Increased apply repetition",
    ],
    thresholds: {
      low: { remainMax: 49, mediumMax: 79, highMin: 80 },
      medium: { regressMax: 44, remainMax: 79, highMin: 80 },
      high: { regressMax: 49, remainMax: 84, advanceReadyMin: 85 },
      maintenance: { regressMax: 59, highMax: 84, advanceReadyMin: 85 },
    },
    highGate: (selections) => !Object.values(selections).some((value) => {
      if (!value) return true;
      return value.toLowerCase().includes("could not") || value.toLowerCase().includes("0");
    }),
  },
  "Structured Execution": {
    categories: [
      {
        key: "start_behavior",
        label: "A. Start Behavior",
        options: [
          { label: "Started immediately", score: 25 },
          { label: "Delayed briefly but started alone", score: 18 },
          { label: "Needed prompting to start", score: 8 },
          { label: "Avoided / waited for help", score: 0 },
        ],
      },
      {
        key: "step_execution",
        label: "B. Step Execution",
        options: [
          { label: "Followed all steps in correct order", score: 30 },
          { label: "Minor step skips", score: 20 },
          { label: "Frequent step skips", score: 8 },
          { label: "Guessed instead of following steps", score: 0 },
        ],
      },
      {
        key: "repeatability",
        label: "C. Repeatability Across Problems",
        options: [
          { label: "Consistent across all problems", score: 25 },
          { label: "Mostly consistent", score: 18 },
          { label: "Inconsistent from problem to problem", score: 8 },
          { label: "Could not sustain method", score: 0 },
        ],
      },
      {
        key: "independence_level",
        label: "D. Independence Level",
        options: [
          { label: "Executed without support", score: 20 },
          { label: "Needed light reminders", score: 14 },
          { label: "Needed repeated guidance", score: 6 },
          { label: "Could not continue without being carried", score: 0 },
        ],
      },
    ],
    interventions: [
      "Independent execution loop",
      "Corrected skipped step",
      "Forced independent start",
      "Corrected method gap",
    ],
    thresholds: {
      low: { remainMax: 49, mediumMax: 79, highMin: 80 },
      medium: { regressMax: 44, remainMax: 79, highMin: 80 },
      high: { regressMax: 49, remainMax: 84, advanceReadyMin: 85 },
      maintenance: { regressMax: 59, highMax: 84, advanceReadyMin: 85 },
    },
    highGate: (selections) => {
      const step = selections.step_execution || "";
      const start = selections.start_behavior || "";
      return !step.toLowerCase().includes("guessed") && !start.toLowerCase().includes("avoided");
    },
  },
  "Controlled Discomfort": {
    categories: [
      {
        key: "initial_boss_response",
        label: "A. Initial Response to Boss Battle",
        options: [
          { label: "Calmly attempted", score: 30 },
          { label: "Hesitated but attempted", score: 20 },
          { label: "Froze before starting", score: 8 },
          { label: "Asked for help immediately", score: 6 },
          { label: "Rushed into random attempt", score: 5 },
        ],
      },
      {
        key: "first_step_control",
        label: "B. First-Step Control",
        options: [
          { label: "Identified first step independently", score: 25 },
          { label: "Identified first step after pause", score: 18 },
          { label: "Needed prompting to identify first step", score: 8 },
          { label: "Could not identify first step", score: 0 },
        ],
      },
      {
        key: "discomfort_tolerance",
        label: "C. Discomfort Tolerance",
        options: [
          { label: "Stayed inside difficulty without collapse", score: 25 },
          { label: "Showed tension but continued", score: 18 },
          { label: "Broke structure under difficulty", score: 8 },
          { label: "Avoided the problem", score: 0 },
        ],
      },
      {
        key: "rescue_dependence",
        label: "D. Rescue Dependence",
        options: [
          { label: "Did not seek rescue", score: 20 },
          { label: "Sought reassurance only", score: 14 },
          { label: "Asked for help early", score: 6 },
          { label: "Needed Specialist to carry response", score: 0 },
        ],
      },
    ],
    interventions: [
      "Introduced Boss Battle",
      "Held 10-15 second pause",
      "Guided first step only",
      "Debriefed response pattern",
    ],
    thresholds: {
      low: { remainMax: 49, mediumMax: 79, highMin: 80 },
      medium: { regressMax: 44, remainMax: 79, highMin: 80 },
      high: { regressMax: 49, remainMax: 84, advanceReadyMin: 85 },
      maintenance: { regressMax: 59, highMax: 84, advanceReadyMin: 85 },
    },
    highGate: (selections) => {
      const initial = selections.initial_boss_response || "";
      const firstStep = selections.first_step_control || "";
      return !initial.toLowerCase().includes("froze") && !initial.toLowerCase().includes("avoid") && !firstStep.toLowerCase().includes("could not");
    },
  },
  "Time Pressure Stability": {
    categories: [
      {
        key: "start_under_time",
        label: "A. Start Under Time",
        options: [
          { label: "Started calmly", score: 20 },
          { label: "Slight delay but started", score: 14 },
          { label: "Started with visible panic", score: 6 },
          { label: "Froze under timer", score: 0 },
        ],
      },
      {
        key: "structure_under_time",
        label: "B. Structure Under Time",
        options: [
          { label: "Maintained full method", score: 35 },
          { label: "Minor loss of structure", score: 24 },
          { label: "Frequent loss of steps", score: 10 },
          { label: "Abandoned process", score: 0 },
        ],
      },
      {
        key: "pace_control",
        label: "C. Pace Control",
        options: [
          { label: "Controlled pace", score: 20 },
          { label: "Slight rush", score: 14 },
          { label: "Significant rushing", score: 6 },
          { label: "Panic-driven speed / shutdown", score: 0 },
        ],
      },
      {
        key: "completion_integrity",
        label: "D. Completion Integrity",
        options: [
          { label: "Completed with structure", score: 25 },
          { label: "Completed with instability", score: 16 },
          { label: "Partial completion due to breakdown", score: 8 },
          { label: "Could not complete due to collapse", score: 0 },
        ],
      },
    ],
    interventions: [
      "Ran timed attempt",
      "Debriefed process under pressure",
      "Re-anchored structure",
      "Reduced time intensity appropriately",
    ],
    thresholds: {
      low: { remainMax: 49, mediumMax: 79, highMin: 80 },
      medium: { regressMax: 44, remainMax: 79, highMin: 80 },
      high: { regressMax: 49, remainMax: 84, advanceReadyMin: 85 },
      maintenance: { regressMax: 59, highMax: 84, advanceReadyMin: 85 },
    },
    highGate: (selections) => {
      const structure = selections.structure_under_time || "";
      const pace = selections.pace_control || "";
      return structure.toLowerCase().includes("maintained") && pace.toLowerCase().includes("controlled");
    },
  },
};

type SandboxMapPreparationPlan = {
  captureActive: boolean;
  status: "inactive" | "rep_ready" | "targeted_rediagnosis_required" | "session_complete";
  prescribedPhase?: string;
  planFingerprint?: string;
  completedReps?: number;
  preparationRequired?: boolean;
  preparationRecorded?: boolean;
  sessionNumber?: number;
  sets?: Array<{
    setId: string; setName: string; reps: number; modelingOnly: boolean;
    constraints: Record<string, unknown>;
  }>;
};

interface StudentTopicConditioningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  studentGrade?: string | null;
  operationalMode?: "training" | "sandbox" | "trial" | "certified_live";
  readOnly?: boolean;
  mapOnly?: boolean;
  apiBasePath?: string;
  parentTopics?: string | null;
  parentTopicSymptoms?: Record<string, string[]> | null;
  parentTopicRecommendations?: Record<string, { phase?: string | null; supportingSymptoms?: string[]; rationale?: string | null }> | null;
  topicConditioning?: TopicConditioningMap | null;
  persistedTopicStates?: Record<
    string,
    {
      topic?: string | null;
      phase?: string | null;
      stability?: string | null;
      lastUpdated?: string | null;
      observationNotes?: string | null;
      nextAction?: string | null;
      requiresTargetedRediagnosis?: boolean | null;
      targetedRediagnosisStartPhase?: string | null;
      prerequisiteContradictionReason?: string | null;
      history?: Array<{
        date?: string | null;
        phase?: string | null;
        stability?: string | null;
        nextAction?: string | null;
        observationNotes?: string | null;
      }>;
    }
  > | null;
}

function splitTopics(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;|]+/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);
}

export function normalizePhase(value?: string | null): PhaseLabel {
  const v = String(value || "").toLowerCase();
  if (v.includes("clarity")) return "Clarity";
  if (v.includes("structured")) return "Structured Execution";
  if (v.includes("discomfort")) return "Controlled Discomfort";
  if (v.includes("time") || v.includes("pressure")) return "Time Pressure Stability";
  return "Structured Execution";
}

export function normalizeStability(value?: string | null): StabilityLabel {
  const v = String(value || "").toLowerCase();
  if (v.includes("high maintenance") || v.includes("maintenance")) return "High Maintenance";
  if (v.includes("high")) return "High";
  if (v.includes("medium")) return "Medium";
  return "Low";
}

export function sanitizeTopic(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let cleaned = raw;
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        cleaned = String(parsed[0] || "").trim();
      }
    } catch {
      // Keep the raw string when it is not valid JSON.
    }
  }

  if (cleaned.includes("|")) {
    cleaned = cleaned.split("|")[0].trim();
  }

  if (!cleaned) return null;
  if (cleaned.toLowerCase() === "onboarding baseline diagnostic") return null;
  return cleaned;
}

function normalizeTopicLabel(value?: string | null): string | null {
  return sanitizeTopic(value);
}

function normalizeTopicKey(value?: string | null): string | null {
  const normalized = normalizeTopicLabel(value);
  return normalized ? normalized.toLowerCase() : null;
}

function mergeAuthoritativeTopicStates(
  snapshot: StudentTopicConditioningDialogProps["persistedTopicStates"],
  response: unknown,
): StudentTopicConditioningDialogProps["persistedTopicStates"] {
  const merged: Record<string, any> =
    snapshot && typeof snapshot === "object" ? { ...snapshot } : {};

  const body = response as any;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.topics)
      ? body.topics
      : [];

  rows.forEach((row: any) => {
    const topic = sanitizeTopic(row?.topic || "");
    const topicKey = normalizeTopicKey(topic);
    if (!topic || !topicKey) return;

    const existingKey =
      Object.entries(merged).find(([key, entry]: [string, any]) => {
        const entryTopicKey = normalizeTopicKey(entry?.topic || key);
        return entryTopicKey === topicKey;
      })?.[0] || topic;

    merged[existingKey] = {
      ...(merged[existingKey] || {}),
      ...row,
      topic,
    };
  });

  return merged;
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stabilityToScore(stability: StabilityLabel): number {
  if (stability === "High Maintenance") return 4;
  if (stability === "High") return 3;
  if (stability === "Medium") return 2;
  return 1;
}

function scoreToStability(score: number): StabilityLabel {
  if (score >= 4) return "High Maintenance";
  if (score >= 3) return "High";
  if (score === 2) return "Medium";
  return "Low";
}

function deriveTransitionStatus(
  phase: PhaseLabel,
  stability: StabilityLabel,
  trend?: TopicTrend,
  options?: { suppressRegressed?: boolean },
) {
  const advanceTo = getNextActionData(phase, stability).advanceTo;
  if (trend === "Regressing" && !options?.suppressRegressed) return "Regressed" as const;
  if (phase === "Time Pressure Stability" && stability === "High Maintenance") return "Transfer Evidence Required" as const;
  if (stability === "High Maintenance" && advanceTo) return "Phase-Exit Confirmation" as const;
  if (stability === "High Maintenance") return "Hold and Verify" as const;
  if (stability === "High") return "Repeatability Check" as const;
  if (stability === "Medium") return "Building" as const;
  return "Reinforce" as const;
}

function isFirstObservationInCurrentPhase(
  phase: PhaseLabel,
  timeline: TopicRow["timeline"] | undefined,
): boolean {
  const events = Array.isArray(timeline) ? timeline : [];
  if (events.length === 0) return false;
  const latest = events[events.length - 1];
  if (latest.phase !== phase) return false;
  const entriesInPhase = events.filter((event) => event.phase === phase).length;
  return entriesInPhase === 1;
}

function enteredMaintenanceCheckpoint(
  phase: PhaseLabel,
  stability: StabilityLabel,
  timeline: TopicRow["timeline"] | undefined,
) {
  if (stability !== "High Maintenance") return false;
  const events = Array.isArray(timeline) ? timeline : [];
  if (events.length < 2) return false;
  const latest = events[events.length - 1];
  const previous = events[events.length - 2];
  return (
    latest.phase === phase &&
    latest.stability === "High Maintenance" &&
    previous.phase === phase &&
    previous.stability === "High"
  );
}

function interpretTopicState(
  phase: PhaseLabel,
  stability: StabilityLabel,
  trend?: TopicTrend,
  options?: { enteredMaintenanceCheckpoint?: boolean; firstObservationInCurrentPhase?: boolean },
) {
  const firstObservationInCurrentPhase = !!options?.firstObservationInCurrentPhase;
  const nextAction = nextActionFor(phase, stability);
  const rules = getNextActionData(phase, stability).rules;

  const tutorMeaningByPhase: Record<PhaseLabel, Record<StabilityLabel, string>> = {
    Clarity: {
      Low: "Student still needs foundational clarity before independent execution.",
      Medium: "Student grasps concepts but needs more practice for consistency.",
      High: "Student has clear understanding and is ready for structured execution practice.",
      "High Maintenance": "High Clarity is recorded. A separate qualifying Clarity exit confirmation is needed before Structured Execution.",
    },
    "Structured Execution": {
      Low: "Student can follow steps but needs consistency and independence building.",
      Medium: "Student executes steps mostly independently but struggles with consistency.",
      High: "Student executes steps independently and is ready to build resilience under difficulty.",
      "High Maintenance": "High independent execution is recorded. A separate qualifying exit confirmation is needed before Controlled Discomfort.",
    },
    "Controlled Discomfort": {
      Low: "Student struggles under difficulty but is building stability.",
      Medium: "Student handles difficulty with improving stability and consistency.",
      High: "Student handles difficulty with stability and is ready for time-pressure training.",
      "High Maintenance": "High control under difficulty is recorded. A separate qualifying exit confirmation is needed before Time Pressure Stability.",
    },
    "Time Pressure Stability": {
      Low: "Student needs to maintain structure and speed consistency under time.",
      Medium: "Student handles time pressure mostly but needs refinement.",
      High: "Student is stable under time pressure and maintains execution quality.",
      "High Maintenance": "High timed stability is recorded. Maintain it and verify transfer with separate evidence.",
    },
  };

  // Use 'Their child...' phrasing for parent UI (Map view)
  const parentMeaningByPhase: Record<PhaseLabel, string> = {
    Clarity: "Their child is building core understanding before speed or pressure work.",
    "Structured Execution": "Their child is becoming more consistent and independent with method.",
    "Controlled Discomfort": "Their child is learning to stay composed when work becomes difficult.",
    "Time Pressure Stability": "Their child is strengthening performance under time pressure.",
  };

  const transitionStatus =
    deriveTransitionStatus(phase, stability, trend, {
      suppressRegressed: firstObservationInCurrentPhase,
    });

  return {
    nextAction,
    rules,
    transitionStatus,
    tutorMeaning: tutorMeaningByPhase[phase][stability],
    parentMeaning: parentMeaningByPhase[phase],
    direction: `${nextAction}`,
  };
}

function nextPrepPhaseFor(phase: PhaseLabel, stability: StabilityLabel): PhaseLabel {
  if (stability === "High Maintenance") return phase;
  return getNextActionData(phase, stability).advanceTo || phase;
}

function actionGuidanceFor(phase: PhaseLabel, stability: StabilityLabel): { doItems: string[]; avoidItems: string[] } {
  const data = getNextActionData(phase, stability);
  return { doItems: data.nextActions, avoidItems: data.rules };
}

function tutorPrepPlanFor(
  phase: PhaseLabel,
  stability: StabilityLabel,
  hasObservedState: boolean,
): {
  drillType: string;
  setPlans: Array<{ label: string; problems: number; difficulty: string }>;
  prepNotes: string[];
} {
  const baseDifficulty = "Simple/Normal";

  if (!hasObservedState) {
    return {
      drillType: "Evidence-complete Diagnosis",
      setPlans: [
        { label: "Current system-selected opportunity", problems: 1, difficulty: "Match displayed probe" },
      ],
      prepNotes: [
        "Prepare one curriculum-appropriate problem for the current system-selected opportunity.",
        "Do not pre-commit to a fixed rep count; another opportunity exists only when the evidence question remains unresolved.",
        "Follow the displayed probe constraints exactly. Do not teach, cue, rescue, or add time pressure unless that probe requires it.",
        "The starting signal routes the first question only; observed behavior determines placement.",
        "If another probe is required, prepare the next comparable problem only after the system selects it.",
        "If the displayed opportunity requires passive timing, have one fresh equivalent reserve problem ready before Begin Opportunity. It may be used only after an objective technical timing failure, never to chase a stronger response.",
      ],
    };
  }

  const prepPhase = nextPrepPhaseFor(phase, stability);
  const prepStability = prepPhase === phase ? stability : "Low";
  const prepDrillType = `${prepPhase} Drill`;

  if (prepPhase === "Clarity") {
    return {
      drillType: prepDrillType,
      setPlans: [
        { label: "Set 1: Modeling", problems: 2, difficulty: baseDifficulty },
        { label: "Set 2: Identification", problems: 3, difficulty: baseDifficulty },
        { label: "Set 3: Light Apply", problems: 3, difficulty: baseDifficulty },
      ],
      prepNotes: [
        "Set 1 is teaching only; it does not create decision-eligible observation evidence.",
        "Prepare 8 total problems (2 model + 6 drill reps).",
        "No boss battles and no timed pressure in Clarity.",
        "Difficulty guidance: keep all problems at Simple/Normal level.",
      ],
    };
  }

  if (prepPhase === "Structured Execution") {
    return {
      drillType: prepDrillType,
      setPlans: [
        { label: "Set 1", problems: 3, difficulty: baseDifficulty },
        { label: "Set 2", problems: 3, difficulty: baseDifficulty },
        { label: "Set 3", problems: 3, difficulty: baseDifficulty },
      ],
      prepNotes: [
        "Prepare 9 required problems (3 sets x 3 reps).",
        "Focus on independent starts and full step sequence.",
        "Difficulty guidance: keep all problems at Simple/Normal level.",
        "For Independent Execution, also prepare one fresh equivalent same-form, normal-difficulty reserve problem before the session. It is contingency inventory only for an objective technical timing failure and is not an extra rep or a way to replace student performance.",
      ],
    };
  }

  if (prepPhase === "Controlled Discomfort") {
    const highIntensity =
      prepStability === "Medium" || prepStability === "High" || prepStability === "High Maintenance";
    return {
      drillType: prepDrillType,
      setPlans: [
        { label: "Set 1", problems: 3, difficulty: highIntensity ? "Hard" : baseDifficulty },
        { label: "Set 2", problems: 3, difficulty: highIntensity ? "Challenging (but solvable)" : baseDifficulty },
        { label: "Set 3", problems: 3, difficulty: highIntensity ? "Challenging (but solvable)" : baseDifficulty },
      ],
      prepNotes: [
        "Prepare 9 total problems with controlled challenge increase.",
        "No rescue beyond first-step guidance.",
      ],
    };
  }

  return {
    drillType: `${prepPhase} Drill`,
    setPlans: [
      { label: "Set 1", problems: 3, difficulty: "Simple/Normal · same form" },
      { label: "Set 2", problems: 3, difficulty: "Simple/Normal · same form" },
      { label: "Set 3", problems: 3, difficulty: "Simple/Normal · same form" },
    ],
    prepNotes: [
      "Prepare 9 required TPS problems. Mathematical difficulty stays normal and problem form stays comparable; the pressure variable is the individualized timer.",
      "Prepare one fresh equivalent reserve problem for each timed set before the session (3 reserve problems total). Reserve problems are contingency inventory, not extra reps and not a completion target.",
      "A reserve problem may fill an unresolved canonical evidence slot only after an objective timer/runtime/device failure. Timeout, panic, wrong method, incomplete work, or weak performance remains real evidence and never unlocks a replacement.",
      "Keep pressure controlled and preserve structure over speed. The runner owns the Timer Contract.",
    ],
  };
}

function stabilityPercent(stability: StabilityLabel): number {
  if (stability === "High Maintenance") return 100;
  if (stability === "High") return 90;
  if (stability === "Medium") return 64;
  return 32;
}

function stabilityTone(stability: StabilityLabel): string {
  if (stability === "High Maintenance") return "bg-blue-50 text-blue-700 border-blue-200";
  if (stability === "High") return "bg-green-50 text-green-700 border-green-200";
  if (stability === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-600 border-red-200";
}

export function parseObservation(session: TutorSessionRecord): {
  topic: string;
  phase: PhaseLabel;
  stability: StabilityLabel;
  date: string;
  rawNote: string;
} | null {
  const noteText = String(session.notes || "");
  const methodText = String(session.methodNotes || "");
  const responseText = String(session.studentResponse || "");

  const topicFromNotes = noteText.match(/Active Topic:\s*([^\n\r]+)/i)?.[1]?.trim();
  const topicFromMethod = methodText.match(/Active Topic:\s*(.+)$/i)?.[1]?.trim();

  const phaseFromNotes = noteText.match(/Phase Observed in Session:\s*([^\n\r]+)/i)?.[1]?.trim();
  const phaseFromResponse = responseText.match(/Phase:\s*([^|\n\r]+)/i)?.[1]?.trim();

  const stabilityFromNotes = noteText.match(/Stability Observed in Session:\s*([^\n\r]+)/i)?.[1]?.trim();
  const stabilityFromResponse = responseText.match(/Stability:\s*([^|\n\r]+)/i)?.[1]?.trim();

  const topic = sanitizeTopic(topicFromMethod || topicFromNotes);
  const phase = normalizePhase(phaseFromNotes || phaseFromResponse || "Structured Execution");
  const stability = normalizeStability(stabilityFromNotes || stabilityFromResponse || "Low");

  if (!topic) return null;

  return {
    topic,
    phase,
    stability,
    date: session.date,
    rawNote: noteText,
  };
}

export function formatLastUpdatedLabel(dateText?: string): string {
  if (!dateText) return "Not updated";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "Not updated";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSessionDateTimeLabel(dateText?: string): string {
  if (!dateText) return "Time unavailable";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildTopics(
  parentTopics: string | null | undefined,
  map: TopicConditioningMap | null | undefined,
  persistedTopicStates: StudentTopicConditioningDialogProps["persistedTopicStates"],
  sessions: TutorSessionRecord[] | undefined,
  parentTopicSymptoms?: Record<string, string[]> | null,
  parentTopicRecommendations?: Record<string, { phase?: string | null; supportingSymptoms?: string[]; rationale?: string | null }> | null,
): TopicRow[] {
  const byTopic = new Map<
    string,
    {
      history: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel; note: string; kind: ObservationKind }>;
      seeded?: { phase: PhaseLabel; stability: StabilityLabel; progressionAuthority?: "building" | "exit_confirmation_eligible" | "transfer_maintenance" | null };
      requiresTargetedRediagnosis?: boolean;
      targetedRediagnosisStartPhase?: PhaseLabel | null;
      systemNextAction?: string | null;
      prerequisiteContradictionReason?: string | null;
      parentReported?: boolean;
      parentReportedSymptoms?: string[];
      parentRecommendedPhase?: string | null;
    }
  >();


  const persistedEntries = persistedTopicStates && typeof persistedTopicStates === "object"
    ? Object.values(persistedTopicStates)
    : [];

  persistedEntries.forEach((entry: any) => {
    const persistedTopic = sanitizeTopic(entry?.topic || "");
    if (!persistedTopic) return;

    const existing = byTopic.get(persistedTopic) || { history: [] as any[] };
    const mergedHistory = [...(existing.history || [])];

    const persistedHistory = Array.isArray(entry?.history) ? entry.history : [];
    persistedHistory.forEach((h: any) => {
      if (!h?.date) return;
      mergedHistory.push({
        date: String(h.date),
        phase: normalizePhase(h.phase),
        stability: normalizeStability(h.stability),
        note: h?.observationNotes ? `Observation Notes: ${String(h.observationNotes)}` : "",
        kind:
          String(h?.structuredObservation?.drillType || h?.kind || "").trim().toLowerCase() === "training"
            ? "training"
            : String(h?.structuredObservation?.drillType || h?.kind || "").trim().toLowerCase() === "diagnosis"
              ? "diagnosis"
              : "observation",
      });
    });

    byTopic.set(persistedTopic, {
      history: mergedHistory,
      seeded: {
        phase: normalizePhase(entry?.phase || map?.entry_phase),
        stability: normalizeStability(entry?.stability || map?.stability),
        progressionAuthority: ["building", "exit_confirmation_eligible", "transfer_maintenance"].includes(String(entry?.progressionAuthority || ""))
          ? entry.progressionAuthority
          : null,
      },
      requiresTargetedRediagnosis: entry?.requiresTargetedRediagnosis === true,
      targetedRediagnosisStartPhase: entry?.targetedRediagnosisStartPhase
        ? normalizePhase(entry.targetedRediagnosisStartPhase)
        : null,
      systemNextAction: String(entry?.nextAction || "").trim() || null,
      prerequisiteContradictionReason:
        String(entry?.prerequisiteContradictionReason || "").trim() || null,
    });
  });

  const observations = (sessions || [])
    .map(parseObservation)
    .filter((item): item is NonNullable<ReturnType<typeof parseObservation>> => !!item)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasPersistedHistory = persistedEntries.some(
    (entry: any) => Array.isArray(entry?.history) && entry.history.length > 0,
  );

  observations.forEach((obs) => {
    // Prefer persisted topic history; only parse raw notes as fallback for unseen topics
    if (hasPersistedHistory && byTopic.has(obs.topic)) return;

    if (!byTopic.has(obs.topic)) {
      byTopic.set(obs.topic, { history: [] });
    }
    byTopic.get(obs.topic)?.history.push({
      date: obs.date,
      phase: obs.phase,
      stability: obs.stability,
      note: obs.rawNote,
      kind: "observation",
    });
  });

  // Parent reports remain separate from the active Map until a diagnosis or
  // explicit Specialist activation exists. Overlay the report on an existing
  // persisted seed as well, rather than losing it merely because a seed exists.
  splitTopics(parentTopics).forEach((rawTopic) => {
    const topic = sanitizeTopic(rawTopic);
    const topicKey = normalizeTopicKey(topic);
    if (!topic || !topicKey) return;
    const symptomEntry = Object.entries(parentTopicSymptoms || {}).find(([key]) => normalizeTopicKey(key) === topicKey);
    const recommendationEntry = Object.entries(parentTopicRecommendations || {}).find(([key]) => normalizeTopicKey(key) === topicKey);
    const recommendation = recommendationEntry?.[1];
    const symptoms = Array.isArray(symptomEntry?.[1]) ? symptomEntry[1].map((item) => String(item).trim()).filter(Boolean)
      : Array.isArray(recommendation?.supportingSymptoms) ? recommendation.supportingSymptoms.map((item) => String(item).trim()).filter(Boolean) : [];
    const recommendedPhase = String(recommendation?.phase || "").trim() || null;
    const existingTopic = [...byTopic.keys()].find((existing) => normalizeTopicKey(existing) === topicKey);
    if (existingTopic) {
      const existing = byTopic.get(existingTopic)!;
      byTopic.set(existingTopic, {
        ...existing,
        parentReported: true,
        parentReportedSymptoms: symptoms,
        parentRecommendedPhase: recommendedPhase,
      });
      return;
    }
    byTopic.set(topic, { history: [], seeded: { phase: normalizePhase(recommendedPhase), stability: "Low" }, parentReported: true, parentReportedSymptoms: symptoms, parentRecommendedPhase: recommendedPhase });
  });

  const rows: TopicRow[] = [];

  byTopic.forEach((entry, topic) => {
    const history = [...entry.history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const latest = history[history.length - 1];
    const hasObservedState = history.length > 0;
    // An explicit canonical progression record supersedes older session-history
    // labels. History stays available but does not overwrite the current state.
    const explicitAuthority = entry.seeded?.progressionAuthority != null;
    const phase = (explicitAuthority ? entry.seeded?.phase : latest?.phase) || entry.seeded?.phase || "Structured Execution";
    const stability = (explicitAuthority ? entry.seeded?.stability : latest?.stability) || entry.seeded?.stability || "Low";
    const progressionAuthority = entry.seeded?.progressionAuthority ?? null;
    const lastSessionDate = latest?.date;

    const formatRelativeObservationLabel = (index: number, kind: ObservationKind) => {
      const unit =
        kind === "training"
          ? "training session"
          : kind === "diagnosis"
            ? "diagnosis"
            : "observation";
      const prefix =
        index === 0
          ? "Last"
          : index === 1
            ? "2nd last"
            : index === 2
              ? "3rd last"
              : `${index + 1}th last`;
      return `${prefix} ${unit}`;
    };
    const recentLogs = history
      .slice(-3)
      .reverse()
      .map((h, index) => {
        const label = formatRelativeObservationLabel(index, h.kind);
        return `${label} (${formatSessionDateTimeLabel(h.date)}): ${displayTopicStability(h.stability)} stability${topicStabilityConfirmationLabel(h.stability, h.phase) ? " · Confirmation checkpoint" : ""}`;
      });

    rows.push({
      topic,
      phase,
      stability,
      progressionAuthority,
      hasObservedState,
      requiresTargetedRediagnosis: entry.requiresTargetedRediagnosis === true,
      targetedRediagnosisStartPhase: entry.targetedRediagnosisStartPhase || null,
      systemNextAction: entry.systemNextAction || null,
      prerequisiteContradictionReason: entry.prerequisiteContradictionReason || null,
      stateSource: hasObservedState ? "observed" : "seeded",
      lastSession: formatLastUpdatedLabel(lastSessionDate),
      trend: trendFromHistory(
        history.map((h) => h.stability),
        history.map((h) => h.phase),
      ),
      entryDiagnosis:
        history.length > 0
…24810 tokens truncated…ession."
                                        );
                                      }
                                    }}
                                    disabled={confirmTrainingSession.isPending || respondTrainingSession.isPending}
                                  >
                                    {isConfirmingTrainingSession(session.id) ? "Confirming..." : "Confirm Date"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTrainingSessionId((current) => current === session.id ? null : session.id);
                                      setAdjustedTrainingSessionTime(new Date(session.scheduled_time).toISOString().slice(0, 16));
                                    }}
                                    disabled={confirmTrainingSession.isPending || respondTrainingSession.isPending}
                                  >
                                    Adjust
                                  </Button>
                                </div>
                              </div>
                              {editingTrainingSessionId === session.id ? (
                                <div className="rounded border border-border bg-muted/40 px-3 py-2 space-y-2">
                                  <Input
                                    type="datetime-local"
                                    value={adjustedTrainingSessionTime}
                                    onChange={(e) => setAdjustedTrainingSessionTime(e.target.value)}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const result = await respondTrainingSession.mutateAsync({
                                            sessionId: session.id,
                                            action: "reschedule",
                                            scheduledStart: new Date(adjustedTrainingSessionTime).toISOString(),
                                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg",
                                          });
                                          setTrainingSessionMeetMessage(
                                            result?.googleMeetError || "Specialist sent a new time to the parent for confirmation."
                                          );
                                          setEditingTrainingSessionId(null);
                                          setAdjustedTrainingSessionTime("");
                                        } catch (error) {
                                          setTrainingSessionMeetMessage(
                                            error instanceof Error ? error.message : "Failed to adjust training session."
                                          );
                                        }
                                      }}
                                      disabled={!adjustedTrainingSessionTime || respondTrainingSession.isPending}
                                    >
                                      {respondTrainingSession.isPending ? "Sending..." : "Send New Time"}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("attached") ? "text-green-700" : "text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {pendingTrainingConfirmationSession ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                        <p className="font-medium text-amber-900">Awaiting parent confirmation</p>
                        <p className="text-amber-800">{formatLessonTime(pendingTrainingConfirmationSession.scheduled_time)}</p>
                        <p className="text-amber-800">
                          The parent must confirm this weekly lesson before training can launch.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {!assignmentAccepted && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      This student is assigned to you, but training access stays locked until you accept the assignment.
                    </div>
                  )}
                  {latestCompletedTrainingSession ? (
                    <div className="rounded-md border border-border/70 bg-background p-3 text-sm space-y-2">
                      <div>
                        <div>
                          <p className="font-medium text-foreground">Latest Completed Lesson</p>
                          <p className="text-muted-foreground">{formatLessonTime(latestCompletedTrainingSession.scheduled_time, latestCompletedTrainingSession.timezone)}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    Topic selection happens inside <span className="font-medium text-foreground">Start Session</span>. Use the <span className="font-medium text-foreground">Map</span> tab to review active topics and activate new ones.
                  </div>
                </div>
                ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Training Operations</h4>
                    {activeTrainingSession ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSessionTopicsModalOpen(true)}
                        disabled={!assignmentAccepted || !canonicalTopicStateReady}
                        title={
                          !assignmentAccepted
                            ? "Accept the assignment before running training sessions."
                            : !canonicalTopicStateReady
                              ? canonicalTopicStateError
                                ? "Live topic state could not be verified. Refresh before starting this lesson."
                                : "Refreshing live topic state before this lesson can start."
                              : undefined
                        }
                      >
                        Start Session
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Response Integrity Lesson Wrapper</p>
                        <p className="text-xs text-muted-foreground">
                          Training drills must launch inside a scheduled Response Integrity lesson.
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {`Parent books the package's ${weeklySessionTargetLabel} in the Sessions tab.`}
                      </div>
                    </div>
                    {activeTrainingSession ? (
                      <div className="rounded border border-primary/20 bg-background px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-foreground">Launch-ready lesson</p>
                        <p className="text-muted-foreground">{formatLessonTime(activeTrainingSession.scheduled_time)}</p>
                        {activeTrainingSession.google_meet_url ? (
                          <a
                            href={activeTrainingSession.google_meet_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-primary underline underline-offset-2"
                          >
                            Join Meet
                          </a>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-muted-foreground">Meet link pending calendar sync.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const result = await retryMeetSync.mutateAsync({ sessionId: activeTrainingSession.id });
                                  setTrainingSessionMeetMessage(
                                    result?.googleMeetError ||
                                    (result?.googleMeetSync === "google_calendar"
                                      ? "Google Meet synced to the lesson."
                                      : "Meet sync retried.")
                                  );
                                } catch (error) {
                                  setTrainingSessionMeetMessage(
                                    error instanceof Error ? error.message : "Failed to retry Meet sync."
                                  );
                                }
                              }}
                              disabled={retryMeetSync.isPending}
                            >
                              {retryMeetSync.isPending ? "Syncing..." : "Retry Meet Sync"}
                            </Button>
                          </div>
                        )}
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("created") ? "text-green-700" : "text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground">
                          Start Session unlocks topic selection for this lesson.
                        </p>
                      </div>
                    ) : null}
                    {pendingTutorConfirmationSessions.length > 0 ? (
                      <div className="rounded border border-border bg-muted/40 px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-foreground">Awaiting Specialist confirmation</p>
                        <p className="text-muted-foreground">
                          {isSandboxMode
                            ? `The parent has proposed this week's training lessons. Confirm all ${weeklySessionTargetLabel} before the lessons are ready.`
                            : `The parent has proposed this week's training lessons. Confirm all ${weeklySessionTargetLabel} before Meet links are created.`}
                        </p>
                        <div className="space-y-2">
                          {pendingTutorConfirmationSessions.map((session: any) => (
                            <div key={session.id} className="rounded border border-border bg-background px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{formatLessonTime(session.scheduled_time, session.timezone)}</p>
                                  <p className="text-muted-foreground">Status: waiting for Specialist confirmation</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        const result = await confirmTrainingSession.mutateAsync({ sessionId: session.id });
                                        setTrainingSessionMeetMessage(
                                          result?.googleMeetError ||
                                          (result?.googleMeetSync === "google_calendar"
                                            ? "Specialist confirmed. Google Meet attached to the lesson."
                                            : "Specialist confirmed the lesson.")
                                        );
                                      } catch (error) {
                                        setTrainingSessionMeetMessage(
                                          error instanceof Error ? error.message : "Failed to confirm training session."
                                        );
                                      }
                                    }}
                                    disabled={confirmTrainingSession.isPending || respondTrainingSession.isPending}
                                  >
                                    {isConfirmingTrainingSession(session.id) ? "Confirming..." : "Confirm Date"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTrainingSessionId((current) => current === session.id ? null : session.id);
                                      setAdjustedTrainingSessionTime(new Date(session.scheduled_time).toISOString().slice(0, 16));
                                    }}
                                    disabled={confirmTrainingSession.isPending || respondTrainingSession.isPending}
                                  >
                                    Adjust
                                  </Button>
                                </div>
                              </div>
                              {editingTrainingSessionId === session.id ? (
                                <div className="rounded border border-border bg-muted/40 px-3 py-2 space-y-2">
                                  <Input
                                    type="datetime-local"
                                    value={adjustedTrainingSessionTime}
                                    onChange={(e) => setAdjustedTrainingSessionTime(e.target.value)}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          const result = await respondTrainingSession.mutateAsync({
                                            sessionId: session.id,
                                            action: "reschedule",
                                            scheduledStart: new Date(adjustedTrainingSessionTime).toISOString(),
                                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg",
                                          });
                                          setTrainingSessionMeetMessage(
                                            result?.googleMeetError || "Specialist sent a new time to the parent for confirmation."
                                          );
                                          setEditingTrainingSessionId(null);
                                          setAdjustedTrainingSessionTime("");
                                        } catch (error) {
                                          setTrainingSessionMeetMessage(
                                            error instanceof Error ? error.message : "Failed to adjust training session."
                                          );
                                        }
                                      }}
                                      disabled={!adjustedTrainingSessionTime || respondTrainingSession.isPending}
                                    >
                                      {respondTrainingSession.isPending ? "Sending..." : "Send New Time"}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("attached") ? "text-green-700" : "text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {pendingTrainingConfirmationSession ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                        <p className="font-medium text-amber-900">Awaiting parent confirmation</p>
                        <p className="text-amber-800">{formatLessonTime(pendingTrainingConfirmationSession.scheduled_time)}</p>
                        <p className="text-amber-800">
                          The parent must confirm this lesson before Meet is attached and drills can launch.
                        </p>
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("created") ? "text-green-700" : "text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {nextTrainingSession ? (
                      <div className="rounded border border-border/60 bg-background px-3 py-2 text-xs space-y-1">
                        <p className="font-medium text-foreground">Next scheduled lesson</p>
                        <p className="text-muted-foreground">{formatLessonTime(nextTrainingSession.scheduled_time)}</p>
                        <p className="text-muted-foreground">
                          This lesson is outside the live/imminent launch window.
                        </p>
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("created") ? "text-green-700" : "text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {!activeTrainingSession && pendingTutorConfirmationSessions.length === 0 && !pendingTrainingConfirmationSession && !nextTrainingSession && confirmedTrainingSessions.length === 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {`No Response Integrity training lesson is attached yet. The parent must schedule the package's ${weeklySessionTargetLabel} in the Sessions tab.`}
                        </p>
                        {trainingSessionMeetMessage ? (
                          <p className={trainingSessionMeetMessage.includes("created") ? "text-xs text-green-700" : "text-xs text-red-600"}>
                            {trainingSessionMeetMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {!assignmentAccepted && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      This student is assigned to you, but training access stays locked until you accept the assignment.
                    </div>
                  )}
                  {latestCompletedTrainingSession ? (
                    <div className="rounded-md border border-border/70 bg-background p-3 text-sm space-y-2">
                      <div>
                        <div>
                          <p className="font-medium text-foreground">Latest Completed Lesson</p>
                          <p className="text-muted-foreground">{formatLessonTime(latestCompletedTrainingSession.scheduled_time, latestCompletedTrainingSession.timezone)}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    Topic selection now happens inside <span className="font-medium text-foreground">Start Session</span> after a confirmed lesson is available.
                    Use the <span className="font-medium text-foreground">Map</span> tab to review active topics and activate new ones.
                  </div>
                </div>
                )
              ) : (
                <div className="text-sm text-muted-foreground">No active topics. Activate a topic to begin.</div>
              )}
            </Card>

            <Dialog
              open={sessionTopicsModalOpen}
              onOpenChange={(open) => {
                setSessionTopicsModalOpen(open);
                if (open) {
                  // Never carry an earlier lesson's confirmation into a new one.
                  setSessionPrepChecks({});
                  setSandboxPreparationError(null);
                  // Pre-populate with activated topics
                  const activatedTopics = new Set<string>(activationTopics.map((t) => t.topic));
                  setSelectedSessionTopics(activatedTopics);
                } else {
                  setSelectedSessionTopics(new Set<string>());
                }
              }}
            >
              <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Start Session</DialogTitle>
                  <DialogDescription>
                    Select the topics for this lesson. Up to two unobserved topics can complete entry diagnosis sequentially in one Intro Session. Topics with a prerequisite contradiction require targeted re-diagnosis on their own before returning to ordinary Training.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose the topics you want to cover. One or two unobserved topics launch sequential entry diagnosis. A topic flagged by a prerequisite sentinel launches targeted re-diagnosis on its own. Ordinary observed topics launch Training.
                  </p>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {sessionEligibleTopics.map((topic) => (
                      <div key={topic.topic} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`session-topic-${topic.topic}`}
                          checked={selectedSessionTopics.has(topic.topic)}
                          onChange={(e) => {
                            const newSet = new Set(selectedSessionTopics);
                            if (e.target.checked) {
                              newSet.add(topic.topic);
                            } else {
                              newSet.delete(topic.topic);
                            }
                            setSelectedSessionTopics(newSet);
                          }}
                          className="rounded border-gray-300"
                        />
                        <label
                          htmlFor={`session-topic-${topic.topic}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {topic.topic} ({topic.requiresTargetedRediagnosis
                            ? `Re-Diagnosis Required - ${topic.targetedRediagnosisStartPhase || topic.phase}`
                            : topic.hasObservedState
                              ? `${topic.phase} - ${displayTopicStability(topic.stability)}${topicStabilityConfirmationLabel(topic.stability, topic.phase) ? " (confirmation required)" : ""}`
                              : "Unobserved - Diagnosis First"})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedSessionRediagnosisTopics.length > 0 && selectedSessionPrepPlans.length > 1 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {selectedSessionRediagnosisTopics[0].topic} is locked for targeted re-diagnosis. Run that topic by itself before combining it with ordinary Training topics.
                  </div>
                ) : null}

                {selectedSessionUnknownTopics.length > 1 &&
                selectedSessionUnknownTopics.length === selectedSessionPrepPlans.length &&
                selectedSessionUnknownTopics.length <= 2 ? (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                    These topics will complete entry diagnosis sequentially in the same Intro Session. Each topic is saved before the next begins.
                  </div>
                ) : null}
                {selectedSessionUnknownTopics.length > 2 &&
                selectedSessionUnknownTopics.length === selectedSessionPrepPlans.length ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Intro diagnosis supports up to two unobserved topics per session. Select two or fewer.
                  </div>
                ) : null}

                {selectedSessionUnknownTopics.length === 1 && selectedSessionPrepPlans.length > 1 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {selectedSessionUnknownTopics[0].topic} is still unobserved. Run diagnosis first before combining it with training topics.
                  </div>
                ) : null}

                {selectedSessionPrepPlans.length > 0 ? (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
                    <p className="text-sm font-medium">Prep Rules For Selected Topics</p>
                    {sandboxTrainingPreparationRequired && sandboxMapPreparationQuery.isPending ? (
                      <p className="text-xs text-muted-foreground">Loading the current Sandbox prescription...</p>
                    ) : null}
                    {sandboxTrainingPreparationRequired && sandboxMapPreparationQuery.isError ? (
                      <p role="alert" className="text-xs text-destructive">
                        The prescribed Sandbox conditions are unavailable. Launch remains blocked until they can be verified.
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Review the exact drill load before you enter the lesson. Each selected topic still needs its own problem prep and explicit Specialist confirmation before launch.
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {selectedSessionPrepPlans.map(({
                        topic,
                        phase,
                        stability,
                        hasObservedState,
                        requiresTargetedRediagnosis,
                        targetedRediagnosisStartPhase,
                        prepPlan,
                      }) => (
                        <div key={`session-prep-${topic}`} className="rounded-md border border-primary/20 bg-background p-3 space-y-2">
                          <div>
                            <p className="font-medium text-sm">{topic}</p>
                            {sandboxTargetedPreparationRequired ? (
                              <p className="text-xs font-medium text-amber-800">
                                Sandbox requires targeted re-diagnosis before this topic can resume Training.
                              </p>
                            ) : requiresTargetedRediagnosis ? (
                              <>
                                <p className="text-xs font-medium text-amber-800">
                                  Targeted re-diagnosis required · starting signal {targetedRediagnosisStartPhase}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Current state is held at {phase} · {displayTopicStability(stability)} until evidence-native re-diagnosis establishes the trustworthy entry state.
                                </p>
                              </>
                            ) : !hasObservedState ? (
                              <p className="text-xs text-muted-foreground">Unobserved topic · diagnosis-first placement</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {phase} · {displayTopicStability(stability)}
                                {topicStabilityConfirmationLabel(stability, phase) ? " · Confirmation required" : ""}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              {requiresTargetedRediagnosis || sandboxTargetedPreparationRequired ? "Re-Diagnosis Prep" : prepPlan.drillType}
                            </p>
                          </div>
                          {sandboxTargetedPreparationRequired ? (
                            <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
                              <p>Prepare only the current system-selected evidence opportunity in the runner. Do not prepare or run the historical Training set shown on the Map.</p>
                              <p>Follow the displayed probe conditions without teaching, cueing, rescuing, or adding difficulty or pressure unless the probe requires it. Prepare another comparable problem only if the system selects another opportunity.</p>
                            </div>
                          ) : sandboxTrainingPreparationRequired &&
                            sandboxMapPreparationQuery.data?.captureActive &&
                            sandboxMapPreparationQuery.data.status === "rep_ready" ? (
                            <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
                              <p className="font-medium">
                                Current Sandbox prescription: {sandboxMapPreparationQuery.data.prescribedPhase}
                              </p>
                              <p className="text-muted-foreground">
                                These are the actual system-prescribed sets for this confirmed lesson.
                                They replace any historical Map projection; no simulated student response is shown.
                              </p>
                              <ul className="space-y-2">
                                {(sandboxMapPreparationQuery.data.sets || []).map(set => (
                                  <li key={set.setId}>
                                    <p className="font-medium">{set.setName}: {set.reps} problems
                                      {set.modelingOnly ? " (modeling, not scored evidence)" : ""}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {Object.entries(set.constraints).map(([name, value]) =>
                                        `${name.replaceAll("_", " ")}: ${String(value)}`).join(" · ")}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {prepPlan.setPlans.map((setPlan) => (
                                  <li key={`${topic}-${setPlan.label}`}>
                                    {setPlan.label}: {setPlan.problems} problems · {setPlan.difficulty}
                                  </li>
                                ))}
                              </ul>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Prep Rules</p>
                                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {prepPlan.prepNotes.map((note) => (
                                    <li key={`${topic}-prep-note-${note}`} className="flex items-start gap-1.5">
                                      <span className="mt-0.5 shrink-0 text-foreground/40">•</span>
                                      <span>{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          )}
                          <label className="flex items-start gap-2 rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground">
                            <input
                              type="checkbox"
                              checked={!!sessionPrepChecks[`session-prep-${topic}`]}
                              onChange={(e) =>
                                setSessionPrepChecks((current) => ({
                                  ...current,
                                  [`session-prep-${topic}`]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 rounded border-gray-300"
                            />
                            <span>
                              {sandboxTargetedPreparationRequired ? (
                                <>
                                  I reviewed that Sandbox requires targeted re-diagnosis for <span className="font-medium">{topic}</span>. I will prepare only the system-selected evidence opportunity in the runner and preserve its displayed conditions.
                                </>
                              ) : sandboxTrainingPreparationRequired &&
                                sandboxMapPreparationQuery.data?.captureActive &&
                                sandboxMapPreparationQuery.data.status === "rep_ready" ? (
                                <>
                                  I have prepared the prescribed Sandbox problems and reviewed the exact
                                  conditions above for <span className="font-medium">{topic}</span>.
                                  I understand what to observe and how to record evidence without prompting,
                                  manufacturing, or replacing the student's actual response.
                                </>
                              ) : requiresTargetedRediagnosis ? (
                                <>
                                  I prepared only the current system-selected evidence opportunity for <span className="font-medium">{topic}</span>, and I will preserve the displayed diagnosis conditions without teaching, cueing, rescuing, or adding constraints unless the system asks for them.
                                </>
                              ) : (
                                <>
                                  I prepared the prescribed drill set for <span className="font-medium">{topic}</span>, reviewed the support, pressure, difficulty, timing and evidence-recording conditions, and am ready to run this lesson.
                                </>
                              )}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {sandboxPreparationError ? (
                  <p role="alert" className="text-sm text-destructive">{sandboxPreparationError}</p>
                ) : null}
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    variant="outline"
                    onClick={() => {
                      setSessionTopicsModalOpen(false);
                      setSelectedSessionTopics(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleStartTrainingSession}
                    disabled={selectedSessionTopics.size === 0 || !sessionPrepChecklistComplete ||
                      sandboxPreparationPending ||
                      (sandboxTrainingPreparationRequired &&
                        (sandboxMapPreparationQuery.isPending || sandboxMapPreparationQuery.isError))}
                  >
                    {sandboxPreparationPending ? "Verifying preparation..." :
                      sandboxTrainingPreparationRequired && sandboxMapPreparationQuery.data?.captureActive &&
                      sandboxMapPreparationQuery.data.status === "rep_ready" ?
                        `${(sandboxMapPreparationQuery.data.completedReps ?? 0) > 0 ? "Resume" : "Start"} Sandbox Training (${selectedSessionTopics.size} topic)` :
                      sandboxTrainingPreparationRequired && sandboxMapPreparationQuery.data?.captureActive &&
                      sandboxMapPreparationQuery.data.status === "targeted_rediagnosis_required" ?
                        "Start Targeted Re-Diagnosis" :
                        `${selectedSessionStartLabel} (${selectedSessionTopics.size} topics)`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

          </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
