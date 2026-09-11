import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, RefreshCcw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  deriveCapabilityPracticalReview,
  type CapabilityPracticalCriterionJudgment,
  type CapabilityPracticalCriterionReviewInput,
  type CapabilityPracticalReviewRubric,
} from "@shared/capabilityPracticalEvidence";

type ReviewQueueItem = {
  evidenceId: string;
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  podName: string | null;
  proofKey: "prepare" | "execute" | "evidence";
  proofVersion: number;
  rubricVersion: number;
  reviewRubric: CapabilityPracticalReviewRubric;
  attemptNumber: number;
  artifactUrl: string;
  artifactType: "screen_voice" | "screen_video" | "video";
  declaration: Record<string, string>;
  submittedAt: string;
};

type CriterionDraft = {
  judgment: CapabilityPracticalCriterionJudgment | "";
  evidenceNote: string;
};

function proofTitle(key: ReviewQueueItem["proofKey"]) {
  if (key === "prepare") return "Practical 1 - Prepare";
  if (key === "execute") return "Practical 2 - Execute";
  return "Practical 3 - Evidence";
}

function declarationLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "external recording";
  }
}

function emptyCriterionDrafts(rubric: CapabilityPracticalReviewRubric): Record<string, CriterionDraft> {
  return Object.fromEntries(
    rubric.criteria.map((criterion) => [criterion.key, { judgment: "", evidenceNote: "" }]),
  );
}

function outcomePresentation(outcome: "approved" | "repeat_required" | "integrity_review") {
  if (outcome === "approved") {
    return {
      title: "Approved",
      detail: "Every rubric criterion is explicitly Clear.",
      Icon: CheckCircle2,
    };
  }
  if (outcome === "integrity_review") {
    return {
      title: "Integrity review",
      detail: "At least one integrity-critical criterion is explicitly Fail.",
      Icon: ShieldAlert,
    };
  }
  return {
    title: "Repeat required",
    detail: "At least one criterion is Partial or Fail and no integrity-critical failure is present.",
    Icon: RefreshCcw,
  };
}

