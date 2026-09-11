import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
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
      "Do not convert rescue dependence into a stronger score by carrying the student through the hard part.",
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
    return "Present the difficult problem, preserve the no-help opening condition exactly as the runner specifies, and observe the first response without rescue.";
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
        <Card className="p-6 space-y-5 border-l-4 border-l-primary">
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

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Controlled Discomfort Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is rendered from the live drill registry so the Deep Dive stays aligned with the runner.
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

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is a controlled exposure. Preserve the difficulty, preserve the support boundary, and let every repetition reveal
            whether the student's response survives discomfort.
          </p>

          <div className="space-y-5">
            {trainingSchema.sets.map((set, setIndex) => {
              const execution = CONTROLLED_SET_EXECUTION[set.setId];
              const repPurposes = CONTROLLED_REP_PURPOSES[set.setId] || [];

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
            Diagnosis exposes whether difficulty immediately destabilizes the student or whether the topic is ready for ongoing discomfort training.
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
            Controlled Discomfort is scored by response under difficulty, not by whether the student likes the experience.
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

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can freeze, hesitate, ask for rescue, rush randomly, or collapse under difficulty inside a correctly executed drill. That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not remove the discomfort to protect the score. Correct Specialist execution means the difficulty and support boundary were preserved.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: making the problem easier mid-rep, giving full rescue, hiding coaching inside reassurance, skipping repeated exposure, or logging composure that was manufactured.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Controlled Discomfort does not progress because the Specialist thinks the student is brave. The engine advances only from qualifying scored evidence and stability state.
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
      </div>
    </div>
  );
}
