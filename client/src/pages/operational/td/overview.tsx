import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderKanban,
  Mail,
  Settings,
  Users,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BattleTestHistoryDialog from "@/components/battle-testing/BattleTestHistoryDialog";
import BattleTestRunnerDialog from "@/components/battle-testing/BattleTestRunnerDialog";
import StudentCommunicationDialog from "@/components/communications/StudentCommunicationDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StudentTopicConditioningDialog from "@/components/tutor/StudentTopicConditioningDialog";
import ViewAssignmentsDialog from "@/components/tutor/ViewAssignmentsDialog";
import ViewTrackingSystemsDialog from "@/components/tutor/ViewTrackingSystemsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { API_URL } from "@/lib/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  getBattleTestStateLabel,
  getBattleTestVariantKey,
  materializeBattleTestPhaseVariant,
  type BattleTestPhaseDefinition,
  type TutorBattleTestDeepDiveProgress,
  type BattleTestPhaseScore,
  type BattleTestRunHistoryItem,
  type BattleTestState,
  type BattleTestResponseInput,
  type PodBattleTestingSummary,
  TUTOR_BATTLE_TEST_PHASES,
} from "@shared/battleTesting";
import type { Pod, TutorAssignment, User } from "@shared/schema";

interface PodOverviewData {
  pod: Pod;
  tutors: (User & { assignment: TutorAssignment })[];
  totalStudents: number;
  totalSessions: number;
  battleTestingSummary: PodBattleTestingSummary;
}

interface ActiveTutorRunContext {
  podId: string;
  podName: string;
  assignmentId: string;
  tutorId: string;
  tutorName: string;
  autoSelectedPhases: string[];
  attemptsByPhase: Record<string, number>;
}

interface ActiveTutorHistoryContext {
  podId: string;
  tutorName: string;
  assignmentId: string;
}

interface StudentActionRecord {
  id: string;
  name: string;
  grade?: string | null;
  parentInfo?: any;
  struggleAreas?: string | null;
  topicConditioning?: any;
  topic_conditioning?: any;
  conceptMastery?: any;
  concept_mastery?: any;
}

type TutorAuditGroupKey = "transformation_phases" | "session_infrastructure";

const EMPTY_BATTLE_TESTING_SUMMARY: PodBattleTestingSummary = {
  podId: "",
  weeklyAlignmentPercent: null,
  driftIncidents: 0,
  lockedTutors: 0,
  watchlistTutors: 0,
  failTutors: 0,
  tdOperationalFlags: [],
  phaseWeaknesses: [],
  phaseScores: [],
  tutorSummaries: [],
  tdSummary: null,
};

function getTutorInitials(name?: string | null) {
  return String(name || "TD")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusColor(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-800 border-green-200"
    : "bg-blue-100 text-blue-800 border-blue-200";
}

function getOperationalModeBadge(mode?: string | null) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "certified_live") return "default";
  if (normalized === "suspended") return "destructive";
  return "secondary";
}

function formatOperationalModeLabel(mode?: string | null) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "certified_live") return "Certified Live";
  if (normalized === "sandbox") return "Sandbox Mode";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "applicant") return "Applicant";
  return "Training Mode";
}

function getTutorAuditGroupMeta(groupKey: TutorAuditGroupKey) {
  if (groupKey === "transformation_phases") {
    return {
      title: "Transformation Phases",
      description: "Recognition, execution, discomfort, time pressure, and topic conditioning.",
    };
  }

  return {
    title: "Session Infrastructure",
    description: "Intro flow, logging, session control, drill library, handover, and tools.",
  };
}

function getTutorAuditGroupKey(phaseKey: string): TutorAuditGroupKey {
  return [
    "clarity",
    "structured_execution",
    "controlled_discomfort",
    "time_pressure_stability",
    "topic_conditioning",
  ].includes(phaseKey)
    ? "transformation_phases"
    : "session_infrastructure";
}

function getDeepDiveProgressView(entry?: TutorBattleTestDeepDiveProgress | null) {
  if (!entry || entry.attemptsCount === 0) {
    return {
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      badgeLabel: "Not started",
      detail: "0/3 clean passes",
    };
  }

  if (entry.historicalState === "completed") {
    return {
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      badgeLabel: "Completed",
      detail: "3/3 clean passes",
    };
  }

  if (entry.currentHealthState === "drift" || entry.criticalFlag) {
    return {
      badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
      badgeLabel: "Drift",
      detail: `${entry.currentStreak}/3 clean passes`,
    };
  }

  if (entry.currentStreak === 2) {
    return {
      badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
      badgeLabel: "One pass away",
      detail: "2/3 clean passes",
    };
  }

  if (entry.currentStreak === 1) {
    return {
      badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
      badgeLabel: "Building streak",
      detail: "1/3 clean passes",
    };
  }

  return {
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    badgeLabel: "Retest needed",
    detail: "0/3 clean passes",
  };
}

