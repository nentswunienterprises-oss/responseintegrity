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

type CapabilityAvailability = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  coveredDeepDiveKeys: string[];
  status: "unavailable" | "locked" | "available" | "complete";
  reason:
    | "bank_unavailable"
    | "attempt_limit"
    | "retry_cooldown"
    | "prerequisite_incomplete"
    | "spacing_interval"
    | null;
  unlockAt: string | null;
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
  passThresholdPercent: number;
  formSize: number;
  stage:
    | "transformation_mastery"
    | "transformation_retrieval"
    | "transformation_transfer"
    | "session_infrastructure_mastery";
};

type PodData = {
  assignment?: { id?: string | null } | null;
};

type CapabilityPlanResponse = {
  assessments: CapabilityAvailability[];
  sandboxReady: boolean;
};

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statePresentation(assessment: CapabilityAvailability) {
  if (assessment.status === "complete") {
    if (assessment.evidenceKind === "retrieval") {
      return {
        label: "Retention evidenced",
        detail: "You retrieved the Transformation system after the required spacing interval.",
        Icon: ShieldCheck,
      };
    }
    if (assessment.evidenceKind === "transfer") {
      return {
        label: "Transfer evidenced",
        detail: "You applied RI correctly across mixed Transformation situations.",
        Icon: ShieldCheck,
      };
    }
    return {
      label: "Mastered",
      detail: "A clean pass has evidenced this Deep Dive.",
      Icon: ShieldCheck,
    };
  }

  if (assessment.status === "available") {
    return {
      label: "Ready",
      detail:
        assessment.evidenceKind === "mastery"
          ? "Take a clean 15-question Mastery Check."
          : assessment.evidenceKind === "retrieval"
            ? "The spacing interval is complete. Your Retention Check is ready."
            : "Retention is evidenced. Your Application Check is ready.",
      Icon: PlayCircle,
    };
  }

  if (assessment.status === "unavailable") {
    return {
      label: "Authoring not complete",
      detail:
        "This gate is part of the approved Training architecture, but its private bank is not active yet.",
      Icon: LockKeyhole,
    };
  }

  if (assessment.reason === "spacing_interval") {
    return {
      label: "Waiting for spacing",
      detail: assessment.unlockAt
        ? `Retention Check opens ${new Date(assessment.unlockAt).toLocaleString()}.`
        : "The delayed Retrieval interval is still running.",
      Icon: Clock3,
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

  if (assessment.reason === "prerequisite_incomplete") {
    return {
      label: "Not yet open",
      detail:
        assessment.stage === "session_infrastructure_mastery"
          ? "Session Infrastructure opens after Transformation Mastery, Retention and Transfer unlock Sandbox."
          : assessment.evidenceKind === "retrieval"
            ? "Master all five Transformation Deep Dives first."
            : "Pass the Transformation Retention Check first.",
      Icon: LockKeyhole,
    };
  }

  return {
    label: "Review required",
    detail: "The current attempt allowance has been reached.",
    Icon: LockKeyhole,
  };
}

function actionLabel(assessment: CapabilityAvailability) {
  if (assessment.evidenceKind === "retrieval") return "Take Retention Check";
  if (assessment.evidenceKind === "transfer") return "Take Application Check";
  return "Take Mastery Check";
}

function CapabilityCard({
  assessment,
  index,
  navigate,
}: {
  assessment: CapabilityAvailability;
  index: number;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const presentation = statePresentation(assessment);
  const StateIcon = presentation.Icon;
  const deepDive =
    assessment.coveredDeepDiveKeys.length === 1
      ? humanize(assessment.coveredDeepDiveKeys[0])
      : assessment.title;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {assessment.evidenceKind === "mastery"
                ? `Deep Dive ${index + 1}`
                : assessment.evidenceKind === "retrieval"
                  ? "Transformation Retention"
                  : "Transformation Application"}
            </p>
            <CardTitle className="mt-1 text-lg">{deepDive}</CardTitle>
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

        {assessment.bankVersion !== null && assessment.maxAttempts !== null ? (
          <p className="text-xs text-muted-foreground">
            Private bank v{assessment.bankVersion} · Attempts used:{" "}
            {assessment.attemptCount}/{assessment.maxAttempts}
            {" · "}
            {assessment.formSize} questions
          </p>
        ) : null}

        {assessment.status === "available" ? (
          <Button
            onClick={() =>
              navigate(
                `/operational/specialist/capability/${assessment.assessmentKey}`,
              )
            }
          >
            {actionLabel(assessment)}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SpecialistCapabilityPlan() {
  const navigate = useNavigate();
  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const planQuery = useQuery<CapabilityPlanResponse>({
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
      return (await response.json()) as CapabilityPlanResponse;
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
  const sandboxReady = Boolean(planQuery.data?.sandboxReady);
  const transformationMastery = assessments.filter(
    (entry) => entry.stage === "transformation_mastery",
  );
  const transformationGates = assessments.filter(
    (entry) =>
      entry.stage === "transformation_retrieval" ||
      entry.stage === "transformation_transfer",
  );
  const sessionInfrastructure = assessments.filter(
    (entry) => entry.stage === "session_infrastructure_mastery",
  );
  const transformationMastered = transformationMastery.filter(
    (entry) => entry.status === "complete",
  ).length;
  const cumulativeComplete = transformationGates.filter(
    (entry) => entry.status === "complete",
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
            Training · Capability
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Capability Path
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Master each Transformation Deep Dive, prove you still retain the
            system later, then prove you can apply it across mixed situations.
            That evidence unlocks Sandbox.
          </p>
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            A Mastery Check is a clean pass: 15/15 with no critical boundary
            failure. You have up to three total attempts. Retries prefer unseen
            questions from the approved 45-item bank.
          </AlertDescription>
        </Alert>

        {planQuery.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Capability status could not be loaded. No Training progress has changed.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Transformation Mastery
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {transformationMastered}/5
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Retention + Application
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {cumulativeComplete}/2
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Sandbox
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {sandboxReady ? "Unlocked" : "Locked"}
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">1. Master the Transformation system</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each Deep Dive has a 45-item private bank. Each attempt draws a
              balanced 15-question form.
            </p>
          </div>
          {transformationMastery.map((assessment, index) => (
            <CapabilityCard
              key={assessment.assessmentKey}
              assessment={assessment}
              index={index}
              navigate={navigate}
            />
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">2. Prove retention and transfer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Retention removes the immediate Deep Dive context. Application
              then mixes situations so you must identify the correct RI response.
            </p>
          </div>
          {transformationGates.map((assessment, index) => (
            <CapabilityCard
              key={assessment.assessmentKey}
              assessment={assessment}
              index={index}
              navigate={navigate}
            />
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">3. Continue Training inside Sandbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sandbox is not Training completion. It gives you a protected
              operating environment so Session Infrastructure can be learned
              against the system you will actually use.
            </p>
          </div>
          {sessionInfrastructure.map((assessment, index) => (
            <CapabilityCard
              key={assessment.assessmentKey}
              assessment={assessment}
              index={index}
              navigate={navigate}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
