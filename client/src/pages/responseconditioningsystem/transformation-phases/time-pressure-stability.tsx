import { useMemo } from "react";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { useNavigate } from "react-router-dom";
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
  "High Maintenance: the required clean evidence keeps this topic at final-phase High Maintenance. Maintenance remains topic-specific; other topics keep their own evidence-based states.",
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
            
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
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
          lessonKey="time-pressure-stability-v2"
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
            <li>The Specialist records the evidence. RI-OS decides topic-state movement and whether an earlier prerequisite needs checking.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Where the Timer Comes From</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability does not use a generic timer and the Specialist does not choose a target.
            RI-OS first establishes a clean no-pressure execution baseline for this student and this topic.
          </p>
          <p className="font-semibold">
            The timer is the topic-specific time standard supported by the student's evidence, not a pacing preference.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Where the TPS Baseline Usually Comes From</h2>
          <p className="text-muted-foreground">
            During Structured Execution Training, RI-OS quietly records how long the student takes in the Independent Execution set.
            One complete clean set gives the system three timing samples.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The problems are normal difficulty.</li>
            <li>The three attempts use the same form of problem.</li>
            <li>There is no visible timer or urgency target.</li>
            <li>No help may give the method, first move, or execution structure.</li>
            <li>The student must execute independently enough for each attempt to count as clean evidence.</li>
            <li>The system must have recorded the timing correctly.</li>
          </ul>
          <p className="text-muted-foreground">
            If the student completes more than one clean Independent Execution set during the current stretch of Structured Execution Training,
            RI-OS uses the most recent complete set. It does not mix the fastest or strongest attempts from different sets.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Diagnosis Can Establish the Same Baseline</h2>
          <p className="text-muted-foreground">
            A topic can legitimately be placed above Structured Execution without first completing Structured Execution
            Training. Diagnosis can therefore establish the same baseline using normal, same-form, no-pressure independent
            execution opportunities.
          </p>
          <p className="text-muted-foreground">
            Diagnosis stops when the evidence question is resolved. The first clean independent opportunity may become timing sample 1,
            then RI-OS gathers only the remaining clean comparable samples required to reach three.
          </p>
          <p className="font-semibold">
            If an earlier response layer breaks first, Diagnosis stops there. It does not keep collecting timing just
            because a three-sample baseline could be useful later.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Passive Timing Does Not Create Pressure</h2>
          <p className="text-muted-foreground">
            Baseline timing is invisible as a target. The student is not told to hurry and the Specialist does not run a
            personal stopwatch.
          </p>
          <p className="font-semibold">
            Begin Rep or Begin Opportunity -&gt; student executes -&gt; Student Finished -&gt; observation and admin.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The system owns the start timestamp.</li>
            <li>Student Finished freezes the end of mathematical execution.</li>
            <li>Observation and form-completion time happen after the execution interval is frozen.</li>
            <li>The running baseline duration must not become a pacing cue.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The student finishes the baseline problem, but the Specialist spends another 20 seconds completing observations before pressing Student Finished. Can that elapsed time count toward the Timer Contract?"
          options={[
            {
              key: "a",
              label: "Yes, because the whole rep was still open in the runner.",
              feedback: "The baseline measures the student's mathematical execution, not Specialist administration after completion.",
            },
            {
              key: "b",
              label: "No. Student Finished must freeze the boundary at actual mathematical completion, before post-response admin.",
              feedback: "Yes. Adding form-completion time changes the measured execution interval.",
            },
            {
              key: "c",
              label: "Yes, if the Specialist adds roughly the same admin time to all three reps.",
              feedback: "Artificial admin delay is never part of the student's execution baseline.",
            },
            {
              key: "d",
              label: "Use the elapsed time but subtract the 20 seconds manually before the baseline is stored.",
              feedback: "Manually changing the time cannot recreate the student's true execution interval. The timer must freeze at actual completion.",
            },
            {
              key: "e",
              label: "Average the extra administration time across the three baseline reps before taking the median.",
              feedback: "Consistent administration delay is still not student execution and must not enter the baseline.",
            },
          ]}
          correctOptionKey="b"
          truth="Measurement integrity depends on freezing the real student execution boundary before observation administration."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">How Three Timings Become the Timer Contract</h2>
          <p className="text-muted-foreground">
            RI-OS takes the median of the three valid elapsed times and saves that value as the individualized
            baseline for the current student and topic, while preserving where those timings came from.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Structure Under Timer</p>
              <p className="mt-1 text-sm text-muted-foreground">100% of the baseline.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Repeated Timed Execution</p>
              <p className="mt-1 text-sm text-muted-foreground">100% of the baseline.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Full Constraint</p>
              <p className="mt-1 text-sm text-muted-foreground">85% of the baseline, rounded by RI-OS.</p>
            </div>
          </div>
          <p className="font-semibold">
            RI-OS sets the resulting Timer Contract. The Specialist cannot enter, estimate, round, pause, restart,
            loosen, tighten, or replace it.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">No Baseline Means No Invented Timer</h2>
          <p className="text-muted-foreground">
            A missing valid baseline means the topic is not ready for timed TPS work. If a topic needs Time Pressure Stability but
            does not have a valid current Timer Contract, ordinary timed work does not begin with a guessed value.
          </p>
          <p className="font-semibold">
            RI-OS requires the clean baseline work needed before timed TPS work can begin.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student finishes inside the timer but skips the known method and guesses successfully. What does the timed result prove?"
          options={[
            {
              key: "b",
              label: "Unstable under time, because urgency displaced the trained method despite the successful outcome.",
              feedback: "Yes. Time Pressure Stability requires the method to survive urgency; speed and correctness alone are not enough.",
            },
            {
              key: "a",
              label: "The student is stable under time because the deadline and answer were both achieved.",
              feedback: "Meeting the deadline cannot substitute for preserving the response structure the timer is meant to stress-test.",
            },
            {
              key: "c",
              label: "The student is ready for a tighter timer because the successful guess shows unused speed capacity.",
              feedback: "A tighter constraint is not earned from an attempt that already lost method integrity.",
            },
            {
              key: "d",
              label: "Count it as stable if the guess was a mathematically valid shortcut, because TPS only cares that the response stays functional.",
              feedback: "TPS pressures an already-trained response. Abandoning the trained method under urgency is itself instability.",
            },
            {
              key: "e",
              label: "Keep the timing as valid but mark structure as not observed because the student reached the answer too quickly to inspect it.",
              feedback: "The method loss was observed: the student guessed instead of preserving the known response. It should not be converted into missing evidence.",
            },
          ]}
          correctOptionKey="b"
          truth="The timer is an added constraint on an already-trained response. A fast or correct answer does not count as stability when urgency causes the method structure to disappear."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Time Pressure Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is the required Time Pressure Stability training sequence.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(", ")}
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
          prompt="A baseline timing attempt is completed quickly, but the Specialist prompted the student twice to keep the method moving. Can that time anchor later pressure?"
          options={[
            {
              key: "a",
              label: "Yes, because the stopwatch still measured the student's real working speed from start to finish.",
              feedback: "The clock may be accurate, but the student received support. That time cannot stand in for the required independent timing evidence.",
            },
            {
              key: "b",
              label: "Yes, if the prompts did not reveal the actual next step and only kept the student focused.",
              feedback: "Directional support can still change execution speed and the student's response. Whether the timing can count depends on preserving the required independent condition, not on how subtle the prompt felt.",
            },
            {
              key: "c",
              label: "No. The later timer needs timing evidence produced under the required independent condition.",
              feedback: "Yes. Pressure must be based on timing evidence that reflects the response RI intends to stress-test.",
            },
            {
              key: "d",
              label: "Yes, if the same prompts are used consistently across all three baseline reps.",
              feedback: "Consistent contamination is still contamination. The baseline must represent independent execution, not standardized prompting.",
            },
            {
              key: "e",
              label: "Use only the unsupported portions of the rep and subtract the time spent responding to the prompts.",
              feedback: "The execution interval cannot be reconstructed into an independent rep by manually removing supported moments.",
            },
          ]}
          correctOptionKey="c"
          truth="Timing evidence can only set the pressure baseline when the underlying execution condition stayed independent and clean. A precise stopwatch reading cannot repair a supported or contaminated response."
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
          prompt="The timer freezes for several seconds halfway through a rep, then resumes. What should happen to that attempt?"
          options={[
            {
              key: "c",
              label: "Record the technical failure and use a fresh pre-prepared equivalent reserve under the same intended time condition.",
              feedback: "Yes. The technical failure remains visible in the record, and the fresh pre-prepared equivalent reserve fills the unresolved evidence slot without erasing the failed attempt.",
            },
            {
              key: "a",
              label: "Keep it and subtract the estimated frozen time afterward, because the student's method performance was still observable.",
              feedback: "An estimate cannot recreate the intended continuous time condition. The rep may show useful behavior, but it cannot prove performance under the defined timer.",
            },
            {
              key: "b",
              label: "Treat it as a student timeout if the final completion exceeds the original limit.",
              feedback: "The timing condition failed technically. The student cannot be assigned a timing failure from a timer that did not operate correctly.",
            },
            {
              key: "d",
              label: "Restart the same exposed problem from the beginning once the timer is working again.",
              feedback: "The student has already seen and begun the problem. Reusing it would create a second chance rather than a fresh equivalent reserve.",
            },
            {
              key: "e",
              label: "Discard the failed attempt completely, then record only the replacement so the timing record stays clean.",
              feedback: "Technical failure remains part of the evidence history. Recovery fills the unresolved slot without erasing the failed attempt.",
            },
          ]}
          correctOptionKey="c"
          truth="Objective timer failure invalidates the timed condition, not the student's response. Keep the failed attempt in the record and fill the unresolved slot only with a fresh pre-prepared equivalent reserve under the same Timer Contract."
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
          prompt="The timer works correctly, but the student freezes and does not finish. Which conclusions are supported?"
          options={[
            {
              key: "a",
              label: "A replacement should run because incomplete timed attempts should not count.",
              feedback: "Non-completion under a valid timer is itself evidence of the response under pressure. Replacement is not for undesirable learner outcomes.",
            },
            {
              key: "b",
              label: "The attempt remains a valid timed evidence event.",
              feedback: "A working timer plus a weak response is still a valid observation of timed stability.",
            },
            {
              key: "c",
              label: "The attempt is confounded because freezing is emotional rather than mathematical.",
              feedback: "RI is explicitly observing whether the student can remain functional under the condition. Freezing is part of that response, not a reason to erase it.",
            },
            {
              key: "d",
              label: "No technical replacement is unlocked because the timing condition itself did not fail.",
              feedback: "A replacement is allowed only when the timing condition objectively fails, not because the learner performed weakly.",
            },
            {
              key: "e",
              label: "The freeze and non-completion are student-response evidence under urgency.",
              feedback: "TPS is explicitly observing whether the trained response survives urgency.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d","e"]}
          truth="When the timer is valid, timeout, freezing, wrong method or incomplete work are learner evidence. Replacement is reserved for objective failure of the timing condition itself."
        />

 <Card className="p-6 space-y-5 ">
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
          prompt="RI has assigned the active timer from valid independent timing evidence. Mid-rep, the student starts losing structure and asks for more time. What should the Specialist do?"
          options={[
            {
              key: "a",
              label: "Add a small amount of time so the rep can show whether the student still knows the method once urgency is reduced.",
              feedback: "That would answer a different question. The active rep is testing whether the known response survives the assigned urgency.",
            },
            {
              key: "b",
              label: "Pause the timer until structure returns, then resume.",
              feedback: "Pausing removes part of the continuous pressure. The displayed total may look unchanged, but the condition is no longer the same.",
            },
            {
              key: "c",
              label: "Preserve the assigned timer and record the structure loss as learner evidence under that condition.",
              feedback: "Yes. The Specialist protects the timing contract rather than adjusting the condition to produce a cleaner-looking response.",
            },
            {
              key: "d",
              label: "Add the same amount of extra time to this and all future reps so the condition stays comparable.",
              feedback: "Repeating the same unallowed change does not restore the correct timed condition.",
            },
            {
              key: "e",
              label: "Stop the timer and finish the problem untimed inside the same rep so the Specialist can separate knowledge from pressure.",
              feedback: "That turns one timed evidence opportunity into two different conditions. The timed response should be preserved first; any later lower-pressure check is a separate system-directed action.",
            },
          ]}
          correctOptionKey="c"
          truth="The timer RI-OS set is part of the evidence condition. Once the rep begins, the Specialist does not loosen or pause it to rescue performance; they preserve the condition and record what happens."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability does not complete because the student was fast once. RI-OS relies on the required clean evidence and stability state.
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
