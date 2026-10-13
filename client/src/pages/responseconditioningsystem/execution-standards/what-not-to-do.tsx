import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningWhatNotToDo() {
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
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">What Not To Do</h1>
            <p className="text-muted-foreground mt-1">OS-wide Specialist execution boundaries</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="what-not-to-do-v2"
          title="What Not To Do"
          completion={<DeepDiveCapabilityCheck assessmentKey="what_not_to_do_mastery_v1" />}
        >
          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">The shared failure pattern</h2>
            <p className="text-muted-foreground">
              Most serious delivery errors happen when a Specialist changes the assigned condition to make the live moment easier, smoother, faster, or more conclusive.
            </p>
            <p className="font-semibold">Do not improve the appearance of the response by weakening the integrity of the evidence.</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">1. Do not rescue outside the active support rule</h2>
            <p className="text-muted-foreground">
              Hesitation, rescue-seeking, a missing first step, loss of structure, and timeout can be the exact response RI-OS needs to observe.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Clarity Modeling may be Specialist-led because modelling is the assigned condition.</li>
              <li>Identification, Independent Execution, Variation Control, Repeat Exposure, and all TPS Training sets preserve no support.</li>
              <li>Controlled Entry allows minimal support.</li>
              <li>No Rescue allows first-step-only support.</li>
            </ul>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">2. Do not over-explain inside an evidence opportunity</h2>
            <p className="text-muted-foreground">
              Teaching, method prompting, step prompting, and full rescue can change what an opportunity is allowed to prove.
            </p>
            <p className="font-semibold">
              Teach only where the RI rules allow it. Do not smuggle modelling into an independent observation condition.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">3. Do not take over execution</h2>
            <p className="text-muted-foreground">
              Do not write the student's steps, finish their reasoning, or carry the method after the live condition requires independent execution.
            </p>
            <p className="text-muted-foreground">
              If support occurs, record it separately. Do not log the assisted response as though the student produced it alone.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">4. Do not lose the Clarity mental map</h2>
            <p className="text-muted-foreground">
              Vocabulary, Method, and Reason are the Clarity mental map. Later phases rely on that map, but they do not automatically become Clarity whenever execution weakens.
            </p>
            <p className="font-semibold">
              Preserve the active condition and let prerequisite evidence determine whether an earlier layer must be re-checked.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">5. Do not manufacture clean evidence</h2>
            <p className="text-muted-foreground">
              Most student responses are directly observable. Not observed is a narrow evidence-record status when no qualifying exposure exists, not an incident to create in a normal rep. A rare visible worked example can instead contaminate the student's independence claim.
            </p>
            <p className="font-semibold">
              Set up the correct observation condition before the rep. Record actual student behaviour and any visible mathematical cue rather than filling fields from assumption.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="During independent Structured Execution, the student begins correctly on their own, then consults an open worked solution showing the next method steps. They finish with a correct answer. What preserves evidence integrity?"
            options={[
              {
                key: "a",
                label: "Mark the whole rep independent because the student reached the correct final answer.",
                feedback: "Final correctness after seeing the next method steps cannot prove independent execution.",
              },
              {
                key: "b",
                label: "Record the visible worked-solution cue and mark the affected independence claim confounded, without calling it weakness.",
                feedback: "Yes. The visible mathematical cue compromised independence, not the student's demonstrated ability.",
              },
              {
                key: "c",
                label: "Mark all method steps weak because consulting an example proves the student does not know the method.",
                feedback: "Reference exposure prevents clean independence evidence; it does not establish a capability breakdown.",
              },
              {
                key: "d",
                label: "Preserve the independently observed first step separately from the later reference-influenced continuation.",
                feedback: "Yes. Evidence that was clean before the cue remains attributable to that observed interval.",
              },
              {
                key: "e",
                label: "Ask the student to explain afterward and replace the confounded continuation with a clean record.",
                feedback: "A later explanation cannot erase the reference cue or rewrite the original observation.",
              },
            ]}
            correctOptionKeys={["b","d"]}
            truth="An observed mathematical cue can confound the intended independence claim. Preserve the clean opening, record the cue and leave any further evidence decision to RI-OS."
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">6. Do not interrupt thinking because silence feels uncomfortable</h2>
            <p className="text-muted-foreground">
              A pause is behavior. It is not automatic permission to prompt.
            </p>
            <p className="font-semibold">
              Check the active support rule first. In a no-support condition, continue observing rather than inserting a first-step cue.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">7. Do not chase speed</h2>
            <p className="text-muted-foreground">
              Structured Execution and Controlled Discomfort are not timed phases. TPS timing is individualized and set by RI-OS.
            </p>
            <p className="font-semibold">
              Do not add hurry language, choose a faster target, pause the Timer Contract, or treat a fast guessed response as stable TPS evidence.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">8. Do not use technical recovery as a student second chance</h2>
            <p className="text-muted-foreground">
              Objective timer, runtime, or device failure may leave a timing slot unresolved and allow a fresh pre-prepared equivalent reserve under the same condition.
            </p>
            <p className="font-semibold">
              Timeout, panic, wrong method, incomplete work, weak performance, or ordinary timer expiry are real student evidence and never unlock replacement.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">9. Do not manually move the topic</h2>
            <p className="text-muted-foreground">
              Do not advance a strong-looking topic, move a weak-looking topic backward, invent starting stability, or replace a system-selected drill with a preferred one.
            </p>
            <p className="font-semibold">
              The Specialist runs the condition and records the evidence. RI-OS decides what happens next.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">10. Do not turn Handover into Diagnosis or Training</h2>
            <p className="text-muted-foreground">
              Handover verifies whether inherited state remains trustworthy after reassignment. It does not restart placement and it does not teach forward.
            </p>
            <p className="font-semibold">
              Keep the inherited state unchanged until continuity evidence supports keeping it, adjusting stability within the same phase, or targeted re-diagnosis.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A TPS rep times out with panic and incomplete work, but the timer worked correctly. Which actions would violate the evidence boundary?"
            options={[
              {
                key: "a",
                label: "Record the timed response exactly as it occurred.",
                feedback: "That is required evidence capture.",
              },
              {
                key: "b",
                label: "Start a replacement attempt so the student gets a fair chance to show a better response.",
                feedback: "Student failure under a valid timer is real evidence, not a technical replacement condition.",
              },
              {
                key: "c",
                label: "Continue to the observation questions after the execution boundary is frozen.",
                feedback: "That is the correct post-response workflow.",
              },
              {
                key: "d",
                label: "Classify the attempt as a technical timer failure because the student response broke down.",
                feedback: "Student panic and timeout under a working timer are performance evidence, not technical failure.",
              },
              {
                key: "e",
                label: "Delete the attempt and reuse the same exposed problem so the student can show what they can really do.",
                feedback: "A valid weak response must remain in the record and does not allow a second chance on the same problem.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b","d","e"]}
            truth="When timing works, the student's panic, timeout, wrong method or incomplete work are real evidence. Do not create a replacement, relabel the attempt as technical failure, or erase the valid response."
          />

          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Final check</h2>
            <p className="font-semibold">
              Before changing anything live, ask: "Does the active RI-OS condition allow this move?"
            </p>
            <p className="text-muted-foreground">
              If not, preserve the condition, record what happened, and follow the system result.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
