import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningSignsOfProgress() {
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
                Signs of Progress
              </h1>
              <p className="text-muted-foreground mt-1">under System Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Section Is</h2>
          <p className="font-medium">This is:</p>
          <p className="text-muted-foreground">what improvement actually looks like inside the system</p>
          <p className="font-medium">If tutors miss these signals, they will:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>push too fast</li>
            <li>change the approach too early</li>
            <li>or think nothing is working</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Core Principle</h2>
          <p className="font-medium">Progress in Response Integrity is not:</p>
          <p className="text-muted-foreground">getting everything right</p>
          <p className="font-medium">Progress is:</p>
          <p className="text-lg font-semibold">
            improving how the student responds when things are not easy
          </p>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Primary Signals of Progress</h2>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">1. Faster Orientation</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>student reads fully</li>
                <li>identifies problem type earlier</li>
                <li>names components correctly</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">"I don't know what this is"</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">"This is a quadratic... I see x²"</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Clarity is stabilizing</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">2. Earlier First Step</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>less waiting</li>
                <li>quicker start</li>
                <li>fewer "I don't know where to begin"</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">long pause with no action</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">short pause, then first step</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Execution is becoming automatic</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">3. Reduced Guessing</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>fewer random answers</li>
                <li>more step-based attempts</li>
                <li>visible method use</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">trial and error</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">structured attempt</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">The student trusts the method</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">4. Staying Inside the Problem Longer</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>does not give up quickly</li>
                <li>continues after mistakes</li>
                <li>attempts multiple steps</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">gives up early</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">keeps working</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Discomfort tolerance is increasing</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">5. Cleaner Language</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>correct terminology</li>
                <li>clearer explanations</li>
                <li>fewer vague words</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">"this thing... that number..."</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">"coefficient... factor... equation..."</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Thinking is becoming precise</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">6. Self-Correction Begins</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>catches mistakes</li>
                <li>adjusts without being told</li>
                <li>re-checks steps</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">waits for tutor to correct</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">corrects independently</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Independence is forming</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">7. Emotional Stabilization</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>fewer visible reactions</li>
                <li>less frustration</li>
                <li>more neutral tone</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">panic / stress / complaints</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">pause, then continue</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Response is being regulated</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">8. Improved Performance Under Pressure</h3>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What You See</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>better behavior in Boss Battles</li>
                <li>more stable timed execution</li>
                <li>fewer breakdowns</li>
              </ul>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <p className="text-muted-foreground">collapse under pressure</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <p className="font-semibold">controlled execution</p>
              </div>
            </div>
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">What It Means</p>
              <p className="font-semibold mt-1">Conditioning is working</p>
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Progress Does NOT Look Like</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-red-500/50 pl-4 space-y-1">
              <p className="font-semibold">&#10060; Only getting answers right</p>
              <p className="text-muted-foreground">Can happen without stability</p>
            </div>
            <div className="border-l-4 border-red-500/50 pl-4 space-y-1">
              <p className="font-semibold">&#10060; Moving faster</p>
              <p className="text-muted-foreground">Can be rushing</p>
            </div>
            <div className="border-l-4 border-red-500/50 pl-4 space-y-1">
              <p className="font-semibold">&#10060; Being more confident</p>
              <p className="text-muted-foreground">Can be temporary</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Most Important Signal</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
              <p className="text-muted-foreground">"I don't know"</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
              <p className="font-semibold">"Let me try"</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How to Use This in Session</h2>
          <p className="font-medium">When you see progress:</p>
          <p className="text-lg font-semibold">You name it.</p>
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Example</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>"You started without waiting."</li>
              <li>"You followed the steps."</li>
              <li>"You corrected that yourself."</li>
            </ul>
          </div>
          <div className="border-l-4 border-primary pl-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">This Reinforces</p>
            <p className="font-semibold mt-1">process awareness</p>
          </div>
        </Card>
      </div>
    </div>
  );
}