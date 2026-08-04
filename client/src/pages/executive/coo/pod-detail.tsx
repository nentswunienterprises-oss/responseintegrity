import { useEffect, useMemo, useState } from "react";
import "./pod-detail.mobile.css";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import BattleTestRunnerDialog from "@/components/battle-testing/BattleTestRunnerDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Activity,
  ArrowLeft,
  Users,
  Calendar,
  Settings,
  Trash2,
  Plus,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  UserMinus,
  School,
  Wifi,
  CalendarDays,
  Target,
  CircleAlert,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type TutorAuditGroupKey = "transformation_phases" | "session_infrastructure";

function formatPhaseLabel(value: string | null | undefined) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

function getBattleTestStateBadgeClass(state: string | null | undefined) {
  if (state === "locked") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (state === "watchlist") return "bg-amber-100 text-amber-900 border-amber-200";
  if (state === "fail") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
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
  return "Training";
}

function resolveTutorMode(assignmentMode?: string | null) {
  const normalizedAssignment = String(assignmentMode || "").toLowerCase();
  if (normalizedAssignment === "certified_live") return "certified_live";
  if (normalizedAssignment === "sandbox") return "sandbox";
  if (normalizedAssignment === "applicant") return "applicant";
  if (normalizedAssignment === "suspended") return "suspended";
  if (normalizedAssignment === "training") return "training";
  // Legacy/invalid values (including "watchlist") should not become the mode.
  return "training";
}

function getTutorActualMode(
  assignment: any,
  preferredMode?: string | null
) {
  return resolveTutorMode(
    preferredMode ||
      assignment.operational_mode ||
      assignment.operationalMode ||
      assignment.mode
  );
}

function isTutorEligibleForParentAssignment(mode?: string | null) {
  const normalized = String(mode || "").toLowerCase();
  return normalized === "certified_live" || normalized === "sandbox";
}

function getOperatingStateBadgeClass(stateKey?: string | null) {
  if (stateKey === "certified_live") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (stateKey === "sandbox_training") return "bg-sky-100 text-sky-800 border-sky-200";
  if (stateKey === "training_plant") return "bg-slate-100 text-slate-800 border-slate-200";
  if (stateKey === "misaligned") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-muted text-muted-foreground border-border";
}

function formatModeCapability(mode?: string | null) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "certified_live") return "Live parents allowed";
  if (normalized === "sandbox") return "Sandbox-only parents";
  if (normalized === "suspended") return "Removed from active responsibility";
  if (normalized === "applicant") return "Onboarding not complete";
  return "Training only";
}

