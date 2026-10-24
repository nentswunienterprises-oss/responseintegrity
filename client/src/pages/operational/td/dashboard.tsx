import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PodOverviewLookup {
  pod: { id: string; podName: string; status?: string; phase?: string };
}

export default function TDDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const overviewBasePath = location.pathname.startsWith("/operational/td")
    ? "/operational/td/my-pods"
    : "/td/overview";
  const { data: podOverview = [], isLoading } = useQuery<PodOverviewLookup[]>({
    queryKey: ["/api/td/pod-overview"],
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-40" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><Users className="h-5 w-5 text-primary" />My Pods</h1>
              <p className="mt-1 text-sm text-muted-foreground">Review assigned Specialists through their Development Pathway standing.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(overviewBasePath)}>Open all pods <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
          {podOverview.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No assigned pods found.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {podOverview.map((entry) => (
                <button key={entry.pod.id} type="button" onClick={() => navigate(`${overviewBasePath}/${entry.pod.id}`)} className="text-left">
                  <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                    <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="truncate">{entry.pod.podName}</span><span className="shrink-0 text-xs font-medium text-primary">Open pod</span></CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Operating status</span><Badge variant={entry.pod.status === "active" ? "default" : "secondary"}>{entry.pod.status || "Not recorded"}</Badge></div>
                      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Development Pathway</p><p className="mt-1 text-sm text-muted-foreground">Specialist stage and next governed requirement are shown inside the pod.</p></div>
                      {entry.pod.phase ? <p className="text-xs text-muted-foreground">{entry.pod.phase} phase</p> : null}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

