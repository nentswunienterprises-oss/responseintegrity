import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Cog className="w-6 h-6 text-primary" />
            </div>
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

        {/* What Modeling Is */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Modeling Is</h2>
          <p className="text-muted-foreground">Modeling is when you:</p>
          <p className="font-medium">demonstrate a problem in a way that can be copied exactly</p>
          <p className="text-muted-foreground">The goal is not understanding.</p>
          <p className="text-muted-foreground">The goal is:</p>
          <p className="font-medium text-lg">replication</p>
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
        <Card className="p-6 space-y-4 border-l-4 border-l-primary">
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
        <Card className="p-6 space-y-4 border-l-4 border-l-primary">
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
        <Card className="p-6 space-y-4 border-l-4 border-l-primary">
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

        {/* What Not to Do */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Not to Do</h2>

          <div className="space-y-4">
            <div>
              <p className="font-semibold">&#10060; "Do you understand?"</p>
              <p className="text-muted-foreground">Irrelevant. They haven't executed yet.</p>
            </div>

            <div>
              <p className="font-semibold">&#10060; Explaining Without Structure</p>
              <p className="text-muted-foreground">Talking without clear steps.</p>
            </div>

            <div>
              <p className="font-semibold">&#10060; Skipping Vocabulary</p>
              <p className="text-muted-foreground">Using informal language: "that thing," "this part."</p>
            </div>

            <div>
              <p className="font-semibold">&#10060; Mixing Layers</p>
              <p className="text-muted-foreground">Explaining method before naming terms.</p>
            </div>

            <div>
              <p className="font-semibold">&#10060; Over-Simplifying</p>
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

      </div>
    </div>
  );
}
