import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useNavigate } from "react-router-dom";

interface StudentStats {
  bossBattlesCompleted: number;
  solutionsUnlocked: number;
  totalSessions: number;
  currentStreak: number;
  confidenceLevel: number;
}

interface TopicConditioningState {
  topic: string | null;
  phase: string | null;
  stability: string | null;
  stage: string;
  lastUpdated: string | null;
}

interface StudentTopicState {
  topic: string;
  phase: string | null;
  stability: string | null;
  lastUpdated?: string | null;
  previousPhase?: string | null;
  previousStability?: string | null;
  movement?: "none" | "improved" | "regressed" | "changed";
  bucket?: "active" | "recent" | "older";
}

const PHASE_SEQUENCE = ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"] as const;
const STABILITY_SEQUENCE = ["Low", "Medium", "High", "High Maintenance"] as const;

type PhaseLabel = (typeof PHASE_SEQUENCE)[number];
type StabilityLabel = (typeof STABILITY_SEQUENCE)[number];

type StudentStateCopy = {
  status: string;
  meaning: string;
  focus: string;
  drillPurpose: string;
};

const STUDENT_STATE_ENGINE: Record<PhaseLabel, Record<StabilityLabel, StudentStateCopy>> = {
  Clarity: {
    Low: {
      status: "This topic is being rebuilt from the foundation.",
      meaning: "You are still locking in what the topic means, what the steps are, and how to recognize the problem type.",
      focus: "The goal is clean recognition and clear understanding before speed or pressure is added.",
      drillPurpose: "Build clear recognition of the topic, terms, and logic.",
    },
    Medium: {
      status: "This topic is starting to make sense more consistently.",
      meaning: "You can follow the explanation, but you still need reinforcement to apply it on your own.",
      focus: "The work is about repeating the correct structure until it becomes reliable.",
      drillPurpose: "Strengthen understanding until you can apply it without confusion.",
    },
    High: {
      status: "You understand this topic clearly.",
      meaning: "You can recognize the problem and explain the method with confidence.",
      focus: "The next step is building stronger independent execution.",
      drillPurpose: "Transition from understanding into independent problem-solving.",
    },
    "High Maintenance": {
      status: "Clarity is stable in this topic.",
      meaning: "You have held clear understanding long enough to move forward.",
      focus: "Training can now shift into structured execution.",
      drillPurpose: "Maintain clarity while preparing for execution training.",
    },
  },
  "Structured Execution": {
    Low: {
      status: "This topic is focused on correct method execution.",
      meaning: "You know the topic, but the steps are not yet consistent when you work independently.",
      focus: "The work is about following the structure correctly from start to finish.",
      drillPurpose: "Build a repeatable step-by-step solving method.",
    },
    Medium: {
      status: "Execution is getting more consistent.",
      meaning: "You can use the method in many cases, but not yet with full reliability.",
      focus: "Training is pushing for cleaner repetition and fewer breakdowns.",
      drillPurpose: "Strengthen consistency in the solving sequence.",
    },
    High: {
      status: "Execution is strong in this topic.",
      meaning: "You can solve with the right structure independently most of the time.",
      focus: "The next step is testing that structure under harder conditions.",
      drillPurpose: "Prepare the method to hold under challenge.",
    },
    "High Maintenance": {
      status: "Execution is stable in this topic.",
      meaning: "The structure is holding consistently and can now be pressured.",
      focus: "Training can now shift into controlled discomfort.",
      drillPurpose: "Maintain execution while preparing for harder problem conditions.",
    },
  },
  "Controlled Discomfort": {
    Low: {
      status: "This topic is being trained under difficulty.",
      meaning: "You can do the basics, but tougher versions of the problem still create hesitation or instability.",
      focus: "The goal is to stay calm, start correctly, and hold structure when the question feels uncomfortable.",
      drillPurpose: "Build stability when the work becomes unfamiliar or harder.",
    },
    Medium: {
      status: "You are improving under challenge.",
      meaning: "You can now handle harder questions more often, but pressure still affects consistency.",
      focus: "Training is increasing difficult exposure without letting structure collapse.",
      drillPurpose: "Strengthen calm, structured responses to harder questions.",
    },
    High: {
      status: "You are handling challenge well in this topic.",
      meaning: "You can stay structured and solve unfamiliar questions with good stability.",
      focus: "The next step is preparing that performance for time pressure.",
      drillPurpose: "Prepare stable challenge-performance for timed conditions.",
    },
    "High Maintenance": {
      status: "Challenge-performance is stable in this topic.",
      meaning: "You are holding structure even when the work becomes difficult.",
      focus: "Training can now shift into time-pressure stability.",
      drillPurpose: "Maintain challenge-performance while preparing for timed work.",
    },
  },
  "Time Pressure Stability": {
    Low: {
      status: "This topic is being trained under time pressure.",
      meaning: "You can solve the topic, but speed still causes structure or accuracy to break down.",
      focus: "The goal is to keep the same method while the time constraint is active.",
      drillPurpose: "Maintain structure and accuracy while working against time.",
    },
    Medium: {
      status: "Timed stability is improving.",
      meaning: "You are completing more work within time, but the pressure still creates inconsistency.",
      focus: "Training is building repeatable performance while the clock is active.",
      drillPurpose: "Strengthen consistency under active time pressure.",
    },
    High: {
      status: "You are performing well under time pressure.",
      meaning: "You can stay accurate and structured even when speed matters.",
      focus: "The work is now about maintaining this standard and transferring it across topics.",
      drillPurpose: "Maintain high-quality performance under timed conditions.",
    },
    "High Maintenance": {
      status: "Timed performance is stable in this topic.",
      meaning: "You have held structure and accuracy consistently under pressure.",
      focus: "Training is maintaining this level and expanding transfer.",
      drillPurpose: "Maintain top timed performance and transfer it broadly.",
    },
  },
};

