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

const STRUCTURED_REP_PURPOSES: Record<string, string[]> = {
  "structured_execution.required_structure": [
    "First attempt: can the student pause, state the required method, and execute without skipping the structure?",
    "Repetition: does required step discipline hold again after the first structured attempt?",
    "Confirmation: can the required structure be treated as repeatable inside the set?",
  ],
  "structured_execution.independent_execution": [
    "First independent attempt: can execution begin and continue without Specialist help?",
    "Error-handling check: does independence hold when the student has to correct or continue without being carried?",
    "Repeatability check: is independent execution repeatable rather than isolated?",
  ],
  "structured_execution.variation_control": [
    "First transfer attempt: does the method survive the first changed problem form?",
    "Second transfer attempt: does step retention hold through another variation?",
    "Confirmation: can transfer be confirmed across the variation set?",
  ],
};

const STRUCTURED_SET_EXECUTION: Record<
  string,
  {
    studentAction: string;
    specialistAction: string;
    preserve: string;
    doNot: string[];
  }
> = {
  "structured_execution.required_structure": {
    studentAction:
      "State the method or step order first, then solve. The answer is not allowed to outrun the structure.",
    specialistAction:
      "Require the student to name the sequence before execution. Observe whether they can hold the order while solving, then log the actual response.",
    preserve:
      "Structure-before-answer. The target is not a lucky correct answer; the target is a visible method chain the student can follow.",
    doNot: [
      "Do not accept a correct answer if the required steps were skipped.",
      "Do not supply the next step before the student attempts the sequence.",
      "Do not turn this set back into Clarity modeling unless the engine places the topic back there.",
    ],
  },
  "structured_execution.independent_execution": {
    studentAction:
      "Solve independently from start to finish, using the known method without being carried by the Specialist.",
    specialistAction:
      "Withhold help, observe the start, structure, error handling, and completion, then log what happened without strengthening the evidence through rescue.",
    preserve:
      "No-help execution. The rep must reveal whether the student can execute the known method without Specialist direction.",
    doNot: [
      "Do not give step-by-step help.",
      "Do not interrupt hesitation too early just to keep the session comfortable.",
      "Do not treat assisted execution as independent execution.",
    ],
  },
  "structured_execution.variation_control": {
    studentAction:
      "Apply the same method to a changed form and keep the structure stable even though the surface of the problem is different.",
    specialistAction:
      "Present a changed-form problem, do not point out what changed, observe whether the student transfers the method, and log the actual response.",
    preserve:
      "Same method, changed form. The set tests transfer, not memorized repetition and not Specialist-led noticing.",
    doNot: [
      "Do not hint at what changed in the problem form.",
      "Do not reduce the variation until the rep no longer tests transfer.",
      "Do not count memorized same-form execution as variation control.",
    ],
  },
};

const observationSignals = [
  "Start behavior: does the student begin, delay, avoid, or wait for help?",
  "Step execution: does the student preserve the required sequence or guess around it?",
  "Repeatability: does the method chain hold across reps or drift after one good attempt?",
  "Independence: does the student continue without being carried by Specialist prompts?",
];

const progressionBands = [
  "Low: run the Structured Execution drill. No Boss Battles, no timer, and no premature pressure escalation.",
  "Medium: remain in Structured Execution and strengthen repeatable method use across multiple problems.",
  "High: remain in Structured Execution and prove repeatability. High does not phase-progress directly.",
  "High Maintenance: qualifying evidence can progress the topic into Controlled Discomfort at Low. The engine owns that decision.",
];

const constraintLabel = (set: EvidenceSetDefinition) => {
  const support = set.constraints.supportLevel.replaceAll("_", " ");
  const pressure = set.constraints.pressureLevel.replaceAll("_", " ");
  const variation = set.constraints.variationLevel.replaceAll("_", " ");
  const difficulty = set.constraints.difficultyLevel.replaceAll("_", " ");
  return `Support: ${support} | Pressure: ${pressure} | Variation: ${variation} | Difficulty: ${difficulty}`;
};

const diagnosisInstructionFor = (set: EvidenceSetDefinition) => {
  if (set.setId === "structured_execution.start_and_structure") {
    return "Give the student the problem, preserve the no-help opening condition, and observe whether they can start and structure the method without being carried.";
  }

  return "Give a similar problem and observe whether execution remains stable across repetition without step-by-step guidance.";
};

