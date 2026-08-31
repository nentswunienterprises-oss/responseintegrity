import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  formatSnapshotRepResult,
  formatSnapshotResultText,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";

interface Assignment {
  id: string;
  title: string;
  description: string;
  problems_assigned: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  student_result: string | null;
  student_work: string | null;
  created_at: string;
}

interface SessionRecord {
  id: string;
  date: string;
  duration: number;
  deterministicLog?: {
    topicFocus: string;
    whatWasTrained: string;
    behaviorSummary: string;
    performanceResult: string;
    stateMovement: string;
    whatThisMeans: string;
    nextMove: string;
    summaryText: string;
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

interface ViewTrackingSystemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  apiBasePath?: string;
}

function formatDate(value: string | Date, withYear = true): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

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
  return formatDate(sessionDate, true);
}

function getSessionTimeLabel(value: string): string {
  const sessionDate = new Date(value);
  if (Number.isNaN(sessionDate.getTime())) return "Time unavailable";
  return sessionDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatReportValue(value: any): string {
  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          if ("topic" in item && "startState" in item && "endState" in item) {
            return `${item.topic}: ${item.startState} -> ${item.endState}`;
          }
          if ("topic" in item && "currentState" in item) {
            return `${item.topic}: ${item.currentState}`;
          }
        }
        return String(item).trim();
      })
      .filter(Boolean);
    return formatted.join("\n");
  }

  return String(value || "").trim();
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-2 md:gap-3 text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground whitespace-pre-wrap">{value?.trim() ? value : "Not recorded"}</p>
    </div>
  );
}

function responseSnapshotColor(level: string) {
  if (level === "strong") return "text-green-700";
  if (level === "partial") return "text-yellow-700";
  if (level === "weak") return "text-red-700";
  return "text-muted-foreground";
}

