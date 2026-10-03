import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDrillSchemaDefinition } from "@shared/responseIntegrityDrillRegistry";

const supportMeaning: Record<string, string> = {
  minimal:
    "Minimal support only. Preserve the difficulty and return execution to the student immediately.",
  first_step_only:
    "Only the first-step boundary may be used. Do not carry the method or the rest of the execution.",
  none:
    "No support. The repeated difficult exposure must stand on the student's response.",
};

const controlledDiscomfortSignals = [
  "Initial response: what happens at first contact with difficulty?",
  "First-step control: can the student begin in a controlled, method-consistent way?",
  "Discomfort tolerance: does the response remain functional while the difficult condition stays present?",
  "Rescue dependence: does responsibility remain with the student or transfer back to the Specialist?",
];

export default function ResponseConditioningHowToUseBossBattles() {
  const navigate = useNavigate();
  const trainingSchema = useMemo(
    () => getDrillSchemaDefinition("training", "Controlled Discomfort"),
    [],
  );

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

          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
              Response Integrity-OS Deep Dive
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
              How to Use Boss Battles
            </h1>
            <p className="text-muted-foreground mt-1">
              Controlled Discomfort problem design under Execution Standards
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="how-to-use-boss-battles-v2"
          title="How to Use Boss Battles"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_to_use_boss_battles_mastery_v1" />}
        >
          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Boss Battles belong inside Controlled Discomfort</h2>
            <p className="text-muted-foreground">
              A Boss Battle is a deliberately challenging, curriculum-appropriate problem used when
              difficulty is the active pressure variable.
            </p>
            <p className="font-semibold">
              Boss Battle is not a fifth phase, not a free-form challenge mode, and not permission to
              improvise support.
            </p>
            <p className="text-muted-foreground">
              The phase is Controlled Discomfort. The live set determines the exact support boundary.
              The Boss Battle is the challenging problem condition used inside that system.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">When a Boss Battle is used</h2>
            <p className="text-muted-foreground">
              The Specialist does not wait until the student "looks comfortable" or count a preferred
              number of correct questions and then decide to add difficulty.
            </p>
            <p className="font-semibold">
              RI-OS assigns Controlled Discomfort from the topic's evidence-derived state. The
              Specialist prepares and runs the assigned Controlled Discomfort drill.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Clarity must not be replaced by difficulty.</li>
              <li>Structured Execution must not be replaced by difficulty.</li>
              <li>Difficulty is introduced because Controlled Discomfort is the correct active load.</li>
              <li>RI-OS decides topic movement after the evidence is submitted.</li>
            </ul>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="The student has solved four easy problems correctly, but the topic is still assigned to Structured Execution. Which conclusions are supported?"
            options={[
              {
                key: "a",
                label: "Four correct answers unlock Boss Battles.",
                feedback: "Correct-answer volume does not decide whether the active phase or pressure condition should change.",
              },
              {
                key: "b",
                label: "The Specialist should keep the assigned Structured Execution condition until RI-OS moves the topic.",
                feedback: "Boss Battles are a Controlled Discomfort load, not a Specialist-selected reward for looking comfortable.",
              },
              {
                key: "c",
                label: "The Specialist can add a Boss Battle when they believe the student needs confidence under challenge.",
                feedback: "Specialist preference does not authorize a phase change.",
              },
              {
                key: "d",
                label: "Boss Battle difficulty belongs to Controlled Discomfort, not Structured Execution.",
                feedback: "The pressure load follows the system-assigned phase.",
              },
              {
                key: "e",
                label: "Keeping the same support boundary makes a Boss Battle valid inside Structured Execution.",
                feedback: "Preserving support does not authorize adding a new difficulty condition outside the assigned phase.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b","d"]}
            truth="Boss Battles are the difficult same-form load inside Controlled Discomfort. The Specialist does not introduce them before RI-OS moves the topic into that phase."
          />

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">The Controlled Discomfort sequence</h2>
            <p className="text-muted-foreground">
              The live Training registry defines three Controlled Discomfort sets. All use challenging,
              same-form problems. What changes is the support boundary and the evidence question.
            </p>
            <div className="space-y-3">
              {trainingSchema.sets.map((set, index) => (
                <div key={set.setId} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Set {index + 1}
                      </p>
                      <h3 className="text-lg font-semibold">{set.setName}</h3>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[11px] font-medium">
                      {set.reps} reps
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{set.purpose}</p>
                  <p className="text-sm font-medium">
                    {supportMeaning[set.constraints.supportLevel] ||
                      `Use the registered ${set.constraints.supportLevel.replaceAll("_", " ")} support boundary.`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Difficulty: {set.constraints.difficultyLevel.replaceAll("_", " ")} | Form:{" "}
                    {set.constraints.variationLevel.replaceAll("_", " ")} | Pressure:{" "}
                    {set.constraints.pressureLevel.replaceAll("_", " ")}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Controlled Entry</h2>
            <p className="text-muted-foreground">
              Controlled Entry introduces the challenging condition while allowing only the registered
              minimal support boundary.
            </p>
            <p className="font-semibold">
              The difficulty stays. Support may target the allowed boundary, but the Specialist does not
              remove the challenge or carry the execution.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">No Rescue</h2>
            <p className="text-muted-foreground">
              No Rescue tightens the support boundary to first-step-only. The Specialist may not turn
              uncertainty into a worked demonstration or method walkthrough.
            </p>
            <p className="font-semibold">
              First-step-only is a rule for a specific set. It is not the universal rule for every Boss Battle.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Repeat Exposure</h2>
            <p className="text-muted-foreground">
              Repeat Exposure removes support. The same challenging condition is repeated so the system can
              see whether controlled engagement and recovery now hold without rescue.
            </p>
            <p className="font-semibold">
              Do not soften the problem, add reassurance that changes execution, or supply a step because
              the repeated exposure feels uncomfortable.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="During No Rescue, the student stalls and asks for help. What support may the Specialist provide?"
            options={[
              {
                key: "a",
                label: "Walk through the method until the student is moving again.",
                feedback: "That becomes rescue and destroys the first-step-only condition.",
              },
              {
                key: "b",
                label: "Use only the registered first-step boundary, then return responsibility to the student.",
                feedback: "Yes. The set determines support, not the amount of discomfort in the moment.",
              },
              {
                key: "c",
                label: "No support at all, because every Boss Battle is always no-help.",
                feedback: "No-help belongs to Repeat Exposure. No Rescue is specifically first-step-only.",
              },
              {
                key: "d",
                label: "Only the authorized first-step boundary; reassurance that confirms later steps would become additional support.",
                feedback: "Yes. Support stops at the first-step boundary.",
              },
              {
                key: "e",
                label: "A full method explanation followed by another No Rescue attempt on the same problem.",
                feedback: "That converts the rep into teaching and then gives a second chance on exposed material.",
              },
            ]}
            correctOptionKey="b"
            truth="Boss Battle difficulty does not define support. The active Controlled Discomfort set does."
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">What you actually observe</h2>
            <p className="text-muted-foreground">
              The goal is not to invent a psychological story about the student. Observe the response
              dimensions the system can defend.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {controlledDiscomfortSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <p className="font-semibold">
              Record behavior, support, and condition separately. Do not convert facial expression, tone,
              or your impression into an unsupported diagnosis.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">What Boss Battles are not</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>They are not random difficulty for motivation or entertainment.</li>
              <li>They are not Time Pressure Stability. No timer is added merely because a problem is hard.</li>
              <li>They are not a reason to abandon same-form comparability inside the registered Training sets.</li>
              <li>They are not a reason to rescue a student from a valid difficult response.</li>
              <li>They are not a manual test for deciding phase movement outside RI-OS.</li>
            </ul>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A Boss Battle produces panic, a wrong method, and incomplete work, but the problem and support condition were valid. Should the Specialist repeat it immediately with an easier version so the student can finish successfully?"
            options={[
              {
                key: "a",
                label: "Yes. A Boss Battle should end with a successful completion.",
                feedback: "The weak response is real evidence. Changing the condition to manufacture success hides the truth the drill was designed to expose.",
              },
              {
                key: "b",
                label: "No. Preserve and record the valid response, then let RI-OS determine the next action.",
                feedback: "Yes. The Specialist protects the condition and records what happened.",
              },
              {
                key: "c",
                label: "Yes, but only if the easier problem remains in the same topic.",
                feedback: "Same topic does not make a changed difficulty condition equivalent.",
              },
              {
                key: "d",
                label: "No. The weak response is exactly the kind of valid difficulty evidence Controlled Discomfort is meant to expose.",
                feedback: "Yes. A clean breakdown under the assigned load remains useful evidence.",
              },
              {
                key: "e",
                label: "Yes, if the easier version is only slightly easier and keeps the same method.",
                feedback: "Any performance-dependent softening changes the intended difficulty condition and chases success.",
              },
            ]}
            correctOptionKey="b"
            truth="Controlled Discomfort is valuable because valid difficulty reveals the response. The Specialist does not chase a preferred result."
          />

          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Operating rule</h2>
            <p className="font-semibold">
              Controlled Discomfort chooses the load. The set chooses the support boundary. The Specialist
              preserves both. Evidence decides what happens next.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
