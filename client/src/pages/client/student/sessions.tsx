import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { CalendarDays, Clock, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

type StudentSession = {
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
};

type StudentSessionsResponse = {
  sessions: StudentSession[];
  operationalMode?: "training" | "trial" | "certified_live";
  sessionSchedulingEnabled?: boolean;
};

function getWeekRange(now = new Date()) {
  const start = new Date(now);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatSessionDateTime(value?: string | null) {
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
}

function formatWeekLabel(start: Date, end: Date) {
  return `${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(start)} - ${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end)}`;
}

function statusLabel(session: StudentSession) {
  const raw = String(session.status || "").trim().toLowerCase();
  if (raw === "pending_parent_confirmation") return "Awaiting Parent";
  if (raw === "pending_tutor_confirmation") return "Awaiting Tutor";
  if (raw === "confirmed") return "Confirmed";
  if (raw === "ready") return "Ready";
  if (raw === "live") return "Live";
  if (raw === "completed") return "Completed";
  return raw ? raw.replace(/_/g, " ") : "Scheduled";
}

function canJoinMeet(session: StudentSession) {
  const raw = String(session.status || "").trim().toLowerCase();
  return ["confirmed", "ready", "live"].includes(raw);
}

export default function StudentSessions() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<StudentSessionsResponse>({
    queryKey: ["/api/student/sessions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchInterval: 15000,
  });

  const sessions = data?.sessions || [];
  const schedulingEnabled = data?.sessionSchedulingEnabled ?? true;
  const now = new Date();
  const { start, end } = getWeekRange(now);

  const thisWeekSessions = sessions.filter((session) => {
    const date = new Date(session.scheduled_time);
    return date >= start && date <= end;
  });
  const nextSession =
    sessions
      .filter((session) => new Date(session.scheduled_time).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())[0] || null;

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const daySessions = thisWeekSessions
      .filter((session) => isSameDay(new Date(session.scheduled_time), date))
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

    return {
      date,
      sessions: daySessions,
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Sessions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {schedulingEnabled
            ? "Your full Response Integrity schedule for the current week."
            : "Live lesson scheduling is currently disabled while your tutor is in Response Integrity training mode."}
        </p>
      </div>

      {!schedulingEnabled ? (
        <Card className="border-primary/20 bg-background shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium tracking-[-0.01em]">Training Mode Active</CardTitle>
            <CardDescription>Booked Google Meet lesson windows are currently turned off.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Your tutor is currently in training mode, so sessions run directly inside the platform instead of through scheduled Meet links.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium tracking-[-0.01em]">Week Schedule</CardTitle>
          <CardDescription>{formatWeekLabel(start, end)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            {weekDays.map(({ date, sessions: daySessions }) => (
              <div key={date.toISOString()} className="rounded-xl border border-primary/20 bg-muted/20 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(date)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-background/80">
                    {daySessions.length} scheduled
                  </Badge>
                </div>

                {daySessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No session scheduled for this day.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {daySessions.map((session) => (
                      <div key={session.id} className="rounded-lg border border-primary/15 bg-background px-3 py-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {session.type === "intro" ? "Intro Session" : "Training Session"}
                            </p>
                            <p className="text-sm text-muted-foreground">{formatSessionDateTime(session.scheduled_time)}</p>
                          </div>
                          <Badge variant="outline" className="border-primary/30 bg-background/80">
                            {statusLabel(session)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {session.timezone || "Africa/Johannesburg"}
                          </Badge>
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.parent_confirmed && session.tutor_confirmed ? "Fully confirmed" : "Awaiting final confirmation"}
                          </Badge>
                        </div>

                        {session.google_meet_url && canJoinMeet(session) ? (
                          <Button asChild size="sm" className="gap-2">
                            <a href={session.google_meet_url} target="_blank" rel="noreferrer">
                              <Video className="w-4 h-4" />
                              Join Meet
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium tracking-[-0.01em]">Next Session</CardTitle>
          <CardDescription>The next Response Integrity session currently on your calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!nextSession ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No upcoming session is scheduled yet.
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-muted/20 px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {nextSession.type === "intro" ? "Intro Session" : "Training Session"}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatSessionDateTime(nextSession.scheduled_time)}</p>
                </div>
                <Badge variant="outline" className="border-primary/30 bg-background/80">
                  {statusLabel(nextSession)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {nextSession.timezone || "Africa/Johannesburg"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {nextSession.parent_confirmed && nextSession.tutor_confirmed ? "Fully confirmed" : "Awaiting final confirmation"}
                </Badge>
              </div>

              {nextSession.google_meet_url && canJoinMeet(nextSession) ? (
                <Button asChild size="sm" className="gap-2">
                  <a href={nextSession.google_meet_url} target="_blank" rel="noreferrer">
                    <Video className="w-4 h-4" />
                    Join Meet
                  </a>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
