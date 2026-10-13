import { useNavigate } from "react-router-dom";
import { DeepDiveCapabilityCheck } from "@/components/training/DeepDiveCapabilityCheck";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowSystemResolvesUncertainty() {
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
              How the System Resolves Uncertainty
            </h1>
            <p className="text-muted-foreground mt-1">under System Intelligence</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="system-intelligence-how-system-resolves-uncertainty-v1"
          title="How the System Resolves Uncertainty"
          completion={<DeepDiveCapabilityCheck assessmentKey="how_the_system_resolves_uncertainty_mastery_v1" />}
        >
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">RI-OS does not force a conclusion from incomplete evidence</h2>
          <p className="text-muted-foreground">
            Reliability depends on knowing when the system should decide and when it should keep the question open.
          </p>
          <p className="font-semibold">
            Missing, contaminated, conflicting, and weak evidence are different states.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Not observed is not weakness</h2>
          <p className="text-muted-foreground">
            Not observed is a narrow evidence-recording status when no qualifying observation exists. It is not a routine student response, and the Specialist does not create one by neglecting the observation.
          </p>
          <p className="text-muted-foreground">
            The Specialist must not choose the closest weak or strong option from hindsight.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Confounded means the behavior cannot be interpreted cleanly</h2>
          <p className="text-muted-foreground">
            A rare visible mathematical cue can compromise independence. For example, the student may consult a worked example showing the method before choosing that method themselves.
          </p>
          <p className="font-semibold">
            Confounded evidence remains truth. It simply does not count as clean strength or weakness for that question.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="The student chooses the correct method after looking at a worked example that already names it. What can the Specialist conclude?"
          options={[
            { key: "a", label: "The student demonstrated independent method selection.", feedback: "The worked example supplied the method before the student chose it." },
            { key: "b", label: "The method choice is confounded because the method was already visible.", feedback: "A concrete mathematical cue compromised the independence claim." },
            { key: "c", label: "The student demonstrated weak method selection.", feedback: "A confound is not proof that the student lacks the method." },
            { key: "d", label: "Record the visible worked-example cue and preserve unrelated clean observations.", feedback: "Evidence meaning is scoped to the affected behaviour and condition." },
            { key: "e", label: "A later explanation makes this original choice independent.", feedback: "Later performance cannot remove the earlier cue." },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d"]}
          truth="A rare visible worked example can confound method independence. It neither changes the prescribed method nor rewrites other clean evidence."
        />
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Conflicting evidence keeps the question open</h2>
          <p className="text-muted-foreground">
            When clean evidence supports a capability in one opportunity and contradicts it in another, the system does not average the conflict into a convenient label.
          </p>
          <p className="text-muted-foreground">
            It asks the smallest comparable confirmation question still allowed by the evidence rules.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Earlier layers have priority</h2>
          <p className="text-muted-foreground">
            A higher-pressure result cannot be interpreted safely while an earlier required layer remains unresolved.
          </p>
          <p className="text-muted-foreground">
            RI-OS strips constraints and resolves the earlier layer first. That prevents every difficult or timed failure from being mislabeled as Controlled Discomfort or Time Pressure Stability.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Example</p>
          <h2 className="text-2xl font-bold">The timer is present, but the broken behavior is structure</h2>
          <p className="text-muted-foreground">
            A student working in Time Pressure Stability starts a timed problem but loses the required step order halfway through.
          </p>
          <p className="text-muted-foreground">
            The timer does not automatically make this a Time Pressure Stability breakdown. RI-OS must remove the timer and see whether the earlier execution layer returns under a comparable untimed condition.
          </p>
          <p className="font-semibold">
            The condition tells the system where the breakdown appeared. The evidence determines which layer owns it.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Training can trigger a prerequisite check without moving the topic backward</h2>
          <p className="text-muted-foreground">
            If current-phase Training exposes a breakdown that may actually come from an earlier prerequisite, RI-OS can remove the active pressure and check that earlier layer directly.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>If the prerequisite holds, the breakdown stays owned by the current phase.</li>
            <li>If it is contradicted, ordinary Training freezes and targeted re-diagnosis re-establishes the earlier layer.</li>
            <li>If it is not observed or becomes confounded, RI-OS requires re-diagnosis rather than guessing.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Example</p>
          <h2 className="text-2xl font-bold">A timed breakdown triggers an untimed prerequisite check</h2>
          <p className="text-muted-foreground">
            A student in Time Pressure Stability breaks down during a clean timed opportunity. The runner removes the timer and presents one comparable problem with no coaching or rescue.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>If structure and independent execution return, the original breakdown remains owned by Time Pressure Stability.</li>
            <li>If structure still breaks, ordinary Training pauses and targeted re-diagnosis begins from Structured Execution.</li>
            <li>If the prerequisite check is not observed or becomes confounded, RI-OS requires re-diagnosis rather than inventing a conclusion.</li>
          </ul>
          <p className="font-semibold">
            Training can detect that the prior state is no longer trustworthy. Diagnosis still determines the new placement.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Handover uses the same evidence discipline</h2>
          <p className="text-muted-foreground">
            Handover does not re-place a student because a Specialist changed. It tests whether the inherited state is still trustworthy.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Clean Handover evidence can support keeping the inherited state.</li>
            <li>A genuinely unresolved claim, including an exceptional visible worked-example cue, can require another clean comparable Handover opportunity.</li>
            <li>A confirmed breakdown in a behavior that defines the phase requires targeted re-diagnosis.</li>
            <li>Persistent conditional evidence can adjust stability within the same phase when the limited Handover check ends.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="In Handover, the student begins independently but glances at an old worked solution before completing later steps. May the Specialist call the entire execution independent?"
          options={[
            { key: "a", label: "Yes, because the inherited topic state was strong.", feedback: "An inherited claim cannot erase a reference cue in a new opportunity." },
            { key: "b", label: "No. Record the later continuation as confounded and follow the system's next qualifying check.", feedback: "Reference-assisted steps cannot prove independent continuation." },
            { key: "c", label: "Yes, because the method order remained correct.", feedback: "Correct order after seeing a model does not prove independent execution." },
            { key: "d", label: "Preserve the clean start separately and record the visible later cue.", feedback: "The earlier clean response retains its actual evidence." },
            { key: "e", label: "Mark the whole response as breakdown because a reference was used.", feedback: "A confound is not a clean capability breakdown." },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d"]}
          truth="Handover preserves the observed start and the later reference cue separately; RI-OS decides whether another clean comparable check is necessary."
        />
        <Card className="p-6 space-y-4">
          <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Example</p>
          <h2 className="text-2xl font-bold">Handover preserves what was proved when a later reference cue appears</h2>
          <p className="text-muted-foreground">
            A replacement Specialist inherits Structured Execution. The student begins independently but later consults an old worked example showing the required method while completing the middle steps.
          </p>
          <p className="text-muted-foreground">
            RI-OS preserves the earlier clean start, records the visible reference, and treats the affected continuation as confounded. It can request another comparable opportunity instead of treating reference-aided work as independent.
          </p>
          <p className="font-semibold">
            Handover closes from sufficient evidence, not from filling every field with a convenient answer.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Another opportunity is not extra practice</h2>
          <p className="text-muted-foreground">
            When RI-OS opens another opportunity, it is answering an unresolved evidence question under a defined comparable condition.
          </p>
          <p className="font-semibold">
            Do not teach forward between opportunities, chase a preferred result, or change the condition to make the evidence look cleaner.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When the system blocks, the correct action is to preserve the block</h2>
          <p className="text-muted-foreground">
            If clean evidence is exhausted, the required timing baseline is missing, or an earlier layer remains unresolved, RI-OS can stop normal progression and open evidence review or targeted re-diagnosis.
          </p>
          <p className="font-semibold">
            A blocked state is not a product failure to work around. It is the system refusing to make a claim it cannot defend.
          </p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
