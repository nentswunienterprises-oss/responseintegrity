import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowBaselinesAreEstablished() {
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
              How Baselines Are Established
            </h1>
            <p className="text-muted-foreground mt-1">under System Intelligence</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="system-intelligence-how-baselines-are-established-v1"
          title="How Baselines Are Established"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_baselines_are_established_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Baseline does not mean one thing</h2>
          <p className="text-muted-foreground">
            RI-OS uses a neutral independent starting condition when topic entry is uncertain, and it also uses clean independent execution timing to build the individualized baseline needed for Time Pressure Stability.
          </p>
          <p className="font-semibold">
            Both are baselines because they remove unnecessary pressure. They answer different questions.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Topic-entry baseline: start neutral when the signal is uncertain</h2>
          <p className="text-muted-foreground">
            If there is no trustworthy starting signal, Diagnosis begins with a normal familiar-form independent problem with difficulty and time removed.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The problem is normal difficulty and same form.</li>
            <li>There is no timer.</li>
            <li>The Specialist does not model or prompt the method.</li>
            <li>The response can naturally expose Clarity and immediate Structured Execution behavior.</li>
            <li>The system uses what appears to decide the next evidence question.</li>
          </ul>
          <p className="font-semibold">
            This neutral condition is a starting point for reasoning, not a phase assignment by itself.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">TPS timing baseline: measure real independent execution without creating pressure</h2>
          <p className="text-muted-foreground">
            The system needs a student-and-topic-specific no-pressure execution reference before it can apply meaningful urgency.
          </p>
          <p className="font-semibold">
            Specialists do not choose the baseline time. RI-OS measures it.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Usual source: Structured Execution Training</h2>
          <p className="text-muted-foreground">
            The usual source is the Independent Execution set inside Structured Execution.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Exactly three clean Independent Execution opportunities form one complete set.</li>
            <li>The tasks are normal difficulty and same form.</li>
            <li>There is no time pressure or visible countdown.</li>
            <li>No help may supply the method, first move, or execution structure.</li>
            <li>Each rep must show clean independent execution, and RI-OS must record the timing correctly.</li>
            <li>RI-OS uses the most recent complete clean set from the current stretch of Structured Execution Training.</li>
          </ul>
          <p className="text-muted-foreground">
            RI-OS does not cherry-pick the three fastest or strongest reps across different sets.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What passive timing actually records</h2>
          <p className="text-muted-foreground">
            The student is not placed under a time target. The system silently measures the real execution interval.
          </p>
          <p className="font-semibold">
            Begin Rep or Begin Opportunity, student executes, Student Finished, then observation and admin continue afterward.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>RI-OS records the start time automatically.</li>
            <li>Student Finished freezes the end of mathematical execution.</li>
            <li>Post-rep observation time is not added to the student's elapsed time.</li>
            <li>The running duration must not become a pacing cue.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A Specialist waits until all observation fields are completed before pressing Student Finished on a passive baseline opportunity. Which statements are supported?"
          options={[
            {
              key: "a",
              label: "The timer can end when the observation form is complete because both belong to the same rep.",
              feedback: "That adds Specialist admin time to the student's execution interval and damages comparability.",
            },
            {
              key: "b",
              label: "Student Finished should freeze at the student's actual mathematical completion.",
              feedback: "The baseline measures student execution, not Specialist form completion.",
            },
            {
              key: "c",
              label: "Administration delay is acceptable if it is roughly the same on every rep.",
              feedback: "Artificial admin delay is not student execution and cannot become part of the baseline.",
            },
            {
              key: "d",
              label: "Observation administration belongs after the execution interval has been frozen.",
              feedback: "Student execution time and Specialist administration must remain separate.",
            },
            {
              key: "e",
              label: "Administration delay is acceptable if the Specialist completes the same number of fields on every rep.",
              feedback: "Consistent admin delay is still not student execution and cannot become part of the baseline.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d"]}
          truth="The baseline measures the student's execution interval. Freeze Student Finished at actual completion, then complete the post-response observation work."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Diagnosis can establish the same baseline</h2>
          <p className="text-muted-foreground">
            A topic can legitimately be placed above Structured Execution without first completing Structured Execution Training. RI-OS therefore allows eligible Diagnosis opportunities to establish the timing reference.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The eligible opportunities are normal, same-form, no-pressure independent execution.</li>
            <li>The first clean comparable opportunity can become timing sample 1.</li>
            <li>The system gathers only the remaining samples required to reach three clean comparable intervals.</li>
            <li>If an earlier response layer breaks first, Diagnosis stops there instead of collecting timing for future use.</li>
            <li>If a valid current Timer Contract already exists, the system reuses it.</li>
          </ul>
          <p className="font-semibold">
            This is evidence-complete Diagnosis, not a hidden three-rep calibration block.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How the final baseline becomes a Timer Contract</h2>
          <p className="text-muted-foreground">
            RI-OS takes the median of the three valid elapsed times and saves it as the Timer Contract for that student and topic.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Structure Under Timer</p>
              <p className="mt-1 text-sm text-muted-foreground">100% of the baseline duration.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Repeated Timed Execution</p>
              <p className="mt-1 text-sm text-muted-foreground">100% of the same baseline duration.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Full Constraint</p>
              <p className="mt-1 text-sm text-muted-foreground">85% of the baseline duration, rounded by the system.</p>
            </div>
          </div>
          <p className="font-semibold">
            The Specialist cannot enter, estimate, round, loosen, tighten, pause, restart, or replace these times.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When the required baseline is missing</h2>
          <p className="text-muted-foreground">
            If a topic above Structured Execution does not have a valid baseline, ordinary TPS work does not invent a timer.
          </p>
          <p className="font-semibold">
            RI-OS requires targeted re-diagnosis to establish the missing baseline under clean independent conditions.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A topic is ready to test Time Pressure Stability, but no valid Timer Contract exists. The Specialist knows this student usually takes about 50 seconds. What should happen?"
          options={[
            {
              key: "a",
              label: "Use 50 seconds so the session can continue.",
              feedback: "A remembered estimate is not a valid baseline.",
            },
            {
              key: "b",
              label: "Use a generic one-minute timer until enough evidence is collected.",
              feedback: "Generic timing would create a pressure condition that is not individualized or supported by evidence.",
            },
            {
              key: "c",
              label: "Establish the missing baseline through clean independent timing before TPS timing is used.",
              feedback: "Yes. RI-OS establishes the missing baseline from evidence; the Specialist does not invent it.",
            },
              {
                key: "d",
                label: "Do not run TPS timing until the missing student-topic baseline has been established.",
                feedback: "Yes. TPS cannot use invented or borrowed urgency.",
              },
              {
                key: "e",
                label: "Use 50 seconds only for one provisional rep, then replace it once a formal baseline exists.",
                feedback: "A provisional invented timer is still an unauthorized pressure condition.",
              },
          ]}
          correctOptionKey="c"
          truth="No valid baseline means no invented timer. RI-OS must establish the baseline first."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Technical failure is not student failure</h2>
          <p className="text-muted-foreground">
            If the timer, runtime, or device itself fails, RI-OS keeps a record of the technical failure and that evidence slot remains unresolved.
          </p>
          <p className="text-muted-foreground">
            A fresh pre-prepared equivalent reserve may fill that unresolved slot under the same condition, while the failed attempt remains in the record.
          </p>
          <p className="font-semibold">
            Timeout, panic, wrong method, slow work, incomplete work, or weak performance are student evidence. They never authorize a replacement attempt.
          </p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
