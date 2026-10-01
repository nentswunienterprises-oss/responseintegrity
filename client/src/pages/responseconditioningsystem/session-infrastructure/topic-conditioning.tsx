import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningTopicConditioning() {
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
              Topic Conditioning
            </h1>
            <p className="text-muted-foreground mt-1">under Transformation Phases</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="topic-conditioning-v2"
          title="Topic Conditioning"
          completion={<DeepDiveCapabilityCheck assessmentKey="topic_conditioning_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Topic Conditioning in Response Integrity</h2>
          <h3 className="text-xl font-semibold">What it is</h3>
          <p className="text-muted-foreground">
            Topic Conditioning is how Response Integrity uses the student's real school topics to train a stable
            response under pressure.
          </p>
          <p className="text-muted-foreground">Response Integrity does not ask only, "Do they know the topic?" It asks, "Where does their response break inside that topic, and what must happen next?"</p>
          <p className="font-semibold">This is the bridge between schoolwork and specialist execution.</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>Take the topic the student is currently struggling with.</li>
            <li>Find where their response breaks inside that topic.</li>
            <li>Run the Response Integrity system until their response becomes stable.</li>
          </ul>
          <p className="text-muted-foreground">
            That first diagnosis happens in the intro session. Training starts after the entry
            phase has been identified.
          </p>
          <p className="font-semibold">That is Topic Conditioning.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The simplest way to understand it</h2>
          <p className="text-muted-foreground">A topic is the area.</p>
          <p className="font-medium">Examples:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>Fractions</li>
            <li>Algebra</li>
            <li>Exponents</li>
            <li>Word problems</li>
            <li>Linear equations</li>
          </ul>
          <p className="text-muted-foreground">The OS is the conditioning process.</p>
          <p className="font-medium">The phases are:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>Clarity</li>
            <li>Structured Execution</li>
            <li>Controlled Discomfort</li>
            <li>Time Pressure Stability</li>
          </ul>
          <p className="font-semibold">
            So Topic Conditioning means: A school topic becomes the area where Response Integrity-OS trains the student's response.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why this matters</h2>
          <p className="text-muted-foreground">Most tutoring asks: "Does the student understand this topic?"</p>
          <p className="font-semibold">Response Integrity asks a harder and more useful question:</p>
          <p className="font-semibold">"In this topic, where does the student break?"</p>
          <p className="text-muted-foreground">That changes everything.</p>
          <p className="text-muted-foreground">Because a student can:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>understand some parts of a topic</li>
            <li>still freeze in that topic</li>
            <li>still guess in that topic</li>
            <li>still rush in that topic</li>
            <li>still collapse under time in that topic</li>
          </ul>
          <p className="text-muted-foreground">So the real issue is not just topic knowledge.</p>
          <p className="font-semibold">The real issue is:</p>
          <p className="font-semibold">How the student behaves inside that topic when difficulty appears.</p>
          <p className="text-muted-foreground">That is what Response Integrity conditions.</p>
          <p className="text-muted-foreground">Response Integrity is not trying to:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>teach as much content as possible in one session</li>
            <li>move through the syllabus as fast as possible</li>
            <li>finish topics for the sake of progress</li>
            <li>impress parents with volume</li>
          </ul>
          <p className="text-muted-foreground">Response Integrity is doing something more precise.</p>
          <p className="text-muted-foreground">Response Integrity is asking:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>Inside this topic, is the student clear?</li>
            <li>Can they execute?</li>
            <li>Can they stay stable when difficulty appears?</li>
            <li>Can they stay stable when time pressure appears?</li>
          </ul>
          <p className="font-semibold">If not, the topic is not conditioned yet.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The core structure</h2>
          <p className="text-muted-foreground">Topic Conditioning in Response Integrity works like this:</p>
          <p className="text-muted-foreground">
            Topic: The exact school concept the student is facing now.
          </p>
          <p className="text-muted-foreground">
            Phase: The point in the Response Integrity system where the student currently breaks in that topic.
          </p>
          <p className="text-muted-foreground">
            Stability: How reliable the student's response is inside that topic.
          </p>
          <p className="font-semibold">Put together: Topic + Phase + Stability = Response Integrity conditioning map</p>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Topic</th>
                  <th className="text-left font-semibold px-4 py-3">Phase</th>
                  <th className="text-left font-semibold px-4 py-3">Stability</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-3">Algebraic expressions</td>
                  <td className="px-4 py-3">Structured Execution</td>
                  <td className="px-4 py-3">Low</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-3">Fractions</td>
                  <td className="px-4 py-3">Clarity</td>
                  <td className="px-4 py-3">Medium</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-3">Exponents</td>
                  <td className="px-4 py-3">Time Pressure Stability</td>
                  <td className="px-4 py-3">High</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground">This is elite because it is precise.</p>
          <p className="text-muted-foreground">It does not say: "The student is weak" or "The student struggles with math."</p>
          <p className="font-semibold">
            It says: In this specific topic, the student's response breaks here. That is useful.
          </p>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">How a New Topic Enters the System</h2>
          <p className="text-muted-foreground">
            A new topic does not inherit a phase from another topic and it does not receive a phase from a symptom alone.
            The entry signal only tells RI-OS where to ask first.
          </p>
          <p className="font-semibold">
            Starting signal = routing hypothesis. Direct behavioral evidence = placement authority.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When the Entry Signal Is Uncertain</h2>
          <p className="text-muted-foreground">
            If there is no trustworthy starting signal, RI-OS begins with a neutral Independent Normal Probe: one normal,
            familiar-form problem with difficulty and time pressure removed.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>No timer or urgency target.</li>
            <li>No modelling or method prompt.</li>
            <li>The student executes independently.</li>
            <li>The response can naturally expose Clarity and immediate Structured Execution behavior.</li>
            <li>Behavior that never appears remains not observed rather than being elicited just to fill the form.</li>
          </ul>
          <p className="font-semibold">
            This neutral baseline is not an automatic Structured Execution placement. It is the first clean evidence
            condition from which the system decides what question comes next.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A brand-new topic has no reliable parent or history signal. Where should the Specialist place it before the first opportunity?"
          options={[
            {
              key: "a",
              label: "Structured Execution, because the neutral independent probe sits between Clarity and pressure work.",
              feedback: "The neutral probe is an evidence condition, not a phase assignment.",
            },
            {
              key: "b",
              label: "Do not pre-place it. Run the system-selected neutral independent baseline and let the resulting evidence route the next question.",
              feedback: "Yes. Uncertain entry is resolved by clean evidence, not by guessing a middle phase.",
            },
            {
              key: "c",
              label: "Clarity, because every new topic must always restart from the first phase.",
              feedback: "A new topic needs evidence-complete placement. It is not automatically forced to Clarity.",
            },
          ]}
          correctOptionKey="b"
          truth="When the signal is uncertain, RI-OS starts neutral and lets the response reveal which earlier layer needs to be resolved."
        />

        <DeepDiveTeachingInteraction
          prompt="A student scores 86% in a familiar class test, but in RI their structure repeatedly breaks when the same method appears in less familiar forms. How should the class-test mark be used?"
          options={[
            {
              key: "a",
              label: "Treat the mark as evidence that the topic is at least High, because the student has already performed well academically.",
              feedback: "The mark proves performance in that class-test setting. It does not prove the same response remains stable when familiarity and challenge change.",
            },
            {
              key: "b",
              label: "Treat them as conflicting and wait for another class test before deciding the topic state.",
              feedback: "The sources are not competing measurements of the same thing. The class test gives academic context; RI is observing the response under the condition being trained.",
            },
            {
              key: "c",
              label: "Keep the mark as academic context, while letting direct RI evidence of how the student responds determine the topic's phase and stability.",
              feedback: "Yes. Academic performance matters, but conditioned-response state comes from what the student actually does inside the RI condition.",
            },
          ]}
          correctOptionKey="c"
          truth="A strong class-test result can coexist with a response that loses structure when familiarity or challenge changes. RI uses direct response evidence for phase and stability, while school performance remains useful context."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How the OS works inside a topic</h2>
          <p className="text-muted-foreground">Response Integrity-OS does not float above schoolwork. It operates inside it.</p>
          <p className="text-muted-foreground">
            That means every topic is governed by the same phase architecture, while Diagnosis establishes the correct entry point rather than forcing every topic to restart from Clarity.
          </p>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Phase 1: Clarity</h3>
            <p className="text-muted-foreground">The student learns to see the topic clearly.</p>
            <p className="text-muted-foreground">This means:</p>
            <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
              <li>naming the correct terms (Vocablary)</li>
              <li>recognizing the problem type</li>
              <li>knowing the steps (Method)</li>
              <li>knowing why the steps work (Reason)</li>
            </ul>
            <p className="text-muted-foreground">Training sets: Modeling, Identification, then Light Apply.</p>
            <p className="font-medium">Question: Can the student clearly see what they are dealing with in this topic?</p>
            <p className="text-muted-foreground">If no, this topic starts at Clarity.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Phase 2: Structured Execution</h3>
            <p className="text-muted-foreground">The student must now execute inside the topic.</p>
            <p className="text-muted-foreground">This means:</p>
            <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
              <li>starting without delay</li>
              <li>following steps in order</li>
              <li>reducing guessing</li>
              <li>repeating the method reliably</li>
            </ul>
            <p className="text-muted-foreground">Training sets: Required Structure, Independent Execution, then Variation Control.</p>
            <p className="font-medium">Question: Can the student act reliably in this topic without being carried?</p>
            <p className="text-muted-foreground">If no, this topic sits in Structured Execution.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Phase 3: Controlled Discomfort</h3>
            <p className="text-muted-foreground">Now difficulty is introduced inside the topic.</p>
            <p className="text-muted-foreground">This means:</p>
            <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
              <li>challenging, same-form problems</li>
              <li>difficulty held as the active pressure variable</li>
              <li>support tightened across the registered sets</li>
              <li>repeated exposure without changing the topic-state manually</li>
            </ul>
            <p className="text-muted-foreground">Training sets: Controlled Entry, No Rescue, then Repeat Exposure. Boss Battles are the challenging problem load used inside this phase.</p>
            <p className="font-medium">Question: Can the student stay stable in this topic when certainty disappears?</p>
            <p className="text-muted-foreground">If no, this topic sits in Controlled Discomfort.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Phase 4: Time Pressure Stability</h3>
            <p className="text-muted-foreground">Now the same topic is tested under time.</p>
            <p className="text-muted-foreground">This means:</p>
            <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
              <li>an individualized system-owned Timer Contract</li>
              <li>process and structure preserved under urgency</li>
              <li>repeated timed exposure at the same baseline condition</li>
              <li>the final defined tighter constraint only when the registered set requires it</li>
            </ul>
            <p className="text-muted-foreground">Training sets: Structure Under Timer, Repeated Timed Execution, then Full Constraint.</p>
            <p className="font-medium">Question: Can the student stay structured in this topic when time pressure appears?</p>
            <p className="text-muted-foreground">If no, this topic sits in Time Pressure Stability.</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Timing Authority Is Topic-Specific Too</h2>
          <p className="text-muted-foreground">
            Time Pressure Stability is not just topic-specific in phase and stability. Its timing authority is also
            bound to the individual student and topic.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>A Timer Contract from Algebra does not become the timer for Fractions.</li>
            <li>The primary Training baseline comes from the current topic's qualifying Independent Execution evidence.</li>
            <li>Diagnosis can establish equivalent clean no-pressure timing when the topic may enter above Structured Execution.</li>
            <li>If timing authority is missing when the topic needs it, RI-OS resolves that readiness gap before authoritative timed work.</li>
          </ul>
          <p className="font-semibold">
            Topic state and topic timing lineage travel together. The Specialist cannot borrow a timer from another arena.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="Algebra has a valid 44-second Timer Contract. Fractions is newly diagnosed toward Time Pressure Stability but has no timing authority yet. May the Specialist use Algebra's 44 seconds for Fractions?"
          options={[
            {
              key: "a",
              label: "Yes. The Timer Contract belongs to the student, so one strong baseline can cover all topics.",
              feedback: "Timing authority is student-and-topic specific. Different topics can have different normal independent execution durations.",
            },
            {
              key: "b",
              label: "No. Fractions needs its own valid timing authority through the system's qualifying evidence route.",
              feedback: "Yes. The system cannot copy pressure from one topic into another.",
            },
            {
              key: "c",
              label: "Yes, but only as a temporary timer until Fractions produces more evidence.",
              feedback: "A temporary invented timer would still create unauthorized pressure evidence.",
            },
          ]}
          correctOptionKey="b"
          truth="Every active topic carries its own evidence lineage, including individualized timing authority when TPS is relevant."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The important truth</h2>
          <p className="text-muted-foreground">A student does not have one global phase.</p>
          <p className="font-semibold">They have: a phase per topic.</p>
          <p className="text-muted-foreground">That matters because a student can be:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>very stable in exponents</li>
            <li>unstable in algebra</li>
            <li>weak in word problems</li>
            <li>strong in fractions</li>
          </ul>
          <p className="text-muted-foreground">That does not mean the student is inconsistent in a random way.</p>
          <p className="font-semibold">It means: their response has not yet been conditioned across all arenas.</p>
          <p className="text-muted-foreground">This is a major Response Integrity insight.</p>
          <p className="text-muted-foreground">The student is not "good at math" or "bad at math."</p>
          <p className="font-semibold">They are: conditioned in some arenas, unconditioned in others.</p>
          <p className="text-muted-foreground">That is a much more accurate way to see performance.</p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="Algebra is at Structured Execution High Maintenance. Fractions is newly placed at Clarity Medium. What should govern the first Fractions training session?"
          options={[
            {
              key: "a",
              label: "Use the Algebra state provisionally, then move Fractions back only if the first rep breaks.",
              feedback: "Borrowing another topic's state treats transfer as proven before Fractions has produced that evidence. The Fractions state already tells you where to begin.",
            },
            {
              key: "b",
              label: "Begin from Fractions at Clarity Medium and let Fractions evidence determine its movement.",
              feedback: "Yes. Another topic can show what the student is capable of elsewhere, but it cannot replace the active topic's own evidence history.",
            },
            {
              key: "c",
              label: "Start both topics from the lower state so the programme stays consistent.",
              feedback: "Consistency does not mean one shared state. RI preserves different topic histories when the evidence differs.",
            },
          ]}
          correctOptionKey="b"
          truth="Topic state is local to the topic. Strength in Algebra can be useful context, but Fractions begins from the phase and stability supported by Fractions evidence."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How a topic is chosen</h2>
          <p className="text-muted-foreground">Topic Conditioning starts with the student's real academic environment.</p>
          <p className="text-muted-foreground">Usually the topic comes from:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>the parent enrollment form</li>
            <li>the school's current class topic</li>
            <li>the student's exam/test focus</li>
          </ul>
          <p className="text-muted-foreground">So Response Integrity does not condition random content.</p>
          <p className="font-semibold">It conditions: what the student is currently being tested on in school.</p>
          <p className="text-muted-foreground">This makes the system relevant, timely, aligned to school, and hard to replace.</p>
          <p className="text-muted-foreground">
            Because the student is not doing abstract training. They are training response inside the exact topics
            affecting their marks and exam experience.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A topic is at Clarity High after a strong session. Which next move preserves the meaning of High?"
          options={[
            {
              key: "a",
              label: "Run the ordinary Clarity drill again and let qualifying evidence decide whether High Maintenance is earned.",
              feedback: "Yes. High is strong evidence inside the phase, but repeatability still has to be demonstrated before the confirmation state is earned.",
            },
            {
              key: "b",
              label: "Move into Structured Execution, because High already shows the Clarity response is strong enough to progress.",
              feedback: "High is not the progression state. Moving now would convert a strong moment into confirmed stability before the required repeat evidence exists.",
            },
            {
              key: "c",
              label: "Run a separate High Maintenance drill because that is the next state to confirm.",
              feedback: "High Maintenance is an earned stability state, not a separate drill the Specialist can choose in advance.",
            },
          ]}
          correctOptionKey="a"
          truth="At High, the topic remains in the same phase. The ordinary same-phase drill runs again; later qualifying evidence can earn High Maintenance and authorize progression."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How the intro session uses Topic Conditioning</h2>
          <p className="text-muted-foreground">The introductory session is not a general assessment.</p>
          <p className="font-semibold">It is a topic-based diagnostic.</p>
          <p className="text-muted-foreground">The Specialist looks at:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>parent-reported struggle topics</li>
            <li>parent-reported response symptoms</li>
          </ul>
          <p className="text-muted-foreground">Then selects one focus topic and runs the OS checks inside that topic.</p>
          <p className="text-muted-foreground">The Specialist is asking:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>In this topic: Can the student see clearly?</li>
            <li>Can they execute?</li>
            <li>Can they handle difficulty?</li>
            <li>Can they handle time pressure?</li>
          </ul>
          <p className="text-muted-foreground">The first point of failure becomes the topic's entry phase.</p>
          <p className="font-medium">Example:</p>
          <p className="text-muted-foreground">Parent reports: Algebraic expressions, freezes in tests.</p>
          <p className="text-muted-foreground">Specialist tests algebraic expressions.</p>
          <p className="text-muted-foreground">
            Findings: student names terms correctly, student knows steps when shown, student delays starting alone,
            student skips steps.
          </p>
          <p className="font-semibold">Result: Entry phase for Algebraic Expressions = Structured Execution.</p>
          <p className="font-semibold">That is Topic Conditioning in action.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What progress looks like in Topic Conditioning</h2>
          <p className="text-muted-foreground">Progress is not simply "getting better at the topic,"</p>
          <p className="text-muted-foreground">not just more correct answers, and not just looking more confident.</p>
          <p className="font-semibold">Progress means the student's response inside the topic is changing.</p>
          <p className="font-medium">Before conditioning, in the topic, the student may:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>hesitate</li>
            <li>guess</li>
            <li>ask for help early</li>
            <li>rush</li>
            <li>use vague language</li>
            <li>panic when questions change</li>
          </ul>
          <p className="font-medium">After conditioning, in that same topic, the student now:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>identifies the problem type faster</li>
            <li>names what they see clearly</li>
            <li>starts earlier</li>
            <li>follows steps</li>
            <li>handles harder questions with less collapse</li>
            <li>stays more stable under time</li>
          </ul>
          <p className="font-semibold">That is real progress.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The deeper goal</h2>
          <p className="text-muted-foreground">At first, the OS conditions topic by topic. That is necessary.</p>
          <p className="font-semibold">But the long-term goal is not topic-specific dependence.</p>
          <p className="font-semibold">The long-term goal is: response transfer across topics.</p>
          <p className="text-muted-foreground">
            This means the student stops needing familiarity to stay stable. They begin to carry the Response Integrity response
            pattern into any topic.
          </p>
          <p className="text-muted-foreground">At that point, when they face something new, they do not go:</p>
          <p className="font-medium">"I don't know this. I'm stuck."</p>
          <p className="text-muted-foreground">They go:</p>
          <p className="font-medium">"Let me identify what I know and start."</p>
          <p className="font-semibold">That is the breakthrough.</p>
          <p className="text-muted-foreground">
            That is when Response Integrity is no longer just helping with schoolwork. It is changing how the student behaves in
            academic environments.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why Topic Conditioning is different from normal tutoring</h2>
          <p className="text-muted-foreground">Normal tutoring usually works like this:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>explain topic</li>
            <li>practice topic</li>
            <li>move on</li>
          </ul>
          <p className="text-muted-foreground">Response Integrity works like this:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>select topic</li>
            <li>diagnose where response breaks in that topic</li>
            <li>apply the correct phase</li>
            <li>repeat until response stabilizes</li>
            <li>move only when stable</li>
          </ul>
          <p className="text-muted-foreground">That means Response Integrity is not competing on more hours, worksheets, or explanations.</p>
          <p className="font-semibold">Response Integrity is competing on precision of response training.</p>
          <p className="font-semibold">This is why Response Integrity feels different.</p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A family moves from two sessions per week to four. What changes in the student's development path?"
          options={[
            {
              key: "a",
              label: "The evidence standard becomes lighter because the system will see the student more often.",
              feedback: "More opportunities do not reduce what counts as qualifying evidence. Frequency changes how quickly opportunities arrive, not the standard they must meet.",
            },
            {
              key: "b",
              label: "The same evidence requirements remain, but qualifying opportunities can arrive sooner in calendar time.",
              feedback: "Yes. Cadence changes delivery frequency, not the educational rule for phase or stability movement.",
            },
            {
              key: "c",
              label: "The topic should advance after fewer successful reps so the higher package frequency does not slow perceived progress.",
              feedback: "Package value cannot be protected by weakening the evidence gate. Progression still depends on the same response proof.",
            },
          ]}
          correctOptionKey="b"
          truth="Package cadence and educational state are separate. More sessions create more opportunities to produce evidence, but they do not alter the evidence required for movement."
        />

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">What package cadence really means</h2>
          <p className="text-muted-foreground">A session package is not a promise of generic teaching hours.</p>
          <p className="text-muted-foreground">Response Integrity uses 8, 12, or 16 sessions per month - roughly 2, 3, or 4 conditioning windows per week.</p>
          <p className="text-muted-foreground">That cadence is how the system moves.</p>
          <p className="text-muted-foreground">Not because time itself is the product.</p>
          <p className="text-muted-foreground">But because stable response requires:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>repetition</li>
            <li>consistent exposure</li>
            <li>ongoing correction</li>
            <li>structured pressure</li>
          </ul>
          <p className="font-semibold">So the sessions are not the product.</p>
          <p className="font-semibold">They are the repetition units through which Topic Conditioning happens.</p>
          <p className="font-semibold">That is a completely different model.</p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student identifies the problem and method correctly, executes the method in order, then makes one arithmetic slip that changes the final answer. What should RI locate first?"
          options={[
            {
              key: "a",
              label: "Clarity, because a wrong final answer means the student did not understand the problem well enough.",
              feedback: "The observed recognition was already supported. Final correctness cannot erase earlier layers that were visibly intact.",
            },
            {
              key: "b",
              label: "Structured Execution, because any error made during solving belongs to the execution phase.",
              feedback: "An error occurring during execution is not automatically a structure breakdown. RI still asks what behavior actually became unsupported.",
            },
            {
              key: "c",
              label: "Preserve supported earlier layers and locate the first response behavior that becomes unsupported.",
              feedback: "Yes. RI follows the response chain rather than assigning the phase from the final answer or from where the error happened chronologically.",
            },
          ]}
          correctOptionKey="c"
          truth="Topic Conditioning preserves supported earlier layers and locates the earliest unsupported response behavior. A wrong final answer does not automatically mean Clarity or Structured Execution failed."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What the Specialist is doing during Topic Conditioning</h2>
          <p className="text-muted-foreground">The Specialist is not "covering the topic."</p>
          <p className="text-muted-foreground">The Specialist is:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>diagnosing the breakdown point in the topic</li>
            <li>running the correct Response Integrity phase in that topic</li>
            <li>logging the response patterns</li>
            <li>following the system-authorized next action as evidence changes the topic state</li>
          </ul>
          <p className="text-muted-foreground">That means the Specialist must always know:</p>
          <ol className="space-y-2 pl-5 list-decimal text-muted-foreground">
            <li>
              What topic is active
              <p className="text-sm mt-1">What school concept is being conditioned right now.</p>
            </li>
            <li>
              What phase is active
              <p className="text-sm mt-1">Where the student currently breaks in that topic.</p>
            </li>
            <li>
              What stability level is present
              <p className="text-sm mt-1">How reliable the student's response is in that topic.</p>
            </li>
          </ol>
          <p className="text-muted-foreground">This is why the system has a Topic x Phase dashboard.</p>
          <p className="text-muted-foreground">Because the Specialist should not guess.</p>
          <p className="font-semibold">
            They should open the student and see: "In this topic, the student is here. This is what I must do next."
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What the parent is really buying</h2>
          <p className="text-muted-foreground">Parents may think they are buying math tutoring, support with schoolwork, and help with difficult topics.</p>
          <p className="font-semibold">
            But what Response Integrity is really delivering is conditioned response inside the topics that currently break the
            student.
          </p>
          <p className="text-muted-foreground">That is why Response Integrity is stronger than ordinary tutoring.</p>
          <p className="text-muted-foreground">Because you are not just helping the child "understand fractions."</p>
          <p className="text-muted-foreground">You are training them to stay calm, start, execute, and remain stable under time and difficulty.</p>
          <p className="text-muted-foreground">Then you do the same in algebra, then word problems, then exponents.</p>
          <p className="text-muted-foreground">Over time, the child changes. Not just their knowledge. Their response.</p>
          <p className="font-semibold">
            Topic Conditioning is the process of using real school topics as arenas to train stable academic response
            through the Response Integrity Operating System.
          </p>
          <p className="text-muted-foreground">It connects:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>the student's actual school topics</li>
            <li>the parent's observed symptoms</li>
            <li>the Specialist's diagnosis</li>
            <li>the OS phases</li>
            <li>the student's transformation</li>
          </ul>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
