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
    | "execution_standards_mastery"
    | "system_intelligence_mastery"
    | "session_infrastructure_mastery"
    | "operating_system_retrieval"
    | "operating_system_transfer";
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
        detail: "You retrieved the required RI operating system after the spacing interval.",
        Icon: ShieldCheck,
      };
    }
    if (assessment.evidenceKind === "transfer") {
      return {
        label: "Transfer evidenced",
        detail: "You applied RI correctly across mixed operating situations.",
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
      label: "Not available yet",
      detail: "This check is not available yet.",
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
          : assessment.stage === "operating_system_retrieval"
            ? "Complete all Execution Standards, System Intelligence and Session Infrastructure Masteries first."
            : assessment.stage === "operating_system_transfer"
              ? "Pass the Operating System Retention Check first."
              : assessment.evidenceKind === "retrieval"
                ? "Master all five Transformation Deep Dives first."
                : "Pass the Transformation Retention Check first.",
      Icon: LockKeyhole,
    };
  }

  return {
    label: "No attempts remaining",
    detail: "No further attempt is currently available.",
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
                : assessment.stage === "operating_system_retrieval"
                  ? "Operating System Retention"
                  : assessment.stage === "operating_system_transfer"
                    ? "Operating System Application"
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

        {assessment.maxAttempts !== null ? (
          <p className="text-xs text-muted-foreground">
            {assessment.formSize} questions ·{" "}
            {Math.max(0, assessment.maxAttempts - assessment.attemptCount)} attempts remaining
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {assessment.formSize} questions
          </p>
        )}

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
  const executionStandards = assessments.filter(
    (entry) => entry.stage === "execution_standards_mastery",
  );
  const systemIntelligence = assessments.filter(
    (entry) => entry.stage === "system_intelligence_mastery",
  );
  const sessionInfrastructure = assessments.filter(
    (entry) => entry.stage === "session_infrastructure_mastery",
  );
  const operatingSystemGates = assessments.filter(
    (entry) =>
      entry.stage === "operating_system_retrieval" ||
      entry.stage === "operating_system_transfer",
  );
  const transformationMastered = transformationMastery.filter(
    (entry) => entry.status === "complete",
  ).length;
  const cumulativeComplete = transformationGates.filter(
    (entry) => entry.status === "complete",
  ).length;
  const operatingSystemComplete = operatingSystemGates.filter(
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
            Build operating understanding across all four Response Conditioning
            modules. The Transformation Mastery, Retention and Application gate
            opens Sandbox. Training then continues through Execution Standards,
            System Intelligence and Session Infrastructure before a final Operating
            System Retention and Application gate closes Capability Training.
          </p>
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            A Mastery Check contains 15 questions. A clean pass requires all 15
            correct. You have up to three attempts.
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

        <div className="grid gap-4 sm:grid-cols-4">
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
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Final OS Retention + Application
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {operatingSystemComplete}/2
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">1. Master the Transformation system</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each Deep Dive ends with a 15-question Mastery Check. You have up
              to three attempts to demonstrate a clean pass.
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
            <h2 className="text-xl font-semibold">3. Master Execution Standards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prove the delivery boundaries behind modelling, intervention, Controlled
              Discomfort problems, common execution failures, and Specialist self-regulation.
            </p>
          </div>
          {executionStandards.map((assessment, index) => (
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
            <h2 className="text-xl font-semibold">4. Master System Intelligence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prove you understand how RI-OS diagnoses, interprets prompts, establishes
              baselines, and resolves uncertainty instead of operating the runner blindly.
            </p>
          </div>
          {systemIntelligence.map((assessment, index) => (
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
            <h2 className="text-xl font-semibold">5. Master Session Infrastructure</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Continue Training against the actual session system: Diagnosis flow,
              drill authority, logging, Handover continuity, and live observability.
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

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">6. Prove the full operating system</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              After all 15 post-Sandbox Deep Dives are mastered, Retention tests
              whether the operating system can be recovered after spacing. Application
              then mixes execution, diagnosis, evidence, continuity and delivery so
              the governing rule must be identified from the situation itself.
            </p>
          </div>
          {operatingSystemGates.map((assessment, index) => (
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