export default function ResponseConditioningStructuredExecution() {
  const navigate = useNavigate();
  const trainingSchema = useMemo(() => getDrillSchemaDefinition("training", "Structured Execution"), []);
  const diagnosisSchema = useMemo(() => getDrillSchemaDefinition("diagnosis", "Structured Execution"), []);

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
                Structured Execution
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mt-2">
                Turn clarity into independent, repeatable method use.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="structured-execution-v1"
          title="Structured Execution"
          completion={<DeepDiveCapabilityCheck assessmentKey="structured_execution_mastery_v1" />}
        >
        <Card className="p-6 space-y-5 border-l-4 border-l-primary">
          <h2 className="text-2xl font-bold">The Transformation</h2>
          <p className="text-xl font-semibold">
            Structured Execution asks: can the student do the known method without being carried?
          </p>
          <p className="text-muted-foreground">
            Clarity proves the student can see the problem and name the method. Structured Execution proves the student can act on
            that clarity. The phase trains visible step order, independent starts, repetition, and method transfer before difficulty
            or time pressure are introduced.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-semibold">Structure</p>
            <p className="text-sm text-muted-foreground">The student states or preserves the method chain before chasing the answer.</p>
            <p className="font-semibold">Independence</p>
            <p className="text-sm text-muted-foreground">The student begins and continues without being rescued by prompts.</p>
            <p className="font-semibold">Repeatability</p>
            <p className="text-sm text-muted-foreground">The response holds across reps, not only on one comfortable attempt.</p>
          </div>
          <p className="font-medium">
            A correct answer is not enough if the structure was skipped or manufactured by Specialist help.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Where Structured Execution Sits</h2>
          <p className="text-xl font-bold text-primary">
            Clarity -&gt; Structured Execution -&gt; Controlled Discomfort -&gt; Time Pressure Stability
          </p>
          <p className="text-muted-foreground">
            Structured Execution comes after Clarity and before Controlled Discomfort. It is still a no-pressure phase. Do not introduce
            Boss Battles or timers before the student has shown the method can be executed independently and repeatedly.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No Boss Battles.</li>
            <li>No timed pressure.</li>
            <li>No rescuing the student into stronger-looking evidence.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Phase Inherits</h2>
          <p className="text-muted-foreground">
            Progression adds a condition; it does not discard Clarity. Structured Execution inherits the student's Vocabulary, Method,
            ordered steps, and Reason mental map and adds independent, ordered, repeatable execution.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>If Vocabulary, Method, ordered steps, or Reason visibly breaks, record that break instead of letting a correct answer hide it.</li>
            <li>An isolated calculation error does not automatically mean the mental map broke; locate where the error actually occurred.</li>
            <li>The Specialist records the evidence. RI-OS owns topic-state movement and any prerequisite verification route.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student gets the right answer but skips the required method structure. What is the strongest RI reading?"
          options={[
            {
              key: "a",
              label: "Structured Execution is proven because the answer is correct.",
              feedback: "A correct answer can still hide an unstable or missing execution structure.",
            },
            {
              key: "b",
              label: "The result is mathematically correct, but the required execution structure has not been evidenced.",
              feedback: "This phase is about repeatable method execution, not answer-only success.",
            },
            {
              key: "c",
              label: "Return automatically to Clarity.",
              feedback: "Skipping structure is evidence inside Structured Execution; it does not automatically prove a Clarity breakdown.",
            },
          ]}
          correctOptionKey="b"
          truth="Structured Execution asks whether the student can hold the known method in order. Answer correctness alone cannot substitute for visible, repeatable execution structure."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Structured Execution Training Recipe</h2>
          <p className="text-muted-foreground">
            This is the required Structured Execution training sequence.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(" -> ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Every set produces decision-eligible execution evidence.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Require structure -&gt; withhold help -&gt; test variation -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="Which material is most appropriate when the learner is being asked to stabilize execution of a method they already know?"
          options={[
            { key: "a", label: "Problems that use the known method and allow the execution sequence to be observed repeatedly.", feedback: "The material should expose whether the learner can carry the known method reliably." },
            { key: "b", label: "Problems requiring a completely new method the learner has never seen.", feedback: "A new method can turn the session into recognition or teaching rather than execution evidence." },
            { key: "c", label: "Only one familiar example, because repetition would be redundant.", feedback: "Repeatability cannot be established from one execution opportunity." },
          ]}
          correctOptionKey="a"
          truth="This phase assumes the method is already recognized. Preparation should create repeated opportunities to observe whether the learner can execute that known method in a stable sequence."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before the Session: What to Prepare</h2>
          <p className="text-muted-foreground">
            Use the active student topic and the Map/pre-session preparation direction. Every problem must be usable under the condition
            of the set it belongs to: required structure, no-help independence, or changed-form transfer.
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
              Prepare problems that reveal execution quality, not problems that let the Specialist reteach every step. If the student
              needs heavy remodelling, that is evidence that the topic may not yet belong here.
            </p>
            <p className="text-sm text-muted-foreground">
              Independent Execution also supplies the passive TPS baseline. Before the session, prepare one fresh equivalent same-form, normal-difficulty reserve problem for that set. It is contingency inventory only for an objective technical timing failure - not an extra rep and not a way to replace weak student performance.
            </p>
            <p className="text-sm font-medium">
              If the timing setup fails and the attempt can no longer be trusted, leave that attempt unresolved. Do not reuse the exposed problem or improvise a replacement mid-session.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is its own learning step. Follow the sequence and notice exactly what must stay visible before moving on.
          </p>
        </Card>

        {trainingSchema.sets.map((set, setIndex) => {
          const execution = STRUCTURED_SET_EXECUTION[set.setId];
          const repPurposes = STRUCTURED_REP_PURPOSES[set.setId] || [];

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

              <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4 space-y-2">
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
          prompt="During an independent-execution rep, the student asks, 'What comes next?' What should the Specialist do?"
          options={[
            {
              key: "a",
              label: "Give the next step so the rep can keep moving.",
              feedback: "That would turn the no-help condition into supported execution.",
            },
            {
              key: "b",
              label: "Preserve the no-help condition, observe the request and let the response become evidence.",
              feedback: "The rep exists to reveal whether execution can continue without being carried.",
            },
            {
              key: "c",
              label: "End the drill immediately and mark the whole phase failed.",
              feedback: "A weak response is useful evidence; it does not mean the Specialist execution failed.",
            },
          ]}
          correctOptionKey="b"
          truth="Do not rescue the execution chain into stronger-looking evidence. Preserve the condition, observe what the student can actually do, and record the support dependence that appears."
        />

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What You Observe</h2>
          <p className="text-muted-foreground">
            Structured Execution is not decided by whether the student sounds confident. It is decided from visible execution behavior.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {observationSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          <p className="font-medium">
            Observe before you interpret. Record the structure the student actually used, the help they actually needed, and whether the
            method held across repetition.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="During a correctly run no-help rep, the learner stops halfway and cannot continue. What is the correct interpretation?"
          options={[
            { key: "a", label: "The rep failed and should be removed from the record.", feedback: "The no-help condition worked: it revealed where independent execution stopped." },
            { key: "b", label: "The learner produced useful evidence of an execution breakdown.", feedback: "A breakdown under the intended condition is valid evidence, not a failed session." },
            { key: "c", label: "The Specialist should finish the method and record the rep as complete.", feedback: "Finishing for the learner would hide the point where independence ended." },
          ]}
          correctOptionKey="b"
          truth="A no-help rep is successful as an evidence event when it truthfully reveals the learner's independent execution, even when that execution breaks down."
        />

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can delay, skip steps, guess, lose repeatability, or fail to adapt to variation inside a correctly executed drill.
            That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not rescue the execution chain into stronger-looking evidence. Correct Specialist execution means the condition
            was preserved and the evidence is trustworthy.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: providing steps during a no-help rep, accepting unstructured guessing as success,
            reducing variation until it no longer tests transfer, or logging independence that was actually assisted.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The student executes the known form well, then loses the method when the problem form changes. What should happen?"
          options={[
            {
              key: "a",
              label: "Reduce the variation until the student succeeds.",
              feedback: "Removing the changed form would remove the thing the set is testing.",
            },
            {
              key: "b",
              label: "Keep the variation valid and record the breakdown as Structured Execution evidence.",
              feedback: "Variation Control tests whether the method survives a changed form.",
            },
            {
              key: "c",
              label: "Progress to Controlled Discomfort because variation itself is difficulty.",
              feedback: "Changed form inside Structured Execution is not automatically Controlled Discomfort.",
            },
          ]}
          correctOptionKey="b"
          truth="Variation Control belongs inside Structured Execution. The Specialist preserves the changed form, observes whether the method transfers, and lets the evidence determine the next state."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Structured Execution does not progress because the Specialist feels satisfied. The engine advances only from qualifying
            qualifying evidence and stability state.
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
            <li>Why Structured Execution comes after Clarity and before difficulty work.</li>
            <li>Why a correct answer without visible method structure is not enough.</li>
            <li>What makes each set valid: required structure, independent execution, and variation control.</li>
            <li>What actions contaminate the evidence and require review.</li>
            <li>Why RI-OS, not the Specialist, owns the progression decision.</li>
          </ul>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
