import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, ArrowLeft, Check, Plus, X } from "lucide-react";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import ProposalView from "@/components/parent/ProposalView";
import { PushOptInCard } from "@/components/push/PushOptInCard";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/lib/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns/format";
import { supabase } from "@/lib/supabaseClient";
import {
  RESPONSE_SYMPTOM_GROUPS,
} from "@shared/responseSymptomMapping";

interface EnrollmentStatus {
  status: "not_enrolled" | "awaiting_assignment" | "awaiting_tutor_acceptance" | "assigned" | "proposal_sent" | "session_booked" | "report_received" | "confirmed";
  step?: string;
  plan?: string;
  onboardingType?: "pilot" | "commercial";
  freeSessionsRemaining?: number;
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "FREE_ACCESS";
  paymentDate?: string | null;
}

interface IntroSessionConfirmation {
  status?: string;
  operationalMode?: "training" | "certified_live";
  scheduled_time?: string;
  id?: string;
  introCompleted?: boolean;
  type?: "intro" | "handover";
  sessionLabel?: string;
}

interface ParentFormData {
  parentFullName: string;
  parentPhone: string;
  parentEmail: string;
  parentCity: string;
  studentFullName: string;
  studentGrade: string;
  studentGender: string;
  schoolName: string;
  stuckAreas: string[];
  reportedTopics: string[];
  topicResponseSymptoms: Record<string, string[]>;
  previousTutoring: string;
  internetAccess: string;
  parentMotivation: string;
  processAlignment: string;
  agreedToTerms: boolean;
}

const NON_TOPIC_CONTEXT_LABELS = new Set([
  "word problems",
  "tests",
  "timed work",
  "new topics",
  "careless errors",
]);

