import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns/format";
import { getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, FileText } from "lucide-react";
import {
  summarizeSnapshotObservedResponse,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";

function getSessionDayLabel(value: string): string {
  const sessionDate = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfSessionDay = new Date(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate()
  );
  const diffMs = startOfToday.getTime() - startOfSessionDay.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays >= 2 && diffDays <= 4) {
    return sessionDate.toLocaleDateString("en-US", { weekday: "long" });
  }
  return format(sessionDate, "MMM d, yyyy");
}

function getSessionTimeLabel(value: string): string {
  const sessionDate = new Date(value);
  if (Number.isNaN(sessionDate.getTime())) return "Time unavailable";
  return format(sessionDate, "h:mm a");
}

function formatReportValue(value: any): string {
  if (Array.isArray(value)) {
    const singleCurrentPosition =
      value.length === 1 &&
      value[0] &&
      typeof value[0] === "object" &&
      "state" in value[0] &&
      "position" in value[0];

    const formatted = value
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          if ("topic" in item && "state" in item && "position" in item) {
            return singleCurrentPosition
              ? `${item.state}\n${item.position}`
              : `${item.topic}: ${item.state}\n${item.position}`;
          }
        }
        return String(item).trim();
      })
      .filter(Boolean);
    return formatted.join("\n");
  }

  return String(value || "").trim();
}

interface SessionRecord {
  id: string;
  date: string;
  duration: number;
  autoSummary?: string | null;
  autoSummaryTopic?: string | null;
  deterministicLog?: {
    topicFocus: string;
    whatWasTrained: string;
    behaviorSummary: string;
    performanceResult: string;
    stateMovement: string;
    whatThisMeans: string;
    nextMove: string;
    summaryText: string;
    drillLabel?: string | null;
    score?: number | null;
    stability?: string | null;
    constraint?: string | null;
    practiceAssigned?: string | null;
  } | null;
  responseSnapshot?: ResponseSnapshotV1 | null;
  responseSnapshots?: ResponseSnapshotV1[];
  notes?: string | null;
  vocabularyNotes?: string | null;
  methodNotes?: string | null;
  reasonNotes?: string | null;
  studentResponse?: string | null;
  whatMisunderstood?: string | null;
  correctionHelped?: string | null;
  needsReinforcement?: string | null;
  bossBattlesDone?: string | null;
  practiceProblems?: string | null;
  solutionPurpose?: string | null;
}

interface ReportRecord {
  id: string;
  reportType: "weekly" | "monthly";
  weekNumber?: number | null;
  monthName?: string | null;
  sentAt: string;
  structuredData?: any;
  topicsLearned?: string | null;
  strengths?: string | null;
  areasForGrowth?: string | null;
  nextSteps?: string | null;
  parentFeedback?: string | null;
  parentFeedbackAt?: string | null;
}

interface ReportsCenterData {
  sessions: SessionRecord[];
  reports: ReportRecord[];
}

interface StudentReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-2 md:gap-3 text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground whitespace-pre-wrap">{value.trim()}</p>
    </div>
  );
}

function getTopicFocusDisplay(log: NonNullable<SessionRecord["deterministicLog"]>): string {
  const summaryText = log.summaryText?.trim();
  if (summaryText && /^this session\b/i.test(summaryText)) {
    return summaryText;
  }
  return log.topicFocus;
}

function getResponseSnapshots(session: SessionRecord) {
  return [
    ...(Array.isArray(session.responseSnapshots) ? session.responseSnapshots : []),
    ...(session.responseSnapshot ? [session.responseSnapshot] : []),
  ];
}

function getObservedResponseDisplay(session: SessionRecord) {
  const snapshots = getResponseSnapshots(session);
  const snapshotSummaries = snapshots
    .map((snapshot) => {
      const summary = summarizeSnapshotObservedResponse(snapshot);
      return summary && snapshots.length > 1 ? `${snapshot.source.topic}: ${summary}` : summary;
    })
    .filter(Boolean);

  return snapshotSummaries.length > 0
    ? snapshotSummaries.join("\n")
    : session.deterministicLog?.behaviorSummary;
}

