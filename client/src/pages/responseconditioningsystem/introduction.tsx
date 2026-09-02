import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const responseQuestions = [
  "Do they begin or immediately stop?",
  "Can they identify what they are looking at?",
  "Do they know which method applies?",
  "Can they state the first step?",
  "Do they follow the method in order?",
  "Do they abandon structure after an error?",
  "Do they immediately seek rescue?",
  "Can they tolerate not knowing for a moment?",
  "Can they recover after becoming stuck?",
  "Does urgency cause them to rush, guess, or skip?",
  "Can they reproduce good execution repeatedly?",
];

const phases = [
  {
    title: "1. Clarity",
    question: "Does the student know what they are looking at and what should happen next?",
    body: [
      "Before a student can execute reliably, they must be able to see the problem clearly.",
      "Clarity develops the student's ability to recognize what is present, understand the relevant language, identify the appropriate method, and understand why that method applies.",
      "This is the phase in which explanation and modeling are most appropriate. We first establish the mental map.",
    ],
  },
  {
    title: "2. Structured Execution",
    question: "Can the student reliably do what they understand?",
    body: [
      "Understanding something is different from being able to execute it independently.",
      "Structured Execution develops the student's ability to begin correctly, follow the method in order, repeat that method consistently, and complete the work without unnecessary dependence on the Specialist.",
      "At this stage, excessive explanation can become harmful. If the Specialist continually supplies the next step, the student's apparent success may actually conceal dependency.",
    ],
  },
  {
    title: "3. Controlled Discomfort",
    question: "Can the student's execution survive difficulty?",
    body: [
      "Independent execution under comfortable conditions is still not enough.",
      "Eventually the student must encounter questions that create uncertainty, difficulty, hesitation, or the feeling of being stuck.",
      "Controlled Discomfort develops the student's ability to remain functional when that happens. Difficulty is no longer something we automatically remove. Used correctly, it becomes part of the training.",
    ],
  },
  {
    title: "4. Time Pressure Stability",
    question: "Can the student preserve good execution when urgency enters the environment?",
    body: [
      "The final core phase introduces urgency.",
      "By this point, the student has developed clearer recognition, stronger execution, and a more stable response to difficulty.",
      "Time Pressure Stability is not primarily about making the student fast. It is about ensuring that time pressure does not destroy the structure that has already been built.",
    ],
  },
];

const specialistResponsibilities = [
  "understand the capability being conditioned",
  "run the correct drill",
  "preserve the conditions of that drill",
  "know what each set is designed to test or develop",
  "understand why repetitions are required",
  "observe the student's actual behavior",
  "avoid contaminating the exercise through inappropriate prompting, rescuing, or pressure",
  "record evidence accurately",
  "allow the system to use that evidence to determine what happens next",
];

const purposeChain = [
  "Phase purpose",
  "Drill purpose",
  "Set purpose",
  "Rep purpose",
  "Active constraint",
  "Observable response",
  "Evidence",
  "System decision",
];

const oneOffReasons = [
  "the example happened to be familiar",
  "they remembered the previous question",
  "they received an unnoticed cue",
  "they guessed correctly",
  "the particular problem was easier",
  "they produced an unusually strong one-off response",
];

const masteryQuestions = [
  "What capability are we conditioning?",
  "Why is this drill appropriate?",
  "What is this set trying to isolate?",
  "What is this repetition supposed to reveal?",
  "What constraint must I preserve?",
  "What behavior am I actually observing?",
  "What would I do that could contaminate this evidence?",
  "What should I record so the system receives an accurate picture of the student's response?",
];

