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
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
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
import type { Student, TutorAssignment, Pod } from "@shared/schema";
import type { BattleTestingTutorSummary, TutorTrainingMode } from "@shared/battleTesting";

interface PodData {
  assignment: TutorAssignment & { pod: Pod };
  students: Student[];
}

interface PodTeamMember {
  id: string;
  assignmentId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  grade: string | null;
  school: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  certificationStatus: string;
  operationalMode?: "training" | "certified_live";
}

interface PodTeamData {
  pod: { id: string; podName: string } | null;
  territoryDirector: {
    id: string;
    name: string;
    email: string;
    phone: string;
    bio: string | null;
    profileImageUrl: string | null;
    role: string;
  } | null;
  members: PodTeamMember[];
  memberCount: number;
  capacity: number;
}

interface TutorAlignmentSummaryData {
  podId: string | null;
  podName: string | null;
  assignmentId: string | null;
  operationalMode: TutorTrainingMode | "training" | "certified_live";
  alignmentSummary: BattleTestingTutorSummary | null;
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
  operationalMode?: "training" | "certified_live";
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

function formatTutorAlignmentStatus(value: string | null | undefined) {
  if (!value) return "You have not been fully reviewed yet.";
  if (value === "Complete the remaining tutor battle-test audits.") {
    return "Your full alignment review is not complete yet. Remaining Response Integrity audit modules still need to be checked.";
  }
  if (value === "Continue. Eligible for greater responsibility if other operating criteria hold.") {
    return "You are in good standing. Keep operating at this level.";
  }
  if (value === "Correct immediately and retest in the next cycle.") {
    return "Your alignment needs strengthening. Review feedback and prepare for recheck.";
  }
  if (value === "Remove from live responsibility and recondition before returning.") {
    return "You are off standard right now. Reconditioning is required before returning to live work.";
  }
  return value;
}

function formatTutorMode(value: TutorAlignmentSummaryData["operationalMode"]) {
  if (value === "certified_live") return "Certified Live";
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
  if (raw === "pending_tutor_confirmation") return "Awaiting Tutor";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [identitySheetOpen, setIdentitySheetOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [showFullStanding, setShowFullStanding] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [topicConditioningDialogOpen, setTopicConditioningDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [studentIdentitySheets, setStudentIdentitySheets] = useState<Record<string, any>>({});
  // Force refresh - identity sheet integration

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
    enabled: isAuthenticated && !authLoading,
  });
  const { data: tutorAlignmentSummary } = useQuery<TutorAlignmentSummaryData>({
    queryKey: ["/api/tutor/pod-alignment-summary"],
    enabled: isAuthenticated && !authLoading,
  });
  const { data: weeklyScheduleData } = useQuery<TutorPodWeeklyScheduleResponse>({
    queryKey: ["/api/tutor/weekly-schedule", "current-week"],
    queryFn: async () => authorizedGetJson("/api/tutor/weekly-schedule"),
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 15000,
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
    return (weeklyScheduleData?.sessions || [])
      .filter((session) => {
        const scheduled = new Date(session.scheduled_time);
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
    if (userId && memberId && userId === memberId) return true;

    const userEmail = String((user as any)?.email || "").trim().toLowerCase();
    const memberEmail = String(member.email || "").trim().toLowerCase();
    return !!userEmail && !!memberEmail && userEmail === memberEmail;
  };

  useEffect(() => {
    if (!teamDialogOpen) return;
    if (!selectedTeamMemberId) {
      if (podTeamData?.territoryDirector) {
        setSelectedTeamMemberId("td");
      } else if (sortedTeamMembers.length > 0) {
        setSelectedTeamMemberId(sortedTeamMembers[0].id);
      }
    }
  }, [teamDialogOpen, selectedTeamMemberId, sortedTeamMembers, podTeamData?.territoryDirector]);

  // Redirect to gateway if tutor hasn't completed onboarding (no approved application or no pod assignment)
  useEffect(() => {
    if (!authLoading && !isLoading && !applicationsLoading && !applicationsFetching && isAuthenticated) {
      // If onboarding not completed and there is no qualifying application or no pod assignment, return to gateway.
      if (!onboardingCompleted && (!hasQualifiedApplication || !podData?.assignment)) {
        navigate("/operational/tutor/gateway");
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
        <div className="space-y-6">
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
        <div className="space-y-8">
          <div className="rounded-2xl border border-primary/15 bg-background p-5 shadow-sm sm:p-7">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tutor Pod</p>
              <h1 className="text-3xl font-semibold tracking-[-0.01em] md:text-4xl">
                Welcome back, {user?.name?.split(" ")[0] || "Tutor"}.
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
            <Card className="border-primary/15 bg-background shadow-sm">
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
            <Card className="border-primary/15 bg-background shadow-sm">
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
                      : "You do not have any students assigned yet. Pod assignment will unlock your live tutor operating view."}
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
  const totalSessions = students.reduce((sum: number, s: any) => sum + (s.sessionProgress || 0), 0);
  const sessionsRemainingForStudent = (student: any) => {
    const progressTotal = student.parentInfo?.onboarding_type === 'pilot' ? 9 : 8;
    const completed = Math.max(0, Number(student.sessionProgress || 0));
    const cycleProgress = completed > 0 ? (((completed - 1) % progressTotal) + 1) : 0;
    return cycleProgress === 0 ? progressTotal : Math.max(0, progressTotal - cycleProgress);
  };
  const remainingSessions = students.reduce((sum: number, s: any) => {
    return sum + sessionsRemainingForStudent(s);
  }, 0);
  const studentsImpacted = students.filter((s: any) => s.sessionProgress > 0).length;
  const selectedStudent = (students as any[]).find((s: any) => s.id === selectedStudentId) || null;

  const firstName = user?.name?.split(" ")[0] || "Tutor";
  const selectedTeamMember = sortedTeamMembers.find((m) => m.id === selectedTeamMemberId) || null;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="rounded-2xl border border-primary/15 bg-background p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tutor Pod</p>
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

        <div className="tutor-pod-stats grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sessions Done</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl" data-testid="text-sessions-done">
                {totalSessions}
              </p>
            </div>
          </Card>

          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Remaining</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl" data-testid="text-remaining">
                {remainingSessions}
              </p>
            </div>
          </Card>

          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Students Impacted</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl" data-testid="text-students-impacted">
                {studentsImpacted}
              </p>
            </div>
          </Card>
        </div>

        <Card className="border-primary/15 bg-background shadow-sm">
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tutor Alignment</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Your standing in the system</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This shows your latest audited alignment state and the battle-test modules already completed.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Operational Mode</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatTutorMode(tutorAlignmentSummary?.operationalMode || "training")}
                </p>
              </div>
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Last Audit</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatTutorAuditTimestamp(tutorAlignmentSummary?.alignmentSummary?.lastAuditAt)}
                </p>
              </div>
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatTutorAlignmentStatus(tutorAlignmentSummary?.alignmentSummary?.actionRequired)}
                </p>
              </div>
            </div>

            {tutorAlignmentSummary?.alignmentSummary?.certificationRecoveryNote && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-4 dark:border-orange-800 dark:bg-orange-950/20">
                <p className="text-[10px] uppercase tracking-[0.08em] text-orange-600 dark:text-orange-400">Recovery Required</p>
                <p className="mt-2 text-sm font-medium text-orange-900 dark:text-orange-100">
                  {tutorAlignmentSummary.alignmentSummary.certificationRecoveryNote}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Audit Modules</p>
              {tutorAlignmentSummary?.alignmentSummary?.phaseScores?.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {tutorAlignmentSummary.alignmentSummary.phaseScores.map((phase) => (
                    <div key={phase.phaseKey} className="rounded-xl border border-primary/15 bg-background px-3 py-2 text-sm text-foreground">
                      <span className="font-medium">{phase.title}</span>
                      <span className="ml-2 text-muted-foreground">{Math.round(phase.percent)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No tutor audit has been recorded for you yet.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowFullStanding((current) => !current)}
              >
                {showFullStanding ? "Hide Full Standing" : "View Full Standing"}
                {showFullStanding ? <ChevronUp className="ml-1.5 h-3.5 w-3.5" /> : <ChevronDown className="ml-1.5 h-3.5 w-3.5" />}
              </Button>
            </div>

            {showFullStanding ? (
              <>
                {!tutorAlignmentSummary?.alignmentSummary?.moduleProgress?.length &&
                !tutorAlignmentSummary?.alignmentSummary?.nextBattleTests?.length &&
                !tutorAlignmentSummary?.alignmentSummary?.deepDiveProgress?.length ? (
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-sm font-medium text-foreground">No detailed standing data available yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your summary standing is shown above. Detailed module, battle test, and deep dive progress will appear here once audit data is available.
                    </p>
                  </div>
                ) : null}

                {tutorAlignmentSummary?.alignmentSummary?.moduleProgress?.length ? (
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Module Progress</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {tutorAlignmentSummary.alignmentSummary.moduleProgress.map((module) => (
                        <div key={module.moduleKey} className="rounded-xl border border-primary/15 bg-background px-3 py-2 text-sm text-foreground">
                          <span className="font-medium">{module.title}</span>
                          <span className="ml-2 text-muted-foreground">
                            {module.completedCount}/{module.totalCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tutorAlignmentSummary?.alignmentSummary?.nextBattleTests?.length ? (
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Next Battle Test</p>
                    <div className="mt-3 space-y-2">
                      {tutorAlignmentSummary.alignmentSummary.nextBattleTests.map((entry) => (
                        <div key={entry.phaseKey} className="rounded-xl border border-primary/15 bg-background px-3 py-2 text-sm text-foreground">
                          <span className="font-medium">{entry.title}</span>
                          <span className="ml-2 text-muted-foreground">{entry.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tutorAlignmentSummary?.alignmentSummary?.deepDiveProgress?.length ? (
                  <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Deep Dive Progress</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {tutorAlignmentSummary.alignmentSummary.deepDiveProgress.map((entry) => (
                        <div
                          key={entry.phaseKey}
                          className="rounded-xl border border-primary/10 bg-background px-3 py-3 text-sm text-foreground"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{entry.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{entry.moduleTitle}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {entry.historicalState === "completed" ? "Completed" : "In progress"}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Streak {entry.currentStreak}/3</span>
                            <span>
                              Score {entry.latestScore == null ? "N/A" : `${Math.round(entry.latestScore)}%`}
                            </span>
                            <span>
                              {entry.currentHealthState === "locked"
                                ? "Locked"
                                : entry.currentHealthState === "watchlist"
                                ? "Watchlist"
                                : "Drift"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Pod Team</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Territory Director and Pod</h2>
              </div>
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Team Capacity</p>
                <p className="mt-2 text-sm text-foreground">Pod Members ({podMemberCount}/{podCapacity})</p>
              </div>
              <p className="text-sm text-muted-foreground">Use this to review the TD layer and the tutors operating in your pod.</p>
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

          <Card className="border-primary/15 bg-background shadow-sm">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Protocol</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Transformation Process</h2>
              </div>
              <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-3">
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

        <Card className="border-primary/15 bg-background shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Today</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Today's Sessions</h2>
              <p className="mt-1 text-sm text-muted-foreground">The live operating window for today’s delivery load.</p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-muted/20 px-3 py-2 text-right">
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
                  <div key={session.id} className="rounded-xl border border-border/70 bg-background px-4 py-3">
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
                  <div key={session.id} className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          tutorName={user?.name || "Your Tutor"}
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

        <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
            <DialogHeader className="px-6 py-4 border-b border-border/60">
              <DialogTitle>Pod Team Profiles</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[460px]">
              <div className="border-r border-border/60 p-4 space-y-3 overflow-y-auto">
                {podTeamData?.territoryDirector ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTeamMemberId("td")}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedTeamMemberId === "td" ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{podTeamData.territoryDirector.name}</p>
                    <p className="text-xs text-muted-foreground">Territory Director</p>
                  </button>
                ) : null}

                {sortedTeamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pod members found.</p>
                ) : (
                  sortedTeamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedTeamMemberId(member.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        selectedTeamMemberId === member.id ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        {isCurrentTutor(member) ? (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">You</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">Tutor</p>
                    </button>
                  ))
                )}
              </div>

              <div className="p-6 overflow-y-auto">
                {selectedTeamMemberId === "td" && podTeamData?.territoryDirector ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">{podTeamData.territoryDirector.name}</h3>
                    <p className="text-sm text-muted-foreground">Role: Territory Director</p>
                    <p className="text-sm text-muted-foreground">Email: {podTeamData.territoryDirector.email || "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">Phone: {podTeamData.territoryDirector.phone || "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">
                      Bio: {podTeamData.territoryDirector.bio || "No bio available."}
                    </p>
                  </div>
                ) : selectedTeamMember ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{selectedTeamMember.name}</h3>
                      {isCurrentTutor(selectedTeamMember) ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">You</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">Role: Tutor</p>
                    <p className="text-sm text-muted-foreground">Email: {selectedTeamMember.email || "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">Phone: {selectedTeamMember.phone || "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">School: {selectedTeamMember.school || "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">Grade: {selectedTeamMember.grade ? formatTutorGradeLabel(selectedTeamMember.grade) : "Not provided"}</p>
                    <p className="text-sm text-muted-foreground">
                      Certification: {selectedTeamMember.certificationStatus || "pending"}
                    </p>
                    <p className="text-sm text-muted-foreground">Bio: {selectedTeamMember.bio || "No bio available."}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a pod member to view profile details.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

