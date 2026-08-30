import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Clock, Video } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TutorWeeklyScheduleSession = {
  id: string;
  scheduled_time: string;
  scheduled_end?: string | null;
  timezone?: string | null;
  status: string;
  type: string;
  workflow_stage?: string | null;
  parent_confirmed?: boolean;
  tutor_confirmed?: boolean;
  google_meet_url?: string | null;
  student?: {
    id: string;
    name: string;
    grade?: string | null;
  } | null;
};

type TutorWeeklyScheduleResponse = {
  weekStart: string;
  weekEnd: string;
  operationalMode?: "training" | "trial" | "certified_live";
  sessionSchedulingEnabled?: boolean;
  sessions: TutorWeeklyScheduleSession[];
};

type SessionLogResponse = {
  session: {
    id: string;
    scheduled_time: string;
    status: string;
    type: string;
    student_id?: string | null;
  };
  trainingRuns: Array<{
    id: string;
    topic_count?: number | null;
    started_at?: string | null;
    submitted_at?: string | null;
    status?: string | null;
  }>;
  sessionLogs: Array<{
    id: string;
    date: string;
    deterministicLog?: {
      topicFocus?: string | null;
      whatWasTrained?: string | null;
      behaviorSummary?: string | null;
      performanceResult?: string | null;
      stateMovement?: string | null;
      whatThisMeans?: string | null;
      nextMove?: string | null;
      summaryText?: string | null;
    } | null;
  }>;
};

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-3 text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground whitespace-pre-wrap">{String(value || "").trim() || "Not recorded"}</p>
    </div>
  );
}

function statusLabel(status?: string | null) {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "pending_parent_confirmation") return "Awaiting Parent";
  if (raw === "pending_tutor_confirmation") return "Awaiting Tutor";
  if (raw === "confirmed") return "Confirmed";
  if (raw === "ready") return "Ready";
  if (raw === "live") return "Live";
  if (raw === "completed") return "Completed";
  return raw ? raw.replace(/_/g, " ") : "Scheduled";
}

function sessionLabel(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "intro" ? "Intro Session" : "Training Session";
}

function formatTutorGradeLabel(grade?: string | null) {
  const trimmed = String(grade || "").trim();
  return /^grade\b/i.test(trimmed) ? trimmed : trimmed ? `Grade ${trimmed}` : trimmed;
}

