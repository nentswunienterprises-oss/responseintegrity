import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, FlaskConical, History, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvidenceStatus = "observed" | "not_observed" | "confounded";

type PodData = {
  assignment?: {
    id?: string | null;
    operationalMode?: string | null;
    operational_mode?: string | null;
  } | null;
};

type SandboxField = {
  fieldKey: string;
  dimensionId: string;
  options: Array<{ optionId: string; label: string }>;
};

type SandboxScenario = {
  key: string;
  version: number;
  title: string;
  description: string;
  phase: string;
  previousStability: string;
  passThresholdPercent: number;
  sets: Array<{
    setId: string;
    setName: string;
    purpose: string;
    constraints: Record<string, unknown>;
    reps: Array<{
      repNumber: number;
      studentBehavior: string;
      fields: SandboxField[];
    }>;
  }>;
};

type SandboxForm = {
  bankKey: string;
  bankVersion: number;
  bankTitle: string;
  attemptNumber: number;
  maxAttempts: number;
  scenarioFormId: string;
  scenario: SandboxScenario;
};

type SandboxResult = {
  attemptId: string;
  completedAt: string;
  bankKey: string;
  bankVersion: number;
  attemptNumber: number;
  scenarioKey: string;
  scenarioVersion: number;
  phase: string;
  totalObservations: number;
  matchingObservations: number;
  observationFidelityPercent: number;
  systemOutcomeMatched: boolean;
  passed: boolean;
  specialistOutcome: {
    route: string;
    nextPhase: string;
    nextStability: string;
    targetPhase: string | null;
  };
  studentStateAuthoritative: false;
  evidenceScope: "sandbox";
};

type Selection = {
  optionId: string;
  evidenceStatus: EvidenceStatus;
};

const keyFor = (setId: string, repNumber: number, fieldKey: string) =>
  setId + "::" + repNumber + "::" + fieldKey;

