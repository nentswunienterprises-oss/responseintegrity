import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ISSUE_CATEGORIES, ISSUE_IMPACTS, type IssueCategory, type IssueImpact, type IssueOwnerTeam, type IssueStatus } from "@shared/issueReporting";

interface IssueItem {
  id: string;
  category: IssueCategory;
  ownerTeam: IssueOwnerTeam;
  title: string;
  description: string;
  locationHint: string | null;
  impact: IssueImpact;
  helpRequested: string | null;
  status: IssueStatus;
  canManage: boolean;
  resolutionNote: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

const teamLabels: Record<IssueOwnerTeam, string> = {
  technology: "Technology",
  operations: "Operations",
  people: "People",
};
const statusLabels: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function IssueInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<IssueItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const { data, isLoading, isError } = useQuery<{ items: IssueItem[] }>({
    queryKey: ["/api/issues/inbox"],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "in_progress" | "resolved"; note: string }) => {
      return apiRequest("PATCH", `/api/issues/${encodeURIComponent(id)}/status`, { status, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues/inbox"] });
      setReviewing(null);
      setResolutionNote("");
      toast({ title: "Issue updated" });
    },
    onError: (error) => {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    },
  });

  const issues = data?.items || [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Issue Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Reports are routed to the responsible team. The COO can view all categories for oversight.
          Only the responsible team can update or resolve an issue.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading reported issues…</p>}
      {isError && (
        <Card className="p-5">
          <p className="text-sm">Unable to load issue reports. No issue status has changed.</p>
        </Card>
      )}
      {!isLoading && !isError && issues.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">No reports in your team's queue.</p>
        </Card>
      )}

      <div className="space-y-3">
        {issues.map((issue) => {
          const categoryLabel = ISSUE_CATEGORIES.find((item) => item.value === issue.category)?.label || issue.category;
          const impactLabel = ISSUE_IMPACTS.find((item) => item.value === issue.impact)?.label || issue.impact;
          return (
            <Card key={issue.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{issue.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel} · {teamLabels[issue.ownerTeam]} · {new Date(issue.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary">{statusLabels[issue.status]}</Badge>
              </div>

              <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
              {issue.locationHint && (
                <p className="text-sm"><strong>Where:</strong> {issue.locationHint}</p>
              )}
              <p className="text-sm"><strong>Impact:</strong> {impactLabel}</p>
              {issue.helpRequested && (
                <p className="text-sm"><strong>Requested help:</strong> {issue.helpRequested}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Reported by {issue.reporterName || issue.reporterEmail || "Team member"} · Reference {issue.id.slice(0, 8)}
              </p>
              {issue.resolutionNote && <p className="text-sm"><strong>Review note:</strong> {issue.resolutionNote}</p>}

              {issue.status !== "resolved" && !issue.canManage && (
                <p className="text-xs text-muted-foreground">
                  Visibility only. {teamLabels[issue.ownerTeam]} handles this issue.
                </p>
              )}

              {issue.status !== "resolved" && issue.canManage && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {issue.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: issue.id, status: "in_progress", note: "" })}
                    >
                      Mark in progress
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setReviewing(issue); setResolutionNote(""); }}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => { if (!open) { setReviewing(null); setResolutionNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve issue</DialogTitle>
            <DialogDescription>
              Record what was addressed. A resolution note is required and the change is retained in the issue history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="issue-resolution">Resolution note *</Label>
            <Textarea
              id="issue-resolution"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What was verified, fixed, clarified, or agreed?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button
              disabled={!reviewing || !resolutionNote.trim() || updateStatus.isPending}
              onClick={() => {
                if (reviewing && resolutionNote.trim()) {
                  updateStatus.mutate({ id: reviewing.id, status: "resolved", note: resolutionNote.trim() });
                }
              }}
            >
              Record resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