function normalizeMathTopic(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseMathTopicEntries(value: string) {
  return value
    .split(/[\n,;|]+/)
    .map(normalizeMathTopic)
    .filter(Boolean)
    .filter((topic) => !NON_TOPIC_CONTEXT_LABELS.has(topic.toLowerCase()));
}

function getGroupOptionIds(groupId: string) {
  return RESPONSE_SYMPTOM_GROUPS.find((group) => group.id === groupId)?.options.map((option) => option.id) || [];
}

function getGroupFallbackOptionIds(groupId: string) {
  return [`${groupId}_none_of_above`, `${groupId}_not_sure`];
}

function submitExternalPaymentForm(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

const PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY = "parent-gateway:payfast-merchant-reference";

export default function ParentGateway() {
  const [justBooked, setJustBooked] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<"enrollment" | "submitted" | "loading" | "awaiting_tutor_acceptance">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingProposal, setIsProcessingProposal] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [parentCode, setParentCode] = useState<string | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState<Date | undefined>(undefined);
  const [proposedTime, setProposedTime] = useState<string>("");
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [bookedIntroSessionOverride, setBookedIntroSessionOverride] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [hideStudentCodeCard, setHideStudentCodeCard] = useState(false);
  const [mathTopicDraft, setMathTopicDraft] = useState("");
  const handledPayfastReturnRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payfastState = params.get("payfast");
    const payfastMerchantReferenceFromUrl = params.get("merchantReference");
    if (!payfastState) return;
    if (handledPayfastReturnRef.current) return;
    if (authLoading) return;
    if (!user) return;

    let cancelled = false;

    const handlePayfastReturn = async () => {
      handledPayfastReturnRef.current = true;

      if (payfastState === "return") {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: HeadersInit = {
            "Content-Type": "application/json",
          };

          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          const response = await fetch(`${API_URL}/api/parent/payments/payfast/sandbox-confirm`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              merchantReference:
                payfastMerchantReferenceFromUrl ||
                window.sessionStorage.getItem(PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY),
            }),
          });

          if (!cancelled && response.ok) {
            const data = await response.json().catch(() => ({}));
            toast({
              title: "Sandbox Payment Confirmed",
              description: "Sandbox payment was confirmed and Premium access is now active.",
            });
            if (data?.parentCode) {
              setParentCode(data.parentCode);
            }
            window.sessionStorage.removeItem(PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/parent/proposal"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/parent/intro-session-confirmation"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] }),
            ]);
          } else if (!cancelled) {
            toast({
              title: "Payment Submitted",
              description: "We are waiting for PayFast to confirm the Premium payment.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });
          }
        } catch {
          if (!cancelled) {
            toast({
              title: "Payment Submitted",
              description: "We are waiting for PayFast to confirm the Premium payment.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });
          }
        }
      }

      if (payfastState === "cancelled" && !cancelled) {
        toast({
          title: "Payment Cancelled",
          description: "Premium payment was cancelled. Sessions stay locked until payment is completed.",
          variant: "destructive",
        });
      }

      window.history.replaceState({}, "", window.location.pathname);
    };

    handlePayfastReturn();

    return () => {
      cancelled = true;
    };
  }, [authLoading, queryClient, toast, user]);

  // Fetch enrollment status
  const { data: enrollmentStatus } = useQuery<EnrollmentStatus>({
    queryKey: ["/api/parent/enrollment-status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && !authLoading,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  // Fetch assigned tutor if status is assigned
  const { data: assignedTutor } = useQuery<any>({
    queryKey: ["/api/parent/assigned-tutor"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled:
      !!user &&
      !authLoading &&
      (
        enrollmentStatus?.status === "assigned" ||
        enrollmentStatus?.status === "proposal_sent" ||
        String(enrollmentStatus?.step || "").startsWith("handover_")
      ),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
  });

  const { data: trainingSessionsData } = useQuery<{ monthlyQuota?: { sessions_remaining?: number; session_quota?: number } | null }>({queryKey: ["/api/parent/training-sessions"], queryFn: getQueryFn({ on401: "returnNull" }), enabled: !!user && !authLoading && (enrollmentStatus?.status === "session_booked" || enrollmentStatus?.status === "report_received" || enrollmentStatus?.status === "confirmed"), refetchInterval: 15000 });
  const quotaRemaining = Number(trainingSessionsData?.monthlyQuota?.sessions_remaining ?? -1);
  const quotaExhausted = trainingSessionsData?.monthlyQuota != null && quotaRemaining <= 0;

  // Fetch intro session confirmation if status is assigned, awaiting assignment, or awaiting tutor acceptance
  const {
    data: introSessionConfirmation,
    refetch: refetchIntroSessionConfirmation,
  } = useQuery<IntroSessionConfirmation>({
    queryKey: ["/api/parent/intro-session-confirmation"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled:
      !!user &&
      !authLoading &&
      (
        enrollmentStatus?.status === "proposal_sent" ||
        enrollmentStatus?.status === "session_booked" ||
        enrollmentStatus?.status === "report_received" ||
        enrollmentStatus?.status === "confirmed" ||
        enrollmentStatus?.status === "assigned" ||
        enrollmentStatus?.status === "awaiting_assignment" ||
        enrollmentStatus?.status === "awaiting_tutor_acceptance"
      ),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5000, // Poll every 5s for status updates
  });

  // Fetch proposal if available
  const { data: proposal, isLoading: proposalLoading, error: proposalError } = useQuery<any>({
    queryKey: ["/api/parent/proposal"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/proposal`, {
        credentials: "include",
        headers,
      });
      if (response.status === 404) {
        console.log("ðŸ“‹ No proposal found (404)");
        return null;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch proposal:", response.status, errorData);
        throw new Error(errorData.message || "Failed to fetch proposal");
      }
      const data = await response.json();
      console.log("ðŸ“‹ Proposal received:", data);
      if (data.parentCode) {
        setParentCode(data.parentCode);
      }
      return data;
    },
    enabled: !!user && !authLoading && !!enrollmentStatus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
    retry: false, // Don't retry on 404
  });

  // Derive effective parent code from local state or proposal data
  const effectiveParentCode = useMemo(() => {
    return parentCode || proposal?.parentCode || null;
  }, [parentCode, proposal?.parentCode]);

  const isReassignmentAwaitingAssignment =
    enrollmentStatus?.status === "awaiting_assignment" &&
    String(enrollmentStatus?.step || "").startsWith("reassignment_resume:");

  const studentCodeDismissKey = useMemo(() => {
    if (!user?.id) return null;
    return `parent-gateway-hide-student-code:${user.id}`;
  }, [user?.id]);

  useEffect(() => {
    if (!studentCodeDismissKey) {
      setHideStudentCodeCard(false);
      return;
    }

    try {
      setHideStudentCodeCard(window.localStorage.getItem(studentCodeDismissKey) === "true");
    } catch {
      setHideStudentCodeCard(false);
    }
  }, [studentCodeDismissKey]);

  useEffect(() => {
    if (!studentCodeDismissKey) return;

    try {
      if (hideStudentCodeCard) {
        window.localStorage.setItem(studentCodeDismissKey, "true");
      } else {
        window.localStorage.removeItem(studentCodeDismissKey);
      }
    } catch {
      // Ignore localStorage failures and keep the session usable.
    }
  }, [hideStudentCodeCard, studentCodeDismissKey]);

  const effectiveIntroSessionConfirmation = useMemo(() => {
    if (
      bookedIntroSessionOverride &&
      (!introSessionConfirmation || introSessionConfirmation.status === "not_scheduled")
    ) {
      return bookedIntroSessionOverride;
    }

    return introSessionConfirmation || bookedIntroSessionOverride;
  }, [bookedIntroSessionOverride, introSessionConfirmation]);
  const isHandoverFlow =
    String(enrollmentStatus?.step || "").startsWith("handover_") ||
    effectiveIntroSessionConfirmation?.type === "handover";
  const sessionLabel = isHandoverFlow ? "continuity check" : "intro session";
  const sessionTitle = isHandoverFlow ? "Continuity Check" : "Introductory Session";
  const sessionCompletedLabel = isHandoverFlow ? "continuity check" : "introductory session";
  const isTrainingMode = effectiveIntroSessionConfirmation?.operationalMode === "training";
  const showProposalActions = enrollmentStatus?.status === "proposal_sent";
  const showProposalPanel =
    enrollmentStatus?.status === "proposal_sent" ||
    enrollmentStatus?.status === "session_booked" ||
    enrollmentStatus?.status === "report_received" ||
    enrollmentStatus?.status === "confirmed";

  // Handlers defined below are used by the proposal panel rendered later in the component.
  const handleAcceptProposal = async () => {
    setIsProcessingProposal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/proposal/accept`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to start Premium payment");
      }

      if (data?.paymentStatus === "PAID" || data?.paymentStatus === "FREE_ACCESS") {
        if (data.parentCode) {
          setParentCode(data.parentCode);
        }

        toast({
          title: data?.paymentStatus === "FREE_ACCESS" ? "Pilot Access Active" : "Payment Confirmed",
          description:
            data?.paymentStatus === "FREE_ACCESS"
              ? "Pilot onboarding is active and sessions are unlocked."
              : "Premium payment is already confirmed and sessions are unlocked.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });
        return;
      }

      if (!data?.checkoutUrl || !data?.formFields) {
        throw new Error("PayFast checkout details were not returned.");
      }

      if (data?.merchantReference) {
        window.sessionStorage.setItem(PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY, String(data.merchantReference));
      }

      toast({
        title: "Redirecting to PayFast",
        description: "Complete the R1000 Premium payment to unlock sessions.",
      });

      submitExternalPaymentForm(data.checkoutUrl, data.formFields);
    } catch (error) {
      console.error("Error accepting proposal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start Premium payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingProposal(false);
    }
  };

  const handleRenewSubscription = async () => {
    setIsRenewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/payments/renew`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to start renewal payment");
      }
      if (data?.alreadyPaid || data?.paymentStatus === "PAID") {
        toast({
          title: "Renewal already completed",
          description: "This month's renewal is already paid. Refreshing quota and booking state.",
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/proposal"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/intro-session-confirmation"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] }),
        ]);
        return;
      }
      if (!data?.checkoutUrl || !data?.formFields) {
        throw new Error("PayFast checkout details were not returned.");
      }
      if (data?.merchantReference) {
        window.sessionStorage.setItem(PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY, String(data.merchantReference));
      }
      toast({
        title: "Redirecting to PayFast",
        description: "Complete the R1000 monthly renewal payment to unlock this month's sessions.",
      });
      submitExternalPaymentForm(data.checkoutUrl, data.formFields);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start renewal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRenewing(false);
    }
  };

  const handleDeclineProposal = async () => {
    setIsProcessingProposal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/proposal/decline`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          reason: "Parent declined proposal",
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Failed to decline proposal" }));
        throw new Error(err.message || "Failed to decline proposal");
      }

      toast({
        title: "Proposal Declined",
        description: "We'll look for another tutor match.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });
    } catch (error) {
      console.error("Error declining proposal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to decline proposal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingProposal(false);
    }
  };

  const proposalPanel = (() => {
    if (!showProposalPanel) return null;

    if (proposalLoading) {
      return (
        <div className="bg-muted/30 rounded-lg p-4 text-center mb-4 sm:mb-6">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {showProposalActions ? "Loading your proposal..." : "Loading your diagnosis and training plan..."}
          </p>
        </div>
      );
    }

    if (proposalError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center mb-4 sm:mb-6">
          <p className="text-sm text-red-600">Failed to load proposal. Please refresh the page.</p>
          <p className="text-xs text-red-500 mt-2">{proposalError.message}</p>
        </div>
      );
    }

    if (proposal) {
      return (
        <div className="mb-4 sm:mb-6">
          {!showProposalActions && (
            <p className="text-sm text-muted-foreground mb-4">
              Your diagnosis and training plan remain available below.
            </p>
          )}
          <ProposalView
            proposal={proposal}
            forceDiagnosisView={true}
            showActions={showProposalActions}
            onAccept={showProposalActions ? handleAcceptProposal : undefined}
            onDecline={showProposalActions ? handleDeclineProposal : undefined}
            isProcessing={isProcessingProposal}
          />
        </div>
      );
    }

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center mb-4 sm:mb-6">
        <p className="text-sm text-yellow-600">
          {showProposalActions
            ? "Proposal is being prepared. Check back soon."
            : "Diagnosis details are not available yet. Please refresh the page shortly."}
        </p>
      </div>
    );
  })();

  // Auto-set step based on enrollment status and intro session confirmation
  useEffect(() => {
    if (!enrollmentStatus) {
      setStep("loading");
    } else if (enrollmentStatus.status === "not_enrolled") {
      setStep("enrollment");
    } else if (
      enrollmentStatus.status === "awaiting_assignment" ||
      enrollmentStatus.status === "assigned" ||
      enrollmentStatus.status === "proposal_sent" ||
      enrollmentStatus.status === "session_booked" ||
      enrollmentStatus.status === "report_received" ||
      enrollmentStatus.status === "confirmed"
    ) {
      setStep("submitted");
    } else if (enrollmentStatus.status === "awaiting_tutor_acceptance") {
      setStep("awaiting_tutor_acceptance");
    }
  }, [enrollmentStatus, navigate]);

  // Initialize form with user data
  const [formData, setFormData] = useState<ParentFormData>({
    parentFullName: "",
    parentPhone: "",
    parentEmail: "",
    parentCity: "",
    studentFullName: "",
    studentGrade: "",
    studentGender: "",
    schoolName: "",
    stuckAreas: [],
    reportedTopics: [],
    topicResponseSymptoms: {},
    previousTutoring: "",
    internetAccess: "",
    parentMotivation: "",
    processAlignment: "",
    agreedToTerms: false,
  });
  const selectedMathTopics = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          (Array.isArray(formData.reportedTopics) ? formData.reportedTopics : [])
            .map((topic) => String(topic || "").trim())
            .filter(Boolean)
        )
      ),
    [formData.reportedTopics]
  );

  // Auto-fill parent name and email from user data
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        parentEmail: user.email || prev.parentEmail,
        parentFullName: user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : prev.parentFullName),
      }));
    }
  }, [user]);

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateTopicResponseSymptoms = (topic: string, nextSymptoms: string[]) => {
    setFormData((prev) => ({
      ...prev,
      topicResponseSymptoms: {
        ...prev.topicResponseSymptoms,
        [topic]: nextSymptoms,
      },
    }));
  };

  const syncMathTopicEntries = (entries: string[]) => {
    handleInputChange("reportedTopics", entries);
  };

  const addMathTopics = (rawValue: string) => {
    const parsedTopics = parseMathTopicEntries(rawValue);
    const draftLooksLikeContext =
      normalizeMathTopic(rawValue).length > 0 && parsedTopics.length === 0;

    if (draftLooksLikeContext) {
      toast({
        title: "Add math topics only",
        description: "Use this field for topics like Algebra or Fractions. The struggle contexts above are tracked separately.",
        variant: "destructive",
      });
      return;
    }

    if (parsedTopics.length === 0) {
      return;
    }

    const nextTopics = Array.from(
      new Set<string>([
        ...selectedMathTopics,
        ...parsedTopics,
      ])
    );

    syncMathTopicEntries(nextTopics);
    setFormData((prev) => ({
      ...prev,
      topicResponseSymptoms: nextTopics.reduce<Record<string, string[]>>((acc, topic) => {
        acc[topic] = prev.topicResponseSymptoms[topic] || [];
        return acc;
      }, {}),
    }));
    setMathTopicDraft("");
  };

  const removeMathTopic = (topicToRemove: string) => {
    const nextTopics = selectedMathTopics.filter((topic) => topic !== topicToRemove);
    syncMathTopicEntries(nextTopics);
    setFormData((prev) => {
      const nextTopicResponseSymptoms = { ...prev.topicResponseSymptoms };
      delete nextTopicResponseSymptoms[topicToRemove];
      return {
        ...prev,
        topicResponseSymptoms: nextTopicResponseSymptoms,
      };
    });
  };

  const isFormValid = () => {
    const hasMathTopics = selectedMathTopics.length > 0;
    const everyTopicHasSymptoms = selectedMathTopics.every((topic) => (formData.topicResponseSymptoms[topic] || []).length > 0);
    return (
      formData.parentFullName &&
      formData.parentPhone &&
      formData.parentEmail &&
      formData.parentCity &&
      formData.studentFullName &&
      formData.studentGrade &&
      formData.studentGender &&
      formData.schoolName &&
      hasMathTopics &&
      everyTopicHasSymptoms &&
      formData.previousTutoring &&
      formData.internetAccess &&
      formData.agreedToTerms
    );
  };

  const handleSubmit = async () => {
    const submittedMathTopics = Array.from(
      new Set<string>([
        ...selectedMathTopics,
        ...parseMathTopicEntries(mathTopicDraft),
      ])
    );

    if (submittedMathTopics.join(", ") !== selectedMathTopics.join(", ")) {
      syncMathTopicEntries(submittedMathTopics);
      setMathTopicDraft("");
    }

    if (
      !formData.parentFullName ||
      !formData.parentPhone ||
      !formData.parentEmail ||
      !formData.parentCity ||
      !formData.studentFullName ||
      !formData.studentGrade ||
      !formData.studentGender ||
      !formData.schoolName ||
      submittedMathTopics.length === 0 ||
      submittedMathTopics.some((topic) => (formData.topicResponseSymptoms[topic] || []).length === 0) ||
      !formData.previousTutoring ||
      !formData.internetAccess ||
      !formData.agreedToTerms
    ) {
      toast({
        title: "Incomplete Form",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/enroll`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          reportedTopics: submittedMathTopics,
          responseSymptoms: Array.from(
            new Set(
              submittedMathTopics.flatMap((topic) => formData.topicResponseSymptoms[topic] || [])
            )
          ),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit enrollment");
      }

      await response.json().catch(() => null);

      await queryClient.cancelQueries({ queryKey: ["/api/parent/enrollment-status"] });

      let refreshedEnrollmentStatus: EnrollmentStatus | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: { session } } = await supabase.auth.getSession();
        const statusHeaders: HeadersInit = {};
        if (session?.access_token) {
          statusHeaders["Authorization"] = `Bearer ${session.access_token}`;
        }

        const statusResponse = await fetch(`${API_URL}/api/parent/enrollment-status`, {
          headers: statusHeaders,
          credentials: "include",
          cache: "no-store",
        });

        if (statusResponse.ok) {
          refreshedEnrollmentStatus = await statusResponse.json().catch(() => null);
        }

        if (refreshedEnrollmentStatus && refreshedEnrollmentStatus.status !== "not_enrolled") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      if (!refreshedEnrollmentStatus || refreshedEnrollmentStatus.status === "not_enrolled") {
        throw new Error("Enrollment did not persist. Please try again.");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });

      toast({
        title: "Application Received",
        description: "We'll assess fit and respond.",
      });
      setStep("submitted");
    } catch (error) {
      console.error("Enrollment error:", error);
      toast({
        title: "Error",
        description: "Failed to submit enrollment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }


  const handleProposeIntroSession = async () => {
    if (!proposedDate || !proposedTime) {
      toast({
        title: "Missing Information",
        description: "Please select both a date and time.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingSession(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/intro-session/propose`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          proposedDate: format(proposedDate, "yyyy-MM-dd"),
          proposedTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to propose session");
      }

      const sessionData = await response.json();

      toast({
        title: `${sessionTitle} Proposed`,
        description: `Your tutor will confirm the ${sessionLabel} time shortly.`,
      });

      setIsBookingDialogOpen(false);
      setProposedDate(undefined);
      setProposedTime("");

      setJustBooked(true);
      setBookedIntroSessionOverride({
        ...(introSessionConfirmation || {}),
        ...sessionData,
        status: sessionData?.status || "pending_tutor_confirmation",
        scheduled_time:
          sessionData?.scheduled_time ||
          `${format(proposedDate, "yyyy-MM-dd")}T${proposedTime}`,
        parent_confirmed: sessionData?.parent_confirmed ?? true,
        tutor_confirmed: sessionData?.tutor_confirmed ?? false,
        introCompleted: false,
      });

      queryClient.setQueryData(["/api/parent/intro-session-confirmation"], {
        ...(introSessionConfirmation || {}),
        ...sessionData,
        status: sessionData?.status || "pending_tutor_confirmation",
        scheduled_time:
          sessionData?.scheduled_time ||
          `${format(proposedDate, "yyyy-MM-dd")}T${proposedTime}`,
        parent_confirmed: sessionData?.parent_confirmed ?? true,
        tutor_confirmed: sessionData?.tutor_confirmed ?? false,
        introCompleted: false,
      });

      // Force refetch intro session confirmation immediately after booking
      await refetchIntroSessionConfirmation();
    } catch (error) {
      console.error("Error proposing session:", error);
      toast({
        title: "Error",
        description: "Failed to propose session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSession(false);
    }
  };
  // Reset justBooked if status is still not_scheduled (e.g. booking failed or was reset)
  useEffect(() => {
    if (
      bookedIntroSessionOverride &&
      introSessionConfirmation?.status &&
      introSessionConfirmation.status !== "not_scheduled" &&
      introSessionConfirmation.status === bookedIntroSessionOverride.status
    ) {
      setBookedIntroSessionOverride(null);
    }
  }, [bookedIntroSessionOverride, introSessionConfirmation?.status]);

  useEffect(() => {
    if (justBooked && effectiveIntroSessionConfirmation?.status === "not_scheduled") {
      setTimeout(() => setJustBooked(false), 2000); // Add a short delay to avoid flicker
    }
  }, [effectiveIntroSessionConfirmation?.status, justBooked]);

  const handleDebugAuthInfo = async () => {
    setLoadingDebug(true);
    setDebugError(null);
    setDebugInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_URL}/api/debug/auth-info`, {
        method: "GET",
        headers,
        credentials: "include"
      });
      const json = await res.json();
      setDebugInfo(json);
    } catch (e: any) {
      setDebugError(e.message || "Unknown error");
    } finally {
      setLoadingDebug(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 relative flex items-center justify-between">
          <div className="w-10 md:hidden" aria-hidden="true" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:transform-none w-full sm:w-auto flex justify-center">
            <ResponseIntegrityLogo size="md" variant="integrity" />
          </div>
          
          <div className="hidden md:block">
            <span className="text-xl lg:text-3xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              Cohort Application
            </span>
          </div>

          <Button
            variant="ghost"
            className="hidden md:inline-flex text-sm sm:text-base font-medium hover:bg-transparent items-center gap-1 sm:gap-2 px-2 sm:px-4"
            style={{ color: "#1A1A1A" }}
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </Button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 sm:h-20" />

      {/* Journey Status Bar */}
      <div style={{ backgroundColor: "#FFF0F0" }}>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex justify-center">
          <div className="flex items-center justify-between w-full max-w-2xl overflow-x-auto">
            {[
              { label: "Applied", status: step === "enrollment" || step === "submitted" || step === "awaiting_tutor_acceptance" },
              { label: "Review", status: enrollmentStatus?.status === "awaiting_assignment" || enrollmentStatus?.status === "awaiting_tutor_acceptance" || enrollmentStatus?.status === "assigned" || enrollmentStatus?.status === "proposal_sent" || enrollmentStatus?.status === "session_booked" || enrollmentStatus?.status === "report_received" || enrollmentStatus?.status === "confirmed" },
              { label: "Assigned", status: enrollmentStatus?.status === "awaiting_tutor_acceptance" || enrollmentStatus?.status === "assigned" || enrollmentStatus?.status === "proposal_sent" || enrollmentStatus?.status === "session_booked" || enrollmentStatus?.status === "report_received" || enrollmentStatus?.status === "confirmed" },
              { label: "Active", status: enrollmentStatus?.status === "confirmed" },
            ].map((item, idx, arr) => (
              <div key={item.label} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div
                    className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition"
                    style={{
                      backgroundColor: item.status ? "#E63946" : "transparent",
                      borderColor: item.status ? "#E63946" : "#D1D5DB",
                      color: item.status ? "white" : "#9CA3AF"
                    }}
                  >
                    {item.status ? (
                      <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <Circle className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs mt-1 sm:mt-2 font-medium text-center" style={{ color: "#1A1A1A" }}>{item.label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1 sm:mx-2 transition min-w-[12px]"
                    style={{ backgroundColor: item.status ? "#E63946" : "#E5E5E5" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-2xl">
        {step !== "loading" && step !== "enrollment" && (
          <div className="mb-6">
            <PushOptInCard
              enabled
              title="Enable out-of-app alerts"
              description="Turn on browser notifications so Response Integrity can alert you when a tutor is assigned, a proposal is ready, a session needs your confirmation, or a report is sent."
            />
          </div>
        )}

        {/* Awaiting Tutor Acceptance */}
        {step === "awaiting_tutor_acceptance" && (
          <Card className="border-0 shadow-lg" style={{ backgroundColor: "white" }}>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg" style={{ color: "#E63946" }}>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#E63946" }} />
                Tutor Assignment Pending Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-medium text-yellow-900">Your tutor has been assigned and is reviewing this assignment.</p>
                <p className="text-sm text-yellow-700 mt-2">
                  Intro session booking unlocks as soon as your tutor accepts. We will update this page automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enrollment Form */}
        {step === "enrollment" && (
          <Card className="border-0 shadow-lg" style={{ backgroundColor: "white" }}>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl" style={{ color: "#1A1A1A" }}>Application Form</CardTitle>
              <CardDescription className="text-sm" style={{ color: "#5A5A5A" }}>
                Response Integrity - Founding Cohort Application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 sm:space-y-8 px-4 sm:px-6">
              {/* Introduction */}
              <div className="rounded-xl p-4 sm:p-5 space-y-2 sm:space-y-3" style={{ backgroundColor: "#FFF0F0" }}>
                <h3 className="font-semibold text-sm sm:text-base" style={{ color: "#E63946" }}>We train how students respond when certainty disappears.</h3>
                <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                  This is the Founding Cohort. Limited families. Serious about response training.
                </p>
                <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                  Response Integrity is not tutoring. It's a performance-conditioning system. Every application is reviewed to ensure fit. This application helps us determine whether our training is appropriate for your child.
                </p>
              </div>

              {/* Parent Information */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wide" style={{ color: "#E63946" }}>Parent / Guardian Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>Full Name *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="Your full name"
                      value={formData.parentFullName}
                      onChange={(e) => handleInputChange("parentFullName", e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>Phone Number (+27) *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="+27 71 234 5678"
                      value={formData.parentPhone}
                      onChange={(e) => handleInputChange("parentPhone", e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1">Email Address *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="your@email.com"
                      value={formData.parentEmail}
                      onChange={(e) => handleInputChange("parentEmail", e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1">City / Suburb *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="Your city"
                      value={formData.parentCity}
                      onChange={(e) => handleInputChange("parentCity", e.target.value)}
                      autoComplete="address-level2"
                    />
                  </div>
                </div>
              </div>

              {/* Student Information */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wide" style={{ color: "#E63946" }}>Student Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>Student's Full Name *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="Student's name"
                      value={formData.studentFullName}
                      onChange={(e) => handleInputChange("studentFullName", e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: "#1A1A1A" }}>Grade in 2026 *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["Grade 6", "Grade 7", "Grade 8", "Grade 9"].map((grade) => (
                        <button
                          key={grade}
                          onClick={() => handleInputChange("studentGrade", grade)}
                          className="px-3 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition"
                          style={{
                            backgroundColor: formData.studentGrade === grade ? "#E63946" : "transparent",
                            color: formData.studentGrade === grade ? "white" : "#1A1A1A",
                            borderColor: formData.studentGrade === grade ? "#E63946" : "#E5E5E5"
                          }}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: "#1A1A1A" }}>
                      Student Gender *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange("studentGender", option.value)}
                          className="px-3 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition"
                          style={{
                            backgroundColor: formData.studentGender === option.value ? "#E63946" : "transparent",
                            color: formData.studentGender === option.value ? "white" : "#1A1A1A",
                            borderColor: formData.studentGender === option.value ? "#E63946" : "#E5E5E5"
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1">School Name *</label>
                    <Input
                      className="text-sm sm:text-base"
                      placeholder="School name"
                      value={formData.schoolName}
                      onChange={(e) => handleInputChange("schoolName", e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: "#1A1A1A" }}>Where does your child most often get stuck in math?</label>
                    <div className="space-y-2">
                      {[
                        { value: "word_problems", label: "Word problems" },
                        { value: "tests", label: "Tests" },
                        { value: "timed_work", label: "Timed work" },
                        { value: "new_topics", label: "New topics" },
                        { value: "careless_errors", label: "Careless errors" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const currentAreas = formData.stuckAreas || [];
                            const newAreas = currentAreas.includes(option.value)
                              ? currentAreas.filter(a => a !== option.value)
                              : [...currentAreas, option.value];
                            handleInputChange("stuckAreas", newAreas);
                          }}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-xs sm:text-sm text-left transition flex items-center gap-2"
                          style={{
                            backgroundColor: (formData.stuckAreas || []).includes(option.value) ? "#E63946" : "#FFF0F0",
                            color: (formData.stuckAreas || []).includes(option.value) ? "white" : "#1A1A1A",
                            borderColor: (formData.stuckAreas || []).includes(option.value) ? "#E63946" : "#FFF0F0"
                          }}
                        >
                          <div 
                            className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: (formData.stuckAreas || []).includes(option.value) ? "white" : "#E5E5E5",
                              backgroundColor: (formData.stuckAreas || []).includes(option.value) ? "white" : "transparent"
                            }}
                          >
                            {(formData.stuckAreas || []).includes(option.value) && (
                              <Check className="w-3 h-3" style={{ color: "#E63946" }} />
                            )}
                          </div>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1">What specific math areas does your child struggle with most? *</label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          className="text-sm sm:text-base"
                          placeholder="Type one math topic, then add it"
                          value={mathTopicDraft}
                          onChange={(e) => setMathTopicDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMathTopics(mathTopicDraft);
                            }
                          }}
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => addMathTopics(mathTopicDraft)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      <p className="text-[11px] sm:text-xs" style={{ color: "#5A5A5A" }}>
                        Add topics one by one, for example: Algebra, Fractions, Exponents.
                      </p>
                      {selectedMathTopics.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedMathTopics.map((topic) => (
                            <button
                              key={topic}
                              type="button"
                              onClick={() => removeMathTopic(topic)}
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm"
                              style={{ borderColor: "#F2D7DA", backgroundColor: "#FFF8F8", color: "#1A1A1A" }}
                            >
                              <span>{topic}</span>
                              <X className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No math topics added yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Topic symptom mapping */}
              {selectedMathTopics.length > 0 && (
                <div className="space-y-5 pt-2">
                  {selectedMathTopics.map((topic, topicIndex) => {
                    const selectedTopicSymptoms = formData.topicResponseSymptoms[topic] || [];
                    return (
                      <div key={topic} className="rounded-2xl border border-[#F2D7DA] bg-[#FFF8F8] p-4 sm:p-5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: "#E63946" }}>
                            Topic {topicIndex + 1}
                          </p>
                          <h5 className="text-sm sm:text-base font-semibold" style={{ color: "#1A1A1A" }}>
                            {topic}
                          </h5>
                          <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                            What does the struggle usually look like here?
                          </p>
                        </div>

                        <div className="space-y-4">
                          {RESPONSE_SYMPTOM_GROUPS.map((group) => (
                            <div key={`${topic}-${group.id}`} className="rounded-xl border border-[#F6D8DA] bg-white p-3 sm:p-4 space-y-2">
                              <div>
                                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: "#E63946" }}>
                                  {group.title}
                                </p>
                                <p className="text-xs sm:text-sm mt-1" style={{ color: "#5A5A5A" }}>
                                  {group.prompt}
                                </p>
                              </div>
                              <div className="space-y-2">
                                {group.options.map((option) => {
                                  const selected = selectedTopicSymptoms.includes(option.id);
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => {
                                        const currentSymptoms = formData.topicResponseSymptoms[topic] || [];
                                        const groupOptionIds = getGroupOptionIds(group.id);
                                        const fallbackOptionIds = getGroupFallbackOptionIds(group.id);
                                        const isFallbackOption = fallbackOptionIds.includes(option.id);
                                        const groupSelections = currentSymptoms.filter((item) => groupOptionIds.includes(item));
                                        let nextGroupSelections: string[];

                                        if (selected) {
                                          nextGroupSelections = groupSelections.filter((item) => item !== option.id);
                                        } else if (isFallbackOption) {
                                          nextGroupSelections = [option.id];
                                        } else {
                                          nextGroupSelections = [
                                            ...groupSelections.filter((item) => !fallbackOptionIds.includes(item)),
                                            option.id,
                                          ];
                                        }

                                        const nextSymptoms = [
                                          ...currentSymptoms.filter((item) => !groupOptionIds.includes(item)),
                                          ...Array.from(new Set(nextGroupSelections)),
                                        ];

                                        updateTopicResponseSymptoms(topic, nextSymptoms);
                                      }}
                                      className="w-full px-3 sm:px-4 py-3 rounded-xl border-2 text-xs sm:text-sm text-left transition flex items-start gap-2"
                                      style={{
                                        backgroundColor: selected ? "#E63946" : "white",
                                        color: selected ? "white" : "#1A1A1A",
                                        borderColor: selected ? "#E63946" : "#F2D7DA",
                                      }}
                                    >
                                      <div
                                        className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{
                                          borderColor: selected ? "white" : "#E5E5E5",
                                          backgroundColor: selected ? "white" : "transparent",
                                        }}
                                      >
                                        {selected && <Check className="w-3 h-3" style={{ color: "#E63946" }} />}
                                      </div>
                                      <div className="space-y-1">
                                        <p>{option.label}</p>
                                        <p className="text-[11px] sm:text-xs" style={{ color: selected ? "rgba(255,255,255,0.85)" : "#6B7280" }}>
                                          {option.description}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Background Questions */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wide" style={{ color: "#E63946" }}>Background</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2">Has your child ever received tutoring before? *</label>
                    <div className="space-y-2">
                      {[
                        { value: "formal", label: "Yes - formal paid tutoring" },
                        { value: "informal", label: "Yes - informal help from friends/family" },
                        { value: "no", label: "No - this will be their first time" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleInputChange("previousTutoring", option.value)}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-xs sm:text-sm text-left transition"
                          style={{
                            backgroundColor: formData.previousTutoring === option.value ? "#E63946" : "#FFF0F0",
                            color: formData.previousTutoring === option.value ? "white" : "#1A1A1A",
                            borderColor: formData.previousTutoring === option.value ? "#E63946" : "#FFF0F0"
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2">Does your child have access to stable internet and a device for online sessions? *</label>
                    <div className="space-y-2">
                      {[
                        { value: "always", label: "Yes, always" },
                        { value: "sometimes", label: "Sometimes" },
                        { value: "no", label: "No" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleInputChange("internetAccess", option.value)}
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-xs sm:text-sm text-left transition"
                          style={{
                            backgroundColor: formData.internetAccess === option.value ? "#E63946" : "#FFF0F0",
                            color: formData.internetAccess === option.value ? "white" : "#1A1A1A",
                            borderColor: formData.internetAccess === option.value ? "#E63946" : "#FFF0F0"
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Process Alignment */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wide" style={{ color: "#E63946" }}>Process Alignment (Required)</h4>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: "#1A1A1A" }}>Are you willing for your child to be trained to solve problems independently, without relying on constant encouragement or guidance? *</label>
                  <div className="space-y-2">
                    {[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleInputChange("processAlignment", option.value)}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-xs sm:text-sm text-left transition"
                        style={{
                          backgroundColor: formData.processAlignment === option.value ? "#E63946" : "#FFF0F0",
                          color: formData.processAlignment === option.value ? "white" : "#1A1A1A",
                          borderColor: formData.processAlignment === option.value ? "#E63946" : "#FFF0F0"
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Parent Agreement */}
              <div className="space-y-3 rounded-xl p-4 sm:p-5" style={{ backgroundColor: "#FFF0F0" }}>
                <h4 className="font-semibold text-xs sm:text-sm" style={{ color: "#1A1A1A" }}>Parent Agreement *</h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  {[
                    "I understand placement in the Founding Cohort is limited and not guaranteed.",
                    "I consent for my child to participate in Response Integrity's response-conditioning system.",
                    "I'll support my child's attendance, communication, and progress.",
                    "I understand Response Integrity may use anonymized results or testimonials for success case studies.",
                    "I understand the program structure and commitment expectations.",
                  ].map((agreement, idx) => (
                    <div key={idx} className="flex gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" style={{ color: "#E63946" }} />
                      <span style={{ color: "#5A5A5A" }}>{agreement}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleInputChange("agreedToTerms", !formData.agreedToTerms)}
                  className="mt-4 flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer"
                  style={{ color: "#1A1A1A" }}
                >
                  <div 
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center"
                    style={{ 
                      borderColor: formData.agreedToTerms ? "#E63946" : "#E5E5E5",
                      backgroundColor: formData.agreedToTerms ? "#E63946" : "white"
                    }}
                  >
                    {formData.agreedToTerms && <Check className="w-3 h-3 text-white" />}
                  </div>
                  I agree to the above terms
                </button>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid() || isSubmitting}
                className="w-full rounded-full font-semibold text-sm sm:text-base"
                size="lg"
                style={{ backgroundColor: "#E63946", color: "white" }}
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>

              <p className="text-[10px] sm:text-xs text-center" style={{ color: "#5A5A5A" }}>
                Limited spots available. All applications are reviewed individually.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submitted Confirmation */}
        {step === "submitted" && enrollmentStatus && (
          <Card className="text-center border-0 shadow-lg" style={{ backgroundColor: "white" }}>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center justify-center gap-2 text-sm sm:text-lg" style={{ color: "#1A1A1A" }}>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#E63946" }} />
                {enrollmentStatus.status === "awaiting_assignment" &&
                  (isReassignmentAwaitingAssignment ? "Tutor Reassignment In Progress" : "Application Being Assessed")}
                {enrollmentStatus.status === "assigned" && (isHandoverFlow ? "Tutor Reassignment In Progress" : "Your tutor has been assigned")}
                {enrollmentStatus.status === "proposal_sent" && "Training Proposal Ready"}
                {enrollmentStatus.status === "session_booked" && (isHandoverFlow ? "Continuity Check Scheduled" : "Proposal Accepted")}
                {enrollmentStatus.status === "report_received" && (isHandoverFlow ? "Continuity Review In Progress" : "Awaiting Report")}
                {enrollmentStatus.status === "confirmed" && (isHandoverFlow ? "Tutor Reassignment In Progress" : "Active")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isHandoverFlow && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
                  <p className="font-medium text-blue-900">Training history is being preserved.</p>
                  <p className="mt-2 text-sm text-blue-800">
                    Your child is not being re-onboarded. The new tutor will run a short continuity check to verify where training should resume using the existing progress and topic history.
                  </p>
                </div>
              )}
              {enrollmentStatus.status === "awaiting_assignment" && (
                <>
                  {isReassignmentAwaitingAssignment ? (
                    <>
                      <p className="text-muted-foreground">
                        Your previous tutor is no longer eligible for live parent assignments, so Response Integrity is moving your child to a live-qualified tutor.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your existing training history is being preserved. This is a tutor reassignment, not a fresh application review.
                      </p>
                      <div className="bg-muted/30 rounded-lg p-4 text-left">
                        <p className="text-sm font-medium mb-2">What happens next:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Response Integrity assigns a new live-qualified tutor</li>
                          <li>Your new tutor accepts the reassignment</li>
                          <li>A continuity check is run to confirm the restart point</li>
                          <li>Training resumes from the strongest verified position</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        Application received. We're assessing fit.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        We match each student with the right tutor. Due to high demand and our commitment to fit, acceptance is not guaranteed.
                      </p>
                      <div className="bg-muted/30 rounded-lg p-4 text-left">
                        <p className="text-sm font-medium mb-2">What happens next:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>We assess your application</li>
                          <li>If accepted, we assign a tutor</li>
                          <li>You receive a training proposal</li>
                          <li>Review it. Accept or decline.</li>
                        </ul>
                      </div>
                    </>
                  )}
                </>
              )}
              {(enrollmentStatus.status === "assigned" || isHandoverFlow) && (
                <>
                  {/* Always show assigned tutor info when assigned */}
                  {assignedTutor && (
                    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                        {assignedTutor.profile_image_url ? (
                          <img 
                            src={assignedTutor.profile_image_url} 
                            alt={assignedTutor.name}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <div className="flex-1">
                          <h3 className="font-semibold text-base sm:text-lg">{assignedTutor.name}</h3>
                          {assignedTutor.bio && (
                            <p className="text-sm text-red-900 mt-1">{assignedTutor.bio}</p>
                          )}
                          {assignedTutor.email && (
                            <p className="mt-2 text-sm text-red-900">
                              <span className="font-medium">Email:</span> {assignedTutor.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isTrainingMode && (effectiveIntroSessionConfirmation?.status === "not_scheduled" || !effectiveIntroSessionConfirmation?.status) && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="font-medium text-yellow-900">
                        {isHandoverFlow ? "Your new tutor is ready." : "Your tutor has been assigned."}
                      </p>
                      <p className="text-sm text-yellow-700 mt-2">
                        {isHandoverFlow
                          ? "Book your continuity check below once ready."
                          : "Book your intro session below once ready."}
                      </p>
                    </div>
                  )}

                  {isTrainingMode && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="font-medium text-red-900">Tutor training mode is active</p>
                      <p className="text-sm text-red-700 mt-2">
                        {isHandoverFlow
                          ? "You can still schedule the continuity check. Response Integrity will run it through the training flow instead of requiring the standard Google Meet live window."
                          : "You can still schedule the intro session. Response Integrity will run it through the training flow instead of requiring the standard Google Meet live window."}
                      </p>
                    </div>
                  )}

                  {/* Show session status if present */}
                  {effectiveIntroSessionConfirmation?.status === "pending_tutor_confirmation" && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-red-400/30 border-t-red-600 rounded-full animate-spin flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-900">Waiting for tutor confirmation</p>
                          {effectiveIntroSessionConfirmation.scheduled_time && (
                            <p className="text-xs text-red-700 mt-1">
                              Proposed {sessionLabel}: {new Date(effectiveIntroSessionConfirmation.scheduled_time).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {effectiveIntroSessionConfirmation?.status === "pending_parent_confirmation" && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-yellow-400/30 border-t-yellow-600 rounded-full animate-spin flex-shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-900">
                            Tutor proposed a different {sessionLabel} schedule. Please confirm.
                          </p>
                          {effectiveIntroSessionConfirmation.scheduled_time && (
                            <p className="text-xs text-yellow-700 mt-1">
                              Proposed schedule: {new Date(effectiveIntroSessionConfirmation.scheduled_time).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          style={{ backgroundColor: '#E63946', color: 'white' }}
                          className="w-full"
                          disabled={isSubmittingSession}
                          onClick={async () => {
                            setIsSubmittingSession(true);
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const headers: HeadersInit = { "Content-Type": "application/json" };
                              if (session?.access_token) {
                                headers["Authorization"] = `Bearer ${session.access_token}`;
                              }
                              const response = await fetch(`${API_URL}/api/parent/intro-session-confirm`, {
                                method: "POST",
                                headers,
                                credentials: "include",
                                body: JSON.stringify({ sessionId: effectiveIntroSessionConfirmation.id }),
                              });
                              if (!response.ok) throw new Error("Failed to confirm session");
                              toast({
                                title: `${sessionTitle} Confirmed`,
                                description: `Your ${sessionLabel} is now confirmed.`,
                              });
                              await refetchIntroSessionConfirmation();
                              // Also refetch enrollment status in case proposal was sent
                              await queryClient.invalidateQueries({ queryKey: ["/api/parent/enrollment-status"] });
                            } catch (error) {
                              toast({ title: "Error", description: "Failed to confirm session. Please try again.", variant: "destructive" });
                            } finally {
                              setIsSubmittingSession(false);
                            }
                          }}
                        >
                          Confirm
                        </Button>
                      </div>
                    </div>
                  )}
                  {["confirmed", "ready", "live", "completed"].includes(String(effectiveIntroSessionConfirmation?.status || "")) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      {effectiveIntroSessionConfirmation.introCompleted ? (
                        <>
                          <p className="font-medium text-green-900">
                            Your {sessionCompletedLabel} has been conducted
                          </p>
                          <p className="text-sm text-green-700 mt-2">
                            {isHandoverFlow
                              ? "The new tutor is now locking in the best restart point before normal training resumes."
                              : "Tutor is now preparing your training proposal. You'll see it here once it has been sent."}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-green-900">Your {sessionLabel} has been confirmed</p>
                          {effectiveIntroSessionConfirmation.scheduled_time && (
                            <p className="text-sm text-green-700 mt-2">
                              Scheduled for: {new Date(effectiveIntroSessionConfirmation.scheduled_time).toLocaleString()}
                            </p>
                          )}
                          <p className="text-sm text-green-700 mt-2">
                            {isHandoverFlow
                              ? "The new tutor will verify continuity and resume training from the strongest confirmed point."
                              : "You will receive an introductory report and proposal here after you've had your intro session"}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Show booking dialog for not_scheduled and pending_parent_confirmation */}
                  {(effectiveIntroSessionConfirmation?.status === "not_scheduled" || effectiveIntroSessionConfirmation?.status === "pending_parent_confirmation") && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="font-medium mb-4 text-red-900">
                        {effectiveIntroSessionConfirmation?.status === "not_scheduled"
                          ? `Schedule your ${sessionLabel}`
                          : `Adjust your ${sessionLabel} schedule`}
                      </p>
                      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                        {(effectiveIntroSessionConfirmation?.status === "not_scheduled" || effectiveIntroSessionConfirmation?.status === "pending_parent_confirmation") && (
                          <DialogTrigger asChild>
                            <Button
                              style={{ backgroundColor: '#E63946', color: 'white' }}
                              className="w-full"
                              disabled={isSubmittingSession || justBooked}
                              title={undefined}
                            >
                              {effectiveIntroSessionConfirmation?.status === "not_scheduled"
                                ? `Book ${sessionTitle}`
                                : "Adjust Schedule"}
                            </Button>
                          </DialogTrigger>
                        )}
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Propose {sessionTitle} Time</DialogTitle>
                            <DialogDescription>
                              Select a date and time for your {sessionLabel} with {assignedTutor?.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">Date</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left">
                                    {proposedDate ? format(proposedDate, "PPP") : "Pick a date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={proposedDate}
                                    onSelect={setProposedDate}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Time</label>
                              <Input
                                type="time"
                                value={proposedTime}
                                onChange={(e) => setProposedTime(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              onClick={handleProposeIntroSession}
                              disabled={isSubmittingSession || justBooked}
                              className="w-full"
                            >
                              {isSubmittingSession ? "Proposing..." : "Propose Time"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </>
              )}
              {enrollmentStatus.status === "proposal_sent" && (
                <>
                  <p className="text-muted-foreground mb-4">
                    Your training proposal is ready.
                  </p>

                  {proposalPanel}
                </>
              )}
              {(enrollmentStatus.status === "session_booked" || enrollmentStatus.status === "report_received" || enrollmentStatus.status === "confirmed") && (
                <>
                  {proposalLoading && !proposal && !effectiveParentCode ? (
                    <div className="bg-muted/30 rounded-lg p-4 text-center mb-4 sm:mb-6">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Loading your student access code...</p>
                    </div>
                  ) : effectiveParentCode && !hideStudentCodeCard ? (
                    <Card className="border-2 border-primary mb-4 sm:mb-6">
                      <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-base sm:text-xl">Student Access Code</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          Give this to your child. They'll use it to create their account.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 sm:p-6 rounded-lg text-center">
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">Student Code</p>
                          <div className="text-2xl sm:text-4xl font-bold tracking-wider text-primary mb-3 sm:mb-4">
                            {effectiveParentCode}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(effectiveParentCode);
                              toast({
                                title: "Copied",
                                description: "Code copied",
                              });
                            }}
                            className="gap-2 text-xs sm:text-sm"
                          >
                            Copy Code
                          </Button>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                          <h4 className="font-semibold text-xs sm:text-sm mb-2">What happens next:</h4>
                          <ol className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2">
                            <li>1. Give this code to your child</li>
                            <li>2. They visit the student portal</li>
                            <li>3. They enter this code during account creation</li>
                          </ol>
                        </div>
                        <Button
                          onClick={() => navigate("/client/parent/dashboard")}
                          className="w-full"
                          size="lg"
                        >
                          Continue to Dashboard
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-sm"
                          onClick={() => setHideStudentCodeCard(true)}
                        >
                          Got it, don't show this again.
                        </Button>
                      </CardContent>
                    </Card>
                  ) : effectiveParentCode ? (
                    <div className="bg-muted/30 rounded-lg p-4 text-center mb-4 sm:mb-6">
                      <p className="text-sm text-muted-foreground">
                        Student access code is stored in the dashboard whenever you need it again.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={() => navigate("/client/parent/dashboard")}
                      >
                        Go to Dashboard
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-yellow-600">Student access code is being generated. Please refresh the page if it doesn't appear.</p>
                    </div>
                  )}
                  {quotaExhausted && (
                    <Card className="border border-rose-200 bg-rose-50 mt-4 sm:mt-6">
                      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                        <CardTitle className="text-base sm:text-lg text-rose-700">Monthly Quota Exhausted</CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-rose-600">
                          All 8 sessions for this month have been used. Renew now to unlock the next 8.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                        <Button
                          onClick={handleRenewSubscription}
                          disabled={isRenewing}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                          size="lg"
                        >
                          {isRenewing ? "Preparing payment…" : "Renew This Month - R1000"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {step === "loading" && (
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground">Loading your enrollment status...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

