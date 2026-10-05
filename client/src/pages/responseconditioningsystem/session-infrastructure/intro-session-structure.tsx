import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { SESSION_INFRASTRUCTURE_TEACHING } from "@/lib/sessionInfrastructureTeaching";
import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const operatingRules = [
  "Intro is topic-entry placement, not a training lesson.",
  "Diagnosis stops when the evidence question is resolved, not after a fixed rep count.",
  "Every opportunity exists to answer a named evidence question.",
  "The Specialist records concrete observed behavior; they do not choose the phase, stability, or next check.",
  "A higher-constraint failure does not automatically prove an earlier capability failed.",
  "Teaching, correction, rescue, or first-step confirmation cannot determine clean baseline placement.",
  "Diagnosis may place Low, Medium, or High. High Maintenance remains training-earned.",
];

const specialistResponsibilities = [
  "Start from the selected topic and the available starting signal.",
  "Prepare the system-selected problem or example, but keep it hidden until Begin Opportunity.",
  "Follow only the words and actions the runner shows for that check.",
  "Watch the complete student response before opening the observation runner.",
  "Click Student Finished at actual completion, then record the observations one at a time.",
  "Record only what the opportunity actually exposed. Do not use a retrospective walk-through to fill missing live evidence.",
  "Use not-observed when the opportunity did not fairly expose a behavior.",
  "Use confounded when intervention, content exposure, task design, or another condition prevents clean interpretation.",
  "Record intervention separately from the student's behavior.",
  "Submit the observation faithfully and follow the next evidence question produced from that evidence.",
];

const opportunityExecutionFlow = [
  {
    stage: "Ready",
    rule: "Prepare the problem or example and keep it hidden. Read the exact allowed script before exposing anything to the student.",
  },
  {
    stage: "Observe",
    rule: "Click Begin Opportunity, immediately reveal the prepared problem or example, follow the exact wording shown, and watch the whole response.",
  },
  {
    stage: "Student Finished",
    rule: "Close the response boundary at actual completion before any evidence administration begins.",
  },
  {
    stage: "Record",
    rule: "Record the exposed behaviors one at a time. Missing behavior stays not-observed; hindsight is not live evidence.",
  },
  {
    stage: "Confirm",
    rule: "Record intervention or contamination honestly and submit the opportunity. RI-OS decides whether another check is needed.",
  },
];

const systemResponsibilities = [
  "Select the first check from the starting signal, or use a neutral independent baseline when no trustworthy signal exists.",
  "Interpret concrete behavior into evidence state without asking the Specialist to select Weak, Partial, Clear, Low, Medium, or High.",
  "Decide whether placement is complete, another specific check is needed, or the evidence must remain unresolved rather than guessed.",
  "Strip constraints when a higher-condition breakdown does not reveal which earlier layer actually failed.",
  "Require additional opportunities only when repeatability, recovery, consistency, contamination, or conflicting evidence genuinely remains unresolved.",
  "Derive the final topic entry phase and starting stability from clean evidence.",
  "Persist the evidence path so the final placement can explain why each opportunity ran and why diagnosis stopped.",
];

const stabilityMeanings = [
  {
    label: "Low",
    meaning:
      "The phase-defining capability is substantially absent or breaks at meaningful exposure.",
  },
  {
    label: "Medium",
    meaning:
      "The capability exists, but is conditional, inconsistent, dependent, or materially unstable.",
  },
  {
    label: "High",
    meaning:
      "The capability is substantially present and usable, but minor instability or insufficient confirmation prevents it from being considered sustained.",
  },
  {
    label: "High Maintenance",
    meaning:
      "Training-earned state only. Diagnosis does not mint High Maintenance.",
  },
];

const contaminationExamples = [
  {
    label: "No intervention",
    meaning: "Clean baseline evidence when the task itself was valid.",
  },
  {
    label: "Neutral clarification",
    meaning:
      "May remain clean when wording is clarified without supplying mathematical content, a method, a step, or an answer.",
  },
  {
    label: "First-step confirmation",
    meaning:
      "Preserved for audit, but the opportunity cannot determine clean baseline placement.",
  },
  {
    label: "Teaching, correction, or rescue",
    meaning:
      "Preserved honestly, but excluded from baseline placement evidence. RI-OS must request clean evidence instead of treating the post-support response as independent capability.",
  },
];

