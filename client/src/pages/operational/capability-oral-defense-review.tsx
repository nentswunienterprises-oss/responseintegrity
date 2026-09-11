import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCcw, ShieldAlert, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ProbeJudgment = "clear" | "partial" | "fail";
type PredictedOutcome = "pending" | "approved" | "repeat_required" | "integrity_review";

type OralDefenseCandidate = {
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  podName: string | null;
  latestDefenseOutcome: "repeat_required" | null;
  nextAttemptNumber: number;
  readinessStatus: "READY" | "NOT_READY";
  missingRequirementCodes: string[];
};

type OralDefenseProbeBrief = {
  focusKey: string;
  deepDiveKey: string;
  source: "evidence_risk" | "integrity_baseline";
  reviewerInstruction: string;
  incorrectCount?: number;
  criticalFailCount?: number;
  practicalRepeatCount?: number;
  practicalIntegrityCount?: number;
};

type OralDefenseBrief = {
  briefId: string;
  evidenceFingerprint: string;
  defenseVersion: number;
  attemptNumber: number;
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  generatedAt: string;
  evidenceSummary: {
    passedAssessmentKeys: string[];
    approvedPracticalProofKeys: string[];
    practicalSignals: Array<{
      proofKey: string;
      proofVersion: number;
      attemptNumber: number;
      status: string;
      feedback: string | null;
    }>;
    riskSignalCount: number;
  };
  probes: OralDefenseProbeBrief[];
};

type ProbeObservation = {
  focusKey: string;
  deepDiveKey: string;
  scenarioSummary: string;
  observedResponseSummary: string;
  judgment: ProbeJudgment;
  integrityConcern: boolean;
};

type ProbeDraft = {
  scenarioSummary: string;
  observedResponseSummary: string;
  judgment: ProbeJudgment | null;
  integrityConcern: boolean;
};

type ProbeState = Record<string, ProbeDraft>;

function probeIdentity(probe: Pick<OralDefenseProbeBrief, "focusKey" | "deepDiveKey">) {
  return `${probe.deepDiveKey}:${probe.focusKey}`;
}

function humanizeKey(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " - ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function predictedOutcome(drafts: ProbeDraft[]): PredictedOutcome {
  if (!drafts.length || drafts.some((probe) => !probe.judgment)) return "pending";
  if (drafts.some((probe) => probe.integrityConcern)) return "integrity_review";
  if (drafts.every((probe) => probe.judgment === "clear")) return "approved";
  return "repeat_required";
}

function outcomePresentation(outcome: PredictedOutcome) {
  if (outcome === "approved") return { label: "Approved", icon: CheckCircle2 };
  if (outcome === "integrity_review") return { label: "Integrity review", icon: ShieldAlert };
  if (outcome === "repeat_required") return { label: "Repeat required", icon: RefreshCcw };
  return { label: "Pending explicit judgments", icon: Target };
}

