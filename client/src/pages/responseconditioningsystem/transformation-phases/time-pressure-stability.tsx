import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getDrillSchemaDefinition,
  type EvidenceSetDefinition,
} from "@shared/responseIntegrityDrillRegistry";

const TIME_REP_PURPOSES: Record<string, string[]> = {
  "time_pressure.structure_under_timer": [
    "First timed attempt: can the student meet the timer with control, structure, pace, and completion?",
    "Adjustment check: can the student adjust to the same timer without sacrificing structure?",
    "Confirmation: can method structure and pace control be confirmed across the first timed set?",
  ],
  "time_pressure.repeated_timed_execution": [
    "First repeat: does the timed response repeat after initial timed exposure?",
    "Drift check: does pace or structure drift on another attempt under the same timer?",
    "Confirmation: can timed consistency be confirmed across repetition?",
  ],
  "time_pressure.full_constraint": [
    "First full constraint: does structure and completion survive the first tighter-time attempt?",
    "Second full constraint: does the response stabilize under another maximum-intended constraint?",
    "Confirmation: can controlled pace, structure, and completion be confirmed under the tightest defined constraint?",
  ],
};

const TIME_SET_EXECUTION: Record<
  string,
  {
    studentAction: string;
    specialistAction: string;
    preserve: string;
    doNot: string[];
  }
> = {
  "time_pressure.structure_under_timer": {
    studentAction:
      "Begin under the timer and keep the known method visible. Speed matters, but structure must not disappear.",
    specialistAction:
      "Run the timed attempt using the runner/prep-defined timer, withhold help, observe start, structure, pace, and completion, then log the response.",
    preserve:
      "Method-first execution under an active timer. The target is not frantic completion; the target is controlled structure while time exists.",
    doNot: [
      "Do not remove the timer because the student becomes tense.",
      "Do not reward speed that abandons structure.",
      "Do not coach the student through the timed attempt.",
    ],
  },
  "time_pressure.repeated_timed_execution": {
    studentAction:
      "Repeat the timed attempt under the same time condition and show whether structure, pace, and completion stabilize or drift.",
    specialistAction:
      "Hold the same timer condition, repeat the attempt, observe drift or consistency, and log what actually happens across reps.",
    preserve:
      "Repeated timer consistency. The set tests whether the timed response holds, not whether one attempt went well.",
    doNot: [
      "Do not change the timer between reps unless the runner/prep explicitly tells you to.",
      "Do not skip repetition after one strong attempt.",
      "Do not hide rushing, panic, or structure loss behind a completed answer.",
    ],
  },
  "time_pressure.full_constraint": {
    studentAction:
      "Work under the tightest defined time condition while preserving method structure, controlled pace, and completion integrity.",
    specialistAction:
      "Run the full constraint exactly as defined by the runner/prep, withhold help, observe the full pressure response, and log the evidence.",
    preserve:
      "Full time constraint. The set tests whether the student can keep structure and completion when the pressure is at the intended maximum.",
    doNot: [
      "Do not loosen the timer mid-rep to create a better-looking result.",
      "Do not count incomplete or panic-driven execution as stable time-pressure performance.",
      "Do not introduce a personal timer rule that is not defined by the system.",
    ],
  },
};

const observationSignals = [
  "Start under time: does the student begin with control, delay, panic, or freeze?",
  "Structure under time: does the method stay intact or get abandoned under urgency?",
  "Pace control: does the student regulate pace or rush into unstable execution?",
  "Completion integrity: does the student finish with structure, finish unstable, or break down before completion?",
];

const progressionBands = [
  "Low: run the Time Pressure Stability drill. Start with the defined timer condition and protect method before speed.",
  "Medium: remain in Time Pressure Stability and build consistency across repeated timed attempts.",
  "High: remain in Time Pressure Stability and prove repeatability. High does not finish the phase directly.",
  "High Maintenance: qualifying evidence marks the topic as transfer-ready or ready for mixed maintenance work. The engine owns that decision.",
];

const constraintLabel = (set: EvidenceSetDefinition) => {
  const support = set.constraints.supportLevel.replaceAll("_", " ");
  const pressure = set.constraints.pressureLevel.replaceAll("_", " ");
  const variation = set.constraints.variationLevel.replaceAll("_", " ");
  const difficulty = set.constraints.difficultyLevel.replaceAll("_", " ");
  return `Support: ${support} | Pressure: ${pressure} | Variation: ${variation} | Difficulty: ${difficulty}`;
};

const diagnosisInstructionFor = (set: EvidenceSetDefinition) => {
  if (set.setId === "time_pressure.light_timer") {
    return "Run the first controlled timed exposure exactly as the runner/prep specifies and observe whether the student starts, preserves structure, controls pace, and completes.";
  }

  return "Repeat the same time condition and observe whether the response stabilizes or drifts across timed attempts.";
};

