import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Lock,
  Cpu,
  Radar,
  Cog,
  Gauge,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

const modules = [
  {
    id: "1",
    title: "Transformation Phases",
    subtitle: "What happens to the student",
    icon: Gauge,
    items: [
      {
        label: "Topic Conditioning",
        href: "/responseconditioningsystem/transformation-phases/topic-conditioning",
      },
      {
        label: "Clarity",
        href: "/responseconditioningsystem/clarity",
      },
      {
        label: "Structured Execution",
        href: "/responseconditioningsystem/structured-execution",
      },
      {
        label: "Controlled Discomfort",
        href: "/responseconditioningsystem/controlled-discomfort",
      },
      {
        label: "Time Pressure Stability",
        href: "/responseconditioningsystem/time-pressure-stability",
      },
    ],
  },
  {
    id: "2",
    title: "Execution Standards",
    subtitle: "How tutors must operate",
    icon: Cog,
    items: [
      {
        label: "How to model",
        href: "/responseconditioningsystem/execution-standards/how-to-model",
      },
      {
        label: "How to guide",
        href: "/responseconditioningsystem/execution-standards/how-to-guide",
      },
      {
        label: "How to use Boss Battles",
        href: "/responseconditioningsystem/execution-standards/how-to-use-boss-battles",
      },
      {
        label: "What not to do",
        href: "/responseconditioningsystem/execution-standards/what-not-to-do",
      },
      {
        label: "Emotional discipline under discomfort",
        href: "/responseconditioningsystem/execution-standards/emotional-discipline-under-discomfort",
      },
    ],
  },
  {
    id: "3",
    title: "System Intelligence",
    subtitle: "How to interpret student behavior",
    icon: Radar,
    items: [
      {
        label: "What changes in the student",
        href: "/responseconditioningsystem/system-intelligence/what-changes-in-the-student",
      },
      {
        label: "Signs of progress",
        href: "/responseconditioningsystem/system-intelligence/signs-of-progress",
      },
      {
        label: "Breakdown patterns",
        href: "/responseconditioningsystem/system-intelligence/breakdown-patterns",
      },
      {
        label: "Before vs after",
        href: "/responseconditioningsystem/system-intelligence/before-vs-after",
      },
    ],
  },
  {
    id: "4",
    title: "Session Infrastructure",
    subtitle: "How the system is executed and tracked",
    icon: Cpu,
    items: [
      {
        label: "Intro session structure",
        href: "/responseconditioningsystem/session-infrastructure/intro-session-structure",
      },
      {
        label: "Session flow control",
        href: "/responseconditioningsystem/session-infrastructure/session-flow-control",
      },
      {
        label: "Drill Library",
        href: "/responseconditioningsystem/session-infrastructure/drill-library",
      },
      {
        label: "Logging system",
        href: "/responseconditioningsystem/session-infrastructure/logging-system",
      },
      {
        label: "Handover verification",
        href: "/responseconditioningsystem/session-infrastructure/handover-verification",
      },
      {
        label: "Tools required",
        href: "/responseconditioningsystem/session-infrastructure/tools-required",
      },
    ],
  },
];

export default function ResponseConditioningSystem() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/80 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="rounded-3xl border border-primary/15 bg-background p-6 shadow-sm">
            <Button variant="ghost" className="mb-6 -ml-2" asChild>
              <Link to="/tutor/pod">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Pod
              </Link>
            </Button>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
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
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <div className="p-6">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="font-bold text-lg">Gate Access</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Response Integrity-OS is the internal operating system tutors are expected to follow. This page is
                  the entry point. Each section below links to a deeper operating page. Use this as
                  the map, not as a shortcut summary.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-primary/20 bg-card shadow-sm">
          <div className="p-6 space-y-4">
            <h2 className="font-bold text-lg">Start here</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you are entering the system for the first time, begin with Topic Conditioning, Clarity, How to Model, and Session Flow Control. Together they show how Response Integrity identifies the breakpoint, builds the response, and keeps the session structured.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">Topic Conditioning</span>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">Clarity</span>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">How to Model</span>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">Session Flow Control</span>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-5">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <Card
                key={module.id}
                className="group border border-primary/15 bg-card shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="p-6 h-full flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="mb-3">Module {module.id}</Badge>
                      <h3 className="text-xl font-bold leading-tight">{module.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{module.subtitle}</p>
                    </div>
                    <div className="w-10 h-10 rounded-md border bg-primary/5 border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
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
      </div>
    </div>
  );
}
