import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, LockKeyhole, WalletCards } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Reflection } from "@shared/schema";
import { format, startOfWeek } from "date-fns";

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatSpecialistMode(value: string) {
  if (value === "certified_live") return "Certified Live";
  if (value === "sandbox") return "Sandbox";
  if (value === "trial") return "Trial";
  if (value === "watchlist") return "Watchlist";
  if (value === "suspended") return "Suspended";
  if (value === "applicant") return "Applicant";
  return "Training";
}

export default function TutorGrowth() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [reflectionText, setReflectionText] = useState("");
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInData, setCheckInData] = useState({
    sessionsSummary: "",
    wins: "",
    challenges: "",
    helpNeeded: "",
    nextWeekGoals: "",
  });

  const {
    data: reflections,
    isLoading,
    error,
  } = useQuery<Reflection[]>({
    queryKey: ["/api/tutor/reflections"],
    enabled: isAuthenticated && !authLoading,
  });

  const {
    data: podAssignment,
  } = useQuery<any>({
    queryKey: ["/api/tutor/pod"],
    enabled: isAuthenticated && !authLoading,
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

  const createReflection = useMutation({
    mutationFn: async (data: { reflectionText: string }) => {
      await apiRequest("POST", "/api/tutor/reflections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/reflections"] });
      setReflectionText("");
      toast({
        title: "Reflection saved",
        description: "Your reflection has been recorded successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save reflection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitWeeklyCheckIn = useMutation({
    mutationFn: async () => {
      const podId = podAssignment?.assignment?.podId;
      if (!podId) throw new Error("Pod ID not found");

      await apiRequest("POST", "/api/tutor/weekly-check-in", {
        podId,
        weekStartDate: startOfWeek(new Date()).toISOString(),
        ...checkInData,
      });
    },
    onSuccess: () => {
      setCheckInDialogOpen(false);
      setCheckInData({
        sessionsSummary: "",
        wins: "",
        challenges: "",
        helpNeeded: "",
        nextWeekGoals: "",
      });
      toast({
        title: "Check-in submitted",
        description: "Your weekly check-in has been recorded and sent to your TD.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit check-in. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please write a reflection before submitting.",
        variant: "destructive",
      });
      return;
    }
    createReflection.mutate({
      reflectionText: reflectionText.trim(),
    });
  };

  const operationalMode = String(
    podAssignment?.assignment?.operationalMode ??
      podAssignment?.assignment?.operational_mode ??
      "training",
  )
    .trim()
    .toLowerCase();

  const isSandboxMode = operationalMode === "sandbox";
  const isCertifiedLive = operationalMode === "certified_live";
  const canViewEarnings = isSandboxMode || isCertifiedLive;

  const earningsRows = ((podAssignment?.students || []) as any[])
    .map((student) => {
      const quota = student?.parentInfo?.monthlyQuota || student?.monthlyQuota || null;
      if (!quota) return null;

      return {
        id: String(student?.id || student?.name || Math.random()),
        studentName: String(student?.name || "Student"),
        earned: Number(quota?.specialist_earned_amount ?? quota?.specialistEarnedAmount ?? 0),
        payable: Number(quota?.specialist_payable_amount ?? quota?.specialistPayableAmount ?? 0),
        payoutStatus: String(quota?.payout_status ?? quota?.payoutStatus ?? "accruing"),
        sessionsUsed: Number(quota?.sessions_used ?? quota?.sessionsUsed ?? 0),
        sessionQuota: Number(quota?.session_quota ?? quota?.sessionQuota ?? 0),
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      studentName: string;
      earned: number;
      payable: number;
      payoutStatus: string;
      sessionsUsed: number;
      sessionQuota: number;
    }>;

  const earnedTotal = earningsRows.reduce((sum, row) => sum + row.earned, 0);
  const payableTotal = earningsRows.reduce((sum, row) => sum + row.payable, 0);

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Growth</h1>
          <p className="text-muted-foreground">Review your reflections and your progression into paid live delivery.</p>
        </div>

        <Tabs defaultValue="reflections" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reflections">Reflections</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="reflections" className="space-y-6">

        {/* Stats */}
        <Card className="border p-4 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:text-xs">Reflections Logged</p>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">{reflections?.length || 0}</p>
        </Card>

        {/* New Reflection Form */}
        <Card className="p-6 border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reflection" className="text-base font-semibold">
                New Reflection
              </Label>
              <Textarea
                id="reflection"
                placeholder="What went well today? What did you learn? What are you proud of?"
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                className="min-h-32 resize-none"
                data-testid="input-reflection-text"
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={createReflection.isPending}
              data-testid="button-submit-reflection"
            >
              <Plus className="w-4 h-4" />
              {createReflection.isPending ? "Saving..." : "Save Reflection"}
            </Button>
          </form>
        </Card>

        {/* Reflections History */}
        <Card className="border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Reflection History</h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {!reflections || reflections.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No reflections yet</p>
                <p className="text-sm text-muted-foreground/80">Start documenting your growth journey today</p>
              </div>
            ) : (
              reflections.map((reflection) => (
                <div
                  key={reflection.id}
                  className="p-6 space-y-3"
                  data-testid={`reflection-${reflection.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-2">
                        {format(new Date(reflection.date), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                      <p className="leading-relaxed">{reflection.reflectionText}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Weekly Check-In Section */}
        <Card className="p-6 border bg-slate-50/30 border-slate-200">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Weekly Check-In
              </h2>
              <p className="text-sm text-muted-foreground">
                Submit your weekly update to your Territory Director
              </p>
            </div>
          </div>

          <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" variant="default">
                <Plus className="w-4 h-4" />
                Start Weekly Check-In
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Weekly Check-In for Week of {format(startOfWeek(new Date()), "MMMM d, yyyy")}</DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitWeeklyCheckIn.mutate();
                }}
                className="space-y-6"
              >
                {/* Sessions Summary */}
                <div className="space-y-2">
                  <Label htmlFor="sessions-summary" className="font-semibold">
                    How were your sessions this week?
                  </Label>
                  <Textarea
                    id="sessions-summary"
                    placeholder="Describe how your sessions went, energy levels, student engagement, etc."
                    value={checkInData.sessionsSummary}
                    onChange={(e) =>
                      setCheckInData({ ...checkInData, sessionsSummary: e.target.value })
                    }
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Wins */}
                <div className="space-y-2">
                  <Label htmlFor="wins" className="font-semibold">
+                    Wins this week
                  </Label>
                  <Textarea
                    id="wins"
                    placeholder="What went well? What are you proud of?"
                    value={checkInData.wins}
                    onChange={(e) => setCheckInData({ ...checkInData, wins: e.target.value })}
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Challenges */}
                <div className="space-y-2">
                  <Label htmlFor="challenges" className="font-semibold">
                    Challenges faced
                  </Label>
                  <Textarea
                    id="challenges"
                    placeholder="What challenges did you face this week?"
                    value={checkInData.challenges}
                    onChange={(e) =>
                      setCheckInData({ ...checkInData, challenges: e.target.value })
                    }
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Help Needed */}
                <div className="space-y-2">
                  <Label htmlFor="help-needed" className="font-semibold">
                    Help needed or questions (Optional)
                  </Label>
                  <Textarea
                    id="help-needed"
                    placeholder="Is there anything you need help with or any questions for your TD?"
                    value={checkInData.helpNeeded}
                    onChange={(e) =>
                      setCheckInData({ ...checkInData, helpNeeded: e.target.value })
                    }
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Next Week Goals */}
                <div className="space-y-2">
                  <Label htmlFor="next-week-goals" className="font-semibold">
                    Goals for next week
                  </Label>
                  <Textarea
                    id="next-week-goals"
                    placeholder="What are your goals for next week?"
                    value={checkInData.nextWeekGoals}
                    onChange={(e) =>
                      setCheckInData({ ...checkInData, nextWeekGoals: e.target.value })
                    }
                    className="min-h-24 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitWeeklyCheckIn.isPending}
                >
                  {submitWeeklyCheckIn.isPending ? "Submitting..." : "Submit Check-In"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </Card>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            {!canViewEarnings ? (
              <Card className="border p-6 sm:p-8">
                <div className="mx-auto max-w-2xl py-8 text-center">
                  <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-primary/20 bg-primary/5">
                    <LockKeyhole className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Certified Live
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                    Earnings unlock at Certified Live
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    This feature is available only for Certified Live Specialists. Your current mode is{" "}
                    <span className="font-medium text-foreground">{formatSpecialistMode(operationalMode)}</span>.
                    Training and Trial remain unpaid stages of the Specialist pathway.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <Card className="border p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <WalletCards className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Earnings</h2>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {isSandboxMode
                          ? "Sandbox preview only. Sandbox activity does not create payable Specialist earnings."
                          : "Earnings reflect evidence-backed qualifying delivery. Payout is released according to package-completion rules."}
                      </p>
                    </div>
                    {isSandboxMode ? (
                      <span className="w-fit rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                        Sandbox preview
                      </span>
                    ) : null}
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border p-5 sm:p-6">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:text-xs">Earned</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{formatZar(earnedTotal)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Evidence-backed qualifying delivery recorded so far.</p>
                  </Card>
                  <Card className="border p-5 sm:p-6">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:text-xs">Payable</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{formatZar(payableTotal)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Amount currently released by package-completion rules.</p>
                  </Card>
                </div>

                <Card className="border">
                  <div className="border-b p-5 sm:p-6">
                    <h3 className="text-base font-semibold">Earnings by student</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Package progress and Specialist earning state.</p>
                  </div>

                  {earningsRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No package earning records are available yet.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {earningsRows.map((row) => (
                        <div key={row.id} className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center sm:p-6">
                          <div>
                            <p className="font-medium">{row.studentName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Package progress {row.sessionsUsed}/{row.sessionQuota || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Earned</p>
                            <p className="mt-1 font-semibold tabular-nums">{formatZar(row.earned)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Payable</p>
                            <p className="mt-1 font-semibold tabular-nums">{formatZar(row.payable)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                            <p className="mt-1 text-sm font-medium capitalize">{row.payoutStatus.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