export default function ResponseConditioningIntroSessionStructure() {
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

          <div className="flex items-start gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                Intro Session Structure
              </h1>
              <p className="text-muted-foreground mt-1">under Session Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="intro-session-structure-v4"
          title="Intro Session Structure"
          completion={<DeepDiveCapabilityCheck assessmentKey="intro_session_structure_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-2 border-primary/20 bg-primary/5">
          <h2 className="text-2xl font-bold">What Intro Is</h2>
          <p className="text-muted-foreground">
            Intro is the topic-entry placement session. Its job is to establish where
            active conditioning should begin for a selected topic before normal Training
            starts.
          </p>
          <p className="font-medium">The governing question is:</p>
          <p className="text-lg font-semibold">
            Where does this student's response first become unsupported in this topic?
          </p>
          <p className="text-muted-foreground">
            Intro is diagnostic, not a teaching cycle. The Specialist observes. The
            Diagnosis resolves the placement from what the
            student actually does.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Core Law: Stop When the Evidence Question Is Resolved</h2>
          <p className="text-muted-foreground">
            Intro does not require a fixed number of reps or one complete phase block
            before the system is allowed to decide. Every diagnostic opportunity exists
            because there is a specific unanswered evidence question.
          </p>
          <div className="space-y-3">
            <div className="rounded-xl border p-4">
              <p className="font-semibold">If placement is sufficiently determined</p>
              <p className="text-sm text-muted-foreground">
                Diagnosis stops. No fake extra reps are created just to fill a template.
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-semibold">If a specific evidence question remains</p>
              <p className="text-sm text-muted-foreground">
                RI-OS selects the smallest next check needed to resolve that question.
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-semibold">If the evidence is contaminated or still irreconcilable</p>
              <p className="text-sm text-muted-foreground">
                The system does not guess. It requests clean evidence where possible or
                blocks placement for review when the permitted diagnostic path is exhausted.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Comes Into Intro</h2>
          <ul className="space-y-2 pl-5 list-disc text-muted-foreground">
            <li>a selected real mathematical topic</li>
            <li>any trustworthy starting signal already associated with that topic</li>
            <li>the scheduled Intro session and the student's existing topic history</li>
          </ul>
          <p className="font-medium">
            A starting signal chooses the first question. It does not decide the placement.
          </p>
          <p className="text-sm text-muted-foreground">
            If no trustworthy starting signal exists, the diagnosis begins from a neutral
            independent baseline rather than assuming Clarity. This is normal independent
            work with no added difficulty or time pressure, so the same opportunity can
            directly observe both Clarity and Structured Execution where those behaviors are
            meaningfully exposed. The student's observed behavior then determines whether the
            system stops, strips constraints, or escalates.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Entry Placement Connects to the Phases</h2>
          <p className="text-muted-foreground">
            Entry placement is the phase where Training should begin for this topic.
            Diagnosis looks for the earliest response capability that clean evidence
            shows is not yet sufficiently supported. The four phases describe what
            that capability is.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Clarity", "Can the student identify the problem, method, reason, and usable mental map?"],
              ["Structured Execution", "Can the student start and execute the known method independently, in order, and repeatably?"],
              ["Controlled Discomfort", "Does that response remain usable when difficulty or uncertainty increases?"],
              ["Time Pressure Stability", "Does the trained structure remain intact when urgency is introduced?"],
            ].map(([phase, meaning]) => (
              <div key={phase} className="rounded-xl border p-4">
                <p className="font-semibold">{phase}</p>
                <p className="mt-1 text-sm text-muted-foreground">{meaning}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            A single response may provide valid evidence across several layers when those
            behaviors were actually observed. The phases remain the Training architecture
            and final placement language; they are not artificial walls that force four
            separate mini-diagnoses.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Example: Entry at Clarity</h2>
          <p className="text-muted-foreground">
            The selected topic is linear equations, which the student has already
            learned. With no trustworthy starting signal, RI-OS begins with normal
            independent work, without added difficulty or time pressure.
          </p>
          <p className="text-muted-foreground">
            On a problem such as 3x + 5 = 20, the clean observations show that the
            student does not recognise how to isolate x. They choose operations
            without a usable method or reason. These are symptoms of a Clarity
            breakdown: the student does not yet have a reliable map of what to do.
          </p>
          <p className="font-semibold">
            When that breakdown is sufficiently established, RI-OS places this topic
            at Clarity. Training begins by building the missing understanding.
          </p>
          <p className="text-sm text-muted-foreground">
            If the content has never been learned, or the opportunity did not expose
            the student's understanding, that is not proof of a Clarity breakdown.
            Diagnosis keeps the evidence question unresolved.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Example: Entry at Structured Execution</h2>
          <p className="text-muted-foreground">
            For the same topic, clean evidence now supports Clarity. The student
            recognises the equation and understands why they must subtract 5 and
            then divide by 3 to isolate x.
          </p>
          <p className="text-muted-foreground">
            During independent work, however, they correctly reach 3x = 15 and then
            stop, unable to carry out the known next step without a cue. Further clean
            evidence, where needed,
            establishes that independent execution is not repeatable. Knowing the
            method and executing it independently are different capabilities.
          </p>
          <p className="font-semibold">
            RI-OS places this topic at Structured Execution because understanding is
            supported, but independent execution is not. Training begins with
            establishing a reliable sequence the student can carry through alone.
          </p>
          <p className="text-sm text-muted-foreground">
            Completing the problem after the Specialist supplies a step does not
            prove independent execution. That intervention is recorded separately.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Example: Entry at Controlled Discomfort</h2>
          <p className="text-muted-foreground">
            Clean evidence supports both understanding and repeatable independent
            execution of ordinary linear equations. RI-OS then selects a check that
            introduces difficulty or uncertainty, without adding time pressure.
          </p>
          <p className="text-muted-foreground">
            On 2(x + 3) = 18, using brackets the student has already learned, they
            correctly write 2x + 6 = 18. Then uncertainty makes them cross out their
            working and wait for reassurance instead of continuing with their known
            method. Diagnosis removes the added difficulty where needed
            to check whether the earlier capabilities remain intact.
          </p>
          <p className="font-semibold">
            If the clean evidence confirms that the breakdown is under difficulty
            while the earlier capabilities remain supported, RI-OS places this topic
            at Controlled Discomfort. Training begins with keeping the response
            usable when the work feels difficult or uncertain.
          </p>
          <p className="text-sm text-muted-foreground">
            A harder problem going wrong does not, by itself, prove this placement.
            Diagnosis must establish which capability actually broke.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Example: Entry at Time Pressure Stability</h2>
          <p className="text-muted-foreground">
            Clean evidence supports understanding, independent execution and a usable
            response under difficulty. The system then introduces urgency under the
            required timing conditions.
          </p>
          <p className="text-muted-foreground">
            Under urgency, the student correctly reaches 3x = 15 but rushes to
            x = 15, skipping the division they reliably perform without pressure.
            When urgency is removed,
            clean evidence confirms that the earlier capabilities remain intact.
            The symptoms point to keeping the trained response stable under time pressure.
          </p>
          <p className="font-semibold">
            Once that evidence question is resolved, RI-OS places this topic at Time
            Pressure Stability. Training begins with preserving structure and
            completion under urgency.
          </p>
          <p className="text-sm text-muted-foreground">
            These examples explain the evidence behind placement; they are not four
            compulsory tests or a fixed rep sequence. A starting signal chooses
            where diagnosis looks first. Observed behavior determines the next check
            and final placement. The Specialist records the behavior; RI-OS resolves
            the phase and starting stability for this topic, not for the student as a whole.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When Higher Pressure Must Be Removed</h2>
          <p className="text-muted-foreground">
            Strong behavior under a higher constraint may support earlier layers when the
            earlier behaviors were directly observed. Failure under a higher constraint does
            not automatically prove the earlier layers failed.
          </p>
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Typical diagnostic isolation path</p>
            <p className="mt-2">timed + difficult + independent</p>
            <p>→ remove the timer</p>
            <p>difficult + independent</p>
            <p>→ remove difficulty</p>
            <p>normal + independent</p>
            <p>→ remove execution demand if necessary</p>
            <p>recognition / explanation</p>
          </div>
          <p className="text-sm text-muted-foreground">
            This is not the student being moved backward through Training. It is the system
            removing conditions until the earliest unsupported or unresolved response layer
            can be identified cleanly.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What the Specialist Actually Records</h2>
          <p className="text-muted-foreground">
            The Specialist does not translate the response into Weak, Partial, Clear, Low,
            Medium, High, a phase, or a next action. The Specialist answers one question: <span className="font-medium text-foreground">what actually happened?</span>
          </p>
          <p className="text-muted-foreground">
            Each behavior RI-OS asks you to observe presents concrete choices. These include
            decision-relevant breakdown, conditional, near-stable, and supported behavior,
            plus two critical escape states:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="font-semibold">Not observed</p>
              <p className="text-sm text-muted-foreground">
                The opportunity did not fairly expose that behavior. Missing evidence must
                not be converted into weakness.
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-semibold">Confounded</p>
              <p className="text-sm text-muted-foreground">
                Assistance, content exposure, task design, or another condition prevents a
                clean interpretation.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Intervention Is Recorded Separately</h2>
          <p className="text-muted-foreground">
            Student behavior and Specialist intervention are separate evidence facts.
            Record both honestly.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {contaminationExamples.map((item) => (
              <div key={item.label} className="rounded-xl border p-4">
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
              </div>
            ))}
          </div>
          <p className="font-semibold">
            A successful response after teaching or first-step confirmation is not clean
            baseline proof of what the student could do independently before that support.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Repetition Has a Reason</h2>
          <p className="text-muted-foreground">
            Repetition is a diagnostic instrument, not a ritual. Another opportunity is
            justified only when the remaining evidence question itself requires comparison
            across time or another clean exposure.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>independent execution repeatability</li>
            <li>difficulty tolerance or recovery</li>
            <li>timed structure consistency</li>
            <li>timed completion consistency</li>
            <li>conflicting first observations</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            One decisive clean breakdown can sometimes be enough to place a topic when the
            earlier layers are already supported. One strong response cannot prove a
            capability whose definition requires repeatability or consistency.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How Starting Stability Is Decided</h2>
          <p className="text-muted-foreground">
            Diagnosis stability is decided from the decisive clean behavior inside the entry
            phase. The Specialist records what happened; RI-OS determines the
            starting stability.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {stabilityMeanings.map((item) => (
              <div key={item.label} className="rounded-xl border p-4">
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Clean breakdown behavior maps to Low. Conditional behavior maps to Medium.
            Near-stable behavior maps to High. If all four layers are fully supported,
            diagnosis still ends at Time Pressure Stability / High because High Maintenance
            must be earned later through Training.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Content Exposure Must Be Protected</h2>
          <p className="text-muted-foreground">
            A student must not be labelled as having a Clarity breakdown merely because the
            underlying mathematical content has never been learned or was not meaningfully
            available to them.
          </p>
          <p className="text-sm text-muted-foreground">
            When content exposure makes the response uninterpretable, record not-observed or
            confounded evidence. RI-OS should keep the question unresolved rather than invent a
            response-conditioning placement from unavailable content.
          </p>
        </Card>

        <Card className="p-6 space-y-4 border-2 border-primary/20">
          <h2 className="text-2xl font-bold">One Standard Opportunity Flow</h2>
          <p className="text-muted-foreground">
            Every diagnosis opportunity uses the same execution boundary. The student response
            happens first; evidence administration happens after it.
          </p>
          <div className="space-y-3">
            {opportunityExecutionFlow.map((item, index) => (
              <div key={item.stage} className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {index + 1}. {item.stage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.rule}</p>
              </div>
            ))}
          </div>
          <p className="text-sm font-medium">
            The neutral independent starting problem does not deliberately ask for Vocabulary, Method, or Reason.
            If those behaviors were not naturally exposed, record not-observed and let the system
            select Clarity Recognition when that evidence is still required.
          </p>
          <p className="text-sm text-muted-foreground">
            Clarity Recognition is different because the check deliberately asks for recognition. Ask:
            "What do you see here?", "Which method would you use?", "Why does that method fit?",
            then "Show me how you would start." Do not reuse that prompted first move as evidence
            of a cold Structured Execution start.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Specialist Responsibility</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {specialistResponsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">System Responsibility</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {systemResponsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="font-medium">
            The reason for the decision is the student's evidence. RI-OS exists to
            interpret that evidence consistently and preserve the diagnostic boundary.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Multi-Topic Intro</h2>
          <p className="text-muted-foreground">
            Diagnosis is topic-scoped. One Intro session may diagnose one topic or several,
            but each topic carries its own evidence history and placement.
          </p>
          <p className="text-sm text-muted-foreground">
            Completing one topic does not assign that state to another topic and does not
            require every topic to use the same number of opportunities. The session shell
            manages topic switching; RI-OS resolves each topic independently.
          </p>
        </Card>

        <DeepDiveTeachingInteraction {...SESSION_INFRASTRUCTURE_TEACHING.intro_session_structure[0]} />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What a Completed Intro Must Explain</h2>
          <ol className="space-y-2 pl-5 list-decimal text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Why this phase:</span> the first
              unsupported response layer, with clean support evidence shown for every earlier
              layer that had to clear.
            </li>
            <li>
              <span className="font-medium text-foreground">Why this stability:</span> the
              decisive behavior class that supports Low, Medium, or High.
            </li>
            <li>
              <span className="font-medium text-foreground">What behavior decided it:</span>{" "}
              the exact behavior and concrete observation that created the entry state.
            </li>
            <li>
              <span className="font-medium text-foreground">What happens next:</span> the
              Training action supported by that evidence, without pretending Intro itself
              earned High Maintenance or phase progression.
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">
            A phase name or internal supported flag by itself is not enough explanation.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Diagnosis Timing Contingency</h2>
          <p className="text-muted-foreground">
            When Diagnosis is collecting passive baseline timing for an unresolved placement above Structured Execution, the measurement condition must remain clean. If the timer, device, or session technology fails, that failed attempt is not treated as student weakness and does not create a second chance after weak student performance.
          </p>
          <p className="text-muted-foreground">
            Before an opportunity whose timing may count toward the baseline begins, keep one fresh equivalent reserve problem available for that same evidence question. Only a genuine technical failure may leave the attempt unresolved and allow that reserve problem to be used under the same no-pressure condition.
          </p>
          <p className="font-semibold">
            Never reuse the exposed problem or improvise a replacement. If no clean reserve exists, leave the evidence question unresolved and return when the condition can be prepared properly.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Durable Evidence and Resume Integrity</h2>
          <p className="text-muted-foreground">
            The diagnosis path is durable. RI-OS validates the expected sequence of checks,
            persists partial runs, independently recomputes the decision, and finalizes the
            same topic placement from the submitted evidence history.
          </p>
          <p className="text-sm text-muted-foreground">
            If a downstream finalization step fails after the evidence history has been
            stored, the run can resume from that durable history instead of creating duplicate
            evidence or restarting the student from zero.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What to Avoid in Intro</h2>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {operatingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
            <li>Do not translate observed behavior into a phase or stability by personal judgment.</li>
            <li>Do not continue testing merely because session time remains.</li>
            <li>Do not invent a missing behavior when the correct record is not-observed or confounded.</li>
            <li>Do not let a strong later-condition result erase a visible earlier-layer break.</li>
            <li>Do not let a high-condition failure condemn earlier layers without isolating the condition that actually broke.</li>
          </ul>
        </Card>

        <Card className="p-6 border-2 border-primary/20 space-y-4">
          <h2 className="text-2xl font-bold">Intro Outcome</h2>
          <p className="font-medium">By the end of diagnosis for a topic, RI should have:</p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            <li>the topic that was diagnosed</li>
            <li>the evidence path that explains every opportunity</li>
            <li>the first unsupported response layer, or clean support across all four layers</li>
            <li>the topic's starting phase</li>
            <li>the topic's starting stability: Low, Medium, or High</li>
            <li>the next Training action supported by that evidence</li>
          </ul>
          <p className="font-semibold">
            Intro ends when the evidence is complete for that topic. Training begins later
            from the state that the evidence supports.
          </p>
        </Card>
        <DeepDiveTeachingInteraction {...SESSION_INFRASTRUCTURE_TEACHING.intro_session_structure[1]} />
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
