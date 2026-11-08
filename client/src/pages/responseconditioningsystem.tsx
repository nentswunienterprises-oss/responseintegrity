import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { trainingMilestone } from "@/lib/training-milestone";
import {
  isCapabilityAssessmentBlocked,
  isDeepDiveModuleBlocked,
} from "@/lib/responseConditioningAccess";

const modules = [
  {
    id: "1",
    title: "Transformation Phases",
    subtitle: "What happens to the student",
    items: [
      {
        label: "Topic Conditioning",
        href: "/responseconditioningsystem/transformation-phases/topic-conditioning",
        capabilityKey: "topic_conditioning",
      },
      {
        label: "Clarity",
        href: "/responseconditioningsystem/clarity",
        capabilityKey: "clarity",
      },
      {
        label: "Structured Execution",
        href: "/responseconditioningsystem/structured-execution",
        capabilityKey: "structured_execution",
      },
      {
        label: "Controlled Discomfort",
        href: "/responseconditioningsystem/controlled-discomfort",
        capabilityKey: "controlled_discomfort",
      },
      {
        label: "Time Pressure Stability",
        href: "/responseconditioningsystem/time-pressure-stability",
        capabilityKey: "time_pressure_stability",
      },
    ],
  },
  {
    id: "2",
    title: "Execution Standards",
    subtitle: "How specialists must operate",
    items: [
      {
        label: "How to model",
        href: "/responseconditioningsystem/execution-standards/how-to-model",
        capabilityKey: "how_to_model",
      },
      {
        label: "How to intervene",
        href: "/responseconditioningsystem/execution-standards/how-to-intervene",
        capabilityKey: "how_to_intervene",
      },
      {
        label: "How to use Boss Battles",
        href: "/responseconditioningsystem/execution-standards/how-to-use-boss-battles",
        capabilityKey: "how_to_use_boss_battles",
      },
      {
        label: "What not to do",
        href: "/responseconditioningsystem/execution-standards/what-not-to-do",
        capabilityKey: "what_not_to_do",
      },
      {
        label: "Emotional discipline under discomfort",
        href: "/responseconditioningsystem/execution-standards/emotional-discipline-under-discomfort",
        capabilityKey: "emotional_discipline_under_discomfort",
      },
    ],
  },
  {
    id: "3",
    title: "System Intelligence",
    subtitle: "How RI-OS reasons from evidence",
    items: [
      {
        label: "How to diagnose",
        href: "/responseconditioningsystem/system-intelligence/how-to-diagnose",
        capabilityKey: "how_to_diagnose",
      },
      {
        label: "Why training continues beyond Clarity",
        href: "/responseconditioningsystem/system-intelligence/why-training-continues-beyond-clarity",
        capabilityKey: "why_training_continues_beyond_clarity",
      },
      {
        label: "How to interpret prompts",
        href: "/responseconditioningsystem/system-intelligence/how-to-interpret-prompts",
        capabilityKey: "how_to_interpret_prompts",
      },
      {
        label: "How baselines are established",
        href: "/responseconditioningsystem/system-intelligence/how-baselines-are-established",
        capabilityKey: "how_baselines_are_established",
      },
      {
        label: "How the system resolves uncertainty",
        href: "/responseconditioningsystem/system-intelligence/how-the-system-resolves-uncertainty",
        capabilityKey: "how_the_system_resolves_uncertainty",
      },
    ],
  },
  {
    id: "4",
    title: "Session Infrastructure",
    subtitle: "How the system is executed and tracked",
    items: [
      {
        label: "Intro session structure",
        href: "/responseconditioningsystem/session-infrastructure/intro-session-structure",
        capabilityKey: "intro_session_structure",
      },
      {
        label: "Session flow control",
        href: "/responseconditioningsystem/session-infrastructure/session-flow-control",
        capabilityKey: "session_flow_control",
      },
      {
        label: "Drill Library",
        href: "/responseconditioningsystem/session-infrastructure/drill-library",
        capabilityKey: "drill_library",
      },
      {
        label: "Logging system",
        href: "/responseconditioningsystem/session-infrastructure/logging-system",
        capabilityKey: "logging_system",
      },
      {
        label: "Handover verification",
        href: "/responseconditioningsystem/session-infrastructure/handover-verification",
        capabilityKey: "handover_verification",
      },
      {
        label: "Tools required",
        href: "/responseconditioningsystem/session-infrastructure/tools-required",
        capabilityKey: "tools_required",
      },
    ],
  },
];

