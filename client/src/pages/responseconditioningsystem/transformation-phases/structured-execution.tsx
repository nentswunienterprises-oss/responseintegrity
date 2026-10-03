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
      "Do not turn this set back into Clarity modelling unless RI-OS places the topic back there.",
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
  "High Maintenance: the required clean evidence can progress the topic into Controlled Discomfort at Low. RI-OS decides that from the evidence.",
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
            
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
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
        <Card className="p-6 space-y-5">
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
            <li>The Specialist records the evidence. RI-OS decides whether the topic state changes and whether an earlier prerequisite needs checking.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student reaches the correct answer but skips two required steps and cannot explain how they moved between them. What does the result show?"
          options={[
            {
              key: "a",
              label: "Structured Execution is strong enough, because the correct outcome proves the missing steps were mentally understood.",
              feedback: "The missing structure cannot be inferred from the correct answer. RI needs the execution chain to be observable and repeatable.",
            },
            {
              key: "b",
              label: "The correct result proves the outcome, not that the student can reliably execute the required sequence.",
              feedback: "Yes. This phase asks whether the known method can be carried in order, not whether one answer happened to land correctly.",
            },
            {
              key: "c",
              label: "Return to Clarity, because skipped steps mean the method is no longer understood.",
              feedback: "Skipped execution does not automatically prove a recognition failure. RI preserves earlier supported layers unless the evidence actually contradicts them.",
            },
            {
              key: "d",
              label: "Treat the skipped steps as an arithmetic detail and keep Structured Execution strong because the outcome was correct.",
              feedback: "The phase is about carrying the method structure visibly and repeatably. Missing required steps are not repaired by the final answer.",
            },
            { key: "e", label: "The answer can be correct while the required execution chain is still unproven because the skipped steps were never shown.", feedback: "Yes. Outcome correctness cannot replace observable, repeatable structure." },
          ]}
          correctOptionKeys={["b","e"]}
          truth="Structured Execution requires visible, repeatable method use. A correct answer cannot substitute for evidence that the student can carry the known structure independently."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Structured Execution Training Recipe</h2>
          <p className="text-muted-foreground">
            This is the required Structured Execution training sequence.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold text-lg">
              {trainingSchema.sets.map((set) => `${set.setName} (${set.reps})`).join(", ")}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {requiredTrainingProblems} required opportunities in the live training drill. Every set produces execution evidence RI-OS can use.
            </p>
          </div>
          <p className="font-medium">
            Mental model: Require structure -&gt; withhold help -&gt; test variation -&gt; submit evidence -&gt; let RI-OS decide what happens next.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="You are preparing a Required Structure set for a method the student already recognises. Which material is best?"
          options={[
            { key: "a", label: "Use several comparable problems built on the already-known method so the Specialist can see whether the sequence repeats reliably.", feedback: "Yes. Required Structure needs repeated opportunities to observe the known method, not new-method learning or transfer." },
            {
              key: "c",
              label: "A new method from the same topic, because successful execution would prove the student can generalise structure.",
              feedback: "A new method changes the prerequisite. The Specialist would no longer know whether a breakdown came from recognition or execution.",
            },
            {
              key: "b",
              label: "Several appropriate problems using the known method, so the sequence can be observed repeatedly.",
              feedback: "Yes. The material should expose repeatable execution of the known method without silently turning the task into new-method learning.",
            },
            {
              key: "d",
              label: "Mix familiar and changed forms in the same set so the Specialist can test structure and transfer at once.",
              feedback: "Required Structure and Variation Control answer different questions. Mixing them makes the source of breakdown less clear.",
            },
            {
              key: "e",
              label: "Use one long complex problem instead of repeated comparable opportunities, because one problem can expose the entire sequence.",
              feedback: "One complex opportunity gives less repeatability evidence and can add difficulty that the set is not meant to test.",
            },
          ]}
          correctOptionKeys={["b","a"]}
          truth="Structured Execution assumes the method is already known. Preparation should create repeated opportunities to observe whether the student can carry that method reliably under the intended set condition."
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
          prompt="During a no-help execution rep, the student asks, 'Is this the right next step?' What response preserves the rep?"
          options={[
            {
              key: "a",
              label: "Confirm yes or no, because that checks the student's idea without telling them what the next step is.",
              feedback: "A yes or no answer still supplies directional information the learner was supposed to generate and evaluate independently.",
            },
            {
              key: "c",
              label: "Do not resolve the step; observe the request and let the student's next action stand as evidence.",
              feedback: "Yes. The condition is designed to show whether execution can continue without Specialist direction.",
            },
            {
              key: "b",
              label: "Ask, 'What do you think?' so the student remains the one choosing the next step.",
              feedback: "Reflecting the question back still becomes a prompt that can carry a stalled response. In a no-help rep, the support request itself is evidence.",
            },
            {
              key: "d",
              label: "Say nothing but nod if the step is correct, because non-verbal confirmation does not count as help.",
              feedback: "A nod still resolves uncertainty for the student and can direct the next action. No-help includes non-verbal confirmation.",
            },
            { key: "e", label: "Leave the uncertainty unresolved and observe what the student does next; answering the support request would change the no-help condition.", feedback: "Yes. The request itself is evidence, and resolving it would supply direction." },
          ]}
          correctOptionKeys={["c","e"]}
          truth="No-help execution must remain no-help when the student becomes uncertain. The request for support is evidence; answering it would change what the rep measures."
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
          prompt="The student stalls. The Specialist silently points to the line where the next step should happen, and the student completes the method. Which conclusions are supported?"
          options={[
            {
              key: "a",
              label: "Because nothing was said aloud, the rep remains no-support.",
              feedback: "Support is not limited to words. Pointing can remove the very decision the student was supposed to make independently.",
            },
            {
              key: "b",
              label: "The cue can be ignored because most of the response was independent.",
              feedback: "The size of the cue does not make it disappear. If it materially directs execution, it belongs in the evidence.",
            },
            {
              key: "c",
              label: "The gesture counts as support because it supplied direction at the stall.",
              feedback: "RI records the functional effect of the Specialist's action, not merely whether help was verbal.",
            },
            {
              key: "d",
              label: "The stall before the gesture remains evidence of where independent execution stopped.",
              feedback: "The support does not erase the point at which the student's unaided execution ended.",
            },
            {
              key: "e",
              label: "The final completion can be logged as fully independent because the cue was non-verbal.",
              feedback: "Non-verbal direction can carry execution just as verbal prompting can. Later completion does not restore a clean no-help condition.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["c","d"]}
          truth="Non-verbal direction can contaminate independent execution just as verbal prompting can. The evidence must preserve where the student stopped and what the Specialist supplied."
        />

 <Card className="p-6 space-y-5 ">
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
          prompt="The student executes a familiar form well, then loses the same method when the problem is presented differently. What should the Specialist preserve next?"
          options={[
            {
              key: "a",
              label: "The changed form, because the breakdown is showing whether the known method transfers across variation.",
              feedback: "Yes. Variation Control exists to expose whether execution survives a changed presentation.",
            },
            {
              key: "b",
              label: "Return to the familiar form and rebuild successful execution first.",
              feedback: "Returning only to the familiar form can hide the transfer weakness that the changed form just revealed.",
            },
            {
              key: "c",
              label: "A harder unfamiliar problem, because losing the method under change means the student is ready for Controlled Discomfort.",
              feedback: "Variation is not automatically a difficulty-phase condition. The current evidence still concerns transfer of the known execution structure.",
            },
            {
              key: "d",
              label: "Return to Required Structure because any changed-form failure proves the familiar execution was not truly stable.",
              feedback: "A transfer breakdown can exist even when familiar-form structure is supported. RI should not erase that earlier evidence automatically.",
            },
            {
              key: "e",
              label: "Keep the changed form but add minimal hints so the student can show whether the method returns with a little support.",
              feedback: "Variation Control is a no-help transfer condition. Adding hints would answer a different question.",
            },
          ]}
          correctOptionKey="a"
          truth="Variation Control belongs inside Structured Execution. The Specialist preserves a valid changed form and observes whether the known method survives the change without adding a different phase demand."
        />

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Progression Logic</h2>
          <p className="text-muted-foreground">
            Structured Execution does not progress because the Specialist feels satisfied. RI-OS advances only when the required clean evidence and stability state support it.
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
