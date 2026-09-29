import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowToUseBossBattles() {
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
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                How to Use Boss Battles
              </h1>
              <p className="text-muted-foreground mt-1">under Execution Standards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* What a Boss Battle Is */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What a Boss Battle Is</h2>
          <p className="text-muted-foreground">A Boss Battle is:</p>
          <p className="font-medium">an intentionally more difficult problem designed to trigger uncertainty after stability</p>
          <p className="text-muted-foreground">Not random.</p>
          <p className="text-muted-foreground">Not punishment.</p>
          <p className="text-muted-foreground">Not excessive difficulty.</p>
        </Card>

        {/* The Purpose */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Purpose</h2>
          <p className="text-muted-foreground">Boss Battles exist to:</p>
          <ul className="space-y-2 pl-4">
            <li className="font-medium">expose the student's default response</li>
            <li className="font-medium">train stability under difficulty</li>
            <li className="font-medium">replace panic with process</li>
          </ul>
        </Card>

        {/* When to Use It */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">When to Use It</h2>
          <p className="text-muted-foreground">Only when:</p>
          <ul className="space-y-2 pl-4">
            <li className="font-medium">the student has completed 3-4 problems correctly</li>
            <li className="font-medium">the method is stable</li>
            <li className="font-medium">the student is starting to appear comfortable</li>
          </ul>

          <div className="bg-muted rounded p-3 mt-3">
            <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
            <p className="text-muted-foreground">Boss Battles are introduced after comfort, not during confusion.</p>
          </div>
        </Card>

        {/* The Setup */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Setup</h2>
          <p className="text-muted-foreground">You do not announce it as:</p>
          <p className="font-medium">"This is a hard one."</p>
          <p className="text-muted-foreground">You simply say:</p>
          <p className="font-medium">"Try this."</p>
          <p className="text-muted-foreground">Then observe.</p>
        </Card>

        {/* The Critical Moment */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Critical Moment</h2>
          <p className="text-muted-foreground">The second the student sees the problem.</p>
          <p className="text-muted-foreground">Before they speak.</p>
          <p className="text-muted-foreground">Before they act.</p>
          <p className="text-muted-foreground">You are watching:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>hesitation</li>
            <li>facial change</li>
            <li>body language</li>
            <li>first reaction</li>
          </ul>
          <p className="text-muted-foreground">This is the raw response pattern</p>
        </Card>

        {/* The Most Important Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Most Important Rule</h2>
          <p className="text-lg font-bold text-primary mb-3">Do Not Rescue</p>

          <p className="text-muted-foreground">When the student reacts:</p>
          <p className="font-medium">You do nothing.</p>
          <p className="text-lg font-semibold">For 10-15 seconds.</p>

          <div className="space-y-3 mt-4">
            <div>
              <p className="font-semibold mb-2">Why</p>
              <p className="text-muted-foreground">This is where:</p>
              <ul className="space-y-1 pl-4 text-muted-foreground">
                <li>panic appears</li>
                <li>habits surface</li>
                <li>conditioning begins</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-2">If you interrupt:</p>
              <p className="text-muted-foreground">you remove the training moment</p>
            </div>
          </div>
        </Card>

        {/* What You Do After the Pause */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What You Do After the Pause</h2>
          <p className="text-muted-foreground">You guide.</p>
          <p className="text-muted-foreground">But only to:</p>
          <p className="font-medium">the first step</p>

          <div>
            <p className="font-semibold mb-3">What You Say</p>
            <p className="text-muted-foreground">"What do you know?"</p>
            <p className="text-muted-foreground">"What type of problem is this?"</p>
            <p className="text-muted-foreground">"Start with what you recognize."</p>
          </div>

          <div>
            <p className="font-semibold mb-3">What You Are NOT Doing</p>
            <p className="text-muted-foreground">solving the problem</p>
            <p className="text-muted-foreground">explaining everything</p>
            <p className="text-muted-foreground">removing difficulty</p>
          </div>
        </Card>

        {/* The Flow */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">The Flow</h2>

          <div className="space-y-2">
            <p className="font-semibold">Step 1: Introduce</p>
            <p className="text-muted-foreground">Give the problem naturally.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Step 2: Observe</p>
            <p className="text-muted-foreground">Say nothing.</p>
            <p className="text-muted-foreground">Watch the response.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Step 3: Hold</p>
            <p className="text-muted-foreground">Allow discomfort to exist.</p>
            <p className="text-muted-foreground">No interruption.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Step 4: Guide to First Step</p>
            <p className="text-muted-foreground">Minimal intervention.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Step 5: Continue Execution</p>
            <p className="text-muted-foreground">Student works through the problem.</p>
            <p className="text-muted-foreground">You guide only when necessary.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Step 6: Debrief</p>
            <p className="text-muted-foreground">After the attempt:</p>
            <p className="text-muted-foreground">You name the behaviour.</p>
          </div>
        </Card>

        {/* The Debrief */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Debrief</h2>
          <p className="text-muted-foreground">You do NOT focus on:</p>
          <p className="font-medium">right vs wrong</p>
          <p className="text-muted-foreground">You focus on:</p>
          <p className="font-medium">how they responded</p>

          <div>
            <p className="font-semibold mb-3">What You Say</p>
            <p className="text-muted-foreground">"You paused."</p>
            <p className="text-muted-foreground">"You identified the type."</p>
            <p className="text-muted-foreground">"You started with what you knew."</p>
          </div>

          <div>
            <p className="font-semibold mb-2">Why This Matters</p>
            <p className="text-muted-foreground">You are reinforcing:</p>
            <p className="font-medium">response, not result</p>
          </div>
        </Card>

        {/* What Not to Do */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Not to Do</h2>

          <div className="space-y-4">
            <div>
              <p className="font-semibold flex items-center gap-2">
                Introduce Too Early
              </p>
              <p className="text-muted-foreground">Student is not ready, and chaos follows.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Over-Guide
              </p>
              <p className="text-muted-foreground">Too many hints leave no room for thinking.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Rescue
              </p>
              <p className="text-muted-foreground">Jumping in quickly prevents conditioning.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Label It as "Hard"
              </p>
              <p className="text-muted-foreground">Creates anticipation and anxiety</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Skip Debrief
              </p>
              <p className="text-muted-foreground">Misses the learning moment</p>
            </div>
          </div>
        </Card>

        {/* What You Must Maintain */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">What You Must Maintain</h2>

          <div className="space-y-2">
            <p className="font-semibold">Calm</p>
            <p className="text-muted-foreground">No urgency in your tone</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Control</p>
            <p className="text-muted-foreground">You manage the pace</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Precision</p>
            <p className="text-muted-foreground">You intervene only when needed</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Silence</p>
            <p className="text-muted-foreground">You allow thinking space</p>
          </div>
        </Card>

        {/* What This Builds */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What This Builds</h2>

          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1">1. Tolerance</p>
              <p className="text-muted-foreground">Student stays in difficulty longer</p>
            </div>

            <div>
              <p className="font-semibold mb-1">2. Initiation</p>
              <p className="text-muted-foreground">They start without waiting</p>
            </div>

            <div>
              <p className="font-semibold mb-1">3. Control</p>
              <p className="text-muted-foreground">They don't rush or panic</p>
            </div>

            <div>
              <p className="font-semibold mb-1">4. Trust in System</p>
              <p className="text-muted-foreground">They rely on structure, not emotion</p>
            </div>
          </div>
        </Card>

        {/* What Mastery Looks Like */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Mastery Looks Like</h2>
          <p className="text-muted-foreground">You will see:</p>
          <ul className="space-y-2 pl-4 text-muted-foreground">
            <li>shorter hesitation</li>
            <li>quicker first step</li>
            <li>less emotional reaction</li>
            <li>more stable execution</li>
          </ul>
          <p className="text-muted-foreground">The student begins to treat difficulty as:</p>
          <p className="font-medium">normal</p>
        </Card>

        {/* The Core Principle */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Core Principle</h2>
          <p className="text-muted-foreground">Boss Battles are:</p>
          <p className="font-bold text-lg">pressure without chaos</p>
        </Card>

        {/* Final Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="text-muted-foreground">If the student never experiences:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>hesitation</li>
            <li>uncertainty</li>
            <li>discomfort</li>
          </ul>
          <p className="text-muted-foreground">Then:</p>
          <p className="font-semibold">you are not training response</p>
          <p className="text-muted-foreground">You are protecting comfort.</p>
          <p className="text-muted-foreground">And Response Integrity does not protect comfort.</p>
          <p className="text-muted-foreground">It builds:</p>
          <p className="font-bold text-lg">capability under pressure</p>
        </Card>

      </div>
    </div>
  );
}
