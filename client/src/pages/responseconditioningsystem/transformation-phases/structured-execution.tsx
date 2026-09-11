import { useMemo } from "react";
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
            <li>No rescuing the student into a stronger-looking score.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Structured Execution Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is rendered from the live drill registry so the Deep Dive stays aligned with the runner.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(" -> ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Every set produces scored execution evidence.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Require structure -&gt; withhold help -&gt; test variation -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

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
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is a controlled experience. Follow the sequence, preserve the condition, and let every repetition answer its own
            question about the student's execution.
          </p>

          <div className="space-y-5">
            {trainingSchema.sets.map((set, setIndex) => {
              const execution = STRUCTURED_SET_EXECUTION[set.setId];
              const repPurposes = STRUCTURED_REP_PURPOSES[set.setId] || [];

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
            Diagnosis uses a shorter Structured Execution check before ongoing training begins. It verifies whether execution is already
            present or whether the topic needs structured training.
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
            Structured Execution is not scored by whether the student sounds confident. It is scored by visible execution behavior.
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

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can delay, skip steps, guess, lose repeatability, or fail to adapt to variation inside a correctly executed drill.
            That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not rescue the execution chain to protect the score. Correct Specialist execution means the condition
            was preserved and the evidence is trustworthy.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: providing steps during a no-help rep, accepting unstructured guessing as success,
            reducing variation until it no longer tests transfer, or logging independence that was actually assisted.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Structured Execution does not progress because the Specialist feels satisfied. The engine advances only from qualifying
            scored evidence and stability state.
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
      </div>
    </div>
  );
}
