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

function Metric({ label, value }: { label: string; value: number | null }) {
  return <div className="border-l pl-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{value == null ? "Not measurable" : value}</div></div>;
}

export default function TrackLeadsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [filter, setFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<any | null>(null);
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/coo/production-economy"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => (await apiRequest("GET", "/api/coo/production-economy")).json(),
  });

  const sources = (data?.sources || []).filter((source: any) => {
    if (filter === "demand" || filter === "capacity") return source.pipeline === filter;
    if (filter === "reward") return source.reward.eligible;
    if (filter === "blocked") return (data.summary.blockers || []).length > 0 && source.pipeline === "demand";
    return true;
  });

  const copy = async (value: string) => navigator.clipboard?.writeText(value);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <Button variant="outline" onClick={() => window.location.href = "/executive/coo/dashboard"}>Back to Dashboard</Button>
      <header><p className="text-sm text-muted-foreground">COO operating desk</p><h1 className="text-3xl font-semibold">Production Economy</h1><p className="text-muted-foreground">Lineage before vanity metrics. Every station below is derived from persisted production records.</p></header>
      {isLoading && <Card><CardContent className="pt-6">Loading production records...</CardContent></Card>}
      {error && <Card><CardContent className="pt-6 text-destructive">Production Economy could not be loaded.</CardContent></Card>}
      {data && <>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Demand Production</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Active links" value={data.summary.demand.activeLinks} /><Metric label="Captured" value={data.summary.demand.captured} /><Metric label="Qualified" value={data.summary.demand.qualified} /><Metric label="Trial" value={data.summary.demand.trial} /><Metric label="Subscribed" value={data.summary.demand.subscribed} /><Metric label="Verified" value={data.summary.demand.verifiedConversions} /><Metric label="Reward eligible" value={data.summary.demand.rewardEligible} /><Metric label="Organic" value={data.summary.demand.organic} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Capacity Production</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Active links" value={data.summary.capacity.activeLinks} /><Metric label="Applications" value={data.summary.capacity.applications} /><Metric label="Training" value={data.summary.capacity.training} /><Metric label="Sandbox" value={data.summary.capacity.sandbox} /><Metric label="Trial" value={data.summary.capacity.trial} /><Metric label="Certified live" value={data.summary.capacity.certifiedLive} /><Metric label="Deployed" value={data.summary.capacity.deployed} />
            <div className="border-l pl-4"><div className="text-xs text-muted-foreground">Reward</div><div className="text-sm font-medium">Not applicable in MVP</div></div>
          </CardContent></Card>
        </div>
        {(data.summary.blockers || []).length > 0 && <Card className="border-amber-400"><CardHeader><CardTitle>Current blockers</CardTitle></CardHeader><CardContent className="space-y-2">{data.summary.blockers.map((blocker: any) => <p key={blocker.code} className="text-sm">{blocker.message}</p>)}</CardContent></Card>}
        <div className="flex flex-wrap gap-2">{[["all", "All"], ["demand", "Demand"], ["capacity", "Capacity"], ["reward", "Reward eligible"], ["blocked", "Blocked"]].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}</div>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Production Sources</h2>{sources.length === 0 ? <Card><CardContent className="pt-6 text-muted-foreground">No Production Links match this filter.</CardContent></Card> : sources.map((source: any) => <Card key={source.code} className="cursor-pointer" onClick={() => setSelected(selected?.code === source.code ? null : source)}><CardContent className="pt-6 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono font-semibold">{source.code}</span><Badge variant="secondary">{source.pipeline}</Badge><Badge>{source.status}</Badge></div><p className="text-sm">{source.ownerName} <span className="text-muted-foreground">({source.ownerType})</span></p></div><div className="text-right text-sm text-muted-foreground">{source.opportunitiesProduced} opportunities<br />{source.reward.eligible ? "Reward eligible" : source.reward.status === "not_applicable" ? "No Production Reward" : "Reward not measurable"}</div></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">{Object.entries(source.counts).map(([key, value]) => <span key={key}><b>{value == null ? "n/a" : value}</b> {key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span>)}</div><div className="text-xs text-muted-foreground break-all">{source.link}</div><div className="flex gap-2" onClick={(event) => event.stopPropagation()}><Button size="sm" variant="outline" onClick={() => copy(source.code)}>Copy code</Button><Button size="sm" variant="outline" onClick={() => copy(source.link)}>Copy link</Button></div>{selected?.code === source.code && <div className="border-t pt-3 space-y-2"><h3 className="font-semibold">Lineage</h3>{source.lineages.map((lineage: any) => <div key={lineage.id} className="text-sm border rounded p-3"><div className="flex justify-between"><span className="font-mono">{lineage.code}</span><Badge variant="outline">{labels[lineage.currentStation] || lineage.currentStation}</Badge></div><p className="text-muted-foreground">{lineage.createdAt ? new Date(lineage.createdAt).toLocaleString() : "Timestamp unavailable"}</p>{lineage.close && <p className="mt-1">Close: {lineage.close.id} · {lineage.close.ownerName || "owner snapshot unavailable"} · affiliate {lineage.close.affiliateId || "none"}</p>}{lineage.reward && <p className="mt-1">Reward: {lineage.reward.eligible ? "eligible" : lineage.reward.status}</p>}</div>)}</div>}</CardContent></Card>)}</section>
      </>}
    </div>
  );
}