function summarizeModuleDeepDiveProgress(
  deepDiveProgress: TutorBattleTestDeepDiveProgress[] | null | undefined,
  moduleKey: TutorAuditGroupKey
) {
  const moduleEntries = (deepDiveProgress || []).filter((entry) => entry.moduleKey === moduleKey);
  const completedCount = moduleEntries.filter((entry) => entry.historicalState === "completed").length;
  const onePassAwayCount = moduleEntries.filter((entry) => entry.historicalState !== "completed" && entry.currentStreak === 2).length;
  const buildingCount = moduleEntries.filter(
    (entry) => entry.historicalState !== "completed" && entry.currentStreak > 0 && entry.currentStreak < 2
  ).length;
  const retestCount = moduleEntries.filter(
    (entry) =>
      entry.historicalState !== "completed" &&
      entry.attemptsCount > 0 &&
      (entry.currentHealthState === "drift" || entry.criticalFlag || entry.currentStreak === 0)
  ).length;

  return {
    totalCount: moduleEntries.length,
    completedCount,
    onePassAwayCount,
    buildingCount,
    retestCount,
  };
}

export default function TDOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { podId } = useParams<{ podId?: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTutorRun, setActiveTutorRun] = useState<ActiveTutorRunContext | null>(null);
  const [activeTutorHistory, setActiveTutorHistory] = useState<ActiveTutorHistoryContext | null>(null);
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [topicConditioningDialogOpen, setTopicConditioningDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [selectedStudentRecord, setSelectedStudentRecord] = useState<StudentActionRecord | null>(null);
  const [expandedTutors, setExpandedTutors] = useState<Record<string, boolean>>({});
  const [expandedPodStats, setExpandedPodStats] = useState<Record<string, boolean>>({});
  const [expandedTutorDetails, setExpandedTutorDetails] = useState<Record<string, boolean>>({});
  const [expandedPhaseScores, setExpandedPhaseScores] = useState<Record<string, boolean>>({});
  const [expandedTutorsSection, setExpandedTutorsSection] = useState<Record<string, boolean>>({});
  const [expandedTutorAuditGroups, setExpandedTutorAuditGroups] = useState<Record<string, boolean>>({});

  const {
    data: podsData,
    isLoading,
    error,
  } = useQuery<PodOverviewData[]>({
    queryKey: ["/api/td/pod-overview"],
    enabled: isAuthenticated && !authLoading,
  });

  const { data: tutorBattleTestPhases = [] } = useQuery<BattleTestPhaseDefinition[]>({
    queryKey: ["/api/battle-tests/banks/tutor"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/battle-tests/banks/tutor");
      return response.json();
    },
  });
  const { data: podBattleTestRuns = [] } = useQuery<BattleTestRunHistoryItem[]>({
    queryKey: ["/api/battle-tests/pods", podId, "runs"],
    enabled: isAuthenticated && !authLoading && !!podId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/battle-tests/pods/${podId}/runs`);
      return response.json();
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [error, toast]);

  const activePhaseOptions = useMemo<BattleTestPhaseDefinition[]>(() => {
    const basePhases =
      !tutorBattleTestPhases.length || tutorBattleTestPhases.some((phase) => !phase.questions?.length)
        ? TUTOR_BATTLE_TEST_PHASES
        : tutorBattleTestPhases;

    if (!activeTutorRun) return basePhases;

    return basePhases.map((phase) =>
      materializeBattleTestPhaseVariant(
        phase,
        getBattleTestVariantKey(activeTutorRun.attemptsByPhase[phase.key] || 0)
      )
    );
  }, [activeTutorRun, tutorBattleTestPhases]);
  const groupedTutorPhaseOptions = useMemo(() => {
    const groups: Record<TutorAuditGroupKey, BattleTestPhaseDefinition[]> = {
      transformation_phases: [],
      session_infrastructure: [],
    };

    for (const phase of activePhaseOptions) {
      groups[getTutorAuditGroupKey(phase.key)].push(phase);
    }

    return groups;
  }, [activePhaseOptions]);
  const overviewBasePath = location.pathname.startsWith("/operational/td")
    ? "/operational/td/my-pods"
    : "/td/overview";
  const selectedPodData = podId ? podsData?.find((entry) => entry.pod.id === podId) : null;
  const latestTutorPhaseScoresByAssignment = useMemo(() => {
    const phaseMapByAssignment = new Map<string, Map<string, BattleTestPhaseScore>>();

    for (const run of podBattleTestRuns) {
      if (run.subjectType !== "tutor") continue;
      const runKeys = [run.tutorAssignmentId, run.subjectUserId].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      );
      if (!runKeys.length) continue;

      for (const runKey of runKeys) {
        if (!phaseMapByAssignment.has(runKey)) {
          phaseMapByAssignment.set(runKey, new Map<string, BattleTestPhaseScore>());
        }
      }

      for (const runKey of runKeys) {
        const assignmentPhaseMap = phaseMapByAssignment.get(runKey)!;
        for (const phaseScore of run.phaseScores || []) {
          if (!assignmentPhaseMap.has(phaseScore.phaseKey)) {
            assignmentPhaseMap.set(phaseScore.phaseKey, phaseScore);
          }
        }
      }
    }

    return phaseMapByAssignment;
  }, [podBattleTestRuns]);

  const submitTutorBattleTestMutation = useMutation({
    mutationFn: async ({
      podId,
      tutorAssignmentId,
      tutorId,
      phaseKeys,
      phaseVariants,
      responses,
    }: {
      podId: string;
      tutorAssignmentId: string;
      tutorId: string;
      phaseKeys: string[];
      phaseVariants: Record<string, string>;
      responses: BattleTestResponseInput[];
    }) => {
      await apiRequest("POST", `/api/td/pods/${podId}/tutor-battle-tests`, {
        tutorAssignmentId,
        tutorId,
        phaseKeys,
        phaseVariants,
        responses,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/td/pod-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle-tests/pods", variables.podId, "summary"] });
      toast({
        title: "Battle test saved",
        description: "Tutor alignment results were logged successfully.",
      });
    },
    onError: (mutationError: any) => {
      toast({
        title: "Battle test failed",
        description: mutationError?.message || "Unable to save the tutor battle test.",
        variant: "destructive",
      });
    },
  });

  const openStudentRecord = (student: StudentActionRecord) => {
    setSelectedStudentId(student.id);
    setSelectedStudentName(student.name);
    setSelectedStudentRecord(student);
  };

  const toggleTutorExpanded = (assignmentId: string) => {
    setExpandedTutors((current) => ({
      ...current,
      [assignmentId]: !current[assignmentId],
    }));
  };

  const togglePodStats = (podId: string) => {
    setExpandedPodStats((current) => ({
      ...current,
      [podId]: !current[podId],
    }));
  };

  const toggleTutorDetails = (assignmentId: string) => {
    const willExpand = !expandedTutorDetails[assignmentId];
    setExpandedTutorDetails((current) => ({
      ...current,
      [assignmentId]: willExpand,
    }));

    if (!willExpand) {
      setExpandedTutorAuditGroups((current) => {
        const next = { ...current };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${assignmentId}:`)) {
            delete next[key];
          }
        });
        return next;
      });
    }
  };

  const togglePhaseScores = (podId: string) => {
    setExpandedPhaseScores((current) => ({
      ...current,
      [podId]: !current[podId],
    }));
  };

  const toggleTutorsSection = (podId: string) => {
    setExpandedTutorsSection((current) => ({
      ...current,
      [podId]: !current[podId],
    }));
  };

  const toggleTutorAuditGroup = (assignmentId: string, groupKey: TutorAuditGroupKey) => {
    const stateKey = `${assignmentId}:${groupKey}`;
    setExpandedTutorAuditGroups((current) => ({
      ...current,
      [stateKey]: !current[stateKey],
    }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!podsData || !Array.isArray(podsData) || podsData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My Pods</h1>
        <Card className="p-12 text-center">
          <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">You are not assigned to any pods yet.</p>
        </Card>
      </div>
    );
  }

  if (podId && !selectedPodData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(overviewBasePath)}
            className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate flex-1">My Pods</h1>
        </div>
        <Card className="p-12 text-center">
          <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">This pod is not assigned to you or no longer exists.</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {!podId ? (
          <>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate flex-1">My Pods</h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {podsData.map((podData) => {
                const { pod, tutors, totalStudents, totalSessions } = podData;
                return (
                  <button
                    key={pod.id}
                    type="button"
                    onClick={() => navigate(`${overviewBasePath}/${pod.id}`)}
                    className="text-left"
                  >
                    <Card className="transition-all hover:border-primary/50 hover:shadow-md">
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold truncate">{pod.podName}</h2>
                            <p className="text-sm text-muted-foreground">
                              {pod.phase} phase - {pod.status}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-primary shrink-0">Open pod</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tutors</p>
                            <p className="mt-1 text-2xl font-semibold">{tutors.length}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Students</p>
                            <p className="mt-1 text-2xl font-semibold">{totalStudents}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sessions</p>
                            <p className="mt-1 text-2xl font-semibold">{totalSessions}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          (() => {
            const podData = selectedPodData!;
          const { pod, tutors, totalStudents, totalSessions } = podData;
          const battleTestingSummary: PodBattleTestingSummary = podData?.battleTestingSummary
            ? {
                ...EMPTY_BATTLE_TESTING_SUMMARY,
                ...podData.battleTestingSummary,
                podId: podData.battleTestingSummary.podId || pod.id,
                tutorSummaries: Array.isArray(podData.battleTestingSummary.tutorSummaries)
                  ? podData.battleTestingSummary.tutorSummaries
                  : [],
                phaseWeaknesses: Array.isArray(podData.battleTestingSummary.phaseWeaknesses)
                  ? podData.battleTestingSummary.phaseWeaknesses
                  : [],
                phaseScores: Array.isArray(podData.battleTestingSummary.phaseScores)
                  ? podData.battleTestingSummary.phaseScores
                  : [],
              }
            : {
                ...EMPTY_BATTLE_TESTING_SUMMARY,
                podId: pod.id,
              };
          return (
            <div key={pod.id} className="space-y-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(overviewBasePath)}
                  className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate flex-1">My Pods</h1>
              </div>

              {/* Pod Header */}
              <div>
                <h2 className="text-xl font-semibold text-foreground">{pod.podName}</h2>
                <p className="text-sm text-muted-foreground">
                  {pod.phase} phase - {pod.status}
                </p>
              </div>

              {/* Statistics Section */}
              <div className="coo-pod-stats grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card className="border-primary/15 bg-background shadow-sm">
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tutors</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                      {tutors.length}
                    </p>
                  </div>
                </Card>

                <Card className="border-primary/15 bg-background shadow-sm">
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Students</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                      {totalStudents}
                    </p>
                  </div>
                </Card>

                <Card className="border-primary/15 bg-background shadow-sm">
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sessions Done</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                      {totalSessions}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Pod Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Left Column */}
                <div className="space-y-3 sm:space-y-4">
                  {/* Status */}
                  <Card className="p-4 sm:p-6 border">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Status</p>
                    <div className="mt-2 sm:mt-3">
                      <Badge className={`${getStatusColor(pod.status)} border font-semibold text-xs`}>
                        {pod.status}
                      </Badge>
                    </div>
                  </Card>

                  {/* Battle Testing Summary */}
                  <Card className="p-4 sm:p-6 border">
                    <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Pod Integrity</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePodStats(pod.id)}
                        className="whitespace-nowrap"
                      >
                        {expandedPodStats[pod.id] ? "Hide stats" : "Show stats"}
                      </Button>
                    </div>

                    {expandedPodStats[pod.id] ? (
                      <div className="pt-4 border-t space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Weekly Alignment</p>
                            <p className="mt-1 text-lg font-semibold">
                              {battleTestingSummary.weeklyAlignmentPercent == null
                                ? "N/A"
                                : `${Math.round(battleTestingSummary.weeklyAlignmentPercent)}%`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Violation Spikes</p>
                            <p className="mt-1 text-lg font-semibold">{battleTestingSummary.driftIncidents}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">At Risk Tutors</p>
                            <p className="mt-1 text-lg font-semibold">{battleTestingSummary.watchlistTutors + battleTestingSummary.failTutors}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Locked Tutors</p>
                            <p className="mt-1 text-lg font-semibold">{battleTestingSummary.lockedTutors}</p>
                          </div>
                        </div>
                        {battleTestingSummary.tdOperationalFlags.length ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-900">
                              TD Accountability Flags
                            </p>
                            <div className="mt-2 space-y-1">
                              {battleTestingSummary.tdOperationalFlags.map((flag) => (
                                <p key={flag.phaseKey} className="text-sm text-amber-950">
                                  <span className="font-medium">{flag.title}</span>
                                  <span className="ml-2 text-amber-900">
                                    {flag.affectedTutors} tutors drifted in the last {flag.windowDays} days.
                                  </span>
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>

                </div>

                {/* Right Column - Tutors */}
                <div>
                  <Card className="p-4 sm:p-6 border">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between border-b pb-3 sm:pb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <h2 className="font-semibold text-sm sm:text-base">Assigned Tutors</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {tutors.length}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTutorsSection(pod.id)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                                expandedTutorsSection[pod.id] === false ? "" : "rotate-180"
                              }`}
                            />
                          </Button>
                        </div>
                      </div>

                      {/* Tutors List */}
                      {expandedTutorsSection[pod.id] === false ? null : (
                        tutors.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No tutors assigned yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tutors.map((tutor) => {
                              const tutorName = tutor.name || tutor.firstName || "Unknown Tutor";
                              const tutorAudit = battleTestingSummary.tutorSummaries.find(
                                (entry) =>
                                  entry.assignmentId === tutor.assignment.id ||
                                  entry.tutorId === tutor.id
                              );
                              const operationalMode =
                                tutorAudit?.mode ||
                                (tutor.assignment as any)?.operational_mode ||
                                (tutor.assignment as any)?.operationalMode ||
                                "training";
                              const latestPhaseScores =
                                Array.from(
                                  (
                                    latestTutorPhaseScoresByAssignment.get(tutor.assignment.id) ||
                                    latestTutorPhaseScoresByAssignment.get(tutor.id)
                                  )?.values() || []
                                ) || [];
                              const isExpanded = !!expandedTutors[tutor.assignment.id];

                              return (
                                <div
                                  key={tutor.assignment.id}
                                  className="border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors"
                                >
                                  <div className="p-3 sm:p-4">
                                    <div className="flex flex-col gap-3 sm:gap-4">
                                      <div className="flex items-start justify-between gap-2 sm:gap-4">
                                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-bold text-primary shrink-0">
                                          {getTutorInitials(tutorName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-sm sm:text-base truncate">{tutorName}</p>
                                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{tutor.email || "No email"}</p>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {((tutor.assignment as any)?.certification_status || "").toLowerCase() !== "pending" && (
                                              <Badge variant="outline">
                                                {(tutor.assignment as any)?.certification_status}
                                              </Badge>
                                            )}
                                            <Badge variant={getOperationalModeBadge(operationalMode)}>
                                              {formatOperationalModeLabel(operationalMode)}
                                            </Badge>
                                            <Badge className={getBattleTestStateBadgeClass(tutorAudit?.state)}>
                                              {getBattleTestStateLabel(tutorAudit?.state)}
                                            </Badge>
                                            <Badge variant="outline">
                                              {tutorAudit?.alignmentPercent == null
                                                ? "Audit N/A"
                                                : `Audit ${Math.round(tutorAudit.alignmentPercent)}%`}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                      <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="text-sm font-medium text-muted-foreground">Specialist Alignment</p>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleTutorDetails(tutor.assignment.id)}
                                            className="whitespace-nowrap"
                                          >
                                            {expandedTutorDetails[tutor.assignment.id] ? "Hide details" : "Show details"}
                                          </Button>
                                        </div>

                                        {expandedTutorDetails[tutor.assignment.id] ? (
                                          <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
                                            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                                              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                Tutor Audit
                                              </p>
                                              <div className="mt-3 space-y-3">
                                                {(["transformation_phases", "session_infrastructure"] as TutorAuditGroupKey[]).map((groupKey) => {
                                                  const groupMeta = getTutorAuditGroupMeta(groupKey);
                                                  const groupPhases = groupedTutorPhaseOptions[groupKey];
                                                  const moduleSummary = summarizeModuleDeepDiveProgress(tutorAudit?.deepDiveProgress, groupKey);
                                                  const expandKey = `${tutor.assignment.id}:${groupKey}`;
                                                  const isGroupExpanded = expandedTutorAuditGroups[expandKey] ?? false;

                                                  return (
                                                    <div key={expandKey} className="rounded-xl border border-border/60 bg-background/60">
                                                      <button
                                                        type="button"
                                                        onClick={() => toggleTutorAuditGroup(tutor.assignment.id, groupKey)}
                                                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30"
                                                      >
                                                        <div>
                                                          <p className="text-sm font-semibold text-foreground">{groupMeta.title}</p>
                                                          <p className="text-xs text-muted-foreground">{groupMeta.description}</p>
                                                          <p className="mt-1 text-xs text-muted-foreground">
                                                            {moduleSummary.completedCount}/{moduleSummary.totalCount} deep dives have reached 3/3 clean passes.
                                                          </p>
                                                        </div>
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-foreground shadow-sm">
                                                          {isGroupExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-foreground" />
                                                          ) : (
                                                            <ChevronDown className="h-4 w-4 text-foreground" />
                                                          )}
                                                        </div>
                                                      </button>
                                                      {isGroupExpanded ? (
                                                        <div className="grid gap-2 border-t border-border/60 px-3 py-3">
                                                          {groupPhases.map((phaseDefinition) => {
                                                            const phaseAudit =
                                                              latestPhaseScores.find(
                                                                (entry) => entry.phaseKey === phaseDefinition.key
                                                              ) ||
                                                              tutorAudit?.phaseScores?.find(
                                                                (entry) => entry.phaseKey === phaseDefinition.key
                                                              );
                                                            const deepDiveEntry =
                                                              tutorAudit?.deepDiveProgress?.find(
                                                                (entry) => entry.phaseKey === phaseDefinition.key
                                                              ) || null;
                                                            const deepDiveView = getDeepDiveProgressView(deepDiveEntry);

                                                            return (
                                                              <div
                                                                key={`${tutor.assignment.id}-${phaseDefinition.key}`}
                                                                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                                                              >
                                                                <div className="min-w-0">
                                                                  <span className="text-sm font-medium text-foreground">
                                                                    {phaseDefinition.title}
                                                                  </span>
                                                                  <p className="mt-1 text-xs text-muted-foreground">
                                                                    {deepDiveView.detail}
                                                                    {phaseAudit ? ` • Last score ${Math.round(phaseAudit.percent)}%` : ""}
                                                                  </p>
                                                                </div>
                                                                <Badge className={deepDiveView.badgeClass}>
                                                                  {deepDiveView.badgeLabel}
                                                                </Badge>
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                              <div className="mt-3 rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2 text-xs text-sky-950">
                                                Certification progress is earned deep dive by deep dive. A phase only counts as complete after 3 clean passes in a row.
                                              </div>
                                              {tutorAudit?.actionRequired ? (
                                                <p className="mt-3 text-sm text-muted-foreground">{tutorAudit.actionRequired}</p>
                                              ) : null}
                                              {tutorAudit?.deepDiveProgress?.some((entry) => entry.consecutiveDriftCount > 0) ? (
                                                <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2">
                                                  <p className="text-[10px] uppercase tracking-[0.08em] text-amber-900">Drift Pressure</p>
                                                  <p className="mt-1 text-xs text-amber-950">
                                                    {tutorAudit.deepDiveProgress
                                                      .filter((entry) => entry.consecutiveDriftCount > 0)
                                                      .map((entry) => `${entry.title} ${entry.consecutiveDriftCount}/3`)
                                                      .join(" • ")}
                                                  </p>
                                                </div>
                                              ) : null}
                                              {tutorAudit?.moduleProgress?.length ? (
                                                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                                  {(["transformation_phases", "session_infrastructure"] as TutorAuditGroupKey[]).map((groupKey) => {
                                                    const module = tutorAudit.moduleProgress?.find((entry) => entry.moduleKey === groupKey);
                                                    const moduleSummary = summarizeModuleDeepDiveProgress(tutorAudit.deepDiveProgress, groupKey);
                                                    const groupMeta = getTutorAuditGroupMeta(groupKey);

                                                    return (
                                                      <div
                                                        key={`${tutor.assignment.id}-${groupKey}`}
                                                        className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs text-foreground"
                                                      >
                                                        <span className="min-w-0 font-medium leading-4">{groupMeta.title}</span>
                                                        <span className="text-muted-foreground">
                                                          Derived module status: {module?.completedCount || 0}/{module?.totalCount || 0} deep dives completed
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                          {moduleSummary.onePassAwayCount > 0
                                                            ? `${moduleSummary.onePassAwayCount} one pass away`
                                                            : moduleSummary.buildingCount > 0
                                                              ? `${moduleSummary.buildingCount} building streak`
                                                              : moduleSummary.retestCount > 0
                                                                ? `${moduleSummary.retestCount} need streak rebuild`
                                                                : "No active streaks yet"}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ) : null}
                                              {tutorAudit?.nextBattleTests?.length ? (
                                                <div className="mt-3 rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                                                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                    Next Battle Test
                                                  </p>
                                                  <div className="mt-2 space-y-2">
                                                    {tutorAudit.nextBattleTests.map((entry) => (
                                                      <div key={`${tutor.assignment.id}-${entry.phaseKey}`} className="text-sm text-foreground">
                                                        <span className="font-medium">{entry.title}</span>
                                                        <span className="ml-2 text-muted-foreground">{entry.reason}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}
                                              {tutorAudit?.lastAuditAt ? (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                  Last audit: {formatAuditTimestamp(tutorAudit.lastAuditAt)}
                                                </p>
                                              ) : (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                  Last audit: Not yet recorded
                                                </p>
                                              )}
                                            </div>
                                            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                                              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                Tutor Controls
                                              </p>
                                              <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() =>
                                                    setActiveTutorHistory({
                                                      podId: pod.id,
                                                      tutorName,
                                                      assignmentId: tutor.assignment.id,
                                                    })
                                                  }
                                                >
                                                  Audit History
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  onClick={() => {
                                                    const tutorAudit = battleTestingSummary?.tutorSummaries.find(
                                                      (audit) =>
                                                        audit.assignmentId === tutor.assignment.id ||
                                                        audit.tutorId === tutor.id
                                                    );
                                                    setActiveTutorRun({
                                                      podId: pod.id,
                                                      podName: pod.podName,
                                                      assignmentId: tutor.assignment.id,
                                                      tutorId: tutor.id,
                                                      tutorName,
                                                      autoSelectedPhases: tutorAudit?.nextBattleTests?.map((test) => test.phaseKey) || [],
                                                      attemptsByPhase: Object.fromEntries(
                                                        (tutorAudit?.deepDiveProgress || []).map((entry) => [
                                                          entry.phaseKey,
                                                          entry.attemptsCount || 0,
                                                        ])
                                                      ),
                                                    });
                                                  }}
                                                >
                                                  Run Tutor Audit
                                                </Button>
                                              </div>
                                              <p className="mt-3 text-sm text-muted-foreground">
                                                {(tutor.assignment as any)?.student_count || 0} students assigned.
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-sm leading-6 text-muted-foreground">
                                            Expand to view audit summaries, risk details, and tutor controls.
                                          </p>
                                        )}

                                        <div className="flex items-center justify-between gap-3 pt-1">
                                          <p className="text-sm font-medium text-muted-foreground">Assigned Students</p>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleTutorExpanded(tutor.assignment.id)}
                                            className="whitespace-nowrap"
                                          >
                                            {isExpanded ? "Hide students" : "Show students"}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expanded Student Details */}
                                    {isExpanded && (
                                      <TDTutorStudentsSection
                                        tutorId={tutor.id}
                                        tutorName={tutorName}
                                        operationalMode={operationalMode}
                                        fallbackStudentCount={(tutor.assignment as any)?.student_count || 0}
                                        onViewAssignments={(student) => {
                                          openStudentRecord(student);
                                          setAssignmentsDialogOpen(true);
                                        }}
                                        onViewTrackingSystems={(student) => {
                                          openStudentRecord(student);
                                          setTrackingDialogOpen(true);
                                        }}
                                        onViewTopicConditioning={(student) => {
                                          openStudentRecord(student);
                                          setTopicConditioningDialogOpen(true);
                                        }}
                                        onViewCommunication={(student) => {
                                          openStudentRecord(student);
                                          setCommunicationDialogOpen(true);
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          );
          })()
        )}
      </div>

      <BattleTestRunnerDialog
        open={!!activeTutorRun}
        onOpenChange={(open) => {
          if (!open) setActiveTutorRun(null);
        }}
        title={
          activeTutorRun
            ? `Tutor Battle Test - ${activeTutorRun.tutorName}`
            : "Tutor Battle Test"
        }
        description={
          activeTutorRun
            ? `Run the Response Integrity Specialist Alignment Engine for ${activeTutorRun.tutorName} inside ${activeTutorRun.podName}. The system has auto-selected the highest priority deep dives for this session.`
            : "Run the Response Integrity Specialist Alignment Engine."
        }
        phaseOptions={activePhaseOptions}
        preSelectedPhaseKeys={activeTutorRun?.autoSelectedPhases?.length ? activeTutorRun.autoSelectedPhases : undefined}
        selectionMode={activeTutorRun?.autoSelectedPhases?.length ? "fixed" : "multiple"}
        submitLabel="Save Tutor Battle Test"
        onSubmit={async ({ selectedPhases, responses }) => {
          if (!activeTutorRun) return;
          await submitTutorBattleTestMutation.mutateAsync({
            podId: activeTutorRun.podId,
            tutorAssignmentId: activeTutorRun.assignmentId,
            tutorId: activeTutorRun.tutorId,
            phaseKeys: selectedPhases.map((phase) => phase.key),
            phaseVariants: Object.fromEntries(
              selectedPhases.map((phase) => [phase.key, phase.variantKey || "form_a"])
            ),
            responses,
          });
        }}
      />

      <BattleTestHistoryDialog
        open={!!activeTutorHistory}
        onOpenChange={(open) => {
          if (!open) setActiveTutorHistory(null);
        }}
        title={
          activeTutorHistory
            ? `Tutor Audit History - ${activeTutorHistory.tutorName}`
            : "Tutor Audit History"
        }
        description="Stored tutor battle-test runs and rep-level logging."
        historyQueryKey={
          activeTutorHistory
            ? `battle-test-runs-${activeTutorHistory.podId}`
            : "battle-test-runs"
        }
        historyEndpoint={
          activeTutorHistory
            ? `/api/battle-tests/pods/${activeTutorHistory.podId}/runs`
            : "/api/battle-tests/pods/unknown/runs"
        }
        filter={(run) =>
          !!activeTutorHistory && run.subjectType === "tutor" && run.tutorAssignmentId === activeTutorHistory.assignmentId
        }
      />

      <ViewAssignmentsDialog
        open={assignmentsDialogOpen}
        onOpenChange={setAssignmentsDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        apiBasePath="/api/td"
      />

      <ViewTrackingSystemsDialog
        open={trackingDialogOpen}
        onOpenChange={setTrackingDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        apiBasePath="/api/td"
      />

      <StudentTopicConditioningDialog
        open={topicConditioningDialogOpen}
        onOpenChange={setTopicConditioningDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        studentGrade={selectedStudentRecord?.grade || null}
        parentTopics={
          (Array.isArray(selectedStudentRecord?.parentInfo?.reported_topics)
            ? selectedStudentRecord.parentInfo.reported_topics.join(", ")
            : "") ||
          Object.keys((selectedStudentRecord?.parentInfo?.topic_response_symptoms as Record<string, unknown> | undefined) || {}).join(", ") ||
          Object.keys((selectedStudentRecord?.parentInfo?.topic_recommended_starting_phases as Record<string, unknown> | undefined) || {}).join(", ") ||
          (selectedStudentRecord?.struggleAreas as string) ||
          null
        }
        parentTopicSymptoms={
          selectedStudentRecord?.parentInfo?.topic_response_symptoms &&
          typeof selectedStudentRecord.parentInfo.topic_response_symptoms === "object"
            ? selectedStudentRecord.parentInfo.topic_response_symptoms
            : null
        }
        parentTopicRecommendations={
          selectedStudentRecord?.parentInfo?.topic_recommended_starting_phases &&
          typeof selectedStudentRecord.parentInfo.topic_recommended_starting_phases === "object"
            ? selectedStudentRecord.parentInfo.topic_recommended_starting_phases
            : null
        }
        topicConditioning={
          selectedStudentRecord?.topicConditioning ||
          selectedStudentRecord?.topic_conditioning ||
          null
        }
        persistedTopicStates={
          selectedStudentRecord?.conceptMastery?.topicConditioning?.topics ||
          selectedStudentRecord?.concept_mastery?.topicConditioning?.topics ||
          null
        }
        readOnly={true}
        mapOnly={true}
        apiBasePath="/api/td"
      />

      <StudentCommunicationDialog
        open={communicationDialogOpen}
        onOpenChange={setCommunicationDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        readOnly={true}
        apiBasePath="/api/td"
      />
    </>
  );
}

function getBattleTestStateBadgeClass(state: BattleTestState | string | null | undefined) {
  if (state === "locked") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (state === "watchlist") return "bg-amber-100 text-amber-900 border-amber-200";
  if (state === "fail") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatAuditTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TDTutorStudentsSectionProps {
  tutorId: string;
  tutorName: string;
  operationalMode: string;
  fallbackStudentCount: number;
  onViewAssignments: (student: StudentActionRecord) => void;
  onViewTrackingSystems: (student: StudentActionRecord) => void;
  onViewTopicConditioning: (student: StudentActionRecord) => void;
  onViewCommunication: (student: StudentActionRecord) => void;
}

function TDTutorStudentsSection({
  tutorId,
  tutorName,
  operationalMode,
  fallbackStudentCount,
  onViewAssignments,
  onViewTrackingSystems,
  onViewTopicConditioning,
  onViewCommunication,
}: TDTutorStudentsSectionProps) {
  const { data: students, isLoading } = useQuery<StudentActionRecord[]>({
    queryKey: [`/api/td/tutors/${tutorId}/students`],
    enabled: !!tutorId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const activeStudentCount = students?.length || fallbackStudentCount || 0;
  const [expandedStudentActions, setExpandedStudentActions] = useState<Record<string, boolean>>({});

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Assigned Students</p>
          <p className="text-sm text-muted-foreground">
            Drill down into the students currently assigned to {tutorName}.
          </p>
        </div>
        <Badge variant="outline">{activeStudentCount} students</Badge>
      </div>

      {/* Students List */}
      <div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !students || students.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-lg">
            No students assigned to this tutor yet
          </p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => {
              const initials = student.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={student.id}
                  className="p-3 sm:p-4 bg-muted/30 rounded-lg border"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border border-primary/20">
                      <AvatarFallback className="bg-accent text-foreground font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{student.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {student.grade || "No grade"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <p className="text-sm text-muted-foreground">
                      Tools for {student.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedStudentActions((current) => ({
                          ...current,
                          [student.id]: !current[student.id],
                        }))
                      }
                      className="whitespace-nowrap"
                    >
                      {expandedStudentActions[student.id] ? "Hide tools" : "Show tools"}
                    </Button>
                  </div>
                  {expandedStudentActions[student.id] ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onViewAssignments(student)}
                      >
                        <FileText className="w-3 h-3 mr-1.5" />
                        Assignments
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onViewTopicConditioning(student)}
                      >
                        <Settings className="w-3 h-3 mr-1.5" />
                        Topic Conditioning
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onViewTrackingSystems(student)}
                      >
                        <Calendar className="w-3 h-3 mr-1.5" />
                        Tracking Systems
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onViewCommunication(student)}
                      >
                        <Mail className="w-3 h-3 mr-1.5" />
                        Communication
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
