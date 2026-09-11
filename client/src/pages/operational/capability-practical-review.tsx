import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, RefreshCcw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ReviewOutcome = "approved" | "repeat_required" | "integrity_review";

type ReviewQueueItem = {
  evidenceId: string;
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  podName: string | null;
  proofKey: "prepare" | "execute" | "evidence";
  proofVersion: number;
  attemptNumber: number;
  artifactUrl: string;
  artifactType: "screen_voice" | "screen_video" | "video";
  declaration: Record<string, string>;
  submittedAt: string;
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

export default function CapabilityPracticalReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const authorized = new Set(["td", "coo", "hr"]).has(role);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReviewOutcome>("approved");
  const [reasonCode, setReasonCode] = useState("");
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
    setOutcome("approved");
    setReasonCode("");
    setFeedback("");
  };

  const openEvidence = (item: ReviewQueueItem) => {
    setSelectedEvidenceId(item.evidenceId);
    clearDecision();
  };

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select practical evidence first.");
      if ((outcome === "repeat_required" || outcome === "integrity_review") && feedback.trim().length < 20) {
        throw new Error("Write at least 20 characters of actionable reviewer feedback for this outcome.");
      }

      const response = await apiRequest(
        "POST",
        `/api/capability-review/practicals/${encodeURIComponent(selected.evidenceId)}/review`,
        {
          outcome,
          reasonCode: reasonCode.trim() || null,
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
            Review what the Specialist actually demonstrated. This is not a second quiz and it does not alter automated assessment scores.
          </p>
        </div>

        {queueQuery.error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Practical evidence queue could not be loaded.</AlertDescription></Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
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
                  <p className="mt-1 text-xs text-muted-foreground">{item.podName || "No pod label"}</p>
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
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Version</p><p className="font-medium">{selected.proofVersion}</p></div>
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
                    <h2 className="font-semibold">Decision</h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Button type="button" variant={outcome === "approved" ? "default" : "outline"} onClick={() => setOutcome("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button>
                      <Button type="button" variant={outcome === "repeat_required" ? "default" : "outline"} onClick={() => setOutcome("repeat_required")}><RefreshCcw className="mr-2 h-4 w-4" />Repeat required</Button>
                      <Button type="button" variant={outcome === "integrity_review" ? "destructive" : "outline"} onClick={() => setOutcome("integrity_review")}><ShieldAlert className="mr-2 h-4 w-4" />Integrity review</Button>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Reason code (optional)</span>
                      <input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} maxLength={100} className="h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="e.g. support-boundary-drift" />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Reviewer feedback {outcome === "approved" ? "(optional)" : "(required)"}</span>
                      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} maxLength={4000} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder={outcome === "approved" ? "Optional observation for the Specialist" : "Explain exactly what must be corrected before the next attempt."} />
                    </label>

                    {reviewMutation.error && (
                      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Review failed."}</AlertDescription></Alert>
                    )}

                    <Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
                      {reviewMutation.isPending ? "Recording decision..." : "Record immutable decision"}
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
