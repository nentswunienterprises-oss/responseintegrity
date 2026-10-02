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
            If the opportunity never meaningfully exposed a behavior, that behavior remains not observed.
          </p>
          <p className="text-muted-foreground">
            The Specialist must not choose the closest weak or strong option from hindsight.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Confounded means the behavior cannot be interpreted cleanly</h2>
          <p className="text-muted-foreground">
            Support, interruption, task mismatch, uncertain exposure, or another condition may make the observed behavior unusable for the intended claim.
          </p>
          <p className="font-semibold">
            Confounded evidence remains truth. It simply does not count as clean strength or weakness for that question.
          </p>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A student receives a first-step cue before the Specialist can see whether they would start independently. Which conclusions are supported?"
          options={[
            {
              key: "a",
              label: "The student demonstrated a weak independent start.",
              feedback: "The cue changed the condition before independent start behavior could be observed cleanly.",
            },
            {
              key: "b",
              label: "Independent start is confounded or not observed, depending on what was actually exposed.",
              feedback: "Do not manufacture weakness from a condition that no longer answered the independent-start question.",
            },
            {
              key: "c",
              label: "The student demonstrated a strong start because they continued successfully after the cue.",
              feedback: "Assisted continuation cannot prove the missing independent start.",
            },
            {
              key: "d",
              label: "The cue belongs in the evidence record because it changed the condition.",
              feedback: "The intervention is part of the truth of what happened.",
            },
            {
              key: "e",
              label: "Later independent work proves that the student would have started independently without the cue.",
              feedback: "Later performance cannot prove the counterfactual first step that was never observed.",
            },
          ]}
          kind="multi_select"
          correctOptionKeys={["b","d"]}
          truth="When support arrives before the target behavior can be observed, preserve the intervention and the observability limit. Do not convert an unseen independent response into strength or weakness."
        />

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Conflicting evidence keeps the question open</h2>
          <p className="text-muted-foreground">
            When clean evidence supports a capability in one opportunity and contradicts it in another, the system does not average the conflict into a convenient label.
          </p>
          <p className="text-muted-foreground">
            It asks the smallest comparable confirmation question still permitted by the evidence contract.
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
          <h2 className="text-2xl font-bold">Training can trigger a prerequisite check without moving the topic backward</h2>
          <p className="text-muted-foreground">
            If current-phase Training exposes a breakdown that may actually come from an earlier prerequisite, the runner can request a stripped-constraint prerequisite sentinel.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>If the prerequisite holds, the breakdown stays owned by the current phase.</li>
            <li>If it is contradicted, ordinary Training freezes and targeted re-diagnosis re-establishes the earlier layer.</li>
            <li>If it is not observed or confounded, the system routes re-diagnosis rather than guessing.</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Handover uses the same evidence discipline</h2>
          <p className="text-muted-foreground">
            Handover does not re-place a student because a Specialist changed. It tests whether the inherited state is still trustworthy.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Clean supported continuity evidence can hold the inherited state.</li>
            <li>Not-observed or confounded dimensions can require another comparable continuity opportunity.</li>
            <li>A confirmed phase-defining breakdown routes targeted re-diagnosis.</li>
            <li>Persistent conditional evidence can produce a bounded same-phase stability adjustment when the verification window closes.</li>
          </ul>
        </Card>

        <DeepDiveTeachingInteraction
          prompt="A continuity opportunity is clean except one dimension was not meaningfully observed. Should the Specialist mark the closest behavior so Handover can finish?"
          options={[
            {
              key: "a",
              label: "Yes. Handover should avoid extra opportunities whenever possible.",
              feedback: "Finishing faster is not more important than preserving evidence truth.",
            },
            {
              key: "b",
              label: "No. Preserve not observed and let the system decide whether another comparable opportunity is required.",
              feedback: "Yes. Missing evidence must stay missing until the system receives enough clean evidence or reaches its bounded route.",
            },
            {
              key: "c",
              label: "Mark it supported if every other dimension was supported.",
              feedback: "Strength in one dimension cannot be copied into another.",
            },
              {
                key: "d",
                label: "No. The missing dimension can remain unresolved while the already observed dimensions keep their own evidence.",
                feedback: "Yes. Dimension-level truth should not be flattened into a forced overall conclusion.",
              },
              {
                key: "e",
                label: "Yes, but only if the inferred value matches the inherited state.",
                feedback: "Matching the inherited state does not make an unobserved behavior observable.",
              },
          ]}
          correctOptionKey="b"
          truth="The system can ask for another opportunity. The Specialist cannot manufacture completeness."
        />

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
            If clean evidence is exhausted, timing authority is missing, or a required layer remains unresolved, RI-OS can stop normal progression and route evidence review or targeted re-diagnosis.
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
