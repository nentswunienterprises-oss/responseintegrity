import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronRight } from "lucide-react";

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
  coveredDeepDiveKeys: string[];
  status: "unavailable" | "locked" | "available" | "complete";
  reason: "bank_unavailable" | "attempt_limit" | "retry_cooldown" | null;
  unlockAt: string | null;
};

type PodData = {
  assignment?: { id?: string | null } | null;
};

export default function ResponseConditioningSystem() {
  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const capabilityPlanQuery = useQuery<{ assessments: MasteryAvailability[] }>({
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
  const completedCapabilityChecks = capabilityAssessments.filter(
    (assessment) => assessment.status === "complete",
  ).length;
  const totalCapabilityChecks = capabilityAssessments.length || 20;
  const capabilityProgressPercent =
    totalCapabilityChecks > 0
      ? Math.round((completedCapabilityChecks / totalCapabilityChecks) * 100)
      : 0;

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
                      <Link
                        key={item.label}
                        to={item.href}
                        className="flex items-center justify-between text-sm text-foreground border-b border-dashed border-border/60 pb-2 hover:text-primary transition-colors"
                      >
                        <span>{item.label}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

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
          </div>
        </Card>
      </div>
    </div>
  );
}
