import { useMemo } from "react";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
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
      "Run the timed attempt using the timing shown for that student and topic, withhold help, observe start, structure, pace, and completion, then log the response.",
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
      "Do not change the timer between reps.",
      "Do not skip repetition after one strong attempt.",
      "Do not hide rushing, panic, or structure loss behind a completed answer.",
    ],
  },
  "time_pressure.full_constraint": {
    studentAction:
      "Work under the tightest defined time condition while preserving method structure, controlled pace, and completion integrity.",
    specialistAction:
      "Run Full Constraint at 85% of the established baseline time, withhold help, observe the full pressure response, and log the evidence.",
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
  "High Maintenance: qualifying evidence keeps this topic at final-phase High Maintenance. Maintenance remains topic-specific; other topics keep their own independently derived states.",
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
    return "Run the first controlled timed exposure using the timing prepared for that student and topic, then observe whether the student starts, preserves structure, controls pace, and completes.";
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
        <DeepDiveLessonRunner
          lessonKey="time-pressure-stability-v1"
          title="Time Pressure Stability"
          completion={<DeepDiveCapabilityCheck assessmentKey="time_pressure_stability_mastery_v1" />}
        >
        <Card className="p-6 space-y-5">
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

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Phase Inherits</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability inherits the mental map, independent execution, and response under difficulty already built in the
            earlier phases. The timer adds urgency; it does not replace those requirements.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>A fast or correct final answer does not excuse lost method structure, random execution, or renewed rescue dependence.</li>
            <li>If urgency exposes an earlier-layer break, record the layer that actually broke instead of calling every failure a time problem.</li>
            <li>An isolated calculation error does not automatically prove the inherited layers failed.</li>
            <li>The Specialist records the evidence. RI-OS owns topic-state movement and any prerequisite verification route.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student finishes very quickly under the timer but abandons the method structure. How should RI read that?"
          options={[
            {
              key: "a",
              label: "Strong Time Pressure Stability because speed improved.",
              feedback: "Speed without preserved structure is not the target.",
            },
            {
              key: "b",
              label: "The timed response is unstable because urgency displaced the method.",
              feedback: "Time Pressure Stability requires structure and completion integrity under time, not speed alone.",
            },
            {
              key: "c",
              label: "The student should receive a tighter timer next.",
              feedback: "A tighter constraint is not earned from a response that already lost structure.",
            },
          ]}
          correctOptionKey="b"
          truth="The timer is an added constraint on an already-known method. A fast answer that loses structure is evidence of breakdown under time, not successful stability."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Time Pressure Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is the required Time Pressure Stability training sequence.
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

        <DeepDiveTeachingInteraction
          prompt="Before a stricter timed condition can be used, what must already exist?"
          options={[
            { key: "a", label: "Eligible timing evidence for this learner and topic.", feedback: "Later pressure is derived from established timing evidence rather than guessed by the Specialist." },
            { key: "b", label: "A standard time used for every learner in the grade.", feedback: "A universal time ignores the learner's own established execution evidence." },
            { key: "c", label: "The Specialist's estimate of how fast the learner should be.", feedback: "Professional intuition cannot replace the timing evidence used to derive the pressure condition." },
          ]}
          correctOptionKey="a"
          truth="Time pressure is evidence-derived. The Specialist prepares from the eligible timing basis already established for the learner and topic rather than inventing a timer."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before the Session: What to Prepare</h2>
          <p className="text-muted-foreground">
            Use the active student topic and the Map/pre-session preparation direction. TPS problems remain normal difficulty and same form across
            the defined training sequence. The pressure variable is timing and repetition; mathematical difficulty and problem form do not change.
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
              Use the established baseline time for this student and topic. Structure Under Timer and Repeated Timed Execution use 100% of that baseline; Full Constraint uses 85%. Do not invent, loosen, or tighten a different timer.
            </p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="font-semibold">Technical-failure reserve</p>
            <p className="text-sm text-muted-foreground">
              Before the session, prepare one fresh equivalent reserve problem for each timed set. These reserve problems are contingency inventory only - not extra reps and not a completion target.
            </p>
            <p className="text-sm text-muted-foreground">
              If the timer, device, or session technology fails and the timed attempt can no longer be trusted, leave that attempt unresolved. A fresh pre-prepared equivalent reserve problem may then be used under the same timing and set conditions.
            </p>
            <p className="text-sm font-medium">
              Never reuse the exposed problem or create a replacement because the student timed out, panicked, used the wrong method, worked incompletely, or performed weakly. Those are real TPS observations.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is its own learning step. Preserve the timer condition and method integrity before moving to the next timed demand.
          </p>
        </Card>

        {trainingSchema.sets.map((set, setIndex) => {
          const execution = TIME_SET_EXECUTION[set.setId];
          const repPurposes = TIME_REP_PURPOSES[set.setId] || [];

          return (
            <Card key={set.setId} className="p-6 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Set {setIndex + 1} of {trainingSchema.sets.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{set.setName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{set.purpose}</p>
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

              <div className="rounded-lg bg-primary/5 p-4 space-y-2">
                <p className="font-semibold">Condition to preserve</p>
                <p className="text-sm text-muted-foreground">{execution.preserve}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {constraintLabel(set)}
                </p>
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
            </Card>
          );
        })}

        <DeepDiveTeachingInteraction
          prompt="The timer fails halfway through a rep. What should happen to that rep?"
          options={[
            {
              key: "a",
              label: "Estimate the remaining time and keep the rep as normal evidence.",
              feedback: "Estimated timing cannot replace the actual timed condition.",
            },
            {
              key: "b",
              label: "Preserve the technical-failure lineage and run a valid replacement rep.",
              feedback: "A technical failure must not be converted into false timed evidence.",
            },
            {
              key: "c",
              label: "Treat the unfinished rep as a student failure.",
              feedback: "The failure came from the timing condition, not from the student's response.",
            },
          ]}
          correctOptionKey="b"
          truth="Technical timer failure and student performance are separate truths. The failed timing condition remains recorded, and a valid replacement rep supplies the evidence."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What You Observe</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability is decided from execution quality under urgency, not from speed alone.
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

        <DeepDiveTeachingInteraction
          prompt="The timer works exactly as intended, but the learner freezes and does not finish. What does this produce?"
          options={[
            { key: "a", label: "Valid learner evidence under time.", feedback: "A valid timer plus a weak response is still truthful evidence of what happened under pressure." },
            { key: "b", label: "A technical failure because the rep was incomplete.", feedback: "Technical failure belongs to the timing condition, not to an incomplete learner response under a working timer." },
            { key: "c", label: "No evidence, so the Specialist should rerun immediately with more time.", feedback: "Changing the timer to obtain a better result would overwrite the weak but valid evidence." },
          ]}
          correctOptionKey="a"
          truth="When the timing condition is valid, timeout, freezing, wrong method and incomplete work are learner evidence. Replacement is reserved for objective failure of the timing condition itself."
        />

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can freeze, rush, lose structure, work unevenly, or fail to complete inside a correctly executed timed drill. That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not loosen the timer or coach through the timed attempt to manufacture stronger-looking evidence. Correct Specialist execution means the timer and no-help boundary were preserved.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: changing the timer, helping during the rep, ignoring lost structure because the answer was fast, or logging stable pace when the response was panic-driven.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="Who decides the Full Constraint timer?"
          options={[
            {
              key: "a",
              label: "The Specialist chooses a time that feels challenging.",
              feedback: "Personal timer rules would make pressure inconsistent and unauditable.",
            },
            {
              key: "b",
              label: "The system derives it from the student's established eligible timing baseline.",
              feedback: "The pressure condition is evidence-derived rather than improvised.",
            },
            {
              key: "c",
              label: "Every student receives the same fixed time for the topic.",
              feedback: "TPS timing is based on the student's own eligible baseline, not a universal arbitrary duration.",
            },
          ]}
          correctOptionKey="b"
          truth="Time pressure is derived from eligible timing evidence. Full Constraint uses the defined relationship to the established baseline; the Specialist does not invent the timer."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability does not complete because the student was fast once. The engine relies on qualifying evidence and stability state.
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
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
