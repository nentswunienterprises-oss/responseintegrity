import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningWhatChangesInTheStudent() {
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
                What Changes in the Student
              </h1>
              <p className="text-muted-foreground mt-1">under System Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* What This Section Is */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Section Is</h2>
          <p className="text-muted-foreground">This is not theory.</p>
          <p className="font-medium">This is:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>what you should observe changing over time</li>
          </ul>
          <p className="font-medium">If these changes are not happening:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>the system is not being executed properly</li>
          </ul>
        </Card>

        {/* The Core Shift */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Core Shift</h2>
          <p className="font-medium">Response Integrity does not primarily change:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>intelligence</li>
            <li>memory</li>
            <li>personality</li>
          </ul>
          <p className="font-medium">It changes:</p>
          <ul className="space-y-1 pl-4">
            <li className="font-semibold">how the student responds to difficulty</li>
          </ul>
        </Card>

        {/* The Transformation */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Transformation</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">From</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>unclear</li>
                <li>reactive</li>
                <li>dependent</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">To</p>
              <ul className="space-y-1 pl-4 font-semibold">
                <li>oriented</li>
                <li>structured</li>
                <li>self-directed</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* What Actually Changes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What Actually Changes</h2>

          {/* 1 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">1. Language Becomes Precise</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>"this thing"</li>
                  <li>"I don't know what that is"</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>correct terms</li>
                  <li>clear identification</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student can see what they are working with</p>
            </div>
          </Card>

          {/* 2 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">2. Start Time Decreases</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>hesitation</li>
                  <li>waiting</li>
                  <li>"I don't know where to start"</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>quicker first step</li>
                  <li>immediate orientation</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student is no longer blocked by uncertainty</p>
            </div>
          </Card>

          {/* 3 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">3. Execution Becomes Structured</h3>
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
                  <li>step-by-step execution</li>
                  <li>fewer errors</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student trusts the process</p>
            </div>
          </Card>

          {/* 4 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">4. Response to Difficulty Stabilizes</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>panic</li>
                  <li>rushing</li>
                  <li>freezing</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>pause</li>
                  <li>identify</li>
                  <li>begin</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student can stay inside difficulty</p>
            </div>
          </Card>

          {/* 5 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">5. Dependency Reduces</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>constant questions</li>
                  <li>waiting for help</li>
                  <li>needing reassurance</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>attempts independently</li>
                  <li>self-corrects</li>
                  <li>continues without interruption</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student owns the process</p>
            </div>
          </Card>

          {/* 6 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">6. Emotional Reactivity Decreases</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>frustration spikes</li>
                  <li>visible stress</li>
                  <li>negative self-talk</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>neutral tone</li>
                  <li>controlled pace</li>
                  <li>steady behavior</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student is regulating their response</p>
            </div>
          </Card>

          {/* 7 */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-bold">7. Recovery Becomes Faster</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Before</p>
                <ul className="space-y-1 pl-4 text-muted-foreground">
                  <li>stuck for long periods</li>
                  <li>gives up</li>
                  <li>restarts completely</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">After</p>
                <ul className="space-y-1 pl-4 font-semibold">
                  <li>identifies mistake</li>
                  <li>adjusts</li>
                  <li>continues</li>
                </ul>
              </div>
            </div>
 <div className="">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">What This Means</p>
              <p className="font-semibold mt-1">The student can correct without collapse</p>
            </div>
          </Card>
        </div>

        {/* What You Should Notice Over Time */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What You Should Notice Over Time</h2>
          <div className="space-y-4">
 <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Early Stage</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>confusion</li>
                <li>hesitation</li>
                <li>emotional reactions</li>
              </ul>
            </div>
 <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Middle Stage</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>partial structure</li>
                <li>inconsistent control</li>
                <li>guided execution</li>
              </ul>
            </div>
 <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">Later Stage</p>
              <ul className="space-y-1 pl-4 font-semibold">
                <li>consistent structure</li>
                <li>faster initiation</li>
                <li>stable response under pressure</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* The Real Indicator */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Real Indicator</h2>
          <p className="font-medium">The most important shift is this:</p>
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

        {/* What Does NOT Matter */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Does NOT Matter</h2>
          <p className="font-medium">Do not confuse progress with:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>speed</li>
            <li>number of correct answers</li>
            <li>enthusiasm</li>
          </ul>
          <p className="text-muted-foreground">These can exist without real change.</p>
        </Card>

        {/* What Matters */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Matters</h2>
          <p className="font-medium">Look for:</p>
          <ul className="space-y-1 pl-4 font-semibold">
            <li>behavior</li>
            <li>response</li>
            <li>structure</li>
          </ul>
        </Card>

        {/* Final Principle */}
        <Card className="p-6 border-2 border-primary/20 space-y-3">
          <h2 className="text-2xl font-bold">Final Principle</h2>
          <p className="font-medium">Response Integrity changes:</p>
          <p className="text-lg font-semibold">how the student behaves when they don't know what to do</p>
        </Card>

        {/* Final Rule */}
        <Card className="p-6 bg-primary/5 border-primary/30 border-2 space-y-3">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="font-medium">If the student still:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>freezes</li>
            <li>guesses</li>
            <li>waits</li>
          </ul>
          <p className="font-medium">Then:</p>
          <p className="text-lg font-semibold">the system has not yet taken hold</p>
        </Card>

      </div>
    </div>
  );
}
