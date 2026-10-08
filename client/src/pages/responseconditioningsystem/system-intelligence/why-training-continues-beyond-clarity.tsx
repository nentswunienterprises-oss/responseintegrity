import { useNavigate } from "react-router-dom";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const phaseRows = [
  {
    phase: "Clarity",
    question: "Can the student see what to do?",
    change: "Understanding and recognition",
    addedLoad: "None. RI first establishes the mental map.",
  },
  {
    phase: "Structured Execution",
    question: "Can the student do it themselves?",
    change: "Independent, ordered execution",
    addedLoad: "Instructional support is removed.",
  },
  {
    phase: "Controlled Discomfort",
    question: "Can the student still do it when it becomes difficult?",
    change: "Response to difficulty and uncertainty",
    addedLoad: "Difficulty is increased while rescue is progressively reduced.",
  },
  {
    phase: "Time Pressure Stability",
    question: "Can the student still do it when urgency is real?",
    change: "Response under time pressure",
    addedLoad: "An individualized time constraint is introduced.",
  },
];

export default function ResponseConditioningWhyTrainingContinuesBeyondClarity() {
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
              Curriculum v2 Founder Review
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
              Why Training Continues Beyond Clarity
            </h1>
            <p className="text-muted-foreground mt-1">under System Intelligence</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="system-intelligence-why-training-continues-beyond-clarity-v2-founder-review"
          title="Why Training Continues Beyond Clarity"
          completion={null}
        >
          <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">Knowing the maths is not the end of the problem</h2>
            <p className="text-muted-foreground">
              A student can understand a topic, explain the method correctly, and still fail to use that
              knowledge reliably when they have to work alone, when the problem becomes difficult, or when
              time pressure enters.
            </p>
            <p className="font-semibold">
              RI continues after Clarity because understanding is only the first response layer.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Diagnosis and Training are solving different problems</h2>
            <p className="text-muted-foreground">
              Diagnosis is trying to locate the earliest point where the student's response stops holding.
              It uses the minimum clean evidence needed to resolve that question.
            </p>
            <p className="text-muted-foreground">
              Training begins after that location is known. Its job is not to keep proving where the problem
              is. Its job is to create repeated exposure at that layer so the response can change.
            </p>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-lg font-bold">
                Diagnosis finds the correct load. Training changes the response under that load.
              </p>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Why Diagnosis can stop while Training keeps going</h2>
            <p className="text-muted-foreground">
              A clean diagnostic opportunity may be enough to show that normal independent execution holds
              but difficult same-form work causes the student to freeze and seek rescue.
            </p>
            <p className="text-muted-foreground">
              Once that evidence question is resolved, Diagnosis should stop. Running extra diagnostic reps
              would not make the placement more legitimate.
            </p>
            <p className="text-muted-foreground">
              Training is different. Repeated difficult opportunities are part of the intervention because RI
              is trying to change what the student does when difficulty returns.
            </p>
            <p className="font-semibold">
              Diagnosis is evidence-complete. Training is exposure-complete and evidence-authorized.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Each phase preserves the earlier capability and adds a new load</h2>
            <div className="space-y-3">
              {phaseRows.map((row) => (
                <div key={row.phase} className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">{row.phase}</p>
                  <p>{row.question}</p>
                  <p className="text-sm text-muted-foreground">
                    What RI is changing: {row.change}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    New load: {row.addedLoad}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-lg font-semibold">
              Understand -&gt; Execute -&gt; Withstand Difficulty -&gt; Withstand Urgency
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A student can explain the method correctly but cannot begin a normal problem without the Specialist supplying the first step. What is RI still trying to change?"
            options={[
              {
                key: "a",
                label: "The student's mathematical vocabulary, because any hesitation means Clarity is still the problem.",
                feedback: "Hesitation alone does not make this a Clarity problem. The example already says the student can explain the method correctly.",
              },
              {
                key: "b",
                label: "The student's independent execution of knowledge they already understand.",
                feedback: "Yes. The gap is between understanding and producing the method independently.",
              },
              {
                key: "c",
                label: "The student's ability to work under time pressure.",
                feedback: "No timer or urgency condition is present here.",
              },
              {
                key: "d",
                label: "The student's ability to begin and carry out the method without the Specialist becoming part of the execution.",
                feedback: "Yes. Structured Execution develops reliable independent production of what the student already knows.",
              },
              {
                key: "e",
                label: "Nothing. Once the student can explain the method, RI has completed its job.",
                feedback: "Explanation does not prove independent execution. RI is designed to close that gap.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b", "d"]}
            truth="Clarity can be intact while execution is still dependent. Structured Execution trains the student to produce what they know without the Specialist carrying the response."
          />

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Controlled Discomfort is not harder maths for its own sake</h2>
            <p className="text-muted-foreground">
              Imagine a student who independently solves ordinary quadratic equations correctly. On a harder
              same-form problem, the method is still relevant, but the student freezes, asks what to do, and
              waits for rescue.
            </p>
            <p className="text-muted-foreground">
              The academic method did not disappear. What changed was the condition around using it.
            </p>
            <p className="font-semibold">
              The student's access to what they know is still conditional on the problem feeling manageable.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">What Controlled Discomfort is actually training</h2>
            <p className="text-muted-foreground">
              RI deliberately brings the student back into the difficult condition and progressively changes
              how much of that moment the student must own.
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Controlled Entry</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Difficulty is present, but the student is given a bounded entry condition so they can begin
                  engaging without the whole problem being taken over.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">No Rescue</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The Specialist protects the defined support boundary and does not remove the difficult
                  moment merely because the student becomes uncomfortable or stuck.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Repeat Exposure</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student repeatedly meets comparable difficulty and must produce controlled entry,
                  tolerance, recovery, and low-rescue continuation again.
                </p>
              </div>
            </div>
            <p className="font-semibold">
              The difficult condition is not only measuring the problem. Repeated exposure to it is part of
              changing the response.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A student in Controlled Discomfort already knows the correct method. They become stuck on a difficult same-form problem and immediately ask the Specialist for the next step. Why can repeating this condition still be legitimate Training?"
            options={[
              {
                key: "a",
                label: "Because RI is trying to discover whether the student knows the method.",
                feedback: "That question belongs to an earlier layer and has already been resolved in this example.",
              },
              {
                key: "b",
                label: "Because repeated difficult exposure can train controlled entry, tolerance, recovery, and lower rescue dependence.",
                feedback: "Yes. Those are the capabilities that are breaking when difficulty appears.",
              },
              {
                key: "c",
                label: "Because every difficult problem should eventually become easy through repetition.",
                feedback: "The target is not familiarity with one problem. RI is conditioning the response to difficulty across comparable opportunities.",
              },
              {
                key: "d",
                label: "Because the Specialist is changing the student's response to difficulty, not reteaching an intact mathematical method.",
                feedback: "Yes. The training target is the response layer that Diagnosis identified as unreliable.",
              },
              {
                key: "e",
                label: "Because withholding all help is always better than providing support.",
                feedback: "Support follows the active set. RI does not use a blanket no-help rule.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b", "d"]}
            truth="Controlled Discomfort is legitimate because the intervention targets the response that fails under difficulty. The support boundary changes by set, but the difficult condition is preserved long enough for the student to develop a more reliable response."
          />

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Time Pressure Stability makes the distinction even clearer</h2>
            <p className="text-muted-foreground">
              A student may now understand the topic, execute independently, and remain functional through
              difficult work, but lose all of that structure once urgency appears.
            </p>
            <p className="text-muted-foreground">
              They may rush the opening, skip steps, monitor the clock instead of the method, abandon a
              correct approach, or fail to complete work they can otherwise finish.
            </p>
            <p className="font-semibold">
              More explanation of the mathematics does not necessarily solve a response that only breaks under
              urgency.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">The timer is part of the training load</h2>
            <p className="text-muted-foreground">
              TPS deliberately introduces an individualized pressure condition and asks the student to keep the
              earlier capability intact inside it.
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Structure Under Timer</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The first target is not raw speed. It is preserving the trained start and method structure
                  while the timer is real.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Repeated Timed Execution</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student repeatedly produces the response under comparable urgency so pace regulation and
                  completion behavior can become more stable.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Full Constraint</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The student must preserve structure, pace, and completion integrity under the full
                  individualized pressure condition.
                </p>
              </div>
            </div>
            <p className="font-semibold">
              The timer is not merely observing whether the student is fast. It is the added load under which
              the trained response must learn to survive.
            </p>
          </Card>

          <DeepDiveTeachingInteraction
            prompt="A student is accurate and structured when untimed but starts guessing and skipping steps as soon as the Timer Contract is applied. What does that tell RI?"
            options={[
              {
                key: "a",
                label: "The student must return to Clarity because any timed error proves they no longer understand the topic.",
                feedback: "A timed breakdown does not automatically erase evidence from earlier layers.",
              },
              {
                key: "b",
                label: "Urgency may be the added load under which the otherwise trained response stops holding.",
                feedback: "Yes. RI isolates whether the response changes specifically when time pressure is added.",
              },
              {
                key: "c",
                label: "The student needs a faster mathematical shortcut regardless of whether their current method is valid.",
                feedback: "TPS protects structure. It does not replace a valid method merely to chase speed.",
              },
              {
                key: "d",
                label: "TPS can train the student to preserve start, structure, pace control, and completion integrity under that pressure.",
                feedback: "Yes. Those are the phase-defining capabilities under the Timer Contract.",
              },
              {
                key: "e",
                label: "The timer should be removed permanently because it is causing the failure.",
                feedback: "If the timer is the load that exposes the weakness, removing it permanently would remove the condition that needs to become stable.",
              },
            ]}
            kind="multi_select"
            correctOptionKeys={["b", "d"]}
            truth="When untimed capability holds and urgency changes the response, TPS owns a specific training problem: keeping the earlier capability usable under time pressure."
          />

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Why RI does not simply reteach when a later phase breaks</h2>
            <p className="text-muted-foreground">
              Reteaching an intact earlier capability can make the student look better in the moment while
              leaving the actual response failure untouched.
            </p>
            <p className="text-muted-foreground">
              If difficulty is the condition that causes the breakdown, removing difficulty and explaining the
              method again may produce a successful answer without changing the student's dependence on rescue.
            </p>
            <p className="text-muted-foreground">
              If urgency is the condition that causes the breakdown, removing the timer may restore clean work
              while leaving the timed response unchanged.
            </p>
            <p className="font-semibold">
              RI trains the earliest unsupported layer rather than repeatedly solving the wrong problem well.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Removing the load helps RI locate ownership</h2>
            <p className="text-muted-foreground">
              The later phases only make sense if earlier capabilities remain trustworthy. That is why RI
              removes the active load when a breakdown may actually belong to an earlier prerequisite.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Difficulty removed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If normal independent execution returns, the difficult condition is likely where the current
                  response stops holding.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold">Timer removed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If structured independent execution returns, urgency is likely the added condition that
                  exposed the current break.
                </p>
              </div>
            </div>
            <p className="font-semibold">
              The condition tells RI where the problem appeared. Clean evidence determines which layer owns it.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">Why repetition is necessary after the correct layer is known</h2>
            <p className="text-muted-foreground">
              One clean difficult rep or one clean timed rep can show that the student is capable of producing
              the response once. It does not yet show that the response has become dependable.
            </p>
            <p className="text-muted-foreground">
              RI separates High, High Maintenance, and progression across later qualifying sessions because
              durable change has to return under the relevant condition.
            </p>
            <p className="font-semibold">
              Training is not trying to collect a preferred score. It is trying to establish repeatable
              capability under the load that previously destabilized the student.
            </p>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="text-2xl font-bold">What RI is really protecting</h2>
            <p className="text-muted-foreground">
              The purpose of the upper phases is not to make practice unnecessarily strict. It is to close the
              gap between knowing something and being able to keep using it when the conditions become less
              comfortable.
            </p>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <p><span className="font-semibold">Clarity:</span> I can see what to do.</p>
              <p><span className="font-semibold">Structured Execution:</span> I can do it myself.</p>
              <p><span className="font-semibold">Controlled Discomfort:</span> I can still do it when it becomes difficult.</p>
              <p><span className="font-semibold">Time Pressure Stability:</span> I can still do it when urgency is real.</p>
            </div>
          </Card>

          <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
            <h2 className="text-2xl font-bold">What a Specialist should be able to defend</h2>
            <p className="text-muted-foreground">
              A trained Specialist should never need to justify a later phase by saying, "because the system
              says so."
            </p>
            <p className="text-muted-foreground">
              They should understand which response layer is being conditioned, which load exposes the gap,
              why the active set preserves or removes particular support, and why repeated exposure is
              necessary before the response can be called stable.
            </p>
            <p className="text-xl font-bold">
              RI is not extending tutoring beyond understanding. It is training knowledge to remain usable
              when independence, difficulty, and urgency are added.
            </p>
          </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
