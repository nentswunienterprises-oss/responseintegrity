import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCcw, ShieldAlert, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  evaluateOralDefenseProbes,
  type CapabilityOralDefenseProbeObservation,
  type CapabilityOralProbeJudgment,
  type CapabilityOralProbeRubric,
} from "@shared/capabilityOralDefense";

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
  rubric: CapabilityOralProbeRubric;
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

type ProbeDraft = {
  scenarioSummary: string;
  observedResponseSummary: string;
  judgment: CapabilityOralProbeJudgment | "";
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

function emptyProbeState(brief: OralDefenseBrief): ProbeState {
  return Object.fromEntries(
    brief.probes.map((probe) => [
      probeIdentity(probe),
      { scenarioSummary: "", observedResponseSummary: "", judgment: "" },
    ]),
  );
}

function outcomePresentation(outcome: "approved" | "repeat_required" | "integrity_review") {
  if (outcome === "approved") {
    return {
      label: "Approved",
      detail: "Every issued probe is explicitly Clear.",
      Icon: CheckCircle2,
    };
  }
  if (outcome === "integrity_review") {
    return {
      label: "Integrity review",
      detail: "At least one issued integrity-critical probe is explicitly Fail.",
      Icon: ShieldAlert,
    };
  }
  return {
    label: "Repeat required",
    detail: "At least one probe is Partial or ordinary Fail, with no critical Fail.",
    Icon: RefreshCcw,
  };
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
    setProbeState(emptyProbeState(brief));
    setFeedback("");
    setSandboxConfirmed(false);
  }, [brief?.briefId]);

  const observations = useMemo<CapabilityOralDefenseProbeObservation[]>(() => {
    if (!brief) return [];
    return brief.probes.flatMap((probe) => {
      const draft = probeState[probeIdentity(probe)];
      if (!draft?.judgment) return [];
      return [{
        focusKey: probe.focusKey,
        deepDiveKey: probe.deepDiveKey,
        scenarioSummary: draft.scenarioSummary.trim(),
        observedResponseSummary: draft.observedResponseSummary.trim(),
        judgment: draft.judgment,
      }];
    });
  }, [brief, probeState]);

  const observationsComplete = Boolean(
    brief &&
      observations.length === brief.probes.length &&
      observations.every(
        (probe) =>
          probe.scenarioSummary.length >= 30 &&
          probe.observedResponseSummary.length >= 30,
      ),
  );

  const derivedPreview = useMemo(() => {
    if (!brief || !observationsComplete) return null;
    try {
      return evaluateOralDefenseProbes(brief.probes, observations);
    } catch {
      return null;
    }
  }, [brief, observations, observationsComplete]);

  const remediationRequired = derivedPreview !== null && derivedPreview.outcome !== "approved";
  const feedbackComplete = !remediationRequired || feedback.trim().length >= 20;

  const updateProbe = (probe: OralDefenseProbeBrief, patch: Partial<ProbeDraft>) => {
    const identity = probeIdentity(probe);
    setProbeState((current) => ({
      ...current,
      [identity]: {
        scenarioSummary: current[identity]?.scenarioSummary || "",
        observedResponseSummary: current[identity]?.observedResponseSummary || "",
        judgment: current[identity]?.judgment || "",
        ...patch,
      },
    }));
  };

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!brief || !selectedAssignmentId) throw new Error("Select an eligible Specialist first.");
      if (!observationsComplete) {
        throw new Error("Record a fictional scenario, observed response, and explicit judgment for every issued probe.");
      }
      if (!derivedPreview) throw new Error("The Oral Defense outcome could not be derived from the current probe evidence.");
      if (!sandboxConfirmed) throw new Error("Confirm that every oral probe used only fictional or sandbox material.");
      if (derivedPreview.outcome !== "approved" && feedback.trim().length < 20) {
        throw new Error("Write at least 20 characters of actionable feedback for a non-approved defense.");
      }

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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This oral defense surface is restricted to authorised training and operations reviewers.</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Return
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div>
          <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <p className="text-sm font-medium text-muted-foreground">Capability Engine - Targeted Human Verification</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Oral Integrity Defense</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Human time is reserved for Specialists whose digital and practical evidence is already complete. Use only the issued probes. Judge observable reasoning against the frozen rubric rather than re-administering the assessment bank.
          </p>
        </div>

        {candidatesQuery.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Eligible oral defense candidates could not be loaded.</AlertDescription>
          </Alert>
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
                    {candidate.latestDefenseOutcome === "repeat_required"
                      ? `Repeat defense - attempt ${candidate.nextAttemptNumber}`
                      : `Current defense - attempt ${candidate.nextAttemptNumber}`}
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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{briefQuery.error instanceof Error ? briefQuery.error.message : "The oral defense brief could not be generated."}</AlertDescription>
              </Alert>
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
                        <p className="font-medium">Defense V{brief.defenseVersion} - attempt {brief.attemptNumber}</p>
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
                        This brief is bound to both the current evidence state and the issued rubric. New evidence or a changed standard makes it stale and forces a fresh brief.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {brief.probes.map((probe, index) => {
                    const identity = probeIdentity(probe);
                    const state = probeState[identity] || { scenarioSummary: "", observedResponseSummary: "", judgment: "" };
                    return (
                      <Card key={identity}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Probe {index + 1} - {probe.source === "integrity_baseline" ? "Integrity baseline" : "Evidence-targeted"}</p>
                              <CardTitle className="mt-1 text-lg">{humanizeKey(probe.focusKey)}</CardTitle>
                            </div>
                            {probe.rubric.criticalOnFail ? (
                              <Badge variant="destructive">Integrity-critical if Fail</Badge>
                            ) : (
                              <Badge variant="outline">Capability probe</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <Alert>
                            <Target className="h-4 w-4" />
                            <AlertDescription>{probe.reviewerInstruction}</AlertDescription>
                          </Alert>

                          <div>
                            <p className="text-sm font-semibold">Observable standard</p>
                            <p className="mt-1 text-sm text-muted-foreground">{probe.rubric.observableStandard}</p>
                          </div>

                          <div className="grid gap-2 text-xs lg:grid-cols-3">
                            <div className="rounded-lg border p-3"><span className="font-semibold">Clear:</span> {probe.rubric.clearAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Partial:</span> {probe.rubric.partialAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Fail:</span> {probe.rubric.failAnchor}</div>
                          </div>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium">Fictional scenario used</span>
                            <textarea
                              value={state.scenarioSummary}
                              onChange={(event) => updateProbe(probe, { scenarioSummary: event.target.value })}
                              rows={3}
                              maxLength={2000}
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Summarise the unfamiliar fictional situation you gave the Specialist."
                            />
                            <span className="text-xs text-muted-foreground">Minimum 30 characters.</span>
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium">Observed Specialist response</span>
                            <textarea
                              value={state.observedResponseSummary}
                              onChange={(event) => updateProbe(probe, { observedResponseSummary: event.target.value })}
                              rows={4}
                              maxLength={2500}
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Record what the Specialist actually reasoned, preserved, changed, or proposed. Do not infer motive."
                            />
                            <span className="text-xs text-muted-foreground">Minimum 30 characters. Record observable reasoning, not inferred intent.</span>
                          </label>

                          <div className="grid gap-2 sm:grid-cols-3">
                            {(["clear", "partial", "fail"] as CapabilityOralProbeJudgment[]).map((judgment) => (
                              <Button
                                key={judgment}
                                type="button"
                                variant={state.judgment === judgment ? (judgment === "fail" && probe.rubric.criticalOnFail ? "destructive" : "default") : "outline"}
                                onClick={() => updateProbe(probe, { judgment })}
                              >
                                {judgment === "clear" ? "Clear" : judgment === "partial" ? "Partial" : "Fail"}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card>
                  <CardHeader><CardTitle>Derived defense result</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    {derivedPreview ? (() => {
                      const presentation = outcomePresentation(derivedPreview.outcome);
                      const OutcomeIcon = presentation.Icon;
                      return (
                        <Alert variant={derivedPreview.outcome === "integrity_review" ? "destructive" : "default"}>
                          <OutcomeIcon className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-semibold">{presentation.label}.</span> {presentation.detail} Clear {derivedPreview.clearCount}, Partial {derivedPreview.partialCount}, Fail {derivedPreview.failCount}, Critical Fail {derivedPreview.criticalFailCount}.
                          </AlertDescription>
                        </Alert>
                      );
                    })() : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Complete every issued probe with a 30+ character scenario, 30+ character observed response, and an explicit Clear / Partial / Fail judgment. No probe defaults to Clear.
                        </AlertDescription>
                      </Alert>
                    )}

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Reviewer summary {remediationRequired ? "(required)" : "(optional)"}</span>
                      <textarea
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        rows={4}
                        maxLength={4000}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={remediationRequired
                          ? "State the exact boundary or reasoning that must be corrected before the next defense."
                          : "Optional synthesis for the Specialist."}
                      />
                      {remediationRequired && <span className="text-xs text-muted-foreground">Minimum 20 characters for Repeat required or Integrity review.</span>}
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border p-4">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={sandboxConfirmed}
                        onChange={(event) => setSandboxConfirmed(event.target.checked)}
                      />
                      <span className="text-sm">
                        I confirm every probe used only fictional or sandbox material and no real student, parent, or family data.
                      </span>
                    </label>

                    {completeMutation.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{completeMutation.error instanceof Error ? completeMutation.error.message : "The Oral Integrity Defense could not be recorded."}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      disabled={completeMutation.isPending || !derivedPreview || !sandboxConfirmed || !feedbackComplete}
                      onClick={() => completeMutation.mutate()}
                    >
                      {completeMutation.isPending ? "Recording defense..." : "Record immutable Oral Defense"}
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
