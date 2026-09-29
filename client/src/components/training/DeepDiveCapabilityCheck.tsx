import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, LockKeyhole, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MasteryAvailability = {
  assessmentKey: string;
  title: string;
  coveredDeepDiveKeys: string[];
  status: "unavailable" | "locked" | "available" | "complete";
  reason: "bank_unavailable" | "attempt_limit" | "retry_cooldown" | null;
  unlockAt: string | null;
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
};

type PodData = {
  assignment?: { id?: string | null } | null;
};

function CapabilityState({ assessment }: { assessment: MasteryAvailability }) {
  if (assessment.status === "complete") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Complete
      </div>
    );
  }

  if (assessment.status === "available") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <PlayCircle className="h-4 w-4" />
        Ready
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <LockKeyhole className="h-4 w-4" />
      {assessment.status === "locked" ? "Locked" : "Not available yet"}
    </div>
  );
}

export function DeepDiveCapabilityCheck({
  assessmentKey,
  compact = false,
}: {
  assessmentKey: string;
  compact?: boolean;
}) {
  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const planQuery = useQuery<{ assessments: MasteryAvailability[] }>({
    queryKey: ["capability-mastery-plan", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-plan?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as { assessments: MasteryAvailability[] };
    },
  });

  if (!tutorAssignmentId || podQuery.error) return null;

  if (planQuery.error) {
    return compact ? null : (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Mastery status could not be loaded. Your Training progress has not changed.
        </AlertDescription>
      </Alert>
    );
  }

  const assessment = planQuery.data?.assessments.find(
    (entry) => entry.assessmentKey === assessmentKey,
  );

  if (!assessment) return null;

  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-muted/20 px-3 py-2">
        <CapabilityState assessment={assessment} />
        {assessment.status === "available" ? (
          <Button size="sm" asChild>
            <Link to={`/operational/specialist/capability/${assessment.assessmentKey}`}>
              Begin
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
          Deep Dive Mastery
        </p>
        <h2 className="mt-1 text-2xl font-bold">{assessment.title.replace(/\\s+Mastery Check$/i, "")}</h2>
      </div>

      <CapabilityState assessment={assessment} />

      <p className="text-sm text-muted-foreground">
        Demonstrate operating understanding and scenario judgment from the active private assessment bank.
      </p>

      {assessment.maxAttempts !== null ? (
        <p className="text-xs text-muted-foreground">
          Bank v{assessment.bankVersion} · attempts {assessment.attemptCount}/{assessment.maxAttempts}
        </p>
      ) : null}

      {assessment.status === "available" ? (
        <Button asChild>
          <Link to={`/operational/specialist/capability/${assessment.assessmentKey}`}>
            Begin Mastery
          </Link>
        </Button>
      ) : null}

      {assessment.status === "locked" && assessment.unlockAt ? (
        <p className="text-xs text-muted-foreground">
          Retry opens {new Date(assessment.unlockAt).toLocaleString()}.
        </p>
      ) : null}

      {assessment.status === "unavailable" ? (
        <p className="text-xs text-muted-foreground">
          The approved private bank for this Deep Dive is not active yet.
        </p>
      ) : null}
    </Card>
  );
}