export default function ResponseConditioningTimePressureStability() {
  const navigate = useNavigate();
  const trainingSchema = useMemo(() => getDrillSchemaDefinition("training", "Time Pressure Stability"), []);
  const diagnosisSchema = useMemo(() => getDrillSchemaDefinition("diagnosis", "Time Pressure Stability"), []);

  const requiredTrainingProblems = trainingSchema.sets.reduce((total, set) => total + set.reps, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate("/responseconditioningsystem")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                Time Pressure Stability
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mt-2">
                Train the student to preserve structure when time pressure appears.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-5 border-l-4 border-l-primary">
          <h2 className="text-2xl font-bold">The Transformation</h2>
          <p className="text-xl font-semibold">
            Time Pressure Stability asks: can the student stay structured when urgency is real?
          </p>
          <p className="text-muted-foreground">
            Controlled Discomfort proves the student can survive difficulty without rescue. Time Pressure Stability adds urgency. The
            phase trains controlled starts, method retention, pace regulation, and completion integrity under timer conditions.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-semibold">Start under time</p>
            <p className="text-sm text-muted-foreground">The student begins without freezing, panicking, or waiting for rescue.</p>
            <p className="font-semibold">Structure under time</p>
            <p className="text-sm text-muted-foreground">The known method remains visible while urgency increases.</p>
            <p className="font-semibold">Completion integrity</p>
            <p className="text-sm text-muted-foreground">The student does not trade process quality for a rushed finish.</p>
          </div>
          <p className="font-medium">
            The goal is not speed alone. The goal is reliable structure while speed pressure is present.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Where Time Pressure Stability Sits</h2>
          <p className="text-xl font-bold text-primary">
            Clarity -&gt; Structured Execution -&gt; Controlled Discomfort -&gt; Time Pressure Stability
          </p>
          <p className="text-muted-foreground">
            Time pressure is the last phase because timing can easily hide weak clarity, weak structure, or rescue dependence. Do not
            use timed work to fix earlier phase gaps. Use timed work only when the prior response layers are stable enough to be tested.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Timer pressure is present.</li>
            <li>Specialist help is withheld.</li>
            <li>Method integrity remains more important than raw speed.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Time Pressure Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is rendered from the live drill registry so the Deep Dive stays aligned with the runner.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(" -> ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Every set produces evidence about structure under time.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Add timer -&gt; repeat timer -&gt; tighten constraint -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before the Session: What to Prepare</h2>
          <p className="text-muted-foreground">
            Use the active student topic and the Map/pre-session preparation direction. Problems should be normal difficulty unless the
            system explicitly directs otherwise. The pressure comes from timing and repetition, not from secretly changing the topic demand.
          </p>
          <div className="space-y-3">
            {trainingSchema.sets.map((set) => (
              <div key={set.setId} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{set.setName}</h3>
                  <span className="text-sm text-muted-foreground">
                    {set.reps} required {set.reps === 1 ? "opportunity" : "opportunities"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{set.purpose}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{constraintLabel(set)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <p className="font-semibold">Timing boundary</p>
            <p className="text-sm text-muted-foreground">
              This Deep Dive defines the recipe and pressure levels, but not a personal timer formula. Use the runner/pre-session timer
              instruction. Do not invent a different timer and treat it as canon.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is a controlled timer condition. Preserve the timer rule, preserve method integrity, and let every repetition reveal
            whether the response stays stable under urgency.
          </p>

          <div className="space-y-5">
            {trainingSchema.sets.map((set, setIndex) => {
              const execution = TIME_SET_EXECUTION[set.setId];
              const repPurposes = TIME_REP_PURPOSES[set.setId] || [];

              return (
                <div key={set.setId} className="rounded-xl border p-5 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Set {setIndex + 1}</p>
                    <h3 className="text-xl font-bold">{set.setName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{set.purpose}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                      <p className="font-semibold">What the Specialist does</p>
                      <p className="text-sm text-muted-foreground">{execution.specialistAction}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                      <p className="font-semibold">What the student does</p>
                      <p className="text-sm text-muted-foreground">{execution.studentAction}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4 space-y-2">
                    <p className="font-semibold">Condition to preserve</p>
                    <p className="text-sm text-muted-foreground">{execution.preserve}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{constraintLabel(set)}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">Why every rep exists</p>
                    {repPurposes.map((purpose, repIndex) => (
                      <div key={purpose} className="rounded-lg border p-3">
                        <p className="text-sm">
                          <span className="font-semibold">Rep {repIndex + 1}: </span>
                          <span className="text-muted-foreground">{purpose}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">Do not contaminate this set</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {execution.doNot.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Diagnosis Structure</h2>
          <p className="text-muted-foreground">
            Diagnosis exposes whether the student can preserve structure when a timer first appears and whether the response stays stable across timed repetition.
          </p>
          <div className="space-y-4">
            {diagnosisSchema.sets.map((set) => (
              <div key={set.setId} className="rounded-lg border p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{set.setName}</h3>
                  <p className="text-sm text-muted-foreground">{set.reps} reps</p>
                </div>
                <p className="text-muted-foreground">{set.purpose}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Rep instruction:</span> {diagnosisInstructionFor(set)}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{constraintLabel(set)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What You Observe</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability is scored by execution quality under urgency, not by speed alone.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {observationSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          <p className="font-medium">
            Observe before you interpret. Record the start, structure, pace, and completion integrity that actually appeared under the timer.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can freeze, rush, lose structure, work unevenly, or fail to complete inside a correctly executed timed drill. That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not loosen the timer or coach through the timed attempt to protect the score. Correct Specialist execution means the timer and no-help boundary were preserved.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: changing the timer, helping during the rep, ignoring lost structure because the answer was fast, or logging stable pace when the response was panic-driven.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability does not complete because the student was fast once. The engine relies on qualifying scored evidence and stability state.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {progressionBands.map((band) => (
              <li key={band}>{band}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before Sandbox Execution Check</h2>
          <p className="text-muted-foreground">
            A Specialist should be able to explain this phase without reading from the page before running it with a student.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Why time pressure comes after clarity, independent execution, and difficulty tolerance.</li>
            <li>Why speed without structure is not the target.</li>
            <li>What makes each set valid: structure under timer, repeated timed execution, and full constraint.</li>
            <li>What actions contaminate timing evidence and require review.</li>
            <li>Why RI-OS, not the Specialist, owns the final stability or transfer decision.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
