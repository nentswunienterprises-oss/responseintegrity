import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowToDiagnose() {
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
              How to Diagnose
            </h1>
            <p className="text-muted-foreground mt-1">under System Intelligence</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="system-intelligence-how-to-diagnose-v1"
          title="How to Diagnose"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_to_diagnose_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Diagnosis is a search for the earliest unreliable layer</h2>
          <p className="text-muted-foreground">
            Diagnosis does not mean choosing a phase from instinct. RI-OS asks the smallest clean evidence question that can locate where the response first stops being reliable.
          </p>
          <p className="font-semibold">
            The Specialist executes the evidence opportunity. The system owns placement.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Diagnosis and Training do different jobs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">RI-OS owns</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>which evidence question comes next</li>
                <li>which constraint should be present or stripped away</li>
                <li>whether more evidence is still required</li>
                <li>phase and starting stability</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">The Specialist owns</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>preparing the requested problem condition</li>
                <li>following the live protocol exactly</li>
                <li>preserving the active support rule</li>
                <li>recording only the behavior that actually occurred</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">A starting signal is routing, not placement</h2>
          <p className="text-muted-foreground">
            Parent symptoms, topic history, or an existing topic signal can tell the system where to ask first. They do not prove the final phase.
          </p>
          <p className="text-muted-foreground">
            If the signal points to Clarity, Structured Execution, Controlled Discomfort, or Time Pressure Stability, RI-OS opens the corresponding evidence question only as a starting hypothesis.
          </p>
          <p className="font-semibold">
            Direct behavioral evidence still has to support every earlier layer required for the final placement.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A parent says the student collapses in exams. What can RI legitimately conclude from that starting signal?"
          options={[
            {
              key: "a",
              label: "The topic is placed in Time Pressure Stability because the symptom names exam pressure.",
              feedback: "A symptom can tell RI-OS which evidence question to ask first, but it cannot prove that Clarity, Structured Execution, and Controlled Discomfort are already intact.",
            },
            {
              key: "b",
              label: "The report can determine which evidence question RI asks first.",
              feedback: "The report can make Diagnosis more efficient by routing the first evidence question.",
            },
            {
              key: "c",
              label: "The Specialist can convert the report into placement evidence if they personally agree with it.",
              feedback: "Specialist agreement does not determine placement. Evidence does.",
            },
            {
              key: "d",
              label: "The report is a routing hypothesis, not placement evidence.",
              feedback: "Starting signals guide the search; they do not establish final phase.",
            },
            {
              key: "e",
              label: "Time Pressure Stability can own placement only after earlier required response layers are sufficiently supported.",
              feedback: "A later-pressure placement must be supported by evidence that earlier required layers hold.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d","e"]}
          truth="Starting signals make Diagnosis efficient. They guide where RI asks first, but direct behavioral evidence still determines the earliest unreliable response layer and final placement."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When there is no trustworthy starting signal</h2>
          <p className="text-muted-foreground">
            RI-OS begins with one neutral independent starting problem: a normal, familiar-form problem with difficulty and time pressure removed.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No timer or urgency target.</li>
            <li>No modelling or method prompt.</li>
            <li>The student solves independently.</li>
            <li>The opportunity can naturally expose Clarity and immediate Structured Execution behavior.</li>
            <li>Anything the response does not expose remains not observed. The Specialist does not ask extra questions just to fill fields.</li>
          </ul>
          <p className="font-semibold">
            This is a neutral starting evidence condition, not an automatic Structured Execution placement.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Diagnosis strips constraints to find the real break</h2>
          <p className="text-muted-foreground">
            A failure under a high-pressure condition does not automatically mean the highest phase is the problem.
          </p>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">If time is present and the response breaks</p>
              <p className="mt-1 text-muted-foreground">The system may remove time and ask whether difficulty alone still causes the break.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">If difficulty still causes the break</p>
              <p className="mt-1 text-muted-foreground">The system can remove difficulty and return to normal independent execution.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">If normal execution is also unreliable</p>
              <p className="mt-1 text-muted-foreground">The earlier layer owns the placement question. Higher pressure is no longer the first problem to solve.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Stop when the evidence question is resolved</h2>
          <p className="text-muted-foreground">
            Diagnosis does not run a fixed number of reps for every student. It stops when the current evidence question is resolved.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>A decisive clean opportunity can end a question quickly.</li>
            <li>Not-observed, confounded, or conflicting evidence can require another comparable opportunity.</li>
            <li>RI-OS requests only the smallest additional evidence needed.</li>
            <li>If permitted clean evidence is exhausted and the question is still unresolved, the system blocks rather than inventing a state.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A clean normal independent opportunity already proves the earliest breakdown clearly. Should the Specialist keep running extra Diagnosis problems because three reps were prepared?"
          options={[
            {
              key: "a",
              label: "Yes. Prepared problems become a completion quota.",
              feedback: "Reserve inventory is not a rep quota. Diagnosis stops when the evidence question is resolved.",
            },
            {
              key: "b",
              label: "No. Stop when the system has enough evidence and follow the resulting placement.",
              feedback: "Yes. Diagnosis stops when the evidence question is resolved; it does not collect extra reps just for volume.",
            },
            {
              key: "c",
              label: "Run them only if the Specialist wants more confidence in the decision.",
              feedback: "Personal reassurance cannot justify adding extra evidence after RI-OS has already resolved the question.",
            },
              {
                key: "d",
                label: "No. Unused prepared problems remain reserve capacity for later unresolved evidence questions.",
                feedback: "Yes. Preparation does not turn reserve material into a mandatory quota.",
              },
              {
                key: "e",
                label: "Yes. The Specialist should always finish the three prepared reps so every Diagnosis session has the same volume.",
                feedback: "Standardized volume cannot replace evidence sufficiency. Diagnosis is complete when the active question is resolved.",
              },
          ]}
          correctOptionKeys={["b","d"]}
          truth="The system decides whether another opportunity is necessary. Prepared problems are reserve capacity, not a target."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What the final placement means</h2>
          <p className="text-muted-foreground">
            The final phase is the first response layer where direct clean evidence shows the required behavior is not holding after earlier layers have been sufficiently supported.
          </p>
          <p className="text-muted-foreground">
            Starting stability is decided from the behavior shown in that decisive evidence. Diagnosis can establish Low, Medium, or High.
          </p>
          <p className="font-semibold">
            High Maintenance is never diagnosed. It is earned later through Training evidence.
          </p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
