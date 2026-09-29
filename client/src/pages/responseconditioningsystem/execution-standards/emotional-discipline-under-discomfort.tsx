import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningEmotionalDisciplineUnderDiscomfort() {
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
                Emotional Discipline Under Discomfort
              </h1>
              <p className="text-muted-foreground mt-1">under Execution Standards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What It Is</h2>
          <p className="text-muted-foreground">Emotional discipline is:</p>
          <p className="font-medium">your ability to remain stable while the student is unstable</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why It Matters</h2>
          <p className="text-muted-foreground">Students will:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>hesitate</li>
            <li>panic</li>
            <li>get frustrated</li>
            <li>ask for answers</li>
          </ul>
          <p className="text-muted-foreground">These are not problems.</p>
          <p className="text-muted-foreground">They are:</p>
          <p className="font-medium">the exact moments the system is designed for</p>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Risk</h2>
          <p className="text-muted-foreground">Most tutors react to these moments by:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>helping too quickly</li>
            <li>softening the situation</li>
            <li>removing pressure</li>
          </ul>
          <p className="text-muted-foreground">This feels supportive.</p>
          <p className="font-semibold">It destroys the process.</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Role of the Tutor</h2>
          <p className="text-muted-foreground">You are not there to remove discomfort.</p>
          <p className="text-muted-foreground">You are there to:</p>
          <p className="font-medium">hold structure while discomfort exists</p>
        </Card>

        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">What You Must Control</h2>

 <div className="space-y-3 ">
            <p className="text-lg font-semibold">1. Your Urge to Rescue</p>
            <div>
              <p className="font-semibold mb-1">What It Feels Like</p>
              <p className="text-muted-foreground">"Let me just help them"</p>
              <p className="text-muted-foreground">"They're stuck"</p>
              <p className="text-muted-foreground">"This is taking too long"</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What You Do Instead</p>
              <p className="text-muted-foreground">You wait.</p>
              <p className="text-muted-foreground">You observe.</p>
              <p className="text-muted-foreground">You allow the moment.</p>
            </div>
            <div className="bg-muted rounded p-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Do not act on the urge to rescue.</p>
            </div>
          </div>

 <div className="space-y-3 ">
            <p className="text-lg font-semibold">2. Your Reaction to Frustration</p>
            <div>
              <p className="font-semibold mb-1">What It Looks Like</p>
              <p className="text-muted-foreground">Student:</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>sighs</li>
                <li>complains</li>
                <li>says "I can't do this"</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">What Weak Tutors Do</p>
              <p className="text-muted-foreground">reassure</p>
              <p className="text-muted-foreground">reduce difficulty</p>
              <p className="text-muted-foreground">change approach</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What You Do</p>
              <p className="text-muted-foreground">You stay neutral.</p>
              <p className="text-muted-foreground">You redirect to structure.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What You Say</p>
              <p className="text-muted-foreground">"What do you know?"</p>
              <p className="text-muted-foreground">"What's the first step?"</p>
            </div>
            <div className="bg-muted rounded p-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Do not react emotionally. Maintain process.</p>
            </div>
          </div>

 <div className="space-y-3 ">
            <p className="text-lg font-semibold">3. Your Need to Fix Quickly</p>
            <div>
              <p className="font-semibold mb-1">What It Feels Like</p>
              <p className="text-muted-foreground">wanting progress</p>
              <p className="text-muted-foreground">wanting flow</p>
              <p className="text-muted-foreground">wanting correctness</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What You Do Instead</p>
              <p className="text-muted-foreground">You slow down.</p>
              <p className="text-muted-foreground">You stay inside the process.</p>
            </div>
            <div className="bg-muted rounded p-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Speed is not the goal. Stability is.</p>
            </div>
          </div>

 <div className="space-y-3 ">
            <p className="text-lg font-semibold">4. Your Discomfort with Silence</p>
            <div>
              <p className="font-semibold mb-1">What It Feels Like</p>
              <p className="text-muted-foreground">pressure to speak</p>
              <p className="text-muted-foreground">need to fill the gap</p>
            </div>
            <div>
              <p className="font-semibold mb-1">What You Do Instead</p>
              <p className="text-muted-foreground">You allow silence.</p>
              <p className="text-muted-foreground">You let the student think.</p>
            </div>
            <div className="bg-muted rounded p-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Silence is part of the system.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Standard State</h2>
          <p className="text-muted-foreground">You must remain:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>calm</li>
            <li>neutral</li>
            <li>controlled</li>
            <li>non-reactive</li>
          </ul>
          <p className="text-muted-foreground">Not:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>encouraging excessively</li>
            <li>rushing</li>
            <li>emotionally involved</li>
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What the Student Experiences</h2>
          <p className="text-muted-foreground">At first:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>discomfort</li>
            <li>resistance</li>
            <li>hesitation</li>
          </ul>
          <p className="text-muted-foreground">Then:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>small control</li>
            <li>first step</li>
            <li>gradual stability</li>
          </ul>
          <p className="text-muted-foreground">This only happens if:</p>
          <p className="font-medium">you do not interfere</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Breaks Emotional Discipline</h2>
          <div className="space-y-3">
            <div>
              <p className="font-semibold">&#10060; Wanting to Be Liked</p>
              <p className="text-muted-foreground">You make things easier.</p>
            </div>
            <div>
              <p className="font-semibold">&#10060; Avoiding Discomfort</p>
              <p className="text-muted-foreground">You remove pressure.</p>
            </div>
            <div>
              <p className="font-semibold">&#10060; Over-Identifying</p>
              <p className="text-muted-foreground">You feel what the student feels.</p>
            </div>
            <div>
              <p className="font-semibold">&#10060; Reacting to Time</p>
              <p className="text-muted-foreground">You rush the process.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Correct Position</h2>
          <p className="text-muted-foreground">You are:</p>
          <p className="font-medium">present, but not reactive</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What You Reinforce</h2>
          <p className="text-muted-foreground">Not:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>comfort</li>
            <li>speed</li>
            <li>correctness</li>
          </ul>
          <p className="text-muted-foreground">You reinforce:</p>
          <p className="font-medium">calm execution under difficulty</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Hidden Truth</h2>
          <p className="text-muted-foreground">Students learn more from:</p>
          <p className="font-medium">how you respond to their struggle</p>
          <p className="text-muted-foreground">than from:</p>
          <p className="font-medium">what you explain</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Mastery Looks Like</h2>
          <p className="text-muted-foreground">You will see:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>fewer interventions</li>
            <li>more silence</li>
            <li>more student thinking</li>
            <li>stable pacing</li>
          </ul>
          <p className="text-muted-foreground">The student begins to:</p>
          <p className="font-medium">self-regulate</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Internal Check</h2>
          <p className="text-muted-foreground">At any moment, ask:</p>
          <p className="font-medium">"Am I maintaining the system, or reacting to the student?"</p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Final Principle</h2>
          <p className="text-muted-foreground">Emotional discipline is:</p>
          <p className="font-medium">holding the line when it would be easier not to</p>
        </Card>

        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="text-muted-foreground">If you remove discomfort to make the session feel better:</p>
          <p className="font-semibold">you weaken the student</p>
          <p className="text-muted-foreground">If you hold structure through discomfort:</p>
          <p className="font-semibold">you strengthen the student</p>
          <p className="text-muted-foreground">That's the difference.</p>
          <p className="text-muted-foreground">This is not kindness vs harshness.</p>
          <p className="text-muted-foreground">This is:</p>
          <p className="font-medium">short-term relief vs long-term capability</p>
          <p className="text-muted-foreground">And Response Integrity chooses:</p>
          <p className="font-bold text-lg">capability</p>
        </Card>
      </div>
    </div>
  );
}