function DeterministicSessionLog({ session }: { session: SessionRecord }) {
  const log = session.deterministicLog;
  if (!log) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-xl border border-primary/15 bg-muted/20 p-3 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Drill</p>
          <p className="mt-1 font-medium">{log.drillLabel || "Session Drill"}</p>
        </Card>
        <Card className="rounded-xl border border-primary/15 bg-muted/20 p-3 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Session Score</p>
          <p className="mt-1 font-medium">{typeof log.score === "number" ? `${log.score}/100` : "Not scored"}</p>
        </Card>
        <Card className="rounded-xl border border-primary/15 bg-muted/20 p-3 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">State</p>
          <p className="mt-1 font-medium">{log.stability || "Unknown"}</p>
        </Card>
      </div>

      <div className="space-y-3 rounded-xl border border-primary/15 bg-background p-4">
        <FieldRow label="Session Summary" value={getTopicFocusDisplay(log)} />
        <FieldRow label="What Was Trained" value={log.whatWasTrained} />
        <FieldRow label="Observed Response" value={getObservedResponseDisplay(session)} />
        <FieldRow label="Performance Result" value={log.performanceResult} />
        <FieldRow label="State Update" value={log.stateMovement} />
        <FieldRow label="What This Means" value={log.whatThisMeans} />
        <FieldRow label="Next Drill" value={log.nextMove} />
        <FieldRow label="Constraint" value={log.constraint} />
      </div>
    </div>
  );
}

function getSessionPreview(session: SessionRecord) {
  if (session.deterministicLog) {
    const log = session.deterministicLog;
    return [log.whatWasTrained, getObservedResponseDisplay(session), log.performanceResult].filter(Boolean).join(" ");
  }
  return "";
}

