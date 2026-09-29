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

const CONTROLLED_REP_PURPOSES: Record<string, string[]> = {
  "controlled_discomfort.controlled_entry": [
    "First entry: can the student pause and produce a controlled first action under difficulty?",
    "Second entry: does first-step control and stability hold under another difficult entry?",
    "Confirmation: can controlled entry be treated as repeatable inside the set?",
  ],
  "controlled_discomfort.no_rescue": [
    "First no-rescue attempt: can the student continue under difficulty without being rescued?",
    "Recovery check: does independence and recovery hold after difficulty continues?",
    "Confirmation: can the no-rescue response be confirmed across repetition?",
  ],
  "controlled_discomfort.repeat_exposure": [
    "First repeated exposure: can the student meet repeated difficulty at the same level?",
    "Second exposure: does stability hold through another difficult exposure?",
    "Confirmation: can difficulty tolerance be confirmed as repeatable?",
  ],
};

const CONTROLLED_SET_EXECUTION: Record<
  string,
  {
    studentAction: string;
    specialistAction: string;
    preserve: string;
    doNot: string[];
  }
> = {
  "controlled_discomfort.controlled_entry": {
    studentAction:
      "Pause, face the difficult problem, state the first controlled action, and begin without rushing into random work.",
    specialistAction:
      "Introduce a challenging but solvable problem, require a pause and first-step control, keep support minimal, and observe the initial response.",
    preserve:
      "Controlled entry under difficulty. The target is not immediate comfort; the target is a first response that does not collapse into avoidance, panic, or random guessing.",
    doNot: [
      "Do not remove the difficulty because the student looks uncomfortable.",
      "Do not let the student rush into random execution to escape discomfort.",
      "Do not turn the set back into Structured Execution by making it easy and fully predictable.",
    ],
  },
  "controlled_discomfort.no_rescue": {
    studentAction:
      "Stay with the difficult problem and continue after the first step without being carried by full help.",
    specialistAction:
      "Hold the no-rescue condition, limit support to the allowed first-step boundary, observe rescue-seeking and recovery, then log the actual response.",
    preserve:
      "Difficulty without full rescue. The rep must reveal whether the student can remain engaged when certainty and comfort are not supplied by the Specialist.",
    doNot: [
      "Do not explain the full method during a no-rescue rep.",
      "Do not answer repeated reassurance-seeking with hidden coaching.",
      "Do not convert rescue dependence into stronger-looking evidence by carrying the student through the hard part.",
    ],
  },
  "controlled_discomfort.repeat_exposure": {
    studentAction:
      "Meet another problem at the same difficulty level and show whether the controlled response repeats or breaks down.",
    specialistAction:
      "Repeat the difficulty level without lowering the demand, withhold rescue, observe whether the response stabilizes, and log the evidence honestly.",
    preserve:
      "Repeated exposure at the same difficulty. The set tests tolerance and stability, not one-time survival.",
    doNot: [
      "Do not make later reps easier to manufacture improvement.",
      "Do not skip repetition because one attempt looked strong.",
      "Do not treat survival on one rep as stable difficulty tolerance.",
    ],
  },
};

const observationSignals = [
  "Initial response: does the student freeze, avoid, rush, hesitate, or attempt calmly?",
  "First-step control: can the student identify or produce the first controlled action under difficulty?",
  "Discomfort tolerance: does the student stay inside the difficult moment without collapse?",
  "Rescue dependence: does the student seek rescue immediately, seek reassurance, or continue without being carried?",
];

const progressionBands = [
  "Low: run the Controlled Discomfort drill. Keep the difficulty controlled and do not add timers yet.",
  "Medium: remain in Controlled Discomfort and strengthen stability under repeated difficult exposure.",
  "High: remain in Controlled Discomfort and prove repeatability. High does not phase-progress directly.",
  "High Maintenance: qualifying evidence can progress the topic into Time Pressure Stability at Low. The engine owns that decision.",
];

const constraintLabel = (set: EvidenceSetDefinition) => {
  const support = set.constraints.supportLevel.replaceAll("_", " ");
  const pressure = set.constraints.pressureLevel.replaceAll("_", " ");
  const variation = set.constraints.variationLevel.replaceAll("_", " ");
  const difficulty = set.constraints.difficultyLevel.replaceAll("_", " ");
  return `Support: ${support} | Pressure: ${pressure} | Variation: ${variation} | Difficulty: ${difficulty}`;
};

const diagnosisInstructionFor = (set: EvidenceSetDefinition) => {
  if (set.setId === "controlled_discomfort.first_contact") {
    return "Present the difficult problem, preserve the required no-help opening condition, and observe the first response without rescue.";
  }

  return "Sustain the difficult condition, allow only the permitted first-step boundary, and observe whether engagement and recovery hold under pressure.";
};

