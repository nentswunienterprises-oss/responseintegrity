import { useNavigate } from "react-router-dom";
import { ArrowLeft, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const contexts = [
  {
    title: "Intro Diagnosis",
    purpose: "Establish the correct Training entry state for a newly activated topic.",
    specialist:
      "Present the system-selected probe, preserve its condition, record concrete behavior and intervention, submit, then follow the next evidence question.",
    system:
      "Select probes from the evidence state, strip constraints when needed, derive Low / Medium / High placement, and stop when the required evidence is complete.",
    notFor:
      "Do not teach through the diagnosis, pick a preferred phase, complete a fixed rep quota, or manually place the topic.",
  },
  {
    title: "Active Training",
    purpose: "Condition the phase-defining capability for the topic under the phase's prescribed sequence and constraints.",
    specialist:
      "Prepare the required problems, run the live registry-defined Training sets, preserve the support/pressure/variation/difficulty conditions, and record the actual behavior and intervention.",
    system:
      "Evaluate evidence eligibility, resolve phase dimensions, update stability, preserve recovery rules, and authorize hold, High, High Maintenance, progression, or targeted re-diagnosis where the evidence warrants it.",
    notFor:
      "Do not select arbitrary drills, manually move the phase, rescue a weak response into stronger-looking evidence, or turn Training into fresh placement.",
  },
  {
    title: "Handover Verification",
    purpose: "Verify whether inherited topic-state remains trustworthy after Specialist reassignment.",
    specialist:
      "Review the inherited state, present one clean continuity opportunity at a time, record concrete behavior, and stop as soon as the evidence model resolves the continuity question.",
    system:
      "Hold the inherited state, make a bounded same-phase stability adjustment, or require targeted evidence-complete re-diagnosis.",
    notFor:
      "Do not restart Intro, teach forward, use a fixed rep target, or keep giving opportunities until the inherited state 'wins'.",
  },
];

const routingRules = [
  "A newly activated topic without observed state routes to Intro Diagnosis.",
  "An active topic with trustworthy state routes to Training.",
  "A replacement Specialist verifies inherited truth before ordinary Training resumes.",
  "A prerequisite contradiction or unresolved earlier layer routes to targeted evidence-complete re-diagnosis rather than guessed backward movement.",
  "An above-Structured-Execution topic without valid timing authority routes to targeted evidence-native re-diagnosis to establish the missing baseline; hidden calibration side reps are not allowed.",
];

export default function ResponseConditioningSessionFlowControl() {
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
              <Route className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Session Flow Control</h1>
              <p className="text-muted-foreground mt-1">Know which session context you are in, then execute only what that context authorizes.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">The First Question Is Context</h2>
          <p className="text-muted-foreground">
            Phase and session context are different variables. The same phase can appear inside Diagnosis, Training, targeted re-diagnosis, or Handover, but the authority and support conditions are not interchangeable.
          </p>
          <p className="font-semibold">Identify the session context first. Then run the system-authorized drill behavior for that context.</p>
        </Card>

        <div className="space-y-5">
          {contexts.map((context) => (
            <Card key={context.title} className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">{context.title}</h2>
              <p className="text-muted-foreground">{context.purpose}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Specialist responsibility</p>
                  <p className="mt-2 text-sm text-muted-foreground">{context.specialist}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="font-semibold">System responsibility</p>
                  <p className="mt-2 text-sm text-muted-foreground">{context.system}</p>
                </div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-semibold">Do not use this context for</p>
                <p className="mt-2 text-sm text-muted-foreground">{context.notFor}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Routing Rules</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            {routingRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Never Changes</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>The Specialist records what actually happened; the system owns interpretation and state movement.</li>
            <li>Not-observed and confounded evidence remain missing/confounded.</li>
            <li>Support, pressure, variation, difficulty, and timing conditions are part of the evidence.</li>
            <li>One strong-looking answer cannot silently erase a real breakdown, and one failure under a higher constraint does not automatically condemn every earlier layer.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4 border-l-4 border-l-primary">
          <h2 className="text-2xl font-bold">Simple Specialist Mental Model</h2>
          <p className="font-semibold">Context → authorized condition → concrete behavior → evidence → system route.</p>
          <p className="text-sm text-muted-foreground">
            Do not improvise a fourth session context between the defined ones, and do not use one context's rules to solve another context's problem.
          </p>
        </Card>
      </div>
    </div>
  );
}
