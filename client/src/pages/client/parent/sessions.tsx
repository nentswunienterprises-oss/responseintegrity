import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays } from "lucide-react";
import { TrainingSessionCancellationDialog } from "@/components/scheduling/TrainingSessionCancellationDialog";
import {
  PARENT_TRAINING_SESSION_CANCELLATION_REASONS,
  buildTrainingSessionCancellationNote,
} from "@/lib/trainingSessionCancellation";

const PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY = "parent-gateway:payfast-merchant-reference";
const PAYFAST_RETURN_PATH_STORAGE_KEY = "parent-payfast:return-path";

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

type ParentTrainingSession = {
  id: string;
  scheduled_time: string;
  scheduled_end?: string | null;
  timezone?: string | null;
  status: string;
  type: string;
  google_meet_url?: string | null;
  parent_confirmed?: boolean;
  tutor_confirmed?: boolean;
  cancellation?: {
    disposition: "replacement_required" | "closed_consumed" | "manual_review";
    eventType?: string | null;
    billingImpact?: string | null;
    reasonCodes?: string[];
    reasonNote?: string | null;
    cancelledAt?: string | null;
  } | null;
};

type ParentTrainingSessionsResponse = {
  sessions: ParentTrainingSession[];
  operationalMode?: "training" | "sandbox" | "trial" | "certified_live";
  sessionSchedulingEnabled?: boolean;
  paymentRequired?: boolean;
  paymentStatus?: string;
  monthlyQuota?: {
    sessions_remaining?: number;
    session_quota?: number;
    package_amount_zar?: number;
    session_price?: number;
  } | null;
};

