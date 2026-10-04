import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { SESSION_INFRASTRUCTURE_TEACHING } from "@/lib/sessionInfrastructureTeaching";
import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const contexts = [
  {
    title: "Intro Diagnosis",
    purpose: "Establish the correct Training entry state for a newly activated topic.",
    specialist:
      "Present the check RI-OS selects, preserve its condition, record concrete behavior and intervention, submit, then follow the next evidence question.",
    system:
      "Select the next check from the evidence already recorded, remove pressure when an earlier layer needs checking, decide Low / Medium / High placement, and stop when the required evidence is complete.",
    notFor:
      "Do not teach through the diagnosis, pick a preferred phase, complete a fixed rep quota, or manually place the topic.",
  },
  {
    title: "Active Training",
    purpose: "Train the behavior this phase is meant to build for the topic, using the phase's required sequence and conditions.",
    specialist:
      "Prepare the required problems, run the required Training sets, preserve the support, pressure, variation, and difficulty conditions, and record the actual behavior and intervention.",
    system:
      "Check what evidence can count, resolve the phase observations, update stability, preserve recovery rules, and decide whether the topic stays put, reaches High or High Maintenance, progresses, or needs targeted re-diagnosis.",
    notFor:
      "Do not select arbitrary drills, manually move the phase, rescue a weak response into stronger-looking evidence, or turn Training into fresh placement.",
  },
  {
    title: "Handover Verification",
    purpose: "Verify whether inherited topic-state remains trustworthy after Specialist reassignment.",
    specialist:
      "Review the inherited state, present one clean continuity opportunity at a time, record concrete behavior, and stop as soon as RI-OS has enough evidence to resolve the continuity question.",
    system:
      "Keep the inherited state, adjust stability within the same phase, or require targeted re-diagnosis.",
    notFor:
      "Do not restart Intro, teach forward, use a fixed rep target, or keep giving opportunities until the inherited state 'wins'.",
  },
];

const routingRules = [
  "A newly activated topic without an observed state opens Intro Diagnosis.",
  "An active topic with a trustworthy state continues into Training.",
  "A replacement Specialist verifies inherited truth before ordinary Training resumes.",
  "A prerequisite contradiction or unresolved earlier layer requires targeted re-diagnosis rather than guessed backward movement.",
  "A topic above Structured Execution without a valid baseline requires targeted re-diagnosis to establish that baseline; hidden calibration side reps are not allowed.",
];

export default function ResponseConditioningSessionFlowControl() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/responseconditioningsystem")}>
            
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Response Integrity-OS Deep Dive</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Session Flow Control</h1>
              <p className="text-muted-foreground mt-1">Know which session context you are in, then do only what that context allows.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="session-flow-control-v3"
          title="Session Flow Control"
          completion={<DeepDiveCapabilityCheck assessmentKey="session_flow_control_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">The First Question Is Context</h2>
          <p className="text-muted-foreground">
            Phase and session context are different. The same phase can appear inside Diagnosis, Training, targeted re-diagnosis, or Handover, but the allowed support and conditions are not interchangeable.
          </p>
          <p className="font-semibold">Identify the session context first. Then run the drill behavior RI-OS requires for that context.</p>
        </Card>

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


        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Routing Rules</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            {routingRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">A Requirement Raised During Training</h2>
          <p className="text-muted-foreground">If Training reveals a requirement for targeted re-diagnosis, today’s prepared session remains Training. Preserve its actual exposure, support, and observations. The next scheduled session opens in the required diagnosis context; do not relabel today’s reps as diagnosis.</p>
          <p className="text-muted-foreground">Training follows its prescribed structure. A genuine interruption preserves valid partial evidence; it does not create automatic leftover-rep debt. Intro and Handover instead stop as soon as their evidence question is resolved.</p>
        </Card>

        <DeepDiveTeachingInteraction {...SESSION_INFRASTRUCTURE_TEACHING.session_flow_control[0]} />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Never Changes</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>The Specialist records what actually happened; RI-OS interprets the evidence and decides whether the state changes.</li>
            <li>Not-observed and confounded evidence remain missing/confounded.</li>
            <li>Support, pressure, variation, difficulty, and timing conditions are part of the evidence.</li>
            <li>One strong-looking answer cannot silently erase a real breakdown, and one failure under a higher constraint does not automatically condemn every earlier layer.</li>
          </ul>
        </Card>

 <Card className="p-6 space-y-4 ">
          <h2 className="text-2xl font-bold">Simple Specialist Mental Model</h2>
          <p className="font-semibold">Context → required condition → concrete behavior → evidence → next system action.</p>
          <p className="text-sm text-muted-foreground">
            Do not improvise a fourth session context between the defined ones, and do not use one context's rules to solve another context's problem.
          </p>
        </Card>
        <DeepDiveTeachingInteraction {...SESSION_INFRASTRUCTURE_TEACHING.session_flow_control[1]} />
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
