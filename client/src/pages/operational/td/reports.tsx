import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";

interface WeeklyCheckIn {
  id: string;
  tutorId: string;
  podId: string;
  weekStartDate: string;
  sessionsSummary: string;
  wins: string;
  challenges: string;
  helpNeeded?: string;
  nextWeekGoals: string;
  submittedAt: string;
  tutor?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function TDReports() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: checkIns,
    isLoading,
    error,
  } = useQuery<WeeklyCheckIn[]>({
    queryKey: ["/api/td/tutor-check-ins"],
    enabled: isAuthenticated && !authLoading,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [error, toast]);

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Specialist Updates</h1>
          <p className="text-muted-foreground">
            Read the latest specialist-submitted updates. Development Pathway standing remains the authoritative operational record.
          </p>
        </div>

        {!checkIns || checkIns.length === 0 ? (
          <Card className="p-12 text-center border">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No check-ins yet</p>
            <p className="text-sm text-muted-foreground">
              Tutors haven't submitted their weekly check-ins yet
            </p>
          </Card>
        ) : (
          <div className="grid gap-6">
            {checkIns.map((checkIn) => (
              <Card key={checkIn.id} className="overflow-hidden border-border/60">
                {/* Header */}
                <div className="border-b border-border/60 bg-muted/20 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="mb-1 text-lg font-bold text-foreground">
                        {checkIn.tutor?.name || "Unknown Tutor"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{checkIn.tutor?.email || "Email not recorded"}</p>
                    </div>
                    <Badge variant="outline" className="whitespace-nowrap">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(checkIn.weekStartDate), "MMM d, yyyy")}
                    </Badge>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="p-6 grid md:grid-cols-2 gap-6">
                  {/* Sessions Summary */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Sessions summary</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{checkIn.sessionsSummary || "Not recorded"}</p>
                  </div>

                  {/* Wins */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-emerald-400">Wins</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{checkIn.wins || "Not recorded"}</p>
                  </div>

                  {/* Challenges */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-amber-400">Challenges</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{checkIn.challenges || "Not recorded"}</p>
                  </div>

                  {/* Next Week Goals */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-sky-400">Next steps</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{checkIn.nextWeekGoals || "Not recorded"}</p>
                  </div>

                  {/* Help Needed - if present */}
                  {checkIn.helpNeeded && (
                    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 md:col-span-2">
                      <h4 className="text-sm font-semibold text-amber-300">Support requested</h4>
                      <p className="text-sm leading-relaxed text-amber-100">{checkIn.helpNeeded}</p>
                    </div>
                  )}
                </div>

                {/* Footer with timestamp */}
                <div className="border-t border-border/60 bg-muted/10 px-6 py-3 text-xs text-muted-foreground">
                  Submitted: {format(new Date(checkIn.submittedAt), "MMMM d, yyyy 'at' h:mm a")}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