export default function StudentReportsDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
}: StudentReportsDialogProps) {
  const { data, isLoading, refetch } = useQuery<ReportsCenterData>({
    queryKey: [`/api/tutor/students/${studentId}/reports-center`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open && !!studentId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (open && studentId) {
      void refetch();
    }
  }, [open, studentId]);

  const weeklyReports = useMemo(
    () => (data?.reports || []).filter((r) => r.reportType === "weekly"),
    [data?.reports]
  );

  const monthlyReports = useMemo(
    () => (data?.reports || []).filter((r) => r.reportType === "monthly"),
    [data?.reports]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-primary/15 bg-background p-0 shadow-sm">
        <DialogHeader>
          <div className="border-b border-border/60 px-6 py-5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Reports Center</p>
            <DialogTitle className="mt-2 flex items-center gap-2 text-xl tracking-[-0.01em]">
              <FileText className="w-4 h-4" />
              {studentName} Reports
            </DialogTitle>
            <DialogDescription className="mt-1">
              Review all session logs, two-session updates, and eight-session reports for this student.
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 px-6 py-5">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="space-y-6 px-6 py-5">
            <Tabs defaultValue="session-logs" className="w-full space-y-4">
              <TabsList className="grid w-full grid-cols-3 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
                <TabsTrigger value="session-logs" className="text-xs sm:text-sm py-2 px-2">Session Logs</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs sm:text-sm py-2 px-2">2-Session Reports</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs sm:text-sm py-2 px-2">8-Session Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="session-logs" className="mt-0">
                <Card className="rounded-2xl border border-primary/15 bg-background p-4 md:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Session Logs</h3>
                    <Badge variant="outline">{data?.sessions?.length || 0}</Badge>
                  </div>
                  {!data?.sessions?.length ? (
                    <p className="text-sm text-muted-foreground">No session logs found for this student.</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {data.sessions.map((session) => (
                        <AccordionItem key={session.id} value={`session-${session.id}`}>
                          <AccordionTrigger className="text-left">
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{getSessionDayLabel(session.date)}</span>
                                <span className="text-xs text-muted-foreground">{getSessionTimeLabel(session.date)}</span>
                              </div>
                              {getSessionPreview(session) && (
                                <p className="text-sm text-muted-foreground line-clamp-2 pr-4">{getSessionPreview(session)}</p>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <DeterministicSessionLog session={session} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="weekly" className="mt-0">
                <Card className="rounded-2xl border border-primary/15 bg-background p-4 md:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">2-Session Reports</h3>
                    <Badge variant="outline">{weeklyReports.length}</Badge>
                  </div>
                  {!weeklyReports.length ? (
                    <p className="text-sm text-muted-foreground">No two-session reports created yet. Two completed session groups are required.</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {weeklyReports.map((report) => {
                        const structured = report.structuredData || {};
                        return (
                          <AccordionItem key={report.id} value={`weekly-${report.id}`}>
                            <AccordionTrigger className="text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>
                                  {structured.weekStartDate && structured.weekEndDate
                                    ? `${format(new Date(structured.weekStartDate), "MMM d")} - ${format(new Date(structured.weekEndDate), "MMM d, yyyy")}`
                                    : `Week ${report.weekNumber || "-"}`}
                                </span>
                                <Badge variant="secondary">Sent {format(new Date(report.sentAt), "MMM d")}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3">
                              <FieldRow label="Topics" value={formatReportValue(structured.topicsWorkedOn || report.topicsLearned)} />
                              <FieldRow label="What Changed" value={formatReportValue(structured.whatChanged || report.strengths)} />
                              <FieldRow label="Breakdown Pattern" value={formatReportValue(structured.breakdownPattern || report.areasForGrowth)} />
                              <FieldRow label="What This Means" value={formatReportValue(structured.whatThisMeans)} />
                              <FieldRow label="Next Move" value={formatReportValue(structured.nextMove || report.nextSteps)} />
                              {report.parentFeedback ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900">Parent Feedback</p>
                                  <p className="mt-2 text-sm leading-relaxed text-amber-950">{report.parentFeedback}</p>
                                  {report.parentFeedbackAt ? (
                                    <p className="mt-2 text-xs text-amber-800">Submitted {format(new Date(report.parentFeedbackAt), "MMM d, yyyy")}</p>
                                  ) : null}
                                </div>
                              ) : null}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="monthly" className="mt-0">
                <Card className="rounded-2xl border border-primary/15 bg-background p-4 md:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">8-Session Reports</h3>
                    <Badge variant="outline">{monthlyReports.length}</Badge>
                  </div>
                  {!monthlyReports.length ? (
                    <p className="text-sm text-muted-foreground">No eight-session reports created yet. Eight completed session groups are required.</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {monthlyReports.map((report) => {
                        const structured = report.structuredData || {};
                        return (
                          <AccordionItem key={report.id} value={`monthly-${report.id}`}>
                            <AccordionTrigger className="text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>
                                  {structured.monthStartDate && structured.monthEndDate
                                    ? `${format(new Date(structured.monthStartDate), "MMM d")} - ${format(new Date(structured.monthEndDate), "MMM d, yyyy")}`
                                    : "Eight-session report"}
                                </span>
                                <Badge variant="secondary">Sent {format(new Date(report.sentAt), "MMM d")}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3">
                              <FieldRow label="Topics" value={formatReportValue(structured.topicsConditioned || report.topicsLearned)} />
                              <FieldRow label="System Movement" value={formatReportValue(structured.systemMovement || report.strengths)} />
                              <FieldRow label="What Became Stronger" value={formatReportValue(structured.whatBecameStronger || report.strengths)} />
                              <FieldRow label="Breakdown Pattern" value={formatReportValue(structured.breakdownPattern || report.areasForGrowth)} />
                              <FieldRow label="Current Position" value={formatReportValue(structured.currentPosition)} />
                              <FieldRow label="What This Means" value={formatReportValue(structured.whatThisMeans)} />
                              <FieldRow label="Next Month Move" value={formatReportValue(structured.nextMonthMove || report.nextSteps)} />
                              <FieldRow label="Parent Feedback" value={formatReportValue(report.parentFeedback)} />
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <div className="rounded-xl border border-primary/15 bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              Internal tutor notes are stored but remain hidden from parent-facing output.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
