import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const operatingRules = [
  "Intro is topic-entry placement, not a training lesson.",
  "Diagnosis is evidence-complete, not rep-complete.",
  "Every opportunity exists to answer a named evidence question.",
  "The Specialist records concrete observed behavior; they do not choose a score, phase, stability, or next probe.",
  "A higher-constraint failure does not automatically prove an earlier capability failed.",
  "Teaching, correction, rescue, or first-step confirmation cannot determine clean baseline placement.",
  "Diagnosis may place Low, Medium, or High. High Maintenance remains training-earned.",
];

const specialistResponsibilities = [
  "Start from the selected topic and the available starting signal.",
  "Present the exact system-selected probe under its stated constraints.",
  "Record what actually happened for every exposed response dimension.",
  "Use not-observed when the opportunity did not fairly expose a behavior.",
  "Use confounded when intervention, content exposure, task design, or another condition prevents clean interpretation.",
  "Record intervention separately from the student's behavior.",
  "Submit the observation faithfully and follow the next evidence question produced from that evidence.",
];

const systemResponsibilities = [
  "Select the first probe from the starting signal, or use a neutral independent baseline when no trustworthy signal exists.",
  "Interpret concrete behavior into evidence state without asking the Specialist to select Weak, Partial, Clear, Low, Medium, High, or a score.",
  "Decide whether placement is complete, another named probe is needed, or the evidence must remain blocked rather than guessed.",
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
      "Preserved honestly, but excluded from baseline placement evidence. The engine must request clean evidence instead of crediting the post-support response as independent capability.",
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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
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
            evidence-complete diagnosis engine resolves the placement from what the
            student actually does.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Core Law: Evidence-Complete, Not Rep-Complete</h2>
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
                The engine selects the smallest next probe needed to resolve that question.
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
            <li>the scheduled Intro context and student/topic lineage</li>
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
          <h2 className="text-2xl font-bold">The Response Stack</h2>
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
          <h2 className="text-2xl font-bold">Higher-Constraint Evidence and Constraint Stripping</h2>
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
            The Specialist does not select Weak, Partial, Clear, Low, Medium, High, or a
            numeric score. The Specialist answers one question: <span className="font-medium text-foreground">what actually happened?</span>
          </p>
          <p className="text-muted-foreground">
            Each exposed dimension presents concrete behavior choices. These include
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
          <h2 className="text-2xl font-bold">How Starting Stability Is Derived</h2>
          <p className="text-muted-foreground">
            Diagnosis stability is categorical, not score-band driven. Numeric compatibility
            fields may exist for technical lineage, but they do not own the decision.
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
            confounded evidence. The engine should remain unresolved rather than invent a
            response-conditioning placement from unavailable content.
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
            The reason for the decision is the student's evidence. The engine exists to
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
            manages topic switching; the diagnosis engine resolves each topic independently.
          </p>
        </Card>

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
              the exact dimension and concrete behavior label that created the entry state.
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
          <h2 className="text-2xl font-bold">Durable Evidence and Resume Integrity</h2>
          <p className="text-muted-foreground">
            The diagnosis path is durable. The server validates the expected probe sequence,
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
            <li>Do not use the retired fixed phase-block score bands to decide movement.</li>
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
      </div>
    </div>
  );
}
