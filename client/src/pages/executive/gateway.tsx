import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, FileText } from "lucide-react";
import { ExecutivePortalGuard } from "@/lib/portalGuard";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";

type ExecutiveRole = "ceo" | "coo" | "hr" | "cto" | "cmo";

type ExecutiveUser = {
  id: string;
  email: string;
  name: string;
  role: ExecutiveRole;
};

type GatewayPayload = {
  executiveRoleOptions: Array<{ role: ExecutiveRole; title: string }>;
  currentUser: ExecutiveUser;
  mySeat: {
    role: ExecutiveRole;
    title: string;
    isFilled: boolean;
    isCurrentUserAppointed: boolean;
    appointedUser: ExecutiveUser | null;
  } | null;
  bootstrapMode: boolean;
  canManageAppointments: boolean;
  dashboardRoute: string;
};

const ROLE_LABELS: Record<ExecutiveRole, string> = {
  ceo: "CEO",
  coo: "COO",
  hr: "HoHR",
  cto: "CTO",
  cmo: "CMO",
};

export default function ExecutiveGateway() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const role = user?.role as ExecutiveRole | undefined;

  const { data, isLoading, error } = useQuery<GatewayPayload>({
    queryKey: ["/api/executive/gateway"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: isAuthenticated ? 10000 : false,
    refetchIntervalInBackground: true,
  });

  const accessState = useMemo(() => {
    if (!data?.mySeat) return "pending";
    if (data.mySeat.isCurrentUserAppointed) {
      return data.bootstrapMode && role === "ceo" ? "bootstrap" : "appointed";
    }
    return "pending";
  }, [data, role]);

  const stageStatus = useMemo(() => {
    const seatFilled = Boolean(data?.mySeat?.isFilled);
    const commandOpen = accessState === "appointed" || accessState === "bootstrap";
    return {
      identity: true,
      appointment: seatFilled || accessState === "bootstrap",
      authority: commandOpen,
      command: commandOpen,
    };
  }, [accessState, data?.mySeat?.isFilled]);

  if (authLoading || isLoading) {
    return <div className="p-8">Loading executive gateway...</div>;
  }

  if (!user || !role) {
    return <div className="p-8">Executive access required.</div>;
  }

  return (
    <ExecutivePortalGuard role={role}>
      <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
        <header className="fixed left-0 right-0 top-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:h-20 sm:px-6 md:px-12">
            <div className="w-10 md:hidden" aria-hidden="true" />
            <div className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 justify-center sm:static sm:w-auto sm:translate-x-0 sm:translate-y-0">
              <ResponseIntegrityLogo size="md" variant="integrity" />
            </div>
            <div className="hidden md:block">
              <span className="text-xl font-bold tracking-tight text-[#1A1A1A] lg:text-3xl">Executive Gateway</span>
            </div>
            <Button variant="ghost" className="hidden items-center gap-2 hover:bg-transparent md:inline-flex" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </header>

        <div className="container mx-auto flex justify-center px-3 pb-6 pt-24 sm:px-4">
          <div className="flex w-full max-w-2xl items-center justify-between overflow-x-auto">
            {[
              { label: "Identity", status: stageStatus.identity },
              { label: "Appointment", status: stageStatus.appointment },
              { label: "Authority", status: stageStatus.authority },
              { label: "Command", status: stageStatus.command },
            ].map((item, index, all) => (
              <div key={item.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                    style={{
                      backgroundColor: item.status ? "#E63946" : "transparent",
                      borderColor: item.status ? "#E63946" : "#D1D5DB",
                      color: item.status ? "white" : "#9CA3AF",
                    }}
                  >
                    {item.status ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <span className="mt-2 text-xs font-medium text-[#1A1A1A]">{item.label}</span>
                </div>
                {index < all.length - 1 ? (
                  <div className="mx-2 h-0.5 flex-1" style={{ backgroundColor: item.status ? "#E63946" : "#E5E5E5" }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="container mx-auto max-w-3xl px-3 pb-10 sm:px-4">
          {accessState === "pending" ? (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Awaiting CEO Appointment</CardTitle>
                <CardDescription>Executive identity exists. Command authority is still locked.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-2xl bg-[#FFF0F0] p-5 text-sm text-[#5A5A5A]">
                  <p>This gateway confirms entry, not command.</p>
                  <p className="mt-2">Only the CEO can appoint the active seat holder for each Core 5 executive function.</p>
                  <p className="mt-2 font-semibold text-[#1A1A1A]">Until your seat is appointed, you should not appear in the live command rhythm.</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  {data?.mySeat?.appointedUser
                    ? `${data.mySeat.appointedUser.name} currently holds the ${data.mySeat.title} seat.`
                    : `The ${data?.mySeat?.title || ROLE_LABELS[role]} seat is currently unassigned.`}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {(accessState === "appointed" || accessState === "bootstrap") ? (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-center">
                  <CheckCircle2 className="h-5 w-5 text-[#E63946]" />
                  <span>{accessState === "bootstrap" ? "Bootstrap Command Access Open" : "Executive Seat Active"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  {accessState === "bootstrap"
                    ? "No executive roster has been established yet. As CEO, you can stand up the active Core 5 from this gateway."
                    : `You are the appointed ${data?.mySeat?.title || ROLE_LABELS[role]} seat holder. Command access is open.`}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">Seat record</div>
                      <div className="mt-1">{data?.mySeat?.appointedUser?.name || user.name || user.email}</div>
                    </div>
                    <Badge className="bg-slate-900 text-white">{ROLE_LABELS[role]}</Badge>
                  </div>
                  {data?.mySeat?.appointedUser ? (
                    <div className="mt-3 text-xs text-slate-500">
                      Active operator for this role: {data.mySeat.appointedUser.name}
                    </div>
                  ) : null}
                </div>

                <Button
                  className="w-full rounded-full"
                  size="lg"
                  style={{ backgroundColor: "#E63946" }}
                  onClick={() => navigate(data?.dashboardRoute || `/executive/${role}/dashboard`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Enter Command
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {data?.canManageAppointments ? (
            <Card className="mt-6 border-0 shadow-lg">
              <CardHeader>
                <CardTitle>CEO Appointment Board</CardTitle>
                <CardDescription>Seat assignment now lives on a dedicated UI page, not in the gateway.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-[#FFF0F0] p-5 text-sm text-[#5A5A5A]">
                  <p>Use the CEO brain page to appoint active seat holders for the Core 5.</p>
                  <p className="mt-2">Gateway remains for identity and authority staging only.</p>
                </div>

                <Button className="w-full rounded-full" style={{ backgroundColor: "#E63946" }} onClick={() => navigate("/executive/ceo/board")}>
                  Open CEO Brain
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {error && !data?.canManageAppointments ? (
            <Card className="mt-6">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-red-600">Unable to load your executive gateway right now.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </ExecutivePortalGuard>
  );
}
