import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MasteryAvailability = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery";
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

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statePresentation(assessment: MasteryAvailability) {
  if (assessment.status === "complete") {
    return {
      label: "Mastery evidenced",
      detail: "You have passed the current approved bank for this Deep Dive.",
      Icon: ShieldCheck,
    };
  }
  if (assessment.status === "available") {
    return {
      label: "Ready",
      detail: "The Founder-approved private bank is active and this mastery check can be taken.",
      Icon: PlayCircle,
    };
  }
  if (assessment.status === "unavailable") {
    return {
      label: "Authoring not complete",
      detail: "This Deep Dive remains in the Capability plan, but its approved private bank is not active yet.",
      Icon: LockKeyhole,
    };
  }
  if (assessment.reason === "retry_cooldown") {
    return {
      label: "Retry locked",
      detail: assessment.unlockAt
        ? `Retry opens ${new Date(assessment.unlockAt).toLocaleString()}.`
        : "The retry window has not opened yet.",
      Icon: Clock3,
    };
  }
  return {
    label: "Review required",
    detail: "The current bank attempt allowance has been reached.",
    Icon: LockKeyhole,
  };
}

export default function SpecialistCapabilityPlan() {
  const navigate = useNavigate();
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
        `/api/tutor/capability-plan?tutorAssignmentId=${encodeURIComponent(
          tutorAssignmentId,
        )}`,
      );
      return (await response.json()) as { assessments: MasteryAvailability[] };
    },
  });

  if (podQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading Specialist assignment...
      </div>
    );
  }

  if (podQuery.error || !tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A Specialist assignment is required before Capability Checks can begin.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Specialist Pod
          </Button>
        </div>
      </div>
    );
  }

  const assessments = planQuery.data?.assessments || [];
  const completeCount = assessments.filter(
    (assessment) => assessment.status === "complete",
  ).length;
  const availableCount = assessments.filter(
    (assessment) => assessment.status === "available",
  ).length;
  const activeCount = assessments.filter(
    (assessment) => assessment.bankVersion !== null,
  ).length;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div>
          <Button
            variant="ghost"
            className="-ml-3 mb-3"
            onClick={() => navigate("/operational/specialist/response-integrity-os")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Response Integrity OS
          </Button>
          <p className="text-sm font-medium text-muted-foreground">
            Training · Capability Engine
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Deep Dive Capability Checks
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Each active check draws a deterministic 15-question form from the
            Founder-approved private bank for that Deep Dive. The assessment tests
            operating understanding and scenario judgment; it does not replace
            Sandbox observation, Practical execution, Trial, or Certification.
          </p>
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Authoring is intentionally staged. Completed banks can run now; unfinished
            banks remain unavailable rather than falling back to older generated content.
          </AlertDescription>
        </Alert>

        {planQuery.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Capability status could not be loaded. No Training progress has changed.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Mastery banks
              </p>
              <p className="mt-2 text-3xl font-semibold">{assessments.length || 11}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Active approved banks
              </p>
              <p className="mt-2 text-3xl font-semibold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Mastery evidenced
              </p>
              <p className="mt-2 text-3xl font-semibold">{completeCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {assessments.map((assessment, index) => {
            const presentation = statePresentation(assessment);
            const StateIcon = presentation.Icon;
            const deepDive = assessment.coveredDeepDiveKeys[0] || assessment.assessmentKey;

            return (
              <Card key={assessment.assessmentKey}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Deep Dive {index + 1}
                      </p>
                      <CardTitle className="mt-1 text-lg">
                        {humanize(deepDive)}
                      </CardTitle>
                    </div>
                    <StateIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">{presentation.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {presentation.detail}
                    </p>
                  </div>

                  {assessment.maxAttempts !== null && (
                    <p className="text-xs text-muted-foreground">
                      Private bank v{assessment.bankVersion} · attempts{" "}
                      {assessment.attemptCount}/{assessment.maxAttempts}
                    </p>
                  )}

                  {assessment.status === "available" && (
                    <Button
                      onClick={() =>
                        navigate(
                          `/operational/specialist/capability/${assessment.assessmentKey}`,
                        )
                      }
                    >
                      Take Capability Check
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {availableCount === 0 && assessments.length > 0 && (
          <p className="text-sm text-muted-foreground">
            No additional mastery check is available right now.
          </p>
        )}
      </div>
    </div>
  );
}
