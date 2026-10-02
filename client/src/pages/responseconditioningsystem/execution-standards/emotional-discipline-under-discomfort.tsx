import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningEmotionalDisciplineUnderDiscomfort() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/responseconditioningsystem")}>
            Back to Response Conditioning System
          </Button>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Emotional Discipline Under Discomfort</h1>
            <p className="text-muted-foreground mt-1">under Execution Standards</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="emotional-discipline-under-discomfort-v2"
          title="Emotional Discipline Under Discomfort"
          completion={<DeepDiveCapabilityCheck assessmentKey="emotional_discipline_under_discomfort_mastery_v1" />}
        >
          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Emotional discipline protects the condition</h2>
            <p className="text-muted-foreground">
              A Specialist will see hesitation, frustration, silence, rescue-seeking, panic, slow work, and weak responses. The job is not to make those moments disappear.
            </p>
            <p className="font-semibold">
              The job is to remain stable enough to preserve the exact support, difficulty, and timing condition RI-OS assigned.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">The active support boundary comes first</h2>
            <p className="text-muted-foreground">
              Emotional discipline does not mean "never help." It means never letting your own discomfort decide how much help to give.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Modeled: demonstrate because the set explicitly requires modelling.</li>
              <li>Minimal: use only the small support the set permits.</li>
              <li>First-step only: stop at the opening step and return execution to the student.</li>
              <li>None: do not rescue, prompt the method, confirm a step, or coach through the live response.</li>
            </ul>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="During a no-support TPS rep, the student freezes and says, 'I don't know what to do.' Which responses preserve the condition?"
            options={[
              {
                key: "a",
                label: "Ask a first-step question because neutral wording does not count as support.",
                feedback: "The question supplies response control inside a no-support condition. The Specialist's discomfort cannot authorize that intervention.",
              },
              {
                key: "b",
                label: "Do not add first-step or confirmation support; preserve the no-support timed condition.",
                feedback: "The Specialist must not rescue the response away from the condition being observed.",
              },
              {
                key: "c",
                label: "Pause the timer, settle the student, then restart the same problem.",
                feedback: "Pausing and restarting changes timing authority and can turn real student evidence into an unauthorized second chance.",
              },
              {
                key: "d",
                label: "Treat the freeze as evidence of the response under urgency and record it after the execution boundary.",
                feedback: "The valid timed condition is allowed to reveal whether the trained response survives urgency.",
              },
              {
                key: "e",
                label: "Give reassurance that confirms the student's current direction without naming the next step.",
                feedback: "Confirmation can still steer the response and therefore changes the no-support condition.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b","d"]}
            truth="Emotional discipline means preserving the assigned no-support timed condition even when the student's struggle creates an urge to rescue."
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Silence is not automatically a problem</h2>
            <p className="text-muted-foreground">
              A pause can mean many things. RI-OS needs the behavior, not a story about the behavior.
            </p>
            <p className="font-semibold">
              Do not infer panic, laziness, defiance, confidence, motivation, or emotional state from silence alone.
            </p>
            <p className="text-muted-foreground">
              Record the observable delay, what happened next, and whether the behavior was meaningfully observable under the intended condition.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Do not rescue the evidence</h2>
            <p className="text-muted-foreground">
              The most dangerous moment is often when a valid weak response is already visible and the Specialist wants to repair it before the rep ends.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Do not soften a challenging problem because the student looks uncomfortable.</li>
              <li>Do not add encouragement that becomes pacing or method guidance.</li>
              <li>Do not turn a no-support rep into a guided rep because the student asks for help.</li>
              <li>Do not restart a timed attempt because the student panicked, timed out, guessed, or worked slowly.</li>
            </ul>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Correction happens at the correct boundary</h2>
            <p className="text-muted-foreground">
              Preserving a live evidence condition does not mean abandoning learning. It means separating evidence from correction.
            </p>
            <p className="font-semibold">
              Let the opportunity reveal the response first. Freeze the execution boundary. Record the evidence. Then correct or prepare the next assigned exposure where the protocol permits it.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A Controlled Entry problem is valid and challenging. The student becomes frustrated and asks for the full method. What should determine the Specialist's response?"
            options={[
              {
                key: "a",
                label: "How upset the student looks.",
                feedback: "Visible frustration does not rewrite the set contract.",
              },
              {
                key: "b",
                label: "The Controlled Entry support boundary: minimal support only, without carrying the method or execution.",
                feedback: "Yes. The set, not the emotional intensity of the moment, determines what support is allowed.",
              },
              {
                key: "c",
                label: "Whether the Specialist thinks a successful finish would build confidence.",
                feedback: "A preferred emotional outcome cannot replace condition integrity.",
              },
              {
                key: "d",
                label: "The support boundary remains minimal even if the student's visible frustration increases.",
                feedback: "Yes. Emotional intensity does not expand the registered support condition.",
              },
              {
                key: "e",
                label: "Whether the full method would help the student end the rep feeling successful.",
                feedback: "A preferred emotional outcome cannot replace the active support boundary.",
              },
            ]}
            correctOptionKey="b"
            truth="The Specialist regulates themselves so the registered condition remains intact."
          />

          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Operating check</h2>
            <p className="font-semibold">
              Before intervening, ask: "Is this support authorized by the active set, or am I reacting to the student's discomfort?"
            </p>
            <p className="text-muted-foreground">
              If the set does not authorize the move, do not make it. Preserve the response and let RI-OS interpret the evidence.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