type MasteryAvailability = {
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
  formSize: number;
};

type PodData = {
  assignment?: { id?: string | null; operationalMode?: string } | null;
};

type CapabilityStageGate = {
  mode: string;
  capabilityTrainingAllowed: boolean;
  sandboxQualificationRequired: boolean;
  sandboxQualificationReady: boolean | null;
  developmentCoverageReady: boolean | null;
  qualifyingSessions: number | null;
  requiredSessions: number | null;
  phaseCounts: Record<string, number> | null;
  phaseMinimums: Record<string, number> | null;
  reason: string;
};

export default function ResponseConditioningSystem() {
  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const capabilityPlanQuery = useQuery<{
    assessments: MasteryAvailability[];
    stageGate?: CapabilityStageGate;
  }>({
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

  const capabilityAssessments = capabilityPlanQuery.data?.assessments || [];
  const masteryAssessments = capabilityAssessments.filter(
    (assessment) => assessment.evidenceKind === "mastery",
  );
  const cumulativeAssessments = capabilityAssessments.filter(
    (assessment) =>
      assessment.evidenceKind === "retrieval" ||
      assessment.evidenceKind === "transfer",
  );
  const showCumulativeAssessments = cumulativeAssessments.some(
    (assessment) => assessment.status !== "unavailable",
  );
  const completedCapabilityChecks = masteryAssessments.filter(
    (assessment) => assessment.status === "complete",
  ).length;
  const totalCapabilityChecks = masteryAssessments.length || 21;
  const capabilityProgressPercent =
    totalCapabilityChecks > 0
      ? Math.round((completedCapabilityChecks / totalCapabilityChecks) * 100)
      : 0;

  const trainingComplete = capabilityAssessments.length > 0 &&
    capabilityAssessments.every((assessment) => assessment.status === "complete");
  const mode = podQuery.data?.assignment?.operationalMode;
  const practicalsQuery = useQuery<{
    entry: { ready: boolean };
    completion: { complete: boolean };
  }>({
    queryKey: ["/api/tutor/capability-practicals", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId) && trainingComplete && mode !== "trial" && mode !== "certified_live",
    retry: false,
    queryFn: async () => (await apiRequest(
      "GET",
      `/api/tutor/capability-practicals?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
    )).json(),
  });
  const milestoneMessage = podQuery.isError || capabilityPlanQuery.isError || practicalsQuery.isError
    ? "Your next development milestone could not be loaded. Return to your Pod to check your development record."
    : podQuery.isPending || (tutorAssignmentId && capabilityPlanQuery.isPending)
      ? "Loading your next development milestone…"
      : trainingMilestone(capabilityAssessments, mode, practicalsQuery.data);
  const stageGate = capabilityPlanQuery.data?.stageGate;
  // Post-Sandbox Deep Dives remain locked until Sandbox development coverage is complete.
  // Training-mode Transformation Retention and Application are governed by their own
  // assessment prerequisites and spacing intervals, not the Sandbox coverage gate.
  const sandboxMode = stageGate?.mode === "sandbox";
  const developmentPathwayBlocked = isDeepDiveModuleBlocked(
    stageGate?.mode,
    stageGate?.developmentCoverageReady,
  );
  const sandboxDevelopmentBlocked =
    sandboxMode && stageGate?.developmentCoverageReady !== true;
  const operatingSystemRetention = cumulativeAssessments.find(
    (assessment) => assessment.assessmentKey.startsWith("operating_system_") && assessment.evidenceKind === "retrieval",
  );
  const operatingSystemApplication = cumulativeAssessments.find(
    (assessment) => assessment.assessmentKey.startsWith("operating_system_") && assessment.evidenceKind === "transfer",
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/80 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="ri-world-hero rounded-3xl border border-primary/15 bg-background p-6 shadow-sm">
            <Button variant="ghost" className="mb-6 -ml-2" asChild>
              <Link to="/specialist/pod">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Pod
              </Link>
            </Button>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start">
                <div>
                  <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">
                    The Response Conditioning System
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground max-w-3xl">
                    This is the internal operating map for building specialists who can move students from confusion to calm, structured execution. Read the deep dives in sequence and use them as a real delivery framework.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        {sandboxMode ? (
          <Card className="ri-focus-card border border-primary/15 bg-card shadow-sm">
            <div className="p-6 space-y-4">
              <div><Badge>Sandbox development pathway</Badge><h2 className="mt-2 text-xl font-bold">Your remaining progression</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Development coverage unlocks the remaining Deep Dives. RI-OS Retention and Application follow those checks. The eight-session Sandbox graduation qualification is the final gate, not part of development coverage.</p>
              </div>
              <ol className="grid gap-3 md:grid-cols-2">
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">1. Transformation qualification</h3><Badge>Sandbox entry complete</Badge></div><p className="mt-1 text-xs text-muted-foreground">Transformation Mastery, Retention and Application qualify a Specialist for Sandbox entry.</p></li>
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">2. Sandbox development coverage</h3><Badge variant={stageGate?.developmentCoverageReady ? "default" : "outline"}>{stageGate?.developmentCoverageReady ? "Complete" : "In progress"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Establish required operating-mode, behaviour-signature and response-situation evidence.</p></li>
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">3. Remaining Deep Dives</h3><Badge variant={developmentPathwayBlocked ? "outline" : "default"}>{developmentPathwayBlocked ? "Locked until coverage" : "Unlocked"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Complete outstanding post-Sandbox Deep Dives and capability checks.</p></li>
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">4. RI-OS Retention</h3><Badge variant={operatingSystemRetention?.status === "complete" ? "default" : "outline"}>{operatingSystemRetention?.status === "complete" ? "Complete" : operatingSystemRetention?.status === "available" ? "Available" : "After Deep Dives"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Demonstrate delayed retrieval of the operating system after the post-Sandbox Deep Dives.</p></li>
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">5. RI-OS Application</h3><Badge variant={operatingSystemApplication?.status === "complete" ? "default" : "outline"}>{operatingSystemApplication?.status === "complete" ? "Complete" : operatingSystemApplication?.status === "available" ? "Available" : "After RI-OS Retention"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Demonstrate correct application across mixed situations.</p></li>
                <li className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">6. Final Sandbox graduation</h3><Badge variant={stageGate?.sandboxQualificationReady ? "default" : "outline"}>{stageGate?.sandboxQualificationReady ? "Evidence complete" : "Final gate"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Eight consecutive qualifying clean sessions, at least two in each RI-OS phase, followed by TD review.</p></li>
              </ol>
              <p className="text-xs text-muted-foreground">Development coverage is evidence/opportunity coverage. The eight clean sessions belong exclusively to final graduation and cannot substitute for development coverage.</p>
            </div>
          </Card>
        ) : null}

        <Card className="ri-module-card group border border-primary/15 bg-card shadow-sm hover:border-primary/40 transition-colors">
          <Link
            to="/responseconditioningsystem/introduction"
            className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="space-y-2">
              <Badge>Introduction</Badge>
              <h2 className="text-xl font-bold leading-tight">
                Introduction to the Response Conditioning Methodology
              </h2>
              <p className="text-sm text-muted-foreground">
                Start here before Transformation Phases. This explains what a response is,
                why mathematics is the area, and how specialists preserve trustworthy evidence.
              </p>
            </div>
          </Link>
        </Card>

        <div className="grid md:grid-cols-2 gap-5">
          {modules.map((module) => {
            return (
              <Card
                key={module.id}
                className="ri-module-card group border border-primary/15 bg-card shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="p-6 h-full flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="mb-3">Module {module.id}</Badge>
                      <h3 className="text-xl font-bold leading-tight">{module.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{module.subtitle}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {module.items.map((item) => (
                      developmentPathwayBlocked && module.id !== "1" ? (
                        <div
                          key={item.label}
                          className="flex items-center justify-between border-b border-dashed border-border/60 pb-2 text-sm text-muted-foreground"
                          aria-disabled="true"
                        >
                          <span>{item.label}</span>
                          <Badge variant="outline" className="text-[10px]">Locked</Badge>
                        </div>
                      ) : (
                        <Link
                          key={item.label}
                          to={item.href}
                          className="flex items-center justify-between text-sm text-foreground border-b border-dashed border-border/60 pb-2 hover:text-primary transition-colors"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {showCumulativeAssessments ? (
          <Card
            id="transformation-gates"
            className="ri-focus-card border border-primary/15 bg-card shadow-sm"
          >
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Badge>Capability Gates</Badge>
                <h2 className="text-xl font-bold">Retention + Application</h2>
                <p className="text-sm text-muted-foreground max-w-3xl">
                  Retention checks whether the operating system can still be retrieved
                  after its required spacing interval. Application then checks whether
                  the right RI response can be selected across mixed situations.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {cumulativeAssessments.map((assessment) => {
                  const isRetrieval = assessment.evidenceKind === "retrieval";
                  const isOperatingSystem = assessment.assessmentKey.startsWith("operating_system_");
                  const gateScope = isOperatingSystem ? "Operating System" : "Transformation";
                  const title = `${gateScope} ${isRetrieval ? "Retention" : "Application"}`;

                  const assessmentBlocked =
                    assessment.status !== "complete" &&
                    isCapabilityAssessmentBlocked({
                      assessmentKey: assessment.assessmentKey,
                      mode: stageGate?.mode,
                      developmentCoverageReady: stageGate?.developmentCoverageReady,
                    });
                  const detail =
                    assessmentBlocked
                      ? isOperatingSystem
                        ? "Complete Sandbox development coverage and the remaining post-Sandbox Deep Dives before this gate. Final Sandbox graduation follows RI-OS Retention and Application."
                        : "Sandbox development coverage is required before this gate unlocks. Remaining Deep Dives and RI-OS gates precede final Sandbox graduation."
                      : assessment.status === "complete"
                      ? isRetrieval
                        ? "Retention is complete."
                        : "Application is complete."
                      : assessment.status === "available"
                        ? isRetrieval
                          ? "The Retention Check is ready."
                          : "The Application Check is ready."
                        : assessment.reason === "spacing_interval"
                          ? assessment.unlockAt
                            ? `Retention opens ${new Date(assessment.unlockAt).toLocaleString()}.`
                            : "The delayed Retrieval interval is still running."
                          : assessment.reason === "prerequisite_incomplete"
                            ? isRetrieval
                              ? `Complete all ${assessment.coveredDeepDiveKeys.length} ${isOperatingSystem ? "post-Sandbox" : "Transformation"} Masteries first.`
                              : `Pass ${gateScope} Retention first.`
                            : "This check is currently locked.";

                  return (
                    <div
                      key={assessment.assessmentKey}
                      className="border border-border/70 p-5 space-y-4"
                    >
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {isRetrieval ? "Retention" : "Application"}
                        </p>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="text-sm text-muted-foreground">{detail}</p>
                        <p className="text-xs text-muted-foreground">
                          {assessment.formSize} questions
                        </p>
                      </div>

                      {assessment.status === "available" && !assessmentBlocked ? (
                        <Button asChild>
                          <Link
                            to={`/operational/specialist/capability/${assessment.assessmentKey}`}
                          >
                            {isRetrieval
                              ? "Take Retention Check"
                              : "Take Application Check"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="ri-focus-card border border-primary/15 bg-card shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Training Progress
                </p>
                <h2 className="mt-1 text-xl font-bold">Capability Checks</h2>
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {completedCapabilityChecks}/{totalCapabilityChecks}
              </p>
            </div>

            <Progress value={capabilityProgressPercent} className="h-2 bg-[var(--ri-charcoal)]" />

            <p className="text-sm text-muted-foreground">
              {completedCapabilityChecks} of {totalCapabilityChecks} Deep Dive Capability Checks completed.
            </p>
            <p className="border-t border-border pt-4 text-sm" aria-live="polite">
              {sandboxDevelopmentBlocked ? (stageGate?.reason || milestoneMessage) : milestoneMessage}
            </p>
            {sandboxDevelopmentBlocked ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">Sandbox development gate active</p>
                <p className="mt-1 text-muted-foreground">
                  Complete Sandbox development coverage to unlock the remaining Deep Dives. After those checks, complete RI-OS Retention and Application. Only then does the separate final Sandbox graduation qualification apply.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Development coverage: {stageGate?.developmentCoverageReady ? "Established" : "In progress"} · The eight-session graduation requirement is a separate later gate.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