function normalizeTopicText(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const first = String(parsed[0] || "").trim();
        return first || null;
      }
    } catch {
      return raw;
    }
  }

  return raw;
}

function normalizePhaseLabel(phase?: string | null): PhaseLabel | null {
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

function mediumStatusForNewStudent(phase: PhaseLabel): string {
  switch (phase) {
    case "Clarity":
      return "This topic is at medium clarity and is ready for guided practice.";
    case "Structured Execution":
      return "This topic is showing medium execution consistency and needs more practice.";
    case "Controlled Discomfort":
      return "This topic is showing medium control under challenge and needs more steady practice.";
    case "Time Pressure Stability":
      return "This topic is showing medium stability under time pressure and still needs training.";
    default:
      return "This topic is at medium stability and is ready for more practice.";
  }
}

function studentCopyForState(
  phase?: string | null,
  stability?: string | null,
  hasStartedTraining = true,
): StudentStateCopy {
  const normalizedPhase = normalizePhaseLabel(phase);
  const normalizedStability = normalizeStabilityLabel(stability);

  if (!normalizedPhase || !normalizedStability) {
    return {
      status: "This topic is active, but the current stage has not been confirmed yet.",
      meaning: "The topic is already in conditioning, but the scored phase and stability are not fully confirmed here yet.",
      focus: "The next logged drill will confirm the exact state and what needs reinforcing first.",
      drillPurpose: "Confirm the current stage of the topic and identify the first reinforcement target.",
    };
  }

  const baseCopy = STUDENT_STATE_ENGINE[normalizedPhase][normalizedStability];

  if (!hasStartedTraining && normalizedStability === "Medium") {
    return {
      ...baseCopy,
      status: mediumStatusForNewStudent(normalizedPhase),
    };
  }

  return baseCopy;
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

export default function StudentDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading, dataUpdatedAt } = useQuery<StudentStats>({
    queryKey: ["/api/student/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: studentInfo } = useQuery<any>({
    queryKey: ["/api/student/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: topicConditioningState } = useQuery<TopicConditioningState | null>({
    queryKey: ["/api/student/topic-conditioning-state"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const { data: topicStatesData } = useQuery<StudentTopicState[] | null>({
    queryKey: ["/api/student/topic-conditioning-states"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const conditioningTopic = normalizeTopicText(topicConditioningState?.topic);
  const normalizedPhase = normalizePhaseLabel(topicConditioningState?.phase);
  const normalizedStability = normalizeStabilityLabel(topicConditioningState?.stability);
  const safeTopicStates = Array.isArray(topicStatesData) ? topicStatesData : [];
  const normalizedTopicStates = Array.from(
    (safeTopicStates as StudentTopicState[])
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
      }, new Map<string, StudentTopicState & { phase: PhaseLabel | null; stability: StabilityLabel | null }>())
      .values()
  );

  const fallbackTopicCards = conditioningTopic
    ? [{
        topic: conditioningTopic,
        phase: normalizedPhase,
        stability: normalizedStability,
        lastUpdated: topicConditioningState?.lastUpdated || null,
        movement: "none" as const,
        bucket: "active" as const,
      }]
    : [];

  const topicCards = normalizedTopicStates.length > 0 ? normalizedTopicStates : fallbackTopicCards;

  const studentFirstName =
    studentInfo?.firstName ||
    String(studentInfo?.name || "").trim().split(/\s+/)[0] ||
    "Student";

  const trainingMarkers = [
    { label: "Sessions Completed", value: stats?.totalSessions || 0 },
    { label: "Challenge Exposure", value: stats?.bossBattlesCompleted || 0 },
    { label: "Structured Solutions", value: stats?.solutionsUnlocked || 0 },
    { label: "Topics In Conditioning", value: topicCards.length },
  ];

  const allCoreMetricsZero =
    (stats?.totalSessions || 0) === 0 &&
    (stats?.bossBattlesCompleted || 0) === 0 &&
    (stats?.solutionsUnlocked || 0) === 0;

  const hasStartedTraining = !allCoreMetricsZero;

  const updatedLabel = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : "Pending sync";

  const quickActions = [
    {
      title: "Sessions",
      description: "See your weekly Response Integrity schedule",
      path: "/client/student/sessions",
    },
    {
      title: "My Assignments",
      description: "Practice problems from your tutor",
      path: "/client/student/assignments",
    },
    {
      title: "Updates",
      description: "Messages and notes from your tutor",
      path: "/client/student/updates",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">
          Welcome back, {studentFirstName}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your training overview</p>
      </div>

      <Card className="border-primary/20 bg-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium tracking-[-0.01em]">Topic Focus</CardTitle>
          <CardDescription>The current observed state of the topics Response Integrity is conditioning right now.</CardDescription>
        </CardHeader>
        <CardContent>
          {topicCards.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Topic cards appear as soon as Response Integrity activates a topic in conditioning.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {topicCards.map((row) => {
                const copy = studentCopyForState(row.phase, row.stability, hasStartedTraining);
                const hasProgressUpdate = row.movement === "improved";

                return (
                  <div key={`${row.topic}-${row.phase}-${row.stability}`} className="rounded-xl border border-primary/20 bg-background p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-semibold tracking-tight text-foreground">{row.topic}</p>
                      {row.bucket === "recent" && (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">Recently Trained</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-primary/30 bg-background/80 px-3 py-1 text-xs text-foreground">
                        Stage: {row.phase || "Unknown"}
                      </span>
                      <span className="rounded-full border border-primary/30 bg-background/80 px-3 py-1 text-xs text-foreground">
                        Stability: {row.stability || "Unknown"}
                      </span>
                    </div>

                    {hasProgressUpdate && (
                      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                        <p className="text-sm font-medium text-green-800">Progress Update</p>
                        <p className="text-xs text-green-700">You have improved in this topic this week.</p>
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

      <Card className="border-primary/20 bg-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium tracking-[-0.01em]">Training Markers</CardTitle>
          <CardDescription>Signals from your active sessions and conditioning work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trainingMarkers.map((item) => (
              <div key={item.label} className="rounded-xl border border-primary/20 bg-muted/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl md:text-3xl font-semibold tabular-nums text-foreground break-words">{item.value}</p>
              </div>
            ))}
          </div>

          {allCoreMetricsZero && (
            <div className="rounded-lg border border-primary/15 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              No sessions have been logged yet. Your tutor will update these markers after your first session.
            </div>
          )}

          <p className="text-xs text-muted-foreground">Last updated: {updatedLabel}</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            className="border-primary/15 bg-background cursor-pointer transition-colors hover:bg-muted/10"
            onClick={() => navigate(action.path)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium tracking-[-0.01em]">{action.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