function getTutorResponsibilityView(
  mode: string | null | undefined,
  counts: {
    sandboxParentCount?: number | null;
    liveParentCount?: number | null;
    awaitingTutorAcceptanceCount?: number | null;
  }
) {
  const normalized = String(mode || "").toLowerCase();
  const sandboxCount = counts.sandboxParentCount || 0;
  const liveCount = counts.liveParentCount || 0;
  const awaitingCount = counts.awaitingTutorAcceptanceCount || 0;

  if (normalized === "certified_live") {
    return {
      title: "Current Responsibility",
      primary: `${liveCount} live parent${liveCount === 1 ? "" : "s"}`,
      secondary: sandboxCount > 0 ? `${sandboxCount} sandbox assignment${sandboxCount === 1 ? "" : "s"} should be reviewed` : "Sandbox lane inactive",
      toneClass: "border-emerald-200/70 bg-emerald-50/40",
    };
  }

  if (normalized === "sandbox") {
    return {
      title: "Current Responsibility",
      primary: `${sandboxCount} sandbox parent${sandboxCount === 1 ? "" : "s"}`,
      secondary: liveCount > 0 ? `${liveCount} live assignment${liveCount === 1 ? "" : "s"} should not be here` : "Live parent assignments blocked",
      toneClass: "border-sky-200/70 bg-sky-50/40",
    };
  }

  if (normalized === "suspended") {
    return {
      title: "Current Responsibility",
      primary: "No active responsibility",
      secondary: "Tutor is suspended from assignment-bearing work",
      toneClass: "border-rose-200/70 bg-rose-50/40",
    };
  }

  if (normalized === "applicant") {
    return {
      title: "Current Responsibility",
      primary: "No parent responsibility yet",
      secondary: "Onboarding must complete before training assignments open",
      toneClass: "border-slate-200/70 bg-slate-50/50",
    };
  }

  return {
    title: "Current Responsibility",
    primary: "No parent responsibility yet",
    secondary: awaitingCount > 0 ? `${awaitingCount} acceptance item${awaitingCount === 1 ? "" : "s"} pending` : "Tutor is still in pre-sandbox training",
    toneClass: "border-slate-200/70 bg-slate-50/50",
  };
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

function formatAuditTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function extractLegacySymptomsFromParentNote(rawValue: string | null | undefined) {
  const normalized = String(rawValue || "")
    .replace(/process alignment:\s*yes/gi, "")
    .replace(/process alignment:\s*no/gi, "")
    .replace(/observed response symptoms:\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;\s]+/, "")
    .trim()
    .toLowerCase();
  if (!normalized) return [];

  const knownLabels = RESPONSE_SYMPTOM_GROUPS.flatMap((group) => group.options.map((option) => option.label))
    .filter((label) => !/^none of the above$/i.test(label) && !/^i don't know \/ not sure$/i.test(label))
    .sort((a, b) => b.length - a.length);

  return knownLabels.filter((label) => normalized.includes(label.toLowerCase()));
}
import { apiRequest, queryClient } from "@/lib/queryClient";
import { API_URL } from "@/lib/config";
import { isUnauthorizedError } from "@/lib/authUtils";
import StudentIdentitySheet from "@/components/tutor/StudentIdentitySheet";
import ViewAssignmentsDialog from "@/components/tutor/ViewAssignmentsDialog";
import ViewTrackingSystemsDialog from "@/components/tutor/ViewTrackingSystemsDialog";
import StudentTopicConditioningDialog from "@/components/tutor/StudentTopicConditioningDialog";
import StudentCommunicationDialog from "@/components/communications/StudentCommunicationDialog";
import type { Pod, User } from "@shared/schema";
import { RESPONSE_SYMPTOM_GROUPS } from "@shared/responseSymptomMapping";
import {
  getBattleTestStateLabel,
  type BattleTestPhaseScore,
  type BattleTestPhaseDefinition,
  type BattleTestRunHistoryItem,
  type TutorBattleTestDeepDiveProgress,
  type BattleTestResponseInput,
  type PodBattleTestingSummary,
} from "@shared/battleTesting";

const MAX_TUTORS_PER_POD = 12;
const getMaxStudentsPerTutorForVehicle = (vehicle?: string | null) => {
  switch (vehicle) {
    case "6_seater":
      return 6;
    case "5_seater":
      return 5;
    case "4_seater":
    default:
      return 4;
  }
};

interface ParentEnrollment {
  id: string;
  parent_full_name: string;
  parent_email: string;
  parent_phone: string;
  parent_city: string;
  student_full_name: string;
  student_grade: string;
  school_name: string;
  previous_tutoring?: string | null;
  internet_access?: string | null;
  parent_motivation?: string | null;
  status: string;
  created_at?: string | null;
  parentInfo?: {
    reported_topics?: string[];
    response_symptoms?: string[];
    topic_response_symptoms?: Record<string, string[]>;
    topic_recommended_starting_phases?: Record<
      string,
      {
        phase?: string | null;
        supportingSymptoms?: string[];
        rationale?: string | null;
      }
    >;
  };
}

export default function PodDetail() {
  const { podId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [addTutorsOpen, setAddTutorsOpen] = useState(false);
  const [selectedTutorIds, setSelectedTutorIds] = useState<string[]>([]);
  const [tutorToRemove, setTutorToRemove] = useState<string | null>(null);
  const [expandedTutors, setExpandedTutors] = useState<Set<string>>(new Set());
  const [expandedTutorDetails, setExpandedTutorDetails] = useState<Record<string, boolean>>({});
  const [expandedTutorAuditGroups, setExpandedTutorAuditGroups] = useState<Record<string, boolean>>({});
  const [podIntegrityExpanded, setPodIntegrityExpanded] = useState(false);
  const [tutorsSectionExpanded, setTutorsSectionExpanded] = useState(true);
  
  // Student dialog state
  const [identitySheetOpen, setIdentitySheetOpen] = useState(false);
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [topicConditioningDialogOpen, setTopicConditioningDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [selectedStudentRecord, setSelectedStudentRecord] = useState<any | null>(null);
  const [tdBattleTestOpen, setTdBattleTestOpen] = useState(false);
  if (!podId) {
    navigate("/coo/pods");
    return null;
  }

  // @ts-ignore - React Query generic inference issue, safe at runtime
  const { data: pods, isLoading: podLoading } = useQuery<Pod[]>({
    queryKey: ["/api/coo/pods"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const currentPod: Pod | undefined = pods?.find((p: Pod) => p.id === podId);

  const {
    data: tds,
    isLoading: tdsLoading,
  } = useQuery<User[]>({
    queryKey: ["/api/coo/tds"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const {
    data: approvedTutors,
    isLoading: tutorsLoading,
  } = useQuery<User[]>({
    queryKey: ["/api/coo/approved-tutors"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const {
    data: assignedTutorIds,
    isLoading: assignedTutorsLoading,
  } = useQuery<string[]>({
    queryKey: ["/api/coo/all-tutor-assignments"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const {
    data: podTutors,
    isLoading: podTutorsLoading,
    refetch: refetchPodTutors,
  } = useQuery<any[]>({
    queryKey: [`/api/coo/pods/${podId}/tutors`],
    enabled: isAuthenticated && !authLoading && !!podId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const {
    data: podStats,
    isLoading: statsLoading,
  } = useQuery<{ totalTutors: number; totalStudents: number; sessionsCompleted: number }>({
    queryKey: [`/api/coo/pods/${podId}/stats`],
    enabled: isAuthenticated && !authLoading && !!podId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: podOperatingOverview = [] } = useQuery<any[]>({
    queryKey: ["/api/coo/pods/operating-overview"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const {
    data: battleTestingSummary,
    isLoading: battleTestingLoading,
  } = useQuery<PodBattleTestingSummary>({
    queryKey: [`/api/battle-tests/pods/${podId}/summary`],
    enabled: isAuthenticated && !authLoading && !!podId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: tdBattleTestPhases = [] } = useQuery<BattleTestPhaseDefinition[]>({
    queryKey: ["/api/battle-tests/banks/td"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/battle-tests/banks/td");
      return response.json();
    },
  });
  const { data: tutorBattleTestPhases = [] } = useQuery<BattleTestPhaseDefinition[]>({
    queryKey: ["/api/battle-tests/banks/tutor"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/battle-tests/banks/tutor");
      return response.json();
    },
  });
  const groupedTutorPhaseOptions = useMemo(() => {
    const groups: Record<TutorAuditGroupKey, BattleTestPhaseDefinition[]> = {
      transformation_phases: [],
      session_infrastructure: [],
    };

    tutorBattleTestPhases.forEach((phase) => {
      groups[getTutorAuditGroupKey(phase.key)].push(phase);
    });

    return groups;
  }, [tutorBattleTestPhases]);
  const { data: podBattleTestRuns = [] } = useQuery<BattleTestRunHistoryItem[]>({
    queryKey: [`/api/battle-tests/pods/${podId}/runs`],
    enabled: isAuthenticated && !authLoading && !!podId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/battle-tests/pods/${podId}/runs`);
      return response.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: enrollments = [] } = useQuery<ParentEnrollment[]>({
    queryKey: ["/api/hr/enrollments"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate("/");
      }, 1000);
    }
  }, [authLoading, isAuthenticated, navigate, toast]);

  useEffect(() => {
    console.log("Pod detail data loaded:");
    console.log("  - assignedTutorIds:", assignedTutorIds);
    console.log("  - assignedTutorsLoading:", assignedTutorsLoading);
    console.log("  - approvedTutors:", approvedTutors?.length);
    console.log("  - tutorsLoading:", tutorsLoading);
  }, [assignedTutorIds, assignedTutorsLoading, approvedTutors, tutorsLoading]);

  const removeTutorMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("DELETE", `/api/coo/pods/${podId}/tutors/${assignmentId}`);
    },
    onSuccess: () => {
      refetchPodTutors();
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/all-tutor-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/approved-tutors"] });
      setTutorToRemove(null);
      toast({
        title: "Success",
        description: "Tutor removed from pod.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove tutor from pod.",
        variant: "destructive",
      });
    },
  });

  const unassignStudentMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      await apiRequest("POST", `/api/hr/enrollments/${enrollmentId}/unassign-tutor`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coo/pods/${podId}/tutors`] });
      queryClient.invalidateQueries({ queryKey: [`/api/coo/pods/${podId}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      toast({
        title: "Student unassigned",
        description: "Student was unassigned safely and preserved for reassignment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unassign failed",
        description: error?.message || "Failed to unassign student.",
        variant: "destructive",
      });
    },
  });

  const assignAwaitingEnrollmentMutation = useMutation({
    mutationFn: async ({ enrollmentId, tutorId }: { enrollmentId: string; tutorId: string }) => {
      await apiRequest("POST", `/api/hr/enrollments/${enrollmentId}/assign-tutor`, {
        tutorId,
        podId,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/enrollments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/coo/pods/${podId}/tutors`] });
      queryClient.invalidateQueries({ queryKey: [`/api/coo/pods/${podId}/stats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/coo/tutors/${variables.tutorId}/students`] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      toast({
        title: "Parent assigned",
        description: "The parent was assigned to the tutor from this pod view.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error?.message || "Failed to assign parent to tutor.",
        variant: "destructive",
      });
    },
  });

  const addTutorsMutation = useMutation({
    mutationFn: async (tutorIds: string[]) => {
      await apiRequest("POST", `/api/coo/pods/${podId}/tutors`, { tutorIds });
    },
    onSuccess: () => {
      refetchPodTutors();
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      setAddTutorsOpen(false);
      setSelectedTutorIds([]);
      toast({
        title: "Success",
        description: "Tutors added to pod.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add tutors to pod.",
        variant: "destructive",
      });
    },
  });

  // Delete Pod mutation (soft delete)
  const deletePodMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/coo/pods/${podId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/tds"] });
      toast({ title: "Pod deleted", description: "Pod deleted successfully." });
      navigate("/coo/pods");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete pod.", variant: "destructive" });
    },
  });

  const submitTdBattleTestMutation = useMutation({
    mutationFn: async ({ responses }: { responses: BattleTestResponseInput[] }) => {
      if (!(currentPod as Pod).tdId) {
        throw new Error("This pod has no TD assigned.");
      }
      await apiRequest("POST", `/api/coo/pods/${podId}/td-battle-tests`, {
        tdId: (currentPod as Pod).tdId,
        responses,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/battle-tests/pods/${podId}/summary`] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      toast({
        title: "TD battle test saved",
        description: "TD system-integrity results were logged successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "TD battle test failed",
        description: error?.message || "Failed to save TD battle test.",
        variant: "destructive",
      });
    },
  });

  const getTDName = (tdId: string | null) => {
    if (!tdId) return "Unassigned";
    return tds?.find((td) => td.id === tdId)?.name || "Unknown";
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getCertificationColor = (status: string) => {
    switch (status) {
      case "passed":
        return "bg-emerald-100 text-emerald-700 border border-emerald-300";
      case "failed":
        return "bg-red-100 text-red-700 border border-red-300";
      default:
        return "bg-amber-100 text-amber-700 border border-amber-300";
    }
  };

  const toggleTutorExpand = (tutorId: string) => {
    const newExpanded = new Set(expandedTutors);
    if (newExpanded.has(tutorId)) {
      newExpanded.delete(tutorId);
    } else {
      newExpanded.add(tutorId);
    }
    setExpandedTutors(newExpanded);
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

  const toggleTutorAuditGroup = (assignmentId: string, groupKey: TutorAuditGroupKey) => {
    const stateKey = `${assignmentId}:${groupKey}`;
    setExpandedTutorAuditGroups((current) => ({
      ...current,
      [stateKey]: !current[stateKey],
    }));
  };

  const togglePodIntegrity = () => {
    setPodIntegrityExpanded((current) => !current);
  };

  const toggleTutorsSection = () => {
    setTutorsSectionExpanded((current) => !current);
  };

  const latestTutorPhaseScoresByAssignment = useMemo(() => {
    const phaseMapByAssignment = new Map<string, Map<string, BattleTestPhaseScore>>();

    for (const run of podBattleTestRuns) {
      if (run.subjectType !== "tutor" || !run.tutorAssignmentId) continue;

      if (!phaseMapByAssignment.has(run.tutorAssignmentId)) {
        phaseMapByAssignment.set(run.tutorAssignmentId, new Map<string, BattleTestPhaseScore>());
      }

      const assignmentPhaseMap = phaseMapByAssignment.get(run.tutorAssignmentId)!;
      for (const phaseScore of run.phaseScores || []) {
        if (!assignmentPhaseMap.has(phaseScore.phaseKey)) {
          assignmentPhaseMap.set(phaseScore.phaseKey, phaseScore);
        }
      }
    }

    return phaseMapByAssignment;
  }, [podBattleTestRuns]);

  if (podLoading || tdsLoading || tutorsLoading || authLoading || statsLoading || battleTestingLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-48" />
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-1 h-64" />
            <Skeleton className="lg:col-span-2 h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!pods) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Pod not found</p>
          <Button onClick={() => navigate("/coo/pods")}>Back to Pods</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentPod) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Pod not found</p>
          <Button onClick={() => navigate("/coo/pods")}>Back to Pods</Button>
        </div>
      </DashboardLayout>
    );
  }

  const podName = (currentPod as Pod).podName;
  const tdName = getTDName((currentPod as Pod).tdId);
  const tutorCount = podTutors?.length || 0;
  const maxTutors = MAX_TUTORS_PER_POD;
  const availableSlots = maxTutors - tutorCount;
  const maxStudentsPerTutor = getMaxStudentsPerTutorForVehicle((currentPod as Pod).vehicle);
  const operatingOverview = podOperatingOverview.find((entry: any) => entry.podId === podId);

  // Debug logging
  console.log("Approved tutors:", approvedTutors?.map((t: any) => ({ id: t.id, name: t.name })));
  console.log("Assigned tutor IDs (raw):", assignedTutorIds);
  console.log("Is assignedTutorIds an array?", Array.isArray(assignedTutorIds));
  console.log("Assigned tutor IDs type:", typeof assignedTutorIds);
  
  const availableTutors = approvedTutors?.filter((tutor) => {
    // Ensure we're comparing strings to strings
    const tutorIdStr = String(tutor.id).trim();
    const isInList = assignedTutorIds && assignedTutorIds.length > 0 
      ? assignedTutorIds.some(id => String(id).trim() === tutorIdStr)
      : false;
    
    if (!isInList) {
      console.log(`[available] ${tutor.name} (${tutor.id}): NOT assigned - will show in dialog`);
    } else {
      console.log(`[assigned] ${tutor.name} (${tutor.id}): ASSIGNED - will NOT show in dialog`);
    }
    return !isInList;
  }) || [];

  const awaitingAssignments = enrollments.filter(
    (enrollment) => String(enrollment.status || "").toLowerCase().trim() === "awaiting_assignment"
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/coo/pods")}
            className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate flex-1">{podName}</h1>

          {/* Delete Pod (soft delete) */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-10 sm:w-10 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Pod?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will soft-delete the pod and clear its Territory Director assignment. The pod can be viewed in Deleted Pods but this action cannot be undone from the app.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePodMutation.mutate()}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletePodMutation.isPending}
              >
                {deletePodMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Statistics Section */}
        <div className="coo-pod-stats grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tutors</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                {podStats?.totalTutors || 0}
              </p>
            </div>
          </Card>

          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Students</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                {podStats?.totalStudents || 0}
              </p>
            </div>
          </Card>
          
          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sessions Done</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                {podStats?.sessionsCompleted || 0}
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
                <Badge className={`${getStatusColor((currentPod as Pod).status)} border font-semibold text-xs`}>
                  {(currentPod as Pod).status}
                </Badge>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 border">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Pod Operating Model</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Commercial Type</span>
                  <Badge variant="outline">
                    {(currentPod as Pod).podType === "paid" ? "Paid" : "Training"}
                  </Badge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Operating State</span>
                  <Badge className={getOperatingStateBadgeClass(operatingOverview?.operatingState?.key)}>
                    {operatingOverview?.operatingState?.label || "Loading"}
                  </Badge>
                </div>
                {operatingOverview?.operatingState?.description ? (
                  <p className="text-sm text-muted-foreground">{operatingOverview.operatingState.description}</p>
                ) : null}
                {operatingOverview ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tutor Mix</p>
                      <p className="mt-1 text-sm font-medium">
                        Live {operatingOverview.tutorModeCounts?.certified_live || 0} • Sandbox {operatingOverview.tutorModeCounts?.sandbox || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Training {((operatingOverview.tutorModeCounts?.training || 0) + (operatingOverview.tutorModeCounts?.applicant || 0) + (operatingOverview.tutorModeCounts?.watchlist || 0) + (operatingOverview.tutorModeCounts?.suspended || 0))}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Assignment Split</p>
                      <p className="mt-1 text-sm font-medium">
                        Live {operatingOverview.assignmentCounts?.liveParents || 0} • Sandbox {operatingOverview.assignmentCounts?.sandboxParents || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Awaiting acceptance {operatingOverview.assignmentCounts?.awaitingTutorAcceptance || 0}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Territory Director */}
            <Card className="p-4 sm:p-6 border">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Users className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Territory Director</p>
              </div>
              <p className="font-medium text-sm sm:text-base mb-4">{tdName}</p>
            </Card>

            {/* Pod Integrity */}
            <Card className="p-4 sm:p-6 border">
              <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Pod Integrity</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePodIntegrity}
                  className="whitespace-nowrap"
                >
                  {podIntegrityExpanded ? "Hide stats" : "Show stats"}
                </Button>
              </div>

              {podIntegrityExpanded ? (
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

                  {battleTestingSummary?.tdSummary && (
                    <div className="pt-4 border-t space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">TD Integrity</p>
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Badge className={getBattleTestStateBadgeClass(battleTestingSummary.tdSummary.state)}>
                          {getBattleTestStateLabel(battleTestingSummary.tdSummary.state)}
                        </Badge>
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => setTdBattleTestOpen(true)}>
                          Run TD Audit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>

            {/* Start Date */}
            {(currentPod as Pod).startDate && (
              <Card className="p-4 sm:p-6 border">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">Started</p>
                </div>
                <p className="font-medium text-sm sm:text-base">
                  {new Date((currentPod as Pod).startDate).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </p>
              </Card>
            )}
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
                      {tutorCount}/{maxTutors}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTutorsSection}
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                          tutorsSectionExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Tutors List */}
                {tutorsSectionExpanded ? (
                  podTutorsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14" />
                      <Skeleton className="h-14" />
                    </div>
                  ) : !podTutors || podTutors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No tutors assigned yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                        {podTutors.map((assignment: any) => {
                          const isExpanded = expandedTutors.has(assignment.id);
                          const tutorAudit = battleTestingSummary?.tutorSummaries.find(
                            (entry) => entry.assignmentId === assignment.id
                          );
                          const operationalMode = getTutorActualMode(
                            assignment,
                            tutorAudit?.mode
                          );
                          const isWatchlistState = tutorAudit?.state === "watchlist";
                          const transformationProgress = (assignment.module_progress || []).find(
                            (entry: any) => entry.moduleKey === "transformation_phases"
                          );
                          const sessionInfrastructureProgress = (assignment.module_progress || []).find(
                            (entry: any) => entry.moduleKey === "session_infrastructure"
                          );
                          const responsibilityView = getTutorResponsibilityView(operationalMode, {
                            sandboxParentCount: assignment.sandbox_parent_count,
                            liveParentCount: assignment.live_parent_count,
                            awaitingTutorAcceptanceCount: assignment.awaiting_tutor_acceptance_count,
                          });
                          const latestPhaseScores =
                            Array.from(
                              latestTutorPhaseScoresByAssignment.get(assignment.id)?.values() || []
                            ) || [];

                        return (
                          <div
                            key={assignment.id}
                            className="border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors"
                          >
                            <div className="p-3 sm:p-4">
                              <div className="flex flex-col gap-3 sm:gap-4">
                                <div className="flex items-start justify-between gap-2 sm:gap-4">
                                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-bold text-primary shrink-0">
                                      {assignment.tutorName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm sm:text-base truncate">{assignment.tutorName}</p>
                                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{assignment.tutorEmail}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {(assignment.certification_status && assignment.certification_status !== "pending") && (
                                          <Badge className={`${getCertificationColor(assignment.certification_status)} border`}>
                                            {assignment.certification_status}
                                          </Badge>
                                        )}
                                        <Badge variant={getOperationalModeBadge(operationalMode)}>
                                          {formatOperationalModeLabel(operationalMode)}
                                        </Badge>
                                        {isWatchlistState ? (
                                          <Badge className="bg-amber-100 text-amber-900 border-amber-200">
                                            Watchlist state
                                          </Badge>
                                        ) : null}
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

                                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                          onClick={() => setTutorToRemove(assignment.id)}
                                        >
                                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove Tutor?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to remove {assignment.tutorName} from this pod?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => removeTutorMutation.mutate(assignment.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                          disabled={removeTutorMutation.isPending}
                                        >
                                          {removeTutorMutation.isPending ? "Removing..." : "Remove"}
                                        </AlertDialogAction>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-muted-foreground">Tutor Alignment</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTutorDetails(assignment.id)}
                                    className="whitespace-nowrap"
                                  >
                                    {expandedTutorDetails[assignment.id] ? "Hide details" : "Show details"}
                                  </Button>
                                </div>

                                {expandedTutorDetails[assignment.id] ? (
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
                                          const expandKey = `${assignment.id}:${groupKey}`;
                                          const isGroupExpanded = expandedTutorAuditGroups[expandKey] ?? false;

                                          return (
                                            <div key={expandKey} className="rounded-xl border border-border/60 bg-background/60">
                                              <button
                                                type="button"
                                                onClick={() => toggleTutorAuditGroup(assignment.id, groupKey)}
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
                                                        key={`${assignment.id}-${phaseDefinition.key}`}
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
                                        Tutor Journey
                                      </p>
                                      <div className="mt-3 grid gap-3">
                                        <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Mode Capability</p>
                                          <p className="mt-1 text-sm font-medium text-foreground">
                                            {formatModeCapability(operationalMode)}
                                          </p>
                                        </div>
                                        <div className="grid gap-3">
                                          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Transformation Deep Dives</p>
                                            <p className="mt-1 text-sm font-medium text-foreground">
                                              {transformationProgress
                                                ? `${transformationProgress.completedCount}/${transformationProgress.totalCount} reached 3/3`
                                                : "Not started"}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              {(() => {
                                                const summary = summarizeModuleDeepDiveProgress(
                                                  tutorAudit?.deepDiveProgress,
                                                  "transformation_phases"
                                                );
                                                if (summary.onePassAwayCount > 0) {
                                                  return `${summary.onePassAwayCount} one pass away`;
                                                }
                                                if (summary.buildingCount > 0) {
                                                  return `${summary.buildingCount} building streak`;
                                                }
                                                if (summary.retestCount > 0) {
                                                  return `${summary.retestCount} need streak rebuild`;
                                                }
                                                return "Module status is derived from phase streaks";
                                              })()}
                                            </p>
                                          </div>
                                          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Session Infrastructure Deep Dives</p>
                                            <p className="mt-1 text-sm font-medium text-foreground">
                                              {sessionInfrastructureProgress
                                                ? `${sessionInfrastructureProgress.completedCount}/${sessionInfrastructureProgress.totalCount} reached 3/3`
                                                : "Not started"}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              {(() => {
                                                const summary = summarizeModuleDeepDiveProgress(
                                                  tutorAudit?.deepDiveProgress,
                                                  "session_infrastructure"
                                                );
                                                if (summary.onePassAwayCount > 0) {
                                                  return `${summary.onePassAwayCount} one pass away`;
                                                }
                                                if (summary.buildingCount > 0) {
                                                  return `${summary.buildingCount} building streak`;
                                                }
                                                if (summary.retestCount > 0) {
                                                  return `${summary.retestCount} need streak rebuild`;
                                                }
                                                return "Module status is derived from phase streaks";
                                              })()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className={`rounded-lg border p-3 ${responsibilityView.toneClass}`}>
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                                            {responsibilityView.title}
                                          </p>
                                          <p className="mt-1 text-sm font-medium text-foreground">
                                            {responsibilityView.primary}
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {responsibilityView.secondary}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Reassignment / Acceptance Pressure</p>
                                          <p className="mt-1 text-sm font-medium text-foreground">
                                            Awaiting tutor acceptance: {assignment.awaiting_tutor_acceptance_count || 0}
                                          </p>
                                          {assignment.certification_recovery_note ? (
                                            <p className="mt-2 text-xs text-amber-900">
                                              {assignment.certification_recovery_note}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                      <p className="mt-3 text-sm text-muted-foreground">
                                        {assignment.student_count || 0}/{maxStudentsPerTutor} students assigned.
                                      </p>
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        Certification owns mode progression. COO sees the journey here, but mode switching stays system-driven.
                                      </p>
                                      {Array.isArray(assignment.next_battle_tests) && assignment.next_battle_tests.length > 0 ? (
                                        <div className="mt-3 rounded-lg border border-border/60 bg-background/80 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Next Certification Reps</p>
                                          <p className="mt-1 text-sm text-foreground">
                                            {assignment.next_battle_tests
                                              .slice(0, 3)
                                              .map((entry: any) => entry.title)
                                              .join(" • ")}
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {formatOperationalModeLabel(operationalMode)}. {responsibilityView.primary}. {responsibilityView.secondary}.
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-3 pt-1">
                                  <p className="text-sm font-medium text-muted-foreground">Assigned Students</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTutorExpand(assignment.id)}
                                    className="whitespace-nowrap"
                                  >
                                    {isExpanded ? "Hide students" : "Show students"}
                                  </Button>
                                </div>

                                {isExpanded && (
                                  <TutorStudentsSection
                                    assignmentId={assignment.id}
                                    tutorId={assignment.tutorId}
                                    tutorName={assignment.tutorName}
                                    studentCount={assignment.student_count || 0}
                                    maxStudentsPerTutor={maxStudentsPerTutor}
                                    awaitingAssignments={awaitingAssignments}
                                    operationalMode={operationalMode}
                                    unassignStudentMutation={unassignStudentMutation}
                                    assignAwaitingEnrollmentMutation={assignAwaitingEnrollmentMutation}
                                    onViewTrackingSystems={(studentId, studentName) => {
                                      setSelectedStudentId(studentId);
                                      setSelectedStudentName(studentName);
                                      setTrackingDialogOpen(true);
                                    }}
                                    onViewTopicConditioning={(student) => {
                                      setSelectedStudentId(student.id);
                                      setSelectedStudentName(student.name);
                                      setSelectedStudentRecord(student);
                                      setTopicConditioningDialogOpen(true);
                                    }}
                                    onViewCommunication={(student) => {
                                      setSelectedStudentId(student.id);
                                      setSelectedStudentName(student.name);
                                      setSelectedStudentRecord(student);
                                      setCommunicationDialogOpen(true);
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : null}

                    {/* Add Tutors Button */}
                    {availableSlots > 0 && (
                      <Dialog open={addTutorsOpen} onOpenChange={setAddTutorsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full gap-2 mt-4">
                            <Plus className="w-4 h-4" />
                            Add Tutor
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Tutors to Pod</DialogTitle>
                            <DialogDescription>
                              Select tutors to add. You can add {availableSlots} more tutor{availableSlots !== 1 ? "s" : ""}.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-3">
                            {availableTutors.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">
                                No available tutors
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {availableTutors.map((tutor) => (
                                  <div
                                    key={tutor.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-input hover:bg-muted"
                                  >
                                    <Checkbox
                                      id={`add-tutor-${tutor.id}`}
                                      checked={selectedTutorIds.includes(tutor.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          if (selectedTutorIds.length >= availableSlots) {
                                            toast({
                                              title: "Slot limit reached",
                                              description: `You can only add ${availableSlots} more tutor${availableSlots !== 1 ? "s" : ""}.`,
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          setSelectedTutorIds([...selectedTutorIds, tutor.id]);
                                        } else {
                                          setSelectedTutorIds(
                                            selectedTutorIds.filter((id) => id !== tutor.id)
                                          );
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`add-tutor-${tutor.id}`}
                                      className="flex-1 cursor-pointer"
                                    >
                                      <p className="font-medium text-sm">{tutor.name}</p>
                                      <p className="text-xs text-muted-foreground">{tutor.email}</p>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setAddTutorsOpen(false);
                                setSelectedTutorIds([]);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => addTutorsMutation.mutate(selectedTutorIds)}
                              disabled={selectedTutorIds.length === 0 || addTutorsMutation.isPending}
                            >
                              {addTutorsMutation.isPending ? "Adding..." : "Add"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
              </div>
            </Card>
          </div>
        </div>


      </div>

      <BattleTestRunnerDialog
        open={tdBattleTestOpen}
        onOpenChange={setTdBattleTestOpen}
        title={`TD System Integrity - ${tdName}`}
        description={`Run the COO-side TD integrity drill for ${tdName} inside ${podName}.`}
        phaseOptions={tdBattleTestPhases}
        selectionMode="fixed"
        submitLabel="Save TD Battle Test"
        onSubmit={async ({ responses }) => {
          await submitTdBattleTestMutation.mutateAsync({
            responses,
          });
        }}
      />

      {/* Student Dialogs - COO read-only view */}
      <StudentIdentitySheet
        open={identitySheetOpen}
        onOpenChange={setIdentitySheetOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        readOnly={true}
        apiBasePath="/api/coo"
      />
      
      <ViewAssignmentsDialog
        open={assignmentsDialogOpen}
        onOpenChange={setAssignmentsDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        apiBasePath="/api/coo"
      />
      
      <ViewTrackingSystemsDialog
        open={trackingDialogOpen}
        onOpenChange={setTrackingDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        apiBasePath="/api/coo"
      />

      <StudentTopicConditioningDialog
        open={topicConditioningDialogOpen}
        onOpenChange={setTopicConditioningDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        studentGrade={(selectedStudentRecord?.grade as string) || null}
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
        apiBasePath="/api/coo"
      />

      <StudentCommunicationDialog
        open={communicationDialogOpen}
        onOpenChange={setCommunicationDialogOpen}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        readOnly={true}
        apiBasePath="/api/coo"
      />
    </DashboardLayout>
  );
}

// Component to display tutor's students in expanded section
interface TutorStudentsSectionProps {
  assignmentId: string;
  tutorId: string;
  tutorName: string;
  studentCount: number;
  maxStudentsPerTutor: number;
  awaitingAssignments: ParentEnrollment[];
  operationalMode?: string | null;
  unassignStudentMutation: any;
  assignAwaitingEnrollmentMutation: any;
  onViewTrackingSystems: (studentId: string, studentName: string) => void;
  onViewTopicConditioning: (student: any) => void;
  onViewCommunication: (student: any) => void;
}

function TutorStudentsSection({
  assignmentId,
  tutorId,
  tutorName,
  studentCount,
  maxStudentsPerTutor,
  awaitingAssignments,
  operationalMode,
  unassignStudentMutation,
  assignAwaitingEnrollmentMutation,
  onViewTrackingSystems,
  onViewTopicConditioning,
  onViewCommunication,
}: TutorStudentsSectionProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const canAssignParents = isTutorEligibleForParentAssignment(operationalMode);
  const { data: students, isLoading } = useQuery<any[]>({
    queryKey: [`/api/coo/tutors/${tutorId}/students`],
    enabled: !!tutorId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const activeStudentCount = students?.length || studentCount || 0;
  const tutorAtCapacity = activeStudentCount >= maxStudentsPerTutor;

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Assigned Students</p>
          <p className="text-sm text-muted-foreground">
            Drill down into the students currently assigned to {tutorName}.
          </p>
        </div>
        <Badge variant="outline">{activeStudentCount}/{maxStudentsPerTutor}</Badge>
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
            {students.map((student: any) => {
              const initials = student.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const isUnassigningThisStudent =
                unassignStudentMutation.isPending &&
                unassignStudentMutation.variables === student.assignedEnrollmentId;

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
                        <Badge
                          className={
                            student.isSandboxAssignment
                              ? "bg-sky-100 text-sky-800 border-sky-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }
                        >
                          {student.isSandboxAssignment ? "Sandbox Parent" : "Live Parent"}
                        </Badge>
                        {student.isReassignmentPreserved ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200">
                            Reassignment State
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Parent: {student.parentName || "Unknown"}
                        {student.parentEmail ? ` • ${student.parentEmail}` : ""}
                      </p>
                      {student.sessionProgress !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sessions this cycle: {((student.sessionProgress || 0) % 8) || (student.sessionProgress % 8 === 0 && student.sessionProgress > 0 ? 8 : 0)}/8
                        </p>
                      )}
                      {student.enrollmentStatus ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Enrollment state: {student.enrollmentStatus}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
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
                      onClick={() => onViewTrackingSystems(student.id, student.name)}
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={!student.assignedEnrollmentId || unassignStudentMutation.isPending}
                      onClick={() => {
                        if (!student.assignedEnrollmentId) return;
                        const confirmed = window.confirm(
                          `Unassign ${student.name} from ${tutorName}?\n\nStudent data will be preserved for reassignment.`
                        );
                        if (!confirmed) return;
                        unassignStudentMutation.mutate(student.assignedEnrollmentId);
                      }}
                    >
                      <UserMinus className="w-3 h-3 mr-1.5" />
                      {isUnassigningThisStudent ? "Unassigning..." : "Unassign"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Awaiting Parents</p>
            <p className="text-sm text-muted-foreground">
              Assign directly from the unassigned parent queue without leaving this pod.
            </p>
            {tutorAtCapacity && (
              <p className="mt-1 text-xs text-amber-700">
                This tutor is at vehicle capacity and cannot receive more students from quick actions.
              </p>
            )}
          </div>
          <div className="w-full sm:w-auto sm:max-w-xs">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={
                    awaitingAssignments.length === 0 ||
                    assignAwaitingEnrollmentMutation.isPending ||
                    tutorAtCapacity ||
                    !canAssignParents
                  }
                >
                  Assign Parent
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,72rem)] max-w-6xl">
              <DialogHeader>
                <DialogTitle>Assign Parent to {tutorName}</DialogTitle>
                <DialogDescription>
                  Select an unassigned parent enrollment from the awaiting list.
                </DialogDescription>
              </DialogHeader>

              {awaitingAssignments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No parents are currently awaiting assignment.
                </div>
              ) : (
                <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
                  {awaitingAssignments.map((enrollment) => (
                    <Card
                      key={enrollment.id}
                      className="overflow-hidden border-[#e8dcc2] bg-gradient-to-br from-[#fffaf0] via-white to-[#fff7e8] shadow-sm"
                    >
                      {(() => {
                        const topics = Array.from(
                          new Set([
                            ...((Array.isArray(enrollment.parentInfo?.reported_topics) ? enrollment.parentInfo!.reported_topics : [])),
                            ...Object.keys(enrollment.parentInfo?.topic_response_symptoms || {}),
                            ...Object.keys(enrollment.parentInfo?.topic_recommended_starting_phases || {}),
                          ])
                        );
                        const fallbackSymptoms =
                          enrollment.parentInfo?.response_symptoms && enrollment.parentInfo.response_symptoms.length > 0
                            ? enrollment.parentInfo.response_symptoms
                            : extractLegacySymptomsFromParentNote(enrollment.parent_motivation);
                        const topicSymptoms = enrollment.parentInfo?.topic_response_symptoms || {};
                        const topicRecommendations = enrollment.parentInfo?.topic_recommended_starting_phases || {};
                        const derivedTopicSymptoms =
                          topics.length === 1 && fallbackSymptoms.length > 0 && !topicSymptoms[topics[0]]
                            ? { ...topicSymptoms, [topics[0]]: fallbackSymptoms }
                            : topicSymptoms;
                        const isAssigningThisEnrollment =
                          assignAwaitingEnrollmentMutation.isPending &&
                          assignAwaitingEnrollmentMutation.variables?.enrollmentId === enrollment.id &&
                          assignAwaitingEnrollmentMutation.variables?.tutorId === tutorId;

                        return (
                          <>
                            <div className="border-b border-[#eadfca] bg-[#fff8ea]/80 px-5 pb-5 pt-5">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-2xl font-semibold tracking-tight text-slate-950">
                                      {enrollment.student_full_name}
                                    </p>
                                    <p className="mt-1 text-base text-slate-600">
                                      Parent: {enrollment.parent_full_name || "Unknown"}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="border-[#e7d7b3] bg-white/80 text-slate-700">
                                      <BookOpen className="mr-1 h-3.5 w-3.5" />
                                      {enrollment.student_grade || "Grade not provided"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                                    Awaiting Assignment
                                  </Badge>
                                  <Badge variant="outline" className="border-[#eadfca] bg-white/80 text-slate-600">
                                    <CalendarDays className="mr-1 h-3.5 w-3.5" />
                                    {enrollment.created_at ? new Date(enrollment.created_at).toLocaleDateString() : "Unknown"}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-6 p-5">
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    <Mail className="h-3.5 w-3.5" />
                                    Email
                                  </div>
                                  <p className="mt-2 break-all text-sm font-medium text-slate-900">
                                    {enrollment.parent_email || "Not provided"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    <Phone className="h-3.5 w-3.5" />
                                    Phone
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-slate-900">
                                    {enrollment.parent_phone || "Not provided"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Location
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-slate-900">
                                    {enrollment.parent_city || "Not provided"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    <School className="h-3.5 w-3.5" />
                                    School
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-slate-900">
                                    {enrollment.school_name || "Not provided"}
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-4 2xl:grid-cols-[1.15fr,0.85fr]">
                                <div className="rounded-2xl border border-[#eadfca] bg-white/85 p-5">
                                  <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-[#946c16]" />
                                    <p className="text-sm font-semibold text-slate-900">Enrollment Focus</p>
                                  </div>

                                  <div className="mt-4 space-y-4">
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Topics</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {topics.length > 0 ? (
                                          topics.map((topic) => (
                                            <Badge key={topic} variant="secondary" className="bg-[#f6edd7] text-[#6a4d0b] hover:bg-[#f6edd7]">
                                              {topic}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-sm text-slate-500">No topics recorded</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="rounded-xl border border-dashed border-[#eadfca] bg-[#fffaf2] p-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Previous Tutoring</p>
                                        <p className="mt-2 text-sm font-medium text-slate-900">
                                          {enrollment.previous_tutoring || "Not provided"}
                                        </p>
                                      </div>
                                      <div className="rounded-xl border border-dashed border-[#eadfca] bg-[#fffaf2] p-3">
                                        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                          <Wifi className="h-3.5 w-3.5" />
                                          Internet Access
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-slate-900">
                                          {enrollment.internet_access || "Not provided"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-[#eadfca] bg-white/85 p-5">
                                  <div className="flex items-center gap-2">
                                    <CircleAlert className="h-4 w-4 text-[#946c16]" />
                                    <p className="text-sm font-semibold text-slate-900">Parent Intake Signal</p>
                                  </div>

                                  <div className="mt-4 space-y-3">
                                    {topics.length > 0 ? (
                                      topics.map((topic) => {
                                        const symptoms = derivedTopicSymptoms[topic] || [];
                                        const recommendation = topicRecommendations[topic];
                                        return (
                                          <div key={topic} className="rounded-xl border border-[#eadfca] bg-[#fffdf8] p-4">
                                            <p className="text-sm font-semibold text-slate-900">{topic}</p>
                                            {recommendation?.phase ? (
                                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                                Suggested diagnostic start: {formatPhaseLabel(recommendation.phase)}
                                              </p>
                                            ) : null}

                                            <div className="mt-3">
                                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Observed Signals</p>
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                {symptoms.length > 0 ? (
                                                  symptoms.map((symptom) => (
                                                    <Badge key={`${topic}-${symptom}`} variant="outline" className="border-[#ecdcb7] bg-white text-slate-700">
                                                      {symptom}
                                                    </Badge>
                                                  ))
                                                ) : (
                                                  <span className="text-sm text-slate-500">No topic-specific symptom map recorded yet.</span>
                                                )}
                                              </div>
                                            </div>

                                            {recommendation?.rationale ? (
                                              <div className="mt-3 rounded-lg bg-[#faf4e5] p-3 text-sm text-slate-700">
                                                {recommendation.rationale}
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })
                                    ) : fallbackSymptoms.length > 0 ? (
                                      <div className="rounded-xl border border-[#eadfca] bg-[#fffdf8] p-4">
                                        <p className="text-sm font-semibold text-slate-900">Observed Signals</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {fallbackSymptoms.map((symptom) => (
                                            <Badge key={symptom} variant="outline" className="border-[#ecdcb7] bg-white text-slate-700">
                                              {symptom}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-dashed border-[#eadfca] bg-[#fffdf8] p-4 text-sm text-slate-500">
                                        No symptom mapping was captured for this enrollment.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 border-t border-[#eadfca] pt-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-slate-600">
                                  <span className="font-medium text-slate-800">Submitted:</span>{" "}
                                  {enrollment.created_at ? new Date(enrollment.created_at).toLocaleString() : "Unknown"}
                                </div>

                                <Button
                                  disabled={assignAwaitingEnrollmentMutation.isPending || tutorAtCapacity}
                                  onClick={async () => {
                                    try {
                                      await assignAwaitingEnrollmentMutation.mutateAsync({
                                        enrollmentId: enrollment.id,
                                        tutorId,
                                      });
                                      setAssignDialogOpen(false);
                                    } catch {
                                      // Toast is handled by the mutation error callback.
                                    }
                                  }}
                                >
                                  {isAssigningThisEnrollment ? "Assigning..." : `Assign to ${tutorName}`}
                                  {!isAssigningThisEnrollment ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                                </Button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </Card>
                  ))}
                </div>
              )}
            </DialogContent>
            </Dialog>
            {!canAssignParents ? (
              <p className="mt-2 text-xs text-rose-900 break-words sm:text-right">
                Parent assignment is blocked until this tutor is in Sandbox or Certified Live mode.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
