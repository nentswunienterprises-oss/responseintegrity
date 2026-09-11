import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, History, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PodData = {
  assignment?: {
    id?: string | null;
    operationalMode?: string | null;
  } | null;
};

type PublicSimulation = {
  key: string;
  title: string;
  description: string;
  passThresholdPercent: number;
  fictionalScenarioConfirmed: true;
  totalDecisions: number;
  simulationFormId: string;
  bankVersion: number;
  attemptNumber: number;
  maxAttempts: number;
  decisions: Array<{
    key: string;
    prompt: string;
    kind: "single_choice" | "multi_select";
    options: Array<{ key: string; label: string }>;
  }>;
};

type SimulationAttempt = {
  id: string;
  bankVersion: number;
  attemptNumber: number;
  scenarioKey: string;
  totalDecisions: number;
  correctDecisions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  evidenceContaminationCount: number;
  authorityViolationCount: number;
  escalationFailureCount: number;
  authoritative: false;
  completedAt: string;
};

type SimulationResult = {
  attemptId?: string;
  bankVersion: number;
  attemptNumber: number;
  simulationFormId: string;
  simulationKey: string;
  totalDecisions: number;
  correctDecisions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  evidenceContaminationCount: number;
  authorityViolationCount: number;
  escalationFailureCount: number;
  authoritative: false;
};

export default function SpecialistCapabilitySandboxSimulation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [latestResult, setLatestResult] = useState<SimulationResult | null>(null);

  const podQuery = useQuery<PodData>({ queryKey: ["/api/tutor/pod"], retry: false });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");
  const operationalMode = String(podQuery.data?.assignment?.operationalMode || "").toLowerCase();
  const inSandbox = operationalMode === "sandbox";

  const simulationQuery = useQuery<PublicSimulation>({
    queryKey: ["capability-sandbox-simulation", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId) && inSandbox,
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-sandbox-simulation?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  const historyQuery = useQuery<{ attempts: SimulationAttempt[] }>({
    queryKey: ["capability-sandbox-simulation-history", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId) && inSandbox,
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-sandbox-simulation/history?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  useEffect(() => {
    setAnswers({});
  }, [simulationQuery.data?.simulationFormId]);

  const complete = useMemo(() => {
    const simulation = simulationQuery.data;
    if (!simulation) return false;
    return simulation.decisions.every((decision) => (answers[decision.key] || []).length > 0);
  }, [answers, simulationQuery.data]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const simulation = simulationQuery.data;
      if (!simulation) throw new Error("No active Sandbox simulation is loaded.");
      const response = await apiRequest("POST", "/api/tutor/capability-sandbox-simulation/attempt", {
        tutorAssignmentId,
        bankVersion: simulation.bankVersion,
        simulationFormId: simulation.simulationFormId,
        responses: simulation.decisions.map((decision) => ({
          decisionKey: decision.key,
          selectedOptionKeys: answers[decision.key] || [],
        })),
      });
      return response.json() as Promise<SimulationResult>;
    },
    onSuccess: async (result) => {
      setLatestResult(result);
      setAnswers({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capability-sandbox-simulation", tutorAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["capability-sandbox-simulation-history", tutorAssignmentId] }),
      ]);
      toast({
        title: result.passed ? "Simulation passed" : "Simulation needs another attempt",
        description: "This is rehearsal evidence only. The human Sandbox Mock Gate remains separate.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Simulation submission blocked",
        description: error?.message || "Unable to submit the Sandbox simulation.",
        variant: "destructive",
      });
    },
  });

  const choose = (decision: PublicSimulation["decisions"][number], optionKey: string) => {
    setAnswers((current) => {
      if (decision.kind === "single_choice") {
        return { ...current, [decision.key]: [optionKey] };
      }
      const existing = new Set(current[decision.key] || []);
      if (existing.has(optionKey)) existing.delete(optionKey);
      else existing.add(optionKey);
      return { ...current, [decision.key]: Array.from(existing) };
    });
  };

  if (podQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading Specialist assignment...</div>;
  }

  if (!tutorAssignmentId) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">No Specialist assignment is available.</div>;
  }

  if (!inSandbox) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sandbox simulations are available only while your Specialist operational mode is Sandbox.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const simulation = simulationQuery.data;
  const attempts = historyQuery.data?.attempts || [];

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  <CardTitle>Sandbox Simulation</CardTitle>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Rehearse system-directed decisions against fictional session conditions. The engine scores only the actions you select. No AI judgment is used.
                </p>
              </div>
              <Badge variant="outline">Practice evidence</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Simulation results are non-authoritative. Passing a simulation does not pass the human Sandbox Mock Readiness Gate, open Trial, certify you, or change student state.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {latestResult ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">Latest rehearsal result</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {latestResult.correctDecisions}/{latestResult.totalDecisions} decisions correct - {latestResult.percent}%
                  </p>
                </div>
                <Badge variant={latestResult.passed ? "default" : "outline"}>
                  {latestResult.passed ? "Passed" : "Repeat required"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3 text-sm">Evidence contamination: <strong>{latestResult.evidenceContaminationCount}</strong></div>
                <div className="rounded-lg border p-3 text-sm">Authority violations: <strong>{latestResult.authorityViolationCount}</strong></div>
                <div className="rounded-lg border p-3 text-sm">Escalation failures: <strong>{latestResult.escalationFailureCount}</strong></div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {simulationQuery.isLoading ? (
          <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading fictional rehearsal...</CardContent></Card>
        ) : simulationQuery.error || !simulation ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No active private Sandbox simulation bank is available yet. The human Sandbox Mock Gate is unaffected.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{simulation.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{simulation.description}</p>
              <p className="text-xs text-muted-foreground">
                Attempt {simulation.attemptNumber} of {simulation.maxAttempts} - deterministic pass threshold {simulation.passThresholdPercent}%
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {simulation.decisions.map((decision, index) => (
                <div key={decision.key} className="rounded-xl border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision {index + 1}</p>
                  <p className="mt-2 font-medium leading-relaxed">{decision.prompt}</p>
                  <div className="mt-4 grid gap-2">
                    {decision.options.map((option) => {
                      const selected = (answers[decision.key] || []).includes(option.key);
                      return (
                        <Button
                          key={option.key}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          className="h-auto justify-start whitespace-normal py-3 text-left"
                          aria-pressed={selected}
                          onClick={() => choose(decision, option.key)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                className="w-full"
                disabled={!complete || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "Submitting rehearsal..." : "Submit simulation"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Rehearsal history</CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted Sandbox simulation attempts yet.</p>
            ) : (
              <div className="space-y-2">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">Attempt {attempt.attemptNumber} - {attempt.percent}%</p>
                      <p className="text-xs text-muted-foreground">{new Date(attempt.completedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attempt.passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      <span>{attempt.passed ? "Passed" : "Repeat required"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
