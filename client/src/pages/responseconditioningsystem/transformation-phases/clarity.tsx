import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getDrillSchemaDefinition,
  type EvidenceSetDefinition,
} from "@shared/responseIntegrityDrillRegistry";

const CLARITY_REP_PURPOSES: Record<string, string[]> = {
  "clarity.modeling": [
    "Build the mental map the student will be expected to recognize and use in later reps.",
  ],
  "clarity.identification": [
    "First recognition: can the student identify the type, recall the method, and explain the reason before solving?",
    "Second look: does recognition and explanation hold on another unsolved example?",
    "Confirmation: can clarity be repeated before active solving begins?",
  ],
  "clarity.light_apply": [
    "First application: does the student's clarity carry into the first light solving attempt?",
    "Repeat application: does clarity hold while the method is applied again with minimal guidance?",
    "Independent confirmation: can clarity be confirmed during the final light application check?",
  ],
};

const CLARITY_SET_EXECUTION: Record<
  string,
  {
    studentAction: string;
    specialistAction: string;
    preserve: string;
    doNot: string[];
  }
> = {
  "clarity.modeling": {
    studentAction:
      "Listen to the model, then explain the Vocabulary -> Method -> Reason mental map back. The student does not complete the full solve in this set.",
    specialistAction:
      "Model the topic through Vocabulary -> Method -> Reason. Make the language, applicable method, step order, and reason explicit, then require the student to explain it back.",
    preserve:
      "This is teaching and preparation, not scored evidence. Build the map before asking the student to demonstrate it independently.",
    doNot: [
      "Do not turn Modeling into repeated solving practice.",
      "Do not teach Method without Reason.",
      "Do not move on without an explain-back opportunity.",
    ],
  },
  "clarity.identification": {
    studentAction:
      "For each unsolved example, identify the important terms/type, state the method or steps, and explain why that method applies. Do not solve.",
    specialistAction:
      "Present the recognition problem clearly, ask for the mental map, withhold the answer, observe the response, and log what actually occurred.",
    preserve:
      "Recognition without solving and without Specialist-supplied steps. The rep must reveal what the student can recognize before execution begins.",
    doNot: [
      "Do not let the student solve during Identification.",
      "Do not supply the method or steps during a scored rep.",
      "Do not skip a later rep because an earlier response looked strong.",
    ],
  },
  "clarity.light_apply": {
    studentAction:
      "Solve the problem while keeping the mental map usable: recognize what is present, use the correct method, and preserve the reasoned structure during execution.",
    specialistAction:
      "Ask the student to solve, keep support minimal, observe whether clarity survives action, and record the response without carrying the student through the method.",
    preserve:
      "Active solving with minimal guidance. Correct completion matters, but it must not be manufactured through step-by-step Specialist direction.",
    doNot: [
      "Do not provide step-by-step help.",
      "Do not rescue a weak response to protect the score.",
      "Do not treat a correct answer produced through heavy guidance as evidence of independent clarity.",
    ],
  },
};

const observationSignals = [
  "Vocabulary: can the student name what they are looking at precisely, or does the language remain vague or incorrect?",
  "Method: can the student identify the applicable method and its sequence, or are they guessing?",
  "Reason: can the student explain why the method applies, or are they repeating procedure without logic?",
  "Immediate apply: when asked to respond, do they avoid, remain unsure, or engage with the task?",
];

const progressionBands = [
  "Low: run the Clarity drill. No Boss Battles, no time pressure, no skipping the mental-map layers.",
  "Medium: remain in Clarity. Reduce unnecessary explanation and strengthen repeatable recognition and light execution.",
  "High: remain in Clarity and prove repeatability. High does not phase-progress directly.",
  "High Maintenance: qualifying evidence can progress the topic into Structured Execution at Low. The engine owns that decision.",
];

const constraintLabel = (set: EvidenceSetDefinition) => {
  const support = set.constraints.supportLevel.replaceAll("_", " ");
  const pressure = set.constraints.pressureLevel.replaceAll("_", " ");
  const variation = set.constraints.variationLevel.replaceAll("_", " ");
  const difficulty = set.constraints.difficultyLevel.replaceAll("_", " ");
  return `Support: ${support} | Pressure: ${pressure} | Variation: ${variation} | Difficulty: ${difficulty}`;
};

