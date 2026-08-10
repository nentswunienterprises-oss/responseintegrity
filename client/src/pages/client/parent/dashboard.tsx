import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserRound,
  LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProposalView from "@/components/parent/ProposalView";
import { PushOptInCard } from "@/components/push/PushOptInCard";
import { useNavigate } from "react-router-dom";

interface StudentStats {
  introDiagnosisCompleted?: number;
  bossBattlesCompleted: number;
  solutionsUnlocked: number;
  confidenceGrowth: number;
  sessionsCompleted: number;
  trainingSessionsCompleted?: number;
  currentStreak: number;
  totalCommitments: number;
}

interface TutorInfo {
  id: string;
  name: string;
  email?: string;
  bio?: string;
}

interface IntroSessionInfo {
  status:
    | "not_scheduled"
    | "awaiting_tutor_acceptance"
    | "pending_tutor_confirmation"
    | "pending_parent_confirmation"
    | "confirmed";
  scheduled_time?: string;
  introCompleted?: boolean;
}

const PHASE_SEQUENCE = ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"] as const;
const STABILITY_SEQUENCE = ["Low", "Medium", "High", "High Maintenance"] as const;

type PhaseLabel = (typeof PHASE_SEQUENCE)[number];
type StabilityLabel = (typeof STABILITY_SEQUENCE)[number];

type ParentStateCopy = {
  status: string;
  meaning: string;
  focus: string;
};

type ParentTopicState = {
  topic: string;
  phase: string | null;
  stability: string | null;
  lastUpdated?: string | null;
  previousPhase?: string | null;
  previousStability?: string | null;
  movement?: "none" | "improved" | "regressed" | "changed";
  bucket?: "active" | "recent" | "older";
};

const PARENT_STATE_ENGINE: Record<PhaseLabel, Record<StabilityLabel, ParentStateCopy>> = {
  Clarity: {
    Low: {
      status: "Your child is still building a clear understanding of this topic.",
      meaning: "They are not yet fully comfortable with the terms, steps, or logic involved.",
      focus: "We are rebuilding the foundation so they can clearly recognize and understand the problem.",
    },
    Medium: {
      status: "Your child is beginning to understand this topic more clearly.",
      meaning: "They can follow explanations, but still need reinforcement to apply it independently.",
      focus: "We are increasing practice and helping them apply the method more consistently.",
    },
    High: {
      status: "Your child now understands this topic clearly.",
      meaning: "They can recognize the problem and explain the steps with confidence.",
      focus: "We are moving into independent problem-solving to build execution.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong clarity in this topic.",
      meaning: "They have held high performance consistently and are ready for progression decisions.",
      focus: "We are now transitioning into Structured Execution training.",
    },
  },
  "Structured Execution": {
    Low: {
      status: "Your child is learning to apply the steps correctly.",
      meaning: "They understand the topic but struggle to follow the method consistently on their own.",
      focus: "We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.",
    },
    Medium: {
      status: "Your child is becoming more consistent in solving problems.",
      meaning: "They can follow the method in many cases, but still show occasional inconsistency.",
      focus: "We are increasing independent practice to strengthen consistency.",
    },
    High: {
      status: "Your child can now solve problems consistently in this topic.",
      meaning: "They are able to follow the correct steps independently with minimal support.",
      focus: "We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong execution consistency in this topic.",
      meaning: "They have held high execution quality across sessions and are ready for progression decisions.",
      focus: "We are now transitioning into Controlled Discomfort training.",
    },
  },
  "Controlled Discomfort": {
    Low: {
      status: "Your child is starting to face more challenging problems in this topic.",
      meaning: "They can solve basic problems, but struggle when questions become less familiar.",
      focus: "We are helping them stay calm and start correctly even when the problem feels difficult.",
    },
    Medium: {
      status: "Your child is improving in handling difficult questions.",
      meaning: "They can work through unfamiliar problems, but still show hesitation at times.",
      focus: "We are increasing exposure to harder questions to build stability under difficulty.",
    },
    High: {
      status: "Your child is handling difficult problems well.",
      meaning: "They are able to stay structured and solve unfamiliar questions with stability.",
      focus: "We are preparing them to perform under time pressure.",
    },
    "High Maintenance": {
      status: "Your child has sustained strong performance under challenge in this topic.",
      meaning: "They have held high stability in difficult work and are ready for progression decisions.",
      focus: "We are now transitioning into Time Pressure Stability training.",
    },
  },
  "Time Pressure Stability": {
    Low: {
      status: "Your child is learning to stay structured under time pressure.",
      meaning: "They can solve problems, but may lose structure when working against the clock.",
      focus: "We are helping them maintain their method while working within time limits.",
    },
    Medium: {
      status: "Your child is becoming more stable under time pressure.",
      meaning: "They are improving their ability to complete problems within time while staying structured.",
      focus: "We are increasing timed practice to strengthen consistency.",
    },
    High: {
      status: "Your child is performing consistently under time pressure.",
      meaning: "They can solve problems accurately and maintain structure even under time constraints.",
      focus: "We are maintaining performance and preparing them to transfer this skill to new topics.",
    },
    "High Maintenance": {
      status: "Your child has sustained top stability under time pressure.",
      meaning: "They consistently maintain structure and accuracy under timed conditions.",
      focus: "We are maintaining performance and expanding transfer across related topics.",
    },
  },
};