export default function CapabilityOralDefenseReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const authorized = new Set(["td", "coo", "hr"]).has(role);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [probeState, setProbeState] = useState<ProbeState>({});
  const [feedback, setFeedback] = useState("");
  const [sandboxConfirmed, setSandboxConfirmed] = useState(false);

  const candidatesQuery = useQuery<{ candidates: OralDefenseCandidate[] }>({
    queryKey: ["capability-oral-defense-candidates"],
    enabled: Boolean(!authLoading && authorized),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capability-review/oral-defense/candidates");
      return (await response.json()) as { candidates: OralDefenseCandidate[] };
    },
  });

  const briefQuery = useQuery<{ brief: OralDefenseBrief }>({
    queryKey: ["capability-oral-defense-brief", selectedAssignmentId],
    enabled: Boolean(selectedAssignmentId && authorized),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/capability-review/oral-defense/${encodeURIComponent(String(selectedAssignmentId))}/brief`,
      );
      return (await response.json()) as { brief: OralDefenseBrief };
    },
  });

  const brief = briefQuery.data?.brief || null;
  const selectedCandidate = useMemo(
    () => candidatesQuery.data?.candidates.find((candidate) => candidate.tutorAssignmentId === selectedAssignmentId) || null,
    [candidatesQuery.data?.candidates, selectedAssignmentId],
  );

  useEffect(() => {
    if (!brief) {
      setProbeState({});
      return;
    }
    const next: ProbeState = {};
    for (const probe of brief.probes) {
      next[probeIdentity(probe)] = {
        scenarioSummary: "",
        observedResponseSummary: "",
        judgment: null,
        integrityConcern: false,
      };
    }
    setProbeState(next);
    setFeedback("");
    setSandboxConfirmed(false);
  }, [brief?.briefId]);

  const drafts = useMemo<ProbeDraft[]>(() => {
    if (!brief) return [];
    return brief.probes.map((probe) =>
      probeState[probeIdentity(probe)] || {
        scenarioSummary: "",
        observedResponseSummary: "",
        judgment: null,
        integrityConcern: false,
      },
    );
  }, [brief, probeState]);

  const outcome = predictedOutcome(drafts);
  const OutcomeIcon = outcomePresentation(outcome).icon;
  const observationsComplete = Boolean(
    brief &&
      drafts.length === brief.probes.length &&
      drafts.every(
        (probe) =>
          Boolean(probe.judgment) &&
          probe.scenarioSummary.trim().length >= 30 &&
          probe.observedResponseSummary.trim().length >= 30,
      ),
  );
  const feedbackComplete = outcome === "approved" || (outcome !== "pending" && feedback.trim().length >= 20);

  const observations = useMemo<ProbeObservation[]>(() => {
    if (!brief || !observationsComplete) return [];
    return brief.probes.map((probe) => {
      const state = probeState[probeIdentity(probe)];
      return {
        focusKey: probe.focusKey,
        deepDiveKey: probe.deepDiveKey,
        scenarioSummary: state.scenarioSummary,
        observedResponseSummary: state.observedResponseSummary,
        judgment: state.judgment as ProbeJudgment,
        integrityConcern: state.integrityConcern,
      };
    });
  }, [brief, observationsComplete, probeState]);

  const updateProbe = (probe: OralDefenseProbeBrief, patch: Partial<ProbeDraft>) => {
    const identity = probeIdentity(probe);
    setProbeState((current) => ({
      ...current,
      [identity]: {
        scenarioSummary: current[identity]?.scenarioSummary || "",
        observedResponseSummary: current[identity]?.observedResponseSummary || "",
        judgment: current[identity]?.judgment || null,
        integrityConcern: current[identity]?.integrityConcern || false,
        ...patch,
      },
    }));
  };

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!brief || !selectedAssignmentId) throw new Error("Select an eligible Specialist first.");
      if (!observationsComplete) throw new Error("Record the scenario, observed response and an explicit judgment for every issued probe.");
      if (!sandboxConfirmed) throw new Error("Confirm that every oral probe used only fictional or sandbox material.");
      if (!feedbackComplete) throw new Error("Write at least 20 characters of actionable feedback for a non-approved defense.");

      const response = await apiRequest(
        "POST",
        `/api/capability-review/oral-defense/${encodeURIComponent(selectedAssignmentId)}/complete`,
        {
          briefId: brief.briefId,
          defenseVersion: brief.defenseVersion,
          attemptNumber: brief.attemptNumber,
          probes: observations,
          feedback: feedback.trim() || null,
          sandboxScenarioConfirmed: true,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      const finishedAssignmentId = selectedAssignmentId;
      setSelectedAssignmentId(null);
      setProbeState({});
      setFeedback("");
      setSandboxConfirmed(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capability-oral-defense-candidates"] }),
        queryClient.invalidateQueries({ queryKey: ["capability-oral-defense-brief", finishedAssignmentId] }),
      ]);
    },
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading Oral Integrity Defense access...</div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>This oral defense surface is restricted to authorised training and operations reviewers.</AlertDescription></Alert>
          <Button variant="outline" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Return</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div>
          <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <p className="text-sm font-medium text-muted-foreground">Capability Engine - Targeted Human Verification</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Oral Integrity Defense</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Human time is reserved for Specialists whose digital and practical evidence is already complete. Probe only the issued risk areas and integrity baselines. Do not re-administer the assessment bank.
          </p>
        </div>

        {candidatesQuery.error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Eligible oral defense candidates could not be loaded.</AlertDescription></Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
          <Card>
            <CardHeader><CardTitle>Eligible now ({candidatesQuery.data?.candidates.length || 0})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {candidatesQuery.isLoading && <p className="text-sm text-muted-foreground">Checking evidence stacks...</p>}
              {!candidatesQuery.isLoading && (candidatesQuery.data?.candidates.length || 0) === 0 && (
                <p className="text-sm text-muted-foreground">No Specialist currently has a complete pre-oral capability stack.</p>
              )}
              {(candidatesQuery.data?.candidates || []).map((candidate) => (
                <button
                  key={candidate.tutorAssignmentId}
                  type="button"
                  onClick={() => setSelectedAssignmentId(candidate.tutorAssignmentId)}
                  className={`w-full rounded-lg border p-4 text-left transition ${selectedAssignmentId === candidate.tutorAssignmentId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <p className="font-semibold">{candidate.specialistName || "Specialist"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{candidate.podName || "No pod label"}</p>
                  <p className="mt-2 text-xs font-medium">
                    {candidate.latestDefenseOutcome === "repeat_required" ? `Repeat defense - attempt ${candidate.nextAttemptNumber}` : `First defense - attempt ${candidate.nextAttemptNumber}`}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {briefQuery.isLoading && selectedAssignmentId && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Generating a targeted brief from the current evidence state...</CardContent></Card>
            )}

            {briefQuery.error && selectedAssignmentId && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{briefQuery.error instanceof Error ? briefQuery.error.message : "The oral defense brief could not be generated."}</AlertDescription></Alert>
            )}

            {!selectedAssignmentId && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Select an eligible Specialist to generate the current oral defense brief.</CardContent></Card>
            )}

            {brief && selectedCandidate && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{selectedCandidate.podName || "Specialist"}</p>
                        <CardTitle className="mt-1">{brief.specialistName || selectedCandidate.specialistName}</CardTitle>
                      </div>
                      <div className="rounded-lg border px-4 py-3 text-right text-sm">
                        <p className="font-medium">Defense {brief.attemptNumber}</p>
                        <p className="text-xs text-muted-foreground">Brief {brief.briefId.slice(0, 8)}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Digital proofs passed</p><p className="mt-1 text-xl font-semibold">{brief.evidenceSummary.passedAssessmentKeys.length}</p></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Practicals approved</p><p className="mt-1 text-xl font-semibold">{brief.evidenceSummary.approvedPracticalProofKeys.length}</p></div>
                      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Risk signals found</p><p className="mt-1 text-xl font-semibold">{brief.evidenceSummary.riskSignalCount}</p></div>
                    </div>
                    <Alert>
                      <Target className="h-4 w-4" />
                      <AlertDescription>
                        This brief is bound to the current evidence state. If new evidence lands while you are conducting the defense, submission will be rejected and a fresh brief must be generated.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {brief.probes.map((probe, index) => {
                    const identity = probeIdentity(probe);
                    const state = probeState[identity] || { scenarioSummary: "", observedResponseSummary: "", judgment: null, integrityConcern: false };
                    return (
                      <Card key={identity}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Probe {index + 1} - {probe.source === "evidence_risk" ? "evidence risk" : "integrity baseline"}</p>
                              <CardTitle className="mt-1 text-lg">{humanizeKey(probe.focusKey)}</CardTitle>
                            </div>
                            <span className="rounded-full border px-3 py-1 text-xs">{humanizeKey(probe.deepDiveKey)}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed">{probe.reviewerInstruction}</div>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium">Scenario actually used</span>
                            <textarea
                              rows={3}
                              value={state.scenarioSummary}
                              onChange={(event) => updateProbe(probe, { scenarioSummary: event.target.value })}
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Record the fictional scenario you actually presented."
                            />
                            <span className="text-xs text-muted-foreground">Minimum 30 characters.</span>
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium">Observed Specialist response</span>
                            <textarea
                              rows={4}
                              value={state.observedResponseSummary}
                              onChange={(event) => updateProbe(probe, { observedResponseSummary: event.target.value })}
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Record what the Specialist actually reasoned or decided, not what you hoped they understood."
                            />
                            <span className="text-xs text-muted-foreground">Minimum 30 characters.</span>
                          </label>

                          <div className="grid gap-3 sm:grid-cols-3">
                            {(["clear", "partial", "fail"] as ProbeJudgment[]).map((judgment) => (
                              <Button
                                key={judgment}
                                type="button"
                                variant={state.judgment === judgment ? (judgment === "fail" ? "destructive" : "default") : "outline"}
                                onClick={() => updateProbe(probe, { judgment })}
                              >
                                {judgment === "clear" ? "Clear" : judgment === "partial" ? "Partial" : "Fail"}
                              </Button>
                            ))}
                          </div>

                          <label className="flex items-start gap-3 rounded-lg border p-4">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={state.integrityConcern}
                              onChange={(event) => updateProbe(probe, { integrityConcern: event.target.checked })}
                            />
                            <span className="text-sm">Escalate an integrity concern from this probe. Any checked concern overrides ordinary probe scoring.</span>
                          </label>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <OutcomeIcon className="h-5 w-5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Deterministic outcome from recorded probes</p>
                        <CardTitle>{outcomePresentation(outcome).label}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Reviewer feedback {outcome === "approved" ? "(optional)" : "(required when the defense resolves)"}</span>
                      <textarea
                        rows={5}
                        maxLength={4000}
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={outcome === "approved" ? "Optional note for the Specialist." : "State exactly what must be strengthened before another defense or why integrity review is required."}
                      />
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border p-4">
                      <input type="checkbox" className="mt-1" checked={sandboxConfirmed} onChange={(event) => setSandboxConfirmed(event.target.checked)} />
                      <span className="text-sm">I confirm every probe used only fictional or sandbox scenarios and did not expose real student, parent or family data.</span>
                    </label>

                    {completeMutation.error && (
                      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{completeMutation.error instanceof Error ? completeMutation.error.message : "Oral defense could not be recorded."}</AlertDescription></Alert>
                    )}

                    <Button
                      disabled={completeMutation.isPending || !observationsComplete || outcome === "pending" || !sandboxConfirmed || !feedbackComplete}
                      onClick={() => completeMutation.mutate()}
                    >
                      {completeMutation.isPending ? "Recording defense..." : "Record immutable defense"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