export default function ResponseConditioningClarity() {
  const navigate = useNavigate();
  const trainingSchema = useMemo(() => getDrillSchemaDefinition("training", "Clarity"), []);
  const diagnosisSchema = useMemo(() => getDrillSchemaDefinition("diagnosis", "Clarity"), []);

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
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Clarity</h1>
              <p className="text-base md:text-lg text-muted-foreground mt-2">
                Build the mental map, then prove that it survives recognition and light execution.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-5 border-l-4 border-l-primary">
          <h2 className="text-2xl font-bold">The Transformation</h2>
          <p className="text-xl font-semibold">
            Clarity asks: does the student know what they are looking at and what should happen next?
          </p>
          <p className="text-muted-foreground">
            Before Response Integrity asks a student to execute independently, withstand difficulty, or work under urgency,
            the student needs a usable mental map. Clarity builds that map through Vocabulary -&gt; Method -&gt; Reason.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-semibold">Vocabulary</p>
            <p className="text-sm text-muted-foreground">What am I looking at? What terms, features, and problem type are present?</p>
            <p className="font-semibold">Method</p>
            <p className="text-sm text-muted-foreground">Which process applies? What happens first and what steps follow?</p>
            <p className="font-semibold">Reason</p>
            <p className="text-sm text-muted-foreground">Why does this method apply here? Why is the sequence appropriate?</p>
          </div>
          <p className="font-medium">
            Clarity is not complete because the Specialist explained well. The target is a student who can increasingly produce
            and use the mental map themselves.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Where Clarity Sits</h2>
          <p className="text-xl font-bold text-primary">
            Clarity -&gt; Structured Execution -&gt; Controlled Discomfort -&gt; Time Pressure Stability
          </p>
          <p className="text-muted-foreground">
            Clarity comes first because we do not test whether execution survives independence, difficulty, or urgency before
            establishing that the student can see the task clearly.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No Boss Battles.</li>
            <li>No time pressure.</li>
            <li>No skipping Vocabulary, Method, or Reason because one layer appears strong.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Clarity Training Recipe</h2>
          <p className="text-muted-foreground">
            This sequence is rendered from the live drill registry so the Deep Dive cannot quietly drift away from the runner.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(" -> ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Modeling is preparation; the later reps
              produce scored evidence.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Build the map -&gt; recognize it repeatedly without solving -&gt; test whether it survives light application
            -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before the Session: What to Prepare</h2>
          <p className="text-muted-foreground">
            Use the active student topic and the Map/pre-session preparation direction. Preparation is not generic worksheet
            selection: every problem must be usable under the condition of the set it belongs to.
          </p>
          <div className="space-y-3">
            {trainingSchema.sets.map((set) => (
              <div key={set.setId} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{set.setName}</h3>
                  <span className="text-sm text-muted-foreground">{set.reps} required {set.reps === 1 ? "opportunity" : "opportunities"}</span>
                </div>
                <p className="text-sm text-muted-foreground">{set.purpose}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{constraintLabel(set)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <p className="font-semibold">Preparation boundary</p>
            <p className="text-sm text-muted-foreground">
              The current system defines quantity, support, pressure, variation, and difficulty constraints. It does not yet define
              a complete universal rule for constructing every mathematical problem. Do not invent extra methodology and treat it as canon.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Run the Drill: Set by Set</h2>
          <p className="text-muted-foreground">
            Each set is a controlled experience. Follow the sequence, preserve the condition, and let every repetition answer its
            own question about the student's response.
          </p>

          <div className="space-y-5">
            {trainingSchema.sets.map((set, setIndex) => {
              const execution = CLARITY_SET_EXECUTION[set.setId];
              const repPurposes = CLARITY_REP_PURPOSES[set.setId] || [];

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
          <h2 className="text-2xl font-bold">What You Observe</h2>
          <p className="text-muted-foreground">
            Clarity is not scored by impression. Scored reps use the fixed observation families below.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {observationSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          <p className="font-medium">
            Observe before you interpret. Record the response that occurred, not the response you hoped to see or the psychological
            explanation you imagine sits behind it.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Weak Student Performance Is Not Failed Execution</h2>
          <p className="text-muted-foreground">
            A student can hesitate, identify the wrong method, give a weak reason, fail to begin, or produce inconsistent responses
            inside a correctly executed drill. That is evidence.
          </p>
          <p className="font-semibold">
            The Specialist must not rescue the score. Correct execution means the condition was preserved and the evidence is trustworthy.
          </p>
          <p className="text-muted-foreground">
            Failed Specialist execution is different: supplying the answer during an observation rep, letting Identification become
            solving, skipping required reps, over-guiding Light Apply, or logging a stronger response than actually occurred can make
            the evidence invalid.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression: Your Job Ends at Submission</h2>
          <p className="text-muted-foreground">
            Your responsibility is Execute -&gt; Observe -&gt; Record -&gt; Submit. RI-OS scores the evidence, updates stability, and determines
            the next action.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {progressionBands.map((band) => (
              <li key={band}>{band}</li>
            ))}
          </ul>
          <p className="font-medium">Do not manually phase-progress a topic because the session felt strong.</p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Diagnosis Is a Different Recipe</h2>
          <p className="text-muted-foreground">
            Clarity diagnosis is not the training drill above. The live diagnosis schema uses separate probes to establish an entry
            point before normal training.
          </p>
          <div className="space-y-3">
            {diagnosisSchema.sets.map((set) => (
              <div key={set.setId} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{set.setName}</h3>
                  <span className="text-sm text-muted-foreground">{set.reps} reps</span>
                </div>
                <p className="text-sm text-muted-foreground">{set.purpose}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{constraintLabel(set)}</p>
              </div>
            ))}
          </div>
          <p className="font-medium">
            Never collapse diagnosis and training into one generic session recipe. Their purposes and support conditions differ.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-l-4 border-l-primary">
          <h2 className="text-2xl font-bold">Clarity in One Picture</h2>
          <p className="text-xl font-semibold">When you see Clarity, think: Build the map.</p>
          <p className="text-muted-foreground">
            Model it once. Test recognition three times without solving. Test light application three times with minimal guidance.
            Preserve Vocabulary -&gt; Method -&gt; Reason. Record the real response. Submit. Let RI-OS decide what happens next.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Before You Enter Sandbox</h2>
          <p className="text-muted-foreground">You should be able to explain, without reading from this page:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Why Clarity comes first.</li>
            <li>What Vocabulary -&gt; Method -&gt; Reason means.</li>
            <li>Why Modeling is different from Identification.</li>
            <li>Why solving is prohibited during Identification.</li>
            <li>Why the three Identification reps are not interchangeable filler.</li>
            <li>Why Light Apply follows recognition.</li>
            <li>What minimal support is trying to preserve.</li>
            <li>What behavior you are observing and recording.</li>
            <li>How Specialist help can contaminate otherwise correct mathematics.</li>
            <li>Why a weak response can still come from a correctly executed drill.</li>
            <li>Why the Specialist never manually progresses the topic.</li>
          </ul>
          <p className="font-semibold">If you understand it, the next step is demonstration, not another explanation.</p>
        </Card>
      </div>
    </div>
  );
}
