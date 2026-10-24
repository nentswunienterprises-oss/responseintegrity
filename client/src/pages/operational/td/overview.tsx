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
import { SandboxReadinessAssessmentCard } from "@/components/sandbox/SandboxReadinessAssessmentCard";
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

type SpecialistDevelopmentCardRecord = {
  currentStage:
    | "application"
    | "training"
    | "sandbox"
    | "practicals"
    | "trial"
    | "certification"
    | "certified_live";
  assignment: {
    operationalMode: string;
    certificationStatus: string;
  };
  pathway: {
    timeline: {
      state: string;
      elapsedDays: number;
      daysRemaining: number;
      effectiveEndsAt: string;
      canContinue: boolean;
    };
  } | null;
};

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

function formatOperationalModeLabel(mode?: string | null) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "certified_live") return "Certified Live";
  if (normalized === "sandbox") return "Sandbox";
  if (normalized === "trial") return "Trial";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "applicant") return "Applicant";
  if (normalized === "training") return "Training";
  if (!normalized) return "Not recorded";
  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDevelopmentStageLabel(stage?: string | null) {
  const normalized = String(stage || "").trim().toLowerCase();
  if (normalized === "certified_live") return "Certified Live";
  if (normalized === "practicals") return "Practicals";
  if (normalized === "certification") return "Certification";
  if (normalized === "trial") return "Trial";
  if (normalized === "sandbox") return "Sandbox";
  if (normalized === "training") return "Training";
  return "Application";
}

function SpecialistDevelopmentCardSummary({
  summary,
  isLoading,
  isUnavailable,
  onOpen,
}: {
  summary?: SpecialistDevelopmentCardRecord;
  isLoading: boolean;
  isUnavailable: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="border-y border-border/60 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Development
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {isLoading
                ? "Loading stage..."
                : isUnavailable || !summary
                  ? "Record unavailable"
                  : formatDevelopmentStageLabel(summary.currentStage)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={onOpen}
        >
          Development Record
        </Button>
      </div>
    </div>
  );
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

  const {
    data: specialistDevelopmentSummaries = {},
    isLoading: specialistDevelopmentSummariesLoading,
    isError: specialistDevelopmentSummariesError,
  } = useQuery<Record<string, SpecialistDevelopmentCardRecord>>({
    queryKey: ["/api/td/pods", podId, "specialist-development-summaries"],
    enabled: isAuthenticated && !authLoading && !!podId,
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/td/pods/${encodeURIComponent(String(podId || ""))}/specialist-development-summaries`,
      );
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


                </div>

                {/* Right Column - Tutors */}
                <div>
                  <Card className="p-4 sm:p-6 border">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between border-b pb-3 sm:pb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <h2 className="font-semibold text-sm sm:text-base">Assigned Specialists</h2>
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
                            <p className="text-sm">No Specialists assigned yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tutors.map((tutor) => {
                              const tutorName = tutor.name || tutor.firstName || "Unknown Specialist";
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
                                        </div>
                                      </div>
                                    </div>
                                      <div className="flex flex-col gap-3">
                                        <SpecialistDevelopmentCardSummary
                                          summary={specialistDevelopmentSummaries[tutor.id]}
                                          isLoading={specialistDevelopmentSummariesLoading}
                                          isUnavailable={specialistDevelopmentSummariesError}
                                          onOpen={() =>
                                            navigate(
                                              `/operational/td/my-pods/${pod.id}/specialists/${tutor.id}/development`,
                                            )
                                          }
                                        />

                                        {String(operationalMode || "").toLowerCase() === "sandbox" ? (
                                          <SandboxReadinessAssessmentCard
                                            tutorId={tutor.id}
                                            tutorName={tutorName}
                                            operationalMode={operationalMode}
                                          />
                                        ) : null}

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



