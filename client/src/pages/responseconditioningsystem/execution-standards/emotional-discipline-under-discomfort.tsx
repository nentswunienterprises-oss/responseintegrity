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
          lessonKey="emotional-discipline-under-discomfort-v3"
          title="Emotional Discipline Under Discomfort"
          completion={<DeepDiveCapabilityCheck assessmentKey="emotional_discipline_under_discomfort_mastery_v1" />}
        >
          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Emotional discipline protects development</h2>
            <p className="text-muted-foreground">
              A Specialist will see hesitation, frustration, silence, rescue-seeking, panic, slow work, and weak responses. These moments can be uncomfortable to watch, but they are often where the student's real response becomes visible.
            </p>
            <p className="font-semibold">
              The Specialist stays steady so care does not become takeover. Preserving the assigned support, difficulty, and timing protects the part of the response the student still needs to learn to produce for themselves.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">The support rule protects what the student must own</h2>
            <p className="text-muted-foreground">
              Emotional discipline does not mean "never help." Each support level exists for a developmental reason. The Specialist gives enough support for the active job, but does not do the student's part for them.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Modeled: demonstrate because the student first needs to see the response clearly.</li>
              <li>Minimal: give only the small support needed to orient the student while they still carry the method and execution.</li>
              <li>First-step only: open the path, then return the thinking and execution to the student.</li>
              <li>None: let the student retrieve and execute independently so the system can see what now survives without help.</li>
            </ul>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="During a no-support TPS rep, the student freezes and says, 'I don't know what to do.' Which responses protect the student's independent response?"
            options={[
              {
                key: "a",
                label: "Ask a first-step question because neutral wording does not count as support.",
                feedback: "The question supplies part of the response. In a no-support rep, that would replace some of the independent retrieval the student is meant to produce.",
              },
              {
                key: "b",
                label: "Do not add first-step or confirmation support; preserve the no-support timed condition.",
                feedback: "Yes. The student needs the full opportunity to retrieve the response under urgency without the Specialist carrying part of it.",
              },
              {
                key: "c",
                label: "Pause the timer, settle the student, then restart the same problem.",
                feedback: "Pausing and restarting changes the timed condition and removes the chance to see what the student can currently produce under uninterrupted urgency.",
              },
              {
                key: "d",
                label: "Treat the freeze as evidence of the response under urgency and record it after the execution boundary.",
                feedback: "Yes. A freeze can show exactly where the trained response is not yet stable, which tells the system what development is still needed.",
              },
              {
                key: "e",
                label: "Give reassurance that confirms the student's current direction without naming the next step.",
                feedback: "Confirmation can still steer the next move. That would make the response partly Specialist-supported rather than fully the student's.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b","d"]}
            truth="Emotional discipline keeps the Specialist from taking over the part of the response the student must learn to produce independently."
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Care is not the same as rescue</h2>
            <p className="text-muted-foreground">
              A calm Specialist can acknowledge difficulty, remain respectful, and stay emotionally present without adding support the active condition does not permit.
            </p>
            <p className="font-semibold">
              The purpose is not to make a student suffer through a rule. It is to avoid replacing the student's own thinking and execution at the exact moment RI is trying to develop or observe it.
            </p>
            <p className="text-muted-foreground">
              If there is a genuine safety problem, technical interruption, or invalid condition, respond to that problem through the correct protocol. Emotional discipline only prevents ordinary discomfort or the Specialist's own unease from silently becoming extra academic support.
            </p>
          </Card>

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
            <h2 className="text-2xl font-bold">Do not rescue away the learning signal</h2>
            <p className="text-muted-foreground">
              A valid weak response is useful. It shows what the student can and cannot yet produce under the current condition, which is what allows the next exposure or correction to be targeted properly.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Do not soften a valid challenging problem simply because the student looks uncomfortable.</li>
              <li>Do not add encouragement that becomes pacing, correctness confirmation, or method guidance.</li>
              <li>Do not turn a no-support rep into a guided rep because the student asks for help.</li>
              <li>Do not restart a valid timed attempt merely to replace a panic, timeout, guess, or slow response with a better-looking result.</li>
            </ul>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Correction is delayed, not denied</h2>
            <p className="text-muted-foreground">
              Preserving a live evidence condition does not mean withholding learning. It means letting the student finish the response that is being observed before teaching changes it.
            </p>
            <p className="font-semibold">
              Let the opportunity reveal the current response. Freeze and record the evidence. Then correct or prepare the next assigned exposure where the protocol permits it.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A Controlled Entry problem is valid and challenging. The student becomes frustrated and asks for the full method. What should determine the Specialist's response?"
            options={[
              {
                key: "a",
                label: "How upset the student looks.",
                feedback: "Visible frustration matters as part of the student's experience, but it does not tell us that the student now needs the Specialist to carry more of the method.",
              },
              {
                key: "b",
                label: "The Controlled Entry support rule: minimal support only, without carrying the method or execution.",
                feedback: "Yes. Minimal support gives the student enough orientation to re-enter while preserving the thinking and execution they still need to build themselves.",
              },
              {
                key: "c",
                label: "Whether the Specialist thinks a successful finish would build confidence.",
                feedback: "A more positive ending can feel helpful, but adding support would make the Specialist responsible for part of the response the student is meant to produce.",
              },
              {
                key: "d",
                label: "The allowed support remains minimal even if the student's visible frustration increases.",
                feedback: "Yes. The support level stays calibrated to the developmental job of Controlled Entry rather than expanding with the intensity of the moment.",
              },
              {
                key: "e",
                label: "Whether the full method would help the student end the rep feeling successful.",
                feedback: "A full explanation may create immediate relief, but it would also remove the student's opportunity to carry the method with only minimal support.",
              },
            ]}
            correctOptionKeys={["b","d"]}
            truth="The support boundary protects the portion of the response the student is expected to own."
          />

          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Before you intervene</h2>
            <p className="font-semibold">
              Ask: "What is the student supposed to still do for themselves here, and would my intervention take over that work?"
            </p>
            <p className="text-muted-foreground">
              Use exactly the support the active condition permits because that boundary protects student ownership. If the issue is genuinely about safety, validity, or an interruption rather than ordinary discomfort, handle that issue through the correct protocol.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
