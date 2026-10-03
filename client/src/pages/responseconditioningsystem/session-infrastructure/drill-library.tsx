import { useMemo } from "react";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { Link, useNavigate } from "react-router-dom";
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
      "Diagnosis asks only for the smallest next problem needed to resolve the current evidence question.",
    boundary:
      "Diagnosis is not a fixed phase block or fixed rep quota. Specialists do not choose the next probe or placement.",
  },
  {
    title: "Training drills",
    use: "Active Training",
    authority:
      "Each phase has required sets, rep opportunities, purposes, and conditions. The Specialist runs that sequence as assigned and records what the student actually does.",
    boundary:
      "Completing the required exposure is not the same as proving a stronger state. Finishing the drill does not force progress.",
  },
  {
    title: "Handover checks",
    use: "Specialist reassignment",
    authority:
      "RI-OS asks only for enough clean Handover evidence to keep the inherited state, adjust stability within the same phase, or require targeted re-diagnosis.",
    boundary:
      "The reserve problem bank is not a completion target. Handover ends when the evidence question is resolved, not after a fixed number of reps.",
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
            
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Drill Library</h1>
              <p className="text-muted-foreground mt-1">Know where a drill comes from, what it is allowed to test, and what the Specialist must preserve.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="drill-library-v2"
          title="Drill Library"
          completion={<DeepDiveCapabilityCheck assessmentKey="drill_library_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">A Drill Is a Controlled Evidence Condition</h2>
          <p className="text-muted-foreground">
            A drill is not a worksheet label and not something the Specialist chooses because it feels appropriate. The active session context and student-topic state determine which drill should run.
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
          <h2 className="text-2xl font-bold">Required Training Drills</h2>
          <p className="text-muted-foreground">
            The Training sets below are the required sets for each phase.
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
            <li>Do not silently change the problem form, difficulty, support rule, or timer and still treat the evidence as though the original condition held.</li>
            <li>TPS uses the timing already set for that student and topic. The Specialist does not invent or adjust the timer.</li>
            <li>For timing-sensitive Training, pre-session prep includes fresh equivalent reserve problems matched to the same set conditions. Reserve inventory is contingency only, not additional reps.</li>
            <li>If the timer, device, or session technology fails and the timed attempt can no longer be trusted, that attempt remains unresolved. Only then may a fresh pre-prepared equivalent reserve problem be used under the same conditions. The exposed problem is never reused.</li>
            <li>Student timeout, panic, wrong method, incomplete work, or weak performance remains real evidence and does not allow a replacement opportunity.</li>
            <li>Diagnosis tells the Specialist what to check next. Training uses the required set for the current phase. Handover continues only until there is enough trustworthy evidence to decide whether the inherited state still holds.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When a Drill Exposes an Earlier-Layer Problem</h2>
          <p className="text-muted-foreground">
            Progression adds a condition; it does not erase earlier capabilities. A breakdown under difficulty or time may expose an earlier Clarity or Structured Execution problem.
          </p>
          <p className="font-semibold">
            Record the layer that actually broke. Do not manually move the topic backward. RI-OS may check the prerequisite or require targeted re-diagnosis.
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

 <Card className="p-6 space-y-3">
          <h2 className="text-2xl font-bold">Specialist Standard</h2>
          <p className="font-semibold">Use the drill RI-OS requires. Preserve the condition. Record the real response. Let evidence decide what happens next.</p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
