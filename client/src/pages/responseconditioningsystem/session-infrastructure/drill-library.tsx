import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const drillTypes = [
  {
    title: "Diagnosis",
    purpose: "Find where the student should begin in a topic.",
    usedIn: "Intro, and any new topic that appears during active training.",
    howItWorks:
      "The evidence-complete diagnosis engine selects the smallest next probe needed; concrete behavior decides placement rather than a numeric score.",
  },
  {
    title: "Training",
    purpose: "Build the student's current skill once the starting point is already known.",
    usedIn: "Normal active training sessions.",
    howItWorks:
      "The app identifies the current phase, and the tutor runs the training sets exactly as written.",
  },
  {
    title: "Verification",
    purpose: "Check whether the current placement still holds without restarting the topic.",
    usedIn: "Tutor handover and continuity checks.",
    howItWorks:
      "Record one continuity opportunity at a time. The evidence model stops when it can hold the inherited state, make a bounded stability adjustment, or require targeted re-diagnosis.",
  },
];

const drillLanes = [
  {
    phase: "Clarity",
    purpose: "Make sure the student can see and explain the work before solving alone.",
    diagnosis: ["Recognition Probe", "Light Apply Probe"],
    training: ["Modeling", "Identification", "Light Apply"],
    verification: "A short Clarity check using the same recognition focus, without turning into a full lesson.",
    logging:
      "The tutor logs vocabulary, method, reason, and how the student responds when asked to act.",
  },
  {
    phase: "Structured Execution",
    purpose: "Make sure the student can start and carry out the method on their own.",
    diagnosis: ["Start + Structure", "Repeatability"],
    training: ["Required Structure", "Independent Execution", "Variation Control"],
    verification: "A short cold-start check to see whether the student's structure still holds.",
    logging:
      "The tutor logs how the student starts, follows steps, repeats the method, and works independently.",
  },
  {
    phase: "Controlled Discomfort",
    purpose: "Build steadiness when the work feels difficult, without rescuing the student.",
    diagnosis: ["First Contact", "Pressure Hold"],
    training: ["Controlled Entry", "No Rescue", "Repeat Exposure"],
    verification: "A short difficulty check to see whether the student still holds under pressure.",
    logging:
      "The tutor logs the student's first reaction, first-step control, steadiness, and rescue-seeking.",
  },
  {
    phase: "Time Pressure Stability",
    purpose: "Keep method and completion stable while working under time pressure.",
    diagnosis: ["Light Timer", "Consistency"],
    training: ["Structure Under Timer", "Repeated Timed Execution", "Full Constraint"],
    verification: "A short timed check to see whether the student's timed stability is still real.",
    logging:
      "The tutor logs start under time, structure, pace, and whether the student still finishes cleanly.",
  },
];

const hierarchy = [
  "Session context: why this session exists.",
  "Drill type: diagnosis, training, or verification.",
  "Phase: clarity, structured execution, controlled discomfort, or time pressure stability.",
  "Drill set: the exact procedure the tutor runs.",
  "Evidence logging: the concrete behavior recorded for each valid opportunity or rep.",
  "Result: the evidence-native placement, Training transition, Handover hold/adjustment, or re-diagnosis decision.",
];

const introRules = [
  "Intro happens when a student is entering Response Integrity in a topic for the first time.",
  "The tutor does not yet know the student's correct starting phase in that topic.",
  "Intro does not run full training sets.",
  "Intro uses diagnosis blocks to find the right starting phase.",
  "A high intro score means check the next phase, not start teaching more.",
];

const handoverRules = [
  "Handover happens when a tutor is being replaced.",
  "The student has already been trained in Response Integrity before this session.",
  "The student already has an inherited topic, phase, and stability from the previous tutor.",
  "Handover does not restart the student.",
  "Handover is evidence-complete, not fixed-rep complete. A reserve problem bank is prepared, but only the opportunities required by the evidence model are used.",
  "The same canonical behavior classes used by Diagnosis govern Handover, including not-observed and confounded evidence.",
  "If inherited truth cannot be defended, normal Training stays closed and the system routes the topic to targeted evidence-complete re-diagnosis.",
];

const loggingSteps = [
  "Hold the exact condition the current mode requires.",
  "Choose the concrete behavior that best matches what the student actually did.",
  "Record not-observed or confounded evidence instead of forcing a strength/weakness judgment when the opportunity was not clean.",
  "Let the evidence engine own placement, Training transition, continuity hold/adjustment, recovery, and re-diagnosis decisions.",
];

const prepBasics = [
  "Prep is the work the tutor does before the drill starts.",
  "Prep means choosing and organizing the exact problems, examples, or timed reps needed for that drill.",
  "Prep is not free teaching. Prep is readiness for accurate drill execution.",
];