export default function ResponseConditioningControlledDiscomfort() {
  const navigate = useNavigate();
  const trainingSchema = useMemo(() => getDrillSchemaDefinition("training", "Controlled Discomfort"), []);
  const diagnosisSchema = useMemo(() => getDrillSchemaDefinition("diagnosis", "Controlled Discomfort"), []);

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
                Controlled Discomfort
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mt-2">
                Train the student to stay structured when difficulty removes certainty.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="controlled-discomfort-v1"
          title="Controlled Discomfort"
          completion={<DeepDiveCapabilityCheck assessmentKey="controlled_discomfort_mastery_v1" />}
        >
        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">The Transformation</h2>
          <p className="text-xl font-semibold">
            Controlled Discomfort asks: can the student stay engaged when the work becomes difficult?
          </p>
          <p className="text-muted-foreground">
            Structured Execution proves the student can run a known method. Controlled Discomfort adds difficulty and removes easy rescue.
            The phase trains a stable first response, first-step control, recovery, and tolerance under repeated challenge.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-semibold">Controlled entry</p>
            <p className="text-sm text-muted-foreground">The student faces difficulty without freezing, rushing randomly, or immediately seeking rescue.</p>
            <p className="font-semibold">No rescue</p>
            <p className="text-sm text-muted-foreground">The student continues while full help is withheld and only the allowed boundary is preserved.</p>
            <p className="font-semibold">Repeated exposure</p>
            <p className="text-sm text-muted-foreground">The response is tested again at the same difficulty until stability can be observed.</p>
          </div>
          <p className="font-medium">
            The goal is not to make the student comfortable. The goal is to make the response controlled while discomfort is present.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Where Controlled Discomfort Sits</h2>
          <p className="text-xl font-bold text-primary">
            Clarity -&gt; Structured Execution -&gt; Controlled Discomfort -&gt; Time Pressure Stability
          </p>
          <p className="text-muted-foreground">
            Controlled Discomfort comes after independent execution and before timed performance. Do not use it to teach basic method
            clarity, and do not turn it into time pressure before difficulty tolerance is stable.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Difficulty is present.</li>
            <li>Full rescue is not allowed.</li>
            <li>Timers are not the main pressure yet.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Phase Inherits</h2>
          <p className="text-muted-foreground">
            Controlled Discomfort does not replace Clarity or Structured Execution. It asks whether that existing mental map and
            independent method execution stay intact after meaningful difficulty is added.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Calmness or persistence cannot turn a wrong method, abandoned structure, or random execution into strong evidence.</li>
            <li>When something goes wrong, locate the earliest visible break: mental map, execution, or response under difficulty.</li>
            <li>A local calculation error can change the final answer without proving an inherited layer collapsed.</li>
            <li>Record the actual break without manually changing the student's phase; RI-OS owns movement and any verification route.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student becomes visibly uncomfortable on a challenging but solvable problem and asks to switch to an easier one. What should the Specialist protect?"
          options={[
            {
              key: "a",
              label: "The student's confidence by reducing difficulty before the discomfort becomes a negative experience.",
              feedback: "That can remove the exact condition being trained. Visible discomfort is not itself evidence that the task is inappropriate.",
            },
            {
              key: "b",
              label: "The assigned accessible difficulty, while observing whether the student can produce a controlled response inside it.",
              feedback: "Yes. The challenge stays because the phase is training response under difficulty, not comfort in the absence of difficulty.",
            },
            {
              key: "c",
              label: "The student's independence by adding a timer instead of offering help, so the pressure comes from time rather than the Specialist.",
              feedback: "A timer introduces a later-phase constraint. It does not preserve the current difficulty condition; it changes what is being tested.",
            },
          ]}
          correctOptionKey="b"
          truth="Controlled Discomfort keeps difficulty present when the task is still appropriate and accessible. The Specialist neither removes the challenge nor adds a later pressure variable just because discomfort appears."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Controlled Discomfort Training Recipe</h2>
          <p className="text-muted-foreground">
            This is the required Controlled Discomfort training sequence.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(" -> ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Every set produces evidence about response under difficulty.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Introduce difficulty -&gt; preserve no-rescue boundaries -&gt; repeat exposure -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="Which problem is best suited to a Controlled Discomfort set?"
          options={[
            {
              key: "a",
              label: "A problem using mathematics the student already has, but presented with enough challenge or uncertainty to test their response.",
              feedback: "Yes. The task must be difficult enough to expose the response while still leaving the student a genuine mathematical path forward.",
            },
            {
              key: "b",
              label: "A problem containing a new method the student has not learned, because genuine uncertainty creates stronger discomfort evidence.",
              feedback: "New content makes the mathematics itself unsupported. A breakdown would no longer cleanly show how the student responds to accessible difficulty.",
            },
            {
              key: "c",
              label: "A familiar easy problem under a strict timer, because urgency can create discomfort without changing the mathematics.",
              feedback: "That makes time the active pressure variable. Controlled Discomfort is meant to isolate response to difficulty before urgency is added.",
            },
          ]}
          correctOptionKey="a"
          truth="The difficulty must be controlled: challenging enough to create uncertainty, but still within the student's existing mathematical capability so the response under challenge can be observed cleanly."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before the Session: What to Prepare</h2>
          <p className="text-muted-foreground">
            Use the active student topic and the Map/pre-session preparation direction. Problems must be challenging but still connected
            to the method the student has already learned to execute. The purpose is controlled difficulty, not impossible work.
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
            <p className="font-semibold">Preparation boundary</p>
            <p className="text-sm text-muted-foreground">
              Do not prepare problems that are difficult only because they are unfamiliar, unfair, or disconnected from the trained method.
              The difficulty must expose response control, not confuse the topic placement.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is its own learning step. Preserve the difficulty and support boundary before moving to the next exposure.
          </p>
        </Card>

        {trainingSchema.sets.map((set, setIndex) => {
          const execution = CONTROLLED_SET_EXECUTION[set.setId];
          const repPurposes = CONTROLLED_REP_PURPOSES[set.setId] || [];

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
          prompt="In a No Rescue rep, the student asks, 'Can you at least tell me how to start?' What is the strongest response?"
          options={[
            {
              key: "a",
              label: "Give the full first step and then withdraw, because the rep only prohibits support after the student has started.",
              feedback: "No Rescue has a defined support boundary. Expanding it whenever the student asks would turn rescue-seeking into a route to extra help.",
            },
            {
              key: "b",
              label: "Use only the support the set explicitly allows, then hold the boundary and observe what the student does next.",
              feedback: "Yes. The point is not absolute silence; it is preserving the exact support contract so dependence and recovery remain observable.",
            },
            {
              key: "c",
              label: "Refuse every form of support, even if the set's defined first-step boundary has not yet been used.",
              feedback: "Being stricter than the assigned condition also changes the rep. The Specialist must preserve the defined boundary, not invent a harsher one.",
            },
          ]}
          correctOptionKey="b"
          truth="No Rescue means no support beyond the set's defined boundary. The Specialist neither expands the support because the student is uncomfortable nor makes the condition harsher than RI assigned."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What You Observe</h2>
          <p className="text-muted-foreground">
            Controlled Discomfort is decided from observed response under difficulty, not from whether the student likes the experience.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {observationSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          <p className="font-medium">
            Observe before you interpret. Record the first response, the first-step control, the tolerance, and the rescue dependence that actually appeared.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The Specialist preserves the difficulty and support boundary, but the student eventually stops and cannot continue. Is the rep invalid?"
          options={[
            {
              key: "a",
              label: "Yes, because a valid difficulty rep must reach completion before it can say anything about stability.",
              feedback: "Completion is not required for the rep to reveal a breakdown. The student's stopping point can be exactly the evidence the condition was designed to expose.",
            },
            {
              key: "b",
              label: "Only if the Specialist thinks a little more encouragement would have worked.",
              feedback: "Specialist expectation does not decide validity. The question is whether the assigned condition was preserved.",
            },
            {
              key: "c",
              label: "No. Rep validity comes from preserving the condition, not from whether the student completes it.",
              feedback: "Yes. Weak learner performance and correct Specialist execution can coexist.",
            },
          ]}
          correctOptionKey="c"
          truth="A Controlled Discomfort rep can be valid even when the student breaks down. Rep validity comes from preserving the assigned condition; the learner's response is what the condition is meant to reveal."
        />

 <Card className="p-6 space-y-5 ">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can freeze, hesitate, ask for rescue, rush randomly, or collapse under difficulty inside a correctly executed drill. That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not remove the discomfort to manufacture stronger-looking evidence. Correct Specialist execution means the difficulty and support boundary were preserved.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: making the problem easier mid-rep, giving full rescue, hiding coaching inside reassurance, skipping repeated exposure, or logging composure that was manufactured.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student handles one difficult exposure calmly. What would most strongly show that Controlled Discomfort is becoming stable?"
          options={[
            {
              key: "b",
              label: "Another valid exposure at the same difficulty, showing that the controlled response can be produced again.",
              feedback: "Yes. Repeatability is established by comparable opportunities, not by escalating after one strong moment.",
            },
            {
              key: "a",
              label: "A harder problem next, to confirm the response can tolerate more demand.",
              feedback: "Increasing the difficulty changes the condition. It would show response to a new demand, not repeatability at the current one.",
            },
            {
              key: "c",
              label: "The same problem repeated immediately, because reproducing the successful response removes uncertainty about whether it was learned.",
              feedback: "Repeating the identical problem can introduce memory of the specific solution. RI needs another comparable exposure, not simple recall of the same task.",
            },
          ]}
          correctOptionKey="b"
          truth="One strong difficult rep shows possibility. Stability requires the controlled response to repeat across comparable valid exposures without changing the demand or turning the task into memorised repetition."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Controlled Discomfort does not progress because the Specialist thinks the student is brave. The engine advances only from qualifying evidence and stability state.
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
            <li>Why Controlled Discomfort comes after independent execution and before timed work.</li>
            <li>Why discomfort must be preserved instead of removed.</li>
            <li>What makes each set valid: controlled entry, no rescue, and repeated exposure.</li>
            <li>What actions contaminate difficulty evidence and require review.</li>
            <li>Why RI-OS, not the Specialist, owns the progression decision.</li>
          </ul>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
