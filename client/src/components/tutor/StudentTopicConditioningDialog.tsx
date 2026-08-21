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
import { Target, AlertCircle, Info, ChevronDown, MoreHorizontal, X } from "lucide-react";
import { useStudentWorkflowState } from "@/hooks/useStudentWorkflowState";
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
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { PhaseLabel, StabilityLabel, TopicTrend } from "./topicConditioningEngine";
import { useConfirmTrainingSession, useRespondTrainingSession, useRetryScheduledSessionMeetSync, useTrainingSessions } from "@/hooks/useScheduledSession";
import { TrainingSessionCancellationDialog } from "@/components/scheduling/TrainingSessionCancellationDialog";
import {
  TUTOR_TRAINING_SESSION_CANCELLATION_REASONS,
  buildTrainingSessionCancellationNote,
} from "@/lib/trainingSessionCancellation";

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
  hasObservedState: boolean;
  stateSource: "observed" | "seeded" | "activated";
  lastSession: string;
  trend: TopicTrend;
  entryDiagnosis: string;
  recentLogs: string[];
  timeline: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel; kind: ObservationKind }>;
};

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
          { label: "Needed tutor to carry response", score: 0 },
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

interface StudentTopicConditioningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  studentGrade?: string | null;
  operationalMode?: "training" | "certified_live";
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
  if (phase === "Time Pressure Stability" && stability === "High Maintenance") return "Transfer Ready" as const;
  if (stability === "High Maintenance" && advanceTo) return "Advance Threshold Met" as const;
  if (stability === "High Maintenance") return "Maintain" as const;
  if (stability === "High") return "Maintenance Check" as const;
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
  const enteredMaintenance = !!options?.enteredMaintenanceCheckpoint;
  const firstObservationInCurrentPhase = !!options?.firstObservationInCurrentPhase;
  const requiresMaintenanceCheck = phase !== "Time Pressure Stability" && stability === "High Maintenance";
  const nextAction = requiresMaintenanceCheck ? nextActionFor(phase, "High") : nextActionFor(phase, stability);
  const rules = requiresMaintenanceCheck ? getNextActionData(phase, "High").rules : getNextActionData(phase, stability).rules;

  const tutorMeaningByPhase: Record<PhaseLabel, Record<StabilityLabel, string>> = {
    Clarity: {
      Low: "Student still needs foundational clarity before independent execution.",
      Medium: "Student grasps concepts but needs more practice for consistency.",
      High: "Student has clear understanding and is ready for structured execution practice.",
      "High Maintenance": "Student sustained high Clarity and is now ready to progress into Structured Execution.",
    },
    "Structured Execution": {
      Low: "Student can follow steps but needs consistency and independence building.",
      Medium: "Student executes steps mostly independently but struggles with consistency.",
      High: "Student executes steps independently and is ready to build resilience under difficulty.",
      "High Maintenance": "Student sustained high execution consistency and is ready to progress into Controlled Discomfort.",
    },
    "Controlled Discomfort": {
      Low: "Student struggles under difficulty but is building stability.",
      Medium: "Student handles difficulty with improving stability and consistency.",
      High: "Student handles difficulty with stability and is ready for time-pressure training.",
      "High Maintenance": "Student sustained high discomfort control and is ready to progress into Time Pressure Stability.",
    },
    "Time Pressure Stability": {
      Low: "Student needs to maintain structure and speed consistency under time.",
      Medium: "Student handles time pressure mostly but needs refinement.",
      High: "Student is stable under time pressure and maintains execution quality.",
      "High Maintenance": "Student sustained high time-pressure stability and is ready for mixed transfer work.",
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
    enteredMaintenance || requiresMaintenanceCheck
      ? ("Maintenance Check" as const)
      : deriveTransitionStatus(phase, stability, trend, {
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
  const drillType = `${phase} Drill`;

  if (!hasObservedState) {
    return {
      drillType: "Adaptive Diagnosis",
      setPlans: [
        { label: "Adaptive Diagnosis Set 1: Recognition Probe", problems: 3, difficulty: baseDifficulty },
        { label: "Adaptive Diagnosis Set 2: Light Apply Probe", problems: 3, difficulty: baseDifficulty },
      ],
      prepNotes: [
        "Prepare 6 total problems (2 sets x 3 reps).",
        "Use simple/normal versions only; no time pressure.",
        "Goal is adaptive diagnosis and first placement, not phase progression.",
        "Do not assume Clarity, Structured Execution, or any stability level before the first scored result.",
        "Difficulty guidance: keep all problems at Simple/Normal level.",
      ],
    };
  }

  if (phase === "Clarity") {
    return {
      drillType,
      setPlans: [
        { label: "Set 1: Modeling", problems: 2, difficulty: baseDifficulty },
        { label: "Set 2: Identification", problems: 3, difficulty: baseDifficulty },
        { label: "Set 3: Light Apply", problems: 3, difficulty: baseDifficulty },
      ],
      prepNotes: [
        "Set 1 is teaching only; no scored observations.",
        "Prepare 8 total problems (2 model + 6 drill reps).",
        "No boss battles and no timed pressure in Clarity.",
        "Difficulty guidance: keep all problems at Simple/Normal level.",
      ],
    };
  }

  if (phase === "Structured Execution") {
    return {
      drillType,
      setPlans: [
        { label: "Set 1", problems: 3, difficulty: baseDifficulty },
        { label: "Set 2", problems: 3, difficulty: baseDifficulty },
        { label: "Set 3", problems: 3, difficulty: baseDifficulty },
      ],
      prepNotes: [
        "Prepare 9 total problems (3 sets x 3 reps).",
        "Focus on independent starts and full step sequence.",
        "Difficulty guidance: keep all problems at Simple/Normal level.",
      ],
    };
  }

  if (phase === "Controlled Discomfort") {
    const highIntensity =
      stability === "Medium" || stability === "High" || stability === "High Maintenance";
    return {
      drillType,
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

  const timedIntensity = stability === "High" || stability === "High Maintenance";
  return {
    drillType,
    setPlans: [
      { label: "Set 1", problems: 3, difficulty: timedIntensity ? "Hard" : baseDifficulty },
      {
        label: "Set 2",
        problems: 3,
        difficulty: timedIntensity ? "Challenging (but solvable)" : baseDifficulty,
      },
      {
        label: "Set 3",
        problems: 3,
        difficulty: timedIntensity ? "Challenging (but solvable)" : baseDifficulty,
      },
    ],
    prepNotes: [
      "Prepare 9 total timed problems.",
      "Keep pressure controlled; preserve structure over speed.",
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
): TopicRow[] {
  const byTopic = new Map<
    string,
    {
      history: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel; note: string; kind: ObservationKind }>;
      seeded?: { phase: PhaseLabel; stability: StabilityLabel };
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
      },
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

  const rows: TopicRow[] = [];

  byTopic.forEach((entry, topic) => {
    const history = [...entry.history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const latest = history[history.length - 1];
    const hasObservedState = history.length > 0;
    const phase = latest?.phase || entry.seeded?.phase || "Structured Execution";
    const stability = latest?.stability || entry.seeded?.stability || "Low";
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
        return `${label} (${formatSessionDateTimeLabel(h.date)}): ${h.stability} stability`;
      });

    rows.push({
      topic,
      phase,
      stability,
      hasObservedState,
      stateSource: hasObservedState ? "observed" : "seeded",
      lastSession: formatLastUpdatedLabel(lastSessionDate),
      trend: trendFromHistory(
        history.map((h) => h.stability),
        history.map((h) => h.phase),
      ),
      entryDiagnosis:
        history.length > 0
          ? `Entered based on observed response pattern in logged sessions for ${topic.toLowerCase()}.`
          : `Seeded from enrollment/proposal focus for ${topic.toLowerCase()}.`,
      recentLogs,
      timeline: history.map((h) => ({
        date: new Date(h.date).toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
        phase: h.phase,
        stability: h.stability,
        kind: h.kind,
      })),
    });
  });

  return rows.sort((a, b) => a.topic.localeCompare(b.topic));
}
export { trendFromHistory };
const phaseDefinition: Record<PhaseLabel, string> = {
  Clarity:
    [
      "Description: The student learns to see the topic clearly. This means: naming the correct terms (Vocabulary), recognizing the problem type, knowing the steps (Method), knowing why the steps work (Reason).",
      "Tool: Teach 3-Layer Lens.",
      "Question: Can the student clearly see what they are dealing with in this topic? If no, this topic starts at Clarity."
    ].join("\n\n"),
  "Structured Execution":
    [
      "Description: The student must now execute inside the topic. This means: starting without delay, following steps in order, reducing guessing, repeating the method reliably.",
      "Tool: Independent execution reps, step-order correction, and 3-Layer Lens checks.",
      "Question: Can the student act reliably in this topic without being carried? If no, this topic sits in Structured Execution."
    ].join("\n\n"),
  "Controlled Discomfort":
    [
      "Description: Now difficulty is introduced inside the topic. This means: harder questions, unfamiliar forms, no rescue, first-step guidance only.",
      "Tool: Boss Battles.",
      "Question: Can the student stay stable in this topic when certainty disappears? If no, this topic sits in Controlled Discomfort."
    ].join("\n\n"),
  "Time Pressure Stability":
    [
      "Description: Now the same topic is tested under time. This means: timed attempts, process under pressure, structure maintained under urgency.",
      "Tool: Timed Execution.",
      "Question: Can the student stay structured in this topic when time pressure appears? If no, this topic stays in Time Pressure Stability."
    ].join("\n\n"),
};

export default function StudentTopicConditioningDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  studentGrade,
  operationalMode = "training",
  readOnly = false,
  mapOnly = false,
  apiBasePath = "/api/tutor",
  parentTopics,
  parentTopicSymptoms,
  parentTopicRecommendations,
  topicConditioning,
  persistedTopicStates,
}: StudentTopicConditioningDialogProps) {
  const navigate = useNavigate();
  const { data: workflow } = useStudentWorkflowState(studentId, apiBasePath, !readOnly);
  const assignmentAccepted = workflow?.assignmentAccepted ?? true;
  const isTrainingMode = operationalMode === "training";
  // Fetch topic activations for this student (must be inside component to access studentId)
  const { data: activationsData, refetch: refetchActivations } = useQuery({
    queryKey: [apiBasePath, "students", studentId, "topic-conditioning-activations"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `${apiBasePath}/students/${studentId}/topic-conditioning-activations`
      );
      return res.json();
    },
    enabled: !!studentId && !readOnly,
  });
  const queryClient = useQueryClient();
  // Mutation to add topic
  const addTopicMutation = useMutation({
    mutationFn: async ({ topic, reason }: { topic: string; reason: string }) => {
      if (readOnly) {
        throw new Error("Topic activation is disabled in read-only mode.");
      }

      const res = await apiRequest(
        "POST",
        `${apiBasePath}/students/${studentId}/topic-conditioning`,
        { topic, reason }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, "pod"] });
      queryClient.invalidateQueries({ queryKey: [apiBasePath, "students", studentId, "workflow-state"] });
    },
  });
  // Activation reasons for dropdown
  const ACTIVATION_REASONS = [
    "Observed breakdown in class",
    "Parent reported struggle",
    "Exam/test focus",
    "School topic requirement",
    "Other (enter note)"
  ];

  // State for Activate Topic dialog
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [activationReason, setActivationReason] = useState("");
  const [activationNote, setActivationNote] = useState("");
  const [activateError, setActivateError] = useState("");
  const [sessionTopicsModalOpen, setSessionTopicsModalOpen] = useState(false);
  const [selectedSessionTopics, setSelectedSessionTopics] = useState<Set<string>>(new Set());
  const [sessionPrepChecks, setSessionPrepChecks] = useState<Record<string, boolean>>({});
  const [trainingSessionMeetMessage, setTrainingSessionMeetMessage] = useState<string | null>(null);
  const [editingTrainingSessionId, setEditingTrainingSessionId] = useState<string | null>(null);
  const [adjustedTrainingSessionTime, setAdjustedTrainingSessionTime] = useState("");
  const { data: trainingSessionsData } = useTrainingSessions(studentId, !!workflow?.proposalAccepted);
  const confirmTrainingSession = useConfirmTrainingSession(studentId);
  const respondTrainingSession = useRespondTrainingSession(studentId);
  const retryMeetSync = useRetryScheduledSessionMeetSync(studentId);

  // Add topic handler
  const handleActivateTopic = async () => {
    if (!newTopic.trim()) {
      setActivateError("Topic is required");
      return;
    }
    if (!activationReason) {
      setActivateError("Reason is required");
      return;
    }
    const activationReasonFinal = activationReason === "Other (enter note)" ? activationNote.trim() : activationReason;
    if (activationReason === "Other (enter note)" && !activationNote.trim()) {
      setActivateError("Please enter a note for 'Other'");
      return;
    }
    try {
      await addTopicMutation.mutateAsync({ topic: newTopic.trim(), reason: activationReasonFinal });
      await refetchActivations();
      setActivateDialogOpen(false);
      setNewTopic("");
      setActivationReason("");
      setActivationNote("");
      setActivateError("");
    } catch (err: any) {
      if (err instanceof Error) {
        setActivateError(err.message);
      } else if (typeof err === "string") {
        setActivateError(err);
      } else {
        setActivateError("Failed to activate topic (unknown error)");
      }
      alert("Topic activation failed: " + (err?.message || JSON.stringify(err)));
    }
  };

  const launchTrainingSession = (sessionId?: string | null) => {
    const selectedTopics = Array.from(selectedSessionTopics);
    if (selectedTopics.length === 0) return;

    const selectedTopicStates = selectedTopics
      .map((topicName) => topics.find((topic) => topic.topic === topicName))
      .filter((topic): topic is TopicRow => !!topic);
    const unobservedTopics = selectedTopicStates.filter((topic) => !topic.hasObservedState);

    if (unobservedTopics.length > 1) {
      setTrainingSessionMeetMessage("Newly activated topics must be placed one at a time. Select a single unobserved topic and run diagnosis first.");
      return;
    }

    if (unobservedTopics.length === 1 && selectedTopicStates.length > 1) {
      setTrainingSessionMeetMessage(`Training session launch blocked. ${unobservedTopics[0].topic} has no observed state yet and must complete diagnosis before mixed-topic training.`);
      return;
    }

    if (selectedTopics.length === 1) {
      const topicState = topics.find((topic) => topic.topic === selectedTopics[0]);
      if (!topicState) return;
      const topicParam = encodeURIComponent(topicState.topic);
      const phaseParam = encodeURIComponent(topicState.phase);
      const stabilityParam = encodeURIComponent(topicState.stability);
      const sessionParam = sessionId ? `&scheduledSessionId=${encodeURIComponent(sessionId)}` : "";
      setSessionTopicsModalOpen(false);
      if (!topicState.hasObservedState) {
        navigate(`/tutor/intro-session/${studentId}?topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}&context=training${sessionParam}`);
        return;
      }
      navigate(`/tutor/intro-session/${studentId}?mode=training&topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}${sessionParam}`);
      return;
    }

    const topicsParam = selectedTopics.map((t) => encodeURIComponent(t)).join(',');
    const sessionParam = sessionId ? `&scheduledSessionId=${encodeURIComponent(sessionId)}` : "";
    setSessionTopicsModalOpen(false);
    navigate(`/tutor/intro-session/${studentId}?mode=session&topics=${topicsParam}${sessionParam}`);
  };

  const handleStartTrainingSession = () => {
    if (!assignmentAccepted) return;
    if (selectedSessionTopics.size === 0) return;
    const activeSession = activeTrainingSession;
    if (activeSession) {
      launchTrainingSession(activeSession.id);
      return;
    }
    const pendingParentSession = trainingSessionsData?.sessions?.find((session: any) => session.status === "pending_parent_confirmation");
    const pendingTutorSession = trainingSessionsData?.sessions?.find((session: any) => session.status === "pending_tutor_confirmation");
    if (pendingTutorSession) {
      setTrainingSessionMeetMessage("Two weekly lesson times are waiting for tutor confirmation. Confirm them before running drills.");
      setSessionTopicsModalOpen(false);
      return;
    }
    if (pendingParentSession) {
      setTrainingSessionMeetMessage("A training lesson is already waiting for parent confirmation. The lesson will unlock after the parent confirms it.");
      setSessionTopicsModalOpen(false);
      return;
    }
    if (!activeSession) {
      setTrainingSessionMeetMessage(
        isTrainingMode
          ? "No confirmed weekly training lesson is available yet. The parent must book the week's two training sessions in the Sessions tab first."
          : "No launch-ready lesson is scheduled. The parent must book the week's two training sessions in the Sessions tab first."
      );
      return;
    }
  };
  const { data: sessions } = useQuery<TutorSessionRecord[]>({
    queryKey: [apiBasePath, "sessions"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open && !!studentId && !readOnly,
    staleTime: 60000,
    refetchOnMount: false,
  });

  const studentSessions = useMemo(
    () => (sessions || []).filter((session) => session.studentId === studentId),
    [sessions, studentId],
  );

  // Merge activations into the topic list
  const activationTopics = useMemo(() => {
    if (!activationsData?.activations) return [];
    // Only include unique topic names, case-insensitively.
    const seen = new Set<string>();
    return activationsData.activations.filter((a: any) => {
      const t = normalizeTopicLabel(a?.topic);
      const topicKey = normalizeTopicKey(a?.topic);
      if (!t || !topicKey) return false;
      if (seen.has(topicKey)) return false;
      seen.add(topicKey);
      return true;
    }).map((a: any) => ({ topic: normalizeTopicLabel(a?.topic)!, activatedAt: a.created_at }));
  }, [activationsData]);

  const topics = useMemo(
    () => {
      // Build the normal topics
      const baseTopics = buildTopics(parentTopics, topicConditioning, persistedTopicStates, studentSessions);
      // Add any activation topics not already present, case-insensitively.
      const baseTopicNames = new Set(baseTopics.map((t) => normalizeTopicKey(t.topic)).filter(Boolean));
      const merged = [...baseTopics];
      activationTopics.forEach(({ topic, activatedAt }) => {
        const topicKey = normalizeTopicKey(topic);
        if (topicKey && !baseTopicNames.has(topicKey)) {
          merged.push({
            topic,
            phase: "Clarity",
            stability: "Low",
            hasObservedState: false,
            stateSource: "activated",
            lastSession: activatedAt ? formatLastUpdatedLabel(activatedAt) : "Activated",
            trend: "Stable",
            entryDiagnosis: "Activated by tutor.",
            recentLogs: [],
            timeline: [],
          });
          baseTopicNames.add(topicKey);
        }
      });
      return merged;
    },
    [parentTopics, topicConditioning, persistedTopicStates, studentSessions, activationTopics],
  );
  const [selectedTopic, setSelectedTopic] = useState<string>(topics[0]?.topic || "");

  const [activeTopicField, setActiveTopicField] = useState("");
  const [manualTopicField, setManualTopicField] = useState("");
  const [phaseObservedField, setPhaseObservedField] = useState("");
  const [stabilityObservedField, setStabilityObservedField] = useState("");
  // Persist in-progress selections per topic/phase for better UX
  const [phaseSelectionsMap, setPhaseSelectionsMap] = useState<Record<string, Record<string, string>>>({});
  const [phaseSelections, setPhaseSelections] = useState<Record<string, string>>({});
  const [interventionUsed, setInterventionUsed] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showFullSelectedTimeline, setShowFullSelectedTimeline] = useState(false);
  const [expandedPhaseDefinitions, setExpandedPhaseDefinitions] = useState<Set<PhaseLabel>>(new Set());
  const [isStabilityTrackerCollapsed, setIsStabilityTrackerCollapsed] = useState(true);
  const [isPhaseProgressionCollapsed, setIsPhaseProgressionCollapsed] = useState(true);
  const [isPhaseDefinitionsCollapsed, setIsPhaseDefinitionsCollapsed] = useState(true);
  const [cancelTrainingSessionTarget, setCancelTrainingSessionTarget] = useState<{
    id: string;
    scheduledTimeLabel: string;
  } | null>(null);

  // Initialize topic selection when dialog opens
  useEffect(() => {
    if (!open || topics.length === 0) return;
    if (!selectedTopic || !topics.some((t) => t.topic === selectedTopic)) {
      setSelectedTopic(topics[0].topic);
    }
  }, [open, topics.length, topics[0]?.topic, selectedTopic]);

  // Reset form state when dialog opens
  useEffect(() => {
    if (!open) return;
    const firstTopic = topics[0]?.topic || sanitizeTopic(splitTopics(parentTopics)[0]) || "";
    setActiveTab("dashboard");
    setActiveTopicField(firstTopic);
    setManualTopicField("");
    setPhaseSelections({});
    setInterventionUsed("");
    // Set phase and stability fields to match first topic
    setPhaseObservedField(topics[0]?.phase || normalizePhase(topicConditioning?.entry_phase));
    setStabilityObservedField(topics[0]?.stability || normalizeStability(topicConditioning?.stability));
    setExpandedPhaseDefinitions(new Set());
    setIsStabilityTrackerCollapsed(true);
    setIsPhaseProgressionCollapsed(true);
    setIsPhaseDefinitionsCollapsed(true);
  }, [open]);

  // When selectedTopic changes (Map tab), sync phase and stability fields
  useEffect(() => {
    const found = topics.find((t) => t.topic === selectedTopic);
    if (found) {
      setPhaseObservedField(found.phase);
      setStabilityObservedField(found.stability);
      setShowFullSelectedTimeline(false);
    }
  }, [selectedTopic, topics]);

  // When activeTopicField changes (Topic Management tab), sync phase and stability fields
  useEffect(() => {
    if (!activeTopicField) return;
    const found = topics.find((t) => t.topic === activeTopicField);
    if (found) {
      setPhaseObservedField(found.phase);
      setStabilityObservedField(found.stability);
      // Reset phaseSelections to last in-progress for this topic/phase, or empty
      const phaseKey = `${found.topic}::${found.phase}`;
      const nextPhaseSelections = phaseSelectionsMap[phaseKey] || {};
      const currentKeys = Object.keys(phaseSelections);
      const nextKeys = Object.keys(nextPhaseSelections);
      const selectionsChanged =
        currentKeys.length !== nextKeys.length ||
        nextKeys.some((key) => phaseSelections[key] !== nextPhaseSelections[key]);

      if (selectionsChanged) {
        setPhaseSelections(nextPhaseSelections);
      }
    }
  }, [activeTopicField, topics, phaseSelections, phaseSelectionsMap]);

  // Always use activeTopicField as the source of truth for Topic Management tab
  // When switching to session-form tab, ensure activeTopicField is set and in sync
  useEffect(() => {
    if (activeTab === "session-form") {
      // If no topic is selected, default to first topic
      if (!activeTopicField && topics.length > 0) {
        setActiveTopicField(topics[0].topic);
      }
    }
  }, [activeTab, activeTopicField, topics]);

  const topicChoices = useMemo(() => {
    const fromCards = topics.map((t) => t.topic);
    const fromParent = splitTopics(parentTopics).map((t) => sanitizeTopic(t)).filter((t): t is string => !!t);
    return Array.from(new Set([...fromCards, ...fromParent]));
  }, [topics, parentTopics]);
  const [dismissedParentTopics, setDismissedParentTopics] = useState<Set<string>>(new Set());
  const dismissedParentTopicKeys = useMemo(
    () => new Set(Array.from(dismissedParentTopics).map((topic) => normalizeTopicKey(topic)).filter(Boolean)),
    [dismissedParentTopics],
  );
  const activeParentTopicKeys = useMemo(
    () => new Set(topics.map((topic) => normalizeTopicKey(topic.topic)).filter(Boolean)),
    [topics],
  );
  const parentTopicIntelligence = useMemo(() => {
    const parentTopicNames = splitTopics(parentTopics).map((topic) => sanitizeTopic(topic)).filter((topic): topic is string => !!topic);
    return parentTopicNames.map((topic) => {
      const symptoms =
        parentTopicSymptoms && Array.isArray(parentTopicSymptoms[topic])
          ? parentTopicSymptoms[topic].map((symptom) => String(symptom).trim()).filter(Boolean)
          : [];
      const recommendation =
        parentTopicRecommendations && typeof parentTopicRecommendations[topic] === "object"
          ? parentTopicRecommendations[topic]
          : null;
      return {
        topic,
        symptoms,
        phase: recommendation?.phase ? normalizePhase(recommendation.phase) : null,
        rationale: String(recommendation?.rationale || "").trim(),
      };
    });
  }, [parentTopics, parentTopicSymptoms, parentTopicRecommendations]);
  const displayedParentTopicIntelligence = useMemo(
    () => parentTopicIntelligence.filter((entry) => !dismissedParentTopicKeys.has(normalizeTopicKey(entry.topic))),
    [dismissedParentTopicKeys, parentTopicIntelligence],
  );

  const handleDismissParentTopic = (topic: string) => {
    setDismissedParentTopics((previous) => {
      const next = new Set(previous);
      next.add(topic);
      return next;
    });
  };

  const prioritizedTopics = useMemo(
    () => [...topics].sort((a, b) => topicPriorityScore(b) - topicPriorityScore(a) || a.topic.localeCompare(b.topic)),
    [topics],
  );

  const attentionQueue = useMemo(() => {
    const needsAttention = prioritizedTopics.filter(
      (row) => (row.stability !== "High" && row.stability !== "High Maintenance") || row.trend === "Regressing",
    );
    return (needsAttention.length > 0 ? needsAttention : prioritizedTopics).slice(0, 3);
  }, [prioritizedTopics]);

  const needsStabilizationCount = prioritizedTopics.filter((row) => row.stability === "Low").length;
  const readyToAdvanceCount = prioritizedTopics.filter(
    (row) => !!getNextActionData(row.phase, row.stability).advanceTo,
  ).length;

  const selectedRow = topics.find((row) => row.topic === selectedTopic) || prioritizedTopics[0];
  const hasObservedSelection = !!selectedRow?.hasObservedState;
  const phaseIx = selectedRow && hasObservedSelection ? phaseIndex(selectedRow.phase) : -1;
  const guidance = selectedRow && hasObservedSelection
    ? actionGuidanceFor(selectedRow.phase, selectedRow.stability) : { doItems: [], avoidItems: [] };
  const effectiveTopicForLog = topics.length > 0
    ? activeTopicField || selectedRow?.topic || ""
    : sanitizeTopic(manualTopicField) || "";

  const selectedInterpretation = selectedRow && hasObservedSelection
    ? interpretTopicState(selectedRow.phase, selectedRow.stability, selectedRow.trend, {
        enteredMaintenanceCheckpoint: enteredMaintenanceCheckpoint(
          selectedRow.phase,
          selectedRow.stability,
          selectedRow.timeline,
        ),
        firstObservationInCurrentPhase: isFirstObservationInCurrentPhase(
          selectedRow.phase,
          selectedRow.timeline,
        ),
      })
    : null;

  const prepPlan = selectedRow
    ? tutorPrepPlanFor(selectedRow.phase, selectedRow.stability, hasObservedSelection)
    : null;
  const selectedTimeline = (selectedRow?.timeline || []).map((point, index) => ({
    ...point,
    _renderKey: `${selectedRow?.topic || "topic"}-${point.date}-${point.phase}-${point.stability}-${index}`,
  }));
  const toRelativeSessionLabel = (index: number, kind: ObservationKind = "observation") => {
    const unit =
      kind === "training"
        ? "training session"
        : kind === "diagnosis"
          ? "diagnosis"
          : "observation";
    if (index === 0) return `Last ${unit}`;
    if (index === 1) return `2nd last ${unit}`;
    if (index === 2) return `3rd last ${unit}`;
    return `${index + 1}th last ${unit}`;
  };
  const hasOlderSelectedTimeline = selectedTimeline.length > 6;
  const selectedTimelineToRender = showFullSelectedTimeline ? selectedTimeline : selectedTimeline.slice(-6);
  const selectedTimelineBadges = selectedTimelineToRender.slice().reverse();

  // Always use selectedRow for observedPhase and previousStability, fallback to safe defaults
  const observedPhase = (selectedRow && selectedRow.phase ? selectedRow.phase : "Clarity") as PhaseLabel;
  const previousStability = (selectedRow && selectedRow.stability ? selectedRow.stability : "Low") as StabilityLabel;
  const phaseConfig = PHASE_OBSERVATION_CONFIG[observedPhase] || PHASE_OBSERVATION_CONFIG["Clarity"];

  const sessionScore = clamp(
    0,
    phaseConfig.categories.reduce((sum, category) => {
      const selectedLabel = phaseSelections[category.key];
      const selectedOption = category.options.find((option) => option.label === selectedLabel);
      return sum + (selectedOption?.score ?? 0);
    }, 0),
    100
  );

  let projectedStability: StabilityLabel = previousStability;
  let advanceReady = false;

  if (previousStability === "Low") {
    if (sessionScore <= phaseConfig.thresholds.low.remainMax) projectedStability = "Low";
    else if (sessionScore <= phaseConfig.thresholds.low.mediumMax) projectedStability = "Medium";
    else projectedStability = "High";
  }

  if (previousStability === "Medium") {
    if (sessionScore <= phaseConfig.thresholds.medium.regressMax) projectedStability = "Low";
    else if (sessionScore <= phaseConfig.thresholds.medium.remainMax) projectedStability = "Medium";
    else projectedStability = "High";
  }

  if (previousStability === "High") {
    if (sessionScore <= phaseConfig.thresholds.high.regressMax) projectedStability = "Medium";
    else if (sessionScore <= phaseConfig.thresholds.high.remainMax) projectedStability = "High";
    else projectedStability = "High Maintenance";
  }

  if (previousStability === "High Maintenance") {
    if (sessionScore <= phaseConfig.thresholds.maintenance.regressMax) projectedStability = "High";
    else if (sessionScore <= phaseConfig.thresholds.maintenance.highMax) projectedStability = "High Maintenance";
    else {
      projectedStability = "Low";
      advanceReady = true;
    }
  }

  const nextPhase = getNextActionData(observedPhase, "High Maintenance").advanceTo;
  const projectedPhase: PhaseLabel =
    previousStability === "High Maintenance" && advanceReady && !!nextPhase
      ? (nextPhase as PhaseLabel)
      : observedPhase;

  let phaseDecision: "remain" | "advance" | "regress" | "improve" = "remain";
  if (projectedPhase !== observedPhase) {
    phaseDecision = "advance";
  } else {
    if (stabilityToScore(projectedStability) < stabilityToScore(previousStability)) {
      phaseDecision = "regress";
    } else if (stabilityToScore(projectedStability) > stabilityToScore(previousStability)) {
      phaseDecision = "improve";
    } else {
      phaseDecision = "remain";
    }
  }

  const projectedInterpretation = interpretTopicState(projectedPhase, projectedStability);
  const livePreviewConstraint = projectedInterpretation.rules[0] || "Follow phase rules and preserve structure.";

  // Block submission if any observation category is missing or mismatched for the current phase
  const foundTopic = topics.find(t => t.topic === activeTopicField);
  const phaseForValidation = foundTopic?.phase && PHASE_OBSERVATION_CONFIG[foundTopic.phase as PhaseLabel] ? foundTopic.phase as PhaseLabel : "Clarity";
  const configForValidation = PHASE_OBSERVATION_CONFIG[phaseForValidation];
  const canSubmitStructuredRecord =
    !!effectiveTopicForLog &&
    configForValidation.categories.every((category) => !!phaseSelections[category.key] && configForValidation.categories.some(c => c.key === category.key)) &&
    !!interventionUsed;

  const selectedSessionPrepPlans = Array.from(selectedSessionTopics)
    .map((topicName) => {
      const topicState = topics.find((topic) => topic.topic === topicName);
      if (!topicState) return null;
      return {
        topic: topicName,
        phase: topicState.hasObservedState ? topicState.phase : "Unknown",
        stability: topicState.hasObservedState ? topicState.stability : "Unknown",
        hasObservedState: topicState.hasObservedState,
        prepPlan: tutorPrepPlanFor(topicState.phase, topicState.stability, topicState.hasObservedState),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const selectedSessionUnknownTopics = selectedSessionPrepPlans.filter((entry) => !entry.hasObservedState);
  const selectedSessionStartLabel =
    selectedSessionUnknownTopics.length === 1 && selectedSessionPrepPlans.length === 1
      ? "Start Diagnosis"
      : "Start Session";
  const sessionPrepChecklistComplete =
    selectedSessionPrepPlans.length > 0 &&
    selectedSessionPrepPlans.every((entry) => !!sessionPrepChecks[`session-prep-${entry.topic}`]);
  const actionableTrainingSessions = (trainingSessionsData?.sessions || []).filter(
    (session: any) => !["completed", "cancelled", "flagged"].includes(String(session.status || "")),
  );
  const confirmedTrainingSessions = actionableTrainingSessions.filter(
    (session: any) => ["confirmed", "ready", "live"].includes(String(session.status || "")),
  );
  const pendingConfirmedMeetSyncSessions = confirmedTrainingSessions.filter(
    (session: any) => !session.google_meet_url,
  );
  const latestCompletedTrainingSession = [...(trainingSessionsData?.sessions || [])]
    .filter((session: any) => String(session.status || "") === "completed")
    .sort(
      (a: any, b: any) =>
        new Date(b.scheduled_time || b.updated_at || 0).getTime() -
        new Date(a.scheduled_time || a.updated_at || 0).getTime()
    )[0] || null;
  const pendingTutorConfirmationSessions = actionableTrainingSessions.filter((session: any) => session.status === "pending_tutor_confirmation");
  const isConfirmingTrainingSession = (sessionId: string) =>
    confirmTrainingSession.isPending && confirmTrainingSession.variables?.sessionId === sessionId;
  const pendingTrainingConfirmationSession = actionableTrainingSessions.find((session: any) => session.status === "pending_parent_confirmation") || null;
  const activeTrainingSession = isTrainingMode
    ? confirmedTrainingSessions[0] || null
    : pendingTrainingConfirmationSession
      ? null
      : actionableTrainingSessions.find((session: any) => session.launch?.canLaunch) || null;
  const nextTrainingSession = actionableTrainingSessions.find(
    (session: any) =>
      isTrainingMode
        ? ["confirmed", "ready", "live"].includes(String(session.status || "")) && session.id !== activeTrainingSession?.id
        : ["confirmed", "ready", "live"].includes(String(session.status || "")) && !session.launch?.canLaunch,
  ) || null;

  const showTopicManagement = !readOnly && !mapOnly;

  const studentNameHasGrade = /\bgrade\b/i.test(studentName || "");
  const normalizedGradeRaw = (studentGrade || "-").toString().trim();
  const normalizedGradeValue = normalizedGradeRaw.replace(/^grade\s*/i, "").trim() || "-";
  const studentBadgeLabel = studentNameHasGrade
    ? studentName || "-"
    : `${studentName || "-"} • Grade ${normalizedGradeValue}`;

  const formatLessonTime = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(value))
      : "-";
  const handleCancelConfirmedTrainingSession = async (
    sessionId: string,
    reasonCodes: string[],
    reasonNote: string | null,
  ) => {
    const result = await respondTrainingSession.mutateAsync({
      sessionId,
      action: "cancel",
      reasonCodes,
      reasonNote: buildTrainingSessionCancellationNote(
        "Tutor",
        TUTOR_TRAINING_SESSION_CANCELLATION_REASONS,
        reasonCodes,
        reasonNote,
      ),
    });

    setTrainingSessionMeetMessage(
      result?.message || "Training session cancelled. The parent can reschedule a new week."
    );
  };
  const toggleTopicExpanded = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-full sm:max-w-7xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-primary/15 bg-background p-2 shadow-sm sm:p-6">
        <DialogHeader />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full overflow-x-hidden">
          <TabsList className={`flex w-full flex-row sm:grid h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1 ${showTopicManagement ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <TabsTrigger value="dashboard" className="flex-1 h-auto whitespace-normal text-xs sm:text-sm py-2 px-2">Map</TabsTrigger>
            {showTopicManagement ? (
              <TabsTrigger value="session-form" className="flex-1 h-auto whitespace-normal text-xs sm:text-sm py-2 px-2">
                <span className="inline-flex items-center gap-2">
                  <span>Training</span>
                  {trainingSessionsData?.sessions?.some((s: any) => s?.status === "pending_tutor_confirmation") ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">!</span>
                  ) : null}
                </span>
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 overflow-x-hidden">
            <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-3">

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Active Conditioning Map</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setActivateDialogOpen(true)}>
                        Activate Topic
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge variant="outline" className="w-full sm:w-fit max-w-full break-all">
                  {studentBadgeLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Select a topic to review observed state and next-session preparation. Activated topics stay Unknown until a scored drill/session is logged.
              </p>

              {displayedParentTopicIntelligence.length > 0 ? (
                <div className="rounded-xl border border-primary/15 bg-muted/20 p-3 sm:p-4 space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Parent Reported Topics</p>
                    <p className="text-xs text-muted-foreground">Activate these topics next.</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {displayedParentTopicIntelligence.map((entry) => {
                      const isActivated = activeParentTopicKeys.has(normalizeTopicKey(entry.topic));
                      return (
                        <div key={`parent-intake-${entry.topic}`} className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{entry.topic}</p>
                            {isActivated ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDismissParentTopic(entry.topic)}
                              >
                                <X className="w-4 h-4" aria-hidden="true" />
                                <span className="sr-only">Dismiss {entry.topic}</span>
                              </Button>
                            ) : null}
                          </div>
                          {entry.phase ? (
                            <p className="text-xs text-muted-foreground">
                              Recommended entry phase: <span className="font-medium text-foreground">{entry.phase}</span>
                            </p>
                          ) : null}
                          {entry.rationale ? (
                            <p className="text-xs text-muted-foreground">{entry.rationale}</p>
                          ) : null}
                          {entry.symptoms.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {entry.symptoms.map((symptom) => (
                                <Badge
                                  key={`${entry.topic}-${symptom}`}
                                  variant="outline"
                                  className="max-w-full whitespace-normal break-words text-left leading-snug text-[10px] border-primary/20 bg-background/70 text-foreground"
                                >
                                  {symptom}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No topic-specific symptoms captured.</p>
                          )}
                        </div>
                                );
                              })}
                  </div>
                </div>
              ) : null}

              {topics.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No active topics yet. Activate a topic, then run intro/training drills to update phase and stability.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {prioritizedTopics.map((row) => {
                    const topicIntel = interpretTopicState(row.phase, row.stability, row.trend, {
                      enteredMaintenanceCheckpoint: enteredMaintenanceCheckpoint(
                        row.phase,
                        row.stability,
                        row.timeline,
                      ),
                      firstObservationInCurrentPhase: isFirstObservationInCurrentPhase(
                        row.phase,
                        row.timeline,
                      ),
                    });
                    const rowPrepPlan = tutorPrepPlanFor(row.phase, row.stability, row.hasObservedState);
                    const isExpanded = expandedTopics.has(row.topic);
                    const phaseLabel = row.hasObservedState ? row.phase : "Unknown";
                    const stabilityLabel = row.hasObservedState ? row.stability : "Unknown";
                    return (
                      <div
                        key={`topic-card-${row.topic}`}
                        className={`w-full rounded-xl border p-4 text-left transition-colors space-y-3 ${
                          selectedRow?.topic === row.topic
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex-1 text-left space-y-1"
                            onClick={() => setSelectedTopic(row.topic)}
                          >
                            <p className="text-base font-semibold break-words">{row.topic}</p>
                            <p className="text-sm text-muted-foreground">Phase: <span className="font-medium text-foreground">{phaseLabel}</span></p>
                            <p className="text-sm text-muted-foreground">Stability: <span className="font-medium text-foreground">{stabilityLabel}</span></p>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 shrink-0"
                            onClick={() => {
                              setSelectedTopic(row.topic);
                              toggleTopicExpanded(row.topic);
                            }}
                          >
                            <span className="text-xs mr-1">{isExpanded ? "Hide" : "Expand"}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </div>

                        {!isExpanded ? null : (
                          <>

                        {row.hasObservedState ? (
                          <div className="flex flex-wrap gap-1.5">
                            {PHASES.map((phase) => {
                              const stepIndex = phaseIndex(phase);
                              const currentIndex = phaseIndex(row.phase);
                              const done = stepIndex < currentIndex;
                              const active = stepIndex === currentIndex;
                              const label = done ? `✓ ${phase}` : active ? `ACTIVE ${phase}` : `Locked ${phase}`;
                              return (
                                <span
                                  key={`${row.topic}-${phase}`}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] ${
                                    done
                                      ? "border-muted text-foreground/60 bg-muted/40"
                                      : active
                                      ? "border-primary/30 bg-primary/10 text-foreground"
                                      : "border-muted text-muted-foreground bg-muted/20"
                                  }`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No observed phase progression yet. Run diagnosis/training to establish first state.</p>
                        )}

                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">State Progression Timeline</p>
                          {(row.timeline || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {row.timeline.slice(-6).reverse().map((point, index) => {
                                return (
                                <span
                                  key={`${row.topic}-${point.date}-${point.phase}-${index}`}
                                  className="rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {toRelativeSessionLabel(index, point.kind)} · {point.phase} · {point.stability}
                                </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Tutor Meaning:</span> {row.hasObservedState ? topicIntel.tutorMeaning : "Topic is active but not yet observed in a scored drill/session."}
                        </p>

                        <p className="text-sm text-foreground font-medium">
                          Next Move: {row.hasObservedState ? topicIntel.nextAction : "Run adaptive diagnosis to establish first placement."}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          Constraint: {row.hasObservedState ? (topicIntel.rules[0] || "Follow phase constraints") : "Do not assume phase or stability before first observed state."}
                        </p>

                        <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tutor Prep For Next Session</p>
                          <p className="text-xs text-foreground/80">{rowPrepPlan.drillType}</p>
                          <div className="space-y-1">
                            {rowPrepPlan.setPlans.map((setPlan) => (
                              <p key={`${row.topic}-${setPlan.label}`} className="text-xs text-muted-foreground">
                                {setPlan.label}: {setPlan.problems} problems · {setPlan.difficulty}
                              </p>
                            ))}
                          </div>
                          <div className="pt-1">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Prep Rules</p>
                            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {rowPrepPlan.prepNotes.map((note) => (
                                <li key={`${row.topic}-prep-note-${note}`} className="flex items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0 text-foreground/40">•</span>
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/20 bg-muted/20 text-foreground">
                            {row.hasObservedState ? topicIntel.transitionStatus : "Awaiting Observation"}
                          </Badge>
                          {row.hasObservedState && (
                            <Badge className={stabilityTone(row.stability)}>
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                  row.stability === "High Maintenance"
                                    ? "bg-blue-500"
                                    : row.stability === "High"
                                    ? "bg-green-500"
                                    : row.stability === "Medium"
                                    ? "bg-amber-500"
                                    : "bg-red-400"
                                }`}
                              />
                              {row.stability}
                            </Badge>
                          )}
                        </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Activate New Topic</DialogTitle>
                  <DialogDescription>
                    Select a topic and provide a reason for activation. This will add the topic to the active list and log the reason.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Topic name (e.g. Linear equations)"
                    value={newTopic}
                    onChange={e => setNewTopic(e.target.value)}
                  />
                  <Select value={activationReason} onValueChange={setActivationReason}>
                    <SelectTrigger className="w-full">{activationReason || "Select reason"}</SelectTrigger>
                    <SelectContent>
                      {ACTIVATION_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activationReason === "Other (enter note)" && (
                    <Textarea
                      placeholder="Enter activation note"
                      value={activationNote}
                      onChange={e => setActivationNote(e.target.value)}
                    />
                  )}
                  {activateError && <p className="text-xs text-red-500">{activateError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setActivateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleActivateTopic}>Activate</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {selectedRow && (
              <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-4">
                <h3 className="font-semibold">Selected Topic Intelligence</h3>
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Topic Name:</span> {selectedRow.topic}</p>
                    <p><span className="font-medium">Current Phase:</span> {hasObservedSelection ? selectedRow.phase : "Unknown"}</p>
                    <p><span className="font-medium">Current Stability:</span> {hasObservedSelection ? selectedRow.stability : "Unknown"}</p>
                    <p><span className="font-medium">Trend:</span> {selectedRow.trend}</p>
                    <p><span className="font-medium">Transition Status:</span> {selectedInterpretation?.transitionStatus || "Awaiting Observation"}</p>
                    <p><span className="font-medium">Tutor Meaning:</span> {selectedInterpretation?.tutorMeaning || "Topic is active but not yet observed."}</p>
                    <p><span className="font-medium">Parent Meaning:</span> {selectedInterpretation?.parentMeaning || "Observed state will appear after first scored drill/session."}</p>
                    <p><span className="font-medium">Direction:</span> {selectedInterpretation?.direction || "Run adaptive diagnosis first."}</p>
                    <p><span className="font-medium">Constraint:</span> {selectedInterpretation?.rules[0] || "Do not infer phase movement without observations."}</p>
                    <p><span className="font-medium">Entry Diagnosis:</span> {selectedRow.entryDiagnosis}</p>
                  </div>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <p className="text-sm font-medium">Tutor Prep For Next Session</p>
                    {prepPlan && (
                      <>
                        <p className="text-xs text-muted-foreground">Drill type: {prepPlan.drillType}</p>
                        <div className="space-y-1.5">
                          {prepPlan.setPlans.map((setPlan) => (
                            <div key={`${selectedRow.topic}-${setPlan.label}`} className="rounded border border-primary/20 bg-background/70 px-2 py-1.5 text-xs">
                              <p className="font-medium text-foreground">{setPlan.label}</p>
                              <p className="text-muted-foreground">Problems: {setPlan.problems}</p>
                              <p className="text-muted-foreground">Difficulty: {setPlan.difficulty}</p>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prep Rules</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {prepPlan.prepNotes.map((note) => (
                              <li key={note} className="flex items-start gap-1.5">
                                <span className="shrink-0 text-foreground/40">-</span>
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-sm">Topic Progress Timeline</p>
                  <div
                    key={`${selectedRow?.topic || "topic"}-${showFullSelectedTimeline ? "full" : "latest"}`}
                    className="rounded-md border p-2 space-y-2"
                  >
                    <div className="flex flex-col items-start gap-1.5">
                      {selectedTimelineBadges.map((point, index) => (
                        <span
                          key={point._renderKey}
                          className="inline-flex rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {toRelativeSessionLabel(index, point.kind)} · {point.phase} · {point.stability}
                        </span>
                      ))}
                    </div>
                    {hasOlderSelectedTimeline && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowFullSelectedTimeline((prev) => !prev)}
                      >
                        {showFullSelectedTimeline
                          ? "Show Latest 6"
                          : `Show ${selectedTimeline.length - 6} Older ${selectedTimeline.length - 6 === 1 ? "Entry" : "Entries"}`}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Removed Topics Tracked, Needs Stabilization, Ready To Advance cards as requested */}

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsStabilityTrackerCollapsed((prev) => !prev)}
                >
                  <h3 className="font-semibold">Stability Tracker</h3>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isStabilityTrackerCollapsed ? "" : "rotate-180"}`} />
                </button>
                {!isStabilityTrackerCollapsed && (
                  <>
                    {selectedRow ? (
                      <>
                        {hasObservedSelection ? (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Stability: {selectedRow.stability}
                            </p>
                            <Progress value={stabilityPercent(selectedRow.stability)} />
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium">Recent Logs (Last 3 Observations)</p>
                              {(selectedRow.recentLogs || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No observations recorded yet for this topic.</p>
                              ) : (
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {(selectedRow.recentLogs || []).map((log) => (
                                    <li key={log}>{log}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="rounded-md border p-3 bg-primary/5 border-primary/20">
                                <p className="text-xs uppercase font-semibold text-primary mb-2">Do</p>
                                <ul className="text-sm text-foreground space-y-1">
                                  {guidance.doItems.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="rounded-md border p-3 bg-muted/50 border-muted">
                                <p className="text-xs uppercase font-semibold text-foreground/60 mb-2">Do Not</p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {guidance.avoidItems.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            Stability tracking unlocks after the first scored diagnosis or training drill. Until then, this topic remains unplaced.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        No active topics in Map yet. Stability tracking will appear after a topic is activated.
                      </div>
                    )}
                  </>
                )}
              </Card>

              <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setIsPhaseProgressionCollapsed((prev) => !prev)}
                >
                  <h3 className="font-semibold">Phase Progression</h3>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isPhaseProgressionCollapsed ? "" : "rotate-180"}`} />
                </button>
                {!isPhaseProgressionCollapsed && (
                  <>
                    <p className="text-sm text-muted-foreground">Clarity to Structured Execution to Controlled Discomfort to Time Pressure Stability</p>
                    {hasObservedSelection ? (
                      <div className="flex flex-wrap gap-2">
                        {PHASES.map((phase, idx) => {
                          const state = idx < phaseIx ? "completed" : idx === phaseIx ? "current" : "locked";
                          return (
                            <Badge
                              key={phase}
                              variant="outline"
                              className={
                                state === "completed"
                                  ? "bg-muted/60 border-muted text-foreground/50 text-[11px] sm:text-xs whitespace-normal"
                                  : state === "current"
                                  ? "bg-primary/10 border-primary/30 text-foreground font-medium text-[11px] sm:text-xs whitespace-normal"
                                  : "bg-muted/30 border-muted text-muted-foreground text-[11px] sm:text-xs whitespace-normal"
                              }
                            >
                              {phase}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Observed phase is Unknown for this topic. Progression tracking unlocks after first scored observation.
                      </div>
                    )}

                    <div className="rounded-md border p-3 space-y-3">
                      <p className="text-sm font-medium">NEXT ACTION</p>
                      {selectedRow ? (
                        <>
                          {hasObservedSelection ? (
                            <>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                {getNextActionData(selectedRow.phase, selectedRow.stability).nextActions.map((a) => (
                                  <li key={a} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 shrink-0 text-foreground/40">›</span>
                                    <span>{a}</span>
                                  </li>
                                ))}
                              </ul>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rules</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {getNextActionData(selectedRow.phase, selectedRow.stability).rules.map((r) => (
                                    <li key={r} className="flex items-start gap-1.5">
                                      <span className="shrink-0 text-foreground/40">-</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Run adaptive diagnosis first to generate deterministic next actions.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Select a topic to see engine output.</p>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </div>

            <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsPhaseDefinitionsCollapsed((prev) => !prev)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Phase Definitions</h3>
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isPhaseDefinitionsCollapsed ? "" : "rotate-180"}`} />
              </button>
              {!isPhaseDefinitionsCollapsed && (
                <div className="grid md:grid-cols-2 gap-3">
                  {PHASES.map((phase) => {
                    // Split the definition into Description, Tool, Question
                    const [desc, tool, question] = phaseDefinition[phase].split(/\n\n/);
                    const phaseNumber = PHASES.indexOf(phase) + 1;
                    const isPhaseExpanded = expandedPhaseDefinitions.has(phase);
                    return (
                      <div key={phase} className="rounded-md border p-3 flex flex-col items-start gap-2 bg-muted/10">
                        <div className="w-full flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{phaseNumber}. {phase}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setExpandedPhaseDefinitions((prev) => {
                                const next = new Set(prev);
                                if (next.has(phase)) next.delete(phase);
                                else next.add(phase);
                                return next;
                              })
                            }
                          >
                            {isPhaseExpanded ? "Collapse" : "Expand"}
                            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${isPhaseExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </div>
                        <div className="w-full flex flex-col gap-2">
                          {isPhaseExpanded && (
                            <>
                              <div className="bg-background rounded px-2 py-1 border border-primary/10">
                                <span className="font-semibold text-foreground text-xs">Description:</span>
                                <span className="ml-1 text-muted-foreground text-[11px]">{desc?.replace('Description: ', '')}</span>
                              </div>
                              <div className="bg-background rounded px-2 py-1 border border-primary/10">
                                <span className="font-semibold text-foreground text-xs">Tool:</span>
                                <span className="ml-1 text-muted-foreground text-[11px]">{tool?.replace('Tool: ', '')}</span>
                              </div>
                              <div className="bg-background rounded px-2 py-1 border border-primary/10">
                                <span className="font-semibold text-foreground text-xs">Question:</span>
                                <span className="ml-1 text-muted-foreground text-[11px]">{question?.replace('Question: ', '')}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {showTopicManagement ? (
          <TabsContent value="session-form" className="space-y-4 sm:space-y-6">
            <Card className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 md:p-5 shadow-sm space-y-4">
              {topics.length > 0 ? (
                isTrainingMode ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Training Operations</h4>
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Training Mode</p>
                        <p className="text-xs text-muted-foreground">
                          Weekly Response Integrity scheduling still applies. Google Meet links and live launch windows do not.
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        Start Session unlocks after the week's lesson is confirmed by both parent and tutor.
                      </div>
                    </div>
                    <div className="rounded border border-primary/20 bg-background px-3 py-2 text-xs space-y-2">
                      <p className="font-medium text-foreground">
                        {confirmedTrainingSessions.length > 0 ? "Confirmed weekly lesson ready" : "Awaiting confirmed weekly lesson"}
                      </p>
                      <p className="text-muted-foreground">
                        {confirmedTrainingSessions.length > 0
                          ? "Use Start Session to choose topics and enter the runner for a confirmed weekly lesson."
                          : "Training launch stays locked until a weekly lesson is scheduled and fully confirmed."}
                      </p>
                    </div>
                    {confirmedTrainingSessions.length > 0 ? (
                      <div className="rounded border border-primary/20 bg-background px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-foreground">Confirmed lessons</p>
                        <div className="space-y-2">
                          {confirmedTrainingSessions.map((session: any) => (
                            <div key={session.id} className="rounded border border-primary/20 bg-muted/10 px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{formatLessonTime(session.scheduled_time)}</p>
                                  <p className="text-muted-foreground">Status: {String(session.status || "").replaceAll("_", " ")}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (activeTrainingSession?.id !== session.id) {
                                        setTrainingSessionMeetMessage(
                                          "Start Session will launch the earliest confirmed weekly lesson first. Complete it before opening the next confirmed slot."
                                        );
                                        return;
                                      }
                                      setSessionPrepChecks({});
                                      setSessionTopicsModalOpen(true);
                                    }}
                                    disabled={!assignmentAccepted}
                                    title={!assignmentAccepted ? "Accept the assignment before running training sessions." : undefined}
                                  >
                                    Start Session
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setCancelTrainingSessionTarget({
                                        id: session.id,
                                        scheduledTimeLabel: formatLessonTime(session.scheduled_time),
                                      });
                                    }}
                                    disabled={respondTrainingSession.isPending || confirmTrainingSession.isPending || !assignmentAccepted}
                                    title={!assignmentAccepted ? "Accept the assignment before cancelling lessons." : undefined}
                                  >
                                    Cancel Lesson
                                  </Button>
                                </div>
                              </div>
                              <p className="text-muted-foreground">
                                Training mode runs this lesson inside the platform without depending on Meet generation or the live lesson window.
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <TrainingSessionCancellationDialog
                      open={!!cancelTrainingSessionTarget}
                      onOpenChange={(nextOpen) => {
                        if (!nextOpen) {
                          setCancelTrainingSessionTarget(null);
                        }
                      }}
                      title="Cancel Confirmed Lesson"
                      description={
                        cancelTrainingSessionTarget
                          ? `You are cancelling ${cancelTrainingSessionTarget.scheduledTimeLabel}. Select the cancellation reason so the parent-facing and billing trail stays accurate.`
                          : "Select the cancellation reason so the parent-facing and billing trail stays accurate."
                      }
                      confirmLabel="Cancel Lesson"
                      isSubmitting={respondTrainingSession.isPending}
                      reasonOptions={TUTOR_TRAINING_SESSION_CANCELLATION_REASONS}
                      notePlaceholder="Add any extra operational context the parent or internal billing trail should keep."
                      onConfirm={async ({ reasonCodes, reasonNote }) => {
                        if (!cancelTrainingSessionTarget) {
                          throw new Error("No confirmed lesson selected.");
                        }
                        await handleCancelConfirmedTrainingSession(
                          cancelTrainingSessionTarget.id,
                          reasonCodes,
                          reasonNote,
                        );
                      }}
                    />
                    {pendingTutorConfirmationSessions.length > 0 ? (
                      <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-blue-900">Awaiting tutor confirmation</p>
                        <p className="text-blue-800">
                          The parent has proposed this week's lesson times. Confirm both dates before training can launch.
                        </p>
                        <div className="space-y-2">
                          {pendingTutorConfirmationSessions.map((session: any) => (
                            <div key={session.id} className="rounded border border-blue-200 bg-background px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{formatLessonTime(session.scheduled_time)}</p>
                                  <p className="text-muted-foreground">Status: waiting for tutor confirmation</p>
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
                                            ? "Tutor confirmed. Google Meet attached to the lesson."
                                            : "Tutor confirmed the lesson.")
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
                                    variant="ghost"
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
                                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 space-y-2">
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
                                            result?.googleMeetError || "Tutor sent a new time to the parent for confirmation."
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
                          <p className="text-muted-foreground">{formatLessonTime(latestCompletedTrainingSession.scheduled_time)}</p>
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
                        disabled={!assignmentAccepted}
                        title={!assignmentAccepted ? "Accept the assignment before running training sessions." : undefined}
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
                        Parent books the two weekly lesson times in the Sessions tab.
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
                      <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-blue-900">Awaiting tutor confirmation</p>
                        <p className="text-blue-800">
                          The parent has proposed this week's training lessons. Confirm both dates before Meet links are created.
                        </p>
                        <div className="space-y-2">
                          {pendingTutorConfirmationSessions.map((session: any) => (
                            <div key={session.id} className="rounded border border-blue-200 bg-background px-3 py-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{formatLessonTime(session.scheduled_time)}</p>
                                  <p className="text-muted-foreground">Status: waiting for tutor confirmation</p>
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
                                            ? "Tutor confirmed. Google Meet attached to the lesson."
                                            : "Tutor confirmed the lesson.")
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
                                    variant="ghost"
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
                                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 space-y-2">
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
                                            result?.googleMeetError || "Tutor sent a new time to the parent for confirmation."
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
                          No Response Integrity training lesson is attached yet. The parent must schedule this week's two lesson times in the Sessions tab.
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
                          <p className="text-muted-foreground">{formatLessonTime(latestCompletedTrainingSession.scheduled_time)}</p>
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
                    Select one or more topics for this lesson. Unobserved topics are diagnosis-first and cannot enter training until first placement exists.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose the topics you want to cover in this lesson. A single unobserved topic launches diagnosis. Observed topics launch training. Mixed launches are blocked until placement is complete.
                  </p>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {topics.map((topic) => (
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
                          {topic.topic} ({topic.hasObservedState ? `${topic.phase} - ${topic.stability}` : "Unobserved - Diagnosis First"})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedSessionUnknownTopics.length > 1 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    More than one unobserved topic is selected. Entry placement must run one topic at a time.
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
                    <p className="text-xs text-muted-foreground">
                      Review the exact drill load before you enter the lesson. Each selected topic still needs its own problem prep and explicit tutor confirmation before launch.
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {selectedSessionPrepPlans.map(({ topic, phase, stability, hasObservedState, prepPlan }) => (
                        <div key={`session-prep-${topic}`} className="rounded-md border border-primary/20 bg-background p-3 space-y-2">
                          <div>
                            <p className="font-medium text-sm">{topic}</p>
                            {!hasObservedState ? (
                              <p className="text-xs text-muted-foreground">Unobserved topic · diagnosis-first placement</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">{phase} · {stability}</p>
                          </div>
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
                              I prepared the full drill set for <span className="font-medium">{topic}</span> and I am ready to run this weekly training lesson.
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
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
                    disabled={selectedSessionTopics.size === 0 || !sessionPrepChecklistComplete}
                  >
                    {selectedSessionStartLabel} ({selectedSessionTopics.size} topics)
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
