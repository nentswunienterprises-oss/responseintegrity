import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileStack, Flag, ShieldCheck } from "lucide-react";
import { ExecutivePortalGuard } from "@/lib/portalGuard";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ExecutiveRole = "ceo" | "coo" | "hr" | "cto" | "cmo";
type ExecutiveDepartment = ExecutiveRole;
type TaskStatus = "not_started" | "in_progress" | "blocked" | "submitted" | "approved" | "missed";
type WeeklyRecordType =
  | "coo_operational_report"
  | "ceo_feedback_record"
  | "executive_direction_report"
  | "department_report";

type ExecutiveUser = {
  id: string;
  email: string;
  name: string;
  role: ExecutiveRole;
};

type ExecutiveProfile = {
  id: string;
  userId: string;
  department: ExecutiveDepartment;
  title: string;
  mission: string | null;
  reportingLine: string | null;
  authorityLevel: string | null;
  coreResponsibilities: string[];
  communicationRhythm: string | null;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  contributionStatus: "not_contributing" | "building" | "contributing" | "at_risk";
  doctrineAcknowledged: boolean;
  consequenceLogicAcknowledged: boolean;
  onboardingCompletedAt: string | null;
  contributionActivatedAt: string | null;
  lastContributionAt: string | null;
};

type ExecutiveTaskProof = {
  id: string;
  label: string;
  proofType: string;
  proofUrl: string;
  notes: string | null;
  status: "submitted" | "approved" | "rejected";
  submittedAt: string | null;
};

type ExecutiveTaskTimeLog = {
  id: string;
  userId: string;
  workDate: string;
  minutesSpent: number;
  outcomeProduced: string;
  proofReference: string | null;
  roleAligned: boolean;
  valueType: "strategic" | "support" | "activity";
};

type HydratedExecutiveTask = {
  id: string;
  title: string;
  description: string | null;
  department: ExecutiveDepartment;
  ownerUserId: string;
  supportingUserIds: string[];
  deadline: string;
  priority: "critical" | "high" | "normal" | "low";
  requiredProof: string;
  status: TaskStatus;
  effectiveStatus: TaskStatus;
  completionPercent: number;
  blockerSummary: string | null;
  blockerNeeds: string | null;
  blockerDecisionNeeded: string | null;
  ceoNotes: string | null;
  cooNotes: string | null;
  consequenceIfIncomplete: string | null;
  directionSource: string | null;
  totalMinutesSpent: number;
  proofCount: number;
  approvedProofCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  latestUpdateAt: string | null;
  owner: ExecutiveUser | null;
  supporters: ExecutiveUser[];
  proofs: ExecutiveTaskProof[];
  timeLogs: ExecutiveTaskTimeLog[];
  isOverdue: boolean;
};

type ExecutiveWeeklyRecord = {
  id: string;
  weekStartDate: string;
  recordType: WeeklyRecordType;
  department: ExecutiveDepartment | null;
  createdByUserId: string;
  title: string;
  summary: string;
  keyDecisions: string | null;
  risks: string | null;
  nextDirections: string | null;
  needsAttention: string | null;
  sourceTaskIds: string[];
  payload: Record<string, unknown>;
  createdAt: string | null;
};

type ExecutiveSummaryRow = {
  executive: ExecutiveUser;
  profile: ExecutiveProfile | null;
  activePriorities: number;
  completionRate: number;
  delayedTasks: number;
  blockedTasks: number;
  lastUpdateAt: string | null;
  thisWeekMinutes: number;
  riskLevel: "low" | "medium" | "high";
};

type OverviewPayload = {
  executives: ExecutiveUser[];
  profiles: ExecutiveProfile[];
  myProfile: ExecutiveProfile | null;
  tasks: HydratedExecutiveTask[];
  weeklyRecords: ExecutiveWeeklyRecord[];
  companySummary: {
    totalTasks: number;
    activeTasks: number;
    awaitingReview: number;
    missedTasks: number;
    blockedTasks: number;
    approvedTasks: number;
    weeklyRecordCount: number;
  };
  executiveSummaryTable: ExecutiveSummaryRow[];
};

type TaskDialogMode = "create" | "update" | "proof";
type ProofTypeOption = "link" | "screenshot" | "image" | "doc";

const ROLE_LABELS: Record<ExecutiveRole, string> = {
  ceo: "CEO",
  coo: "COO",
  hr: "HoHR",
  cto: "CTO",
  cmo: "CMO",
};

const EXECUTIVE_ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as ExecutiveRole[]).map((role) => ({
  role,
  label: ROLE_LABELS[role],
}));

const RECORD_LABELS: Record<WeeklyRecordType, string> = {
  coo_operational_report: "COO Operational Report",
  ceo_feedback_record: "CEO Feedback Record",
  executive_direction_report: "Executive Direction Report",
  department_report: "Department Report",
};

