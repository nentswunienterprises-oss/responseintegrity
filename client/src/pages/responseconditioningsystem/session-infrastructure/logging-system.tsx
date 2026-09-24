import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const evidenceStatuses = [
  {
    title: "Observed",
    detail:
      "Use when the opportunity meaningfully exposed the behavior and nothing made that observation uninterpretable.",
  },
  {
    title: "Not observed",
    detail:
      "Use when the opportunity did not meaningfully expose the behavior. Missing evidence is not weakness.",
  },
  {
    title: "Confounded",
    detail:
      "Use when assistance, content exposure, task design, interruption, timing changes, or another condition prevents clean interpretation.",
  },
];

const loggingLaw = [
  "Record the concrete behavior that actually occurred.",
  "Record whether that behavior was meaningfully observed.",
  "Record intervention, prompting, rescue, or timing changes separately from student behavior.",
  "Preserve the condition the system intended to test.",
  "Do not guess the phase, stability, evidence class, or next action.",
];

const sourceIntegrityRules = [
  "Do not select a stronger behavior than the student demonstrated.",
  "Do not convert missing evidence into weakness.",
  "Do not hide support, rescue, prompting, or timer changes.",
  "Do not change a condition and log the result as though the original condition held.",
  "Do not manually rewrite the state because you prefer a different conclusion.",
];

export default function ResponseConditioningLoggingSystem() {
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
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Logging System</h1>
              <p className="text-muted-foreground mt-1">
                Evidence capture, source integrity, and evidence-led system output
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">What Logging Is</h2>
          <p className="text-muted-foreground">
            Logging is the evidence-capture layer between what the student actually did and what the system is allowed to conclude.
          </p>
          <p className="font-semibold">
            Active condition → concrete observed behavior → evidence eligibility → dimension state → system decision → next action
          </p>
          <p className="text-sm text-muted-foreground">
            The Specialist owns truthful observation. The Response Evidence Model owns evidence interpretation and the resulting operating decision.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Core Logging Law</h2>
          <p className="text-muted-foreground">
            Specialists do not log opinions about the student&apos;s state. They record source facts that the evidence system can interpret consistently.
          </p>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            {loggingLaw.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Evidence Status</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {evidenceStatuses.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="font-semibold">
            Not-observed and confounded evidence must stay missing or confounded. Neither may be converted into strength or weakness.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Intervention Is a Separate Fact</h2>
          <p className="text-muted-foreground">
            Student behavior and Specialist intervention are not the same field. Training may contain legitimate support, but support changes what evidence remains eligible.
          </p>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>No intervention</li>
            <li>Neutral clarification</li>
            <li>Response-control cue or first-step confirmation where permitted</li>
            <li>Method or step prompting</li>
            <li>Teaching or full rescue</li>
            <li>Timer or condition changed</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Record what the student did and what support actually occurred. Do not rewrite one fact to compensate for the other.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">How Logging Changes by Session Context</h2>
          <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-2">
              <h3 className="text-lg font-semibold">Intro Diagnosis</h3>
              <p className="text-sm text-muted-foreground">
                Diagnosis is evidence-complete, not rep-complete. Present the system-selected probe, record concrete behavior and evidence status, record intervention separately, submit, then follow the next evidence question selected from that evidence.
              </p>
              <p className="text-sm font-medium">
                The Specialist does not choose the phase, starting stability, next probe, or system decision.
              </p>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <h3 className="text-lg font-semibold">Training</h3>
              <p className="text-sm text-muted-foreground">
                Training is exposure-complete and evidence-authorized. Completing required opportunities and proving capability are separate questions.
              </p>
              <p className="text-sm text-muted-foreground">
                A genuine breakdown is not erased by one isolated later success. Recovery requires sufficient clean comparable evidence. High, High Maintenance, and phase progression remain temporally separated.
              </p>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <h3 className="text-lg font-semibold">Handover Verification</h3>
              <p className="text-sm text-muted-foreground">
                Handover verifies inherited truth after Specialist reassignment. It is neither normal Training nor a restart of Intro.
              </p>
              <p className="text-sm text-muted-foreground">
                Present one clean continuity opportunity at a time and stop when the evidence model can hold the inherited state, make a bounded same-phase stability adjustment, or require targeted evidence-complete re-diagnosis.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Timing Evidence Integrity</h2>
          <p className="text-muted-foreground">
            Passive baseline timing and TPS timed attempts are system-owned evidence. The Specialist does not choose, pause, round, estimate, or manually repair the timer.
          </p>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>Structured Execution passive timing runs without a countdown or pacing cue.</li>
            <li>TPS uses the immutable Timer Contract for that student and topic.</li>
            <li>Objective technical timer failures remain durable non-decision-eligible lineage and leave the canonical evidence slot unresolved.</li>
            <li>A technical replacement is not a second chance. It may fill that unresolved slot only with a fresh equivalent reserve problem prepared before the session under the same condition.</li>
            <li>Do not reuse the exposed problem or improvise a new one mid-session. Timeout, panic, wrong method, incomplete work, or weak performance is real student evidence and never unlocks replacement.</li>
            <li>Only valid timed-attempt lineage may authorize TPS evidence.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4 border-l-4 border-l-destructive">
          <h2 className="text-2xl font-bold">Source Integrity</h2>
          <p className="text-muted-foreground">
            Submitted evidence becomes part of the institutional record. A false observation can create a false capability claim, false state movement, false continuity decision, or misleading downstream report.
          </p>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            {sourceIntegrityRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">What a Result Must Mean</h2>
          <p className="text-muted-foreground">
            A result must be traceable to evidence: the behavior pattern that mattered, whether the evidence was eligible, the resulting phase/stability or continuity outcome, the reason for that decision, the next action, and the active condition.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Related Deep Dives</h2>
          <p className="text-sm text-muted-foreground">
            Use <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/intro-session-structure">Intro Session Structure</Link> for Diagnosis execution,{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/drill-library">Drill Library</Link> for the drill sources, and{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/handover-verification">Handover Verification</Link> for continuity verification.
          </p>
        </Card>

        <Card className="p-6 border-2 border-primary/20 space-y-3">
          <h2 className="text-2xl font-bold">Specialist Standard</h2>
          <p className="font-semibold">Observe accurately. Preserve the condition. Record intervention honestly. Keep missing evidence missing. Let evidence determine the decision.</p>
        </Card>
      </div>
    </div>
  );
}