function ResponseSnapshotPanel({ snapshot }: { snapshot: ResponseSnapshotV1 }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold">Response Snapshot{snapshot.source.topic ? ` - ${snapshot.source.topic}` : ""}</p>
        <p className={`text-xs font-semibold ${responseSnapshotColor(snapshot.drill.responseLevel)}`}>
          {snapshot.drill.responseLabel} - {snapshot.drill.score ?? "Not scored"}/100
        </p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{formatSnapshotResultText(snapshot.drill.resultText)}</p>
      <Accordion type="multiple" className="mt-2">
        {snapshot.sets.map((set) => (
          <AccordionItem key={set.setId} value={`${snapshot.source.sourceDrillId || snapshot.source.topic}-${set.setId}`}>
            <AccordionTrigger className="text-left text-sm">
              <span>
                {set.setName} <span className={responseSnapshotColor(set.responseLevel)}>{set.responseLabel}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{formatSnapshotResultText(set.resultText, set.purposeText)}</p>
              {set.reps.map((rep) => (
                <div key={`${set.setId}-${rep.repNumber}`} className="rounded-md border border-primary/10 bg-background px-3 py-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold">Rep {rep.repNumber}</p>
                    <p className={`text-xs font-semibold ${responseSnapshotColor(rep.responseLevel)}`}>
                      {rep.responseLabel} - {rep.score ?? "Not scored"}/100
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatSnapshotRepResult(rep)}</p>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function getSessionPreview(session: SessionRecord) {
  if (session.deterministicLog) {
    const log = session.deterministicLog;
    return [log.whatWasTrained, log.behaviorSummary, log.performanceResult].filter(Boolean).join(" ");
  }
  return "";
}

export default function ViewTrackingSystemsDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  apiBasePath = "/api/tutor",
}: ViewTrackingSystemsDialogProps) {
  const { data: reportsCenter, isLoading: reportsLoading, refetch: refetchReports } = useQuery<ReportsCenterData>({
    queryKey: [`${apiBasePath}/students/${studentId}/reports-center`],
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
      void refetchReports();
    }
  }, [open, studentId]);

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: [`${apiBasePath}/students/${studentId}/assignments`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: open && !!studentId,
  });

  const weeklyReports = useMemo(
    () => (reportsCenter?.reports || []).filter((r) => r.reportType === "weekly"),
    [reportsCenter?.reports]
  );

  const monthlyReports = useMemo(
    () => (reportsCenter?.reports || []).filter((r) => r.reportType === "monthly"),
    [reportsCenter?.reports]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-primary/15 bg-background p-0 shadow-sm">
        <DialogHeader>
          <div className="border-b border-border/60 px-6 py-5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">View Tracking Systems</p>
            <DialogTitle className="mt-2 flex items-center gap-2 text-xl tracking-[-0.01em]">
              <FileText className="w-4 h-4" />
              {studentName}
            </DialogTitle>
            <DialogDescription className="mt-1">
              Reports and student assignments in one operating view.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="reports" className="w-full px-6 py-5">
          <TabsList className="grid w-full grid-cols-2 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1">
            <TabsTrigger value="reports" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              Reports
            </TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              Student Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-6 mt-4">
            {reportsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : (
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
                      <Badge variant="outline">{reportsCenter?.sessions?.length || 0}</Badge>
                    </div>
                    {!reportsCenter?.sessions?.length ? (
                      <p className="text-sm text-muted-foreground">No session logs found for this student.</p>
                    ) : (
                      <Accordion type="multiple" className="w-full">
                        {reportsCenter.sessions.map((session) => {
                          const snapshots = [
                            ...(Array.isArray(session.responseSnapshots) ? session.responseSnapshots : []),
                            ...(session.responseSnapshot ? [session.responseSnapshot] : []),
                          ];
                          return (
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
                              {session.deterministicLog ? (
                                <div className="space-y-3 rounded-xl border border-primary/15 bg-background p-4">
                                  <FieldRow label="Session Summary" value={session.deterministicLog.summaryText || session.deterministicLog.topicFocus} />
                                  <FieldRow label="What Was Trained" value={session.deterministicLog.whatWasTrained} />
                                  {snapshots.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium text-foreground">Response Snapshots</p>
                                      {snapshots.map((snapshot, index) => (
                                        <ResponseSnapshotPanel
                                          key={snapshot.source.sourceDrillId || `${snapshot.source.topic}-${index}`}
                                          snapshot={snapshot}
                                        />
                                      ))}
                                    </div>
                                  ) : null}
                                  <FieldRow label="Observed Response" value={session.deterministicLog.behaviorSummary} />
                                  <FieldRow label="Performance Result" value={session.deterministicLog.performanceResult} />
                                  <FieldRow label="State Update" value={session.deterministicLog.stateMovement} />
                                  <FieldRow label="What This Means" value={session.deterministicLog.whatThisMeans} />
                                  <FieldRow label="Next Drill" value={session.deterministicLog.nextMove} />
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
                                      ? `${formatDate(structured.weekStartDate, false)} - ${formatDate(structured.weekEndDate, true)}`
                                      : `Week ${report.weekNumber || "-"}`}
                                  </span>
                                  <Badge variant="secondary">Sent {formatDate(report.sentAt, false)}</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3">
                                <FieldRow label="Topics Worked On" value={formatReportValue(structured.topicsWorkedOn || structured.mainTopicsCovered || report.topicsLearned)} />
                                <FieldRow label="What Changed" value={formatReportValue(structured.whatChanged || structured.whatImproved || structured.whatImprovedThisWeek || report.strengths)} />
                                <FieldRow label="Breakdown Pattern" value={formatReportValue(structured.breakdownPattern || structured.responsePattern || structured.studentResponsePatternThisWeek || structured.mainBreakdown || structured.mainMisunderstandingThisWeek || report.areasForGrowth)} />
                                <FieldRow label="What This Means" value={formatReportValue(structured.whatThisMeans || structured.conditioningProgress || structured.bossBattleSummaryThisWeek || structured.systemMovement || structured.mainCorrectionHelpedThisWeek)} />
                                <FieldRow label="Next Move" value={formatReportValue(structured.nextMove || structured.nextFocus || structured.reinforcementNextWeek || report.nextSteps)} />
                                {report.parentFeedback ? (
                                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900">Parent Feedback</p>
                                    <p className="mt-2 text-sm leading-relaxed text-amber-950">{report.parentFeedback}</p>
                                    {report.parentFeedbackAt ? (
                                      <p className="mt-2 text-xs text-amber-800">Submitted {formatDate(report.parentFeedbackAt, true)}</p>
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
                                      ? `${formatDate(structured.monthStartDate, false)} - ${formatDate(structured.monthEndDate, true)}`
                                      : "Eight-session report"}
                                  </span>
                                  <Badge variant="secondary">Sent {formatDate(report.sentAt, false)}</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3">
                                <FieldRow label="Topics Conditioned" value={formatReportValue(structured.topicsConditioned || report.topicsLearned)} />
                                <FieldRow label="System Movement" value={formatReportValue(structured.systemMovement || report.strengths)} />
                                <FieldRow label="What Became Stronger" value={formatReportValue(structured.whatBecameStronger || report.strengths)} />
                                <FieldRow label="Breakdown Pattern" value={formatReportValue(structured.breakdownPattern || report.areasForGrowth)} />
                                <FieldRow label="Current Position" value={formatReportValue(structured.currentPosition)} />
                                <FieldRow label="What This Means" value={formatReportValue(structured.whatThisMeans)} />
                                <FieldRow label="Next Eight-Session Move" value={formatReportValue(structured.nextMonthMove || report.nextSteps)} />
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
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4 mt-4">
            {assignmentsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : !assignments || assignments.length === 0 ? (
              <Card className="rounded-2xl border border-primary/15 bg-muted/20 p-12 text-center shadow-sm">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Assignments Yet</h3>
                <p className="text-muted-foreground">
                  No assignments have been created for this student.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="rounded-2xl border border-primary/15 bg-background shadow-sm p-4 md:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-base">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(assignment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-primary/20 bg-muted/20 text-foreground">
                        {assignment.is_completed ? "Completed" : "Pending"}
                      </Badge>
                    </div>

                    {assignment.description && (
                      <FieldRow label="Description" value={assignment.description} />
                    )}
                    {assignment.problems_assigned && (
                      <FieldRow label="Problems Assigned" value={assignment.problems_assigned} />
                    )}
                    {assignment.student_work && (
                      <FieldRow label="Student Work" value={assignment.student_work} />
                    )}
                    {assignment.student_result && (
                      <FieldRow label="Result" value={assignment.student_result} />
                    )}
                    {assignment.due_date && (
                      <FieldRow label="Due Date" value={new Date(assignment.due_date).toLocaleDateString()} />
                    )}
                    {assignment.completed_at && (
                      <FieldRow
                        label="Submitted"
                        value={`${new Date(assignment.completed_at).toLocaleDateString()} ${new Date(assignment.completed_at).toLocaleTimeString()}`}
                      />
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

