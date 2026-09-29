import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeepDiveLessonRunner } from "@/components/training/DeepDiveLessonRunner";

const setupVisualSrc = "/images/responseconditioning/tools-required/modelling-vs-observation-locked.png";

export default function ResponseConditioningHowToModel() {
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
                How to Model
              </h1>
              <p className="text-muted-foreground mt-1">under Execution Standards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <DeepDiveLessonRunner
          lessonKey="how-to-model-piecewise-v1"
          title="How to Model"
          completion={null}
        >
        {/* What Modeling Is */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Modeling Is</h2>
          <p className="text-muted-foreground">Modeling is when you:</p>
          <p className="font-medium">demonstrate a problem in a way that can be copied exactly</p>
          <p className="text-muted-foreground">The goal is not understanding.</p>
          <p className="text-muted-foreground">The goal is:</p>
          <p className="font-medium text-lg">replication</p>
        </Card>

        {/* Live Modelling Setup */}
        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">What Modelling Looks Like Live</h2>
            <p className="text-muted-foreground">
              Modelling is a visible demonstration condition. In the Clarity Modelling set, the camera and mini ring light face the work so the student can see the method being executed while the Specialist writes and explains.
            </p>
          </div>
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-[16/25] overflow-hidden">
              <img
                src={setupVisualSrc}
                alt="Response Integrity live Modelling setup with camera and light facing the Specialist's work"
                className="absolute inset-y-0 left-0 h-full w-auto max-w-none"
              />
            </div>
          </div>
        </Card>

        {/* What You Are Creating */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What You Are Creating</h2>
          <p className="text-muted-foreground">When you model, you are building:</p>
          <ul className="space-y-2 pl-4">
            <li className="font-medium">a reference</li>
            <li className="font-medium">a pattern</li>
            <li className="font-medium">a system the student can follow</li>
          </ul>
          <p className="text-muted-foreground">If the student cannot copy your process:</p>
          <p className="font-semibold text-destructive">your model failed</p>
        </Card>

        {/* The Structure */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Structure</h2>
          <p className="text-muted-foreground">Every model must follow:</p>
          <p className="text-xl font-bold text-primary">Vocabulary, Method, and Reason</p>
          <p className="text-muted-foreground">No skipping.</p>
          <p className="text-muted-foreground">No mixing.</p>
        </Card>

        {/* Layer 1: Vocabulary */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">1. Vocabulary (Name What Exists)</h2>
          <p className="text-muted-foreground">You identify and name everything.</p>

          <div>
            <p className="font-semibold mb-2">What You Do</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>name the problem type</li>
              <li>name the components</li>
              <li>use correct terms</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">Example</p>
            <p className="text-muted-foreground">"This is a quadratic equation."</p>
            <p className="text-muted-foreground">"This is the coefficient."</p>
            <p className="text-muted-foreground">"This is the constant."</p>
          </div>

          <div className="bg-muted rounded p-3">
            <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
            <p className="text-muted-foreground">The student must know what they are looking at before doing anything.</p>
          </div>
        </Card>

        {/* Layer 2: Method */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">2. Method (Show the Steps)</h2>
          <p className="text-muted-foreground">You execute the full sequence.</p>

          <div>
            <p className="font-semibold mb-2">What You Do</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>show each step</li>
              <li>follow correct order</li>
              <li>make the process visible</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">Example</p>
            <p className="text-muted-foreground">"Step 1: Factor."</p>
            <p className="text-muted-foreground">"Step 2: Set each factor equal to zero."</p>
            <p className="text-muted-foreground">"Step 3: Solve."</p>
          </div>

          <div className="bg-muted rounded p-3">
            <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
            <p className="text-muted-foreground">Same problem type = same steps.</p>
            <p className="text-muted-foreground">No improvisation.</p>
          </div>
        </Card>

        {/* Layer 3: Reason */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">3. Reason (Explain Why It Works)</h2>
          <p className="text-muted-foreground">You anchor each step to a law.</p>

          <div>
            <p className="font-semibold mb-2">What You Do</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>explain why the step is valid</li>
              <li>name the rule or principle</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">Example</p>
            <p className="text-muted-foreground">"This works because of the zero product property."</p>
          </div>

          <div className="bg-muted rounded p-3">
            <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
            <p className="text-muted-foreground">Students must know why the method is valid, not just what to do.</p>
          </div>
        </Card>

        {/* Delivery Rules */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">Delivery Rules</h2>

          <div className="space-y-2">
            <p className="font-semibold">1. Keep It Linear</p>
            <p className="text-muted-foreground">Do not jump between layers.</p>
            <p className="text-muted-foreground">Do not mix explanation randomly.</p>
            <p className="text-muted-foreground">Follow: Vocabulary, Method, and Reason</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">2. No Over-Talking</p>
            <p className="text-muted-foreground">Say only what is necessary.</p>
            <p className="text-muted-foreground">Do not:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>repeat excessively</li>
              <li>add extra examples</li>
              <li>drift into storytelling</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">3. No Skipping Steps</p>
            <p className="text-muted-foreground">Even if it feels obvious.</p>
            <p className="text-muted-foreground">If you skip:</p>
            <p className="font-medium">the student will skip</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">4. Write Everything Clearly</p>
            <p className="text-muted-foreground">Your working must be:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>visible</li>
              <li>structured</li>
              <li>readable</li>
            </ul>
            <p className="text-muted-foreground">The student should be able to:</p>
            <p className="font-medium">copy exactly what you wrote</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">5. Do Not Ask While Modeling</p>
            <p className="text-muted-foreground">Modeling is not interactive.</p>
            <p className="text-muted-foreground">You are showing.</p>
            <p className="text-muted-foreground">Not testing.</p>
          </div>
        </Card>

        {/* Observation Boundary */}
        <Card className="p-6 space-y-5 border-primary/30 bg-primary/5">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Know When Modelling Ends</h2>
            <p className="text-muted-foreground">
              The Modelling camera position is not the standing delivery mode for RI-OS. In the phases after Clarity, the phone moves upright into Observation mode. The student executes while the Specialist observes the response and records what actually happens on the laptop.
            </p>
            <p className="font-medium">
              Showing the work and observing the student's work are different operating conditions. Do not carry demonstration behaviour into an observation condition.
            </p>
          </div>
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-[16/25] overflow-hidden">
              <img
                src={setupVisualSrc}
                alt="Response Integrity live Observation setup with the phone upright in selfie mode while the Specialist observes"
                className="absolute inset-y-0 right-0 h-full w-auto max-w-none"
              />
            </div>
          </div>
        </Card>

        {/* What Not to Do */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Not to Do</h2>

          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-2 font-semibold"><X className="h-4 w-4 shrink-0 text-destructive" />"Do you understand?"</p>
              <p className="text-muted-foreground">Irrelevant. They haven't executed yet.</p>
            </div>

            <div>
              <p className="flex items-center gap-2 font-semibold"><X className="h-4 w-4 shrink-0 text-destructive" />Explaining Without Structure</p>
              <p className="text-muted-foreground">Talking without clear steps.</p>
            </div>

            <div>
              <p className="flex items-center gap-2 font-semibold"><X className="h-4 w-4 shrink-0 text-destructive" />Skipping Vocabulary</p>
              <p className="text-muted-foreground">Using informal language: "that thing," "this part."</p>
            </div>

            <div>
              <p className="flex items-center gap-2 font-semibold"><X className="h-4 w-4 shrink-0 text-destructive" />Mixing Layers</p>
              <p className="text-muted-foreground">Explaining method before naming terms.</p>
            </div>

            <div>
              <p className="flex items-center gap-2 font-semibold"><X className="h-4 w-4 shrink-0 text-destructive" />Over-Simplifying</p>
              <p className="text-muted-foreground">Removing structure to make it "easier."</p>
              <p className="text-muted-foreground">This creates fragility later.</p>
            </div>
          </div>
        </Card>

        {/* The Test of a Good Model */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Test of a Good Model</h2>
          <p className="text-muted-foreground">After modeling, the student should be able to:</p>
          <ul className="space-y-2 pl-4">
            <li className="font-medium">name what they see</li>
            <li className="font-medium">repeat the steps</li>
            <li className="font-medium">explain why the steps work</li>
          </ul>
          <p className="text-muted-foreground">If not:</p>
          <p className="font-semibold text-destructive">the model was unclear</p>
        </Card>

        {/* The Purpose of Modeling */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Purpose of Modeling</h2>
          <p className="text-muted-foreground">Modeling is not teaching for understanding.</p>
          <p className="text-muted-foreground">It is:</p>
          <p className="font-medium">building a system the student can execute under pressure</p>
        </Card>

        {/* Modelling vs Observation */}
        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Modelling and Observation Are Different Modes</h2>
            <p className="text-muted-foreground">
              The same delivery setup serves two different purposes. Modelling makes the Specialist's execution visible. Observation keeps the student executing while the Specialist watches, records, and intervenes only when the active drill condition requires it.
            </p>
            <p className="font-medium">
              Camera position is part of the operating condition, not a cosmetic preference.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-[17/10] w-full overflow-hidden">
              <img
                src={setupVisualSrc}
                alt="Response Integrity comparison of live Modelling and Observation setups"
                className="absolute inset-0 h-full w-full object-cover object-[center_10%]"
              />
            </div>
          </div>
        </Card>

        {/* Final Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="text-muted-foreground">If your model cannot be:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>copied</li>
            <li>repeated</li>
            <li>followed step-by-step</li>
          </ul>
          <p className="text-muted-foreground">Then:</p>
          <p className="font-semibold">you did not model. You explained.</p>
          <p className="text-muted-foreground">And Response Integrity does not rely on explanation.</p>
          <p className="text-muted-foreground">It relies on:</p>
          <p className="font-bold text-lg">clear, repeatable structure</p>
        </Card>
        </DeepDiveLessonRunner>
      </div>
    </div>
  );
}
