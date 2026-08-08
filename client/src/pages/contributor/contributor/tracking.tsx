import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getQueryFn } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

type FilterType = "leads" | "closes";

export default function ContributorTracking() {
  const [filter, setFilter] = useState<FilterType>("leads");
  const [search, setSearch] = useState("");

  // Compatibility note: contributor template still uses affiliate endpoints in MVP.
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["/api", "affiliate", "leads"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: closes = [] } = useQuery<any[]>({
    queryKey: ["/api", "affiliate", "closes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const totalRewards = closes.reduce((sum: number, close: any) => {
    const amount = Number(close.commission_amount || 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const stats = [
    { label: "Leads", value: leads.length, filter: "leads" as const },
    { label: "Subscriptions", value: closes.length, filter: "closes" as const },
  ];

  const activeRecords = (filter === "closes" ? closes : leads).filter((record: any) => {
    const name = String(record.parent_name || "").toLowerCase();
    const email = String(record.parent_email || "").toLowerCase();
    const query = search.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">Contributor Tracking</h1>
          <p className="text-sm sm:text-lg text-muted-foreground">
            Monitor lead flow, verified subscriptions, and production rewards from your contributor pipeline.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          {stats.map((stat) => (
            <button
              key={stat.filter}
              type="button"
              onClick={() => setFilter(stat.filter)}
              className={`rounded-lg border p-3 sm:p-8 text-center transition-colors ${
                filter === stat.filter ? "border-primary bg-primary text-primary-foreground" : "bg-card text-card-foreground"
              }`}
            >
              <p className="text-2xl sm:text-5xl font-bold">{stat.value}</p>
              <p className="mt-1 text-[10px] sm:text-sm uppercase tracking-wide font-medium">{stat.label}</p>
            </button>
          ))}
          <Card className="p-3 sm:p-8 border shadow-sm text-center">
            <p className="text-2xl sm:text-5xl font-bold text-foreground">R{totalRewards.toFixed(2)}</p>
            <p className="mt-1 text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wide font-medium">
              Production Rewards
            </p>
          </Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          {stats.map((stat) => (
            <Button
              key={stat.filter}
              variant={filter === stat.filter ? "default" : "outline"}
              onClick={() => setFilter(stat.filter)}
              size="sm"
            >
              {stat.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground sm:top-3 sm:h-5 sm:w-5" />
            <Input
              placeholder={`Search ${filter === "leads" ? "leads" : "subscriptions"} by parent name or email.`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 sm:pl-10 py-4 sm:py-6 text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {activeRecords.length === 0 ? (
            <Card className="p-6 sm:p-12 text-center">
              <p className="text-sm sm:text-lg text-muted-foreground">
                {filter === "leads" ? "No leads found." : "No subscriptions found."}
              </p>
            </Card>
          ) : (
            activeRecords.map((record: any) => (
              <Card key={record.id || record.close_id || record.lead_id} className="p-3 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-lg font-bold">{record.parent_name || "Unnamed parent"}</h3>
                      {record.parent_email && (
                        <p className="mt-1 text-xs sm:text-sm text-muted-foreground break-all">{record.parent_email}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="font-semibold text-foreground">{filter === "closes" ? "Subscribed" : "Created"}</p>
                        <p className="text-muted-foreground">
                          {new Date(record.closed_at || record.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {filter === "closes" && (
                        <div>
                          <p className="font-semibold text-foreground">Production Reward</p>
                          <p className="text-muted-foreground">R{Number(record.commission_amount || 0).toFixed(2)}</p>
                        </div>
                      )}

                      {filter === "closes" && record.commission_status && (
                        <div>
                          <p className="font-semibold text-foreground">Reward Status</p>
                          <p className="text-muted-foreground capitalize">{record.commission_status}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block text-right">
                    <span
                      className={`inline-block rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap ${
                        filter === "closes"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      }`}
                    >
                      {filter === "closes" ? "Subscription" : "Lead"}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
