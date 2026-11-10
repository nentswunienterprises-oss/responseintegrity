import { DemandReview } from "@/components/executive/DemandReview";
import React from "react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const labels: Record<string, string> = {
  close: "Close", subscription: "Subscription", captured: "Captured", application: "Application",
  training: "Training", sandbox: "Sandbox", trial: "Trial", certified_live: "Certified Live",
};

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value == null ? "—" : value}</p>
    </div>
  );
}

export default function TrackLeadsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [selectedSource, setSelectedSource] = React.useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/coo/production-economy"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => (await apiRequest("GET", "/api/coo/production-economy")).json(),
  });

  const applications = React.useMemo(
    () => [...(data?.demandLineages || []), ...(data?.organic || [])]
      .filter((lineage: any) => lineage.enrollment)
      .sort((a: any, b: any) => new Date(b.enrollment.created_at || 0).getTime() - new Date(a.enrollment.created_at || 0).getTime()),
    [data?.demandLineages, data?.organic],
  );

  const sources = (data?.sources || []).filter((source: any) => {
    if (sourceFilter === "demand" || sourceFilter === "capacity") return source.pipeline === sourceFilter;
    if (sourceFilter === "reward") return Boolean(source.reward?.eligible);
    if (sourceFilter === "blocked") return (data?.summary?.blockers || []).length > 0 && source.pipeline === "demand";
    return true;
  });

  const copy = async (value: string) => {
    try { await navigator.clipboard?.writeText(value); } catch { /* Clipboard may be unavailable in this browser. */ }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">COO operating desk</p>
          <h1 className="text-3xl font-semibold tracking-tight">Track Leads</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Review parent applications and move qualified demand through the existing operating process.</p>
        </div>
        <Button variant="outline" onClick={() => { window.location.href = "/executive/coo/dashboard"; }}>Back to Dashboard</Button>
      </header>

      {isLoading && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading parent applications…</CardContent></Card>}
      {error && <Card><CardContent className="pt-6 text-sm text-destructive">Parent applications could not be loaded. Refresh the page and try again.</CardContent></Card>}

      {data && (
        <>
          <section aria-labelledby="parent-review-heading" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="parent-review-heading" className="text-xl font-semibold">Parent application review</h2>
                <p className="text-sm text-muted-foreground">The primary work queue. Open an application to complete or review its qualification record.</p>
              </div>
              <Badge variant="secondary">{applications.length} applications</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Captured" value={data.summary?.demand?.captured} />
              <Metric label="Awaiting qualification" value={data.summary?.demand?.qualificationPending} />
              <Metric label="Qualified" value={data.summary?.demand?.qualified} />
              <Metric label="Handed over" value={data.summary?.demand?.handoverCompleted} />
            </div>

            {(data.summary?.blockers || []).length > 0 && (
              <div className="rounded-lg border border-amber-400/60 bg-amber-50/50 p-4 dark:bg-amber-950/20">
                <p className="font-medium text-sm">Operational blockers</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {data.summary.blockers.map((blocker: any) => <li key={blocker.code}>{blocker.message}</li>)}
                </ul>
              </div>
            )}

            {applications.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No submitted parent applications are available for review.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {applications.map((lineage: any) => {
                  const enrollment = lineage.enrollment;
                  const isOpen = reviewId === lineage.id;
                  const qualification = String(enrollment.qualification_status || "").toLowerCase();
                  const qualificationLabel = qualification === "qualified"
                    ? "Qualified"
                    : qualification === "not_qualified"
                      ? "Not qualified"
                      : enrollment.demand_flow_version === 0
                        ? "Historical · unknown"
                        : "Awaiting qualification";
                  const qualificationVariant = qualification === "qualified" ? "default" : "secondary";
                  return (
                    <Card key={lineage.id} className="overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => setReviewId(isOpen ? null : lineage.id)}
                        aria-expanded={isOpen}
                        aria-controls={`parent-review-${lineage.id}`}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-semibold">{lineage.parentName || lineage.parentId}</p>
                          <p className="text-sm text-muted-foreground">{enrollment.student_full_name} · {enrollment.student_grade || "Grade not recorded"}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Badge variant={qualificationVariant}>{qualificationLabel}</Badge>
                          <Badge variant="outline">{String(lineage.currentStation || "captured").replaceAll("_", " ")}</Badge>
                          <span className="text-xs text-muted-foreground">{isOpen ? "Close review" : "Review application"}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div id={`parent-review-${lineage.id}`} className="border-t p-4">
                          <DemandReview key={`${lineage.id}:${enrollment.updated_at}`} lineage={lineage} staff={data.staff || []} />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30"
              onClick={() => setSourcesOpen((open) => !open)}
              aria-expanded={sourcesOpen}
            >
              <span>
                <span className="block font-semibold">Production Sources</span>
                <span className="block text-sm text-muted-foreground">Secondary view · links, attribution and source lineage</span>
              </span>
              <span className="text-sm text-muted-foreground">{sourcesOpen ? "Hide" : "Show"} sources</span>
            </button>
            {sourcesOpen && (
              <div className="space-y-4 border-t p-4">
                <div className="flex flex-wrap gap-2">
                  {([["all", "All"], ["demand", "Demand"], ["capacity", "Capacity"], ["reward", "Reward eligible"], ["blocked", "Blocked"]] as const).map(([value, label]) => (
                    <Button key={value} size="sm" variant={sourceFilter === value ? "default" : "outline"} onClick={() => setSourceFilter(value)}>{label}</Button>
                  ))}
                </div>
                {sources.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No Production Sources match this filter.</p>
                ) : (
                  <div className="space-y-3">
                    {sources.map((source: any) => {
                      const isSelected = selectedSource === source.code;
                      return (
                        <Card key={source.code}>
                          <CardHeader className="space-y-2 pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-semibold">{source.code}</span>
                                <Badge variant="secondary">{source.pipeline}</Badge>
                                <Badge variant="outline">{source.status}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{source.opportunitiesProduced} opportunities</span>
                            </div>
                            <CardTitle className="text-base">{source.ownerName} <span className="font-normal text-muted-foreground">({source.ownerType})</span></CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {Object.entries(source.counts || {}).map(([key, value]) => <span key={key}><strong className="text-foreground">{value == null ? "n/a" : String(value)}</strong> {key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span>)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => copy(source.code)}>Copy code</Button>
                              <Button size="sm" variant="outline" onClick={() => copy(source.link)}>Copy link</Button>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedSource(isSelected ? null : source.code)}>{isSelected ? "Hide lineage" : "View lineage"}</Button>
                            </div>
                            {isSelected && (
                              <div className="space-y-2 border-t pt-3">
                                {source.lineages.map((item: any) => (
                                  <div key={item.id} className="rounded-md border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-mono">{item.code}</span>
                                      <Badge variant="outline">{labels[item.currentStation] || item.currentStation}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Timestamp unavailable"}</p>
                                    {item.close && <p className="mt-2">Close: {item.close.id} · {item.close.ownerName || "owner snapshot unavailable"} · affiliate {item.close.affiliateId || "none"}</p>}
                                    {item.reward && <p className="mt-1">Reward: {item.reward.eligible ? "eligible" : item.reward.status}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