const PARENT_DIAGNOSIS_ENGINE: Record<PhaseLabel, Record<StabilityLabel, ParentStateCopy>> = {
  Clarity: {
    Low: {
      status: "The intro diagnosis shows that this topic still needs foundation building.",
      meaning: "Your child is not yet consistently clear on what the problem is asking or what structure to use first.",
      focus: "Training will begin by rebuilding recognition, language, and first-step accuracy.",
    },
    Medium: {
      status: "The intro diagnosis shows that clarity is starting to form in this topic.",
      meaning: "Your child can follow parts of the explanation, but the structure is not yet stable enough to apply independently.",
      focus: "Training will begin by strengthening problem recognition and clearer first steps.",
    },
    High: {
      status: "The intro diagnosis shows that this topic is already clear enough to move beyond explanation alone.",
      meaning: "Your child can recognize the problem and explain the structure, but still needs training to hold that understanding independently.",
      focus: "Training will begin by moving from clarity into more independent execution.",
    },
    "High Maintenance": {
      status: "The intro diagnosis shows strong clarity in this topic.",
      meaning: "Your child is entering with a clear enough understanding to begin higher-order execution work.",
      focus: "Training will begin from Structured Execution rather than reteaching the foundation.",
    },
  },
  "Structured Execution": {
    Low: {
      status: "The intro diagnosis shows that the method is not yet stable in this topic.",
      meaning: "Your child can begin the work, but the step order and method use still break down without support.",
      focus: "Training will begin by building a more repeatable step-by-step method.",
    },
    Medium: {
      status: "The intro diagnosis shows partial execution consistency in this topic.",
      meaning: "Your child can use the correct method in many cases, but it is not yet stable enough to treat as trained performance.",
      focus: "Training will begin by strengthening independent starts and more consistent method use.",
    },
    High: {
      status: "The intro diagnosis shows strong execution in this topic.",
      meaning: "Your child is entering with a method that is mostly intact, but it still needs training under harder conditions before progression.",
      focus: "Training will begin by confirming this execution level and then increasing challenge carefully.",
    },
    "High Maintenance": {
      status: "The intro diagnosis shows sustained execution strength in this topic.",
      meaning: "Your child is entering above basic execution and may be ready for challenge-based work sooner.",
      focus: "Training will begin from a stronger starting point and test stability before advancing further.",
    },
  },
  "Controlled Discomfort": {
    Low: {
      status: "The intro diagnosis shows that challenge currently destabilizes this topic.",
      meaning: "Your child can work in familiar conditions, but structure breaks when the work feels harder or less familiar.",
      focus: "Training will begin by keeping structure intact when discomfort appears.",
    },
    Medium: {
      status: "The intro diagnosis shows partial stability under challenge in this topic.",
      meaning: "Your child can handle some unfamiliar difficulty, but hesitation and inconsistency still show up.",
      focus: "Training will begin by building steadier responses in harder work.",
    },
    High: {
      status: "The intro diagnosis shows strong handling of challenge in this topic.",
      meaning: "Your child can stay relatively structured when the work pushes back, but that still needs to be confirmed through training.",
      focus: "Training will begin from this stronger challenge-response position and prepare for time pressure later.",
    },
    "High Maintenance": {
      status: "The intro diagnosis shows unusually strong challenge handling in this topic.",
      meaning: "Your child is entering with a stable response to unfamiliar work and may be near time-pressure preparation.",
      focus: "Training will begin by confirming that stability before introducing more pace pressure.",
    },
  },
  "Time Pressure Stability": {
    Low: {
      status: "The intro diagnosis shows that time pressure currently disrupts this topic.",
      meaning: "Your child can solve the work, but loses structure once pace is added.",
      focus: "Training will begin by protecting method and decision-making under time pressure.",
    },
    Medium: {
      status: "The intro diagnosis shows partial time-pressure stability in this topic.",
      meaning: "Your child can hold some structure while timed, but not consistently enough yet.",
      focus: "Training will begin by stabilizing decisions and method under pace.",
    },
    High: {
      status: "The intro diagnosis shows strong timed stability in this topic.",
      meaning: "Your child is entering with relatively stable structure under pace, but that still needs confirmation across training.",
      focus: "Training will begin from this stronger timed baseline and test whether it holds reliably.",
    },
    "High Maintenance": {
      status: "The intro diagnosis shows top-end timed stability in this topic.",
      meaning: "Your child is entering from a highly stable timed starting point rather than building up from earlier phases.",
      focus: "Training will begin by maintaining that level and checking transfer across related work.",
    },
  },
};

