import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningBeforeVsAfter() {
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
                Before vs After
              </h1>
              <p className="text-muted-foreground mt-1">under System Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Is</h2>
          <p className="font-medium">This is:</p>
          <p className="text-lg font-semibold">the observable difference created by Response Integrity</p>
          <p className="text-muted-foreground">Not marks.</p>
          <p className="text-muted-foreground">Not effort.</p>
          <p className="font-semibold">behavior under difficulty</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Core Principle</h2>
          <p className="font-medium">We are not changing:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>intelligence</li>
            <li>personality</li>
          </ul>
          <p className="font-medium">We are changing:</p>
          <p className="text-lg font-semibold">
            how the student behaves when they don't know what to do
          </p>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">The Comparison</h2>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">1. When They See a Question</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>stares</li>
                  <li>confused</li>
                  <li>"I don't know what this is"</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>reads fully</li>
                  <li>identifies type</li>
                  <li>names components</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Confusion to Orientation</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">2. When They Start</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>long hesitation</li>
                  <li>waiting</li>
                  <li>asks for help</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>short pause</li>
                  <li>starts with first step</li>
                  <li>attempts independently</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Delay to Initiation</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">3. How They Execute</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>guessing</li>
                  <li>random steps</li>
                  <li>skipping</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>follows method</li>
                  <li>step-by-step</li>
                  <li>consistent process</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Guessing to Structure</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">4. When They Get Stuck</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>freezes</li>
                  <li>gives up</li>
                  <li>asks for answer</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>pauses</li>
                  <li>identifies what they know</li>
                  <li>continues</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Collapse to Control</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">5. Response to Difficulty</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>panic</li>
                  <li>frustration</li>
                  <li>rushing</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>neutral</li>
                  <li>controlled</li>
                  <li>steady</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Reaction to Regulation</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">6. Language</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>"this thing"</li>
                  <li>unclear explanations</li>
                  <li>incomplete thinking</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>correct terms</li>
                  <li>clear explanation</li>
                  <li>precise thinking</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Vague to Precise</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">7. Dependence</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>waits for tutor</li>
                  <li>needs reassurance</li>
                  <li>constant questions</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>attempts first</li>
                  <li>self-corrects</li>
                  <li>asks less</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Dependent to Independent</p>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">8. Under Pressure (Timed / Boss Battles)</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>freezes</li>
                  <li>rushes</li>
                  <li>breaks structure</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>starts calmly</li>
                  <li>follows method</li>
                  <li>completes with control</li>
                </ul>
              </div>
            </div>
            <p className="font-semibold">Shift</p>
            <p className="text-lg font-semibold">From Unstable to Stable</p>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Simplest Version</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>doesn't know where to start</li>
                <li>reacts emotionally</li>
                <li>relies on help</li>
                <li>guesses</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
              <ul className="space-y-1 pl-4 font-semibold">
                <li>starts with structure</li>
                <li>stays controlled</li>
                <li>works independently</li>
                <li>follows method</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Difference</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
              <p className="text-muted-foreground">"I don't know what to do"</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
              <p className="font-semibold">"Let me start with what I know"</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Looks Like in Real Time</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
              <p className="text-muted-foreground">Tutor leads</p>
              <p className="text-muted-foreground">Student follows</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
              <p className="font-semibold">Student leads</p>
              <p className="font-semibold">Tutor guides</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Does NOT Depend On</h2>
          <p className="font-medium">Not:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>intelligence</li>
            <li>natural talent</li>
            <li>confidence</li>
          </ul>
          <p className="font-medium">It depends on:</p>
          <p className="text-lg font-semibold">trained response patterns</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Final Test</h2>
          <p className="font-medium">Ask:</p>
          <p className="font-semibold">When the student sees something unfamiliar...</p>
          <p className="font-medium">Do they:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>freeze</li>
            <li>guess</li>
            <li>wait</li>
          </ul>
          <p className="font-medium">or</p>
          <ul className="space-y-1 pl-4 font-semibold">
            <li>identify</li>
            <li>start</li>
            <li>execute</li>
          </ul>
          <p className="font-semibold">That answer tells you everything.</p>
        </Card>

        <Card className="p-6 bg-primary/5 border-primary/30 border-2 space-y-4">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="font-medium">If the student still:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>waits</li>
            <li>guesses</li>
            <li>collapses under difficulty</li>
          </ul>
          <p className="font-medium">Then:</p>
          <p className="font-semibold">they are still in the "before" state</p>
          <p className="font-medium">If they:</p>
          <ul className="space-y-1 pl-4 font-semibold">
            <li>start</li>
            <li>follow structure</li>
            <li>stay controlled</li>
          </ul>
          <p className="font-medium">Then:</p>
          <p className="font-semibold">they have entered the "after" state</p>
          <p className="text-lg font-semibold">That's the transformation.</p>
        </Card>
      </div>
    </div>
  );
}