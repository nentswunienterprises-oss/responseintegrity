import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DEFAULT_MONTHLY_PACKAGE_KEY,
  MONTHLY_PACKAGE_KEYS,
  MONTHLY_SERVICE_PACKAGES,
  type MonthlyPackageKey,
} from "@shared/servicePackages";

interface ParentOnboardingProposalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  studentId: string;
  tutorName?: string;
  identitySheetData?: unknown;
  parentTopics?: string;
}

export default function ParentOnboardingProposal({
  open,
  onOpenChange,
  studentName,
  studentId,
}: ParentOnboardingProposalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const studentFirstName = studentName.trim().split(/\s+/)[0] || "Your child";
  const [sending, setSending] = useState(false);
  const [selectedPackageKey, setSelectedPackageKey] = useState<MonthlyPackageKey>(DEFAULT_MONTHLY_PACKAGE_KEY);
  const selectedPackage = MONTHLY_SERVICE_PACKAGES[selectedPackageKey];

  // Fetch latest intro drill
  const { data: drillDataRaw, isLoading: drillLoading, error: drillError } = useQuery({
    queryKey: ["/api/tutor/students", studentId, "latest-intro-drill"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tutor/students/${studentId}/latest-intro-drill`);
      return res.json();
    },
    enabled: open && !!studentId,
  });

  const drillData = drillDataRaw as any;

  // Core scoring model: diagnosis classifies entry phase/stability only.
  const deriveTrainingEntryPhase = (diagnosisPhase: string, _stability: string): string => {
    return diagnosisPhase;
  };

  // Parent-facing breakdown: describes what the student needs to build at training entry phase
  const getParentFacingBreakdown = (trainingPhase: string, diagnosisPhase: string, stability: string) => {
    if (stability === "High" && diagnosisPhase === trainingPhase) {
      return `${studentFirstName} showed strong, consistent performance in ${diagnosisPhase}. Training begins in the same phase to confirm stability and progress decisions through training sessions.`;
    }
    switch (trainingPhase) {
      case "Clarity":
        return `${studentFirstName} is not yet consistently identifying what the problem is asking or what method to use first.`;
      case "Structured Execution":
        return `${studentFirstName} understands the topic but does not yet apply a stable method consistently without support.`;
      case "Controlled Discomfort":
        return `${studentFirstName} can execute reliably in familiar conditions but becomes less stable when the work pushes back.`;
      case "Time Pressure Stability":
        return `${studentFirstName} can execute the method but loses structure when time pressure is introduced.`;
      default:
        return `${studentFirstName} needs a more stable starting structure.`;
    }
  };

  const getParentFacingPriority = (trainingPhase: string, diagnosisPhase: string, stability: string) => {
    if (stability === "High" && diagnosisPhase === trainingPhase) {
      return `Training will start at ${trainingPhase} and use session scoring to determine whether to remain, regress, or advance.`;
    }
    switch (trainingPhase) {
      case "Clarity":
        return `We will first help ${studentFirstName} read problems more clearly, recognise what is being asked, and name the structure before solving.`;
      case "Structured Execution":
        return `We will train ${studentFirstName} to start independently and follow a repeatable method without being carried through each step.`;
      case "Controlled Discomfort":
        return `We will train ${studentFirstName} to stay calm and structured when questions become less familiar or more demanding.`;
      case "Time Pressure Stability":
        return `We will train ${studentFirstName} to keep the same structure and decision-making even when time pressure increases.`;
      default:
        return `We will first strengthen ${studentFirstName}'s consistency before adding more difficulty.`;
    }
  };

  const getProgressSignals = (trainingPhase: string) => {
    switch (trainingPhase) {
      case "Clarity":
        return [
          "Clearer recognition of what the question is asking",
          "Earlier correct method selection",
          "Less confusion when beginning problems",
          "More accurate first steps",
        ];
      case "Structured Execution":
        return [
          "Earlier independent starts",
          "Less hesitation when beginning problems",
          "More consistent method use",
          "More stable step order without prompting",
        ];
      case "Controlled Discomfort":
        return [
          "Calmer starts when questions feel less familiar",
          "Better structure holding in harder work",
          "Less visible shutdown under challenge",
          "More complete attempts on difficult questions",
        ];
      case "Time Pressure Stability":
        return [
          "Stronger structure while work is timed",
          "Fewer rushed breakdowns",
          "More reliable decisions under pace pressure",
          "Less instability when speed is added",
        ];
      default:
        return [
          "Earlier independent starts",
          "Less hesitation when beginning problems",
          "More consistent method use",
          "More stable step order without prompting",
        ];
    }
  };

  const handleSendProposal = async () => {
    if (!drillData) {
      toast({
        title: "Missing Intro Drill",
        description: "No intro drill data found. Please complete the intro session first.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const diagnosisPhase = drillData?.summary?.phase || drillData?.phase || "Clarity";
      const stability = drillData?.summary?.stability || drillData?.stability || "Low";
      const topic = drillData?.introTopic || drillData?.topic || drillData?.summary?.topic || "";
      const trainingEntryPhase = deriveTrainingEntryPhase(diagnosisPhase, stability);

      const recommendedPlan = `${trainingEntryPhase} phase conditioning on ${topic || "primary diagnostic topic"} (entry stability: ${stability}). Diagnosed at ${diagnosisPhase} - training starts at ${trainingEntryPhase}. System-generated from intro drill.`;
      const justification = `Intro drill scored ${drillData?.summary?.diagnosisScore ?? "-"}/100 at ${diagnosisPhase} phase. Stability: ${stability}. Training entry phase resolved to ${trainingEntryPhase}. Next action: ${drillData?.summary?.nextAction || "Continue phase work"}.`;

      const response = await apiRequest("POST", "/api/tutor/proposal", {
        studentId,
        autoGeneratedFromIntroDrill: true,
        introDrillId: drillData.id,
        recommendedPlan,
        justification,
        topicConditioningTopic: topic,
        topicConditioningEntryPhase: trainingEntryPhase,
        topicConditioningStability: stability,
        packageKey: selectedPackageKey,
      });

      toast({
        title: "Training Plan Sent!",
        description: `The training plan for ${studentFirstName} has been sent to their parent.`,
        duration: 5000,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] });
      await queryClient.invalidateQueries({
        queryKey: ["/api/tutor/students", studentId, "workflow-state"],
        refetchType: "active",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to Send",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const loading = drillLoading;
  const error = drillError;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Training Plan From Intro Drill</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">Loading intro drill data...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !drillData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Training Plan From Intro Drill</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm text-destructive">
                <p className="font-semibold">No Intro Drill Found</p>
                <p className="text-xs mt-1">Please complete the intro session drill first before generating a training plan.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const diagnosisPhase = drillData?.summary?.phase || drillData?.phase || drillData?.phaseObserved || "Clarity";
  const stability = drillData?.summary?.stability || drillData?.stability || drillData?.stabilityObserved || "Low";
  const topic = drillData?.introTopic || drillData?.topic || "Current class topic";
  const trainingEntryPhase = deriveTrainingEntryPhase(diagnosisPhase, stability);
  const breakdown = getParentFacingBreakdown(trainingEntryPhase, diagnosisPhase, stability);
  const priority = getParentFacingPriority(trainingEntryPhase, diagnosisPhase, stability);
  const progressSignals = getProgressSignals(trainingEntryPhase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Training Plan From Intro Drill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <h3 className="font-bold text-sm text-center mb-0.5">Training Proposal Ready</h3>
            <p className="text-xs text-center text-muted-foreground">{studentName}</p>
            <p className="text-[11px] text-center text-muted-foreground mt-1">
              Diagnosis ran on: <span className="font-medium text-foreground">{topic}</span>
            </p>
          </div>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended Monthly Package
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <RadioGroup
                value={selectedPackageKey}
                onValueChange={(value) => setSelectedPackageKey(value as MonthlyPackageKey)}
                className="grid gap-2 sm:grid-cols-3"
              >
                {MONTHLY_PACKAGE_KEYS.map((packageKey) => {
                  const servicePackage = MONTHLY_SERVICE_PACKAGES[packageKey];
                  return (
                    <Label
                      key={packageKey}
                      htmlFor={`proposal-${packageKey}`}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 hover:border-primary/50"
                    >
                      <RadioGroupItem id={`proposal-${packageKey}`} value={packageKey} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          {servicePackage.sessionsPerMonth} sessions
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {servicePackage.plannedSessionsPerWeek}x weekly - R{servicePackage.amountZar.toLocaleString("en-ZA")}/month
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
              <p className="mt-3 text-xs text-muted-foreground">
                Select the frequency appropriate to the diagnosed need. This is a monthly package, not ad-hoc session capacity.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Focus Area
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {trainingEntryPhase === "Clarity" && (
                <p className="text-xs text-muted-foreground">Training will begin at the <span className="text-foreground font-medium">Clarity</span> level - building vocabulary, method recognition, and reason understanding before execution is introduced.</p>
              )}
              {trainingEntryPhase === "Structured Execution" && (
                <p className="text-xs text-muted-foreground">Training will begin at the <span className="text-foreground font-medium">Structured Execution</span> level - building an independent, repeatable method without tutor carry.</p>
              )}
              {trainingEntryPhase === "Controlled Discomfort" && (
                <p className="text-xs text-muted-foreground">Training will begin at the <span className="text-foreground font-medium">Controlled Discomfort</span> level - introducing difficulty and unfamiliar problems while maintaining structure.</p>
              )}
              {trainingEntryPhase === "Time Pressure Stability" && (
                <p className="text-xs text-muted-foreground">Training will begin at the <span className="text-foreground font-medium">Time Pressure Stability</span> level - maintaining full method and structure under timed conditions.</p>
              )}
            </CardContent>
          </Card>

          {stability !== "High" && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Where {studentFirstName} Currently Gets Stuck
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground">{breakdown}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What We Will Work On First
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-muted-foreground">{priority}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Diagnostic Results
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Topic</p>
                  <p className="text-xs font-medium text-foreground">{topic}</p>
                </div>
                <div className="rounded-md border bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Diagnosis Phase</p>
                  <p className="text-xs font-medium text-foreground">{diagnosisPhase}</p>
                </div>
                <div className="rounded-md border bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Training Starts At</p>
                  <p className="text-xs font-medium text-foreground">{trainingEntryPhase}</p>
                </div>
                <div className="rounded-md border bg-muted/50 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Stability</p>
                  <p className="text-xs font-medium text-foreground">{stability}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How Sessions Will Be Structured
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
                <li>Cadence: {selectedPackage.plannedSessionsPerWeek} sessions per week ({selectedPackage.sessionsPerMonth} sessions per month)</li>
                <li>Clear explanation of the problem structure</li>
                <li>Guided practice with immediate correction</li>
                <li>Repeated method-building in the same topic</li>
                <li>Gradual increase in difficulty when readiness improves</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How Progress Will Be Observed
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
                {progressSignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-4 py-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Important Note</strong> - This training focuses on how the student responds under difficulty, not only on correct answers.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Commitment</strong> - Consistency and active participation are required across the selected {selectedPackage.sessionsPerMonth}-session monthly package. Students are expected to attempt before receiving guidance.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendProposal} 
              className="flex-1 gap-2"
              disabled={sending}
            >
              <Send className="w-3 h-3" /> 
              {sending ? "Sending..." : "Send to Parent"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
