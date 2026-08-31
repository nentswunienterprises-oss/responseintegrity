import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, Brain, Lightbulb, Users, Target, BookOpen, Clock, Award,
  CheckCircle2, ArrowRight, ChevronDown, ChevronUp, MessageSquare, RefreshCw, ArrowLeft
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function TutorBlueprint() {
  const [activeModule, setActiveModule] = useState<number>(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const moduleContentRef = useRef<HTMLDivElement>(null);
  const [completedModules, setCompletedModules] = useState<number[]>([]);
  const navigate = useNavigate();

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const markModuleComplete = (moduleId: number) => {
    if (!completedModules.includes(moduleId)) {
      setCompletedModules([...completedModules, moduleId]);
    }
  };

  const progressPercent = (completedModules.length / 7) * 100;

  // Scroll to module content on mobile when module changes
  const handleModuleClick = (moduleId: number) => {
    setActiveModule(moduleId);
    // On mobile, scroll to the module content
    if (window.innerWidth < 768 && moduleContentRef.current) {
      setTimeout(() => {
        moduleContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Back to Pod Button */}
      <Button 
        variant="outline" 
        onClick={() => navigate("/specialist/pod")}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Pod
      </Button>

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-4 sm:p-8 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Sparkles className="w-6 h-6 sm:w-10 sm:h-10" />
            <h1 className="text-xl sm:text-4xl font-bold">Your Transformation Formula</h1>
          </div>
          <p className="text-sm sm:text-lg opacity-95 max-w-2xl mb-4 sm:mb-6">
            Master the 7 modules that transform tutors into confidence-building leaders. 
          </p>
          
          {/* Progress Bar */}
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 sm:p-4 max-w-md border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold">Your Progress</span>
              <span className="text-xs sm:text-sm font-bold">{completedModules.length}/7 Complete</span>
            </div>
            <Progress value={progressPercent} className="h-2 sm:h-3 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Module Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
        {[
          { id: 1, title: "3-Layer Lens", icon: Brain },
          { id: 2, title: "Tutoring Psychology", icon: Lightbulb },
          { id: 3, title: "Intro Session", icon: Users },
          { id: 4, title: "First Session", icon: Target },
          { id: 5, title: "Execution Process", icon: BookOpen },
          { id: 6, title: "Balance Systems", icon: Clock },
          { id: 7, title: "Time Mastery", icon: Award },
        ].map((module) => {
          const Icon = module.icon;
          const isComplete = completedModules.includes(module.id);
          const isActive = activeModule === module.id;
          
          return (
            <Card
              key={module.id}
              className={`cursor-pointer transition-all duration-300 ${
                isActive ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md hover:border-primary/30'
              } ${isComplete ? 'bg-accent border-primary/20' : ''}`}
              onClick={() => handleModuleClick(module.id)}
            >
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  {isComplete && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                </div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">Module {module.id}</p>
                <p className="text-xs sm:text-sm font-bold mt-0.5 sm:mt-1 line-clamp-2">{module.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Module Content */}
      <div ref={moduleContentRef} className="space-y-6 scroll-mt-4">
        {activeModule === 1 && (
          <ModuleOne 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(1)}
            isComplete={completedModules.includes(1)}
          />
        )}
        {activeModule === 2 && (
          <ModuleTwo 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(2)}
            isComplete={completedModules.includes(2)}
          />
        )}
        {activeModule === 3 && (
          <ModuleThree 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(3)}
            isComplete={completedModules.includes(3)}
          />
        )}
        {activeModule === 4 && (
          <ModuleFour 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(4)}
            isComplete={completedModules.includes(4)}
          />
        )}
        {activeModule === 5 && (
          <ModuleFive 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(5)}
            isComplete={completedModules.includes(5)}
          />
        )}
        {activeModule === 6 && (
          <ModuleSix 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(6)}
            isComplete={completedModules.includes(6)}
          />
        )}
        {activeModule === 7 && (
          <ModuleSeven 
            expandedSections={expandedSections} 
            toggleSection={toggleSection}
            onComplete={() => markModuleComplete(7)}
            isComplete={completedModules.includes(7)}
          />
        )}
      </div>
    </div>
  );
}

// Module Component Props
interface ModuleProps {
  expandedSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
  onComplete: () => void;
  isComplete: boolean;
}

// Reusable Components
function SectionCard({ 
  id, 
  title, 
  children, 
  expanded, 
  onToggle,
  gradient = "from-purple-500 to-pink-500"
}: { 
  id: string; 
  title: string; 
  children: React.ReactNode; 
  expanded: boolean; 
  onToggle: () => void;
  gradient?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className={`cursor-pointer bg-gradient-to-r ${gradient} text-white p-3 sm:p-6`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-xl leading-tight">{title}</CardTitle>
          {expanded ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
        </div>
      </CardHeader>
      {expanded && <CardContent className="p-3 sm:p-6 pt-4 sm:pt-6">{children}</CardContent>}
    </Card>
  );
}

function ModuleOne({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Brain className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 1: The 3-Layer Lens Teaching Model</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                "Model. Apply. Guide." - The student doesn't just learn the skill, they own it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-accent p-4 sm:p-6 rounded-lg border border-primary/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
              What Is the 3-Layer Lens?
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
              It's the internal structure of every math concept. Every problem a student sees can be broken down into 3 key learning layers:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-card p-3 sm:p-4 rounded-lg border-2 border-primary/40">
                <h4 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">Vocabulary</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">What is it called? What are the terms?</p>
                <Badge variant="outline" className="text-[10px] sm:text-xs">"Do I understand what I'm working with?"</Badge>
              </div>
              
              <div className="bg-card p-3 sm:p-4 rounded-lg border-2 border-primary/40">
                <h4 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">Method</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">What are the steps? How do I solve it?</p>
                <Badge variant="outline" className="text-[10px] sm:text-xs">"Am I following a reliable, structured path?"</Badge>
              </div>
              
              <div className="bg-card p-3 sm:p-4 rounded-lg border-2 border-primary/40">
                <h4 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">Reason</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">Why do those steps work? What's the logic?</p>
                <Badge variant="outline" className="text-[10px] sm:text-xs">"Can I explain the why behind what I did?"</Badge>
              </div>
            </div>
            
            <p className="mt-4 sm:mt-6 text-center font-semibold text-sm sm:text-lg">
              The 3-Layer Lens is how Response Integrity tutors teach, test, and diagnose mastery.
            </p>
          </div>

          <SectionCard
            id="module1-flow"
            title="How the 3-Layer Lens Powers a Session"
            expanded={expandedSections["module1-flow"] || false}
            onToggle={() => toggleSection("module1-flow")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-start gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">1</div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm sm:text-lg mb-1 sm:mb-2">Step 1: MODEL - "Get them READY."</h4>
                  <ul className="space-y-1 sm:space-y-2 text-muted-foreground list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                    <li>The tutor solves a full problem out loud</li>
                    <li>Uses all 3 layers - calls out terms, follows steps, explains logic</li>
                    <li>Student watches and listens</li>
                    <li className="italic font-semibold">"This is what it looks like when it's done right."</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-primary/80 text-white flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">2</div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm sm:text-lg mb-1 sm:mb-2">Step 2: APPLY - "Let them FIRE."</h4>
                  <ul className="space-y-1 sm:space-y-2 text-muted-foreground list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                    <li>Student does a similar problem right after</li>
                    <li>Tutor supports - but doesn't lead</li>
                    <li>Let them struggle strategically</li>
                    <li className="italic font-semibold">"They don't attempt the skill - they experience it."</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-primary/60 text-white flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">3</div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm sm:text-lg mb-1 sm:mb-2">Step 3: GUIDE - "Now we AIM."</h4>
                  <ul className="space-y-1 sm:space-y-2 text-muted-foreground list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                    <li>The tutor corrects, refines, and clarifies</li>
                    <li>Points out which layer needs reinforcement</li>
                    <li className="italic">"You knew the terms (Vocab), and you remembered the steps (Method), but you didn't explain why we flipped the fraction (Reason). Let's fix that."</li>
                    <li className="italic font-semibold">"They start to see how they learn, not just what they learned."</li>
                  </ul>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module1-boss"
            title="Boss Battles & The 3-Layer Lens"
            expanded={expandedSections["module1-boss"] || false}
            onToggle={() => toggleSection("module1-boss")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-3 sm:space-y-4">
              <p className="font-semibold text-sm sm:text-base">A Boss Battle challenges the student to use all 3 layers:</p>
              <ul className="space-y-1 sm:space-y-2 text-muted-foreground list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                <li>Can they recognize and define the terms?</li>
                <li>Can they follow a clear step-by-step method on their own?</li>
                <li>Can they explain why each move was legit?</li>
              </ul>
              
              <div className="bg-accent p-3 sm:p-4 rounded-lg mt-3 sm:mt-4 border border-primary/10">
                <p className="font-bold text-sm sm:text-base mb-2">The Boss Battle is the field. The 3-Layer Lens is the weapon.</p>
              </div>

              <div className="mt-4 sm:mt-6">
                <h4 className="font-bold text-sm sm:text-base mb-2 sm:mb-3">If They Struggle in a Boss Battle:</h4>
                <div className="bg-card p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">Use the Lens as a Diagnostic Tool:</p>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <table className="w-full min-w-[300px] text-xs sm:text-base">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Question</th>
                          <th className="text-left p-2">Which Layer is Broken?</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2">"What does this word mean?"</td>
                          <td className="p-2"><Badge className="bg-primary text-[10px] sm:text-xs">Vocabulary</Badge></td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2">"What's your first step?"</td>
                          <td className="p-2"><Badge className="bg-primary text-[10px] sm:text-xs">Method</Badge></td>
                        </tr>
                        <tr>
                          <td className="p-2">"Why does that step work?"</td>
                          <td className="p-2"><Badge className="bg-primary text-[10px] sm:text-xs">Reason</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 sm:mt-4 font-semibold text-sm sm:text-base">Then:</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-xs sm:text-base">
                    <li>Re-teach and reinforce that specific layer</li>
                    <li>Assign a rematch Boss Battle in the next session</li>
                  </ul>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">Why This Is Bulletproof</h4>
            <ul className="space-y-1 sm:space-y-2 list-disc pl-4 sm:pl-5 text-sm sm:text-base">
              <li>Visual & model-based teaching = stronger memory retention</li>
              <li>Repetition of method + explanation = real confidence</li>
              <li>Failsafe system for catching errors and learning from them</li>
              <li>Clear, structured loop keeps sessions focused, efficient, and powerful</li>
            </ul>
            <p className="mt-6 text-lg font-bold italic border-t border-white/20 pt-4">
              "Practice makes perfect" is a lie.<br />
              We believe: Practice makes improvement.
            </p>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 1 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleTwo({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Lightbulb className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 2: Response Integrity's Response Psychology</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                "We're not homework completers. We're response trainers, guides, and system-builders."
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <SectionCard
            id="module2-doctor"
            title="1. The Tutor is a Doctor"
            expanded={expandedSections["module2-doctor"] || false}
            onToggle={() => toggleSection("module2-doctor")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-3 sm:space-y-4">
              <p className="font-semibold text-sm sm:text-base">A student isn't a project. They're a patient.</p>
              <p className="text-sm sm:text-base">They walk in with:</p>
              <ul className="space-y-1 sm:space-y-2 text-muted-foreground ml-4 text-xs sm:text-base">
                <li>Hidden pains (topics that never made sense)</li>
                <li>Emotional injuries (shame, fear, anxiety)</li>
                <li>Symptoms (giving up, blanking out, rushing, avoiding questions)</li>
              </ul>
              
              <div className="bg-accent p-3 sm:p-4 rounded-lg mt-3 sm:mt-4 border border-primary/10">
                <p className="font-bold mb-2">The Response Integrity Tutor's job:</p>
                <ul className="space-y-1 list-disc pl-5">
                  <li>Diagnose the pain</li>
                  <li>Prescribe the system</li>
                  <li>Treat consistently with structure and strategy</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module2-prescription"
            title="2. Our Prescription = The 3-Layer Lens"
            expanded={expandedSections["module2-prescription"] || false}
            onToggle={() => toggleSection("module2-prescription")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <p className="font-semibold">We don't throw answers. We give students the mental tools to understand, fix, and solve.</p>
              
              <div className="overflow-x-auto -mx-3 sm:mx-0 mt-3 sm:mt-4">
                <table className="w-full border min-w-[400px] text-xs sm:text-base">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 sm:p-3 text-left">Layer</th>
                      <th className="p-2 sm:p-3 text-left">What We Train</th>
                      <th className="p-2 sm:p-3 text-left">Why It Heals</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Vocabulary</Badge></td>
                      <td className="p-2 sm:p-3">The terms</td>
                      <td className="p-2 sm:p-3">Builds clarity, reduces confusion</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Method</Badge></td>
                      <td className="p-2 sm:p-3">The steps</td>
                      <td className="p-2 sm:p-3">Gives security, lowers panic</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Reason</Badge></td>
                      <td className="p-2 sm:p-3">The logic</td>
                      <td className="p-2 sm:p-3">Builds mastery, ends memorization struggles</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-accent p-3 sm:p-4 rounded-lg mt-3 sm:mt-4 border border-primary/10">
                <p className="font-bold text-center text-sm sm:text-base">This system works whether the tutor is a genius or not.</p>
                <p className="text-center mt-2 text-xs sm:text-base">The tutor doesn't need to feel confident - they need to trust the process.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module2-vibe"
            title="3. The Vibe = Coach, Doctor, Mentor"
            expanded={expandedSections["module2-vibe"] || false}
            onToggle={() => toggleSection("module2-vibe")}
            gradient="from-primary to-primary/70"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div className="bg-accent p-3 sm:p-4 rounded-lg border border-primary/10">
                <h4 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 text-primary">We are...</h4>
                <ul className="space-y-1 sm:space-y-2 list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                  <li>A mentor</li>
                  <li>A strategist</li>
                  <li>A coach</li>
                  <li>A partner</li>
                </ul>
              </div>
              <div className="bg-muted p-3 sm:p-4 rounded-lg border border-border">
                <h4 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 text-destructive">We are not...</h4>
                <ul className="space-y-1 sm:space-y-2 list-disc pl-4 sm:pl-5 text-xs sm:text-base">
                  <li>A lecturer</li>
                  <li>A solver</li>
                  <li>A performer</li>
                  <li>A parent</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-4 bg-card border-l-4 border-primary">
              <p>We don't force understanding - we train it through process.</p>
              <p className="mt-2">We don't teach for correctness - we teach for effectiveness.</p>
            </div>
          </SectionCard>

          <SectionCard
            id="module2-system"
            title="4. The Student's Job = Follow the System, Not Their Feelings"
            expanded={expandedSections["module2-system"] || false}
            onToggle={() => toggleSection("module2-system")}
            gradient="from-primary/90 to-primary/70"
          >
            <div className="space-y-4">
              <p>Students come in with fear, frustration, self-doubt. That's normal. That's human.</p>
              <p className="font-semibold">But our response is not "try harder." It's "use the system."</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Because systems:</p>
                <ul className="space-y-2 list-disc pl-5">
                  <li>Don't get tired</li>
                  <li>Don't panic</li>
                  <li>Don't give up when the concept looks scary</li>
                  <li>Break things down into steps, and steps make anything learnable</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module2-process"
            title="5. The Response Integrity Teaching Process = Ready, Fire, Aim"
            expanded={expandedSections["module2-process"] || false}
            onToggle={() => toggleSection("module2-process")}
            gradient="from-primary to-primary/80"
          >
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full border min-w-[400px] text-xs sm:text-base">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 sm:p-3 text-left">Phase</th>
                    <th className="p-2 sm:p-3 text-left">Tutor Does</th>
                    <th className="p-2 sm:p-3 text-left">Student Does</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-2 sm:p-3 font-bold">Ready</td>
                    <td className="p-2 sm:p-3">Model a problem using 3-Layer Lens</td>
                    <td className="p-2 sm:p-3">Watch, listen</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2 sm:p-3 font-bold">Fire</td>
                    <td className="p-2 sm:p-3">Makes student attempt a similar problem</td>
                    <td className="p-2 sm:p-3">Engage, apply, make mistakes</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2 sm:p-3 font-bold">Aim</td>
                    <td className="p-2 sm:p-3">Tutor gives feedback using the lens</td>
                    <td className="p-2 sm:p-3">Reflect, correct, grow</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 sm:mt-4 text-center font-semibold text-sm sm:text-base">This loop builds understanding - not just accuracy.</p>
          </SectionCard>

          <SectionCard
            id="module2-learn"
            title="6. Even the Tutor Can Learn While Tutoring"
            expanded={expandedSections["module2-learn"] || false}
            onToggle={() => toggleSection("module2-learn")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <p className="font-semibold">We are not afraid of what we don't know.</p>
              <p>If the concept is unfamiliar:</p>
              <ol className="space-y-3 ml-4">
                <li>1. Use a tool like ChatGPT to learn it fast (not during a session, before)</li>
                <li>2. Break it down using the 3-Layer Lens</li>
                <li>3. Re-teach it to the student in a simpler, cleaner way</li>
                <li>4. Empower them using the 3-Layer Lens system</li>
              </ol>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold text-center italic">
                  "If I can learn it through the system, I can teach it through the system."
                </p>
                <p className="text-center mt-2">That's how every Response Integrity tutor stays coachable, adaptable, and sharp.</p>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-xl mb-4">Final Principle:</h4>
            <p className="text-lg mb-4">Our goal isn't to make students smart.<br />Our goal is to make them strategic.</p>
            <p>They don't leave our sessions just knowing answers.</p>
            <p className="font-bold mt-2">They leave knowing how to find answers, fix mistakes, and trust their minds again.</p>
            
            <div className="mt-6 pt-6 border-t border-white/20">
              <h4 className="font-bold mb-3">Response Integrity Tutor Code:</h4>
              <ul className="space-y-2 list-disc pl-5">
                <li>"I don't give knowledge. I build understanding."</li>
                <li>"I don't need to be perfect. I need to rely on systems."</li>
                <li>"I don't push feelings. I train thinking."</li>
                <li>"I don't fear confusion. I break it into layers."</li>
              </ul>
            </div>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 2 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Placeholder components for remaining modules
function ModuleThree({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 3: The Real Response Integrity Intro Session Blueprint</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                4-part flow to connect, surface pains, diagnose, and anchor
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-accent p-4 sm:p-6 rounded-lg border border-primary/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">4-Part Flow (Know the Person)</h3>
            <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Start with the heart. Let the student feel heard and human.
            </p>
          </div>

          <SectionCard
            id="module3-connect"
            title="1. Connect  Who Are You? (25-45 min)"
            expanded={expandedSections["module3-connect"] || false}
            onToggle={() => toggleSection("module3-connect")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-3 sm:space-y-4">
              <p className="font-bold">Key Prompts:</p>
              <ul className="space-y-2 ml-4">
                <li>"What's something in life or school you're proud of this year?"</li>
                <li>"What's your dream life or job?"</li>
                <li>"What subject just gets you and which one drains you?"</li>
                <li>"If school was a playlist, what's your skip button?"</li>
              </ul>
              
              <div className="bg-accent p-4 rounded-lg mt-4 border border-primary/10">
                <p className="font-bold mb-2">What You're Doing:</p>
                <ul className="space-y-1 list-disc pl-5">
                  <li>Finding emotional drivers</li>
                  <li>Spotting hidden confidence issues</li>
                  <li>Beginning to build trust and rapport</li>
                  <li>Logging student identity cues</li>
                </ul>
              </div>

              <div className="mt-6">
                <p className="font-bold mb-3">Expanded Student Identity Prompts</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-sm mb-2">Mindset & Self-Perception</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"When do you feel most like yourself?"</li>
                      <li>"What do you wish adults & parents understood better about you?"</li>
                      <li>"If your brain had a voice, what would it say after a bad test?"</li>
                      <li>"What's something you believe about yourself that no one sees?"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">Values & Emotional Landscape</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"What kind of person do you want to be remembered as?"</li>
                      <li>"What's something that makes you feel safe? What makes you feel anxious?"</li>
                      <li>"If you had a reset button for this year, what would you change?"</li>
                      <li>"Who's someone in your life you deeply respect, and why?"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">Coping</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"What's something you do that helps you feel proud or strong?"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">Social & Cultural Identity</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"What do people usually get wrong about you?"</li>
                      <li>"What does your culture, family, or background mean to you?"</li>
                      <li>"Who do you look up to - in real life or online - and what do they teach you?"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">Creativity & Imagination</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"If your life was a movie, what's the plot right now?"</li>
                      <li>"What kind of stories or characters speak to you most?"</li>
                      <li>"If you could design your own subject in school, what would it be called?"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">Dreams & Inner Drive</p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>"What's a dream you haven't told anyone about?"</li>
                      <li>"What's something you really want - even if it feels out of reach/impossible?"</li>
                      <li>"If nothing could stop you, what would you be doing five years from now?"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-muted p-4 rounded-lg">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student shares personal insights</li>
                  <li>Student feels relaxed, safe and seen by end of segment (measured by tone change or smile)</li>
                </ul>
              </div>

              <div className="mt-4 bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Greeted warmly and set casual tone</li>
                  <li>Asked emotional driver questions - made it a first friendly date convo, not a job interview</li>
                  <li>Logged identity cues in Student Identity Sheet</li>
                  <li>Recorded all student answers in Google Docs</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module3-surface"
            title="2. Surface the Pains  What Feels Off? (57 min)"
            expanded={expandedSections["module3-surface"] || false}
            onToggle={() => toggleSection("module3-surface")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <p>Now it's time to address math! Before showing them problems, ask what never made sense.</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Questions (Human-Diagnostic Style):</p>
                <ul className="space-y-2 list-disc pl-5">
                  <li>"Which topics in math have always felt confusing, no matter how many times they explained it?"</li>
                  <li>"Are there moments in math where you just freeze or feel lost?"</li>
                  <li>"Which topics do you secretly wish made more sense?"</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border-l-4 border-primary mt-4">
                <p className="font-bold mb-2">Power Line:</p>
                <p className="italic">"If you woke up and forgot all of math, I'd still be excited to walk you through it. I don't care what you get wrong  I care about what we build together."</p>
              </div>

              <div className="mt-4 bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-2">What You're Doing:</p>
                <ul className="space-y-1 list-disc pl-5">
                  <li>Letting them reveal pain points without shame</li>
                  <li>Showing you're not here to test - they're here to be helped</li>
                  <li>Treating them like a real client and patient, not just a student</li>
                </ul>
              </div>

              <div className="mt-4 bg-muted p-4 rounded-lg">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student names at least 2 confusing math topics without hesitation</li>
                  <li>Student feels safe admitting academic struggles (no defensiveness)</li>
                </ul>
              </div>

              <div className="mt-4 bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Asked non-judgmental questions</li>
                  <li>Listened deeply without correcting</li>
                  <li>Wrote down student pain points</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module3-diagnose"
            title="3. Diagnose  Why Is This Happening? (1015 min)"
            expanded={expandedSections["module3-diagnose"] || false}
            onToggle={() => toggleSection("module3-diagnose")}
            gradient="from-primary to-primary/70"
          >
            <div className="space-y-4">
              <p className="font-semibold">Now that you know the symptoms, you're here to diagnose the root.</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">How:</p>
                <ul className="space-y-2 ml-4">
                  <li>Give 1-2 quick problems based on their pain points</li>
                  <li>Watch and listen - don't interrupt</li>
                </ul>
              </div>

              <div className="mt-3 sm:mt-4">
                <p className="font-bold text-sm sm:text-base mb-2 sm:mb-3">Then ask yourself: Which 3-Layer Lens layer is broken?</p>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full border min-w-[350px] text-xs sm:text-base">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 sm:p-3 text-left">Layer</th>
                        <th className="p-2 sm:p-3 text-left">What to Look For</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Vocabulary</Badge></td>
                        <td className="p-2 sm:p-3">They don't understand the terms ("What's a numerator again?")</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Method</Badge></td>
                        <td className="p-2 sm:p-3">They try random steps or skip around</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 sm:p-3"><Badge className="bg-primary text-[10px] sm:text-xs">Reason</Badge></td>
                        <td className="p-2 sm:p-3">They memorize but don't know why it works</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-accent p-4 rounded-lg mt-4 border border-primary/10">
                <p className="font-bold mb-2">What You're Doing:</p>
                <ul className="space-y-1 list-disc pl-5">
                  <li>Identifying their learning fracture</li>
                  <li>Spotting how they think, not just what they know</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border-l-4 border-primary mt-4">
                <p className="font-bold mb-2">Power Lines:</p>
                <p className="italic">"This isn't a mistake. It's a clue."</p>
                <p className="italic mt-2">"If we fix the right layer, the whole thing starts making sense."</p>
              </div>

              <div className="mt-4 bg-muted p-4 rounded-lg">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Tutor correctly identifies if fracture is Vocabulary, Method, or Reason</li>
                  <li>Tutor can explain in 1-2 sentences why the student struggles</li>
                </ul>
              </div>

              <div className="mt-4 bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Gave 1-2 sample problems based on pain points</li>
                  <li>Observed problem-solving style quietly</li>
                  <li>Marked which layer (Vocab, Method, Reason) needs focus</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module3-anchor"
            title="4. Anchor  What's the Plan? (5-7 min)"
            expanded={expandedSections["module3-anchor"] || false}
            onToggle={() => toggleSection("module3-anchor")}
            gradient="from-primary/90 to-primary/80"
          >
            <div className="space-y-4">
              <p className="font-semibold">Reconnect them to hope, strategy, and structure.</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">What to Do:</p>
                <ul className="space-y-2 list-disc pl-5">
                  <li>Reflect their strengths: "You think visually. You explain well. You're a builder."</li>
                  <li>Share your insight: "Your confidence breaks when the vocabulary isn't clear - so we'll start there."</li>
                  <li>Introduce Response Integrity's tools:</li>
                </ul>
                <ul className="ml-6 mt-2 space-y-1">
                  <li>Learning ID (Lawyer; Problem-Solver/Entrepreneur; Movie Director; Doctor)</li>
                  <li>Solutions Unlocked (lesson comprehension / successful 3 layer applications/superpowers gained)</li>
                  <li>Boss Battle Log (Brutal problems solved)</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border-l-4 border-primary mt-4">
                <p className="font-bold mb-2">Power Line:</p>
                <p className="italic">"We don't tutor. We train minds. And this? This is just your journey's beginning."</p>
                <p className="mt-3">Say something like: "These trackers are your map. Every hero needs one. We're not just going to guess if you're improving - we'll prove it."</p>
                <ul className="mt-2 space-y-1">
                  <li>Walk through how the system works</li>
                  <li>Let them ask questions - it builds buy-in</li>
                </ul>
              </div>

              <div className="mt-4 bg-muted p-4 rounded-lg">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student leaves with simple, hopeful understanding of next steps</li>
                  <li>Parent/guardian receives a proposal</li>
                </ul>
              </div>

              <div className="mt-4 bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Deliverables After Session:</p>
                <ul className="space-y-1 text-sm">
                  <li>Log Student Identity Sheet</li>
                  <li>Send Proposal within 24 hours</li>
                </ul>
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
            </div>
          </SectionCard>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 3 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleFour({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Target className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 4: The First Session Blueprint</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                "The Launchpad" - Set the tone, system, and student up to win
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-accent p-4 sm:p-6 rounded-lg border border-primary/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Session Goal:</h3>
            <ul className="space-y-1 sm:space-y-2 list-disc pl-4 sm:pl-5 text-xs sm:text-base">
              <li>Translate the intro session into a trackable action plan</li>
              <li>Set up the student's Response Integrity Identity (Lawyer or Problem-Solver)</li>
              <li>Make the student feel seen, smart, and safe</li>
              <li>Begin light practice that's strategic, not stressful</li>
            </ul>
          </div>

          <SectionCard
            id="module4-prep"
            title="Pre-Session Tutor Responsibilities"
            expanded={expandedSections["module4-prep"] || false}
            onToggle={() => toggleSection("module4-prep")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-4">
              <p className="font-bold">Review the Intro Session Deliverables</p>
              
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-bold mb-2">KPI</p>
                <p className="text-sm">Tutor has student's trackers ready</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Know before you go</li>
                  <li>Review Student identity</li>
                  <li>Have teaching material ready</li>
                  <li>Mentally review "growth mindset" opening (not perfection mindset)</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <div className="bg-card p-6 rounded-lg border border-primary/20">
            <h3 className="text-xl font-bold mb-4">Step-by-Step Flow of First Session</h3>
          </div>

          <SectionCard
            id="module4-welcome"
            title="1. Welcome"
            expanded={expandedSections["module4-welcome"] || false}
            onToggle={() => toggleSection("module4-welcome")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <ul className="space-y-2 ml-4">
                <li>Welcome student + smile check</li>
                <li>Introduce yourself again briefly</li>
              </ul>
              
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student shows visible comfort (smiling, open body language) within 5 minutes</li>
                  <li>Student recalls previous session's momentum</li>
                </ul>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Greet student warmly, re-introduce lightly</li>
                  <li>Confirm emotional safety ("This is your space. Growth over perfection.")</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module4-microwin"
            title="2. Skill Preview & Micro-Win Practice (15-20 min)"
            expanded={expandedSections["module4-microwin"] || false}
            onToggle={() => toggleSection("module4-microwin")}
            gradient="from-primary to-primary/70"
          >
            <div className="space-y-4">
              <p>Pick a light version of their weakest concept</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Follow the Response Integrity teaching model:</p>
                <ul className="space-y-2 ml-4">
                  <li>Model the process</li>
                  <li>Let them Apply the method</li>
                  <li>Guide and correct gently</li>
                  <li>Reinforce with a win</li>
                  <li>Embrace 3-layer lens</li>
                </ul>
              </div>

              <p className="italic mt-4 text-sm border-l-4 border-primary pl-4">Win = Momentum. You're not trying to teach a full conceptyou're showing them that they can.</p>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Tutor and student successfully completes 1 micro-win activity</li>
                  <li>Student shows increased confidence or reduced fear with the step-by-step process</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Select a micro-concept based on diagnosis (start small)</li>
                  <li>Model → Apply → Correct → Reinforce (Response Integrity Teaching Model)</li>
                  <li>Celebrate every partial win</li>
                  <li>Record micro-win on Challenge Tracker</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module4-boss"
            title="3. Assign First Boss Battle (5 min)"
            expanded={expandedSections["module4-boss"] || false}
            onToggle={() => toggleSection("module4-boss")}
            gradient="from-primary/90 to-primary/80"
          >
            <div className="space-y-4">
              <p>Test the waters with few more examples and practice then start the first log.</p>
              
              <div className="bg-card p-4 rounded-lg border-l-4 border-primary">
                <p className="font-bold mb-2">Explain:</p>
                <p className="italic">"Here and there, you get a Boss Battle. It's just one challenge to show what you've learned."</p>
              </div>

              <div className="mt-4">
                <p className="font-semibold mb-2">Let them try the problem</p>
                <p className="text-sm mb-2">Log the result in the Boss Battle Tracker</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-2">Celebrate either way:</p>
                <ul className="space-y-1 list-disc pl-5">
                  <li>"Great job getting it done. You now understand how to use the 3 layers to approach tough problems"</li>
                  <li>"Next week, we'll beat this. Easy."</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student completes Boss Battle attempt without giving up</li>
                  <li>Result logged (pass or growth opportunity)</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Frame Boss Battle positively ("Your first mini-mission.")</li>
                  <li>Present challenge (aligned to their skill preview)</li>
                  <li>Log result in Boss Battle Tracker</li>
                  <li>Celebrate either outcome: "Victory OR Lesson = Progress."</li>
                </ul>
              </div>

              <div className="mt-6 bg-primary/10 p-4 rounded-lg border border-primary/30">
                <p className="font-bold mb-3">Correction Framework:</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-sm mb-2">A. Let Them Explain First (Teach-Back Method)</p>
                    <p className="text-sm mb-2">Ask:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"Tell me what you did here."</li>
                      <li>"Walk me through your thought process."</li>
                    </ul>
                    <p className="text-sm mt-2 italic">Don't jump in to fix immediatelylet them reflect and verbalize. Scan for Reason.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">B. Use Live Correction</p>
                    <p className="text-sm">Fix the mistake with them, not for them.</p>
                    <p className="text-sm mt-2">Re-do the problem side-by-side, asking:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"What could we do differently here?"</li>
                      <li>"Which layer did we crack?"</li>
                    </ul>
                    <p className="text-sm mt-2">Use arrows, symbols, colors, or highlights to show the difference clearly.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">C. Celebrate the Recovery</p>
                    <p className="text-sm">Say things like:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"See? That's growth right there."</li>
                      <li>"Now you really understand it."</li>
                    </ul>
                    <p className="text-sm mt-2">Frame the mistake as part of the mission: "This is where most students get stuck. But not you anymore."</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">D. Record Learning Notes</p>
                    <p className="text-sm">Add a note in your Challenge Tracker:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>What was misunderstood?</li>
                      <li>What correction helped?</li>
                      <li>What should be reinforced next time?</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module4-close"
            title="4. Confirm Next Step + Reaffirm Confidence"
            expanded={expandedSections["module4-close"] || false}
            onToggle={() => toggleSection("module4-close")}
            gradient="from-primary to-primary/90"
          >
            <div className="space-y-4">
              <p className="font-semibold">Let them know what they'll focus on next session</p>
              
              <div className="bg-card p-4 rounded-lg border-l-4 border-primary">
                <p className="font-bold mb-2">Say:</p>
                <p className="italic">"Today we got your profile set up, explored your strengths, and started cracking the code on __. You're officially on the Response Integrity journey. You're gonna be a great problem-solver"</p>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student can explain in their own words what's next</li>
                  <li>Student leaves session feeling confident and seen</li>
                </ul>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Recap today's victories ("You built your learning system and cracked your first challenge.")</li>
                  <li>Preview next focus area ("Next time, we'll hit __ even harder.")</li>
                  <li>Speak belief into the student ("You're officially on your Response Integrity journey. You're built for this.")</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-xl mb-4">First Session Deliverables:</h4>
            <ul className="space-y-2 list-disc pl-5">
              <li>Session Logged</li>
              <li>Response Integrity Learning ID chosen</li>
              <li>First skill logged</li>
              <li>First Boss Battle recorded (optional)</li>
              <li>Student feels clear, supported, and hyped</li>
            </ul>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 4 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleFive({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 5: Ongoing Flow (Standardized Execution Process)</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                A structured, high-impact tutoring model that ensures every student continues receiving top-tier education
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <SectionCard
            id="module5-prepare"
            title="1. Prepare  Know Before You Go"
            expanded={expandedSections["module5-prepare"] || false}
            onToggle={() => toggleSection("module5-prepare")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Goal:</p>
                <p className="text-sm">Enter every session fully equipped. No guesswork. No improvising. A well-prepared tutor inspires trust, delivers more value, and uses time efficiently.</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Pre-Session Checklist:</p>
                <ol className="space-y-3 ml-4 text-sm">
                  <li>
                     <p className="font-semibold">1. Review Past Data</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Open the student's Tracker</li>
                      <li>Check their last few Boss Battles or Learning Notes</li>
                      <li>Look for: Topics frequently missed, Confidence dips, Skills that haven't been reinforced in the last 2 weeks</li>
                    </ul>
                  </li>
                  <li>
                     <p className="font-semibold">2. Identify the Session Objective</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Define what the student should achieve by the end of the session</li>
                      <li>Choose one clear objective or skill to focus on</li>
                      <li>Label it like a mini-quest: "Today's mission: ...."</li>
                    </ul>
                  </li>
                  <li>
                     <p className="font-semibold">3. Prepare Your Teaching Tools</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Write out your example problems beforehand</li>
                      <li>Keep secondary backup problems ready</li>
                      <li>Check your gooseneck camera setup</li>
                      <li>Trackers ready: Solutions Unlocked, Challenges Conquered, Boss Battles</li>
                    </ul>
                  </li>
                  <li>
                     <p className="font-semibold">4. Mentally Rehearse the Explanation</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Think: "How would I explain this to my younger self or a 6-year old?"</li>
                      <li>Break it into 3-5 micro-steps and write them down</li>
                      <li>Anticipate common mistakes</li>
                      <li>Optional: Add a metaphor or memory trick to make it stick</li>
                    </ul>
                  </li>
                  <li>
                     <p className="font-semibold">5. Plan a Warm Opening</p>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Start with confidence: "Last week you did great on ___. Today, we're going to conquer ___."</li>
                      <li>Use a compliment or small question to connect personally</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/30 mt-4">
                <p className="font-bold mb-2">Why This Step is Bulletproof:</p>
                <ul className="space-y-1 text-sm">
                  <li>Saves time & avoids confusion during the session</li>
                  <li>Builds the student's confidence from the very beginning</li>
                  <li>Makes you look and feel like a pro</li>
                  <li>Helps the rest of the session flow easily</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Tutor enters with 1 clear mission/skill pre-planned</li>
                  <li>Trackers are opened and reviewed before session starts</li>
                  <li>Backup problems and metaphors written out</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Reviewed last Boss Battle + tracker notes</li>
                  <li>Identified today's skill + goal</li>
                  <li>Wrote 2-3 example problems + 1 bonus</li>
                  <li>Rehearsed explanation mentally (3-5 micro-steps)</li>
                  <li>Setup environment + camera + workspace</li>
                  <li>Planned a phase-oriented opening</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module5-teach"
            title="2. Phase-Appropriate Instruction  Show Only When It Serves the Drill."
            expanded={expandedSections["module5-teach"] || false}
            onToggle={() => toggleSection("module5-teach")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Goal:</p>
                <p className="text-sm">Deliver phase-appropriate instruction. In Clarity, teach by modeling and guiding first-step understanding. In later phases, protect independent execution, pressure exposure, and accurate logging.</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">1. Use Visual Demonstration When The Phase Requires It</p>
                <ul className="space-y-1 text-sm ml-4">
                  <li>Use the Gooseneck Camera Setup to work through the problem in real time</li>
                  <li>Speak your thought process aloud: "First, I.... Then, I..."</li>
                  <li>Write cleanly and narrate each step when Clarity or concept-entry work requires it</li>
                </ul>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">2. Use the "Model-Apply-Guide" Loop In Clarity And Concept-Entry Work</p>
                <ol className="space-y-2 text-sm ml-4">
                  <li><strong>Step 1 (Model it):</strong> You solve an example out loud when the learner needs Clarity or concept entry</li>
                  <li><strong>Step 2 (Apply it):</strong> They try a similar problem and begin taking ownership of the method</li>
                  <li><strong>Step 3 (Guide them):</strong> Correct the gap without carrying the response</li>
                </ol>
                <div className="bg-primary/20 p-3 rounded mt-3 text-sm">
                  <p className="font-semibold mb-2">T/N: it's important to implement written step-by-step methods.</p>
                  <p>Students need clear steps, but steps are trained for execution, not memorized as a substitute for reasoning. Confidence follows when they can repeat the method under the right phase conditions.</p>
                </div>
                <p className="mt-3 text-sm">We call this the <strong>Ready, Fire, Aim</strong> approach (from T Harv's book, Secrets of The Millionaire Mind):</p>
                <ol className="ml-4 mt-2 space-y-1 text-sm">
                  <li>1. Model it for the student - get them "Ready", show them how to use the method</li>
                  <li>2. Make the student Apply the method - let the student "Fire" - do it, attempt it</li>
                  <li>3. Lead the student to use their mistakes to Guide them - Help them "Aim" and lock in accuracy</li>
                </ol>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">3. Key Check-Ins (after every move in each step)</p>
                <p className="text-sm mb-2">Ask things like:</p>
                <ul className="space-y-1 text-sm ml-4">
                  <li>"Can you explain why I did that?"</li>
                  <li>"What do you think happens next?"</li>
                </ul>
                <p className="text-sm mt-2 italic">This keeps them mentally invested and engaged</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">4. Teach in the 3 Layers</p>
                <p className="text-sm mb-2">Break the concept into bite-size chunks: The 3 Layer Lens</p>
                <ul className="space-y-1 text-sm ml-4">
                  <li><strong>Vocabulary</strong> - What's this called?</li>
                  <li><strong>Method</strong> - How do we solve it? step by step</li>
                  <li><strong>Reasoning</strong> - Why does it work?</li>
                </ul>
                <p className="text-sm mt-3 italic">you're building a lawyer who should defend every statement with a valid reason (see how you can make the student tie math to real life?)</p>
                <p className="text-sm mt-2">After the student masters all 3 layers of the lesson, track it down as/under "Solutions Unlocked".</p>
                <p className="text-sm mt-2">To test and strengthen the third layer (Reasoning), the student should be able to answer any "Why?" asked by the tutor.</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">5. Boss Battles</p>
                <p className="text-sm">When the learner's current phase and drill design call for it, introduce a Boss Battle challenge and record the response accurately.</p>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/30 mt-4">
                <p className="font-bold mb-2">Why This Step is Bulletproof:</p>
                <ul className="space-y-1 text-sm">
                  <li>Visual modeling is used when it serves Clarity or concept-entry work</li>
                  <li>The student doesn't just see the skill - they begin to own it</li>
                  <li>The looped structure means they're never passive</li>
                  <li>Confidence grows because the student proves stability under the correct level of support and pressure</li>
                  <li>Practice makes perfect is a lie, we believe practice makes improvement</li>
                  <li>Lawyer personality breeds a problem-solver identity (that's how students fall in love with math)</li>
                  <li>Progress is data, not a feeling. Every solution they unlock mentally - they just unlocked a new superpower</li>
                  <li>It's hard to make mistakes with the 3 Layer Lens (hack of A+ math students)</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student successfully applies the method with 80% accuracy after being shown</li>
                  <li>Student can identify which step they struggled with using 3-Layer Lens</li>
                  <li>Boss Battles issued only when the phase and drill design require them</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Modeled example clearly, narrating steps</li>
                  <li>Let student attempt similar problem(s)</li>
                  <li>Guided corrections using 3-Layer lens</li>
                  <li>Asked 2-3 engagement check-ins ("Why did I do that?" or "What's next?")</li>
                  <li>Highlighted success verbally: "That method is yours now."</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module5-correct"
            title="3. Reflect & Correct  Fix It to Master It."
            expanded={expandedSections["module5-correct"] || false}
            onToggle={() => toggleSection("module5-correct")}
            gradient="from-primary to-primary/70"
          >
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Goal:</p>
                <p className="text-sm">Use mistakes as moments of learning. Make the student feel safe to mess up - then use the mess to build mastery.</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Correction Framework:</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-sm mb-2">1. Let Them Explain First (Teach-Back Method)</p>
                    <p className="text-sm mb-2">Ask:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"Tell me what you did here."</li>
                      <li>"Walk me through your thought process."</li>
                    </ul>
                    <p className="text-sm mt-2 italic">Don't jump in to fix immediately - let them reflect and verbalize through the 3 Layer lens.</p>
                    <p className="text-sm mt-2">If they then realize they didn't approach it properly or have a "Wait a minute, ohhh I see now..." moment, let them go again e.g "Oh please, show me rather than telling how you could've done things differently."</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">2. Reinforce the 3 layers.</p>
                    <p className="text-sm">Fix the mistake with them, not for them.</p>
                    <p className="text-sm mt-2">Re-do the problem side-by-side, asking:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"What could we do differently here?"</li>
                      <li>"Where did things go off track?"</li>
                      <li>"Where did we make a mistake in our method?"</li>
                    </ul>
                    <p className="text-sm mt-2">Use arrows, symbols, colors, or highlights to show the difference clearly.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">3. Celebrate the Recovery</p>
                    <p className="text-sm">Say things like:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>"See? That's growth right there."</li>
                      <li>"Now you really understand it."</li>
                      <li>"Now we can record this moment under Challenges Bounced Back From"</li>
                    </ul>
                    <p className="text-sm mt-2">Frame the mistake as part of the mission: "This is where most students get stuck. But not you anymore."</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">4. Record Learning Notes</p>
                    <p className="text-sm">Add a note in your Challenge Tracker:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>What was misunderstood?</li>
                      <li>What correction helped?</li>
                      <li>What should be reinforced next time?</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/30 mt-4">
                <p className="font-bold mb-2">Why This Step is Bulletproof:</p>
                <ul className="space-y-1 text-sm">
                  <li>It normalizes making mistakes and replaces shame with strategy</li>
                  <li>Students reflect, correct, and build deeper understanding</li>
                  <li>Encourages metacognition - thinking about how they think</li>
                  <li>Creates emotional safety, which increases retention and effort</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Student verbalizes mistake using 3-Layer Lens</li>
                  <li>Tutor logs learning correction in Challenge Tracker</li>
                  <li>Student shows 1 visible "aha" moment</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Used Teach-Back: "Walk me through your process."</li>
                  <li>Identified error layer: Vocabulary / Method / Reason</li>
                  <li>Corrected side-by-side (not just told the answer)</li>
                  <li>Celebrated bounce-back moment</li>
                  <li>Logged learning notes in tracker</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module5-reinforce"
            title="4. Reinforce & Grow  Drill It. Track It. Win."
            expanded={expandedSections["module5-reinforce"] || false}
            onToggle={() => toggleSection("module5-reinforce")}
            gradient="from-primary/90 to-primary/80"
          >
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-lg border border-primary/20">
                <p className="font-bold mb-2">Goal:</p>
                <p className="text-sm">End the session with momentum. Reinforce the skill. Track performance. Celebrate wins. Prep next week's move.</p>
                <p className="text-sm mt-2 italic">Reinforcement = Retention. Tracking = Transformation.</p>
              </div>

              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <p className="font-bold mb-3">Post-Session Routine (Every Session)</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-sm mb-2">1. Assign a Boss Battle</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>Choose a challenge problem based on the day's skill - not a copy, but a remix</li>
                      <li>Deliver it as a mini-test: "This is a Boss Battle. No help. Let's see if it's impossible to be solved one go using the deadly method we just learned"</li>
                    </ul>
                    <p className="text-sm mt-2">If they complete it:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>Win - Celebrate and move forward</li>
                      <li>Struggle - Note the pattern → Reflect & Correct then loop it back into next week's plan</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">2. Update the Boss Battle Log</p>
                    <p className="text-sm">Log the Boss Battle results with these details:</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>Topic/Skill</li>
                      <li>Level of difficulty</li>
                      <li>Score or completion status</li>
                      <li>Notes on errors or progress</li>
                      <li>Add a confidence score if possible (1-5)</li>
                    </ul>
                    <p className="text-sm mt-2 italic">"Response Integrity tutors never guess - they track. Data builds decisions."</p>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-2">3. Motivate & Close Strong</p>
                    <ul className="ml-4 text-sm space-y-1">
                      <li>Give one specific piece of praise: "You asked the right questions today - that's elite learning."</li>
                      <li>Leave them with momentum: "Next week we level up. This is where it gets fun. I'm so proud of you."</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-bold mb-2">KPI</p>
                <ul className="space-y-1 text-sm">
                  <li>Boss Battle completed and tracked (win or rematch)</li>
                  <li>Confidence rating added (1-5 scale)</li>
                  <li>Next session direction clearly mapped out</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border border-primary/20 mt-4">
                <p className="font-bold mb-2">Checklist:</p>
                <ul className="space-y-1 text-sm">
                  <li>Assigned 1 new Boss Battle (based on session skill)</li>
                  <li>Updated Challenge & Boss Battle Trackers</li>
                  <li>Logged: topic, difficulty, win/loss, confidence score</li>
                  <li>Reinforced with motivational praise</li>
                  <li>Set goal for next session: Advance / Reinforce</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4">LEXICON SNAP-IN</h4>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm">Embed these phrases across tutor culture:</p>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[300px] text-xs sm:text-base">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="p-2 text-left">Phrase</th>
                    <th className="p-2 text-left">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  <tr className="border-b border-white/10">
                    <td className="p-2">"Boss Battle"</td>
                    <td className="p-2">A challenge task that tests full understanding</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">"Solutions Unlocked"</td>
                    <td className="p-2">A concept or skill fully mastered</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">"3-Layer Lens"</td>
                    <td className="p-2">The core diagnostic + teaching framework</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">"Model → Apply → Guide"</td>
                    <td className="p-2">Response Integrity's tutoring loop system</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">"Growth over perfection"</td>
                    <td className="p-2">Culture standard</td>
                  </tr>
                  <tr>
                    <td className="p-2">"Progress is data"</td>
                    <td className="p-2">Why we track everything</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 5 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleSix({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 6: Balancing Tutoring & School</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                Systems beat moods. Structure beats chaos. Every time.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-accent p-4 sm:p-6 rounded-lg border border-primary/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">The Truth (No Glitter, No Hacks)</h3>
            <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Balancing Response Integrity and school? Easy. Use systems.
            </p>
            <p className="font-semibold text-sm sm:text-base">Systems turn chaos into order. Moods don't. They turn order into chaos.</p>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base">Systems are like making tea: boil water, steep leaves, pour cup. It works every time, whether you're hyped or half-dead.</p>
          </div>

          <SectionCard
            id="module6-systems"
            title="What Systems Actually Do For You"
            expanded={expandedSections["module6-systems"] || false}
            onToggle={() => toggleSection("module6-systems")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-3 sm:space-y-4">
              <p className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">They convert:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-card p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-bold text-destructive text-sm sm:text-base">Confusion</p>
                  <ArrowRight className="w-4 h-4 inline mx-2" />
                  <p className="font-bold text-primary inline text-sm sm:text-base">Structure</p>
                </div>
                <div className="bg-card p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-bold text-destructive text-sm sm:text-base">Forgetfulness</p>
                  <ArrowRight className="w-4 h-4 inline mx-2" />
                  <p className="font-bold text-primary inline text-sm sm:text-base">Flow</p>
                </div>
                <div className="bg-card p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-bold text-destructive text-sm sm:text-base">Burnout</p>
                  <ArrowRight className="w-4 h-4 inline mx-2" />
                  <p className="font-bold text-primary inline text-sm sm:text-base">Rhythm</p>
                </div>
                <div className="bg-card p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-bold text-destructive text-sm sm:text-base">"I'm overwhelmed"</p>
                  <ArrowRight className="w-4 h-4 inline mx-2" />
                  <p className="font-bold text-primary inline text-sm sm:text-base">"I'm in control"</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module6-before-now"
            title="Before: Tools. Now: Operating System."
            expanded={expandedSections["module6-before-now"] || false}
            onToggle={() => toggleSection("module6-before-now")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-4">
              <p className="font-semibold">Before, Response Integrity gave you trackers, tips, and tools as one-off downloads.</p>
              <p>Now? The Response Hub is the entire infrastructure.</p>
              
              <div className="bg-muted p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-2">What changed:</p>
                <p>You used to chase scattered files. Now you plug in and everything's already connected.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module6-hub"
            title="The Response Hub = Your Operating System"
            expanded={expandedSections["module6-hub"] || false}
            onToggle={() => toggleSection("module6-hub")}
            gradient="from-primary to-primary/70"
          >
            <div className="space-y-4">
              <p className="font-semibold">What Response Integrity used to give you individually is now centralized:</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10">
                <ul className="space-y-2 list-disc pl-5">
                  <li>Challenge Tracker → automated, visual, impossible to ignore</li>
                  <li>Boss Battles → integrated into session-logging</li>
                  <li>Session Planner → inside your workflow</li>
                  <li>Student Identity Sheet → intelligence stored per student</li>
                  <li>3-Layer Lens → embedded into lesson flow</li>
                </ul>
              </div>

              <div className="bg-card p-4 rounded-lg border-l-4 border-primary mt-4">
                <p className="font-bold">The Hub holds the structure. You follow it.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module6-formula"
            title="The Student-Tutor Reality Formula"
            expanded={expandedSections["module6-formula"] || false}
            onToggle={() => toggleSection("module6-formula")}
            gradient="from-primary/80 to-primary"
          >
            <div className="space-y-4">
              <p>You're not building a "tutor identity" and a "student identity."</p>
              <p className="font-semibold">You're building one identity that carries both.</p>
              
              <div className="bg-accent p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">Here's the formula:</p>
                <ol className="space-y-3 ml-4">
                  <li><strong>1. Keep Your Commitments</strong><br/>
                    <span className="text-muted-foreground">When you show up for sessions on time, you build patterns for your future self (deadlines, exams, life).</span>
                  </li>
                  <li><strong>2. Don't Rely on Emotion</strong><br/>
                    <span className="text-muted-foreground">When you're tired? That's when you lean on the Hub more, not less.</span>
                  </li>
                  <li><strong>3. Routine &gt; "Trying Hard"</strong><br/>
                    <span className="text-muted-foreground">The magic isn't motivation. It's repetition. Let the system do the heavy lifting.</span>
                  </li>
                </ol>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module6-protection"
            title="How the Hub Protects You"
            expanded={expandedSections["module6-protection"] || false}
            onToggle={() => toggleSection("module6-protection")}
            gradient="from-primary to-primary/90"
          >
            <div className="space-y-4">
              <p className="font-semibold">Two ways:</p>
              
              <div className="space-y-3">
                <div className="bg-card p-4 rounded-lg border border-primary/20">
                  <p className="font-bold">1. Keeps You Moving Forward (Even When You Don't Feel Like It)</p>
                  <p className="text-muted-foreground mt-2">Sessions scheduled? Log opens automatically. Tracker reminds you. The system doesn't wait for motivation.</p>
                </div>
                
                <div className="bg-card p-4 rounded-lg border border-primary/20">
                  <p className="font-bold">2. Keeps You From Slipping Backward</p>
                  <p className="text-muted-foreground mt-2">You can't "forget" to update a log when it's built into your close-out. You can't skip planning when the Hub prompts you before every session.</p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold">Bottom line:</p>
                <p className="text-muted-foreground">The Hub keeps you consistent. Consistency builds your identity. Your identity powers your momentum.</p>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-xl mb-4">Mantras for When You Slip</h4>
            <ul className="space-y-3">
              <li>"I don't rely on pressure. I rely on process."</li>
              <li>"I don't trust motivation. I trust my systems."</li>
              <li>"I'm not overwhelmed. I'm under-organized."</li>
              <li>"If I follow the Hub, my life stays clean."</li>
            </ul>
            
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="font-bold text-lg">The Final Truth:</p>
              <p className="mt-2">If you build consistency here, you'll carry it into school.</p>
              <p className="mt-2 italic">Structure is structure. Discipline is discipline. Character is character.</p>
              <p className="mt-3">The difference between a tutor who thrives and a tutor who burns out? One trusts the system. The other trusts their mood.</p>
            </div>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 6 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleSeven({ expandedSections, toggleSection, onComplete, isComplete }: ModuleProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-2 border-primary/30">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Award className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-2xl leading-tight">Module 7: Time Mastery for Soul-Led Teachers</CardTitle>
              <CardDescription className="text-white/95 text-sm sm:text-lg mt-1 sm:mt-2">
                "You're not just a tutor. You're a presence."
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-accent p-4 sm:p-6 rounded-lg border border-primary/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Main Problem</h3>
            <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Most student-tutors think teaching is about technique.
            </p>
            <p className="font-semibold text-sm sm:text-base">But in reality? They're mastered by urgency, guilt, and grind.</p>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base">They burn out. They resent their students. They dread sessions. They disappear before the semester ends.</p>
          </div>

          <SectionCard
            id="module7-solution"
            title="The Real Solution"
            expanded={expandedSections["module7-solution"] || false}
            onToggle={() => toggleSection("module7-solution")}
            gradient="from-primary to-primary/80"
          >
            <div className="space-y-4">
              <p className="font-bold text-lg">Training tutors not just to manage time  but to hold space with rhythm, calm, and inner clarity.</p>
              
              <div className="bg-muted p-4 rounded-lg border border-primary/10 mt-4">
                <p className="font-bold mb-3">Outcome - Response Integrity Tutors will know how to:</p>
                <ul className="space-y-2 ml-4">
                  <li>Work in flow blocks, not panic hours</li>
                  <li>Maintain emotional peace before, during, and after sessions</li>
                  <li>Prioritize presence over perfection</li>
                  <li>Create internal stillness, even when life is chaotic</li>
                  <li>Build sessions that breathe, not rush</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module7-why-matters"
            title="Why This Matters"
            expanded={expandedSections["module7-why-matters"] || false}
            onToggle={() => toggleSection("module7-why-matters")}
            gradient="from-primary/90 to-primary"
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-muted p-3 sm:p-4 rounded-lg border border-destructive/30">
                  <p className="font-bold text-sm sm:text-base mb-1 sm:mb-2 text-destructive">The World's Way</p>
                  <ul className="space-y-1 text-xs sm:text-sm">
                    <li>Hustle harder</li>
                    <li>Do more</li>
                    <li>Grind 24/7</li>
                    <li>Sacrifice well-being for results</li>
                    <li>Burn out = badge of honor</li>
                  </ul>
                </div>
                <div className="bg-accent p-3 sm:p-4 rounded-lg border border-primary/20">
                  <p className="font-bold text-sm sm:text-base mb-1 sm:mb-2 text-primary">Response Integrity's Way</p>
                  <ul className="space-y-1 text-xs sm:text-sm">
                    <li>Slow down + focus deeper</li>
                    <li>Feel more, hold better energy</li>
                    <li>Work in sprints, then reset</li>
                    <li>Prioritize your presence over output</li>
                    <li>Peace = sustainable excellence</li>
                  </ul>
                </div>
              </div>

              <div className="bg-card p-3 sm:p-4 rounded-lg border-l-4 border-primary mt-3 sm:mt-4">
                <p className="font-bold text-center text-sm sm:text-base">Calm mentors create confident students.</p>
                <p className="text-muted-foreground text-center mt-1 sm:mt-2 text-xs sm:text-base">Dysregulated tutors create anxious learners.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module7-rhythm-tools"
            title="Rhythm Tools"
            expanded={expandedSections["module7-rhythm-tools"] || false}
            onToggle={() => toggleSection("module7-rhythm-tools")}
            gradient="from-primary to-primary/70"
          >
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-lg mb-3">1. The "Sacred Pause" Strategy</h4>
                <p className="mb-3">Sometimes the best thing you can do in a session is: Pause.</p>
                
                <div className="bg-card p-4 rounded-lg border-l-4 border-primary">
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Let the student think</li>
                    <li>Let the silence teach</li>
                    <li>Let their brain breathe</li>
                  </ul>
                  <p className="italic mt-3">Silence isn't a lack of teaching. It's the space where learning downloads.</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-3">2. Emotional Reset Checklist</h4>
                <p className="mb-3">Before any session, scan this mental list:</p>
                
                <div className="bg-accent p-4 rounded-lg border border-primary/10">
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Did I eat / hydrate?</li>
                    <li>Do I feel rushed or grounded?</li>
                    <li>What's the student's emotional state likely to be today?</li>
                    <li>Am I here to prove something or serve someone?</li>
                    <li>Deep breath. Shoulders down. Eyes soft. Calm energy ON.</li>
                  </ul>
                  <p className="font-bold mt-4">No session starts without intention.</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="module7-lessons"
            title="4 Lessons"
            expanded={expandedSections["module7-lessons"] || false}
            onToggle={() => toggleSection("module7-lessons")}
            gradient="from-primary/80 to-primary"
          >
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-lg mb-2">Lesson 1: The Lie of the Clock</h4>
                <p className="text-muted-foreground mb-3">Time isn't the problem. Attention is.</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-semibold">Stop asking: "Do I have enough time?"</p>
                  <p className="mt-2">Start asking: "Am I fully here right now?"</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-2">Lesson 2: Holding Space Like a Leader</h4>
                <p className="text-muted-foreground mb-3">Your vibe regulates the room.</p>
                <div className="bg-card p-4 rounded-lg border border-primary/20">
                  <p>If you're rushed → they'll feel anxious.</p>
                  <p>If you're present → they'll feel safe.</p>
                  <p className="font-semibold mt-3">Your energy is a teaching tool.</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-2">Lesson 3: Flow Blocks, Not Time Blocks</h4>
                <p className="text-muted-foreground mb-3">Don't schedule by the clock. Schedule by your energy zones.</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-semibold mb-2">Example:</p>
                  <ul className="space-y-1 ml-4">
                    <li>Morning = deep prep (trackers, lesson planning)</li>
                    <li>Afternoon = tutoring sessions (high presence)</li>
                    <li>Evening = admin light (logs, messages)</li>
                  </ul>
                  <p className="mt-3 italic">Match tasks to your natural rhythm, not arbitrary time slots.</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-2">Lesson 4: Reset Yourself, Reset the Room</h4>
                <p className="text-muted-foreground mb-3">Between sessions, between students, between moods:</p>
                <div className="bg-card p-4 rounded-lg border-l-4 border-primary">
                  <p className="font-semibold">Micro-reset ritual:</p>
                  <ul className="space-y-2 mt-2">
                    <li>1. Stand up. Stretch. Breathe 3x deep.</li>
                    <li>2. Shake off the last session mentally.</li>
                    <li>3. Set one intention for the next one.</li>
                  </ul>
                  <p className="mt-3 font-bold">Each session gets a fresh version of you.</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-lg shadow-md">
            <h4 className="font-bold text-xl mb-4">Rhythm Mantras</h4>
            <ul className="space-y-3">
              <li>"Teaching isn't a race. It's a rhythm."</li>
              <li>"A calm mind teaches faster than a rushed one."</li>
              <li>"The more still you are, the more they trust you."</li>
              <li>"A structured rhythm feels safer than a fast syllabus."</li>
            </ul>
            
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="font-bold text-lg">Final Truth:</p>
              <p className="mt-2 italic">A dysregulated tutor can't regulate a student.</p>
              <p className="mt-2">Your nervous system is your teaching technology.</p>
              <p className="mt-3 font-semibold">The most powerful tool you have isn't your lesson plan. It's your capacity for self-regulation.</p>
            </div>
          </div>

          {!isComplete && (
            <Button onClick={onComplete} className="w-full" size="lg">
              Mark Module 7 Complete <CheckCircle2 className="ml-2 w-5 h-5" />
            </Button>
          )}
          {isComplete && (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Module Completed
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

