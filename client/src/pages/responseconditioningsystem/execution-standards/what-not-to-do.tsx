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
            <h2 className="text-2xl font-bold">1. Do not rescue outside the support contract</h2>
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
              Keep teaching inside the places the protocol authorizes. Do not smuggle modelling into an independent observation condition.
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
            <h2 className="text-2xl font-bold">5. Do not force every field to become observable</h2>
            <p className="text-muted-foreground">
              If a behavior never meaningfully appeared, record not observed. If support or another condition makes interpretation unsafe, record confounded.
            </p>
            <p className="font-semibold">
              Never ask extra live questions only so the observation form will look complete.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="The observation form later asks how the student recognized the method, but the live no-support rep never exposed that reasoning. What should the Specialist do?"
            options={[
              {
                key: "a",
                label: "Ask the student immediately before ending the rep so every field can be filled.",
                feedback: "That changes the live condition and manufactures evidence the original opportunity did not expose.",
              },
              {
                key: "b",
                label: "Record not observed and let RI-OS decide whether another evidence opportunity is needed.",
                feedback: "Yes. Missing evidence must stay missing.",
              },
              {
                key: "c",
                label: "Infer the method recognition from the final answer.",
                feedback: "A final answer cannot automatically prove the unobserved recognition process.",
              },
              {
                key: "d",
                label: "Keep the recognition dimension unresolved while preserving the rest of the rep exactly as observed.",
                feedback: "Yes. One missing dimension does not erase the evidence that was actually observed.",
              },
              {
                key: "e",
                label: "Ask a leading follow-up that names the likely method, then use the answer to complete the original observation.",
                feedback: "That manufactures recognition evidence and rewrites the original condition.",
              },
            ]}
            correctOptionKey="b"
            truth="Completeness is system-owned. The Specialist owns truthful observation."
          />

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">6. Do not interrupt thinking because silence feels uncomfortable</h2>
            <p className="text-muted-foreground">
              A pause is behavior. It is not automatic permission to prompt.
            </p>
            <p className="font-semibold">
              Check the active support contract first. In a no-support condition, continue observing rather than inserting a first-step cue.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">7. Do not chase speed</h2>
            <p className="text-muted-foreground">
              Structured Execution and Controlled Discomfort are not timed phases. TPS timing is individualized and system-owned.
            </p>
            <p className="font-semibold">
              Do not add hurry language, choose a faster target, pause the Timer Contract, or treat a fast guessed response as stable TPS evidence.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">8. Do not use technical recovery as a student second chance</h2>
            <p className="text-muted-foreground">
              Objective timer, runtime, or device failure may leave a timing slot unresolved and authorize a fresh pre-prepared equivalent reserve under the same condition.
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
              The Specialist executes the condition and records the evidence. RI-OS owns the resulting operating decision.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">10. Do not turn Handover into Diagnosis or Training</h2>
            <p className="text-muted-foreground">
              Handover verifies whether inherited state remains trustworthy after reassignment. It does not restart placement and it does not teach forward.
            </p>
            <p className="font-semibold">
              Hold inherited state until continuity evidence supports a hold, bounded same-phase adjustment, or targeted re-diagnosis route.
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
                feedback: "A valid weak response must remain in the record and does not authorize a second chance on the same problem.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b","d","e"]}
            truth="When timing works, the student's panic, timeout, wrong method or incomplete work are real evidence. Do not create a replacement, relabel the attempt as technical failure, or erase the valid response."
          />

          <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Final operating filter</h2>
            <p className="font-semibold">
              Before changing anything live, ask: "Does the active RI-OS condition authorize this move?"
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
