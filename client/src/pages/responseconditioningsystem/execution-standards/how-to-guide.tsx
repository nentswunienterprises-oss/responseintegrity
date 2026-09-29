import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ResponseConditioningHowToGuide() {
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
                How to Guide
              </h1>
              <p className="text-muted-foreground mt-1">under Execution Standards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* What Guiding Is */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Guiding Is</h2>
          <p className="text-muted-foreground">Guiding is when:</p>
          <p className="font-medium">the student is executing, and you control the correction</p>
          <p className="text-muted-foreground">You are not explaining.</p>
          <p className="text-muted-foreground">You are not taking over.</p>
          <p className="text-muted-foreground">You are:</p>
          <p className="font-medium">maintaining structure while the student does the work</p>
        </Card>

        {/* The Purpose */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Purpose</h2>
          <p className="text-muted-foreground">Guiding exists to:</p>
          <ul className="space-y-2 pl-4">
            <li className="font-medium">correct errors</li>
            <li className="font-medium">reinforce the method</li>
            <li className="font-medium">return control to the student</li>
          </ul>
        </Card>

        {/* The Core Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Core Rule</h2>
          <p className="text-xl font-bold text-primary">Guide. Don't replace.</p>
          <p className="text-muted-foreground">If you are doing the thinking for them:</p>
          <p className="font-semibold">you are not guiding.</p>
        </Card>

        {/* The Process */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">The Process</h2>
          <p className="text-muted-foreground">Every time the student makes an error:</p>

          {/* Step 1 */}
          <div className="space-y-3 border-l-4 border-l-primary pl-4">
            <p className="text-lg font-semibold">1. Observe</p>
            <p className="text-muted-foreground">Do not interrupt immediately.</p>
            <p className="text-muted-foreground">Watch:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>where they hesitate</li>
              <li>what they skip</li>
              <li>what they misidentify</li>
            </ul>
          </div>

          {/* Step 2 */}
          <div className="space-y-3 border-l-4 border-l-primary pl-4">
            <p className="text-lg font-semibold">2. Diagnose the Layer</p>
            <p className="text-muted-foreground">You must identify:</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>Vocabulary problem?</li>
              <li>Method problem?</li>
              <li>Reason problem?</li>
            </ul>
            <div className="bg-muted rounded p-3 mt-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Every error belongs to a layer.</p>
              <p className="text-muted-foreground">If you don't identify the layer:</p>
              <p className="text-muted-foreground">you will correct incorrectly.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3 border-l-4 border-l-primary pl-4">
            <p className="text-lg font-semibold">3. Intervene Minimally</p>
            <p className="text-muted-foreground">You do not explain everything.</p>
            <p className="text-muted-foreground">You target the exact point of failure.</p>
            <div>
              <p className="font-semibold mb-2">What You Say</p>
              <p className="text-muted-foreground">"What is this called?"</p>
              <p className="text-muted-foreground">"What's the next step?"</p>
              <p className="text-muted-foreground">"Why does this work?"</p>
            </div>
            <div>
              <p className="font-semibold mb-2">What You Are Doing</p>
              <p className="text-muted-foreground">You are:</p>
              <p className="font-medium">forcing the student to think inside structure</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3 border-l-4 border-l-primary pl-4">
            <p className="text-lg font-semibold">4. Return Control</p>
            <p className="text-muted-foreground">After correction:</p>
            <p className="text-muted-foreground">the student continues.</p>
            <p className="text-muted-foreground">Not you.</p>
            <div className="bg-muted rounded p-3 mt-3">
              <p className="font-semibold text-sm uppercase tracking-wide mb-1">Rule</p>
              <p className="text-muted-foreground">Correction is temporary.</p>
              <p className="text-muted-foreground">Execution must return to the student.</p>
            </div>
          </div>
        </Card>

        {/* Guiding Tools */}
        <Card className="p-6 space-y-6">
          <h2 className="text-2xl font-bold">Guiding Tools (Use These Only)</h2>

          <div className="space-y-2">
            <p className="text-lg font-semibold">1. Questioning</p>
            <p className="text-muted-foreground">Short. Direct.</p>
            <p className="text-muted-foreground">"What do you know?"</p>
            <p className="text-muted-foreground">"What type of problem is this?"</p>
            <p className="text-muted-foreground">"What's step one?"</p>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-semibold">2. Prompting the Method</p>
            <p className="text-muted-foreground">"Follow the steps."</p>
            <p className="text-muted-foreground">"What comes next?"</p>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-semibold">3. Layer Correction</p>
            <p className="text-muted-foreground">"That's the coefficient."</p>
            <p className="text-muted-foreground">"Set it equal to zero."</p>
            <p className="text-muted-foreground">"What law are we using?"</p>
          </div>
        </Card>

        {/* What Not to Do */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Not to Do</h2>

          <div className="space-y-4">
            <div>
              <p className="font-semibold flex items-center gap-2">
                Take Over
              </p>
              <p className="text-muted-foreground">Writing for the student. Solving for them.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Over-Explain
              </p>
              <p className="text-muted-foreground">Giving long explanations mid-execution.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Rescue
              </p>
              <p className="text-muted-foreground">Jumping in when they hesitate.</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Accept Vague Answers
              </p>
              <p className="text-muted-foreground">Allowing: "this thing," "I think it's…"</p>
            </div>

            <div>
              <p className="font-semibold flex items-center gap-2">
                Skip Diagnosis
              </p>
              <p className="text-muted-foreground">Correcting without knowing the layer.</p>
            </div>
          </div>
        </Card>

        {/* The Silence Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The Silence Rule</h2>
          <p className="text-muted-foreground">When the student is stuck:</p>
          <p className="text-xl font-bold text-primary">Wait.</p>
          <p className="text-lg font-semibold">10-15 seconds.</p>

          <div>
            <p className="font-semibold mb-2">Why</p>
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>thinking needs space</li>
              <li>discomfort must exist</li>
              <li>response patterns appear</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">If you speak too early:</p>
            <p className="text-muted-foreground">you interrupt the process</p>
          </div>
        </Card>

        {/* The First-Step Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">The First-Step Rule</h2>
          <p className="text-muted-foreground">When guiding:</p>
          <p className="font-medium">You only guide to: the next step</p>
          <p className="text-muted-foreground">Not the full solution.</p>

          <div className="space-y-3 mt-4">
            <div>
              <p className="font-semibold mb-1">Wrong:</p>
              <p className="text-muted-foreground">"Factor it, then set it equal to zero, then solve…"</p>
            </div>

            <div>
              <p className="font-semibold mb-1">Correct:</p>
              <p className="text-muted-foreground">"What's the first step?"</p>
            </div>
          </div>
        </Card>

        {/* The Loop */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Loop</h2>
          <p className="text-muted-foreground">Guiding is not one-time.</p>
          <p className="text-muted-foreground">It is a loop:</p>
          <div className="space-y-2 pl-4 font-medium">
            <p>Student executes</p>
            <p>Student makes an error</p>
            <p>You diagnose</p>
            <p>You guide</p>
            <p>Student continues</p>
          </div>
          <p className="text-muted-foreground">Repeated until stable.</p>
        </Card>

        {/* What You Are Building */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What You Are Building</h2>

          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1">1. Independence</p>
              <p className="text-muted-foreground">Student stops relying on you.</p>
            </div>

            <div>
              <p className="font-semibold mb-1">2. Error Awareness</p>
              <p className="text-muted-foreground">They start seeing their own mistakes.</p>
            </div>

            <div>
              <p className="font-semibold mb-1">3. Process Discipline</p>
              <p className="text-muted-foreground">They follow structure without prompting.</p>
            </div>
          </div>
        </Card>

        {/* What Mastery Looks Like */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">What Mastery Looks Like</h2>
          <p className="text-muted-foreground">You will see:</p>
          <ul className="space-y-2 pl-4 text-muted-foreground">
            <li>fewer interruptions</li>
            <li>cleaner steps</li>
            <li>correct language</li>
            <li>faster recovery from mistakes</li>
          </ul>
          <p className="text-muted-foreground">The student begins to:</p>
          <p className="font-medium">self-correct</p>
        </Card>

        {/* The Hidden Danger */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Hidden Danger</h2>
          <p className="text-muted-foreground">If you guide poorly:</p>
          <p className="text-muted-foreground">you create:</p>
          <ul className="space-y-2 pl-4 text-muted-foreground">
            <li>dependency</li>
            <li>hesitation</li>
            <li>passive learners</li>
          </ul>
        </Card>

        {/* The Correct Feeling */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Correct Feeling</h2>
          <p className="text-muted-foreground">Guiding should feel:</p>
          <div className="space-y-2">
            <ul className="space-y-1 pl-4 text-muted-foreground">
              <li>controlled</li>
              <li>minimal</li>
              <li>precise</li>
            </ul>
          </div>
          <p className="text-muted-foreground">Not:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>talkative</li>
            <li>reactive</li>
            <li>emotional</li>
          </ul>
        </Card>

        {/* Final Principle */}
        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Final Principle</h2>
          <p className="text-muted-foreground">You are not there to help the student get the answer.</p>
          <p className="text-muted-foreground">You are there to:</p>
          <p className="font-bold text-lg">train how they reach the answer</p>
        </Card>

        {/* Final Rule */}
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <h2 className="text-2xl font-bold">Final Rule</h2>
          <p className="text-muted-foreground">If the student is not:</p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            <li>thinking</li>
            <li>speaking</li>
            <li>executing</li>
          </ul>
          <p className="text-muted-foreground">Then:</p>
          <p className="font-semibold">you are doing too much</p>
          <p className="text-muted-foreground">And when you do too much:</p>
          <p className="font-bold text-lg">they learn less</p>
        </Card>

      </div>
    </div>
  );
}
