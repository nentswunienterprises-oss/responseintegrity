import { useEffect, useMemo, useState } from "react";
import "./pod.mobile.css";
import { useIntroSessionStatus } from "@/hooks/useIntroSessionStatus";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabaseClient";
import { authorizedGetJson } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentCard } from "@/components/tutor/StudentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ApplicationForm } from "@/components/tutor/application-form";
import StudentIdentitySheet from "@/components/tutor/StudentIdentitySheet";
import ParentOnboardingProposal from "@/components/tutor/ParentOnboardingProposal";
import ViewAssignmentsDialog from "@/components/tutor/ViewAssignmentsDialog";
import ViewTrackingSystemsDialog from "@/components/tutor/ViewTrackingSystemsDialog";
import StudentReportsDialog from "@/components/tutor/StudentReportsDialog";
import StudentTopicConditioningDialog from "@/components/tutor/StudentTopicConditioningDialog";
import StudentCommunicationDialog from "@/components/communications/StudentCommunicationDialog";
import { PushOptInCard } from "@/components/push/PushOptInCard";
import { getAuthMode } from "@/lib/authMode";
import { TrialProgressCard } from "@/components/trial/TrialProgressCard";
import type { Student, TutorAssignment, Pod } from "@shared/schema";
import type { BattleTestingTutorSummary, TutorTrainingMode } from "@shared/battleTesting";
import type { TrialCaseOverview } from "@shared/trialCertification";

interface PodData {
  assignment: TutorAssignment & { pod: Pod };
  students: Student[];
}

interface PodTeamMember {
  id: string;
  name: string;
}

interface PodTeamData {
  pod: { id: string; podName: string } | null;
  territoryDirector: {
    id: string;
    name: string;
  } | null;
  members: PodTeamMember[];
  memberCount: number;
  capacity: number;
}

interface TutorAlignmentSummaryData {
  podId: string | null;
  podName: string | null;
  assignmentId: string | null;
  operationalMode: TutorTrainingMode;
  alignmentSummary: BattleTestingTutorSummary | null;
  sandboxProgress?: {
    qualification?: {
      policyVersion: number;
      developmentCoverageReady: boolean;
      qualificationReady: boolean;
      qualifyingSessions: number;
      requiredSessions: number;
      phaseCounts: Record<string, number>;
      phaseMinimums: Record<string, number>;
      reason: string;
      coverageCategories?: Array<{
        key: string;
        label: string;
        met: number;
        required: number;
        completedOpportunities: number;
        requiredOpportunities: number;
      }>;
      sourceStatus?: "available" | "unavailable";
      sourceGaps?: string[];
    };
    practicalsReady: boolean;
    reason: string;
  } | null;
  developmentPathway?: {
    currentStage: string;
    pathway: { status: string; timeline?: { label?: string; daysRemaining?: number | null } | null } | null;
    training?: { sandboxReady: boolean; summary?: Record<string, { complete: number; total: number }> };
    sandbox?: { readiness?: { practicalsReady?: boolean; qualification?: { qualificationReady?: boolean; qualifyingSessions?: number; requiredSessions?: number; phaseCounts?: Record<string, number>; phaseMinimums?: Record<string, number>; reason?: string } }; latestAssessment?: { decision?: string } | null };
    trial?: { status?: string; gate?: { reviewable?: boolean } } | null;
  } | null;
}

interface TutorPodSession {
  id: string;
  scheduled_time: string;
  status: string;
  type: string;
  timezone?: string | null;
  student?: {
    id: string;
    name: string;
    grade?: string | null;
  } | null;
}

interface TutorPodWeeklyScheduleResponse {
  sessions: TutorPodSession[];
  operationalMode?: "training" | "sandbox" | "trial" | "certified_live";
  sessionSchedulingEnabled?: boolean;
}

