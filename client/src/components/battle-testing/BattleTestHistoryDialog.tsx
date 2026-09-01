import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { stripWhatThisDoesSection } from "@/components/battle-testing/textUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { BattleTestRunDetail, BattleTestRunHistoryItem } from "@shared/battleTesting";

interface BattleTestHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  historyQueryKey: string;
  historyEndpoint: string;
  filter: (run: BattleTestRunHistoryItem) => boolean;
}

function getStateBadgeClass(state: string) {
  if (state === "locked") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (state === "watchlist") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default function BattleTestHistoryDialog({
  open,
  onOpenChange,
  title,
  description,
  historyQueryKey,
  historyEndpoint,
  filter,
}: BattleTestHistoryDialogProps) {
  const { data: runs = [], isLoading } = useQuery<BattleTestRunHistoryItem[]>({
    queryKey: [historyQueryKey],
    enabled: open,
    queryFn: async () => {
      const response = await apiRequest("GET", historyEndpoint);
      return response.json();
    },
  });
  const filteredRuns = runs.filter(filter);
  const selectedRunId = filteredRuns[0]?.runId || null;

  const { data: runDetail, isLoading: detailLoading } = useQuery<BattleTestRunDetail>({
    queryKey: [`battle-test-run-detail-${selectedRunId}`],
    enabled: open && !!selectedRunId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/battle-tests/runs/${selectedRunId}`);
      return response.json();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[95dvh] w-[calc(100vw-1rem)] max-w-6xl flex flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(96vw,88rem)]">
        <div className="border-b px-4 py-4 sm:px-6 sm:py-5">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">{description}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[0.9fr,1.1fr] lg:gap-0">
          <div className="min-h-0 lg:border-r border-b lg:border-b-0 p-4 sm:p-6">
            <p className="mb-4 text-xs sm:text-sm font-medium text-foreground">Recent Runs</p>
            <ScrollArea className="h-[40vh] sm:h-[50vh] lg:h-[70vh] pr-3">
              <div className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </>
                ) : filteredRuns.length > 0 ? (
                  filteredRuns.map((run) => (
                    <Card key={run.runId} className="border p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base text-foreground truncate">{run.subjectName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {new Date(run.completedAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge className={`${getStateBadgeClass(run.state)} shrink-0`}>{run.stateLabel}</Badge>
                      </div>
                      <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-semibold text-foreground">
                        {Math.round(run.alignmentPercent)}%
                      </p>
                      <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
                        {run.phaseScores.map((phase) => (
                          <Badge key={`${run.runId}-${phase.phaseKey}`} variant="outline" className="text-xs sm:text-sm">
                            {phase.title}: {Math.round(phase.percent)}%
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-xs sm:text-sm text-muted-foreground">
                    No battle-testing history recorded yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 p-4 sm:p-6">
            <p className="mb-4 text-xs sm:text-sm font-medium text-foreground">Latest Run Detail</p>
            {detailLoading ? (
              <Skeleton className="h-72" />
            ) : runDetail ? (
              <ScrollArea className="h-[40vh] sm:h-[50vh] lg:h-[70vh] pr-3">
                <div className="space-y-4">
                  <Card className="border p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm sm:text-base text-foreground truncate">{runDetail.subjectName}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(runDetail.completedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={`${getStateBadgeClass(runDetail.state)} shrink-0`}>{runDetail.stateLabel}</Badge>
                    </div>
                    {runDetail.actionRequired ? (
                      <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">{runDetail.actionRequired}</p>
                    ) : null}
                  </Card>

                  {runDetail.repLogs.map((rep) => (
                    <Card key={`${rep.phaseKey}:${rep.questionKey}`} className="border p-3 sm:p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs sm:text-sm">{rep.phaseKey}</Badge>
                        <Badge variant="outline" className="text-xs sm:text-sm">{rep.section}</Badge>
                        <Badge
                          className={`text-xs sm:text-sm ${
                            rep.score === "clear"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : rep.score === "partial"
                              ? "bg-amber-100 text-amber-900 border-amber-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}
                        >
                          {rep.score.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs sm:text-sm">
                          {(rep.variantKey || "form_a").replace("_", " ").toUpperCase()}
                        </Badge>
                        {rep.isCriticalFail ? <Badge className="bg-rose-700 text-white text-xs sm:text-sm">Critical Fail</Badge> : null}
                      </div>
                      <p className="mt-2 sm:mt-3 font-medium text-sm sm:text-base text-foreground">
                        {stripWhatThisDoesSection(rep.prompt)}
                      </p>
                      <div className="mt-2 sm:mt-3 rounded-xl border bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Specialist Answer / Evidence Heard
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-xs sm:text-sm text-foreground">
                          {rep.answerEvidence || "No answer evidence captured."}
                        </p>
                      </div>
                      {rep.scoringGuide ? (
                        <div className="mt-2 sm:mt-3 rounded-xl border bg-muted/20 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Scoring Anchor Used
                          </p>
                          <p className="mt-2 text-xs sm:text-sm text-foreground">
                            {rep.scoringGuide[rep.score]}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-2 sm:mt-3 rounded-xl border bg-muted/20 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Expected Answer
                        </p>
                        <p className="mt-2 text-xs sm:text-sm text-foreground">
                          {stripWhatThisDoesSection(rep.expectedAnswer)}
                        </p>
                      </div>
                      {rep.note ? (
                        <div className="mt-2 sm:mt-3 rounded-xl border bg-background p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            TD Note
                          </p>
                          <p className="mt-2 text-xs sm:text-sm text-foreground">{rep.note}</p>
                        </div>
                      ) : null}
                      {rep.criticalFailReason ? (
                        <div className="mt-2 sm:mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-900">
                            Critical Fail Reason
                          </p>
                          <p className="mt-2 text-xs sm:text-sm text-rose-950">{rep.criticalFailReason}</p>
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-xs sm:text-sm text-muted-foreground">
                No run detail available yet.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