const prepImportance = [
  "Without prep, the tutor is forced to improvise in the session.",
  "Improvising usually breaks drill accuracy, pacing, and logging quality.",
  "Good prep protects the session from becoming random, slow, or over-guided.",
];

const prepByContext = [
  {
    title: "Intro Prep",
    detail:
      "Prepare the starting diagnosis block and the nearby phase coverage the system may move into. Intro prep is for finding the right starting phase, not for running a full training lesson.",
  },
  {
    title: "Active Training Prep",
    detail:
      "Prepare the full drill set for the student's current phase and stability. Training prep is for clean repetition inside the current lane, not for re-placing the topic.",
  },
  {
    title: "Handover Prep",
    detail:
      "Prepare a small reserve bank of phase-appropriate continuity problems for the inherited state. It is not a fixed rep target; the evidence model decides how many clean opportunities are required.",
  },
];

const tutorPrepares = [
  "For fixed Training sets, the authored problem/rep count; for Handover, a reserve problem bank rather than a completion quota.",
  "Problems that match the correct phase purpose.",
  "Any timer or constraint the drill requires.",
  "A clean order of delivery so the tutor can run the drill without making it up mid-session.",
];

export default function ResponseConditioningDrillLibrary() {
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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <LibraryBig className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                Drill Library
              </h1>
              <p className="text-muted-foreground mt-1">under Session Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">What This Page Does</h2>
          <p className="text-muted-foreground">
            This page explains the full drill structure in one place: the main drill types,
            the four phases, the drill sets inside each phase, and what the tutor logs.
          </p>
          <p className="font-semibold">
            Use this page when you want the full map. Use the phase pages when you want the exact
            details for one phase.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Read It In This Order</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {hierarchy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Three Drill Types</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {drillTypes.map((drill) => (
              <div key={drill.title} className="rounded-xl border bg-card p-4 space-y-2">
                <h3 className="text-lg font-semibold">{drill.title}</h3>
                <p className="text-sm text-muted-foreground">{drill.purpose}</p>
                <p className="text-sm">
                  <span className="font-medium">Used in:</span> {drill.usedIn}
                </p>
                <p className="text-sm text-muted-foreground">{drill.howItWorks}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Four Phase Lanes</h2>
          <p className="text-muted-foreground">
            Each phase has its own job, its own drill sets, and its own logging focus.
            They are not interchangeable.
          </p>
          <div className="space-y-4">
            {drillLanes.map((lane) => (
              <div key={lane.phase} className="rounded-xl border p-5 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold">{lane.phase}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{lane.purpose}</p>
                </div>
                <p className="text-sm">
                  <span className="font-medium">Diagnosis sets:</span> {lane.diagnosis.join(", ")}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Training sets:</span> {lane.training.join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Verification:</span> {lane.verification}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">What the tutor logs:</span> {lane.logging}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Intro Uses The Library</h2>
          <p className="text-muted-foreground">
            Start with the session context. Intro is used when a student is entering Response Integrity in a topic
            and the tutor still needs to find the correct starting phase.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {introRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            See <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/intro-session-structure">Intro Session Structure</Link> for the
            placement logic and <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/logging-system"> Logging System</Link> for the scoring model.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Handover Uses The Library</h2>
          <p className="text-muted-foreground">
            Start with the session context. Handover is used when one tutor is replacing another
            and the student has already been actively trained in Response Integrity before.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {handoverRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Handover uses the inherited phase conditions but an evidence-driven continuity format.
            It records one opportunity at a time and stops when the Response Evidence Model has enough
            truth to hold, adjust, or require targeted re-diagnosis. It is not a fresh placement event
            and it must not turn into normal Training.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Logging Works</h2>
          <ol className="space-y-1 pl-5 text-muted-foreground">
            {loggingSteps.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
          <p className="font-semibold">
            The tutor does not decide the result by feel. The tutor runs the drill, logs honestly,
            and the app computes the summary.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Prep Is</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {prepBasics.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why Prep Matters</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {prepImportance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What The Tutor Prepares</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {tutorPrepares.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Prep Changes By Context</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {prepByContext.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-4 space-y-2">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-2 border-primary/20 space-y-4">
          <h2 className="text-2xl font-bold">Where To Go Next</h2>
          <p className="text-muted-foreground">
            If you want the exact procedure for one phase, go to that phase page.
            If you want the live runner and scoring logic, go to Logging System.
          </p>
          <p className="text-sm text-muted-foreground">
            Recommended next pages:{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/clarity">Clarity</Link>,{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/session-flow-control">Session Context and Drill Flow</Link>,{" "}
            <Link className="underline underline-offset-2" to="/responseconditioningsystem/session-infrastructure/logging-system">Logging System</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
