import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, AlertTriangle } from "lucide-react";

export default function ResponseIntegrityOS() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button 
            variant="ghost" 
            className="mb-4 -ml-2"
            onClick={() => navigate("/specialist/pod")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pod
          </Button>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Response Integrity-OS
              </h1>
              <p className="text-lg text-muted-foreground">
                The Response Training System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        
        {/* Sacred System Notice */}
        <Card className="border-primary/30 bg-primary/5">
          <div className="p-6">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-bold text-lg">This System Is Sacred</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Response Integrity-OS is what separates us from every other tutoring company. What you're about to learn is not shared with parents, not discussed publicly, and not optional. This is the system. You execute it with precision. That's your job.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* What Response Integrity-OS Is */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What Response Integrity-OS Is</h2>
          <Card className="p-6">
            <p className="text-base leading-relaxed mb-4">
              Response Integrity-OS is a <span className="font-semibold text-foreground">response-conditioning system</span>. Not a curriculum. Not a teaching method. A system for training how students respond when certainty disappears.
            </p>
            <p className="text-base leading-relaxed mb-4">
              Most tutors teach content. You train response patterns. When a student sees a problem they don't immediately recognize, we want them to stay calm, identify what they know, and execute. That response doesn't happen naturally. It gets trained.
            </p>
            <p className="text-base leading-relaxed">
              The system has three tools: <span className="font-semibold">3-Layer Lens</span>, <span className="font-semibold">Boss Battles</span>, and <span className="font-semibold">Model → Apply → Guide</span>. Use them correctly, students transform. Skip them, you're just another tutor explaining fractions.
            </p>
          </Card>
        </div>

        {/* Tool 1: 3-Layer Lens */}
        <div className="space-y-6">
          <div>
            <Badge className="mb-3">Tool 1</Badge>
            <h2 className="text-2xl font-bold">The 3-Layer Lens</h2>
            <p className="text-muted-foreground mt-2">
              Every concept is taught through three layers. Every error is diagnosed through the same three layers. This is how you model problems and how you correct mistakes.
            </p>
          </div>

          <div className="space-y-4">
            {/* Layer 1: Vocabulary */}
            <Card className="border-l-4 border-l-primary">
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="text-xl font-bold">Vocabulary Layer</h3>
                </div>
                
                <div className="space-y-3 pl-13">
                  <p className="font-semibold text-foreground">Know the names of terms.</p>
                  
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Vocabulary is about knowing what things are called. Coefficient. Variable. Exponent. Quadratic. Factor. Solution. Product. Quotient. 
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    When you model a problem, you name every component. When a student makes an error, you check: do they know the terms? If they call the exponent "the little number" or the coefficient "that thing in front," the vocabulary layer cracked.
                  </p>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2">
                    <p className="text-xs font-semibold text-foreground">WHEN MODELING</p>
                    <p className="text-sm">
                      "This is a quadratic equation. Notice the x² - that's the quadratic term. The coefficient is 3. The constant is 5. To solve, we need to factor."
                    </p>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2 mt-3">
                    <p className="text-xs font-semibold text-foreground">WHEN CORRECTING</p>
                    <p className="text-sm">
                      <span className="text-destructive font-medium">Student says:</span> "I don't know what to do with that number."
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Diagnosis:</span> Vocabulary layer failure. They don't know the term "coefficient."
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Fix:</span> "That's called the coefficient. Say it. 'Coefficient.' Now use it in a sentence."
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-foreground mt-3">
                    Vocabulary is the foundation. If they don't know what things are called, method and reason collapse.
                  </p>
                </div>
              </div>
            </Card>

            {/* Layer 2: Method */}
            <Card className="border-l-4 border-l-primary">
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="text-xl font-bold">Method Layer</h3>
                </div>
                
                <div className="space-y-3 pl-13">
                  <p className="font-semibold text-foreground">Step-by-step approach. Reliable response.</p>
                  
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Method is the procedure. The sequence of steps. The algorithm. When you see x², what do you do? When you see a word problem, what's step one?
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    When you model, you show the method. Step by step. Predictable. Repeatable. When a student makes an error, you check: did they know the steps? Did they skip a step? Did they execute the steps in the wrong order? If yes, the method layer cracked.
                  </p>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2">
                    <p className="text-xs font-semibold text-foreground">WHEN MODELING</p>
                    <p className="text-sm">
                      "Step 1: Identify the problem type. It's quadratic - I see x². Step 2: Check if it factors. Step 3: Set each factor equal to zero. Step 4: Solve for x. This is the method. Every time."
                    </p>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2 mt-3">
                    <p className="text-xs font-semibold text-foreground">WHEN CORRECTING</p>
                    <p className="text-sm">
                      <span className="text-destructive font-medium">Student error:</span> They factor correctly but forget to set each factor equal to zero.
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Diagnosis:</span> Method layer failure. They skipped step 3.
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Fix:</span> "You factored. Good. What's the next step in the method? ... Set each factor equal to zero. Execute it."
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-foreground mt-3">
                    Method is about having a reliable response. Same problem type, same steps, every time.
                  </p>
                </div>
              </div>
            </Card>

            {/* Layer 3: Reason */}
            <Card className="border-l-4 border-l-primary">
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="text-xl font-bold">Reason Layer</h3>
                </div>
                
                <div className="space-y-3 pl-13">
                  <p className="font-semibold text-foreground">Why the move is valid. Adherence to laws and logic.</p>
                  
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Reason is the why behind the method. Why can we factor? Why do we set it equal to zero? Why does this step work? It's about mathematical laws, logic, and validity.
                  </p>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    When you model, you explain why each step is valid. When a student makes an error, you check: do they understand why the method works? If they're just following steps robotically without understanding the logic, the reason layer cracked.
                  </p>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2">
                    <p className="text-xs font-semibold text-foreground">WHEN MODELING</p>
                    <p className="text-sm">
                      "Why do we set each factor equal to zero? Because of the zero product property - if a × b = 0, then either a = 0 or b = 0. That's the law. That's why this step works."
                    </p>
                  </div>

                  <div className="bg-accent/50 p-4 rounded-lg border space-y-2 mt-3">
                    <p className="text-xs font-semibold text-foreground">WHEN CORRECTING</p>
                    <p className="text-sm">
                      <span className="text-destructive font-medium">Student error:</span> They apply a method but can't explain why it works.
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">You ask:</span> "Why did you set that equal to zero?"
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Student:</span> "Because that's what you do?"
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Diagnosis:</span> Reason layer failure. They know the method but not the logic.
                    </p>
                    <p className="text-sm">
                      <span className="text-primary font-medium">Fix:</span> "Zero product property. If a × b = 0, one of them must be zero. That's the law. That's why we set each factor to zero. Say it back."
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-foreground mt-3">
                    Reason prevents robotic execution. Students need to know why their moves are valid, not just what moves to make.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="bg-primary/5 border-primary/30">
            <div className="p-5 space-y-3">
              <p className="text-sm font-semibold">The 3-Layer Lens Has Two Uses:</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">When Teaching (Modeling)</p>
                    <p className="text-xs text-muted-foreground">Break down every concept through all three layers: name the terms (vocabulary), show the steps (method), explain why it works (reason).</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">When Correcting (Guiding)</p>
                    <p className="text-xs text-muted-foreground">Diagnose which layer cracked: Terms unknown? Method missing? Reason unclear? Fix the layer that failed.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tool 2: Boss Battles */}
        <div className="space-y-6">
          <div>
            <Badge className="mb-3">Tool 2</Badge>
            <h2 className="text-2xl font-bold">Boss Battles</h2>
            <p className="text-muted-foreground mt-2">
              Strategic pressure exposure. Students get stronger by facing controlled difficulty.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-lg mb-2">What It Is</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A Boss Battle is a deliberately challenging problem introduced <span className="font-semibold text-foreground">after</span> a student thinks they've mastered a concept. It's not a trick. It's not impossible. It's just hard enough to trigger their uncertainty response in a controlled environment.
              </p>
            </div>

            <div className="h-px bg-border" />

            <div>
              <h3 className="font-bold text-lg mb-2">Why It Exists</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Exams ambush students with unexpected difficulty. Boss Battles remove the ambush. Students learn that hard problems don't mean panic - they mean execute the system.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground mt-2">
                Facing difficulty in session, with you present, trains emotional regulation. The next time they hit a hard problem alone, the response is already conditioned: stay calm, identify what you know, execute.
              </p>
            </div>

            <div className="h-px bg-border" />

            <div>
              <h3 className="font-bold text-lg mb-2">How to Use It</h3>
              <div className="space-y-3">
                <div className="bg-accent/50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Step 1: Timing</p>
                  <p className="text-xs text-muted-foreground">
                    Introduce a Boss Battle when the student feels confident. They've done 3-4 problems correctly. They think they've got it. Now introduce difficulty.
                  </p>
                </div>

                <div className="bg-accent/50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Step 2: Observe</p>
                  <p className="text-xs text-muted-foreground">
                    Watch their reaction. Do they freeze? Rush? Give up? Complain? That's the response pattern you're conditioning against.
                  </p>
                </div>

                <div className="bg-accent/50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Step 3: Don't Rescue</p>
                  <p className="text-xs text-muted-foreground">
                    Let them sit in uncertainty for 10-15 seconds. Don't jump in. Don't give hints. Let the discomfort exist. This is where emotional regulation training happens.
                  </p>
                </div>

                <div className="bg-accent/50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Step 4: Guide to First Step</p>
                  <p className="text-xs text-muted-foreground">
                    After they've sat with it, ask: "What do you know?" or "What type of problem is this?" Guide them to their first step. Not the solution. The first step.
                  </p>
                </div>

                <div className="bg-accent/50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Step 5: Debrief</p>
                  <p className="text-xs text-muted-foreground">
                    After they complete it (or attempt it), name what happened: "You paused. You identified it as quadratic. You started with what you knew. That's the response we're training."
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/30 mt-4">
              <p className="text-sm font-semibold text-foreground mb-2">Critical Rule:</p>
              <p className="text-xs text-muted-foreground">
                Boss Battles are not punishment for getting problems wrong. They're training tools for building pressure tolerance. Use them strategically, not punitively.
              </p>
            </div>
          </Card>
        </div>

        {/* Tool 3: Model → Apply → Guide */}
        <div className="space-y-6">
          <div>
            <Badge className="mb-3">Tool 3</Badge>
            <h2 className="text-2xl font-bold">Model → Apply → Guide</h2>
            <p className="text-muted-foreground mt-2">
              Your session rhythm. Every concept follows this exact sequence. The 3-Layer Lens is used in all three stages.
            </p>
          </div>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
                  M
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Model</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You demonstrate a problem <span className="font-semibold text-foreground">through the 3-Layer Lens</span>. Name the terms. Show the steps. Explain why each step is valid.
                  </p>
                  <div className="bg-accent/50 p-3 rounded text-xs border mt-3 space-y-2">
                    <p className="font-semibold mb-1">Example - Modeling a Quadratic:</p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">[Vocabulary]</span> "This is a quadratic equation. See the x²? That's the quadratic term. The 5x is the linear term. The 6 is the constant."
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">[Method]</span> "Step 1: Factor. Step 2: Set each factor to zero. Step 3: Solve for x. Watch me execute."
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">[Reason]</span> "Why do we set factors to zero? Zero product property. If a × b = 0, then a = 0 or b = 0. That's the law that makes this work."
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-semibold text-foreground">Critical:</span> Model through all three layers. Don't just show steps. Name terms. Explain logic.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
                  A
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Apply</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    They execute. <span className="font-semibold text-foreground">Immediately</span>. No waiting. Give them 2-3 similar problems. Watch them apply what you just modeled.
                  </p>
                  <div className="bg-accent/50 p-3 rounded text-xs border mt-3">
                    <p className="font-semibold mb-1">What to say:</p>
                    <p className="text-muted-foreground">
                      "Now you do this one: x² - 7x + 12 = 0. Name the terms. Show me the method. Tell me why each step works."
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-semibold text-foreground">Key:</span> Immediate application while the model is fresh. Pattern recognition requires repetition.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl flex-shrink-0">
                  G
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Guide</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Correct errors and mistakes <span className="font-semibold text-foreground">through the 3-Layer Lens</span>. Diagnose which layer cracked. Fix that layer.
                  </p>
                  <div className="bg-accent/50 p-3 rounded text-xs border mt-3 space-y-2">
                    <p className="font-semibold mb-1">When They Make an Error:</p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Check Vocabulary:</span> Do they know the term names? If not, teach the vocabulary.
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Check Method:</span> Did they skip a step? Execute steps out of order? If yes, correct the method.
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Check Reason:</span> Do they understand why the move is valid? If not, explain the logic/law.
                    </p>
                  </div>
                  <div className="bg-primary/5 p-3 rounded text-xs border border-primary/30 mt-3">
                    <p className="font-semibold mb-1 text-foreground">Example - Student makes error:</p>
                    <p className="text-muted-foreground mb-1">
                      Student factors (x-2)(x-3) but writes "x = -2, x = -3"
                    </p>
                    <p className="text-primary text-xs">
                      You: "What did you set equal to zero?"<br/>
                      Student: "Um... the factors?"<br/>
                      You: "Show me. Write it."<br/>
                      Student writes: (x-2) = 0<br/>
                      You: "Solve that."<br/>
                      Student: "Oh. x = 2."
                    </p>
                    <p className="text-xs text-foreground mt-2">
                      <span className="font-semibold">Diagnosis:</span> Method layer cracked. They knew vocabulary (factors). They understood reason (zero product property). But they skipped showing the step: setting each factor to zero.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-semibold text-foreground">Key:</span> Don't just say "that's wrong." Diagnose which layer failed. Correct that specific layer.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="bg-primary/5 border-primary/30">
            <div className="p-5 space-y-3">
              <p className="text-sm font-semibold">The 3-Layer Lens Runs Through the Entire Sequence:</p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><span className="font-semibold text-foreground">Model</span> - Teach concept through Vocabulary + Method + Reason</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><span className="font-semibold text-foreground">Apply</span> - Student executes immediately</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><span className="font-semibold text-foreground">Guide</span> - Diagnose errors through Vocabulary + Method + Reason, fix the layer that cracked</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2 border-t border-primary/20 mt-3">
                This is not Model → Apply → Introduce Boss Battle. Guide means correcting through the lens. That's the system.
              </p>
            </div>
          </Card>
        </div>

        {/* Tool 4: Timed Execution */}
        <div className="space-y-6">
          <div>
            <Badge className="mb-3">Tool 4</Badge>
            <h2 className="text-2xl font-bold">Timed Execution</h2>
            <p className="text-muted-foreground mt-2">
              As students progress, Boss Battles become timed. This phase introduces controlled pressure, training calm execution under stress. Timed Execution is the final stage of the transformation process.
            </p>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold">What It Is</h3>
              <p className="text-sm text-muted-foreground">
                Timed Execution means students attempt Boss Battles with a time limit. The goal is not speed, but stable execution under pressure. Students must read carefully, identify what they know, and execute the method calmly.
              </p>

              <h3 className="text-lg font-bold mt-6">How to Use It</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Assign a Boss Battle with a clear time limit (e.g., 5 minutes).</li>
                <li>Remind the student: pressure is part of the training, not a test.</li>
                <li>Observe their response: do they freeze, rush, or execute calmly?</li>
                <li>Debrief after: focus on process, not just result.</li>
                <li>Log the attempt in the Boss Battle Tracker.</li>
              </ul>

              <div className="bg-primary/5 p-4 rounded-lg border border-primary/30 mt-4">
                <p className="text-sm font-semibold text-foreground mb-2">Critical Rule:</p>
                <p className="text-xs text-muted-foreground">
                  Timed Execution is not about speed. It's about training calm, reliable execution under pressure. Use it only after the student has mastered the concept and method.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* The Law of Inevitability */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">The Law of Inevitability</h2>
          
          <Card className="p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/30">
            <p className="text-base leading-relaxed mb-6 text-foreground">
              This is the philosophy behind everything. Confidence is not taught. It's inevitable when the conditions are right.
            </p>

            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Clarity</p>
                  <p className="text-sm text-muted-foreground">Students know exactly what to do. No guessing. No ambiguity. Clear process, clear language, clear standards.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Systems</p>
                  <p className="text-sm text-muted-foreground">Repeatable processes replace guesswork. When they see x², they know the system. When they see a word problem, they know the system. Systems eliminate uncertainty.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Repetition</p>
                  <p className="text-sm text-muted-foreground">Response patterns get trained through repetition. One exposure doesn't create a habit. Ten exposures start to. Fifty exposures make it automatic.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Consistency</p>
                  <p className="text-sm text-muted-foreground">Standards stay constant. You don't lower expectations. You don't accept imprecise language. You don't skip the 3-Layer Lens. Consistency trains reliability.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Inevitability</p>
                  <p className="text-sm text-muted-foreground">Confidence emerges. Not because you taught it. Because you built the conditions. When a student executes clearly, systematically, repeatedly, and consistently - confidence becomes inevitable.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-primary/20">
              <p className="text-sm font-semibold text-foreground">
                You don't motivate confidence. You don't inspire confidence. You create the conditions where confidence has no choice but to emerge.
              </p>
            </div>
          </Card>
        </div>

        {/* Your Role */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Your Role as System Executor</h2>
          
          <Card className="p-6 border-2 border-primary/20">
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                You are not a teacher. You are a <span className="font-semibold text-foreground">system executor</span>.
              </p>
              
              <p className="text-base leading-relaxed text-muted-foreground">
                Your job is not to be creative, warm, motivational, or inspiring. Your job is to run Response Integrity-OS with precision and consistency.
              </p>

              <div className="space-y-2 my-4">
                <p className="font-semibold text-sm">What this means:</p>
                <ul className="text-sm space-y-1 text-muted-foreground ml-4">
                  <li>• Apply the 3-Layer Lens to every error</li>
                  <li>• Introduce Boss Battles when students feel comfortable</li>
                  <li>• Follow Model → Apply → Guide for every concept</li>
                  <li>• Correct vocabulary immediately, every time</li>
                  <li>• Train response patterns, not just content knowledge</li>
                  <li>• Hold standards constant - never lower expectations</li>
                  <li>• Trust the system, even when students resist</li>
                </ul>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/30">
                <p className="text-sm font-semibold text-foreground mb-2">
                  When you execute the system, students transform.
                </p>
                <p className="text-sm text-muted-foreground">
                  Not because you're inspiring. Not because you're warm. Not because you're motivational. Because the system works.
                </p>
              </div>

              <p className="text-base leading-relaxed text-foreground font-semibold pt-4">
                Execute Response Integrity-OS. That's your job. Everything else is noise.
              </p>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