export default function ParentSessions() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [slotOneDate, setSlotOneDate] = useState<Date | undefined>(undefined);
  const [slotOneTime, setSlotOneTime] = useState("15:00");
  const [slotTwoDate, setSlotTwoDate] = useState<Date | undefined>(undefined);
  const [slotTwoTime, setSlotTwoTime] = useState("17:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingSandboxPayment, setIsPreparingSandboxPayment] = useState(false);
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null);
  const [adjustingSessionId, setAdjustingSessionId] = useState<string | null>(null);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [adjustedDate, setAdjustedDate] = useState<Date | undefined>(undefined);
  const [adjustedTime, setAdjustedTime] = useState("15:00");
  const [cancelSessionTarget, setCancelSessionTarget] = useState<ParentTrainingSession | null>(null);

  const formatScheduleLabel = (value?: string | Date | null) => {
    if (!value) return "Choose a date";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Choose a date";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const formatSessionDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const combineDateAndTime = (date?: Date, time?: string) => {
    if (!date || !time) return "";
    const [hours, minutes] = time.split(":").map((part) => Number(part));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const isSelectableSessionDate = (date: Date) => {
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day >= 1 && day <= 6 && date >= today;
  };

  const openAdjustmentEditor = (session: ParentTrainingSession) => {
    if (editingSessionId === session.id) {
      setEditingSessionId(null);
      setAdjustedDate(undefined);
      setAdjustedTime("15:00");
      return;
    }

    setEditingSessionId(session.id);

    const scheduledDate = new Date(session.scheduled_time);
    if (Number.isNaN(scheduledDate.getTime())) {
      setAdjustedDate(undefined);
      setAdjustedTime("15:00");
      return;
    }

    setAdjustedDate(scheduledDate);
    const hours = String(scheduledDate.getHours()).padStart(2, "0");
    const minutes = String(scheduledDate.getMinutes()).padStart(2, "0");
    setAdjustedTime(`${hours}:${minutes}`);
  };

  const getWeekValidationMessage = (values: string[]) => {
    const parsed = values.map((value) => new Date(value));
    if (parsed.some((date) => Number.isNaN(date.getTime()))) {
      return "Session dates must be valid.";
    }
    if (parsed.some((date) => {
      const day = date.getDay();
      return day < 1 || day > 6;
    })) {
      return "Session dates must fall between Monday and Saturday.";
    }
    const getWeekStart = (date: Date) => {
      const start = new Date(date);
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - mondayOffset);
      return start.getTime();
    };
    const firstWeekStart = getWeekStart(parsed[0]);
    if (parsed.some((date) => getWeekStart(date) !== firstWeekStart)) {
      return "Both sessions must be scheduled within the same Monday-to-Saturday week.";
    }
    return null;
  };

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/client/signup");
    }
  }, [user, isLoading, navigate]);

  const { data, isLoading: sessionsLoading } = useQuery<ParentTrainingSessionsResponse>({
    queryKey: ["/api/parent/training-sessions"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const response = await fetch(`${API_URL}/api/parent/training-sessions`, {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const handleSandboxPackagePayment = async () => {
    setIsPreparingSandboxPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/parent/proposal/accept`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to prepare Sandbox package payment.");
      }

      if (payload?.paymentStatus === "PAID" || payload?.paymentStatus === "FREE_ACCESS") {
        toast({
          title: "Package Access Active",
          description: "This package is already active. Refreshing your scheduling access.",
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] });
        return;
      }

      if (!payload?.checkoutUrl || !payload?.formFields) {
        throw new Error("PayFast Sandbox checkout details were not returned.");
      }

      if (payload?.merchantReference) {
        window.sessionStorage.setItem(
          PAYFAST_MERCHANT_REFERENCE_STORAGE_KEY,
          String(payload.merchantReference),
        );
      }
      window.sessionStorage.setItem(
        PAYFAST_RETURN_PATH_STORAGE_KEY,
        "/client/parent/sessions",
      );

      toast({
        title: "Opening PayFast Sandbox",
        description: `Complete the R${Number(payload?.amount || 0).toLocaleString("en-ZA")} Sandbox package checkout. No real money is charged.`,
      });

      submitExternalPaymentForm(payload.checkoutUrl, payload.formFields);
    } catch (error) {
      toast({
        title: "Sandbox Payment Error",
        description: error instanceof Error ? error.message : "Failed to prepare Sandbox payment.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingSandboxPayment(false);
    }
  };

  const handleScheduleWeek = async () => {
    const slotOne = combineDateAndTime(slotOneDate, slotOneTime);
    const slotTwo = combineDateAndTime(slotTwoDate, slotTwoTime);

    if (!slotOne || !slotTwo) {
      toast({
        title: "Missing times",
        description: "Choose both session dates before scheduling the week.",
        variant: "destructive",
      });
      return;
    }

    const weekValidationMessage = getWeekValidationMessage([slotOne, slotTwo]);
    if (weekValidationMessage) {
      toast({
        title: "Invalid week",
        description: weekValidationMessage,
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

      const response = await fetch(`${API_URL}/api/parent/training-sessions/schedule-week`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg",
          slots: [
            { scheduledStart: new Date(slotOne).toISOString() },
            { scheduledStart: new Date(slotTwo).toISOString() },
          ],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 402) {
          toast({
            title: data?.operationalMode === "sandbox" ? "Sandbox Package Payment Required" : "Monthly Payment Required",
            description: payload?.message || "A package payment is required before more sessions can be scheduled.",
            variant: "destructive",
          });
          if (data?.operationalMode === "sandbox") {
            await handleSandboxPackagePayment();
          } else {
            navigate("/client/parent/gateway");
          }
          return;
        }
        throw new Error(payload?.message || "Failed to schedule this week's sessions");
      }

      toast({
        title: "Week Scheduled",
        description:
          payload?.createdCount > 0
            ? data?.operationalMode === "sandbox"
              ? "Two weekly session times were proposed. Your specialist must confirm both dates before the lessons are ready."
              : "Two weekly session times were proposed. Your Specialist must confirm both dates before Meet links are created."
            : "Those weekly session times already exist.",
      });

      setSlotOneDate(undefined);
      setSlotOneTime("15:00");
      setSlotTwoDate(undefined);
      setSlotTwoTime("17:00");
      queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule this week's sessions.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSession = async (sessionId: string) => {
    setConfirmingSessionId(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/parent/training-sessions/respond`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ sessionId, action: "confirm" }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to confirm session");
      }

      toast({
        title: "Session Confirmed",
        description:
          payload?.googleMeetSync === "google_calendar"
            ? "The session is confirmed and the Google Meet link has been attached."
            : payload?.googleMeetError || "The session is confirmed.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm session.",
        variant: "destructive",
      });
    } finally {
      setConfirmingSessionId(null);
    }
  };

  const handleAdjustSession = async (sessionId: string) => {
    if (!adjustedDate || !adjustedTime) {
      toast({
        title: "Missing date or time",
        description: "Choose both a new date and time before sending the adjustment.",
        variant: "destructive",
      });
      return;
    }

    const scheduledStart = combineDateAndTime(adjustedDate, adjustedTime);
    if (!scheduledStart) {
      toast({
        title: "Invalid date or time",
        description: "Choose a valid date and time for the new session.",
        variant: "destructive",
      });
      return;
    }

    const parsedStart = new Date(scheduledStart);
    if (Number.isNaN(parsedStart.getTime())) {
      toast({
        title: "Invalid date",
        description: "Choose a valid date and time for the new session.",
        variant: "destructive",
      });
      return;
    }

    const day = parsedStart.getDay();
    if (day < 1 || day > 6) {
      toast({
        title: "Invalid day",
        description: "Session dates must fall between Monday and Saturday.",
        variant: "destructive",
      });
      return;
    }

    if (parsedStart.getTime() <= Date.now()) {
      toast({
        title: "Invalid date",
        description: "Rescheduled sessions must be in the future.",
        variant: "destructive",
      });
      return;
    }

    setAdjustingSessionId(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/parent/training-sessions/respond`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          sessionId,
          action: "reschedule",
          scheduledStart,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to adjust session");
      }

      toast({
        title: "Session Updated",
        description: "The new time was sent back to the Specialist for confirmation.",
      });

      setAdjustedDate(undefined);
      setAdjustedTime("15:00");
      setAdjustingSessionId(null);
      setEditingSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust session.",
        variant: "destructive",
      });
      setAdjustingSessionId(null);
    }
  };

  const handleCancelSession = async (sessionId: string, reasonCodes: string[], reasonNote: string | null) => {
    setCancellingSessionId(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/parent/training-sessions/respond`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          sessionId,
          action: "cancel",
          reasonCodes,
          reasonNote: buildTrainingSessionCancellationNote(
            "Parent",
            PARENT_TRAINING_SESSION_CANCELLATION_REASONS,
            reasonCodes,
            reasonNote,
          ),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to cancel session");
      }

      const cancellationDisposition = payload?.cancellation?.disposition;
      toast({
        title: "Session Cancelled",
        description:
          cancellationDisposition === "replacement_required"
            ? "The session is cancelled and still needs a replacement time."
            : cancellationDisposition === "closed_consumed"
              ? "The session is cancelled and closed under the cancellation policy. No replacement is created automatically."
              : "The session is cancelled. Replacement eligibility needs operational review.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/parent/training-sessions"] });
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to cancel session.");
    } finally {
      setCancellingSessionId(null);
    }
  };

  const sessions = data?.sessions || [];
  const schedulingEnabled = data?.sessionSchedulingEnabled ?? true;
  const paymentRequired = data?.paymentRequired === true;
  const quotaRemaining = Number(data?.monthlyQuota?.sessions_remaining ?? -1);
  const quotaTotal = Number(data?.monthlyQuota?.session_quota ?? 0);
  const renewalAmount = Number(data?.monthlyQuota?.package_amount_zar ?? quotaTotal * Number(data?.monthlyQuota?.session_price ?? 200));
  const quotaExhausted = data?.monthlyQuota != null && quotaRemaining <= 0;
  const renewalBlocked = paymentRequired || quotaExhausted;
  const sandboxPaymentRequired = data?.operationalMode === "sandbox" && paymentRequired;
  const trainingModeScheduling = ["training", "sandbox"].includes(String(data?.operationalMode || ""));
  const scheduleWeekDescription = trainingModeScheduling
    ? "Choose two Monday-to-Saturday training session times in the same week. Your Specialist must confirm both dates before Response Integrity locks the sessions into the training flow."
    : "Choose two Monday-to-Saturday training session times in the same week. Your Specialist must confirm both dates before Response Integrity creates the Meet links.";
  const actionableSessions = sessions.filter(
    (session) => !["completed", "cancelled", "flagged"].includes(String(session.status || "")),
  );
  const futureCancelledSessions = sessions.filter((session) => {
    if (String(session.status || "") !== "cancelled") return false;
    const scheduledTime = new Date(session.scheduled_time).getTime();
    return Number.isFinite(scheduledTime) && scheduledTime >= Date.now();
  });
  const replacementRequiredCancelledSessions = futureCancelledSessions.filter(
    (session) => session.cancellation?.disposition === "replacement_required",
  );
  const visibleSessions = [...actionableSessions, ...futureCancelledSessions].sort(
    (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime(),
  );
  const canScheduleNewWeek =
    schedulingEnabled &&
    actionableSessions.length === 0 &&
    replacementRequiredCancelledSessions.length === 0 &&
    !renewalBlocked;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-3xl font-bold">Sessions</h1>
      </div>

      {trainingModeScheduling ? (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <p className="text-base font-semibold text-foreground">Training mode scheduling is active</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your assigned Specialist is currently in training mode. You should still schedule and confirm sessions here, but the lesson will run inside the training flow instead of depending on Google Meet or the normal live-session window.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:gap-6">
        {renewalBlocked ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 sm:p-6 space-y-3">
            <div>
              <h2 className="text-base sm:text-xl font-semibold text-rose-700">
                {paymentRequired ? "Monthly Payment Required" : "Monthly Quota Exhausted"}
              </h2>
              <p className="text-sm text-rose-600 mt-1">
                {sandboxPaymentRequired
                  ? "This Sandbox family has not activated its current package yet. Complete the PayFast Sandbox checkout to unlock scheduling. No real money is charged."
                  : paymentRequired
                    ? "Training session booking is disabled until the monthly renewal is completed."
                    : `All ${quotaTotal || "package"} sessions for this month have been used. Renew now to unlock the next ${quotaTotal || "monthly"} package.`}
              </p>
            </div>
            <Button
              onClick={sandboxPaymentRequired ? handleSandboxPackagePayment : () => navigate("/client/parent/gateway")}
              disabled={sandboxPaymentRequired && isPreparingSandboxPayment}
              className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white"
            >
              {sandboxPaymentRequired
                ? isPreparingSandboxPayment
                  ? "Preparing Sandbox Payment..."
                  : `Complete Sandbox Payment${renewalAmount > 0 ? ` - R${renewalAmount.toLocaleString("en-ZA")}` : ""}`
                : `Go to Renewal${renewalAmount > 0 ? ` - R${renewalAmount.toLocaleString("en-ZA")}` : ""}`}
            </Button>
          </div>
        ) : null}

        {canScheduleNewWeek ? (
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base sm:text-xl font-semibold">Schedule This Week</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {scheduleWeekDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="text-sm font-medium">Session 1</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formatScheduleLabel(slotOneDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={slotOneDate}
                      onSelect={setSlotOneDate}
                      disabled={(date) => !isSelectableSessionDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input type="time" value={slotOneTime} onChange={(e) => setSlotOneTime(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {slotOneDate ? `${formatScheduleLabel(slotOneDate)} at ${slotOneTime}` : "Pick a Monday-Saturday date and time."}
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="text-sm font-medium">Session 2</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formatScheduleLabel(slotTwoDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={slotTwoDate}
                      onSelect={setSlotTwoDate}
                      disabled={(date) => !isSelectableSessionDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input type="time" value={slotTwoTime} onChange={(e) => setSlotTwoTime(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {slotTwoDate ? `${formatScheduleLabel(slotTwoDate)} at ${slotTwoTime}` : "Pick a Monday-Saturday date and time."}
                </p>
              </div>
            </div>

            <Button onClick={handleScheduleWeek} disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Schedule Week"}
            </Button>
          </div>
        ) : renewalBlocked ? null : schedulingEnabled ? (
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-3">
            <div>
              <h2 className="text-base sm:text-xl font-semibold">Schedule This Week</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Weekly scheduling is already in progress for this student. Confirm, adjust, or replace the current session times below before proposing a new week.
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-semibold mb-3 sm:mb-4">Upcoming Sessions</h2>
          {sessionsLoading ? (
            <p className="text-sm sm:text-base text-muted-foreground">Loading sessions...</p>
          ) : visibleSessions.length === 0 ? (
            <p className="text-sm sm:text-base text-muted-foreground">No sessions scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {visibleSessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Response Integrity Training Session</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSessionDateTime(session.scheduled_time)}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {String(session.status || "").replaceAll("_", " ")}
                    </span>
                  </div>

                  {session.status === "cancelled" ? (
                    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-900">Session cancelled</p>
                      {session.cancellation?.reasonNote ? (
                        <p className="text-xs text-amber-800">{session.cancellation.reasonNote}</p>
                      ) : null}
                      {session.cancellation?.disposition === "replacement_required" ? (
                        <>
                          <p className="text-sm text-amber-800">
                            This cancellation keeps the delivery obligation open. Choose a replacement time so the weekly plan can be restored.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustmentEditor(session)}
                            disabled={adjustingSessionId === session.id}
                          >
                            {editingSessionId === session.id ? "Hide reschedule" : "Reschedule Session"}
                          </Button>
                          {editingSessionId === session.id ? (
                            <div className="rounded-md border border-amber-200 bg-white p-3 space-y-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal bg-white">
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    {formatScheduleLabel(adjustedDate)}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={adjustedDate}
                                    onSelect={setAdjustedDate}
                                    disabled={(date) => !isSelectableSessionDate(date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <Input
                                type="time"
                                value={adjustedTime}
                                onChange={(e) => setAdjustedTime(e.target.value)}
                                className="bg-white"
                              />
                              <p className="text-xs text-muted-foreground">
                                {adjustedDate ? `${formatScheduleLabel(adjustedDate)} at ${adjustedTime}` : "Pick a Monday-Saturday date and time."}
                              </p>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleAdjustSession(session.id)}
                                  disabled={adjustingSessionId === session.id}
                                >
                                  {adjustingSessionId === session.id ? "Sending..." : "Send Replacement Time"}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : session.cancellation?.disposition === "closed_consumed" ? (
                        <p className="text-sm text-amber-800">
                          This cancellation is closed under the cancellation policy and the package credit was consumed. No replacement is created automatically.
                        </p>
                      ) : (
                        <p className="text-sm text-amber-800">
                          The cancellation is recorded, but replacement eligibility needs operational review before another time can be created.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {session.status === "pending_tutor_confirmation" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-blue-700">
                        Waiting for Specialist confirmation. If one of the proposed times is wrong, adjust or cancel it now before your Specialist confirms.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCancelSessionTarget(session)}
                          disabled={cancellingSessionId === session.id}
                        >
                          {cancellingSessionId === session.id ? "Cancelling..." : "Cancel Session"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustmentEditor(session)}
                          disabled={adjustingSessionId === session.id}
                        >
                          {editingSessionId === session.id ? "Hide adjustment" : "Adjust Time"}
                        </Button>
                      </div>
                      {editingSessionId === session.id ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="w-full justify-start text-left font-normal bg-white">
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {formatScheduleLabel(adjustedDate)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={adjustedDate}
                                onSelect={setAdjustedDate}
                                disabled={(date) => !isSelectableSessionDate(date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={adjustedTime}
                            onChange={(e) => setAdjustedTime(e.target.value)}
                            className="bg-white"
                          />
                          <p className="text-xs text-muted-foreground">
                            {adjustedDate ? `${formatScheduleLabel(adjustedDate)} at ${adjustedTime}` : "Pick a Monday-Saturday date and time."}
                          </p>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdjustSession(session.id)}
                              disabled={adjustingSessionId === session.id}
                            >
                              {adjustingSessionId === session.id ? "Sending..." : "Send New Time"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {session.status === "pending_parent_confirmation" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-700">
                        Waiting for your confirmation.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConfirmSession(session.id)}
                          disabled={confirmingSessionId === session.id || adjustingSessionId === session.id}
                        >
                          {confirmingSessionId === session.id ? "Confirming..." : "Confirm Session"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustmentEditor(session)}
                          disabled={adjustingSessionId === session.id}
                        >
                          Adjust Time
                        </Button>
                      </div>
                      {editingSessionId === session.id ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="w-full justify-start text-left font-normal bg-white">
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {formatScheduleLabel(adjustedDate)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={adjustedDate}
                                onSelect={setAdjustedDate}
                                disabled={(date) => !isSelectableSessionDate(date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={adjustedTime}
                            onChange={(e) => setAdjustedTime(e.target.value)}
                            className="bg-white"
                          />
                          <p className="text-xs text-muted-foreground">
                            {adjustedDate ? `${formatScheduleLabel(adjustedDate)} at ${adjustedTime}` : "Pick a Monday-Saturday date and time."}
                          </p>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdjustSession(session.id)}
                              disabled={adjustingSessionId === session.id}
                            >
                              {adjustingSessionId === session.id ? "Sending..." : "Send New Time"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {["confirmed", "ready", "live"].includes(String(session.status || "")) ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-green-700">Session confirmed.</p>
                          {trainingModeScheduling ? (
                            <p className="text-sm text-muted-foreground">
                              Training mode runs this lesson inside the platform without depending on Google Meet.
                            </p>
                          ) : session.google_meet_url ? (
                            <a
                              href={session.google_meet_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-sm text-primary underline underline-offset-2"
                            >
                              Join Google Meet
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Meet link pending calendar sync.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="whitespace-nowrap"
                            onClick={() => setCancelSessionTarget(session)}
                            disabled={cancellingSessionId === session.id}
                          >
                            {cancellingSessionId === session.id ? "Cancelling..." : "Cancel Session"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustmentEditor(session)}
                            disabled={adjustingSessionId === session.id}
                          >
                            {editingSessionId === session.id ? "Hide reschedule" : "Request New Time"}
                          </Button>
                        </div>
                      </div>
                      {editingSessionId === session.id ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="w-full justify-start text-left font-normal bg-white">
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {formatScheduleLabel(adjustedDate)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={adjustedDate}
                                onSelect={setAdjustedDate}
                                disabled={(date) => !isSelectableSessionDate(date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={adjustedTime}
                            onChange={(e) => setAdjustedTime(e.target.value)}
                            className="bg-white"
                          />
                          <p className="text-xs text-muted-foreground">
                            {adjustedDate ? `${formatScheduleLabel(adjustedDate)} at ${adjustedTime}` : "Pick a Monday-Saturday date and time."}
                          </p>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdjustSession(session.id)}
                              disabled={adjustingSessionId === session.id}
                            >
                              {adjustingSessionId === session.id ? "Sending..." : "Send New Time"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <TrainingSessionCancellationDialog
        open={!!cancelSessionTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCancelSessionTarget(null);
          }
        }}
        title="Cancel Confirmed Session"
        description={
          cancelSessionTarget
            ? `You are cancelling the confirmed lesson on ${formatSessionDateTime(cancelSessionTarget.scheduled_time)}. Select the reason so the Specialist and billing trail stay accurate.`
            : "Select the cancellation reason so the Specialist and billing trail stay accurate."
        }
        confirmLabel="Cancel Session"
        isSubmitting={!!cancellingSessionId}
        reasonOptions={PARENT_TRAINING_SESSION_CANCELLATION_REASONS}
        notePlaceholder="Add any extra context your Specialist should know about this cancellation."
        onConfirm={async ({ reasonCodes, reasonNote }) => {
          if (!cancelSessionTarget) {
            throw new Error("No confirmed session selected.");
          }
          await handleCancelSession(cancelSessionTarget.id, reasonCodes, reasonNote);
        }}
      />
    </div>
  );
}
