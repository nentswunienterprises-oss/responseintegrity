import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";

export default function ResponseConditioningHowToGuide() {
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

          <div className="flex items-start gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                How to Intervene
              </h1>
              <p className="text-muted-foreground mt-1">under Execution Standards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="how-to-intervene-piecewise-v1"
          title="How to Intervene"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_to_intervene_mastery_v1" />}
        >
          <Card className="p-6 space-y-4 border-primary/25 bg-primary/5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Core rule</p>
            <h2 className="text-2xl font-bold">The Set Decides the Support</h2>
            <p className="text-muted-foreground">
              Every RI training set has a defined support condition. That condition tells you whether you may model, guide minimally, confirm only the first step, or give no support.
            </p>
            <p className="text-muted-foreground">
              Do not increase help because the student hesitates, asks for reassurance, or produces a weak response. Preserve the assigned condition so the response stays trustworthy.
            </p>
            <p className="font-semibold">
              The Specialist does not decide how much to help. The active RI condition decides how much support is allowed.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Guidance and Correction Are Different</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-primary/15 bg-muted/20 p-4 space-y-2">
                <p className="font-semibold">Guidance</p>
                <p className="text-sm text-muted-foreground">
                  Direction supplied while the current opportunity is still live.
                </p>
                <p className="text-sm text-muted-foreground">
                  Because it changes what the student had to produce alone, it must stay inside the set's support boundary.
                </p>
              </div>
              <div className="rounded-md border border-primary/15 bg-muted/20 p-4 space-y-2">
                <p className="font-semibold">Correction</p>
                <p className="text-sm text-muted-foreground">
                  What the Specialist does after the opportunity has already revealed the response.
                </p>
                <p className="text-sm text-muted-foreground">
                  Correction can reset the structure for learning without rewriting what the student independently demonstrated in that rep.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">The Four Support Rules</h2>
            <p className="text-muted-foreground">
              RI does not use one vague rule called "minimal help." Each set has a clear rule for what support is allowed.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="font-semibold">Modeled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The Specialist demonstrates. This is teaching and preparation, not independent student evidence.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Minimal</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Small support may be used, but it cannot carry the method or manufacture the response being tested.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">First-step only</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The permitted intervention stops at the opening step. The Specialist does not carry the remaining execution.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">None</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Present the task and observe. A request for help, hesitation, or breakdown is evidence rather than permission to rescue.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Phase 1</p>
              <h2 className="text-2xl font-bold mt-1">Clarity</h2>
            </div>
            <p className="text-muted-foreground">
              Clarity is where explicit modelling and light application are permitted, but the support boundary still changes by set.
            </p>
            <div className="space-y-3">
              <div className="rounded-md border p-4">
                <p className="font-semibold">Modeling: modeled support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Build the Topic Reference and mental map through Vocabulary, Recognition / Method, Ordered Steps, and Reason. The student explains the map back. This set is preparation, not independent evidence.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Identification: no support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student names the terms, identifies the type, states the method or steps, and explains why without solving. Do not supply the answer, method, or steps during the observation.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Light Apply: minimal support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student solves while RI tests whether the mental map survives action. Keep support minimal. Do not turn Light Apply into step-by-step execution carried by the Specialist.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Phase 2</p>
              <h2 className="text-2xl font-bold mt-1">Structured Execution</h2>
            </div>
            <p className="text-muted-foreground">
              Structured Execution is where guidance must recede because the phase is testing whether the known structure can be executed independently and repeatedly.
            </p>
            <div className="space-y-3">
              <div className="rounded-md border p-4">
                <p className="font-semibold">Required Structure: minimal support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Require the student to state the step order before solving. The Specialist may protect the structure, but must not supply the next step before the student attempts it.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Independent Execution: no support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Withhold help. If the student stalls or asks for the next step, that dependence is part of the response being measured.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Variation Control: no support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Present the changed form without pointing out what changed. The student must transfer the same method without Specialist-led noticing.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Phase 3</p>
              <h2 className="text-2xl font-bold mt-1">Controlled Discomfort</h2>
            </div>
            <p className="text-muted-foreground">
              Controlled Discomfort is where guidance becomes deliberately limited. The student must face meaningful difficulty without being carried out of it.
            </p>
            <div className="space-y-3">
              <div className="rounded-md border p-4">
                <p className="font-semibold">Controlled Entry: minimal support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Introduce a challenging but solvable problem, preserve the difficult condition, and require a controlled first response. Support may be minimal, never full rescue.
                </p>
              </div>
              <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
                <p className="font-semibold">No Rescue: first-step only</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the specific home of the "guide only to the first step" rule. Use only the support the set permits, then withdraw and observe whether the student continues without being carried.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Repeat Exposure: no support</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hold the difficulty and withhold rescue. The point is to see whether the controlled response now repeats under the same demand.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Phase 4</p>
              <h2 className="text-2xl font-bold mt-1">Time Pressure Stability</h2>
            </div>
            <p className="text-muted-foreground">
              Timed training is a no-help condition. The timer is testing whether already-built structure survives urgency.
            </p>
            <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
              <li>Structure Under Timer: no support.</li>
              <li>Repeated Timed Execution: no support.</li>
              <li>Full Constraint: no support.</li>
            </ul>
            <div className="rounded-md border border-primary/25 bg-primary/5 p-4 space-y-2">
              <p className="font-semibold">Do not coach through the timer.</p>
              <p className="text-sm text-muted-foreground">
                If structure breaks, preserve the assigned timer, record what happened, and correct after the rep. Pausing or loosening the timer changes the condition itself.
              </p>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">When the Student Stalls</h2>
            <p className="text-muted-foreground">
              A stall is not automatically an instruction to help. First check the support rule for the active set.
            </p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold">1. Preserve the condition</p>
                <p className="text-sm text-muted-foreground">
                  Do not change difficulty, supply structure, relax a timer, or answer a support request unless the set explicitly permits that intervention.
                </p>
              </div>
              <div>
                <p className="font-semibold">2. Observe what the stall reveals</p>
                <p className="text-sm text-muted-foreground">
                  Hesitation, rescue-seeking, a missing first step, lost structure, or a freeze may be the exact response RI needs to see.
                </p>
              </div>
              <div>
                <p className="font-semibold">3. Record the truth</p>
                <p className="text-sm text-muted-foreground">
                  Do not strengthen the response in the log because the student later recovered after support.
                </p>
              </div>
              <div>
                <p className="font-semibold">4. Correct at the right time</p>
                <p className="text-sm text-muted-foreground">
                  Once the evidence opportunity is complete, correct the broken point and prepare the next assigned exposure without rewriting the previous one.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Intervention Changes Evidence</h2>
            <p className="text-muted-foreground">
              RI records what the Specialist supplied because support can change what an opportunity is allowed to prove.
            </p>
            <div className="space-y-3">
              <div className="rounded-md border p-4">
                <p className="font-semibold">Neutral clarification</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clarify wording without supplying mathematical content, the method, or a step.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">First-step confirmation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If the Specialist confirms or supplies the opening step, that opportunity can no longer prove the student produced that first-step control independently.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Method or step prompt</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prompting the method or a later step can invalidate the independence-sensitive part of the response that the prompt supplied.
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-semibold">Teaching or full rescue</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once the Specialist teaches, corrects, or carries the live response, the current-phase capability cannot be treated as independently demonstrated in that opportunity.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Do Not Quietly Re-Model a Later Phase</h2>
            <p className="text-muted-foreground">
              If a student in Structured Execution, Controlled Discomfort, or Time Pressure Stability appears to need the mental map taught again, do not silently turn that rep into Clarity.
            </p>
            <p className="text-muted-foreground">
              Preserve the assigned condition and let the breakdown become evidence. RI can then determine whether the inherited prerequisite is still trustworthy and whether targeted re-diagnosis is required.
            </p>
            <p className="font-semibold">
              Re-teaching is not a hidden rescue path around phase truth.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">The Clarity Mental Map Still Matters</h2>
            <p className="text-muted-foreground">
              Vocabulary, Method, and Reason remain the core Clarity mental map, especially when understanding what needs correction.
            </p>
            <p className="text-muted-foreground">
              But not every later-phase breakdown is a Clarity failure. A student can know the method and still break in independent execution, under difficulty, or under time.
            </p>
            <p className="font-semibold">
              Preserve the active condition, record the actual response layer that broke, and let RI-OS determine what should happen next.
            </p>
          </Card>

          <Card className="p-6 space-y-5 border-primary/25 bg-primary/5">
            <h2 className="text-2xl font-bold">The RI Intervention Loop</h2>
            <div className="space-y-2 font-medium">
              <p>Establish the map.</p>
              <p>Expose the student under the assigned condition.</p>
              <p>Observe the response without changing the condition.</p>
              <p>Intervene only inside the support boundary.</p>
              <p>Record what actually happened.</p>
              <p>Correct outside the evidence window when required.</p>
              <p>Expose again under the next assigned condition.</p>
            </div>
            <p className="text-muted-foreground">
              In Clarity, Model, Apply, Guide is the teaching rhythm. Across RI-OS as a whole, the governing principle is:
            </p>
            <p className="text-lg font-bold">
              Guidance is condition-owned, not Specialist-discretionary.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
