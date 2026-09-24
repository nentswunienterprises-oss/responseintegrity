import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDrillSchemaDefinition } from "@shared/responseIntegrityDrillRegistry";

const PHASES = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
] as const;

const drillTypes = [
  {
    title: "Diagnosis probes",
    use: "Intro Diagnosis and targeted re-diagnosis",
    authority:
      "The evidence-complete diagnosis engine selects the smallest next probe needed to resolve the named evidence question.",
    boundary:
      "Diagnosis is not a fixed phase block or fixed rep quota. Specialists do not choose the next probe or placement.",
  },
  {
    title: "Training drills",
    use: "Active Training",
    authority:
      "The live drill registry defines the phase sets, rep opportunities, purpose, and constraints. The Specialist executes the prescribed sequence and records the response.",
    boundary:
      "Required exposure is not the same thing as evidence authority. Completing the drill does not force a stronger state.",
  },
  {
    title: "Handover continuity opportunities",
    use: "Specialist reassignment",
    authority:
      "The Response Evidence Model asks only for enough clean continuity evidence to hold the inherited state, make a bounded same-phase stability adjustment, or require targeted re-diagnosis.",
    boundary:
      "The reserve problem bank is not a completion target. Handover is evidence-complete, not fixed-rep.",
  },
];

export default function ResponseConditioningDrillLibrary() {
  const navigate = useNavigate();
  const trainingSchemas = useMemo(
    () => PHASES.map((phase) => ({ phase, schema: getDrillSchemaDefinition("training", phase) })),
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/responseconditioningsystem")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Drill Library</h1>
              <p className="text-muted-foreground mt-1">Know where a drill comes from, what it is allowed to test, and what the Specialist must preserve.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">A Drill Is a Controlled Evidence Condition</h2>
          <p className="text-muted-foreground">
            A drill is not a worksheet label and not something the Specialist chooses because it feels appropriate. The active session context and student-topic state determine which drill authority is allowed to run.
          </p>
          <p className="font-semibold">The Specialist prepares and executes the condition. The system owns drill selection where selection is system-authoritative.</p>
        </Card>

        <div className="space-y-5">
          {drillTypes.map((drill) => (
            <Card key={drill.title} className="p-6 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl font-bold">{drill.title}</h2>
                <span className="text-sm text-muted-foreground">{drill.use}</span>
              </div>
              <p className="text-muted-foreground">{drill.authority}</p>
              <p className="text-sm font-medium">{drill.boundary}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Live Training Drill Registry</h2>
          <p className="text-muted-foreground">
            The Training sets below are rendered from the same live registry used by the product so this Deep Dive cannot quietly invent a different phase recipe.
          </p>
          <div className="space-y-4">
            {trainingSchemas.map(({ phase, schema }) => (
              <div key={phase} className="rounded-xl border p-4 space-y-3">
                <h3 className="text-lg font-semibold">{phase}</h3>
                <div className="space-y-2">
                  {schema.sets.map((set, index) => (
                    <div key={set.setId} className="rounded-lg bg-muted/40 p-3">
                      <p className="font-medium">Set {index + 1}: {set.setName} ({set.reps})</p>
                      <p className="mt-1 text-sm text-muted-foreground">{set.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Preparation Boundary</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>Prepare problems that satisfy the live set's topic, support, pressure, variation, and difficulty constraints.</li>
            <li>Do not silently change the problem form, difficulty, support boundary, or timer and still treat the evidence as though the original condition held.</li>
            <li>TPS timing comes from the immutable student/topic Timer Contract. The Specialist does not invent a timer.</li>
            <li>For timing-sensitive Training, pre-session prep includes fresh equivalent reserve problems matched to the same set conditions. Reserve inventory is contingency only, not additional reps.</li>
            <li>An objective technical timer/runtime/device failure leaves the evidence slot unresolved. Only then may a fresh pre-prepared equivalent reserve problem fill that slot. The exposed problem is never reused.</li>
            <li>Student timeout, panic, wrong method, incomplete work, or weak performance remains real evidence and does not authorize a replacement opportunity.</li>
            <li>Diagnosis probes are system-selected; Training sets are registry-defined; Handover opportunities are bounded by evidence sufficiency.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When a Drill Exposes an Earlier-Layer Problem</h2>
          <p className="text-muted-foreground">
            Progression adds a condition; it does not erase earlier capabilities. A breakdown under difficulty or time may expose an earlier Clarity or Structured Execution problem.
          </p>
          <p className="font-semibold">
            Record the layer that actually broke. Do not manually move the topic backward. The system may verify the prerequisite or route to targeted evidence-complete re-diagnosis.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Related Deep Dives</h2>
          <p className="text-sm text-muted-foreground">
            Use <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/session-flow-control">Session Flow Control</Link> to identify the context,{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/logging-system">Logging System</Link> to record evidence correctly, and{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/handover-verification">Handover Verification</Link> for continuity rules.
          </p>
        </Card>

        <Card className="p-6 border-l-4 border-l-primary space-y-3">
          <h2 className="text-2xl font-bold">Specialist Standard</h2>
          <p className="font-semibold">Use the authorized drill source. Preserve the condition. Record the real response. Let evidence decide what happens next.</p>
        </Card>
      </div>
    </div>
  );
}
