import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, MapPin, BookOpen, Users, GraduationCap, CheckCircle2, Clock, XCircle, FileCheck, ShieldCheck, CheckCircle, Mail, School, Wifi, CalendarDays, Target, CircleAlert, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrafficStats {
  totalApplications: number;
  pendingApplications: number;
  approvedTutors: number;
  availableForPods: number;
  totalEnrollments: number;
  studentEnrollments: number;
}
import { format } from "date-fns";
import AssignTutorModal from "@/components/executive/AssignTutorModal";
import { TutorDocumentReview } from "@/components/tutor/TutorDocumentReview";
import { COOAffiliateApplicationsPanel, COOTdApplicationsPanel } from "@/pages/executive/coo/applications";
import type { TutorApplication } from "@shared/schema";
import { RESPONSE_SYMPTOM_GROUPS } from "@shared/responseSymptomMapping";

interface ParentEnrollment {
  id: string;
  user_id: string;
  parent_full_name: string;
  parent_email: string;
  parent_phone: string;
  parent_city: string;
  student_full_name: string;
  student_grade: string;
  school_name: string;
  previous_tutoring: string;
  internet_access: string;
  parent_motivation?: string;
  status:
    | "not_enrolled"
    | "awaiting_assignment"
    | "awaiting_tutor_acceptance"
    | "assigned"
    | "proposal_sent"
    | "session_booked"
    | "report_received"
    | "confirmed";
  current_step?: string;
  assigned_tutor_id?: string | null;
  assigned_student_id?: string | null;
  assigned_tutor_name?: string | null;
  assigned_tutor_email?: string | null;
  assigned_pod_id?: string | null;
  assigned_pod_name?: string | null;
  active_in_pod?: boolean;
  updated_at?: string;
  created_at: string;
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

function getStructuredEnrollmentTopics(enrollment: ParentEnrollment): string[] {
  return Array.from(
    new Set([
      ...(Array.isArray(enrollment.parentInfo?.reported_topics) ? enrollment.parentInfo!.reported_topics : []),
      ...Object.keys(enrollment.parentInfo?.topic_response_symptoms || {}),
      ...Object.keys(enrollment.parentInfo?.topic_recommended_starting_phases || {}),
    ])
  );
}

function formatPhaseLabel(value: string | null | undefined) {
  return String(value || "")
    .split("_")
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
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

const TOTAL_DOC_STEPS = 6;

function getDocumentsStatus(application: any) {
  return {
    "1": "pending_upload",
    "2": "not_started",
    "3": "not_started",
    "4": "not_started",
    "5": "not_started",
    "6": "not_started",
    ...(application?.documentsStatus || application?.documents_status || {}),
  } as Record<string, string>;
}

function areAllDocumentsApproved(application: any) {
  const documentsStatus = getDocumentsStatus(application);
  return Array.from({ length: TOTAL_DOC_STEPS }, (_, index) => String(index + 1)).every(
    (step) => documentsStatus[step] === "approved"
  );
}

function hasPendingReview(application: any) {
  const documentsStatus = getDocumentsStatus(application);
  return ["2", "6"].some((step) => String(documentsStatus[step] || "") === "pending_review");
}

function hasMissingCompletedTemplate(application: any) {
  const documentsStatus = getDocumentsStatus(application);
  const hasDoc2Acceptance = Boolean(application?.onboardingAcceptanceMap?.["2"]);
  const waitingForMatricUpload = hasDoc2Acceptance && String(documentsStatus["2"] || "") === "pending_upload";
  const waitingForIdUpload =
    ["1", "2", "3", "4", "5"].every((step) => String(documentsStatus[step] || "") === "approved") &&
    String(documentsStatus["6"] || "") === "pending_upload";
  return (waitingForMatricUpload || waitingForIdUpload) && !hasPendingReview(application);
}

function isWaitingOnTutorAction(application: any) {
  if (areAllDocumentsApproved(application)) return false;
  if (hasPendingReview(application)) return false;
  if (hasMissingCompletedTemplate(application)) return false;
  return true;
}

export default function ExecutiveHRTraffic() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [assignTutorOpen, setAssignTutorOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [selectedApplication, setSelectedApplication] = useState<TutorApplication | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [tutorAppSubTab, setTutorAppSubTab] = useState("pending");
  const [parentSubTab, setParentSubTab] = useState("awaiting");
  const [unassigningEnrollmentId, setUnassigningEnrollmentId] = useState<string | null>(null);
  // Fetch tutor verification docs (from /api/coo/applications)
  const { data: tutorVerificationData = [], refetch: refetchVerificationData } = useQuery<{ user: any; verificationDoc: any }[]>({
    queryKey: ["/api/coo/applications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000,
  });

  const normalizeStatus = (value: unknown) => String(value || "").toLowerCase().trim();
  const hasAnyDocUrl = (doc: any) =>
    !!(
      doc?.file_url_agreement ||
      doc?.file_url_consent ||
      doc?.fileUrlAgreement ||
      doc?.fileUrlConsent
    );

  const legacyPendingVerificationTutors = tutorVerificationData.filter(
    (t) => {
      const status = normalizeStatus(t?.verificationDoc?.status);
      return !!t.verificationDoc && status === "pending";
    }
  );
  const legacyVerifiedDocTutors = tutorVerificationData.filter(
    (t) => {
      const status = normalizeStatus(t?.verificationDoc?.status);
      const isVerified = status === "verified" || t?.user?.isVerified === true;
      return isVerified && hasAnyDocUrl(t?.verificationDoc);
    }
  );

  // Fetch traffic stats
  const { data: stats, isLoading: statsLoading } = useQuery<TrafficStats>({
    queryKey: ["/api/hr/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // Fetch all parent enrollments - refetch every 5 seconds
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery<ParentEnrollment[]>({
    queryKey: ["/api/hr/enrollments"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Fetch specialist applications
  const { data: applications = [], isLoading: applicationsLoading } = useQuery<TutorApplication[]>({
    queryKey: ["/api/coo/tutor-applications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
  });

  // Filter enrollments by status (normalize strings to avoid casing/whitespace issues)
  const normalize = (s: any) => (s ? String(s).toLowerCase().trim() : "");
  const awaitingAssignment = enrollments.filter((e: ParentEnrollment) => normalize(e.status) === "awaiting_assignment");
  // Treat 'session_booked' as assigned for HR display so booked sessions are visible under Assigned
  const assigned = enrollments.filter((e: ParentEnrollment) => {
    const s = normalize(e.status);
    return s === "assigned" || s === "session_booked" || s === "awaiting_tutor_acceptance" || s === "proposal_sent";
  });
  const activeInPods = enrollments.filter((e: ParentEnrollment) => !!e.active_in_pod);
  const confirmed = enrollments.filter((e: ParentEnrollment) => normalize(e.status) === "confirmed");

  // Filter specialist applications by status
  const pendingApplications = applications.filter((app: any) => app.status === "pending");
  const approvedApplications = applications.filter((app: any) => app.status === "approved");
  const rejectedApplications = applications.filter((app: any) => app.status === "rejected");

  const verificationPendingUploadApplications = approvedApplications.filter((app: any) =>
    isWaitingOnTutorAction(app)
  );
  const verificationUnderReviewApplications = approvedApplications.filter((app: any) => {
    if (areAllDocumentsApproved(app)) return false;
    return hasPendingReview(app);
  });
  const verificationAwaitingTTApplications = approvedApplications.filter((app: any) => {
    if (hasPendingReview(app)) return false;
    return hasMissingCompletedTemplate(app);
  });
  const verificationVerifiedApplications = approvedApplications.filter((app: any) => {
    if (!areAllDocumentsApproved(app)) return false;
    return !hasMissingCompletedTemplate(app);
  });
  const verificationWaitingOnTutorApplications = [
    ...verificationPendingUploadApplications,
    ...verificationAwaitingTTApplications,
  ];
  const verificationTotalApplications =
    verificationPendingUploadApplications.length +
    verificationUnderReviewApplications.length +
    verificationAwaitingTTApplications.length +
    verificationVerifiedApplications.length;
  const tutorTrafficActionCount =
    pendingApplications.length +
    verificationUnderReviewApplications.length +
    verificationWaitingOnTutorApplications.length;

  const appPendingVerificationTutors = approvedApplications
    .filter((app: any) => hasPendingReview(app))
    .map((app: any) => {
      const tutorUserId = app.userId || app.user_id || app.id;
      return {
        user: {
          id: tutorUserId,
          fullNames: app.fullNames || app.full_names,
          full_names: app.full_names || app.fullNames,
          username: app.fullNames || app.full_names || "Tutor",
          email: app.email,
        },
        verificationDoc: {
          status: "pending",
        // Map current sequential docs to existing card link fields for compatibility.
        file_url_agreement: app.doc1SubmissionUrl || app.doc2SubmissionUrl,
        file_url_consent:
          app.doc3SubmissionUrl ||
          app.doc4SubmissionUrl ||
          app.doc5SubmissionUrl ||
          app.doc6SubmissionUrl,
      },
      };
    });

  const appVerifiedDocTutors = approvedApplications
    .filter((app: any) => areAllDocumentsApproved(app))
    .map((app: any) => {
      const tutorUserId = app.userId || app.user_id || app.id;
      return {
        user: {
          id: tutorUserId,
          fullNames: app.fullNames || app.full_names,
          full_names: app.full_names || app.fullNames,
          username: app.fullNames || app.full_names || "Tutor",
          email: app.email,
        },
        verificationDoc: {
        status: "verified",
        file_url_agreement: app.doc1SubmissionUrl || app.doc2SubmissionUrl,
        file_url_consent:
          app.doc3SubmissionUrl ||
          app.doc4SubmissionUrl ||
          app.doc5SubmissionUrl ||
          app.doc6SubmissionUrl,
        updated_at: app.updatedAt || app.updated_at,
      },
      };
    });

  const pendingVerificationTutors = appPendingVerificationTutors.length > 0
    ? appPendingVerificationTutors
    : legacyPendingVerificationTutors;

  const verifiedDocTutors = appVerifiedDocTutors.length > 0
    ? appVerifiedDocTutors
    : legacyVerifiedDocTutors;

  const approveApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      await apiRequest("POST", `/api/coo/tutor-applications/${applicationId}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: "Application approved",
        description: "The specialist application has been approved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/stats"] });
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error?.message || "Failed to approve application.",
        variant: "destructive",
      });
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      await apiRequest("POST", `/api/coo/tutor-applications/${applicationId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "Application rejected",
        description: "The specialist application has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/stats"] });
      setSelectedApplication(null);
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error?.message || "Failed to reject application.",
        variant: "destructive",
      });
    },
  });

  const handleApproveApplication = (application: TutorApplication) => {
    approveApplicationMutation.mutate(application.id);
  };

  const handleRejectApplication = () => {
    if (!selectedApplication || !rejectionReason.trim()) return;
    rejectApplicationMutation.mutate({
      applicationId: selectedApplication.id,
      reason: rejectionReason.trim(),
    });
  };

  const handleOpenAssignModal = (enrollmentId: string) => {
    setSelectedEnrollmentId(enrollmentId);
    setAssignTutorOpen(true);
  };

  const handleTutorAssigned = () => {
    // Refetch enrollments after assignment
    queryClient.invalidateQueries({ queryKey: ["/api/hr/enrollments"] });
  };

  const unassignTutorMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await apiRequest("POST", `/api/hr/enrollments/${enrollmentId}/unassign-tutor`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/stats"] });
      toast({
        title: "Tutor unassigned",
        description: "Student record was preserved and removed from tutor pod view.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unassign tutor",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUnassigningEnrollmentId(null);
    },
  });

  const handleUnassignTutor = (enrollment: ParentEnrollment) => {
    if (!enrollment.assigned_tutor_id) return;
    const confirmed = window.confirm(
      `Unassign ${enrollment.student_full_name} from ${enrollment.assigned_tutor_name || "this tutor"}?\n\nStudent data will be preserved for reassignment.`
    );
    if (!confirmed) return;
    setUnassigningEnrollmentId(enrollment.id);
    unassignTutorMutation.mutate(enrollment.id);
  };

  

  const getStatusBadge = (status: ParentEnrollment["status"] | string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      awaiting_assignment: { label: "Awaiting Assignment", color: "bg-yellow-100 text-yellow-800" },
      awaiting_tutor_acceptance: { label: "Awaiting Tutor Acceptance", color: "bg-indigo-100 text-indigo-800" },
      assigned: { label: "Assigned", color: "bg-blue-100 text-blue-800" },
      proposal_sent: { label: "Proposal Sent", color: "bg-cyan-100 text-cyan-800" },
      session_booked: { label: "Session Booked", color: "bg-purple-100 text-purple-800" },
      report_received: { label: "Report Received", color: "bg-orange-100 text-orange-800" },
      confirmed: { label: "Confirmed", color: "bg-green-100 text-green-800" },
      not_enrolled: { label: "Not Enrolled", color: "bg-gray-100 text-gray-800" },
    };
    const config = statusConfig[String(status)] || {
      label: String(status || "Unknown").replace(/_/g, " "),
      color: "bg-gray-100 text-gray-800",
    };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const LegacyEnrollmentCard = ({ enrollment }: { enrollment: ParentEnrollment }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{enrollment.student_full_name}</CardTitle>
            <CardDescription>
              Parent: {enrollment.parent_full_name}
            </CardDescription>
            {enrollment.assigned_tutor_name && (
              <CardDescription>
                Tutor: {enrollment.assigned_tutor_name}
                {enrollment.assigned_pod_name ? ` • Pod: ${enrollment.assigned_pod_name}` : ""}
              </CardDescription>
            )}
          </div>
          {getStatusBadge(enrollment.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{enrollment.parent_email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{enrollment.parent_phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{enrollment.parent_city}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Grade</p>
              <p className="font-medium">{enrollment.student_grade}</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">School</p>
            <p className="font-medium">{enrollment.school_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Reported Topics</p>
            <p className="font-medium">
              {getStructuredEnrollmentTopics(enrollment).join(", ") || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Previous Tutoring</p>
            <p className="font-medium">{enrollment.previous_tutoring || "Not provided"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Internet Access</p>
            <p className="font-medium">{enrollment.internet_access || "Not provided"}</p>
          </div>
          {enrollment.parent_motivation && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Parent Motivation</p>
              <p className="font-medium">{enrollment.parent_motivation}</p>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Submitted</p>
            <p className="text-xs">{format(new Date(enrollment.created_at), "PPp")}</p>
          </div>
        </div>

        {enrollment.status === "awaiting_assignment" && (
          <Button 
            className="w-full mt-4"
            onClick={() => handleOpenAssignModal(enrollment.id)}
          >
            Assign Tutor
          </Button>
        )}

        {enrollment.assigned_tutor_id && (
          <Button
            className="w-full mt-2"
            variant="destructive"
            onClick={() => handleUnassignTutor(enrollment)}
            disabled={unassigningEnrollmentId === enrollment.id}
          >
            {unassigningEnrollmentId === enrollment.id ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Unassigning...
              </>
            ) : (
              "Unassign Tutor"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  void LegacyEnrollmentCard;

  const EnrollmentReviewCard = ({ enrollment }: { enrollment: ParentEnrollment }) => {
    const topics = getStructuredEnrollmentTopics(enrollment);
    const legacyNoteSymptoms = extractLegacySymptomsFromParentNote(enrollment.parent_motivation);
    const fallbackSymptoms =
      enrollment.parentInfo?.response_symptoms && enrollment.parentInfo.response_symptoms.length > 0
        ? enrollment.parentInfo.response_symptoms
        : legacyNoteSymptoms;
    const topicSymptoms = enrollment.parentInfo?.topic_response_symptoms || {};
    const topicRecommendations = enrollment.parentInfo?.topic_recommended_starting_phases || {};
    const derivedTopicSymptoms =
      topics.length === 1 && fallbackSymptoms.length > 0 && !topicSymptoms[topics[0]]
        ? { ...topicSymptoms, [topics[0]]: fallbackSymptoms }
        : topicSymptoms;

    return (
      <Card className="overflow-hidden border-[#e8dcc2] bg-gradient-to-br from-[#fffaf0] via-white to-[#fff7e8] shadow-sm">
        <CardHeader className="border-b border-[#eadfca] bg-[#fff8ea]/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  {enrollment.student_full_name}
                </CardTitle>
                <CardDescription className="mt-1 text-base text-slate-600">
                  Parent: {enrollment.parent_full_name}
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[#e7d7b3] bg-white/80 text-slate-700">
                  <BookOpen className="mr-1 h-3.5 w-3.5" />
                  {enrollment.student_grade || "Grade not provided"}
                </Badge>
                {enrollment.assigned_tutor_name ? (
                  <Badge variant="outline" className="border-[#d7e7d0] bg-[#f4fbf1] text-[#335c2e]">
                    Tutor: {enrollment.assigned_tutor_name}
                  </Badge>
                ) : null}
                {enrollment.assigned_pod_name ? (
                  <Badge variant="outline" className="border-[#d8e3f4] bg-[#f6f9ff] text-[#274472]">
                    Pod: {enrollment.assigned_pod_name}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(enrollment.status)}
              <Badge variant="outline" className="border-[#eadfca] bg-white/80 text-slate-600">
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                {format(new Date(enrollment.created_at), "PPP")}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                Email
              </div>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">{enrollment.parent_email || "Not provided"}</p>
            </div>
            <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Phone className="h-3.5 w-3.5" />
                Phone
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{enrollment.parent_phone || "Not provided"}</p>
            </div>
            <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{enrollment.parent_city || "Not provided"}</p>
            </div>
            <div className="rounded-xl border border-[#eadfca] bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <School className="h-3.5 w-3.5" />
                School
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{enrollment.school_name || "Not provided"}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
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
                    <p className="mt-2 text-sm font-medium text-slate-900">{enrollment.previous_tutoring || "Not provided"}</p>
                  </div>
                  <div className="rounded-xl border border-dashed border-[#eadfca] bg-[#fffaf2] p-3">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      <Wifi className="h-3.5 w-3.5" />
                      Internet Access
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{enrollment.internet_access || "Not provided"}</p>
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
                                <Badge
                                  key={`${topic}-${symptom}`}
                                  variant="outline"
                                  className="h-auto max-w-full whitespace-normal break-words border-[#ecdcb7] bg-white px-2 py-1 text-left leading-snug text-slate-700"
                                >
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
                        <Badge
                          key={symptom}
                          variant="outline"
                          className="h-auto max-w-full whitespace-normal break-words border-[#ecdcb7] bg-white px-2 py-1 text-left leading-snug text-slate-700"
                        >
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
              <span className="font-medium text-slate-800">Submitted:</span> {format(new Date(enrollment.created_at), "PPp")}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {enrollment.status === "awaiting_assignment" && (
                <Button onClick={() => handleOpenAssignModal(enrollment.id)}>
                  Assign Tutor
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}

              {enrollment.assigned_tutor_id && (
                <Button
                  variant="destructive"
                  onClick={() => handleUnassignTutor(enrollment)}
                  disabled={unassigningEnrollmentId === enrollment.id}
                >
                  {unassigningEnrollmentId === enrollment.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Unassigning...
                    </>
                  ) : (
                    "Unassign Tutor"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Traffic</h1>
        <p className="text-muted-foreground">Manage specialist applications and parent enrollments</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Specialist Applications</p>
          <div className="flex items-center gap-3">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalApplications ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.pendingApplications ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Approved Specialists</p>
          <div className="flex items-center gap-3">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.approvedTutors ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.availableForPods ?? 0}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground mb-2">Student Enrollments</p>
          <div className="flex items-center gap-3">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalEnrollments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold">{statsLoading ? "-" : stats?.studentEnrollments ?? 0}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="tutor-applications" className="w-full">
        
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl border border-primary/15 bg-muted/20 p-1 sm:grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="tutor-applications" className="min-h-[3rem] gap-2 whitespace-normal px-3 py-2 text-left sm:text-center">
            <GraduationCap className="w-4 h-4" />
            <span className="flex-1 leading-tight">Specialist Applications</span>
            {tutorTrafficActionCount > 0 ? (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                {tutorTrafficActionCount > 99 ? "99+" : tutorTrafficActionCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="parent-enrollments" className="min-h-[3rem] gap-2 whitespace-normal px-3 py-2 text-left sm:text-center">
            <Users className="w-4 h-4" />
            <span className="leading-tight">Parent Enrollments</span>
          </TabsTrigger>
          <TabsTrigger value="egp-applications" className="min-h-[3rem] gap-2 whitespace-normal px-3 py-2 text-left sm:text-center">
            <FileCheck className="w-4 h-4" />
            <span className="leading-tight">EGP Applications</span>
          </TabsTrigger>
          <TabsTrigger value="td-applications" className="min-h-[3rem] gap-2 whitespace-normal px-3 py-2 text-left sm:text-center">
            <CheckCircle className="w-4 h-4" />
            <span className="leading-tight">TD Applications</span>
          </TabsTrigger>
        </TabsList>

        {/* Specialist Applications Tab */}
        <TabsContent value="tutor-applications" className="space-y-4">
          {applicationsLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading applications...</p>
            </Card>
          ) : (
            <Tabs value={tutorAppSubTab} onValueChange={setTutorAppSubTab} className="w-full">
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-800">Needs Review</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-950">{verificationUnderReviewApplications.length}</p>
                    <p className="text-xs text-amber-900/80">COO action required right now</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-700">Waiting On Tutor</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{verificationWaitingOnTutorApplications.length}</p>
                    <p className="text-xs text-slate-600">Tutor still needs to upload or finish a step</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-green-800">Complete</p>
                    <p className="mt-1 text-2xl font-semibold text-green-950">{verificationVerifiedApplications.length}</p>
                    <p className="text-xs text-green-900/80">Ready for the next operational stage</p>
                  </CardContent>
                </Card>
              </div>

              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
                <TabsTrigger value="pending" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Pending</span>
                  </span>
                  {pendingApplications.length > 0 ? (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {pendingApplications.length > 99 ? "99+" : pendingApplications.length}
                    </Badge>
                  ) : (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="rejected" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <XCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Rejected</span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{rejectedApplications.length}</span>
                </TabsTrigger>
                <TabsTrigger value="review-queue" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Needs Review</span>
                  </span>
                  {verificationUnderReviewApplications.length > 0 ? (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                      {verificationUnderReviewApplications.length > 99 ? "99+" : verificationUnderReviewApplications.length}
                    </Badge>
                  ) : (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="waiting-on-tutor" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Waiting On Tutor</span>
                  </span>
                  {verificationWaitingOnTutorApplications.length > 0 ? (
                    <Badge className="h-5 min-w-5 bg-amber-100 px-1.5 text-[10px] text-amber-900 border border-amber-200">
                      {verificationWaitingOnTutorApplications.length > 99 ? "99+" : verificationWaitingOnTutorApplications.length}
                    </Badge>
                  ) : (
                    <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="complete" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2 col-span-2 sm:col-span-1">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Complete</span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{verificationVerifiedApplications.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-4">
                {pendingApplications.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending applications</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {pendingApplications.map((application: any) => (
                      <TutorApplicationCard
                        key={application.id}
                        application={application}
                        onViewDetails={() => setSelectedApplication(application)}
                        onApprove={() => handleApproveApplication(application)}
                        onReject={() => {
                          setSelectedApplication(application);
                          setShowRejectDialog(true);
                        }}
                        showActions
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-4">
                {rejectedApplications.length === 0 ? (
                  <Card className="p-12 text-center">
                    <XCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No rejected applications</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {rejectedApplications.map((application: any) => (
                      <TutorApplicationCard
                        key={application.id}
                        application={application}
                        onViewDetails={() => setSelectedApplication(application)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

                <TabsContent value="review-queue" className="space-y-4 mt-4">
                  {verificationUnderReviewApplications.length === 0 ? (
                    <Card className="p-12 text-center">
                      <FileCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No tutor uploads currently need COO review.</p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {verificationUnderReviewApplications.map((application: any) => (
                        <TutorDocumentReview
                          key={application.id}
                          application={application}
                          onReview={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
                            refetchVerificationData();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="waiting-on-tutor" className="space-y-4 mt-4">
                  {verificationWaitingOnTutorApplications.length === 0 ? (
                    <Card className="p-12 text-center">
                      <FileCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No tutors are currently waiting on tutor-side onboarding action.</p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {verificationWaitingOnTutorApplications.map((application: any) => (
                        <TutorDocumentReview
                          key={application.id}
                          application={application}
                          onReview={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
                            refetchVerificationData();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="complete" className="space-y-4 mt-4">
                  {verificationVerifiedApplications.length === 0 ? (
                    <Card className="p-12 text-center">
                      <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No completed onboarding records yet.</p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {verificationVerifiedApplications.map((application: any) => (
                        <TutorDocumentReview
                          key={application.id}
                          application={application}
                          onReview={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
                            refetchVerificationData();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="egp-applications" className="space-y-6">
          <COOAffiliateApplicationsPanel />
        </TabsContent>

        <TabsContent value="td-applications" className="space-y-6">
          <COOTdApplicationsPanel />
        </TabsContent>

        {/* Parent Enrollments Tab */}
        <TabsContent value="parent-enrollments" className="space-y-6">
          {enrollmentsLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading enrollments...</p>
            </Card>
          ) : (
            <Tabs value={parentSubTab} onValueChange={setParentSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:flex sm:flex-nowrap h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
                <TabsTrigger value="awaiting" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span>Awaiting</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{awaitingAssignment.length}</span>
                </TabsTrigger>
                <TabsTrigger value="assigned" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span>Assigned</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{assigned.length}</span>
                </TabsTrigger>
                <TabsTrigger value="active-pods" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span>Active Pods</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{activeInPods.length}</span>
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
                  <span>Confirmed</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{confirmed.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="awaiting" className="space-y-4 mt-4">
                {awaitingAssignment.length === 0 ? (
                  <Card className="p-10 text-center">
                    <p className="text-muted-foreground">
                      {enrollments.length === 0 ? "No enrollments yet." : "No parents awaiting assignment."}
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {awaitingAssignment.map((enrollment: ParentEnrollment) => (
                      <EnrollmentReviewCard key={enrollment.id} enrollment={enrollment} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assigned" className="space-y-4 mt-4">
                {assigned.length === 0 ? (
                  <Card className="p-10 text-center">
                    <p className="text-muted-foreground">No assigned enrollments.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {assigned.map((enrollment: ParentEnrollment) => (
                      <EnrollmentReviewCard key={enrollment.id} enrollment={enrollment} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="active-pods" className="space-y-4 mt-4">
                {activeInPods.length === 0 ? (
                  <Card className="p-10 text-center">
                    <p className="text-muted-foreground">No parents currently active in pods.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {activeInPods.map((enrollment: ParentEnrollment) => (
                      <EnrollmentReviewCard key={enrollment.id} enrollment={enrollment} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="confirmed" className="space-y-4 mt-4">
                {confirmed.length === 0 ? (
                  <Card className="p-10 text-center">
                    <p className="text-muted-foreground">No confirmed enrollments.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {confirmed.map((enrollment: ParentEnrollment) => (
                      <EnrollmentReviewCard key={enrollment.id} enrollment={enrollment} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      {/* Specialist Application Details Dialog */}
      {selectedApplication && !showRejectDialog && (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{(selectedApplication as any).fullName || (selectedApplication as any).full_name || (selectedApplication as any).full_names || (selectedApplication as any).fullNames}</DialogTitle>
              <DialogDescription>
                Submitted on {format(new Date((selectedApplication as any).created_at || (selectedApplication as any).createdAt), "PPP")}
              </DialogDescription>
            </DialogHeader>
            <ApplicationDetails application={selectedApplication} />
            {selectedApplication.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={approveApplicationMutation.isPending || rejectApplicationMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApproveApplication(selectedApplication)}
                  disabled={approveApplicationMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {approveApplicationMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this application.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coo-traffic-rejection-reason">Rejection Reason</Label>
              <Textarea
                id="coo-traffic-rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectApplication}
              disabled={!rejectionReason.trim() || rejectApplicationMutation.isPending}
            >
              {rejectApplicationMutation.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTutorModal
        open={assignTutorOpen}
        onOpenChange={setAssignTutorOpen}
        enrollmentId={selectedEnrollmentId}
        onAssigned={handleTutorAssigned}
      />
    </div>
  );
}

// Specialist Application Card Component
function TutorApplicationCard({
  application,
  onViewDetails,
  onApprove,
  onReject,
  showActions = false,
}: {
  application: any;
  onViewDetails: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}) {
  const fullNames = application.fullName || application.full_name || application.full_names || application.fullNames;
  const email = application.email;
  const phoneNumber = application.phone || application.phone_number || application.phoneNumber;
  const age = application.age;
  const city = application.city;
  const currentStatus = application.currentSituation || application.current_situation || application.currentStatus || application.current_status || "N/A";
  const gradesEquipped = application.grades_equipped || application.gradesEquipped || [];
  const status = application.status;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{fullNames}</CardTitle>
            <CardDescription>{email} • {phoneNumber}</CardDescription>
          </div>
          <Badge className={statusColors[status]}>{status.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Age</p>
            <p className="font-medium">{age}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Location</p>
            <p className="font-medium">{city}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{currentStatus.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Grades</p>
            <p className="font-medium">{gradesEquipped.join(", ") || "N/A"}</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={onViewDetails}>
          <User className="w-4 h-4" />
          View Full Application
        </Button>
        {showActions && onApprove && onReject && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-2" onClick={onReject}>
              <XCircle className="w-4 h-4" />
              Reject
            </Button>
            <Button className="gap-2" onClick={onApprove}>
              <CheckCircle className="w-4 h-4" />
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Application Details Component
function ApplicationDetails({ application }: { application: TutorApplication }) {
  const app = application as any;
  const getField = (newCamel: string, newSnake: string, oldCamel?: string, oldSnake?: string) =>
    app[newCamel] ?? (oldCamel ? app[oldCamel] : undefined) ?? app[newSnake] ?? (oldSnake ? app[oldSnake] : undefined);

  return (
    <div className="space-y-6">
      <Section title="Section 1 - Basic Information">
        <InfoItem label="Full Name" value={getField("fullName", "full_name", "fullNames", "full_names")} />
        <InfoItem label="Age" value={String(app.age ?? "")} />
        <InfoItem label="Email" value={app.email} />
        <InfoItem label="Phone" value={getField("phone", "phone", "phoneNumber", "phone_number")} />
        <InfoItem label="City" value={app.city} />
      </Section>

      <Section title="Section 2 - Academic Background">
        <InfoItem label="Completed Matric" value={getField("completedMatric", "completed_matric")} />
        <InfoItem label="Matric Year" value={getField("matricYear", "matric_year")} />
        <InfoItem label="Math Level" value={getField("mathLevel", "math_level")} />
        <InfoItem label="Math Result" value={getField("mathResult", "math_result")} />
        <InfoItem label="Other Subjects" value={getField("otherSubjects", "other_subjects")} />
      </Section>

      <Section title="Section 3 - Current Situation">
        <InfoItem label="Current Situation" value={(getField("currentSituation", "current_situation", "currentStatus", "current_status") || "").replace(/_/g, " ")} />
        <InfoItem label="Other (if applicable)" value={getField("currentSituationOther", "current_situation_other")} />
        <InfoItem label="Why interested?" value={getField("interestReason", "interest_reason")} />
      </Section>

      <Section title="Section 4 - Teaching & Communication">
        <InfoItem label="Helped someone before?" value={getField("helpedBefore", "helped_before")} />
        <InfoItem label="Explanation" value={getField("helpExplanation", "help_explanation")} />
        <InfoItem label="Student says 'I don't get this'" value={getField("studentDontGet", "student_dont_get")} />
      </Section>

      <Section title="Section 5 - Response Under Pressure">
        <InfoItem label="Pressure Story" value={getField("pressureStory", "pressure_story")} />
        <InfoItem label="Pressure Response" value={(getField("pressureResponse", "pressure_response") || []).join(", ")} />
        <InfoItem label="Panic Cause" value={getField("panicCause", "panic_cause")} />
      </Section>

      <Section title="Section 6 - Discipline & Responsibility">
        <InfoItem label="Discipline Reason" value={getField("disciplineReason", "discipline_reason")} />
        <InfoItem label="Repeat Mistake Response" value={getField("repeatMistakeResponse", "repeat_mistake_response")} />
      </Section>

      <Section title="Section 7 - Alignment With Response Integrity">
        <InfoItem label="Response Integrity Meaning" value={getField("ttMeaning", "tt_meaning")} />
        <InfoItem label="Structure Preference" value={getField("structurePreference", "structure_preference")} />
      </Section>

      <Section title="Section 8 - Availability">
        <InfoItem label="Hours Per Week" value={getField("hoursPerWeek", "hours_per_week")} />
        <InfoItem label="Available Afternoons?" value={getField("availableAfternoon", "available_afternoon", "bootcampAvailable", "bootcamp_available")} />
      </Section>

      <Section title="Section 9 - Final Filter">
        <InfoItem label="Why should you be considered?" value={getField("finalReason", "final_reason")} />
      </Section>

      <Section title="Section 10 - Commitment">
        <InfoItem label="Committed to training & protocols?" value={getField("commitment", "commitment", "commitToTrial", "commit_to_trial") === true ? "yes" : getField("commitment", "commitment", "commitToTrial", "commit_to_trial")} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg border-b pb-2">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground text-sm">{label}:</span>
      <span className="col-span-2 text-sm">{value || "Not provided"}</span>
    </div>
  );
}

