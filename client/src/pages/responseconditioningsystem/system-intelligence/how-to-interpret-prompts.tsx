import { useNavigate } from "react-router-dom";
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
          completion={null}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The runner is giving you operating instructions, not prose</h2>
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
            Examples include presenting the prepared problem, observing without rescue, starting the correct condition, recording evidence, or preserving a support boundary.
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
          ]}
          correctOptionKey="b"
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
            This text explains why RI-OS opened the current opportunity: cold exposure, constraint stripping, confirmation, baseline completion, conflict resolution, or continuity verification.
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
            <li>Do not reconstruct behavior that was not meaningfully observed.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The observation form later asks how the student recognized the method. During the live independent opportunity, should the Specialist ask the student to explain the method so the field will be easier to complete?"
          options={[
            {
              key: "a",
              label: "Yes. Every field should be made observable before the opportunity ends.",
              feedback: "That would change the opportunity. Missing evidence is allowed to remain not observed.",
            },
            {
              key: "b",
              label: "No. Preserve the live condition and record not observed if that behavior was never exposed.",
              feedback: "Yes. The form records the response. It must not manufacture the response.",
            },
            {
              key: "c",
              label: "Only if the Specialist asks neutrally.",
              feedback: "Even a neutral question can elicit evidence the opportunity was not designed to produce.",
            },
          ]}
          correctOptionKey="b"
          truth="Observation prompts are evidence capture, not a script for forcing every behavior to appear."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">System direction is an operating decision</h2>
          <p className="text-muted-foreground">
            When the runner says continue verification, move to another evidence question, require targeted re-diagnosis, run a specific drill, or preserve a state, the system has already interpreted the evidence under its rules.
          </p>
          <p className="font-semibold">
            The Specialist follows the direction. They do not substitute a preferred phase, drill, timer, or result.
          </p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
