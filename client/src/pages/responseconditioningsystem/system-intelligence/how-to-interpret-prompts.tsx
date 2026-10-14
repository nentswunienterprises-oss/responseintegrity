import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowToInterpretPrompts() {
  const navigate = useNavigate();

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
              How to Interpret Prompts
            </h1>
            <p className="text-muted-foreground mt-1">under System Intelligence</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="system-intelligence-how-to-interpret-prompts-v1"
          title="How to Interpret Prompts"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_to_interpret_prompts_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The runner is telling you what to do next</h2>
          <p className="text-muted-foreground">
            Every prompt exists because the current session state, phase, set, evidence question, or constraint requires a specific action.
          </p>
          <p className="font-semibold">
            Read the prompt by function before acting on it.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">SAY means student-facing language</h2>
          <p className="text-muted-foreground">
            When the runner labels a line SAY, that line is the student-facing script for the live moment.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Say it to the student.</li>
            <li>Do not replace it with a leading version that reveals the answer or next step.</li>
            <li>Do not append extra coaching because silence feels uncomfortable.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">DO THIS NOW means operator action</h2>
          <p className="text-muted-foreground">
            DO THIS NOW tells the Specialist what to physically or operationally do. It is not text to read aloud.
          </p>
          <p className="text-muted-foreground">
            Examples include presenting the prepared problem, observing without rescue, starting the correct condition, recording evidence, or preserving the active support rule.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The runner shows DO THIS NOW: Present the prepared problem and observe without rescue. What should the Specialist say to the student?"
          options={[
            {
              key: "a",
              label: "Read the whole instruction aloud so the student knows the protocol.",
              feedback: "DO THIS NOW is an operator instruction. Reading it aloud can change the student's response condition.",
            },
            {
              key: "b",
              label: "Do the action. Only student-facing SAY text should be spoken as script.",
              feedback: "Yes. The labels separate operator action from student-facing language.",
            },
            {
              key: "c",
              label: "Paraphrase the instruction into encouragement.",
              feedback: "Paraphrasing can add unintended support. Preserve the written boundary.",
            },
              {
                key: "d",
                label: "Use only any separate SAY wording that the runner provides for the student-facing instruction.",
                feedback: "Yes. SAY is the student-facing channel; DO THIS NOW remains operator-facing.",
              },
              {
                key: "e",
                label: "Explain that the Specialist will not rescue so the student understands the rules before starting.",
                feedback: "That reveals an operator condition to the student and can change how they respond.",
              },
          ]}
          correctOptionKeys={["b","d"]}
          truth="SAY and DO THIS NOW are different control channels. Mixing them can contaminate the condition."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The evidence question is for your understanding</h2>
          <p className="text-muted-foreground">
            The evidence question tells you what uncertainty this opportunity exists to resolve. It is not automatically a question to ask the student.
          </p>
          <p className="font-semibold">
            Do not turn the evidence question into live coaching.
          </p>
          <p className="text-muted-foreground">
            Example: if the evidence question is whether independent execution holds, asking "What method are you using?" can supply a cue and change the very condition being measured.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why this opportunity exists explains system intent</h2>
          <p className="text-muted-foreground">
            This text explains why RI-OS opened the current opportunity: a first clean exposure, removing pressure to check an earlier layer, confirmation, completing a baseline, resolving conflicting evidence, or checking Handover continuity.
          </p>
          <p className="text-muted-foreground">
            It helps you understand the system's reasoning so you can preserve the intended condition. It does not give you permission to change that condition.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Observation prompts belong after the response boundary</h2>
          <p className="text-muted-foreground">
            During Diagnosis and other evidence-sensitive opportunities, the student completes one continuous response first. The observation runner opens after Student Finished.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Observe the whole response live.</li>
            <li>Freeze the execution boundary at actual completion.</li>
            <li>Then answer the observation questions one at a time.</li>
            <li>Record only what actually occurred; do not manufacture or backfill evidence to satisfy a form.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The Specialist is checking independent method selection. The student looks at a worked example left beside the task that already names the correct method, then chooses the same method. What preserves the observation boundary?"
          options={[
            {
              key: "a",
              label: "Mark independent selection supported because the chosen method was correct.",
              feedback: "A correct choice after seeing the method is not independent method selection.",
            },
            {
              key: "b",
              label: "Record the visible worked-example cue and treat the affected independence claim as confounded.",
              feedback: "The mathematical cue compromised the specific independence claim being tested.",
            },
            {
              key: "c",
              label: "Mark the student's method selection as a breakdown for needing the example.",
              feedback: "Confounded evidence is not proof that independent capability failed.",
            },
            {
              key: "d",
              label: "Preserve any earlier clean observations separately and follow the system's next qualifying opportunity.",
              feedback: "A contaminated claim does not erase unrelated clean behaviour or authorize invented evidence.",
            },
            {
              key: "e",
              label: "Ask the student afterward whether they knew the method and backfill their answer as independent evidence.",
              feedback: "A retrospective explanation cannot remove the original cue or rewrite the live condition.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d"]}
          truth="Observation prompts report the actual response, not a preferred result. A visible worked example can confound an independence claim; preserve the cue and let RI-OS determine whether a clean comparable opportunity is required."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">System direction comes from evidence</h2>
          <p className="text-muted-foreground">
            When the runner says continue checking, keep the state, require targeted re-diagnosis, run a specific drill, or preserve a state, RI-OS is applying the shared rules to the clean evidence that was recorded.
          </p>
          <p className="text-muted-foreground">
            The point is consistency: the same evidence should produce the same next action regardless of which Specialist happens to be present. Specialist judgment still matters through accurate observation, condition preservation, truthful recording, and identifying a prompt or system defect that needs escalation.
          </p>
          <p className="font-semibold">
            Follow the current direction because it comes from the recorded evidence, not because software is beyond question. Do not replace it with preference during the live flow; change the direction only when new clean evidence or a confirmed system correction supports it.
          </p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