const PROOF_TYPE_OPTIONS: Array<{ value: ProofTypeOption; label: string }> = [
  { value: "link", label: "Link" },
  { value: "screenshot", label: "Screenshot" },
  { value: "image", label: "Image" },
  { value: "doc", label: "Document" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "No update";
  return new Date(value).toLocaleString();
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleDateString();
}

function formatLongDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

function formatTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "approved":
      return "completed";
    default:
      return status.replaceAll("_", " ");
  }
}

function formatDurationBetween(startValue?: string | null, endValue?: string | null) {
  if (!startValue || !endValue) return "Not complete yet";

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "Not complete yet";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return parts.length ? parts.join(" ") : "< 1m";
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getRiskBadgeClass(riskLevel: "low" | "medium" | "high") {
  if (riskLevel === "high") return "bg-rose-500/100/10 text-foreground";
  if (riskLevel === "medium") return "bg-amber-500/10 text-foreground";
  return "bg-emerald-500/10 text-foreground";
}

function getStatusBadgeClass(status: TaskStatus) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-foreground";
    case "submitted":
      return "bg-sky-500/10 text-foreground";
    case "blocked":
      return "bg-orange-100 text-orange-700";
    case "missed":
      return "bg-rose-500/100/10 text-foreground";
    case "in_progress":
      return "bg-amber-500/10 text-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getPriorityBadgeClass(priority: HydratedExecutiveTask["priority"]) {
  switch (priority) {
    case "critical":
      return "bg-rose-600 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "normal":
      return "bg-slate-900 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function defaultTaskForm(ownerUserId = "", department: ExecutiveDepartment = "coo") {
  return {
    title: "",
    description: "",
    department,
    ownerUserId,
    supportingUserIds: "",
    deadline: "",
    priority: "normal",
    requiredProof: "",
    consequenceIfIncomplete: "",
    ceoNotes: "",
    cooNotes: "",
    directionSource: "",
  };
}

function defaultUpdateForm(task?: HydratedExecutiveTask | null) {
  return {
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "normal",
    deadline: task ? task.deadline.slice(0, 16) : "",
    status: task?.status || "not_started",
    completionPercent: task?.completionPercent || 0,
    blockerSummary: task?.blockerSummary || "",
    blockerNeeds: task?.blockerNeeds || "",
    blockerDecisionNeeded: task?.blockerDecisionNeeded || "",
    ceoNotes: task?.ceoNotes || "",
    cooNotes: task?.cooNotes || "",
    consequenceIfIncomplete: task?.consequenceIfIncomplete || "",
    requiredProof: task?.requiredProof || "",
  };
}

function defaultProofForm() {
  return {
    label: "",
    proofType: "link" as ProofTypeOption,
    proofUrl: "",
    file: null as File | null,
    notes: "",
  };
}

function getProofFileAcceptValue(proofType: ProofTypeOption) {
  switch (proofType) {
    case "screenshot":
    case "image":
      return "image/*";
    case "doc":
      return ".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";
    default:
      return "";
  }
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] || "" : result;
      if (!base64) {
        reject(new Error("Failed to read proof file"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read proof file"));
    reader.readAsDataURL(file);
  });
}

function getProofFileContentType(file: File) {
  if (file.type) return file.type;

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (lowerName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".md")) return "text/markdown";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  if (lowerName.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function defaultWeeklyRecordForm(department: ExecutiveDepartment) {
  return {
    weekStartDate: toDateInputValue(getWeekStart(new Date())),
    recordType: "department_report" as WeeklyRecordType,
    department,
    title: "",
    summary: "",
    keyDecisions: "",
    risks: "",
    nextDirections: "",
    needsAttention: "",
    sourceTaskIds: "",
  };
}

export default function ExecutiveCommandRhythmDashboard(props: { hideTabs?: boolean } = {}) {
  const { hideTabs = false } = props;
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const cachedOverview =
    queryClient.getQueryData<OverviewPayload>(["/api/executive/command-rhythm/overview"]) || null;
  const localStorageKey = "executive-command-rhythm-overview";
  const [hydratedOverview, setHydratedOverview] = useState<OverviewPayload | null>(null);
  const lastGoodOverviewRef = useRef<OverviewPayload | null>(cachedOverview);
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode | null>(null);
  const [selectedTask, setSelectedTask] = useState<HydratedExecutiveTask | null>(null);
  const [taskForm, setTaskForm] = useState(defaultTaskForm());
  const [updateForm, setUpdateForm] = useState(defaultUpdateForm());
  const [proofForm, setProofForm] = useState(defaultProofForm());
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [weeklyRecordForm, setWeeklyRecordForm] = useState(defaultWeeklyRecordForm("coo"));
  const [profileForm, setProfileForm] = useState({
    title: "",
    mission: "",
    reportingLine: "",
    authorityLevel: "",
    coreResponsibilities: "",
    communicationRhythm: "",
    onboardingStatus: "not_started",
    contributionStatus: "not_contributing",
    doctrineAcknowledged: false,
    consequenceLogicAcknowledged: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (raw) {
        setHydratedOverview(JSON.parse(raw));
      }
    } catch (error) {
      console.warn("Failed to hydrate command rhythm cache", error);
    }
  }, []);

  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: overviewError,
    error: overviewErrorDetails,
  } = useQuery<OverviewPayload>({
    queryKey: ["/api/executive/command-rhythm/overview"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    placeholderData: cachedOverview ?? hydratedOverview ?? undefined,
    keepPreviousData: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  useEffect(() => {
    if (!overview) return;
    lastGoodOverviewRef.current = overview;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(overview));
    } catch (error) {
      console.warn("Failed to persist command rhythm cache", error);
    }
  }, [overview]);

  const role = user?.role as ExecutiveRole | undefined;
  const myRoleDepartment = (role && ["ceo", "coo", "hr", "cto", "cmo"].includes(role) ? role : "coo") as ExecutiveDepartment;
  const stableOverview = overview || lastGoodOverviewRef.current || cachedOverview;
  const today = useMemo(() => new Date(), []);
  const currentWeekStart = useMemo(() => getWeekStart(today), [today]);
  const isUsingCachedSnapshot = Boolean(stableOverview && !overview);

  useEffect(() => {
    if (overview) {
      lastGoodOverviewRef.current = overview;
    }
  }, [overview]);

  useEffect(() => {
    setTaskForm((current) =>
      current.ownerUserId || !user
        ? current
        : defaultTaskForm(user.id, myRoleDepartment)
    );
    setWeeklyRecordForm((current) => ({
      ...current,
      department: myRoleDepartment,
      weekStartDate: current.weekStartDate || toDateInputValue(currentWeekStart),
    }));
  }, [currentWeekStart, myRoleDepartment, user]);

  useEffect(() => {
    if (!stableOverview?.myProfile) return;
    const profile = stableOverview.myProfile;
    setProfileForm({
      title: profile.title || "",
      mission: profile.mission || "",
      reportingLine: profile.reportingLine || "",
      authorityLevel: profile.authorityLevel || "",
      coreResponsibilities: profile.coreResponsibilities.join("\n"),
      communicationRhythm: profile.communicationRhythm || "",
      onboardingStatus: profile.onboardingStatus,
      contributionStatus: profile.contributionStatus,
      doctrineAcknowledged: profile.doctrineAcknowledged,
      consequenceLogicAcknowledged: profile.consequenceLogicAcknowledged,
    });
  }, [stableOverview?.myProfile]);

  const relevantTasks = useMemo(() => {
    if (!stableOverview?.tasks || !user) return [];
    return stableOverview.tasks.filter(
      (task) => task.ownerUserId === user.id || task.supportingUserIds.includes(user.id)
    );
  }, [stableOverview?.tasks, user]);
  const appointedOwnersForDepartment = useMemo(
    () => (stableOverview?.executives || []).filter((executive) => executive.role === taskForm.department),
    [stableOverview?.executives, taskForm.department]
  );

  useEffect(() => {
    if (!taskDialogMode || taskDialogMode !== "create") return;
    if (appointedOwnersForDepartment.some((executive) => executive.id === taskForm.ownerUserId)) return;
    const nextOwnerUserId = appointedOwnersForDepartment[0]?.id || "";
    if (taskForm.ownerUserId === nextOwnerUserId) return;

    setTaskForm((current) => ({
      ...current,
      ownerUserId: nextOwnerUserId,
    }));
  }, [appointedOwnersForDepartment, taskDialogMode, taskForm.ownerUserId]);

  const canApprove = role === "ceo" || role === "coo";

  const invalidateExecutiveQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/executive/command-rhythm/overview"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/executive/command-rhythm/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/executive/command-rhythm/weekly-records"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/executive/command-rhythm/profiles"] }),
    ]);
  };

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/executive/command-rhythm/tasks", {
        title: taskForm.title,
        description: taskForm.description || null,
        department: taskForm.department,
        ownerUserId: taskForm.ownerUserId,
        supportingUserIds: taskForm.supportingUserIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        deadline: taskForm.deadline,
        priority: taskForm.priority,
        requiredProof: taskForm.requiredProof,
        consequenceIfIncomplete: taskForm.consequenceIfIncomplete || null,
        ceoNotes: taskForm.ceoNotes || null,
        cooNotes: taskForm.cooNotes || null,
        directionSource: taskForm.directionSource || null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateExecutiveQueries();
      toast({ title: "Task recorded", description: "Direction is now tracked as owned work." });
      setTaskDialogMode(null);
      setSelectedTask(null);
      setTaskForm(defaultTaskForm(user?.id || "", myRoleDepartment));
    },
    onError: (error: Error) => {
      toast({ title: "Task creation failed", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask) throw new Error("No task selected");
      const response = await apiRequest(
        "PATCH",
        `/api/executive/command-rhythm/tasks/${selectedTask.id}`,
        {
          title: updateForm.title,
          description: updateForm.description || null,
          deadline: updateForm.deadline,
          priority: updateForm.priority,
          status: updateForm.status,
          completionPercent: Number(updateForm.completionPercent),
          blockerSummary: updateForm.blockerSummary || null,
          blockerNeeds: updateForm.blockerNeeds || null,
          blockerDecisionNeeded: updateForm.blockerDecisionNeeded || null,
          ceoNotes: updateForm.ceoNotes || null,
          cooNotes: updateForm.cooNotes || null,
          consequenceIfIncomplete: updateForm.consequenceIfIncomplete || null,
          requiredProof: updateForm.requiredProof,
        }
      );
      return response.json();
    },
    onSuccess: async () => {
      await invalidateExecutiveQueries();
      toast({ title: "Task updated", description: "The operating record has been refreshed." });
      setTaskDialogMode(null);
      setSelectedTask(null);
    },
    onError: (error: Error) => {
      toast({ title: "Task update failed", description: error.message, variant: "destructive" });
    },
  });

  const addProofMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask) throw new Error("No task selected");
      const isLinkProof = proofForm.proofType === "link";
      if (isLinkProof && !proofForm.proofUrl.trim()) {
        throw new Error("Proof link is required");
      }
      if (!isLinkProof && !proofForm.file) {
        throw new Error("Please choose a file to upload as proof");
      }
      const payload = isLinkProof
        ? {
            label: proofForm.label,
            proofType: proofForm.proofType,
            proofUrl: proofForm.proofUrl.trim(),
            notes: proofForm.notes || null,
          }
        : {
            label: proofForm.label,
            proofType: proofForm.proofType,
            fileData: proofForm.file ? await readFileAsBase64(proofForm.file) : "",
            fileName: proofForm.file?.name || "",
            contentType: proofForm.file ? getProofFileContentType(proofForm.file) : "",
            notes: proofForm.notes || null,
          };

      const response = await apiRequest(
        "POST",
        `/api/executive/command-rhythm/tasks/${selectedTask.id}/proofs`,
        payload
      );
      return response.json();
    },
    onSuccess: async () => {
      await invalidateExecutiveQueries();
      toast({ title: "Proof submitted", description: "Completion can now be reviewed from evidence." });
      setTaskDialogMode(null);
      setSelectedTask(null);
      setProofForm(defaultProofForm());
    },
    onError: (error: Error) => {
      toast({ title: "Proof submission failed", description: error.message, variant: "destructive" });
    },
  });

  const createWeeklyRecordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/executive/command-rhythm/weekly-records", {
        weekStartDate: weeklyRecordForm.weekStartDate,
        recordType: weeklyRecordForm.recordType,
        department: weeklyRecordForm.department,
        title: weeklyRecordForm.title,
        summary: weeklyRecordForm.summary,
        keyDecisions: weeklyRecordForm.keyDecisions || null,
        risks: weeklyRecordForm.risks || null,
        nextDirections: weeklyRecordForm.nextDirections || null,
        needsAttention: weeklyRecordForm.needsAttention || null,
        sourceTaskIds: weeklyRecordForm.sourceTaskIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateExecutiveQueries();
      toast({ title: "Weekly record stored", description: "This week now has institutional memory." });
      setWeeklyDialogOpen(false);
      setWeeklyRecordForm(defaultWeeklyRecordForm(myRoleDepartment));
    },
    onError: (error: Error) => {
      toast({ title: "Weekly record failed", description: error.message, variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user loaded");
      const response = await apiRequest(
        "PATCH",
        `/api/executive/command-rhythm/profiles/${user.id}`,
        {
          title: profileForm.title,
          mission: profileForm.mission || null,
          reportingLine: profileForm.reportingLine || null,
          authorityLevel: profileForm.authorityLevel || null,
          coreResponsibilities: profileForm.coreResponsibilities
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          communicationRhythm: profileForm.communicationRhythm || null,
          onboardingStatus: profileForm.onboardingStatus,
          contributionStatus: profileForm.contributionStatus,
          doctrineAcknowledged: profileForm.doctrineAcknowledged,
          consequenceLogicAcknowledged: profileForm.consequenceLogicAcknowledged,
        }
      );
      return response.json();
    },
    onSuccess: async () => {
      await invalidateExecutiveQueries();
      toast({ title: "Role profile saved", description: "Onboarding and contribution state are now up to date." });
    },
    onError: (error: Error) => {
      toast({ title: "Profile save failed", description: error.message, variant: "destructive" });
    },
  });

  const openTaskDialog = (mode: TaskDialogMode, task?: HydratedExecutiveTask) => {
    setTaskDialogMode(mode);
    setSelectedTask(task || null);
    if (mode === "create") {
      setTaskForm(defaultTaskForm(user?.id || "", myRoleDepartment));
    }
    if (mode === "update") {
      setUpdateForm(defaultUpdateForm(task || null));
    }
    if (mode === "proof") {
      setProofForm(defaultProofForm());
    }
  };

  if (!stableOverview) {
    return (
      <div className="p-8 space-y-3">
        <div>Loading executive command rhythm...</div>
        {overviewError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load the executive command rhythm data right now. Please refresh or try again later.
          </div>
        ) : null}
      </div>
    );
  }

  if (!user || !role) {
    return <div className="p-8">Executive access required.</div>;
  }

  return (
    <ExecutivePortalGuard role={role}>
      <div className="space-y-8">
        {isUsingCachedSnapshot ? (
          <div className="border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-foreground">
            Showing last known command rhythm snapshot while live data is temporarily unavailable.
          </div>
        ) : null}
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-none border-border/70 bg-background">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Weekly Command Rhythm OS</p>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {stableOverview?.myProfile?.title || ROLE_LABELS[role]}
                  </h1>
                </div>
                <Badge className="bg-slate-900 text-white">{ROLE_LABELS[role]}</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                CEO direction becomes recorded work, recorded work becomes owned tasks, and tasks only become complete when proof is accepted.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">My completed</span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-foreground">
                    {relevantTasks.filter((task) => task.effectiveStatus === "approved").length}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Tasks marked complete with accepted proof</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">My queue</span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-foreground">{relevantTasks.length}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Tasks owned or supported by you</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Onboarding</span>
                  </div>
                  <div className="mt-4 text-lg font-semibold capitalize text-foreground">
                    {stableOverview?.myProfile?.onboardingStatus.replaceAll("_", " ") || "not started"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Role understanding tracked separately from output</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Contribution</span>
                  </div>
                  <div className="mt-4 text-lg font-semibold capitalize text-foreground">
                    {stableOverview?.myProfile?.contributionStatus.replaceAll("_", " ") || "not contributing"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Proof-backed contribution state</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Institution Signal</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Today is {formatLongDate(today)}. Current week began {formatLongDate(currentWeekStart)}.
                  </p>
                </div>
                {overviewFetching ? (
                  <Badge variant="outline" className="border-border/70 text-muted-foreground">
                    Refreshing...
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/20 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Tasks</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{stableOverview?.companySummary.activeTasks || 0}</div>
                </div>
                <div className="rounded-xl bg-muted/20 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting Completion Review</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{stableOverview?.companySummary.awaitingReview || 0}</div>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-rose-500">Missed</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-700">{stableOverview?.companySummary.missedTasks || 0}</div>
                </div>
                <div className="rounded-xl bg-orange-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-orange-500">Blocked</div>
                  <div className="mt-2 text-2xl font-semibold text-orange-700">{stableOverview?.companySummary.blockedTasks || 0}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => openTaskDialog("create")}>Record New Task</Button>
                <Button variant="outline" onClick={() => setWeeklyDialogOpen(true)}>
                  Store Weekly Record
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {!hideTabs ? (
          <Tabs defaultValue="my-work" className="space-y-6">
          <TabsList className="inline-flex w-full justify-between">
            <TabsTrigger value="my-work">My Work</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
            <TabsTrigger value="role">Role</TabsTrigger>
          </TabsList>

          <TabsContent value="my-work" className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-2">
              {relevantTasks.length === 0 ? (
                <Card className="lg:col-span-2">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No tasks are linked to you yet. Record the next piece of owned work to start the rhythm.
                  </CardContent>
                </Card>
              ) : (
                relevantTasks.map((task) => (
                  <Card key={task.id} className="border-slate-200">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{task.title}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">{task.description || "No extra task note recorded yet."}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getPriorityBadgeClass(task.priority)}>{task.priority}</Badge>
                          <Badge className={getStatusBadgeClass(task.effectiveStatus)}>
                            {formatTaskStatusLabel(task.effectiveStatus)}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>Owner: <span className="font-medium text-foreground">{task.owner?.name || "Unknown"}</span></div>
                        <div>Deadline: <span className="font-medium text-foreground">{formatDate(task.deadline)}</span></div>
                        <div>Completion window: <span className="font-medium text-foreground">{formatDurationBetween(task.createdAt, task.approvedAt)}</span></div>
                        <div>Proof accepted: <span className="font-medium text-foreground">{task.approvedProofCount}/{task.proofCount}</span></div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-xl bg-muted/20 p-4 text-sm">
                        <div className="font-medium text-foreground">Required proof</div>
                        <div className="mt-1 text-muted-foreground">{task.requiredProof}</div>
                        {task.blockerSummary ? (
                          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-800">
                            <div className="font-medium">Blocker</div>
                            <div>{task.blockerSummary}</div>
                            {task.blockerNeeds ? <div className="mt-1 text-sm">Needs: {task.blockerNeeds}</div> : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => openTaskDialog("proof", task)}>
                          Submit Proof
                        </Button>
                        <Button variant="outline" onClick={() => openTaskDialog("update", task)}>
                          Update Task
                        </Button>
                        {canApprove ? (
                          <Button
                            onClick={() => {
                              setSelectedTask(task);
                              setUpdateForm({
                                ...defaultUpdateForm(task),
                                status: "approved",
                                completionPercent: 100,
                              });
                              setTaskDialogMode("update");
                            }}
                          >
                            Mark As Complete
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border p-4">
                          <div className="text-sm font-medium">Latest proof</div>
                          {task.proofs[0] ? (
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              <div>{task.proofs[0].label}</div>
                              <a className="text-blue-600 underline" href={task.proofs[0].proofUrl} target="_blank" rel="noreferrer">
                                Open proof
                              </a>
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-muted-foreground">No proof submitted yet.</div>
                          )}
                        </div>

                        <div className="rounded-xl border p-4">
                          <div className="text-sm font-medium">Completion timing</div>
                          {task.createdAt ? (
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                              <div>Recorded: {formatDate(task.createdAt)}</div>
                              <div>Submitted: {task.submittedAt ? formatDate(task.submittedAt) : "Not submitted yet"}</div>
                              <div>Completed: {task.approvedAt ? formatDate(task.approvedAt) : "Not completed yet"}</div>
                              <div>Cycle time: {formatDurationBetween(task.createdAt, task.approvedAt)}</div>
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-muted-foreground">Task timing is not available yet.</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>
          </TabsContent>

          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Executive Command Board</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Executive</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Active Priorities</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Delayed</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stableOverview?.executiveSummaryTable.map((row) => (
                      <TableRow key={row.executive.id}>
                        <TableCell className="font-medium">{row.executive.name}</TableCell>
                        <TableCell>{row.profile?.title || ROLE_LABELS[row.executive.role]}</TableCell>
                        <TableCell>{row.activePriorities}</TableCell>
                        <TableCell>{row.completionRate}%</TableCell>
                        <TableCell>{row.delayedTasks}</TableCell>
                        <TableCell>{row.lastUpdateAt ? formatShortDate(row.lastUpdateAt) : "No updates"}</TableCell>
                        <TableCell>
                          <Badge className={getRiskBadgeClass(row.riskLevel)}>{row.riskLevel}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {stableOverview?.tasks.map((task) => (
                <Card key={task.id} className="border-slate-200">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {task.owner?.name || "Unknown owner"} • {ROLE_LABELS[task.department]}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClass(task.effectiveStatus)}>
                        {formatTaskStatusLabel(task.effectiveStatus)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deadline</span>
                      <span>{formatDate(task.deadline)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completion</span>
                      <span>{task.completionPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cycle time</span>
                      <span>{formatDurationBetween(task.createdAt, task.approvedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Proof count</span>
                      <span>{task.proofCount}</span>
                    </div>
                    {task.directionSource ? (
                      <div className="rounded-lg bg-muted/20 p-3 text-muted-foreground">
                        <div className="font-medium">Direction source</div>
                        <div className="mt-1">{task.directionSource}</div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="archive" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Weekly Record Archive</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    COO reports, CEO feedback, direction conversion, and department truth live here.
                  </p>
                </div>
                <Button onClick={() => setWeeklyDialogOpen(true)}>Store Record</Button>
              </CardHeader>
            </Card>

            <div className="grid gap-4">
              {stableOverview?.weeklyRecords.length ? (
                stableOverview.weeklyRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="space-y-3 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-wide text-muted-foreground">
                            {RECORD_LABELS[record.recordType]}
                          </div>
                          <div className="text-xl font-semibold">{record.title}</div>
                        </div>
                        <Badge variant="outline">
                          {record.department ? ROLE_LABELS[record.department] : "Company-wide"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Week of {formatShortDate(record.weekStartDate)} • Stored {formatDate(record.createdAt)}
                      </div>
                      <div className="text-sm leading-6 text-muted-foreground">{record.summary}</div>
                      {record.keyDecisions ? (
                        <div className="rounded-lg bg-muted/20 p-3 text-sm">
                          <div className="font-medium text-foreground">Key decisions</div>
                          <div className="mt-1 text-muted-foreground">{record.keyDecisions}</div>
                        </div>
                      ) : null}
                      {record.needsAttention ? (
                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-foreground">
                          <div className="font-medium">Needs CEO attention</div>
                          <div className="mt-1">{record.needsAttention}</div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No weekly records stored yet.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="role" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Identity And Contribution State</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Onboarding proves role understanding. Contribution proves visible value.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={profileForm.title}
                      onChange={(event) => setProfileForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reporting line</Label>
                    <Input
                      value={profileForm.reportingLine}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, reportingLine: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Authority level</Label>
                    <Input
                      value={profileForm.authorityLevel}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, authorityLevel: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Communication rhythm</Label>
                    <Input
                      value={profileForm.communicationRhythm}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, communicationRhythm: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mission</Label>
                  <Textarea
                    value={profileForm.mission}
                    onChange={(event) => setProfileForm((current) => ({ ...current, mission: event.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Core responsibilities</Label>
                  <Textarea
                    value={profileForm.coreResponsibilities}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, coreResponsibilities: event.target.value }))
                    }
                    rows={6}
                    placeholder="One responsibility per line"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Onboarding status</Label>
                    <Select
                      value={profileForm.onboardingStatus}
                      onValueChange={(value) =>
                        setProfileForm((current) => ({
                          ...current,
                          onboardingStatus: value as typeof profileForm.onboardingStatus,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not started</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Contribution status</Label>
                    <Select
                      value={profileForm.contributionStatus}
                      onValueChange={(value) =>
                        setProfileForm((current) => ({
                          ...current,
                          contributionStatus: value as typeof profileForm.contributionStatus,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_contributing">Not contributing</SelectItem>
                        <SelectItem value="building">Building</SelectItem>
                        <SelectItem value="contributing">Contributing</SelectItem>
                        <SelectItem value="at_risk">At risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className="flex items-center gap-3 rounded-xl border p-4">
                    <input
                      type="checkbox"
                      checked={profileForm.doctrineAcknowledged}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          doctrineAcknowledged: event.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm">I acknowledge that a role is a responsibility under observation.</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border p-4">
                    <input
                      type="checkbox"
                      checked={profileForm.consequenceLogicAcknowledged}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          consequenceLogicAcknowledged: event.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm">I acknowledge consequence logic and proof-backed accountability.</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                    {saveProfileMutation.isPending ? "Saving..." : "Save Role State"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        ) : null}

        <Dialog open={taskDialogMode !== null} onOpenChange={(open) => !open && setTaskDialogMode(null)}>
          <DialogContent>
            {taskDialogMode === "create" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Record New Executive Task</DialogTitle>
                  <DialogDescription>
                    Convert direction into owned, deadline-bound work.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Task title</Label>
                    <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={taskForm.department} onValueChange={(value) => setTaskForm((current) => ({ ...current, department: value as ExecutiveDepartment }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXECUTIVE_ROLE_OPTIONS.map((roleOption) => (
                            <SelectItem key={roleOption.role} value={roleOption.role}>{roleOption.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Owner</Label>
                      <Select value={taskForm.ownerUserId} onValueChange={(value) => setTaskForm((current) => ({ ...current, ownerUserId: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {appointedOwnersForDepartment.map((executive) => (
                            <SelectItem key={executive.id} value={executive.id}>
                              {executive.name} ({ROLE_LABELS[executive.role]})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Deadline</Label>
                      <Input type="datetime-local" value={taskForm.deadline} onChange={(event) => setTaskForm((current) => ({ ...current, deadline: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as typeof current.priority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Required proof</Label>
                    <Textarea value={taskForm.requiredProof} onChange={(event) => setTaskForm((current) => ({ ...current, requiredProof: event.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Supporting people IDs</Label>
                    <Input value={taskForm.supportingUserIds} onChange={(event) => setTaskForm((current) => ({ ...current, supportingUserIds: event.target.value }))} placeholder="Comma-separated user IDs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Direction source</Label>
                    <Input value={taskForm.directionSource} onChange={(event) => setTaskForm((current) => ({ ...current, directionSource: event.target.value }))} placeholder="CEO feedback, COO conversion, department review..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Consequence if incomplete</Label>
                    <Textarea value={taskForm.consequenceIfIncomplete} onChange={(event) => setTaskForm((current) => ({ ...current, consequenceIfIncomplete: event.target.value }))} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createTaskMutation.mutate()} disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Recording..." : "Record Task"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}

            {taskDialogMode === "update" && selectedTask ? (
              <>
                <DialogHeader>
                  <DialogTitle>Update Task</DialogTitle>
                  <DialogDescription>
                    Keep the operating record honest and specific.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={updateForm.status} onValueChange={(value) => setUpdateForm((current) => ({ ...current, status: value as TaskStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not started</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        {canApprove ? <SelectItem value="approved">Completed</SelectItem> : null}
                        <SelectItem value="missed">Missed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Completion %</Label>
                      <Input type="number" min={0} max={100} value={updateForm.completionPercent} onChange={(event) => setUpdateForm((current) => ({ ...current, completionPercent: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Deadline</Label>
                      <Input type="datetime-local" value={updateForm.deadline} onChange={(event) => setUpdateForm((current) => ({ ...current, deadline: event.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Required proof</Label>
                    <Textarea value={updateForm.requiredProof} onChange={(event) => setUpdateForm((current) => ({ ...current, requiredProof: event.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Blocker summary</Label>
                    <Textarea value={updateForm.blockerSummary} onChange={(event) => setUpdateForm((current) => ({ ...current, blockerSummary: event.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>What is needed</Label>
                    <Textarea value={updateForm.blockerNeeds} onChange={(event) => setUpdateForm((current) => ({ ...current, blockerNeeds: event.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Decision needed</Label>
                    <Textarea value={updateForm.blockerDecisionNeeded} onChange={(event) => setUpdateForm((current) => ({ ...current, blockerDecisionNeeded: event.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>CEO notes</Label>
                    <Textarea value={updateForm.ceoNotes} onChange={(event) => setUpdateForm((current) => ({ ...current, ceoNotes: event.target.value }))} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>COO notes</Label>
                    <Textarea value={updateForm.cooNotes} onChange={(event) => setUpdateForm((current) => ({ ...current, cooNotes: event.target.value }))} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => updateTaskMutation.mutate()} disabled={updateTaskMutation.isPending}>
                    {updateTaskMutation.isPending ? "Saving..." : "Save Update"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}

            {taskDialogMode === "proof" && selectedTask ? (
              <>
                <DialogHeader>
                  <DialogTitle>Submit Proof</DialogTitle>
                  <DialogDescription>
                    No “I did it.” Only evidence.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Proof label</Label>
                    <Input value={proofForm.label} onChange={(event) => setProofForm((current) => ({ ...current, label: event.target.value }))} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Proof type</Label>
                      <Select
                        value={proofForm.proofType}
                        onValueChange={(value) =>
                          setProofForm((current) => ({
                            ...current,
                            proofType: value as ProofTypeOption,
                            proofUrl: "",
                            file: null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROOF_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{proofForm.proofType === "link" ? "Proof link" : "Proof file"}</Label>
                      {proofForm.proofType === "link" ? (
                        <Input
                          placeholder="https://..."
                          value={proofForm.proofUrl}
                          onChange={(event) => setProofForm((current) => ({ ...current, proofUrl: event.target.value }))}
                        />
                      ) : (
                        <Input
                          type="file"
                          accept={getProofFileAcceptValue(proofForm.proofType)}
                          onChange={(event) =>
                            setProofForm((current) => ({
                              ...current,
                              file: event.target.files?.[0] || null,
                            }))
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {proofForm.proofType === "link"
                      ? "Use a direct link to the evidence."
                      : proofForm.proofType === "doc"
                        ? "Upload a PDF, Word document, text file, or markdown file."
                        : "Upload an image file as visual proof."}
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={proofForm.notes} onChange={(event) => setProofForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => addProofMutation.mutate()} disabled={addProofMutation.isPending}>
                    {addProofMutation.isPending ? "Submitting..." : "Submit Proof"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Store Weekly Record</DialogTitle>
              <DialogDescription>
                Turn this week’s truth into searchable institutional memory.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Week start date</Label>
                  <Input type="date" value={weeklyRecordForm.weekStartDate} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, weekStartDate: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Record type</Label>
                  <Select value={weeklyRecordForm.recordType} onValueChange={(value) => setWeeklyRecordForm((current) => ({ ...current, recordType: value as WeeklyRecordType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECORD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={weeklyRecordForm.title} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea value={weeklyRecordForm.summary} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, summary: event.target.value }))} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Key decisions</Label>
                <Textarea value={weeklyRecordForm.keyDecisions} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, keyDecisions: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Risks</Label>
                <Textarea value={weeklyRecordForm.risks} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, risks: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Next directions</Label>
                <Textarea value={weeklyRecordForm.nextDirections} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, nextDirections: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Needs attention</Label>
                <Textarea value={weeklyRecordForm.needsAttention} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, needsAttention: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Source task IDs</Label>
                <Input value={weeklyRecordForm.sourceTaskIds} onChange={(event) => setWeeklyRecordForm((current) => ({ ...current, sourceTaskIds: event.target.value }))} placeholder="Comma-separated task IDs" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createWeeklyRecordMutation.mutate()} disabled={createWeeklyRecordMutation.isPending}>
                {createWeeklyRecordMutation.isPending ? "Storing..." : "Store Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {(stableOverview?.companySummary.missedTasks || 0) > 0 ? (
          <div className="fixed bottom-24 right-4 z-40 max-w-sm border border-rose-500/25 bg-card p-4 shadow-none">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
              <div>
                <div className="font-semibold text-rose-700">Missed responsibilities detected</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stableOverview?.companySummary.missedTasks} task{stableOverview?.companySummary.missedTasks === 1 ? "" : "s"} missed the deadline without completion sign-off.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ExecutivePortalGuard>
  );
}
