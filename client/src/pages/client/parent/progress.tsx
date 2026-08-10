import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, MessageSquare, Send, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ParentReport {
  id: string;
  reportType: "weekly" | "monthly";
  weekRange?: {
    start: string;
    end: string;
  } | null;
  monthRange?: {
    start: string;
    end: string;
  } | null;
  monthName?: string;
  sessionsCompleted?: number;
  totalSessionsCompleted?: number;
  topicsWorkedOn?: string[];
  topicsConditioned?: string[];
  whatChanged?: string[];
  breakdownPattern?: string[];
  whatThisMeans?: string[];
  nextMove?: string[];
  systemMovement?: string[];
  whatBecameStronger?: string[];
  currentPosition?: Array<{
    topic: string;
    state: string;
    position: string;
  }>;
  nextMonthMove?: string[];
  parentFeedback?: string;
  parentFeedbackAt?: string;
  sentAt: string;
  tutor: {
    name: string;
  };
}

interface ParentTrainingSessionsResponse {
  monthlyQuota?: {
    session_quota?: number;
    sessions_used?: number;
    sessions_remaining?: number;
    status?: string;
    month_key?: string;
  } | null;
  operationalMode?: "training" | "certified_live";
  sessionSchedulingEnabled?: boolean;
}

function ReportSection({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2">{title}</h4>
      {!items || items.length === 0 ? (
        <p className="text-xs sm:text-sm text-muted-foreground">Not provided</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <p key={`${item}-${index}`} className="text-xs sm:text-sm text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentProgress() {
  useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState<ParentReport | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const { data: reports = [] } = useQuery<ParentReport[]>({
    queryKey: ["/api/parent/reports"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: trainingData, isLoading: trainingDataLoading } = useQuery<ParentTrainingSessionsResponse>({
    queryKey: ["/api/parent/training-sessions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const monthlyQuota = trainingData?.monthlyQuota;

  const location = useLocation();
  const topDefault = new URLSearchParams(location.search).get("tab") === "analytics" || location.hash === "#analytics"
    ? "analytics"
    : "reports";

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ reportId, feedback }: { reportId: string; feedback: string }) => {
      const response = await fetch(`/api/parent/reports/${reportId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ feedback }),
      });
      if (!response.ok) throw new Error("Failed to submit feedback");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Your feedback has been sent to the tutor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/reports"] });
      setFeedbackDialogOpen(false);
      setFeedback("");
      setSelectedReport(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGiveFeedback = (report: ParentReport) => {
    setSelectedReport(report);
    setFeedback(report.parentFeedback || "");
    setFeedbackDialogOpen(true);
  };

  const handleSubmitFeedback = () => {
    if (!selectedReport) return;
    submitFeedbackMutation.mutate({
      reportId: selectedReport.id,
      feedback,
    });
  };

  const weeklyReports = reports.filter((report) => report.reportType === "weekly");
  const monthlyReports = reports.filter((report) => report.reportType === "monthly");
  const defaultTab = monthlyReports.length > 0 ? "monthly" : "weekly";

  const averageWeeklySessions = weeklyReports.length
    ? weeklyReports.reduce((sum, report) => sum + (report.sessionsCompleted || 0), 0) / weeklyReports.length
    : 0;
  const lastReportSentAt = reports.length
    ? new Date(reports[0].sentAt).toLocaleDateString()
    : "No reports yet";

  const formatRange = (start?: string, end?: string) => {
    if (!start || !end) return "Date range unavailable";
    return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
  };

  const isLegacyWeeklyReport = (report: ParentReport) => !report.weekRange?.start || !report.weekRange?.end;
  const isLegacyMonthlyReport = (report: ParentReport) => !report.monthRange?.start || !report.monthRange?.end;

  const renderFeedbackBlock = (report: ParentReport) => {
    if (!report.parentFeedback) return null;

    return (
      <div className="bg-muted/50 rounded-lg p-2 sm:p-3 border-l-2 border-l-primary">
        <h4 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2">Your Feedback</h4>
        <p className="text-xs sm:text-sm text-muted-foreground">{report.parentFeedback}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
          Submitted {new Date(report.parentFeedbackAt!).toLocaleDateString()}
        </p>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold">Progress</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Track your child's learning journey and view analytics</p>
      </div>

      <Tabs defaultValue={topDefault} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="reports" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
            <span>Progress Reports</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          {/* Summary cards removed — Analytics tab now shows quota and usage */}

          <Tabs defaultValue={defaultTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 h-auto rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="weekly" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
                <span>Weekly</span>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{weeklyReports.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
                <span>Monthly</span>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{monthlyReports.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="mt-0 space-y-4">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Weekly Updates</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Review week-by-week progress without scrolling through monthly summaries.</p>
              </div>

              {weeklyReports.length === 0 ? (
                <Card>
                  <CardContent className="p-4 sm:pt-6 text-center text-sm sm:text-base text-muted-foreground">
                    No weekly updates yet. Your tutor will send an update after each week of sessions.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {weeklyReports.map((report) => (
                    <Card key={report.id} className="border-l-4 border-l-primary">
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                          <div>
                            <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                              Weekly Update
                              {isLegacyWeeklyReport(report) && (
                                <Badge variant="outline" className="text-xs">
                                  Legacy format
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm mt-1">
                              {formatRange(report.weekRange?.start, report.weekRange?.end)}
                            </CardDescription>
                            <CardDescription className="text-xs sm:text-sm mt-1">
                              Sent {new Date(report.sentAt).toLocaleDateString()} by {report.tutor.name}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                        <div className="bg-muted/30 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Sessions Completed</p>
                          <p className="text-base sm:text-xl font-bold">{report.sessionsCompleted || 0}</p>
                        </div>

                        {isLegacyWeeklyReport(report) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3">
                            <p className="text-xs sm:text-sm text-amber-900">
                              This report was created before structured ranges were introduced. Some sections may have limited detail.
                            </p>
                          </div>
                        )}

                        <ReportSection title="Topics" items={report.topicsWorkedOn} />
                        <ReportSection title="What Changed" items={report.whatChanged} />
                        <ReportSection title="Breakdown Pattern" items={report.breakdownPattern} />
                        <ReportSection title="What This Means" items={report.whatThisMeans} />
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 sm:p-3">
                          <ReportSection title="Next Move" items={report.nextMove} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="monthly" className="mt-0 space-y-4">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Monthly Reports</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Open monthly summaries directly without scrolling through weekly entries first.</p>
              </div>

              {monthlyReports.length === 0 ? (
                <Card>
                  <CardContent className="p-4 sm:pt-6 text-center text-sm sm:text-base text-muted-foreground">
                    No monthly reports yet. Your tutor will send comprehensive monthly summaries.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {monthlyReports.map((report) => (
                    <Card key={report.id} className="border-l-4 border-l-purple-500">
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                          <div>
                            <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                              {report.monthName || "Monthly"} Report
                              {isLegacyMonthlyReport(report) && (
                                <Badge variant="outline" className="text-xs">
                                  Legacy format
                                </Badge>
                              )}
                              {report.parentFeedback && (
                                <Badge variant="secondary" className="text-xs">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Feedback Given
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm mt-1">
                              {formatRange(report.monthRange?.start, report.monthRange?.end)}
                            </CardDescription>
                            <CardDescription className="text-xs sm:text-sm mt-1">
                              Sent {new Date(report.sentAt).toLocaleDateString()} by {report.tutor.name}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            variant={report.parentFeedback ? "outline" : "default"}
                            onClick={() => handleGiveFeedback(report)}
                            className="w-full sm:w-auto text-xs sm:text-sm"
                          >
                            <MessageSquare className="w-4 h-4 mr-1 sm:mr-2" />
                            {report.parentFeedback ? "Update" : "Feedback"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                        <div className="bg-muted/30 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Total Sessions Completed</p>
                          <p className="text-base sm:text-xl font-bold">{report.totalSessionsCompleted || 0}</p>
                        </div>

                        {isLegacyMonthlyReport(report) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3">
                            <p className="text-xs sm:text-sm text-amber-900">
                              This report was created before structured ranges were introduced. Some sections may have limited detail.
                            </p>
                          </div>
                        )}

                        <ReportSection title="Topics" items={report.topicsConditioned} />
                        <ReportSection title="System Movement" items={report.systemMovement} />
                        <ReportSection title="What Became Stronger" items={report.whatBecameStronger} />
                        <ReportSection title="Breakdown Pattern" items={report.breakdownPattern} />

                        <div>
                          <h4 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2">Current Position</h4>
                          {!report.currentPosition || report.currentPosition.length === 0 ? (
                            <p className="text-xs sm:text-sm text-muted-foreground">Not provided</p>
                          ) : (
                            <div className="space-y-2">
                              {report.currentPosition.map((row, index) => (
                                <div key={`${row.topic}-${index}`} className="text-xs sm:text-sm text-muted-foreground">
                                  <p className="font-medium text-foreground">
                                    {report.currentPosition && report.currentPosition.length === 1 ? row.state : `${row.topic}: ${row.state}`}
                                  </p>
                                  <p>{row.position}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <ReportSection title="What This Means" items={report.whatThisMeans} />

                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 sm:p-3">
                          <ReportSection title="Next Month Move" items={report.nextMonthMove} />
                        </div>

                        {renderFeedbackBlock(report)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">Analytics</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Session allocation, quota and usage for the current month.</p>
            </div>

            {trainingDataLoading ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Loading analytics...
                </CardContent>
              </Card>
            ) : !monthlyQuota ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">No analytics available yet - schedule a session or confirm enrollment to see quota data.</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Monthly Quota</p>
                    <p className="text-lg sm:text-2xl font-bold">{monthlyQuota.session_quota ?? "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Sessions Used</p>
                    <p className="text-lg sm:text-2xl font-bold">{monthlyQuota.sessions_used ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Sessions Remaining</p>
                    <p className={`text-lg sm:text-2xl font-bold ${Number(monthlyQuota.sessions_remaining || 0) <= 0 ? 'text-rose-600' : ''}`}>
                      {monthlyQuota.sessions_remaining ?? 0}
                    </p>
                    {Number(monthlyQuota.sessions_remaining || 0) <= 0 && (
                      <p className="text-xs text-rose-600 mt-1">No sessions remaining this month</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {Number(monthlyQuota.sessions_remaining || 0) <= 0 && (
                <Card className="border border-rose-200 bg-rose-50">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-rose-700">All 8 sessions for this month are used up. Renew to unlock the next 8.</p>
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white shrink-0"
                      onClick={() => navigate("/client/parent/gateway")}
                    >
                      Renew — R1000
                    </Button>
                  </CardContent>
                </Card>
              )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="mx-2 sm:mx-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Give Feedback on Report</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Share your thoughts, questions, or concerns with your child's tutor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Type your feedback here..."
              rows={5}
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={submitFeedbackMutation.isPending || !feedback.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