export default function TutorSessions() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedLogSession, setSelectedLogSession] = useState<TutorWeeklyScheduleSession | null>(null);
  const { data: podData } = useQuery<any>({
    queryKey: ["/api/tutor/pod"],
  });

  const weekKey = format(weekStart, "yyyy-MM-dd");
  const { data, isLoading } = useQuery<TutorWeeklyScheduleResponse>({
    queryKey: ["/api/tutor/weekly-schedule", weekKey],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tutor/weekly-schedule?weekStart=${weekKey}`);
      return response.json();
    },
    refetchInterval: 15000,
  });

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const sessions = (data?.sessions || []).filter((session) => {
        const scheduled = new Date(session.scheduled_time);
        return (
          scheduled.getFullYear() === date.getFullYear() &&
          scheduled.getMonth() === date.getMonth() &&
          scheduled.getDate() === date.getDate()
        );
      });

      return { date, sessions };
    })
  ), [data?.sessions, weekStart]);

  const weeklyStats = useMemo(() => {
    const sessions = data?.sessions || [];
    return {
      total: sessions.length,
      confirmed: sessions.filter((session) => ["confirmed", "ready", "live"].includes(String(session.status || "").toLowerCase())).length,
      awaiting: sessions.filter((session) => ["pending_parent_confirmation", "pending_tutor_confirmation"].includes(String(session.status || "").toLowerCase())).length,
    };
  }, [data?.sessions]);

  const operationalMode = data?.operationalMode || podData?.assignment?.operationalMode || "training";
  const schedulingEnabled = data?.sessionSchedulingEnabled ?? ["trial", "certified_live"].includes(operationalMode);

  const { data: sessionLog, isLoading: sessionLogLoading } = useQuery<SessionLogResponse>({
    queryKey: ["/api/tutor/scheduled-sessions/log", selectedLogSession?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tutor/scheduled-sessions/${selectedLogSession?.id}/log`);
      return response.json();
    },
    enabled: !!selectedLogSession?.id,
    retry: false,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {operationalMode === "trial"
                ? "Trial is live validation. Your schedule remains active for your two governed family placements."
                : operationalMode === "training"
                ? "Training mode is active. Live scheduling and Google Meet lesson windows are hidden for you."
                : "Weekly tutor schedule from the live Response Integrity planning table."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart((current) => addDays(current, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="rounded-lg border px-4 py-2 text-sm font-medium min-w-[220px] text-center">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </div>
            <Button variant="outline" size="icon" onClick={() => setWeekStart((current) => addDays(current, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!schedulingEnabled ? (
          <Card className="p-5 sm:p-6 border">
            <p className="text-sm font-medium text-foreground">Live session scheduling is disabled</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your current preparation state does not carry live family scheduling responsibility. Run drills from the protected training or sandbox workflow.
            </p>
          </Card>
        ) : null}

        {schedulingEnabled && isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : schedulingEnabled ? (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <Card className="p-4 sm:p-6 border">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-2xl font-bold">{weeklyStats.total}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">This Week</p>
                </div>
              </Card>
              <Card className="p-4 sm:p-6 border">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-2xl font-bold">{weeklyStats.confirmed}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Confirmed / Ready</p>
                </div>
              </Card>
              <Card className="p-4 sm:p-6 border">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-2xl font-bold">{weeklyStats.awaiting}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Awaiting Response</p>
                </div>
              </Card>
            </div>

            <Card className="p-4 sm:p-6 border">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Week View</h2>
              </div>

              <div className="grid gap-4">
                {weekDays.map(({ date, sessions }) => (
                  <div key={date.toISOString()} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{format(date, "EEEE")}</p>
                        <p className="text-sm text-muted-foreground">{format(date, "MMM d, yyyy")}</p>
                      </div>
                      <Badge variant="outline">{sessions.length} scheduled</Badge>
                    </div>

                    {sessions.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        No sessions scheduled for this day.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sessions.map((session) => (
                          <div key={session.id} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {session.student?.name || "Unlinked student"} • {sessionLabel(session.type)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(session.scheduled_time), "h:mm a")}
                                  {session.student?.grade ? ` • ${formatTutorGradeLabel(session.student.grade)}` : ""}
                                </p>
                              </div>
                              <Badge variant="outline">{statusLabel(session.status)}</Badge>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {session.parent_confirmed && session.tutor_confirmed ? "Fully confirmed" : "Needs confirmation"}
                              </Badge>
                              <Badge variant="secondary">{session.timezone || "Africa/Johannesburg"}</Badge>
                            </div>

                            {["confirmed", "ready", "live"].includes(String(session.status || "").toLowerCase()) && session.google_meet_url ? (
                              <Button asChild size="sm" variant="outline" className="gap-2">
                                <a href={session.google_meet_url} target="_blank" rel="noreferrer">
                                  <Video className="w-4 h-4" />
                                  Open Meet
                                </a>
                              </Button>
                            ) : null}

                            {String(session.status || "").toLowerCase() === "completed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedLogSession(session)}
                              >
                                View Log
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        ) : null}
      </div>

      <Dialog open={!!selectedLogSession} onOpenChange={(open) => !open && setSelectedLogSession(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Session Log
              {selectedLogSession?.student?.name ? ` • ${selectedLogSession.student.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          {sessionLogLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !sessionLog ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No recorded drill log was found for this scheduled session.
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="p-4 border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{sessionLabel(sessionLog.session.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(sessionLog.session.scheduled_time), "EEEE, MMM d, yyyy • h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline">{statusLabel(sessionLog.session.status)}</Badge>
                </div>
              </Card>

              {sessionLog.sessionLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No drill rows were recorded for this lesson.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionLog.sessionLogs.map((log) => (
                    <Card key={log.id} className="p-4 border space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">Session Log</p>
                          <p className="text-sm text-muted-foreground">
                            {log.date ? format(new Date(log.date), "MMM d, yyyy • h:mm a") : "Submission time unavailable"}
                          </p>
                        </div>
                      </div>

                      <FieldRow label="Session Summary" value={log.deterministicLog?.summaryText || log.deterministicLog?.topicFocus} />
                      <FieldRow label="What Was Trained" value={log.deterministicLog?.whatWasTrained} />
                      <FieldRow label="Observed Response" value={log.deterministicLog?.behaviorSummary} />
                      <FieldRow label="Performance Result" value={log.deterministicLog?.performanceResult} />
                      <FieldRow label="State Update" value={log.deterministicLog?.stateMovement} />
                      <FieldRow label="What This Means" value={log.deterministicLog?.whatThisMeans} />
                      <FieldRow label="Next Drill" value={log.deterministicLog?.nextMove} />
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
