import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ExecutiveCommandRhythmDashboard from "@/pages/executive/command-rhythm-dashboard";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ExecutiveRole = "ceo" | "coo" | "hr" | "cto" | "cmo";

type ExecutiveUser = {
  id: string;
  email: string;
  name: string;
  role: ExecutiveRole;
};

type ExecutiveSeat = {
  role: ExecutiveRole;
  title: string;
  isFilled: boolean;
  appointedUser: ExecutiveUser | null;
  appointment: {
    id: string;
    notes: string | null;
    appointedAt: string | null;
  } | null;
  candidates: ExecutiveUser[];
};

type GatewayPayload = {
  canManageAppointments: boolean;
  seats: ExecutiveSeat[];
};

const ROLE_LABELS: Record<ExecutiveRole, string> = {
  ceo: "CEO",
  coo: "COO",
  hr: "HoHR",
  cto: "CTO",
  cmo: "CMO",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export default function CEOBoardPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const role = user?.role;
  const [seatSelections, setSeatSelections] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"dashboard" | "brain">("dashboard");

  const { data, isLoading, error } = useQuery<GatewayPayload>({
    queryKey: ["/api/executive/gateway"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: isAuthenticated ? 10000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!data?.seats) return;
    setSeatSelections((current) => {
      const next = { ...current };
      for (const seat of data.seats) {
        next[seat.role] = current[seat.role] || seat.appointedUser?.id || "vacant";
      }
      return next;
    });
  }, [data]);

  const manageSeatMutation = useMutation({
    mutationFn: async ({ seatRole, appointedUserId }: { seatRole: ExecutiveRole; appointedUserId: string | null }) => {
      const response = await apiRequest("PUT", `/api/executive/appointments/${seatRole}`, {
        appointedUserId,
      });
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/executive/gateway"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/executive/command-rhythm/overview"] }),
      ]);
      toast({
        title: "Appointment saved",
        description: "The executive seat map now reflects the CEO's decision.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Appointment failed",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return <div className="p-8">Loading CEO board...</div>;
  }

  if (!user || !role) {
    return <Navigate to="/executive/landing" replace />;
  }

  if (role !== "ceo") {
    return <Navigate to="/executive/gateway" replace />;
  }

  if (!data?.canManageAppointments) {
    return <Navigate to="/executive/gateway" replace />;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 rounded-xl border border-primary/15 bg-muted/20 p-1">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="brain">Brain</TabsTrigger>
      </TabsList>

      <TabsContent value="brain" className="space-y-6">
        <div className="p-6 md:p-8 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-[#E63946]" />
                CEO Appointment Board
              </CardTitle>
              <CardDescription>One active seat per role. Manage Core 5 command authority here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl bg-[#FFF0F0] p-5 text-sm text-[#5A5A5A]">
                <p>Seat authority is explicit and singular.</p>
                <p className="mt-2">Direction and command visibility should only flow through appointed seat holders.</p>
              </div>

              <div className="grid gap-4">
                {data.seats.map((seat) => (
                  <div key={seat.role} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{seat.title}</div>
                        <div className="text-sm text-slate-500">{ROLE_LABELS[seat.role]}</div>
                      </div>
                      <Badge variant={seat.isFilled ? "default" : "outline"}>
                        {seat.isFilled ? "Seat Filled" : "Seat Vacant"}
                      </Badge>
                    </div>

                    <div className="mt-3 text-sm text-slate-600">
                      {seat.appointedUser
                        ? `${seat.appointedUser.name} is the active operator.${seat.appointment?.appointedAt ? ` Appointed ${formatDate(seat.appointment.appointedAt)}.` : ""}`
                        : "No operator has been appointed to this seat yet."}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <Select
                        value={seatSelections[seat.role] || seat.appointedUser?.id || "vacant"}
                        onValueChange={(value) =>
                          setSeatSelections((current) => ({ ...current, [seat.role]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacant">Leave seat vacant</SelectItem>
                          {seat.candidates.map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        onClick={() =>
                          manageSeatMutation.mutate({
                            seatRole: seat.role,
                            appointedUserId:
                              (seatSelections[seat.role] || seat.appointedUser?.id || "vacant") === "vacant"
                                ? null
                                : seatSelections[seat.role] || seat.appointedUser?.id || null,
                          })
                        }
                        disabled={manageSeatMutation.isPending}
                        style={{ backgroundColor: "#E63946" }}
                      >
                        {manageSeatMutation.isPending ? "Saving..." : "Save Seat"}
                      </Button>
                    </div>

                    {seat.candidates.length === 0 ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        No executive identity exists yet for this role. That person must first create an executive account.
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Unable to fully refresh the board right now. Retry in a few seconds.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="dashboard" className="space-y-6">
        <ExecutiveCommandRhythmDashboard hideTabs />
      </TabsContent>
    </Tabs>
  );
}

