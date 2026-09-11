import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Layers3,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Video,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CapabilityAssessmentAvailability = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  coveredDeepDiveKeys: string[];
  status: "unavailable" | "locked" | "available" | "complete";
  reason: "bank_unavailable" | "prerequisite_missing" | "spacing_window" | "attempt_limit" | "retry_cooldown" | null;
  missingPrerequisiteCodes: string[];
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
    .replace(/^deep_dive\./, "")
    .replace(/\.(mastery|retrieval|transfer)$/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function kindTitle(kind: CapabilityAssessmentAvailability["evidenceKind"]) {
  if (kind === "mastery") return "Deep Dive mastery";
  if (kind === "retrieval") return "Delayed retrieval";
  return "Interleaved transfer";
}

function statePresentation(assessment: CapabilityAssessmentAvailability) {
  if (assessment.status === "complete") {
    return {
      label: "Complete",
      detail: "Current evidence satisfies every capability cell carried by this assessment.",
      Icon: ShieldCheck,
    };
  }
  if (assessment.status === "available") {
    return {
      label: "Available",
      detail: "The private bank is active and all prerequisites are satisfied.",
      Icon: PlayCircle,
    };
  }
  if (assessment.status === "unavailable") {
    return {
      label: "Bank not active",
      detail: "This assessment is planned, but its private bank is not active yet.",
      Icon: LockKeyhole,
    };
  }
  if (assessment.reason === "prerequisite_missing") {
    const missing = assessment.missingPrerequisiteCodes.map(humanize).join(", ");
    return {
      label: "Locked",
      detail: missing ? `Complete prerequisite evidence first: ${missing}.` : "Prerequisite capability evidence is incomplete.",
      Icon: LockKeyhole,
    };
  }
  if (assessment.reason === "spacing_window" || assessment.reason === "retry_cooldown") {
    return {
      label: "Timed lock",
      detail: assessment.unlockAt
        ? `Unlocks ${new Date(assessment.unlockAt).toLocaleString()}.`
        : "The required spacing window has not elapsed yet.",
      Icon: Clock3,
    };
  }
  return {
    label: "Review required",
    detail: "The current-bank attempt allowance has been reached. Further attempts require review or a new bank version.",
    Icon: LockKeyhole,
  };
}

export default function SpecialistCapabilityPlan() {
  const navigate = useNavigate();
  const podQuery = useQuery<PodData>({ queryKey: ["/api/tutor/pod"], retry: false });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const planQuery = useQuery<{ assessments: CapabilityAssessmentAvailability[] }>({
    queryKey: ["capability-plan", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-plan?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as { assessments: CapabilityAssessmentAvailability[] };
    },
  });

  if (podQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading Specialist assignment...</div>;
  }

  if (podQuery.error || !tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>A Specialist assignment is required before the capability plan can be evaluated.</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Specialist Pod
          </Button>
        </div>
      </div>
    );
  }

  const assessments = planQuery.data?.assessments || [];
  const completedCount = assessments.filter((assessment) => assessment.status === "complete").length;
  const availableCount = assessments.filter((assessment) => assessment.status === "available").length;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate("/responseconditioningsystem")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to RI-OS
            </Button>
            <p className="text-sm font-medium text-muted-foreground">Capability Engine - Specialist Evidence Plan</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">16 checks. 33 capability cells.</h1>
            <p className="mt-2 max-w-4xl text-muted-foreground">
              Mastery proves immediate operating understanding. Delayed retrieval checks whether it survives spacing. Interleaved transfer checks whether you can identify and apply the right rule without being told which Deep Dive is being tested.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/operational/specialist/capability-practicals")}>
            <Video className="mr-2 h-4 w-4" /> Practical evidence
          </Button>
        </div>

        <Alert>
          <Layers3 className="h-4 w-4" />
          <AlertDescription>
            This is shadow capability evidence. It cannot certify you, change your operational mode, open Trial, or replace the current Sandbox Mock Gate.
          </AlertDescription>
        </Alert>

        {planQuery.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>The capability plan could not be evaluated. No training or certification state has changed.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned digital checks</p>
              <p className="mt-2 text-3xl font-semibold">{assessments.length || 16}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Complete</p>
              <p className="mt-2 text-3xl font-semibold">{completedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Available now</p>
              <p className="mt-2 text-3xl font-semibold">{availableCount}</p>
            </CardContent>
          </Card>
        </div>

        {(["mastery", "retrieval", "transfer"] as const).map((kind) => {
          const group = assessments.filter((assessment) => assessment.evidenceKind === kind);
          return (
            <section key={kind} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{kindTitle(kind)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {kind === "mastery"
                    ? "One focused mastery check per implemented Deep Dive."
                    : kind === "retrieval"
                      ? "Cumulative checks unlock only after the underlying mastery evidence has aged through the spacing floor."
                      : "Mixed scenarios unlock only after the required retrieval evidence and spacing floor."}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {group.map((assessment) => {
                  const presentation = statePresentation(assessment);
                  const StateIcon = presentation.Icon;
                  return (
                    <Card key={assessment.assessmentKey}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">{assessment.title}</CardTitle>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {assessment.coveredDeepDiveKeys.map(humanize).join(" - ")}
                            </p>
                          </div>
                          <StateIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {assessment.status === "complete" && <CheckCircle2 className="h-4 w-4" />}
                            {presentation.label}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{presentation.detail}</p>
                        </div>

                        {assessment.maxAttempts !== null && (
                          <p className="text-xs text-muted-foreground">
                            Current bank v{assessment.bankVersion} - attempts {assessment.attemptCount}/{assessment.maxAttempts}
                          </p>
                        )}

                        {assessment.status === "available" && (
                          <Button
                            onClick={() => navigate(`/operational/specialist/capability/${assessment.assessmentKey}`)}
                          >
                            Take assessment
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
