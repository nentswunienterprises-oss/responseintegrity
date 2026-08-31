import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExecutivePortalGuard } from "@/lib/portalGuard";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Brain, Shield, Users, Target } from "lucide-react";

interface HRStats {
  totalApplications: number;
  pendingApplications: number;
  approvedTutors: number;
  availableForPods: number;
  totalEnrollments: number;
  studentEnrollments: number;
  peopleCount?: number;
  openDisputes?: number;
}

export default function HRDashboard() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  // Fetch HR stats - refetch every 10 seconds to stay updated
  const { data: stats, isLoading: statsLoading } = useQuery<HRStats>({
    queryKey: ["/api/hr/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchIntervalInBackground: true, // Keep refetching even if tab is not focused
  });

  // Fetch leadership pilot requests for HR
  const { data: leadershipRequests = [], isLoading: leadershipLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/leadership-pilot-requests"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000,
  });

  // Fetch early intervention pilot requests for HR
  const { data: earlyInterventionRequests = [], isLoading: earlyInterventionLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/earlyintervention-requests"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000,
  });

  if (authLoading) {
    return <div>Loading...</div>;
  }

  const userRole = user?.role;

  return (
    <ExecutivePortalGuard role={userRole}>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Head of Human Resources</h1>
          <p className="text-muted-foreground">Specialist Management & Student Enrollment</p>
        </div>

        {/* Traffic Metrics */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {/* Specialist Applications - Split Card */}
          <Card className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground mb-3">Specialist Applications</p>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.totalApplications ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
              <div className="w-px h-12 bg-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.pendingApplications ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Pending</p>
              </div>
            </div>
          </Card>

          {/* Approved Specialists - Split Card */}
          <Card className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground mb-3">Approved Specialists</p>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.approvedTutors ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
              <div className="w-px h-12 bg-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.availableForPods ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Available</p>
              </div>
            </div>
          </Card>

          {/* Student Enrollments - Split Card */}
          <Card className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground mb-3">Student Enrollments</p>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.totalEnrollments ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
              <div className="w-px h-12 bg-border mx-3" />
              <div className="text-center flex-1">
                <p className="text-3xl font-bold">{statsLoading ? "-" : stats?.studentEnrollments ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">This Month</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Key Functions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Applications</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Review specialist applications and HR operational updates
            </p>
            <Button className="w-full" onClick={() => navigate("/executive/hr/applications")}>View Applications</Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Traffic Ownership</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Parent assignment and full traffic control are now managed in COO Traffic.
            </p>
            <Button className="w-full" variant="outline" disabled>Moved to COO</Button>
          </Card>
        </div>

        {/* Brain & Disputes Modules */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Brain</h2>
                <p className="text-xs text-muted-foreground">Institutional Memory</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              People Registry, Weekly Details, Projects, and Ideas. Nothing important lives only in people's heads.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {statsLoading ? "-" : stats?.peopleCount ?? 0} people
              </span>
            </div>
            <Button className="w-full" onClick={() => navigate("/executive/hr/brain")}>
              Open Brain
            </Button>
          </Card>

          <Card className="p-6 border-orange-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Shield className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Disputes</h2>
                <p className="text-xs text-muted-foreground">Conflict Resolution</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Issue logging, resolution tracking, and pattern detection. Keep culture clean without gossip.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                {statsLoading ? "-" : stats?.openDisputes ?? 0} open issues
              </span>
            </div>
            <Button className="w-full" variant="outline" onClick={() => navigate("/executive/hr/disputes")}>
              View Disputes
            </Button>
          </Card>

          {/* Leadership Pilot Requests */}
          <Card className="p-6 border-amber-200/40">
            <CardHeader>
              <h3 className="text-lg font-semibold">High School leadership Pilot Considerations</h3>
              <div className="text-sm text-muted-foreground">{leadershipLoading ? 'Loading...' : `${leadershipRequests.length} requests`}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-40 overflow-y-auto">
                {leadershipRequests.length > 0 ? (
                  leadershipRequests.slice(0,6).map((r: any) => (
                    <div key={r.id} className="p-3 rounded bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.school_name}</div>
                          <div className="text-xs text-muted-foreground">{r.contact_person_role} • {r.email}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  !leadershipLoading && (
                    <div className="py-6 text-center text-muted-foreground">No pilot requests yet.</div>
                  )
                )}
              </div>

              <div className="text-right">
                <Button size="sm" variant="outline" onClick={() => window.location.href = '/executive/hr/leadership-pilot-requests'}>View all</Button>
              </div>
            </CardContent>
          </Card>

          {/* Early Intervention Pilot Requests */}
          <Card className="p-6 border-amber-200/40">
            <CardHeader>
              <h3 className="text-lg font-semibold">Early Intervention pilot Considerations</h3>
              <div className="text-sm text-muted-foreground">{earlyInterventionLoading ? 'Loading...' : `${earlyInterventionRequests.length} requests`}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-40 overflow-y-auto">
                {earlyInterventionRequests.length > 0 ? (
                  earlyInterventionRequests.slice(0,6).map((r: any) => (
                    <div key={r.id} className="p-3 rounded bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.school_name}</div>
                          <div className="text-xs text-muted-foreground">{r.contact_person_role} • {r.email}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  !earlyInterventionLoading && (
                    <div className="py-6 text-center text-muted-foreground">No pilot requests yet.</div>
                  )
                )}
              </div>

              <div className="text-right">
                <Button size="sm" variant="outline" onClick={() => window.location.href = '/executive/hr/earlyintervention-requests'}>View all</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ExecutivePortalGuard>
  );
}