function formatTutorAuditTimestamp(value: string | null | undefined) {
  if (!value) return "Not yet audited";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


const SANDBOX_PHASES = ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"] as const;

function formatDevelopmentStage(value: string | null | undefined) {
  const labels: Record<string, string> = {
    application: "Application", training: "Training", sandbox: "Sandbox", practicals: "Practicals", trial: "Trial", certification: "Certification", certified_live: "Certified Live",
  };
  return labels[String(value || "").toLowerCase()] || "Pathway stage unavailable";
}

function formatDevelopmentNextAction(stage: string | null | undefined, pathway: TutorAlignmentSummaryData["developmentPathway"]) {
  const value = String(stage || "").toLowerCase();
  if (value === "application") return "Complete application and onboarding requirements before Training begins.";
  if (value === "training") return pathway?.training?.sandboxReady ? "Training gate complete; Sandbox is the next governed stage." : "Complete the assigned Deep Dives and Mastery Checks to establish the Training gate.";
  if (value === "sandbox") return pathway?.sandbox?.readiness?.qualification?.qualificationReady ? "Sandbox evidence is complete; assigned TD review is the next gate." : "Complete the prescribed phase-balanced Sandbox evidence run."; 
  if (value === "practicals") return "Complete Prepare, Execute and Evidence for the assigned Practicals."; 
  if (value === "trial") return "Complete the two-family Trial evidence window and outcome reviews."; 
  if (value === "certification") return "Complete the remaining certification review decisions."; 
  if (value === "certified_live") return "Certified Live. Continue operating under the RI-OS evidence standard."; 
  return "The next governed pathway requirement will appear here."; 
}

function formatTutorMode(value: TutorAlignmentSummaryData["operationalMode"]) {
  if (!value) return "Unavailable";
  if (value === "certified_live") return "Certified Live";
  if (value === "trial") return "Trial";
  if (value === "sandbox") return "Sandbox Mode";
  if (value === "suspended") return "Suspended";
  if (value === "applicant") return "Applicant";
  return "Training Mode";
}

function formatTutorGradeLabel(grade?: string | null) {
  const trimmed = String(grade || "").trim();
  return /^grade\b/i.test(trimmed) ? trimmed : trimmed ? `Grade ${trimmed}` : trimmed;
}

function formatSessionStatus(status?: string | null) {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "pending_parent_confirmation") return "Awaiting Parent";
  if (raw === "pending_tutor_confirmation") return "Awaiting Specialist";
  if (raw === "confirmed") return "Confirmed";
  if (raw === "ready") return "Ready";
  if (raw === "live") return "Live";
  if (raw === "completed") return "Completed";
  return raw ? raw.replace(/_/g, " ") : "Scheduled";
}

function formatSessionType(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "intro" ? "Intro Session" : "Training Session";
}

function formatSessionTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TutorPod() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [emergencyDbMode, setEmergencyDbMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [identitySheetOpen, setIdentitySheetOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [proposalOpen, setProposalOpen] = useState(false);
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [topicConditioningDialogOpen, setTopicConditioningDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [studentIdentitySheets, setStudentIdentitySheets] = useState<Record<string, any>>({});
  // Force refresh - identity sheet integration

  useEffect(() => {
    getAuthMode().then((mode) => setEmergencyDbMode(mode.emergencyDbMode));
  }, []);

  const {
    data: podData,
    isLoading,
    error,
  } = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    enabled: isAuthenticated && !authLoading,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const {
    data: applications,
    isLoading: applicationsLoading,
    isFetching: applicationsFetching,
  } = useQuery<any[]>({
    queryKey: ["/api/tutor/applications"],
    enabled: isAuthenticated && !authLoading,
  });

  const { data: podTeamData, isLoading: podTeamLoading } = useQuery<PodTeamData>({
    queryKey: ["/api/tutor/pod-team"],
    queryFn: async () => {
      const raw = await authorizedGetJson<any>("/api/tutor/pod-team");
      const members = Array.isArray(raw?.members)
        ? raw.members
            .map((member: any) => ({
              id: String(member?.id || ""),
              name: String(member?.name || "").trim(),
            }))
            .filter((member: PodTeamMember) => member.id && member.name)
        : [];

      return {
        pod: raw?.pod
          ? {
              id: String(raw.pod.id || ""),
              podName: String(raw.pod.podName || raw.pod.pod_name || ""),
            }
          : null,
        territoryDirector: raw?.territoryDirector
          ? {
              id: String(raw.territoryDirector.id || ""),
              name: String(raw.territoryDirector.name || "").trim(),
            }
          : null,
        members,
        memberCount: Number(raw?.memberCount ?? members.length),
        capacity: Number(raw?.capacity ?? 12),
      };
    },
    enabled: isAuthenticated && !authLoading,
  });
  const { data: tutorAlignmentSummary } = useQuery<TutorAlignmentSummaryData>({
    queryKey: ["/api/tutor/pod-alignment-summary"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: false,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });
  const { data: developmentPathway } = useQuery<TutorAlignmentSummaryData["developmentPathway"]>({
    queryKey: ["/api/tutor/development-pathway"],
    queryFn: async () => authorizedGetJson("/api/tutor/development-pathway"),
    enabled: isAuthenticated && !authLoading,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });
  const { data: trialCaseData } = useQuery<{ mode: TutorTrainingMode; case: TrialCaseOverview | null }>({
    queryKey: ["/api/tutor/trial-case"],
    queryFn: async () => authorizedGetJson("/api/tutor/trial-case"),
    enabled: isAuthenticated && !authLoading && !emergencyDbMode,
    refetchInterval: 15000,
  });
  const { data: weeklyScheduleData } = useQuery<TutorPodWeeklyScheduleResponse>({
    queryKey: ["/api/tutor/weekly-schedule", "current-week"],
    queryFn: async () => authorizedGetJson("/api/tutor/weekly-schedule"),
    enabled: isAuthenticated && !authLoading,
    refetchInterval: emergencyDbMode ? false : 15000,
    refetchIntervalInBackground: emergencyDbMode ? false : true,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const hasSubmittedApplication = applications && applications.length > 0;
  const hasPendingApplication = applications && applications.some((app: any) => app.status === "pending");
  const hasQualifiedApplication =
    applications &&
    applications.some((app: any) => app.status === "approved" || app.status === "confirmed");
  const onboardingCompleted = applications && applications.some((app: any) => !!app.onboardingCompletedAt);

  const podCapacity = podTeamData?.capacity || 12;
  const podMemberCount = podTeamData?.memberCount || 0;
  const teamMembers = podTeamData?.members || [];
  const studentIds = useMemo(
    () => (podData?.students || []).map((student) => String(student.id)).join(","),
    [podData?.students]
  );

  const sortedTeamMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers]);

  const schedulingEnabled = weeklyScheduleData?.sessionSchedulingEnabled ?? true;
  const todaySessions = useMemo(() => {
    const now = new Date();
    const allowedStatuses = new Set(["confirmed", "completed"]);
    return (weeklyScheduleData?.sessions || [])
      .filter((session) => {
        const scheduled = new Date(session.scheduled_time);
        const status = String(session.status || "").trim().toLowerCase();
        if (!allowedStatuses.has(status)) return false;
        return (
          scheduled.getFullYear() === now.getFullYear() &&
          scheduled.getMonth() === now.getMonth() &&
          scheduled.getDate() === now.getDate()
        );
      })
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
  }, [weeklyScheduleData?.sessions]);

  const isCurrentTutor = (member: PodTeamMember | null) => {
    if (!member) return false;
    const userId = String((user as any)?.id || "").trim();
    const memberId = String(member.id || "").trim();
    return !!userId && !!memberId && userId === memberId;
  };

  // Redirect to gateway if tutor hasn't completed onboarding (no approved application or no pod assignment)
  useEffect(() => {
    if (!authLoading && !isLoading && !applicationsLoading && !applicationsFetching && isAuthenticated) {
      // If onboarding not completed and there is no qualifying application or no pod assignment, return to gateway.
      if (!onboardingCompleted && (!hasQualifiedApplication || !podData?.assignment)) {
        navigate("/operational/specialist/gateway");
      }
    }
  }, [
    authLoading,
    isLoading,
    applicationsLoading,
    applicationsFetching,
    isAuthenticated,
    onboardingCompleted,
    hasQualifiedApplication,
    podData?.assignment,
    navigate,
  ]);

  useEffect(() => {
    if (!authLoading && !isLoading && isAuthenticated && podData?.assignment && (!podData.students || podData.students.length === 0)) {
      const retryTimer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] });
      }, 3000);

      return () => window.clearTimeout(retryTimer);
    }
  }, [authLoading, isAuthenticated, isLoading, podData?.assignment, podData?.students?.length, queryClient]);

  // Fetch identity sheets for all students
  useEffect(() => {
    if (podData?.students && podData.students.length > 0) {
      const fetchIdentitySheets = async () => {
        const sheets: Record<string, any> = {};
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
          console.log("🔐 Auth token found, adding to headers");
        } else {
          console.warn("⚠️ No Supabase session token - requests may fail on cross-origin");
        }
        console.log("🔍 Fetching identity sheets, API_URL:", API_URL, "hostname:", window.location.hostname);
        for (const student of podData.students) {
          try {
            const path = `/api/tutor/students/${student.id}/identity-sheet`;
            const data = await authorizedGetJson(path);
            if (data && (data.identitySheet || data.personalProfile || data.emotionalInsights || data.academicDiagnosis)) {
              sheets[student.id] = data;
            }
          } catch (error) {
            console.error(`Failed to fetch identity sheet for student ${student.id}:`, error);
          }
        }
        setStudentIdentitySheets(sheets);
      };
      fetchIdentitySheets();
    }
  }, [studentIds]);

  useEffect(() => {
    const openProposal = searchParams.get("openProposal");
    const proposalStudentId = searchParams.get("studentId");
    const students = podData?.students || [];

    if (openProposal !== "1" || !proposalStudentId || students.length === 0) {
      return;
    }

    const matchedStudent = students.find((student: any) => String(student.id) === proposalStudentId);
    if (!matchedStudent) {
      return;
    }

    setSelectedStudentId(String(matchedStudent.id));
    setSelectedStudentName(String(matchedStudent.name || ""));
    setProposalOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("openProposal");
    nextParams.delete("studentId");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams.toString(), podData?.students?.length, studentIds]);

  // Authentication is handled by route protection, no need for manual redirects

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="ri-world-page ri-pod-world space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-96" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  // Show loading/sync state if user is confirmed and pod assignment is expected but not yet loaded
  if (!podData || !podData.assignment) {
    // Check if user is confirmed and should have a pod assignment
    const expectingPodAssignment = applications && applications.some((app: any) => app.status === "confirmed");
    return (
      <DashboardLayout>
        <div className="ri-world-page ri-pod-world space-y-8">
          <div className="ri-world-hero rounded-2xl border border-primary/15 bg-background p-5 shadow-sm sm:p-7">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Specialist Pod</p>
              <h1 className="text-3xl font-semibold tracking-[-0.01em] md:text-4xl">
                Welcome back, {user?.name?.split(" ")[0] || "Specialist"}.
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Your pod assignment will unlock the live operating layer for students, onboarding, conditioning, and reports.
              </p>
            </div>
          </div>

          <PushOptInCard
            enabled
            title="Enable out-of-app alerts"
            description="Turn on browser notifications so Response Integrity can alert you when parents respond to proposals or sessions, or when new assignments arrive."
          />

          {expectingPodAssignment ? (
            <Card className="ri-metric-card border-primary/15 bg-background shadow-sm">
              <div className="space-y-5 p-8 text-center sm:p-12">
                <div className="mx-auto max-w-2xl space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Syncing Assignment</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Pod Assignment Syncing...</h2>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    Your pod assignment is being prepared. This may take a few seconds. If this persists, please refresh.
                  </p>
                </div>
                <div className="flex justify-center mt-6">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="ri-metric-card border-primary/15 bg-background shadow-sm">
              <div className="space-y-5 p-8 text-center sm:p-12">
                <div className="mx-auto max-w-2xl space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {hasPendingApplication ? "Application Status" : "Assignment Status"}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
                    {hasPendingApplication ? "Application Pending" : "No Pod Assignment Yet"}
                  </h2>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    {hasPendingApplication
                      ? "Your application is under review. Once approved, this space becomes your operating view for student training and pod work."
                      : "You do not have any students assigned yet. Pod assignment will unlock your live Specialist operating view."}
                  </p>
                </div>

                <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Roster</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Students appear here after pod assignment.</p>
                  </div>
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Systems</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Identity sheets, conditioning, and reports unlock here.</p>
                  </div>
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Pod</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Your territory director and pod context live here.</p>
                  </div>
                </div>
                {/* No Apply Now button if user is confirmed or has an application */}
              </div>
            </Card>
          )}

          <Dialog open={showApplicationForm} onOpenChange={setShowApplicationForm}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Response Integrity - Founding Team Application</DialogTitle>
              </DialogHeader>
              <ApplicationForm
                onSuccess={() => {
                  setShowApplicationForm(false);
                  toast({
                    title: "Application Submitted!",
                    description: "Thank you for applying. We'll review your application soon.",
                  });
                }}
                onCancel={() => setShowApplicationForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  const { assignment, students } = podData;
  const sessionsUsedForStudent = (student: any) => {
    const quotaSnapshot = student.parentInfo?.monthlyQuota || student.monthlyQuota || null;
    return quotaSnapshot
      ? Math.max(0, Number(quotaSnapshot.sessions_used ?? 0))
      : Math.max(0, Number(student.sessionProgress || 0));
  };
  const sessionsRemainingForStudent = (student: any) => {
    const quotaSnapshot = student.parentInfo?.monthlyQuota || student.monthlyQuota || null;
    if (quotaSnapshot) {
      return Math.max(0, Number(quotaSnapshot.sessions_remaining ?? 0));
    }

    const progressTotal = student.parentInfo?.onboarding_type === "pilot"
      ? 9
      : Math.max(1, Number(student.parentInfo?.package_sessions || 8));
    const completed = Math.max(0, Number(student.sessionProgress || 0));
    const cycleProgress = completed > 0 ? (((completed - 1) % progressTotal) + 1) : 0;
    return cycleProgress === 0 ? progressTotal : Math.max(0, progressTotal - cycleProgress);
  };
  const selectedStudent = (students as any[]).find((s: any) => s.id === selectedStudentId) || null;

  const firstName = user?.name?.split(" ")[0] || "Specialist";
  const standingSummary = tutorAlignmentSummary ? { ...tutorAlignmentSummary, developmentPathway: developmentPathway || tutorAlignmentSummary.developmentPathway || null } : tutorAlignmentSummary;

  const specialistOperationalMode = String(
    trialCaseData?.mode ||
      tutorAlignmentSummary?.operationalMode ||
      (assignment as any).operationalMode ||
      "training",
  ).toLowerCase();
  const showCapabilityTraining = ["training", "sandbox"].includes(
    specialistOperationalMode,
  );
  const sandboxTrainingActive = specialistOperationalMode === "sandbox";

  return (
    <DashboardLayout>
      <div className="ri-world-page ri-pod-world space-y-8">
        <div className="ri-world-hero rounded-2xl border border-primary/15 bg-background p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Specialist Pod</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] md:text-4xl">
                Welcome back, {firstName}.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                You are training calm execution, response structure, and stability across your active students.
              </p>
            </div>
            <Badge
              className="tutor-pod-badge-mobile bg-primary/20 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-primary border border-primary/30 rounded-md sm:bg-primary/90 sm:text-primary-foreground sm:px-4 sm:py-1.5 sm:font-semibold"
              data-testid="badge-pod-name"
              style={{maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle'}}
            >
              {assignment.pod.podName}
            </Badge>
          </div>
        </div>

        <PushOptInCard
          enabled
          title="Enable out-of-app alerts"
          description="Turn on browser notifications so Response Integrity can alert you when parents respond to proposals or sessions, or when new assignments arrive."
        />

        <TrialProgressCard
          mode={trialCaseData?.mode || tutorAlignmentSummary?.operationalMode || "training"}
          trialCase={trialCaseData?.case || null}
        />

        {showCapabilityTraining ? (
          <Card className="ri-focus-card border-primary/15 bg-background shadow-sm">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {sandboxTrainingActive ? "Sandbox · Development Gate" : "Specialist Training"}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">
                  {sandboxTrainingActive ? "Complete development coverage first" : "Deep Dives & Mastery Checks"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sandboxTrainingActive
                    ? "The final Sandbox qualification run is locked until the required development coverage is established. Complete the prescribed Sandbox opportunities before returning to remaining Deep Dives."
                    : "Work through each Deep Dive and complete its Mastery Check. Transformation Mastery, Retention and Application unlock Sandbox."}
                </p>
              </div>
              {!sandboxTrainingActive ? (
                <Button asChild className="shrink-0">
                  <Link to="/responseconditioningsystem">Open Deep Dives</Link>
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {sandboxTrainingActive ? (
          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h2 className="font-semibold">Practicals</h2>
                <p className="text-sm text-muted-foreground">Opens after capability readiness and assigned TD approval. Sandbox permission remains unchanged.</p>
              </div>
              <Button asChild variant="outline"><Link to="/specialist/practicals">View Practicals</Link></Button>
            </div>
          </Card>
        ) : null}

        <Card className="ri-alignment-shell ri-metric-card border-primary/15 bg-background shadow-sm">
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Specialist Development Pathway</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Your standing in the system</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the authoritative Specialist Development Pathway standing: current stage, evidence state and next governed requirement.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="ri-alignment-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Operational Mode</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatTutorMode(tutorAlignmentSummary?.operationalMode)}
                </p>
              </div>
              <div className="ri-alignment-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Current Stage</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatDevelopmentStage(standingSummary?.developmentPathway?.currentStage || tutorAlignmentSummary?.operationalMode)}
                </p>
              </div>
              <div className="ri-alignment-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {tutorAlignmentSummary?.sandboxProgress?.qualification
                    ? tutorAlignmentSummary.sandboxProgress.qualification.qualificationReady
                      ? "Qualified pending TD review. Practicals do not open automatically."
                      : tutorAlignmentSummary.sandboxProgress.qualification.developmentCoverageReady
                        ? "Final qualification run in progress."
                         : "Sandbox development coverage is incomplete; the final qualification run is locked."
                    : "Pathway standing is available above. Follow the next governed requirement."}
                </p>
              </div>
            </div>

            <div className="ri-alignment-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Next governed requirement</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatDevelopmentNextAction(standingSummary?.developmentPathway?.currentStage, standingSummary?.developmentPathway)}
              </p>
            </div>

            {tutorAlignmentSummary?.sandboxProgress?.qualification ? (
              <div className="ri-alignment-section rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sandbox Qualification</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {tutorAlignmentSummary.sandboxProgress.qualification.qualifyingSessions}/
                      {tutorAlignmentSummary.sandboxProgress.qualification.requiredSessions} clean sessions credited
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Two clean sessions are required in each RI-OS phase.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={tutorAlignmentSummary.sandboxProgress.qualification.qualificationReady ? "default" : "outline"}>
                      {tutorAlignmentSummary.sandboxProgress.qualification.qualificationReady
                        ? "Ready for TD review"
                        : tutorAlignmentSummary.sandboxProgress.qualification.developmentCoverageReady
                          ? "Final run in progress"
                          : "Locked"}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCoverageDialogOpen(true)}>
                      Inspect coverage
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {SANDBOX_PHASES.map((phase) => {
                    const count = tutorAlignmentSummary.sandboxProgress?.qualification?.phaseCounts?.[phase] || 0;
                    const required = tutorAlignmentSummary.sandboxProgress?.qualification?.phaseMinimums?.[phase] || 2;
                    return (
                      <div key={phase} className="ri-alignment-info-card rounded-xl border border-primary/15 bg-background px-3 py-2 text-sm text-foreground">
                        <span className="font-medium">{phase}</span>
                        <span className="ml-2 text-muted-foreground">
                          {tutorAlignmentSummary.sandboxProgress.qualification.developmentCoverageReady ? `${count}/${required}` : "Locked"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {tutorAlignmentSummary.sandboxProgress.qualification.qualificationReady
                    ? "All numeric requirements are complete. TD approval is still required before Practicals."
                    : (() => {
                        const next = SANDBOX_PHASES.find((phase) =>
                          (tutorAlignmentSummary.sandboxProgress?.qualification?.phaseCounts?.[phase] || 0) <
                          (tutorAlignmentSummary.sandboxProgress?.qualification?.phaseMinimums?.[phase] || 2),
                        );
                        return tutorAlignmentSummary.sandboxProgress?.qualification?.developmentCoverageReady
                          ? (next ? "Next requirement: one clean " + next + " session." : tutorAlignmentSummary.sandboxProgress?.qualification?.reason)
                          : "Next requirement: complete development coverage before the final qualification run opens.";
                      })()}
                </p>
              </div>
            ) : null}

            {tutorAlignmentSummary?.alignmentSummary?.certificationRecoveryNote && (
              <div className="ri-alignment-info-card rounded-xl border border-primary/35 bg-primary/10 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-primary">Recovery Required</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {tutorAlignmentSummary.alignmentSummary.certificationRecoveryNote}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Card className="ri-pod-section-shell ri-metric-card border-primary/15 bg-background shadow-sm">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Pod Team</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Territory Director and Pod</h2>
              </div>
              <div className="ri-pod-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Team Capacity</p>
                <p className="mt-2 text-sm text-foreground">Pod Members ({podMemberCount}/{podCapacity})</p>
              </div>
              <p className="text-sm text-muted-foreground">Use this to review the TD layer and the Specialists operating in your Pod.</p>
              <Button
                className="w-full justify-start text-sm"
                variant="outline"
                onClick={() => setTeamDialogOpen(true)}
                disabled={podTeamLoading}
              >
                View Team
              </Button>
            </div>
          </Card>

          <Card className="ri-pod-section-shell ri-metric-card border-primary/15 bg-background shadow-sm">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Protocol</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Transformation Process</h2>
              </div>
              <div className="ri-pod-info-card rounded-xl border border-primary/15 bg-muted/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Response Integrity-OS Protocol</p>
                <p className="mt-2 text-sm text-foreground">3-Layer Lens + Boss Battles + Timed Execution = Conditioned Response.</p>
              </div>
              <Button className="w-full justify-start text-sm" variant="outline" asChild>
                <Link to="/responseconditioningsystem">
                  View Response Integrity-OS Protocol
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        <Card className="ri-pod-section-shell ri-metric-card border-primary/15 bg-background shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Today</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Today's Sessions</h2>
              <p className="mt-1 text-sm text-muted-foreground">The live operating window for today’s delivery load.</p>
            </div>
            <div className="ri-pod-info-card rounded-xl border border-primary/15 bg-muted/20 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Scheduled</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{todaySessions.length}</p>
            </div>
          </div>
          {todaySessions.length > 0 ? (
            <div className="border-t border-border/60 px-5 py-5 sm:px-6 sm:py-6">
              {!schedulingEnabled ? (
                <div className="mb-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Training mode is active.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scheduling is disabled for new bookings, but existing sessions for today are still listed below.
                  </p>
                </div>
              ) : null}
              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <div key={session.id} className="ri-pod-info-card rounded-xl border border-border/70 bg-background px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {session.student?.name || "Unlinked student"} • {formatSessionType(session.type)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatSessionTime(session.scheduled_time)}
                          {session.student?.grade ? ` • ${formatTutorGradeLabel(session.student.grade)}` : ""}
                          {session.timezone ? ` • ${session.timezone}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatSessionStatus(session.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !schedulingEnabled ? (
            <div className="border-t border-border/60 px-5 py-10 text-center sm:px-6 sm:py-12">
              <p className="text-base font-medium text-foreground">Live session scheduling is currently disabled.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You are in training mode, so booked lesson windows are hidden until certified live mode is active.
              </p>
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="border-t border-border/60 px-5 py-10 text-center sm:px-6 sm:py-12">
              <p className="text-base font-medium text-foreground">No sessions scheduled today.</p>
              <p className="mt-2 text-sm text-muted-foreground">Use the time to review identity sheets, proposals, and topic conditioning before the next student block.</p>
            </div>
          ) : (
            <div className="border-t border-border/60 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <div key={session.id} className="ri-pod-info-card flex flex-col gap-2 rounded-xl border border-primary/15 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {session.student?.name || "Unlinked student"} - {formatSessionType(session.type)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatSessionTime(session.scheduled_time)}
                        {session.student?.grade ? ` - ${formatTutorGradeLabel(session.student.grade)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{formatSessionStatus(session.status)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Students Cards */}
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Student Roster</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.01em]">My Assigned Students</h2>
              <p className="mt-1 text-sm text-muted-foreground">Active students, onboarding status, and training systems in one operating view.</p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-muted/20 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Active Students</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{students.length}</p>
            </div>
          </div>

          {students.length === 0 ? (
            <Card className="rounded-2xl border border-primary/15 bg-background p-10 text-center shadow-sm sm:p-12">
              <div className="mx-auto max-w-xl space-y-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Roster Empty</p>
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-foreground">No Students Assigned</h3>
                <p className="text-sm text-muted-foreground">
                  Once students are assigned, this roster becomes the operating layer for onboarding, conditioning, reports, and progress review.
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-5 xl:flex-row xl:flex-wrap xl:items-start 2xl:gap-6 tutor-pod-student-cards">
              {students.map((student: any) => {
                console.log('StudentCard student data:', student);
                return (
                  <div key={student.id} className="w-full xl:w-[calc(50%-1.25rem)]">
                    <StudentCard
                      student={student}
                      operationalMode={(assignment as any).operationalMode || "training"}
                      setSelectedStudentId={setSelectedStudentId}
                      setSelectedStudentName={setSelectedStudentName}
                      setIdentitySheetOpen={setIdentitySheetOpen}
                      setTrackingDialogOpen={setTrackingDialogOpen}
                      setAssignmentsDialogOpen={setAssignmentsDialogOpen}
                      setProposalOpen={setProposalOpen}
                      setTopicConditioningDialogOpen={setTopicConditioningDialogOpen}
                      setReportsDialogOpen={setReportsDialogOpen}
                      setCommunicationDialogOpen={setCommunicationDialogOpen}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <StudentIdentitySheet
          open={identitySheetOpen}
          onOpenChange={setIdentitySheetOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          onSaved={async () => {
            // Refresh identity sheet data
            if (selectedStudentId) {
              const { data: { session } } = await supabase.auth.getSession();
              const headers: HeadersInit = {};
              if (session?.access_token) {
                headers.Authorization = `Bearer ${session.access_token}`;
              }
              try {
                const data = await authorizedGetJson(`/api/tutor/students/${selectedStudentId}/identity-sheet`);
                console.log("🔍 Data received after save:", data);
                console.log("🔍 Has any data?", !!(data && (data.identitySheet || data.personalProfile || data.emotionalInsights || data.academicDiagnosis)));
                if (data && (data.identitySheet || data.personalProfile || data.emotionalInsights || data.academicDiagnosis)) {
                  console.log("✅ Setting studentIdentitySheets for:", selectedStudentId);
                  setStudentIdentitySheets((prev) => {
                    const newState = {
                      ...prev,
                      [selectedStudentId]: data,
                    };
                    console.log("📊 New state:", newState);
                    return newState;
                  });
                } else {
                  console.error("❌ No valid data in response");
                }
              } catch (err) {
                console.error("❌ Failed to fetch after save:", err);
              }
            }
            
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] });
            if (selectedStudentId) {
              queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", selectedStudentId, "workflow-state"] });
            }

            toast({
              title: "Success",
              description: "Identity sheet saved successfully",
            });
          }}
        />

        <ParentOnboardingProposal
          open={proposalOpen}
          onOpenChange={setProposalOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          tutorName={user?.name || "Your Specialist"}
          identitySheetData={studentIdentitySheets[selectedStudentId]}
          parentTopics={
            (((podData?.students as any[]) ?? []).find((s: any) => s.id === selectedStudentId)?.parentInfo?.reported_topics as string[] | undefined)?.join(", ") ||
            Object.keys((((podData?.students as any[]) ?? []).find((s: any) => s.id === selectedStudentId)?.parentInfo?.topic_response_symptoms as Record<string, unknown> | undefined) || {}).join(", ") ||
            ""
          }
        />

        <ViewAssignmentsDialog
          open={assignmentsDialogOpen}
          onOpenChange={setAssignmentsDialogOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
        />

        <ViewTrackingSystemsDialog
          open={trackingDialogOpen}
          onOpenChange={setTrackingDialogOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
        />

        <StudentReportsDialog
          open={reportsDialogOpen}
          onOpenChange={setReportsDialogOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
        />

        <StudentTopicConditioningDialog
          open={topicConditioningDialogOpen}
          onOpenChange={setTopicConditioningDialogOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          operationalMode={(assignment as any).operationalMode || "training"}
          studentGrade={selectedStudent?.grade || null}
          parentTopics={
            (selectedStudent?.parentInfo?.reported_topics as string[] | undefined)?.join(", ") ||
            Object.keys((selectedStudent?.parentInfo?.topic_response_symptoms as Record<string, unknown> | undefined) || {}).join(", ") ||
            ""
          }
          topicConditioning={selectedStudent?.topicConditioning || null}
          persistedTopicStates={((selectedStudent as any)?.conceptMastery?.topicConditioning?.topics as Record<string, any>) || null}
        />

        <StudentCommunicationDialog
          open={communicationDialogOpen}
          onOpenChange={setCommunicationDialogOpen}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
        />

        <Dialog open={coverageDialogOpen} onOpenChange={setCoverageDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Development coverage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This shows the governed coverage areas required before the final Sandbox qualification run opens.
              </p>
              {tutorAlignmentSummary?.sandboxProgress?.qualification?.sourceStatus === "unavailable" ? (
                <Alert>
                  <AlertDescription>
                    Coverage source unavailable. These counters are not evidence of failure and will not be credited until the persisted source is readable.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                {(tutorAlignmentSummary?.sandboxProgress?.qualification?.coverageCategories || []).map((category) => (
                  <div key={category.key} className="rounded-xl border border-primary/15 bg-muted/20 p-4">
                    <p className="text-xs font-medium text-foreground">{category.label}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {category.completedOpportunities}/{category.requiredOpportunities}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category.met}/{category.required} requirements complete
                    </p>
                  </div>
                ))}
              </div>
              {!(tutorAlignmentSummary?.sandboxProgress?.qualification?.coverageCategories?.length) ? (
                <p className="text-sm text-muted-foreground">Coverage detail is not available yet.</p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pod Team</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {podTeamData?.territoryDirector ? (
                <section className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Territory Director
                  </p>
                  <div className="border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {podTeamData.territoryDirector.name}
                    </p>
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Specialists
                </p>
                {sortedTeamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Pod members found.</p>
                ) : (
                  <div className="divide-y divide-border/60 border border-border/70">
                    {sortedTeamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 px-4 py-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {member.name}
                        </p>
                        {isCurrentTutor(member) ? (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">
                            You
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <p className="text-xs text-muted-foreground">
                Pod team view shows names only. Contact and profile details remain private.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