export default function ResponseConditioningIntroduction() {
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

          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
              Response Integrity-OS Deep Dive
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
              Introduction to the Response Conditioning Methodology
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-2">
              The foundation specialists read before Transformation Phases.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Response Failures</h2>
          <p className="text-muted-foreground">
            Response Integrity is built on a simple observation: a student's performance in mathematics is
            not determined only by what they know.
          </p>
          <p className="font-medium text-lg">
            It is also determined by how they respond when knowing becomes difficult.
          </p>
          <p className="text-muted-foreground">
            A student may understand a concept during explanation and still freeze when expected to begin
            alone. They may know the correct method and abandon it when the question looks unfamiliar.
            They may execute reliably in practice and lose that structure when they become uncertain,
            frustrated, or rushed.
          </p>
          <p className="font-semibold">
            These are not always knowledge failures. Often, they are response failures.
          </p>
          <p className="text-muted-foreground">
            Response Conditioning is the methodology Response Integrity uses to identify, train, and
            stabilize those responses.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Mathematics Is the Arena. Response Is the Skill.</h2>
          <p className="text-muted-foreground">
            Mathematics gives us a uniquely useful environment for observing human response. A mathematical
            problem can create uncertainty, expose hesitation, require independent initiation, reveal whether
            a student follows structure or guesses, introduce difficulty without ambiguity about the task,
            be repeated under controlled conditions, and eventually be performed under time pressure.
          </p>
          <p className="font-medium text-lg">
            What does the student actually do when the answer is not immediately available?
          </p>
          <p className="text-muted-foreground">
            Response Integrity uses those moments deliberately. We are not attempting to remove all
            difficulty from the student's experience. We are teaching the student how to remain capable
            inside difficulty.
          </p>
          <p className="font-semibold">
            The long-term objective is a student whose trained response can survive uncertainty, complexity,
            independence, discomfort, and eventually pressure.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What We Mean by a Response</h2>
          <p className="text-muted-foreground">
            A response is not simply whether the student gets an answer right or wrong. It includes what
            happens around the answer.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {responseQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            These behaviors matter because mathematical performance under pressure is produced by more than
            stored knowledge. The student's default response pattern determines whether that knowledge remains
            usable when conditions become demanding.
          </p>
          <p className="font-medium">
            Response Conditioning trains more than answers. It trains the behavior surrounding difficult
            mathematical execution.
          </p>
        </Card>

        <Card className="p-6 space-y-6 border-l-4 border-l-primary">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">The Four-Phase Conditioning Progression</h2>
            <p className="text-muted-foreground">
              Response Conditioning develops the student through four core phases.
            </p>
            <p className="text-xl font-bold text-primary">
              Clarity -&gt; Structured Execution -&gt; Controlled Discomfort -&gt; Time Pressure Stability
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {phases.map((phase) => (
              <div key={phase.title} className="rounded-lg border bg-background p-4 space-y-3">
                <h3 className="text-lg font-semibold">{phase.title}</h3>
                <p className="font-medium">{phase.question}</p>
                {phase.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Response Conditioning Progressively Changes the Environment</h2>
          <p className="text-muted-foreground">
            The four phases are not four unrelated types of practice. They form one progression.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>In Clarity, we provide enough instruction for the student to build the correct mental map.</li>
            <li>In Structured Execution, we begin removing instructional dependence.</li>
            <li>In Controlled Discomfort, we remove immediate rescue.</li>
            <li>In Time Pressure Stability, we remove unlimited time.</li>
          </ul>
          <p className="text-lg font-semibold">
            Understand -&gt; Execute -&gt; Withstand Difficulty -&gt; Withstand Urgency
          </p>
          <p className="text-muted-foreground">
            This is how Response Integrity moves from supported understanding toward stable performance.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">The Specialist Is Not Simply Teaching Mathematics</h2>
          <p className="text-muted-foreground">
            As a Response Integrity Specialist, your role is different from that of a conventional tutor.
            You are not free-form teaching until the student appears to understand. You are operating a
            controlled conditioning system.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {specialistResponsibilities.map((responsibility) => (
              <li key={responsibility}>{responsibility}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            A mathematically correct session can still be a poor Response Integrity session. If a student
            completes a difficult problem only because you repeatedly rescued them, the answer may be correct
            while the evidence of independence is weak.
          </p>
          <p className="font-medium">
            The Specialist must distinguish between getting the student through the question and conditioning
            the response the phase is designed to develop.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Every Drill Has a Purpose</h2>
          <p className="text-muted-foreground">
            You should never experience a Response Integrity drill as a collection of maths questions. Every
            drill exists because the student's current phase requires a specific controlled experience.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Operating chain
            </p>
            <p className="font-medium leading-relaxed">{purposeChain.join(" -> ")}</p>
          </div>
          <p className="text-muted-foreground">
            As a Specialist, you are expected to understand this chain. You should know not only what the
            platform is asking you to do, but why the condition must be preserved.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Why Repetition Matters</h2>
          <p className="text-muted-foreground">
            A single successful response does not establish stability. A student may perform correctly
            because:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {oneOffReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="font-medium text-lg">Does the response return?</p>
          <p className="text-muted-foreground">
            Response Integrity is interested in repeatable behavior. A repetition is therefore not merely
            another question. It is another opportunity for the response to reveal itself.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Preserve the Condition</h2>
          <p className="text-muted-foreground">
            One of the most important responsibilities of a Specialist is knowing what not to do. Every phase
            has ways in which the Specialist can accidentally destroy the condition being trained.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>In Clarity, excessive prompting can make Specialist assistance look like student understanding.</li>
            <li>In Structured Execution, repeated explanation can hide dependence.</li>
            <li>In Controlled Discomfort, premature rescue can remove the exact difficulty the student needs to handle.</li>
            <li>In Time Pressure Stability, excessive focus on speed can cause the student to abandon structure.</li>
          </ul>
          <p className="font-semibold">This is called contaminating the training condition.</p>
          <p className="text-muted-foreground">
            Good Specialist execution is not merely active intervention. Sometimes it means explaining,
            asking a precise question, withholding a hint, allowing silence, refusing to rescue, or slowing a
            student down even though the timer is running.
          </p>
          <p className="font-medium">Your action must follow the purpose of the phase.</p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Observe Before You Interpret</h2>
          <p className="text-muted-foreground">
            Response Conditioning depends on trustworthy evidence. Your task is to capture what actually
            happened.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold">Observation</p>
              <p className="text-sm text-muted-foreground">The student paused for eight seconds before beginning.</p>
              <p className="font-semibold">Interpretation</p>
              <p className="text-sm text-muted-foreground">The student panicked.</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold">Observation</p>
              <p className="text-sm text-muted-foreground">The student asked what step to do next on two repetitions.</p>
              <p className="font-semibold">Interpretation</p>
              <p className="text-sm text-muted-foreground">The student has no confidence.</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Those are different claims. Record the response that occurred. Do not exaggerate it, soften it,
            or invent psychological explanations the session did not establish.
          </p>
        </Card>

        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The System Makes the Movement Decision</h2>
          <p className="text-muted-foreground">
            You will develop an informed understanding of phases, stability, drills, and student behavior.
            But you are not expected to manually decide when a student should advance because they seem ready.
          </p>
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold leading-relaxed">
              Create the correct condition. Run it faithfully. Observe carefully. Record truthfully.
            </p>
          </div>
          <p className="text-muted-foreground">
            The system then determines the appropriate state transition. This protects the methodology from
            individual preference, optimism, pressure from families, or inconsistent Specialist judgment.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">What Mastery Looks Like for a Specialist</h2>
          <p className="text-muted-foreground">
            Learning Response Conditioning does not mean memorizing four phase definitions. A trained
            Specialist should be able to enter a session and answer:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {masteryQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            When you can answer those questions while operating the system, you are no longer simply following
            instructions. You understand the methodology.
          </p>
          <p className="font-medium">
            The integrity of the session depends on whether the Specialist understands what is being trained,
            why it is being trained, and what must remain true for the evidence to be trusted.
          </p>
          <p className="font-bold text-lg">That is the foundation of Response Conditioning.</p>
        </Card>
      </div>
    </div>
  );
}