export default function CapabilityPracticalReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const authorized = new Set(["td", "coo", "hr"]).has(role);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [criterionDrafts, setCriterionDrafts] = useState<Record<string, CriterionDraft>>({});
  const [feedback, setFeedback] = useState("");

  const queueQuery = useQuery<{ queue: ReviewQueueItem[] }>({
    queryKey: ["capability-practical-review-queue"],
    enabled: Boolean(!authLoading && authorized),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capability-review/practicals/pending");
      return (await response.json()) as { queue: ReviewQueueItem[] };
    },
  });

  const selected = useMemo(
    () => queueQuery.data?.queue.find((item) => item.evidenceId === selectedEvidenceId) || null,
    [queueQuery.data?.queue, selectedEvidenceId],
  );

  const clearDecision = () => {
    setCriterionDrafts({});
    setFeedback("");
  };

  const openEvidence = (item: ReviewQueueItem) => {
    setSelectedEvidenceId(item.evidenceId);
    setCriterionDrafts(emptyCriterionDrafts(item.reviewRubric));
    setFeedback("");
  };

  const criterionJudgments = useMemo<CapabilityPracticalCriterionReviewInput[]>(() => {
    if (!selected) return [];
    return selected.reviewRubric.criteria.flatMap((criterion) => {
      const draft = criterionDrafts[criterion.key];
      if (!draft?.judgment) return [];
      return [{
        criterionKey: criterion.key,
        judgment: draft.judgment,
        evidenceNote: draft.evidenceNote.trim() || null,
      }];
    });
  }, [criterionDrafts, selected]);

  const allJudged = Boolean(
    selected && selected.reviewRubric.criteria.every((criterion) => criterionDrafts[criterion.key]?.judgment),
  );
  const notesValid = Boolean(
    selected && selected.reviewRubric.criteria.every((criterion) => {
      const draft = criterionDrafts[criterion.key];
      if (!draft?.judgment || draft.judgment === "clear") return true;
      return draft.evidenceNote.trim().length >= 20;
    }),
  );

  const derivedPreview = useMemo(() => {
    if (!selected || !allJudged || !notesValid) return null;
    try {
      return deriveCapabilityPracticalReview(selected.reviewRubric, criterionJudgments);
    } catch {
      return null;
    }
  }, [allJudged, criterionJudgments, notesValid, selected]);

  const remediationSummaryRequired = derivedPreview !== null && derivedPreview.outcome !== "approved";
  const feedbackValid = !remediationSummaryRequired || feedback.trim().length >= 20;

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select practical evidence first.");
      if (!allJudged) throw new Error("Judge every rubric criterion before submitting the review.");
      if (!notesValid) throw new Error("Every Partial or Fail judgment needs at least 20 characters of observed evidence.");
      if (!derivedPreview) throw new Error("The rubric result could not be derived from the current judgments.");
      if (derivedPreview.outcome !== "approved" && feedback.trim().length < 20) {
        throw new Error("Repeat required and integrity review outcomes need at least 20 characters of actionable reviewer feedback.");
      }

      const response = await apiRequest(
        "POST",
        `/api/capability-review/practicals/${encodeURIComponent(selected.evidenceId)}/review`,
        {
          rubricVersion: selected.rubricVersion,
          criterionJudgments,
          feedback: feedback.trim() || null,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      setSelectedEvidenceId(null);
      clearDecision();
      await queryClient.invalidateQueries({ queryKey: ["capability-practical-review-queue"] });
    },
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading review access...</div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>This capability review surface is restricted to authorised training/operations reviewers.</AlertDescription></Alert>
          <Button variant="outline" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Return</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <p className="text-sm font-medium text-muted-foreground">Capability Engine - Human Verification</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Practical evidence queue</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Judge observable execution against the frozen rubric. The system derives the review outcome from your criterion evidence.
          </p>
        </div>

        {queueQuery.error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Practical evidence queue could not be loaded.</AlertDescription></Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Pending review ({queueQuery.data?.queue.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueQuery.isLoading && <p className="text-sm text-muted-foreground">Loading evidence...</p>}
              {!queueQuery.isLoading && (queueQuery.data?.queue.length || 0) === 0 && (
                <p className="text-sm text-muted-foreground">No practical evidence is waiting for your review.</p>
              )}
              {(queueQuery.data?.queue || []).map((item) => (
                <button
                  key={item.evidenceId}
                  type="button"
                  onClick={() => openEvidence(item)}
                  className={`w-full rounded-lg border p-4 text-left transition ${selectedEvidenceId === item.evidenceId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <p className="font-semibold">{item.specialistName || "Specialist"}</p>
                  <p className="mt-1 text-sm">{proofTitle(item.proofKey)} - attempt {item.attemptNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.podName || "No pod label"} - rubric v{item.rubricVersion}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selected ? proofTitle(selected.proofKey) : "Select evidence"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Choose a pending submission to inspect the demonstration and declaration.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Specialist</p><p className="font-medium">{selected.specialistName || "Specialist"}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Attempt</p><p className="font-medium">{selected.attemptNumber}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Frozen rubric</p><p className="font-medium">v{selected.rubricVersion}</p></div>
                  </div>

                  <Alert>
                    <ExternalLink className="h-4 w-4" />
                    <AlertDescription>
                      Recording is hosted externally at <span className="font-medium">{linkHost(selected.artifactUrl)}</span>. Verify that it shows only the sandbox scenario before relying on it.
                    </AlertDescription>
                  </Alert>

                  <Button asChild variant="outline">
                    <a href={selected.artifactUrl} target="_blank" rel="noopener noreferrer">
                      Open practical recording <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>

                  <div className="space-y-3">
                    <h2 className="font-semibold">Specialist declaration</h2>
                    {Object.entries(selected.declaration || {}).map(([key, value]) => (
                      <div key={key} className="rounded-lg border p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{declarationLabel(key)}</p>
                        <p className="mt-2 text-sm leading-relaxed">{String(value)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 border-t pt-5">
                    <div>
                      <h2 className="font-semibold">Observable rubric</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every criterion must be judged explicitly. Partial and Fail require an observation note. No criterion defaults to Clear.
                      </p>
                    </div>

                    {selected.reviewRubric.criteria.map((criterion, index) => {
                      const draft = criterionDrafts[criterion.key] || { judgment: "", evidenceNote: "" };
                      const requiresNote = draft.judgment === "partial" || draft.judgment === "fail";
                      return (
                        <div key={criterion.key} className="rounded-xl border p-4 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criterion {index + 1}</p>
                              <h3 className="mt-1 font-semibold">{criterion.label}</h3>
                            </div>
                            {criterion.criticalOnFail ? (
                              <Badge variant="destructive">Integrity-critical if Fail</Badge>
                            ) : (
                              <Badge variant="outline">Capability criterion</Badge>
                            )}
                          </div>

                          <p className="text-sm leading-relaxed">{criterion.observableStandard}</p>

                          <div className="grid gap-2 text-xs md:grid-cols-3">
                            <div className="rounded-lg border p-3"><span className="font-semibold">Clear:</span> {criterion.clearAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Partial:</span> {criterion.partialAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Fail:</span> {criterion.failAnchor}</div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            {(["clear", "partial", "fail"] as CapabilityPracticalCriterionJudgment[]).map((judgment) => (
                              <Button
                                key={judgment}
                                type="button"
                                variant={draft.judgment === judgment ? (judgment === "fail" && criterion.criticalOnFail ? "destructive" : "default") : "outline"}
                                onClick={() => setCriterionDrafts((current) => ({
                                  ...current,
                                  [criterion.key]: {
                                    judgment,
                                    evidenceNote: current[criterion.key]?.evidenceNote || "",
                                  },
                                }))}
                              >
                                {judgment === "clear" ? "Clear" : judgment === "partial" ? "Partial" : "Fail"}
                              </Button>
                            ))}
                          </div>

                          {requiresNote ? (
                            <label className="block space-y-2">
                              <span className="text-sm font-medium">Observed evidence for {draft.judgment}</span>
                              <textarea
                                value={draft.evidenceNote}
                                onChange={(event) => setCriterionDrafts((current) => ({
                                  ...current,
                                  [criterion.key]: {
                                    judgment: current[criterion.key]?.judgment || "",
                                    evidenceNote: event.target.value,
                                  },
                                }))}
                                rows={3}
                                maxLength={2000}
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder="Name the exact behavior in the recording that supports this judgment."
                              />
                              <p className="text-xs text-muted-foreground">Minimum 20 characters for Partial or Fail.</p>
                            </label>
                          ) : null}
                        </div>
                      );
                    })}

                    {derivedPreview ? (() => {
                      const presentation = outcomePresentation(derivedPreview.outcome);
                      const OutcomeIcon = presentation.Icon;
                      return (
                        <Alert variant={derivedPreview.outcome === "integrity_review" ? "destructive" : "default"}>
                          <OutcomeIcon className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-semibold">Derived outcome: {presentation.title}.</span> {presentation.detail} Clear {derivedPreview.clearCount}, Partial {derivedPreview.partialCount}, Fail {derivedPreview.failCount}.
                          </AlertDescription>
                        </Alert>
                      );
                    })() : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Complete every criterion and document every Partial/Fail before an outcome can be derived.
                        </AlertDescription>
                      </Alert>
                    )}

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">
                        Reviewer summary {remediationSummaryRequired ? "(required for this outcome)" : "(optional for Approved)"}
                      </span>
                      <textarea
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        rows={4}
                        maxLength={4000}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={remediationSummaryRequired
                          ? "Tell the Specialist what must change before the next attempt or what integrity issue must be resolved."
                          : "Optional synthesis. Criterion-level evidence remains the authoritative basis for the derived outcome."}
                      />
                      {remediationSummaryRequired ? (
                        <span className="text-xs text-muted-foreground">Minimum 20 characters so the next action is explicit.</span>
                      ) : null}
                    </label>

                    {reviewMutation.error && (
                      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Review failed."}</AlertDescription></Alert>
                    )}

                    <Button
                      disabled={reviewMutation.isPending || !derivedPreview || !feedbackValid}
                      onClick={() => reviewMutation.mutate()}
                    >
                      {reviewMutation.isPending ? "Recording rubric..." : "Record immutable rubric review"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}