const humanize = (value: string) =>
  String(value || "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function SpecialistSandboxSimulation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [result, setResult] = useState<SandboxResult | null>(null);

  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });

  const assignment = podQuery.data?.assignment;
  const tutorAssignmentId = String(assignment?.id || "");
  const operationalMode = String(
    assignment?.operationalMode || assignment?.operational_mode || "",
  ).toLowerCase();
  const inSandbox = operationalMode === "sandbox";

  const formQuery = useQuery<SandboxForm>({
    queryKey: ["sandbox-simulation", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId && inSandbox && !result),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-simulation?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  const historyQuery = useQuery<{ attempts: SandboxResult[] }>({
    queryKey: ["sandbox-simulation-history", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId && inSandbox),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-simulation/history?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  const form = formQuery.data;

  const expectedObservationCount = useMemo(() => {
    if (!form) return 0;
    return form.scenario.sets.reduce(
      (total, set) =>
        total + set.reps.reduce((repTotal, rep) => repTotal + rep.fields.length, 0),
      0,
    );
  }, [form]);

  const completedObservationCount = useMemo(() => {
    if (!form) return 0;
    let count = 0;
    form.scenario.sets.forEach((set) =>
      set.reps.forEach((rep) =>
        rep.fields.forEach((field) => {
          if (selections[keyFor(set.setId, rep.repNumber, field.fieldKey)]?.optionId) {
            count += 1;
          }
        }),
      ),
    );
    return count;
  }, [form, selections]);

  const allComplete =
    expectedObservationCount > 0 &&
    completedObservationCount === expectedObservationCount;

  const chooseOption = (
    setId: string,
    repNumber: number,
    fieldKey: string,
    optionId: string,
  ) => {
    const key = keyFor(setId, repNumber, fieldKey);
    setSelections((current) => ({
      ...current,
      [key]: {
        optionId,
        evidenceStatus: current[key]?.evidenceStatus || "observed",
      },
    }));
  };

  const chooseStatus = (
    setId: string,
    repNumber: number,
    fieldKey: string,
    evidenceStatus: EvidenceStatus,
  ) => {
    const key = keyFor(setId, repNumber, fieldKey);
    setSelections((current) => {
      const existing = current[key];
      if (!existing?.optionId) return current;
      return { ...current, [key]: { ...existing, evidenceStatus } };
    });
  };

  const submitAttempt = useMutation({
    mutationFn: async () => {
      if (!form || !allComplete) {
        throw new Error("Record every observation before submitting the simulation.");
      }

      const submission = {
        sets: form.scenario.sets.map((set) => ({
          setId: set.setId,
          reps: set.reps.map((rep) => ({
            repNumber: rep.repNumber,
            observations: Object.fromEntries(
              rep.fields.map((field) => {
                const selection =
                  selections[keyFor(set.setId, rep.repNumber, field.fieldKey)];
                return [
                  field.fieldKey,
                  {
                    optionId: selection.optionId,
                    evidenceStatus: selection.evidenceStatus,
                  },
                ];
              }),
            ),
          })),
        })),
      };

      const response = await apiRequest(
        "POST",
        "/api/tutor/sandbox-simulation/attempt",
        {
          tutorAssignmentId,
          bankVersion: form.bankVersion,
          scenarioFormId: form.scenarioFormId,
          submission,
        },
      );
      return response.json() as Promise<SandboxResult>;
    },
    onSuccess: async (attemptResult) => {
      setResult(attemptResult);
      await queryClient.invalidateQueries({
        queryKey: ["sandbox-simulation-history", tutorAssignmentId],
      });
    },
  });

  if (podQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading Specialist assignment...
      </div>
    );
  }

  if (!tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A Specialist assignment is required before Sandbox can begin.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!inSandbox) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Sandbox simulation opens only after the Specialist enters Sandbox mode.
              Training Capability Checks remain separate.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="text-sm text-muted-foreground">Sandbox evidence recorded</p>
                  <CardTitle>{result.passed ? "Simulation standard met" : "Repeat required"}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Observation fidelity</p>
                  <p className="text-2xl font-bold">{result.observationFidelityPercent}%</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Matched observations</p>
                  <p className="text-2xl font-bold">{result.matchingObservations}/{result.totalObservations}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">System outcome</p>
                  <p className="text-2xl font-bold">{result.systemOutcomeMatched ? "Matched" : "Diverged"}</p>
                </div>
              </div>

              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  This is Sandbox evidence only. It did not change a real student state.
                  The simulation tested whether your observation record drove the same RI system outcome as the predefined student behaviour.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Your simulated system result</p>
                <p className="mt-1 text-muted-foreground">
                  {humanize(result.specialistOutcome.route)} · {result.specialistOutcome.nextPhase} / {result.specialistOutcome.nextStability}
                  {result.specialistOutcome.targetPhase
                    ? ` · Target: ${result.specialistOutcome.targetPhase}`
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    setResult(null);
                    setSelections({});
                    queryClient.invalidateQueries({
                      queryKey: ["sandbox-simulation", tutorAssignmentId],
                    });
                  }}
                >
                  Load next simulation
                </Button>
                <Button variant="outline" onClick={() => navigate("/specialist/pod")}>
                  Back to Pod
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (formQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Preparing deterministic Sandbox scenario...
      </div>
    );
  }

  if (formQuery.error || !form) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active deterministic Sandbox scenario bank is available yet.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <div className="text-right text-xs text-muted-foreground">
            <p>Attempt {form.attemptNumber} of {form.maxAttempts}</p>
            <p>{completedObservationCount}/{expectedObservationCount} observations recorded</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  <CardTitle>Sandbox · {form.scenario.title}</CardTitle>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {form.scenario.description}
                </p>
              </div>
              <Badge variant="outline">{form.scenario.phase}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                The student is simulated; the operating workflow is not. Observe the predefined behaviour and record it using the same RI evidence options used by the live drill system. Do not infer the hidden canonical record.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {form.scenario.sets.map((set) => (
          <Card key={set.setId}>
            <CardHeader>
              <CardTitle>{set.setName}</CardTitle>
              <p className="text-sm text-muted-foreground">{set.purpose}</p>
              <p className="text-xs text-muted-foreground">
                {Object.entries(set.constraints)
                  .map(([key, value]) => `${humanize(key)}: ${humanize(String(value))}`)
                  .join(" · ")}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {set.reps.map((rep) => (
                <div key={rep.repNumber} className="rounded-xl border p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rep {rep.repNumber}
                  </p>
                  <div className="mt-2 rounded-lg bg-muted/40 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Simulated student behaviour
                    </p>
                    <p className="mt-2 leading-relaxed">{rep.studentBehavior}</p>
                  </div>

                  <div className="mt-5 grid gap-5">
                    {rep.fields.map((field) => {
                      const selection =
                        selections[keyFor(set.setId, rep.repNumber, field.fieldKey)];
                      return (
                        <div key={field.fieldKey} className="space-y-2">
                          <p className="font-medium">{humanize(field.dimensionId)}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {field.options.map((option) => (
                              <Button
                                key={option.optionId}
                                type="button"
                                variant={selection?.optionId === option.optionId ? "default" : "outline"}
                                className="h-auto justify-start whitespace-normal py-3 text-left"
                                onClick={() =>
                                  chooseOption(
                                    set.setId,
                                    rep.repNumber,
                                    field.fieldKey,
                                    option.optionId,
                                  )
                                }
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(["observed", "not_observed", "confounded"] as EvidenceStatus[]).map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                type="button"
                                disabled={!selection?.optionId}
                                variant={selection?.evidenceStatus === status ? "secondary" : "ghost"}
                                onClick={() =>
                                  chooseStatus(
                                    set.setId,
                                    rep.repNumber,
                                    field.fieldKey,
                                    status,
                                  )
                                }
                              >
                                {humanize(status)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Button
          className="w-full"
          disabled={!allComplete || submitAttempt.isPending}
          onClick={() => submitAttempt.mutate()}
        >
          {submitAttempt.isPending ? "Submitting Sandbox evidence..." : "Submit Sandbox evidence"}
        </Button>

        {submitAttempt.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {submitAttempt.error instanceof Error
                ? submitAttempt.error.message
                : "Sandbox submission failed."}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Sandbox history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(historyQuery.data?.attempts || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Sandbox simulation attempts recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(historyQuery.data?.attempts || []).map((attempt) => (
                  <div
                    key={attempt.attemptId || attempt.scenarioKey + attempt.attemptNumber}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        Attempt {attempt.attemptNumber} · {attempt.phase}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.observationFidelityPercent}% observation fidelity
                      </p>
                    </div>
                    <Badge variant={attempt.passed ? "default" : "outline"}>
                      {attempt.passed ? "Standard met" : "Repeat required"}
                    </Badge>
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
