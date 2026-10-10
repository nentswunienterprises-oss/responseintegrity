import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getQueryFn } from "@/lib/queryClient";
import type { IssueOwnerTeam, IssueStatus } from "@shared/issueReporting";

type IssuePreview = {
  id: string;
  title: string;
  ownerTeam: IssueOwnerTeam;
  status: IssueStatus;
  createdAt: string;
};

const ownerLabels: Record<IssueOwnerTeam, string> = {
  technology: "Technology",
  operations: "Operations",
  people: "People",
};

export function CooDashboardIssueInbox({ enabled }: { enabled: boolean }) {
  // Share the same role-scoped query as the full inbox; no separate data authority.
  const { data, isLoading, isError } = useQuery<{ items: IssuePreview[] }>({
    queryKey: ["/api/issues/inbox"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled,
    retry: false,
  });

  const reports = data?.items ?? [];
  const outstanding = reports.filter((issue) => issue.status !== "resolved");

  return (
    <section aria-labelledby="coo-dashboard-issue-inbox-heading" data-testid="coo-dashboard-issue-inbox" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="coo-dashboard-issue-inbox-heading" className="text-xl font-bold sm:text-2xl">
            Issue Inbox
          </h2>
          <p className="text-sm text-muted-foreground">
            Reports from Technology, Operations, and People, with responsibility retained by each team.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <Link to="/executive/coo/issues">
            Open Issue Inbox
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <Card className="border-border/70 bg-background">
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Loading issue reports…</p>
          ) : isError ? (
            <p role="status" className="py-2 text-sm text-muted-foreground">
              Unable to load issue reports here. Open Issue Inbox to try again.
            </p>
          ) : outstanding.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No outstanding issues in the inbox. Open Issue Inbox to review completed reports.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent outstanding reports</p>
              <div className="divide-y divide-border/70">
                {outstanding.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{issue.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ownerLabels[issue.ownerTeam]} · {new Date(issue.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {issue.status === "in_progress" ? "In progress" : "Open"}
                    </Badge>
                  </div>
                ))}
              </div>
              {outstanding.length > 3 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Showing three recent reports. Open Issue Inbox to see more.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