function normalizeTopicText(value?: string | null): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch {
      // Fall through to plain-text splitting.
    }
  }

  return [raw];
}

function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,;|]+/)
    .flatMap((item) => normalizeTopicText(item.replace(/^[-*\u2022\s]+/, "").trim()))
    .filter(Boolean);
}

function formatListWithAnd(items: string[]): string {
  const cleaned = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function extractTopicConditioning(proposal: any) {
  if (!proposal) {
    return { topic: null, entryPhase: null, stability: null };
  }

  if (proposal.topicConditioning) {
    return {
      topic: normalizeTopicText(proposal.topicConditioning.topic)[0] || null,
      entryPhase:
        String(
          proposal.topicConditioning.entryPhase ??
          proposal.topicConditioning.entry_phase ??
          ""
        ).trim() || null,
      stability: proposal.topicConditioning.stability?.trim() || null,
    };
  }

  const noteText = String(proposal.tutorNotes || "");
  const justificationText = String(proposal.justification || "");

  return {
    topic: normalizeTopicText(String(proposal.currentTopics || ""))[0] || null,
    entryPhase:
      noteText.match(/Entry Phase:\s*([^\n\r]+)/i)?.[1]?.trim() ||
      justificationText.match(/Entry phase\s*([^|\.]+)/i)?.[1]?.trim() ||
      null,
    stability:
      noteText.match(/Stability:\s*([^\n\r]+)/i)?.[1]?.trim() ||
      justificationText.match(/Stability\s*([^|\.]+)/i)?.[1]?.trim() ||
      null,
  };
}

function getDashboardSignalsForState(
  phase: PhaseLabel | null,
  diagnosisOnly: boolean,
): string[] {
  switch (phase) {
    case "Clarity":
      return diagnosisOnly
        ? [
            "Clearer recognition of what the question is asking",
            "Earlier correct method selection",
            "Less confusion when beginning problems",
            "More accurate first steps",
          ]
        : [
            "Clearer recognition of what the question is asking",
            "Earlier correct method selection",
            "Less confusion during setup",
            "More accurate first steps across sessions",
          ];
    case "Structured Execution":
      return [
        "Earlier independent starts",
        "Less hesitation when beginning problems",
        "More consistent method use",
        "More stable step order without prompting",
      ];
    case "Controlled Discomfort":
      return [
        "Calmer starts when questions feel less familiar",
        "Better structure holding in harder work",
        "Less visible shutdown under challenge",
        "More complete attempts on difficult questions",
      ];
    case "Time Pressure Stability":
      return [
        "Stronger structure while work is timed",
        "Fewer rushed breakdowns",
        "More reliable decisions under pace pressure",
        "Less instability when speed is added",
      ];
    default:
      return diagnosisOnly
        ? [
            "Clearer recognition of what the question is asking",
            "Earlier correct method selection",
            "Less confusion when beginning problems",
            "More accurate first steps",
          ]
        : [
            "Earlier independent starts",
            "More consistent method use",
            "Clearer structure across attempts",
            "Steadier completion of the method",
          ];
  }
}

function getParentRoleLinesForState(
  phase: PhaseLabel | null,
  diagnosisOnly: boolean,
): string[] {
  const baseLines = [
    "Keep session attendance steady and protected.",
    "Use the tutor and training plan as the operating reference.",
  ];

  switch (phase) {
    case "Clarity":
      return [
        ...baseLines,
        diagnosisOnly
          ? "Let your child explain what the question is asking before stepping in with the answer."
          : "Look for clearer reading and better first-step recognition, not only marks.",
        "Do not rush them into speed before the structure is clear.",
      ];
    case "Structured Execution":
      return [
        ...baseLines,
        "Let your child start the problem independently before stepping in.",
        diagnosisOnly
          ? "Look for steadier starts and method order, not speed or perfection yet."
          : "Look for more repeatable method use and steadier starts, not only marks.",
      ];
    case "Controlled Discomfort":
      return [
        ...baseLines,
        "Let discomfort happen before stepping in with reassurance.",
        "Look for calmer starts and steadier attempts when the work feels harder.",
      ];
    case "Time Pressure Stability":
      return [
        ...baseLines,
        "Protect focused timed work without adding extra panic from outside the session.",
        "Look for structure under pace, not just whether the answer was finished quickly.",
      ];
    default:
      return [
        ...baseLines,
        "Look for steadier starts and clearer structure in the work.",
        "Do not rescue too early when the child is still trying to organize the method.",
      ];
  }
}

function normalizePhaseLabel(phase?: string | null) {
  if (!phase) return null;
  const normalized = phase.trim().toLowerCase();
  const matched = PHASE_SEQUENCE.find((item) => item.toLowerCase() === normalized);
  return matched || null;
}

function normalizeStabilityLabel(stability?: string | null): StabilityLabel | null {
  const v = String(stability || "").toLowerCase();
  if (v.includes("high maintenance") || v.includes("maintenance")) return "High Maintenance";
  if (v.includes("high")) return "High";
  if (v.includes("medium")) return "Medium";
  if (v.includes("low")) return "Low";
  return null;
}

function stabilityIndicator(stability: StabilityLabel | null): "Developing" | "Strengthening" | "Stable" | "Unconfirmed" {
  if (!stability) return "Unconfirmed";
  if (stability === "High" || stability === "High Maintenance") return "Stable";
  if (stability === "Medium") return "Strengthening";
  return "Developing";
}

function parentCopyForState(phase?: string | null, stability?: string | null, diagnosisOnly = false): ParentStateCopy {
  const normalizedPhase = normalizePhaseLabel(phase);
  const normalizedStability = normalizeStabilityLabel(stability);

  if (!normalizedPhase || !normalizedStability) {
    return {
      status: "This topic has been activated, but the current observed stage has not been confirmed yet.",
      meaning: "Response Integrity has the topic in conditioning, but a session-scored stage and stability label is not yet available here.",
      focus: "The next logged session will confirm where this topic currently sits and what needs reinforcing first.",
    };
  }

  return diagnosisOnly
    ? PARENT_DIAGNOSIS_ENGINE[normalizedPhase][normalizedStability]
    : PARENT_STATE_ENGINE[normalizedPhase][normalizedStability];
}

function formatDateLabel(dateText?: string | null): string {
  if (!dateText) return "Recently updated";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCurrentStepCopy(introSession: IntroSessionInfo | null, hasProposal: boolean, hasCode: boolean) {
  if (hasCode) {
    return {
      title: "Student Access Is Ready",
      description: "Your child can now use the access code to enter the system and begin the active training journey.",
    };
  }

  if (introSession?.status === "pending_tutor_confirmation") {
    return {
      title: "Waiting For Tutor Confirmation",
      description: "A time has been proposed for the intro session. The next move is tutor confirmation.",
    };
  }

  if (introSession?.status === "pending_parent_confirmation") {
    return {
      title: "Time Needs Your Confirmation",
      description: "Your tutor proposed a new intro-session time. Confirming that time is the next move.",
    };
  }

  if (introSession?.status === "confirmed" && !introSession?.introCompleted) {
    return {
      title: "Intro Session Confirmed",
      description: "The intro session is scheduled. That session will identify the first place the work breaks down.",
    };
  }

  if (introSession?.status === "confirmed" && introSession?.introCompleted && hasProposal) {
    return {
      title: "Training Plan Is Active",
      description: "The intro session has been completed and Response Integrity is now training from the identified breakpoint.",
    };
  }

  return {
    title: "System Is In Motion",
    description: "Your dashboard reflects the current training state and the next thing Response Integrity is moving forward.",
  };
}

function formatParentGradeLabel(grade: string): string {
  const trimmed = grade.trim();
  return /^grade\b/i.test(trimmed) ? trimmed : `Grade ${trimmed}`;
}

export default function ParentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [topicConditioningDialogOpen, setTopicConditioningDialogOpen] = useState(false);

  const { data: proposal, isLoading: proposalLoading, error: proposalError } = useQuery<any>({
    queryKey: ["/api/parent/proposal"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<StudentStats>({
    queryKey: ["/api/parent/student-stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: studentInfo, isLoading: studentInfoLoading, error: studentInfoError } = useQuery<any>({
    queryKey: ["/api/parent/student-info"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  const { data: assignedTutor } = useQuery<TutorInfo | null>({
    queryKey: ["/api/parent/assigned-tutor"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  const { data: introSession } = useQuery<IntroSessionInfo | null>({
    queryKey: ["/api/parent/intro-session-confirmation"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  const { data: trainingSessionsData } = useQuery<{ monthlyQuota?: { sessions_remaining?: number; session_quota?: number } | null }>({ queryKey: ["/api/parent/training-sessions"], queryFn: getQueryFn({ on401: "returnNull" }), refetchInterval: 15000 });
  const sessionsRemaining = trainingSessionsData?.monthlyQuota != null ? Number(trainingSessionsData.monthlyQuota.sessions_remaining ?? 0) : null;

  const { data: topicStatesData } = useQuery<ParentTopicState[]>({
    queryKey: ["/api/parent/topic-conditioning-states"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchInterval: (query) => (query.state.error ? false : 15000),
    refetchOnWindowFocus: true,
  });

  if (proposalLoading || statsLoading || studentInfoLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (proposalError || statsError || studentInfoError) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-900">Dashboard Loading</CardTitle>
        </CardHeader>
        <CardContent className="text-orange-800">
          <p>The dashboard could not fully load the current parent state.</p>
          <p className="mt-3 text-sm">
            {proposalError?.message || statsError?.message || studentInfoError?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const studentName = studentInfo?.name || proposal?.student?.name || "Your child";
  const studentFirstName = studentName.trim().split(/\s+/)[0] || "Your child";
  const topicConditioning = extractTopicConditioning(proposal);
  const focusArea = topicConditioning.topic || splitList(proposal?.currentTopics)[0] || "Current school topic";
  const hasAccessCode = !!proposal?.parentCode;
  const currentStep = getCurrentStepCopy(introSession || null, !!proposal, hasAccessCode);
  const isDiagnosisOnlyView = (stats?.trainingSessionsCompleted || 0) === 0;
  const nextSessionTime = introSession?.scheduled_time
    ? new Date(introSession.scheduled_time).toLocaleString()
    : null;
  const introStatusesWithSchedule = new Set([
    "pending_tutor_confirmation",
    "pending_parent_confirmation",
    "confirmed",
  ]);
  const showScheduledTime = Boolean(
    nextSessionTime &&
      introSession?.status &&
      introStatusesWithSchedule.has(introSession.status) &&
      !hasAccessCode
  );
  const firstParentName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Parent";

  const normalizedTopicStates = Array.from(
    (topicStatesData || [])
      .map((item) => ({
        ...item,
        phase: normalizePhaseLabel(item.phase),
        stability: normalizeStabilityLabel(item.stability),
        topic: String(item.topic || "").trim(),
      }))
      .filter((item) => item.topic.length > 0)
      .reduce((map, item) => {
        const key = item.topic.toLowerCase();
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
      }, new Map<string, ParentTopicState>())
      .values()
  );

  const fallbackTopics = Array.from(
    new Set([
      topicConditioning.topic,
      ...splitList(proposal?.currentTopics),
    ].map((value) => String(value || "").trim()).filter(Boolean))
  );

  const fallbackTopicCards = fallbackTopics.map((topic) => ({
    topic,
    phase: normalizePhaseLabel(topicConditioning.entryPhase),
    stability: normalizeStabilityLabel(topicConditioning.stability),
    lastUpdated: null,
    movement: "none" as const,
    bucket: "active" as const,
  }));

  const topicCards = normalizedTopicStates.length > 0
    ? normalizedTopicStates
    : isDiagnosisOnlyView
      ? fallbackTopicCards
      : [];
  const primaryDashboardTopic = topicCards[0] || null;
  const primaryDashboardPhase = normalizePhaseLabel(primaryDashboardTopic?.phase);
  const currentBreakpointTopics = (topicCards.filter((item) => item.bucket === "active").length > 0
    ? topicCards.filter((item) => item.bucket === "active")
    : topicCards
  ).map((item) => item.topic);
  const currentBreakpointSummary = formatListWithAnd(currentBreakpointTopics) || focusArea;
  const dashboardSignals = getDashboardSignalsForState(primaryDashboardPhase, isDiagnosisOnlyView);
  const parentRoleLines = getParentRoleLinesForState(primaryDashboardPhase, isDiagnosisOnlyView);
  const multiTopicObservationBlocks = topicCards.length > 1
    ? topicCards.map((item) => ({
        topic: item.topic,
        signals: getDashboardSignalsForState(normalizePhaseLabel(item.phase), isDiagnosisOnlyView).slice(0, 2),
      }))
    : [];
  const multiTopicParentRoleBlocks = topicCards.length > 1
    ? topicCards.map((item) => ({
        topic: item.topic,
        lines: getParentRoleLinesForState(normalizePhaseLabel(item.phase), isDiagnosisOnlyView).slice(-2),
      }))
    : [];
  const parentRoleNowLine = topicCards.length > 1
    ? `Read the topic cards individually because ${studentFirstName}'s current position is different across ${currentBreakpointSummary}.`
    : parentRoleLines[2] || parentRoleLines[0] || "Use the tutor and training plan as the operating reference.";
  const diagnosisCompletedCount = stats?.introDiagnosisCompleted || 0;
  const activeTopicCount = topicCards.filter((item) => item.bucket === "active").length;

  const sessionMarkers = isDiagnosisOnlyView
    ? [
        {
          label: "Intro Diagnosis Completed",
          value: diagnosisCompletedCount,
        },
        {
          label: "Training Sessions Completed",
          value: 0,
        },
      ]
    : [
        {
          label: "Intro Diagnosis Completed",
          value: diagnosisCompletedCount,
        },
        {
          label: "Training Sessions Completed",
          value: stats?.trainingSessionsCompleted || 0,
        },
      ];

  const trainingMarkers = isDiagnosisOnlyView
    ? []
    : [
        {
          label: "Active Topics In Conditioning",
          value: activeTopicCount > 0 ? activeTopicCount : topicCards.length,
        },
      ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-background p-5 sm:p-7">
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.08em] text-foreground/65">Parent Dashboard</p>
            <p className="text-sm text-foreground/70 mt-1.5">
              {isDiagnosisOnlyView
                ? `Hi ${firstParentName}, here is the current Response Integrity diagnosis view.`
                : `Hi ${firstParentName}, here is the live Response Integrity operating view.`}
            </p>
            <h1
              className="text-2xl sm:text-[2.1rem] font-semibold tracking-[-0.01em] leading-tight mt-2"
              style={{ fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif' }}
            >
              {isDiagnosisOnlyView ? `Current diagnosed starting point for ${studentName}` : `Current training state for ${studentName}`}
            </h1>
            <p className="text-sm sm:text-base text-foreground/75 mt-2.5 max-w-2xl leading-relaxed">
              {isDiagnosisOnlyView
                ? `Stay aligned with the starting position Response Integrity diagnosed before training sessions begin.`
                : `Stay aligned with how Response Integrity is training ${studentFirstName} right now.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {studentInfo?.grade && <Badge variant="outline" className="border-primary/30 bg-background/70">{formatParentGradeLabel(studentInfo.grade)}</Badge>}
            {studentInfo?.podName && <Badge className="bg-primary/90 text-primary-foreground">{studentInfo.podName}</Badge>}
          </div>
        </div>
      </div>

      <PushOptInCard
        enabled
        title="Enable out-of-app alerts"
        description="Turn on browser notifications so Response Integrity can alert you when reports are sent or when a tutor action needs your response."
      />

      {sessionsRemaining !== null && sessionsRemaining <= 2 && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
            sessionsRemaining <= 0
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span>
            {sessionsRemaining <= 0
              ? "This month's session quota is exhausted. Renew to schedule more sessions."
              : `${sessionsRemaining} session${sessionsRemaining === 1 ? "" : "s"} remaining this month before renewal is needed.`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={sessionsRemaining <= 0 ? "border-rose-300 text-rose-700 hover:bg-rose-100" : "border-amber-300 text-amber-800 hover:bg-amber-100"}
            onClick={() => navigate("/client/parent/gateway")}
          >
            {sessionsRemaining <= 0 ? "Renew Now" : "View Renewal"}
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl font-semibold tracking-[-0.01em]">Topic Focus</CardTitle>
          </CardHeader>
          <CardContent>
            {topicCards.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Topic cards appear as soon as a topic is activated or a scored session confirms its current state.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {topicCards.map((row) => {
                  const copy = parentCopyForState(row.phase, row.stability, isDiagnosisOnlyView);
                  const hasProgressUpdate = !isDiagnosisOnlyView && row.movement === "improved";

                  return (
                    <div key={`${row.topic}-${row.phase}-${row.stability}`} className="rounded-xl border border-primary/20 bg-background p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-base font-semibold tracking-tight text-foreground">{row.topic}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-primary/30 bg-background/80">
                            {stabilityIndicator(row.stability as StabilityLabel | null)}
                          </Badge>
                          {row.bucket === "recent" && (
                            <Badge variant="secondary">Recently Trained</Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-background/80">
                          Stage: {row.phase || "Unknown"}
                        </Badge>
                        <Badge variant="outline" className="border-primary/30 bg-background/80">
                          Stability: {row.stability || "Unknown"}
                        </Badge>
                      </div>

                      {hasProgressUpdate && (
                        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                          <p className="text-sm font-medium text-green-800">Progress Update</p>
                          <p className="text-xs text-green-700">Your child has improved in this topic this week.</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Current Status</p>
                          <p className="text-sm text-foreground leading-relaxed">{copy.status}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">What This Means</p>
                          <p className="text-sm text-foreground leading-relaxed">{copy.meaning}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Current Focus</p>
                          <p className="text-sm text-foreground leading-relaxed">{copy.focus}</p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">Last updated: {formatDateLabel(row.lastUpdated)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
                <UserRound className="w-5 h-5" />
                Tutor Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Assigned tutor</p>
                <p className="font-semibold text-foreground">{assignedTutor?.name || "Assigned through platform"}</p>
              </div>
              {assignedTutor?.bio && (
                <p className="text-muted-foreground">{assignedTutor.bio}</p>
              )}
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">Parent role now</p>
                <p className="font-medium text-foreground">{parentRoleNowLine}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Next System Step</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{currentStep.title}</p>
              <p className="text-muted-foreground leading-relaxed">{currentStep.description}</p>
              {showScheduledTime && (
                <p className="text-xs text-muted-foreground">Scheduled time: {nextSessionTime}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">How Topic Conditioning Progresses</CardTitle>
          <CardDescription>
            Each topic can sit at a different stage. The topic cards above show the current observed stage for each topic when known.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3">
            {PHASE_SEQUENCE.map((phase, idx) => {
              return (
                <div
                  key={phase}
                  className="rounded-lg border p-3 bg-background"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Stage {idx + 1}</p>
                  </div>
                  <p className="text-sm mt-2 font-medium leading-snug text-foreground">{phase}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Parent view note: stage is tracked per topic, not as one global student stage.{" "}
                <button
                  onClick={() => setTopicConditioningDialogOpen(true)}
                  className="text-primary hover:underline font-medium"
                >
                  What is Topic Conditioning?
                </button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">What is Being Observed</CardTitle>
            <CardDescription>
              {topicCards.length > 1
                ? "These observations vary by topic:"
                : isDiagnosisOnlyView
                  ? "The diagnosis is pointing to these observable targets:"
                  : "The current training is being tracked through these observable signals:"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topicCards.length > 1 ? (
              <div className="space-y-3">
                {multiTopicObservationBlocks.map((block) => (
                  <div key={block.topic} className="rounded-lg border border-primary/10 bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{block.topic}</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground leading-relaxed">
                      {block.signals.map((signal) => (
                        <li key={`${block.topic}-${signal}`}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                {dashboardSignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Parent Role</CardTitle>
            <CardDescription>
              {isDiagnosisOnlyView
                ? "What helps the diagnosed starting point become trainable once sessions begin:"
                : "What helps the system work as intended outside the session:"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topicCards.length > 1 ? (
              <div className="space-y-3">
                <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <li>Keep session attendance steady and protected.</li>
                  <li>Use the tutor and training plan as the operating reference.</li>
                </ul>
                {multiTopicParentRoleBlocks.map((block) => (
                  <div key={block.topic} className="rounded-lg border border-primary/10 bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{block.topic}</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground leading-relaxed">
                      {block.lines.map((line) => (
                        <li key={`${block.topic}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                {parentRoleLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Training Plan</CardTitle>
            <CardDescription>
              {isDiagnosisOnlyView
                ? "The accepted plan is the starting operating reference for this student."
                : "The accepted plan is the current operating reference for this student."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {proposal
                  ? isDiagnosisOnlyView
                    ? `Response Integrity is starting from ${studentFirstName}'s diagnosed breakpoint inside ${currentBreakpointSummary}.`
                    : `Response Integrity is operating from ${studentFirstName}'s current breakpoint inside ${currentBreakpointSummary}.`
                  : `The training plan is still being loaded for ${studentFirstName}.`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setProposalDialogOpen(true)} disabled={!proposal} className="sm:flex-1 bg-primary hover:bg-primary/90">
                View Full Training Plan
              </Button>
              {proposal?.parentCode && (
                <Button
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => navigator.clipboard.writeText(proposal.parentCode)}
                >
                  Copy Student Access Code
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Parent Controls</CardTitle>
            <CardDescription>Use these when you need to make the next move quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setProposalDialogOpen(true)}>
              Review Training Plan
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/client/parent/updates?tab=messages")}>
              Message Tutor
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate("/client/parent/progress?tab=analytics")}>
              View Analytics
            </Button>
            {proposal?.parentCode && (
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigator.clipboard.writeText(proposal.parentCode)}>
                Copy Student Code
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start text-sm"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-primary/20 bg-background shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Session Markers</CardTitle>
            <CardDescription> </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessionMarkers.map((item) => {
                return (
                  <div key={item.label} className="rounded-xl border border-primary/20 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-[-0.01em]">Training Markers</CardTitle>
            <CardDescription>
              {isDiagnosisOnlyView
                ? "Training markers will appear here once regular Response Integrity training sessions begin."
                : " "}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trainingMarkers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-primary/20 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                No training markers yet. This student has completed intro diagnosis, but live topic conditioning has not started.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trainingMarkers.map((item) => {
                  const displayValue = item.value ?? "Unknown";
                  return (
                    <div key={item.label} className="rounded-xl border border-primary/20 bg-muted/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground break-words">{displayValue}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {proposal && (
        <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{studentName} Training Plan</DialogTitle>
            </DialogHeader>
            <ProposalView proposal={proposal} topicStates={topicCards} forceDiagnosisView={isDiagnosisOnlyView} />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={topicConditioningDialogOpen} onOpenChange={setTopicConditioningDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Topic Conditioning in Response Integrity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
            <div>
              <h3 className="font-semibold text-base mb-2">What it is</h3>
              <p>
                Topic Conditioning is how Response Integrity uses the student's real school topics to train a stable response under pressure.
              </p>
              <ul className="mt-3 space-y-2 ml-4 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>It is not random tutoring.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>It is not extra practice.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>It is not "covering work."</span>
                </li>
              </ul>
              <p className="mt-3">It is this:</p>
              <ul className="mt-3 space-y-2 ml-4">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">1.</span>
                  <span>Take the topic the student is currently struggling with.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">2.</span>
                  <span>Find where their response breaks inside that topic.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">3.</span>
                  <span>Run the Response Integrity system until their response becomes stable.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">4.</span>
                  <span>That first diagnosis happens in the intro session. Training starts after the entry phase has been identified.</span>
                </li>
              </ul>
              <p className="mt-3 font-medium">That is Topic Conditioning.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2">The simplest way to understand it</h3>
              <p className="font-medium mb-2">A topic is the training arena.</p>
              <p className="mb-2">Examples:</p>
              <ul className="space-y-1 ml-4 mb-3">
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Fractions</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Algebra</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Exponents</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Word problems</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Linear equations</span></li>
              </ul>
              <p className="font-medium mb-2">The OS is the conditioning process.</p>
              <p className="mb-2">The phases are:</p>
              <ul className="space-y-1 ml-4">
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Clarity</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Structured Execution</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Controlled Discomfort</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Time Pressure Stability</span></li>
              </ul>
              <p className="mt-3">So Topic Conditioning means: A school topic becomes the arena where Response Integrity-OS trains the student's response.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2">Why this matters</h3>
              <p className="mb-3">Most tutoring asks: "Does the student understand this topic?"</p>
              <p className="mb-3 font-medium">Response Integrity asks a harder and more useful question:</p>
              <p className="mb-3 text-primary font-semibold">"In this topic, where does the student break?"</p>
              <p className="mb-3">That changes everything.</p>
              <p className="mb-2">Because a student can:</p>
              <ul className="space-y-1 ml-4 mb-3">
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>understand some parts of a topic</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>still freeze in that topic</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>still guess in that topic</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>still rush in that topic</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>still collapse under time in that topic</span></li>
              </ul>
              <p className="mb-2">So the real issue is not just topic knowledge.</p>
              <p className="font-medium">The real issue is:</p>
              <p className="mb-3">How the student behaves inside that topic when difficulty appears.</p>
              <p className="font-medium mb-3">That is what Response Integrity conditions.</p>
              <p className="mb-2 font-medium">Response Integrity is not trying to:</p>
              <ul className="space-y-1 ml-4 mb-3">
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>teach as much content as possible in one session</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>move through the syllabus as fast as possible</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>finish topics for the sake of progress</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>impress parents with volume</span></li>
              </ul>
              <p className="font-medium mb-2">Response Integrity is doing something more precise.</p>
              <p className="font-medium mb-3">Response Integrity is asking:</p>
              <ul className="space-y-1 ml-4">
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Inside this topic, is the student clear?</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Can they execute?</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Can they stay stable when difficulty appears?</span></li>
                <li className="flex gap-2"><span className="text-muted-foreground">•</span> <span>Can they stay stable when time pressure appears?</span></li>
              </ul>
              <p className="mt-3">If not, the topic is not conditioned yet.</p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2">The core structure</h3>
              <p className="mb-3">Topic Conditioning in Response Integrity works like this:</p>
              <ul className="space-y-2 ml-4 mb-3">
                <li className="flex gap-2">
                  <span className="font-medium min-w-20">Topic:</span>
                  <span>The exact school concept the student is facing now.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium min-w-20">Phase:</span>
                  <span>The point in the Response Integrity system where the student currently breaks in that topic.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium min-w-20">Stability:</span>
                  <span>How reliable the student's response is inside that topic.</span>
                </li>
              </ul>
              <p className="mb-3">Put together: Topic + Phase + Stability = Response Integrity conditioning map</p>
              <div className="rounded-lg border border-muted-foreground/20 p-3 bg-muted/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted-foreground/20">
                      <th className="text-left py-2 px-2 font-semibold">Topic</th>
                      <th className="text-left py-2 px-2 font-semibold">Phase</th>
                      <th className="text-left py-2 px-2 font-semibold">Stability</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-2 px-2">Algebraic expressions</td>
                      <td className="py-2 px-2">Structured Execution</td>
                      <td className="py-2 px-2">Low</td>
                    </tr>
                    <tr className="border-b border-muted-foreground/10">
                      <td className="py-2 px-2">Fractions</td>
                      <td className="py-2 px-2">Clarity</td>
                      <td className="py-2 px-2">Medium</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2">Exponents</td>
                      <td className="py-2 px-2">Time Pressure Stability</td>
                      <td className="py-2 px-2">High</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3">This is elite because it is precise.</p>
              <p className="mt-2 mb-2">It does not say: "The student is weak" or "The student struggles with math."</p>
              <p>It says: In this specific topic, the student's response breaks here. That is useful.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
