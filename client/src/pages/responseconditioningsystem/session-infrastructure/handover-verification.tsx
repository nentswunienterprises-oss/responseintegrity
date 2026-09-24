import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const handoverRules = [
  "Start from the inherited topic, phase, stability, evidence history, next action, and active constraints.",
  "Verify continuity only. Do not teach forward, progress the student, or restart Intro inside Handover.",
  "Record the concrete behavior that actually occurred. Do not choose a preferred state.",
  "If a behavior was not meaningfully observable, record it as not observed. If support or another condition changed the observation, record it as confounded.",
  "Stop when the Response Evidence Model has enough evidence to hold the state, adjust stability, or require targeted re-diagnosis.",
];

const evidenceClasses = [
  {
    title: "Breakdown",
    detail: "A phase-defining capability broke under a clean continuity condition. Confirmed breakdown sends the topic to targeted re-diagnosis; Handover does not manually move the phase backward.",
  },
  {
    title: "Conditional",
    detail: "The capability exists but is materially unstable. Handover stays open while clean comparable evidence can still resolve the uncertainty.",
  },
  {
    title: "Near-stable",
    detail: "The capability is substantially present with minor instability. Near-stable evidence is not collapsed into a generic weakness.",
  },
  {
    title: "Supported",
    detail: "The phase-defining behavior held cleanly under the inherited condition.",
  },
  {
    title: "Not observed / Confounded",
    detail: "The opportunity did not produce clean decision-eligible evidence. It counts as neither weakness nor strength.",
  },
];

const outcomes = [
  {
    title: "Hold inherited state",
    detail: "Enough clean evidence supports the inherited phase and stability. Training may resume from that state once the continuity gate is cleared.",
  },
  {
    title: "Adjust stability",
    detail: "The phase remains usable, but conditional evidence persisted through the bounded verification window. Stability may tighten within the same phase; conditional evidence alone cannot mint Low.",
  },
  {
    title: "Targeted re-diagnosis",
    detail: "A phase-defining breakdown is confirmed, or the bounded window ends without enough clean decision-eligible evidence. The inherited state is frozen until evidence-complete diagnosis re-establishes truth.",
  },
];

export default function ResponseConditioningHandoverVerification() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/responseconditioningsystem")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <RefreshCcw className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Handover Verification</h1>
              <p className="text-muted-foreground mt-1">under Session Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">What Handover Is</h2>
          <p className="text-muted-foreground">
            Handover happens when an already active student moves to a replacement Specialist. The student already has an evidence-backed topic state. The question is whether that inherited truth is still trustworthy enough to continue from.
          </p>
          <p className="text-lg font-semibold">Handover verifies inherited truth. Training changes capability. Diagnosis establishes or re-establishes truth.</p>
          <p className="text-sm text-muted-foreground">Handover is therefore not a fresh Intro, not a Training drill, and not a fixed rep sequence.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Evidence-Driven Structure</h2>
          <ol className="space-y-2 pl-5 list-decimal text-muted-foreground">
            <li>Review the inherited topic, phase, stability, recent evidence, next action, and constraints.</li>
            <li>Prepare a small reserve bank of phase-appropriate continuity problems. The reserve is not a completion target.</li>
            <li>Present one clean continuity opportunity under the inherited phase conditions.</li>
            <li>Record the concrete behavior for each phase-defining dimension.</li>
            <li>Let the system decide whether evidence is sufficient or another clean comparable opportunity is required.</li>
            <li>Stop as soon as the system resolves to hold, bounded stability adjustment, or targeted re-diagnosis.</li>
          </ol>
          <p className="font-semibold">There is no “complete three reps” rule. Handover is evidence-complete, not rep-complete.</p>
          <p className="text-sm text-muted-foreground">
            The verification window is bounded so Handover cannot quietly become Training. If clean truth still cannot be established inside the window, the topic exits to targeted evidence-complete diagnosis.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What The Specialist Records</h2>
          <p className="text-muted-foreground">
            Handover uses the same canonical Response Evidence behavior language as Diagnosis. The Specialist selects the concrete behavior that happened; the system owns the evidence class and the decision.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {evidenceClasses.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold">Missing or contaminated evidence must stay missing or contaminated. It must never be converted into weakness or strength.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Recovery And Contradiction</h2>
          <p className="text-muted-foreground">One difficult opportunity does not automatically rewrite inherited truth, and one later clean opportunity does not automatically erase a real breakdown.</p>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>An isolated breakdown can remain unresolved while the system asks for comparable clean evidence.</li>
            <li>After a breakdown, recovery requires the normal evidence minimum plus an additional clean supported confirmation.</li>
            <li>If a phase-defining breakdown becomes confirmed, Handover stops and routes to targeted re-diagnosis.</li>
            <li>The Specialist must not keep giving extra opportunities to make the inherited state “win.”</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Possible Outcomes</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {outcomes.map((outcome) => (
              <div key={outcome.title} className="rounded-xl border bg-card p-4">
                <h3 className="text-lg font-semibold">{outcome.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{outcome.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What The Specialist Must Preserve</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {handoverRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
          <p className="text-sm text-muted-foreground">
            See <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/drill-library">Drill Library</Link> for the phase lanes and{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/logging-system">Logging System</Link> for evidence capture.
          </p>
        </Card>

        <Card className="p-6 border-2 border-primary/20 space-y-4">
          <h2 className="text-2xl font-bold">Specialist Standard</h2>
          <p className="font-semibold">Preserve history. Hold the inherited phase conditions. Record behavior exactly. Let the evidence model decide.</p>
          <p className="text-sm text-muted-foreground">A reliable Handover should feel continuous to the student while remaining independently defensible to the next Specialist, the institution, and any later audit.</p>
        </Card>
      </div>
    </div>
  );
}
