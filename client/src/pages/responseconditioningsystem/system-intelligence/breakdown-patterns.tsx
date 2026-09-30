import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningBreakdownPatterns() {
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
                Breakdown Patterns
              </h1>
              <p className="text-muted-foreground mt-1">under System Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Is</h2>
          <p className="text-muted-foreground">A breakdown pattern is:</p>
          <p className="font-semibold">a repeated way a student fails under difficulty</p>
          <p className="text-muted-foreground">Not random.</p>
          <p className="text-muted-foreground">Not "careless mistakes."</p>
          <p className="font-semibold">Patterns are predictable</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Core Rule</h2>
          <p className="text-lg font-semibold">
            Every breakdown belongs to a layer or a response failure.
          </p>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="text-2xl font-bold">Two Types of Breakdowns</h2>

 <div className="space-y-2">
            <h3 className="text-xl font-bold">1. Cognitive Breakdowns (3-Layer Lens)</h3>
            <p className="text-muted-foreground">Problem with:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>Vocabulary</li>
              <li>Method</li>
              <li>Reason</li>
            </ul>
          </div>

 <div className="space-y-2">
            <h3 className="text-xl font-bold">2. Response Breakdowns (Under Pressure)</h3>
            <p className="text-muted-foreground">Problem with:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>behavior</li>
              <li>reaction</li>
              <li>control</li>
            </ul>
          </div>

          <p className="font-semibold">You must identify which one.</p>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Cognitive Breakdown Patterns</h2>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">1. Vocabulary Breakdown</h3>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>"this thing"</li>
                <li>cannot name components</li>
                <li>mislabels terms</li>
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">The student cannot see the problem clearly</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What Happens Next</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>confusion</li>
                <li>wrong method</li>
                <li>hesitation</li>
              </ul>
            </div>
 <div className="">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
              <p className="font-semibold mt-1">Correct the term directly</p>
              <p className="font-semibold">and return to precise language.</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">2. Method Breakdown</h3>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>skips steps</li>
                <li>wrong order</li>
                <li>"I forgot what to do"</li>
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">No reliable execution system</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What Happens Next</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>guessing</li>
                <li>inconsistency</li>
                <li>errors even on known work</li>
              </ul>
            </div>
 <div className="">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
              <p className="font-semibold mt-1">Return to steps.</p>
              <p className="font-semibold">Enforce sequence.</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">3. Reason Breakdown</h3>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>"because that's what you do"</li>
                <li>cannot explain why</li>
                <li>copies without understanding</li>
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">No logical anchor</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What Happens Next</p>
              <ul className="space-y-1 pl-4 text-muted-foreground mt-2">
                <li>doubt under pressure</li>
                <li>collapse in unfamiliar problems</li>
              </ul>
            </div>
 <div className="">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
              <p className="font-semibold mt-1">Anchor to the governing rule</p>
              <p className="font-semibold">and have the student say it clearly.</p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Response Breakdown Patterns</h2>

          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">4. Freeze</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>long silence</li>
              <li>no movement</li>
              <li>"I don't know"</li>
            </ul>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
            <p className="font-semibold">No starting mechanism under uncertainty</p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
            <p className="font-semibold">Guide to first step only.</p>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">5. Rush</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>fast reading</li>
              <li>careless mistakes</li>
              <li>skipping steps</li>
            </ul>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
            <p className="font-semibold">Panic response becomes speed as escape</p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
            <p className="font-semibold">Slow them down.</p>
            <p className="font-semibold">Return to structure.</p>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">6. Guessing</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>random answers</li>
              <li>trial and error</li>
              <li>no method</li>
            </ul>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
            <p className="font-semibold">No trust in system</p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
            <p className="font-semibold">Re-anchor method.</p>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">7. Help-Seeking Dependence</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>"Can you show me?"</li>
              <li>constant questions</li>
              <li>waiting for tutor</li>
            </ul>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
            <p className="font-semibold">Low independence</p>
            <p className="font-semibold">reliance on external control</p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
            <p className="font-semibold">Do not rescue.</p>
            <p className="font-semibold">Return to first step.</p>
          </Card>

          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">8. Emotional Reaction</h3>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>frustration</li>
              <li>complaints</li>
              <li>negative self-talk</li>
            </ul>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
            <p className="font-semibold">Difficulty is interpreted as threat</p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Action</p>
            <p className="font-semibold">Maintain structure.</p>
            <p className="font-semibold">Do not engage emotionally.</p>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Pattern Recognition Rule</h2>
          <p className="font-medium">Do not treat each mistake as new.</p>
          <p className="font-medium">Ask:</p>
          <p className="text-lg font-semibold">"Have I seen this before?"</p>
          <p className="font-medium">If yes:</p>
          <p className="text-lg font-semibold">it is a pattern</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What NOT to Do</h2>
          <div className="space-y-3">
 <div className="space-y-1">
              <p className="font-semibold">&#10060; "Careless mistake"</p>
              <p className="text-muted-foreground">This diagnosis misses the actual failure point.</p>
            </div>
 <div className="space-y-1">
              <p className="font-semibold">&#10060; Re-explain everything</p>
              <p className="text-muted-foreground">Misses the actual failure point.</p>
            </div>
 <div className="space-y-1">
              <p className="font-semibold">&#10060; Ignore repetition</p>
              <p className="text-muted-foreground">Pattern continues.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Correct Response</h2>
          <ul className="space-y-1 pl-4">
            <li>Step 1: Identify pattern</li>
            <li>Step 2: Link to layer or response</li>
            <li>Step 3: Apply targeted correction</li>
            <li>Step 4: Observe if pattern changes</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Mastery Looks Like</h2>
          <p className="font-medium">Tutor sees instantly:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>what failed</li>
            <li>why it failed</li>
            <li>what to fix</li>
          </ul>
          <p className="text-lg font-semibold">No guessing.</p>
        </Card>

        <Card className="p-6 border-2 border-primary/20 space-y-3">
          <h2 className="text-2xl font-bold">The Real Skill</h2>
          <p className="font-medium">This is not teaching.</p>
          <p className="font-medium">This is:</p>
          <p className="text-lg font-semibold">diagnosis under observation</p>
        </Card>
      </div>
    </div>
  );
}
