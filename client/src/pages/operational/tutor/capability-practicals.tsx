import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, RefreshCcw, ShieldAlert, Target, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Pod, TutorAssignment } from "@shared/schema";
import { getCapabilityPracticalProofDefinition } from "@shared/capabilityPracticalEvidence";

type PracticalProofKey = "prepare" | "execute" | "evidence";
type PracticalArtifactType = "screen_voice" | "screen_video" | "video";
type PracticalStatus = "submitted" | "approved" | "repeat_required" | "integrity_review";

type PracticalDefinition = {
  key: PracticalProofKey;
  version: number;
  title: string;
  purpose: string;
  requiredArtifactTypes: PracticalArtifactType[];
  mustShow: string[];
  declarationPrompts: Array<{ key: string; prompt: string; minLength: number }>;
  realStudentDataAllowed: false;
};

type PracticalEvidence = {
  evidenceId: string;
  proofKey: PracticalProofKey;
  proofVersion: number;
  attemptNumber: number;
  artifactType: PracticalArtifactType;
  status: PracticalStatus;
  feedback: string | null;
  reasonCode: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

type PracticalPayload = {
  proofs: PracticalDefinition[];
  evidence: PracticalEvidence[];
};

type ReadinessRequirement = {
  code: string;
  kind: "assessment" | "practical" | "oral_defense";
  label: string;
  satisfied: boolean;
};

type ShadowReadiness = {
  gateKey: string;
  gateVersion: number;
  label: string;
  authoritative: false;
  status: "READY" | "NOT_READY";
  satisfiedRequirementCodes: string[];
  missingRequirementCodes: string[];
  requirements: ReadinessRequirement[];
};

type OralDefenseStatus = {
  defenseVersion: number;
  attemptNumber: number;
  outcome: "approved" | "repeat_required" | "integrity_review";
  feedback: string | null;
  completedAt: string;
} | null;

type PodData = {
  assignment: TutorAssignment & { pod: Pod };
};

function artifactLabel(type: PracticalArtifactType) {
  if (type === "screen_voice") return "Screen recording + voice explanation";
  if (type === "screen_video") return "Screen recording + visible video demonstration";
  return "Video demonstration";
}

function statusPresentation(status?: PracticalStatus) {
  if (status === "approved") {
    return { label: "Approved", detail: "Practical capability evidence accepted.", icon: CheckCircle2 };
  }
  if (status === "repeat_required") {
    return { label: "Repeat required", detail: "Use the reviewer feedback and submit a new attempt.", icon: RefreshCcw };
  }
  if (status === "integrity_review") {
    return { label: "Integrity review", detail: "This proof is paused for review. Do not resubmit yet.", icon: ShieldAlert };
  }
  if (status === "submitted") {
    return { label: "Awaiting review", detail: "Your immutable submission is in the review queue.", icon: Clock3 };
  }
  return { label: "Not submitted", detail: "Record the required sandbox demonstration and submit its review link.", icon: Video };
}

function oralStatusPresentation(defense: OralDefenseStatus) {
  if (!defense) return "Not yet completed";
  if (defense.outcome === "approved") return `Approved on attempt ${defense.attemptNumber}`;
  if (defense.outcome === "integrity_review") return `Integrity review after attempt ${defense.attemptNumber}`;
  return `Repeat required after attempt ${defense.attemptNumber}`;
}

export default function SpecialistCapabilityPracticals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProofKey, setSelectedProofKey] = useState<PracticalProofKey | null>(null);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [artifactType, setArtifactType] = useState<PracticalArtifactType | "">("");
  const [declaration, setDeclaration] = useState<Record<string, string>>({});
  const [sandboxConfirmed, setSandboxConfirmed] = useState(false);

  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });

  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const practicalQuery = useQuery<PracticalPayload>({
    queryKey: ["capability-practicals", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-practicals?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as PracticalPayload;
    },
  });

  const readinessQuery = useQuery<{ readiness: ShadowReadiness }>({
    queryKey: ["capability-readiness", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-readiness?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as { readiness: ShadowReadiness };
    },
  });

  const oralDefenseQuery = useQuery<{ defense: OralDefenseStatus }>({
    queryKey: ["capability-oral-defense-status", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-oral-defense?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as { defense: OralDefenseStatus };
    },
  });

  const selectedProof = practicalQuery.data?.proofs.find((proof) => proof.key === selectedProofKey) || null;
  const selectedProofStandard = selectedProof ? getCapabilityPracticalProofDefinition(selectedProof.key) : null;
  const selectedRubric = selectedProofStandard?.version === selectedProof?.version
    ? selectedProofStandard.reviewRubric
    : null;
  const readiness = readinessQuery.data?.readiness || null;
  const defense = oralDefenseQuery.data?.defense || null;

  const latestByProof = useMemo(() => {
    const map = new Map<PracticalProofKey, PracticalEvidence>();
    for (const evidence of practicalQuery.data?.evidence || []) {
      const current = map.get(evidence.proofKey);
      if (!current || evidence.attemptNumber > current.attemptNumber) {
        map.set(evidence.proofKey, evidence);
      }
    }
    return map;
  }, [practicalQuery.data?.evidence]);

  const resetForm = () => {
    setArtifactUrl("");
    setArtifactType("");
    setDeclaration({});
    setSandboxConfirmed(false);
  };

  const openProof = (proof: PracticalDefinition) => {
    const latest = latestByProof.get(proof.key);
    if (latest?.status === "submitted" || latest?.status === "approved" || latest?.status === "integrity_review") return;
    setSelectedProofKey(proof.key);
    resetForm();
    setArtifactType(proof.requiredArtifactTypes[0] || "");
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProof || !artifactType) throw new Error("Select a valid practical proof and recording type.");
      if (!sandboxConfirmed) throw new Error("Confirm that the recording contains no real student data.");

      for (const prompt of selectedProof.declarationPrompts) {
        if (String(declaration[prompt.key] || "").trim().length < prompt.minLength) {
          throw new Error(`Complete "${prompt.prompt}" with at least ${prompt.minLength} characters.`);
        }
      }

      const response = await apiRequest(
        "POST",
        `/api/tutor/capability-practicals/${selectedProof.key}`,
        {
          tutorAssignmentId,
          proofVersion: selectedProof.version,
          artifactUrl: artifactUrl.trim(),
          artifactType,
          declaration,
          noRealStudentDataConfirmed: true,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      resetForm();
      setSelectedProofKey(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capability-practicals", tutorAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["capability-ledger", tutorAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["capability-readiness", tutorAssignmentId] }),
      ]);
    },
  });

  if (podQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading Specialist assignment...</div>;
  }

  if (podQuery.error || !tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>A Specialist assignment is required before practical evidence can be submitted.</AlertDescription></Alert>
          <Button variant="outline" onClick={() => navigate("/specialist/pod")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Specialist Pod</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate("/responseconditioningsystem")}><ArrowLeft className="mr-2 h-4 w-4" />Back to RI-OS</Button>
            <p className="text-sm font-medium text-muted-foreground">Capability Engine - Practical Evidence</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Show the work.</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              These practicals test whether you can operate Response Integrity, not merely explain it. Use only the provided sandbox scenario. Never record a real student or expose real family data here.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Shadow capability readiness</p>
                <CardTitle className="mt-1 flex items-center gap-2">
                  <Target className="h-5 w-5" /> {readiness?.status || "Checking evidence..."}
                </CardTitle>
              </div>
              {readiness && (
                <span className="rounded-full border px-3 py-1 text-xs font-medium">
                  {readiness.satisfiedRequirementCodes.length}/{readiness.requirements.length} requirements
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <AlertDescription>
                This is a shadow signal only. It cannot certify you, change your operational mode, open Trial, or replace the current Battle Test and Sandbox Mock Gate.
              </AlertDescription>
            </Alert>

            {readinessQuery.error ? (
              <p className="text-sm text-muted-foreground">Readiness could not be calculated. Your existing training state has not changed.</p>
            ) : readiness ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {readiness.requirements.map((requirement) => (
                  <div key={requirement.code} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    {requirement.satisfied ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{requirement.label}</p>
                      <p className="text-xs text-muted-foreground">{requirement.satisfied ? "Evidence satisfied" : "Evidence still required"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Calculating current-version evidence...</p>
            )}

            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oral Integrity Defense</p>
              <p className="mt-1 font-semibold">{oralStatusPresentation(defense)}</p>
              {!defense && readiness && readiness.requirements.filter((item) => item.kind !== "oral_defense").every((item) => item.satisfied) && (
                <p className="mt-2 text-sm text-muted-foreground">Your pre-oral evidence stack is complete. You are now eligible for targeted human verification.</p>
              )}
              {defense?.feedback && (
                <Alert className="mt-3"><AlertDescription><span className="font-medium">Reviewer feedback:</span> {defense.feedback}</AlertDescription></Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {practicalQuery.error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Practical evidence could not be loaded. Your existing training state has not changed.</AlertDescription></Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {(practicalQuery.data?.proofs || []).map((proof) => {
            const latest = latestByProof.get(proof.key);
            const presentation = statusPresentation(latest?.status);
            const StatusIcon = presentation.icon;
            const canSubmit = !latest || latest.status === "repeat_required";

            return (
              <Card key={proof.key} className={selectedProofKey === proof.key ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{proof.title}</CardTitle>
                    <StatusIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{presentation.label}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{proof.purpose}</p>
                  {latest?.feedback && (
                    <Alert>
                      <AlertDescription><span className="font-medium">Reviewer feedback:</span> {latest.feedback}</AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">{presentation.detail}{latest ? ` Latest attempt: ${latest.attemptNumber}.` : ""}</p>
                  <Button className="w-full" variant={canSubmit ? "default" : "outline"} disabled={!canSubmit} onClick={() => openProof(proof)}>
                    {latest?.status === "repeat_required" ? "Submit repeat" : latest ? presentation.label : "Prepare submission"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedProof && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedProof.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Version {selectedProof.version} - sandbox evidence only</p>
            </CardHeader>
            <CardContent className="space-y-7">
              <div>
                <h2 className="font-semibold">Your recording must show</h2>
                <div className="mt-3 grid gap-2">
                  {selectedProof.mustShow.map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-lg border p-3 text-sm">
                      <span className="font-semibold text-muted-foreground">{index + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRubric ? (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">How this will be judged</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The reviewer uses this same rubric. Approved requires every criterion to be Clear. Partial or ordinary Fail requires a repeat. An integrity-critical Fail pauses the proof for integrity review.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Rubric v{selectedRubric.version}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedRubric.criteria.map((criterion, index) => (
                      <div key={criterion.key} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criterion {index + 1}</p>
                            <p className="mt-1 font-semibold">{criterion.label}</p>
                          </div>
                          {criterion.criticalOnFail ? (
                            <span className="rounded-full border px-2.5 py-1 text-xs font-medium">Integrity-critical if Fail</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm">{criterion.observableStandard}</p>
                        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                          <div className="rounded-md border p-3"><span className="font-semibold">Clear:</span> {criterion.clearAnchor}</div>
                          <div className="rounded-md border p-3"><span className="font-semibold">Partial:</span> {criterion.partialAnchor}</div>
                          <div className="rounded-md border p-3"><span className="font-semibold">Fail:</span> {criterion.failAnchor}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>The review rubric for this practical version could not be loaded. Do not submit until the standard is available.</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Recording type</span>
                  <select
                    value={artifactType}
                    onChange={(event) => setArtifactType(event.target.value as PracticalArtifactType)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {selectedProof.requiredArtifactTypes.map((type) => <option key={type} value={type}>{artifactLabel(type)}</option>)}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">HTTPS review link</span>
                  <input
                    type="url"
                    value={artifactUrl}
                    onChange={(event) => setArtifactUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </label>
              </div>

              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertDescription>
                  Submit a link reviewers can open. RI stores the evidence reference, not the video bytes. Do not place passwords, access tokens, student names or family information in the URL.
                </AlertDescription>
              </Alert>

              <div className="space-y-5">
                {selectedProof.declarationPrompts.map((prompt) => (
                  <label key={prompt.key} className="block space-y-2">
                    <span className="text-sm font-medium">{prompt.prompt}</span>
                    <textarea
                      value={declaration[prompt.key] || ""}
                      onChange={(event) => setDeclaration((current) => ({ ...current, [prompt.key]: event.target.value }))}
                      rows={4}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">Minimum {prompt.minLength} characters.</span>
                  </label>
                ))}
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-4">
                <input type="checkbox" className="mt-1" checked={sandboxConfirmed} onChange={(event) => setSandboxConfirmed(event.target.checked)} />
                <span className="text-sm">
                  I confirm this recording uses only the provided sandbox scenario and contains no real student, parent or family data.
                </span>
              </label>

              {submitMutation.error && (
                <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{submitMutation.error instanceof Error ? submitMutation.error.message : "Submission failed."}</AlertDescription></Alert>
              )}

              <div className="flex flex-wrap gap-3">
                <Button disabled={submitMutation.isPending || !artifactUrl.trim() || !artifactType || !sandboxConfirmed || !selectedRubric} onClick={() => submitMutation.mutate()}>
                  {submitMutation.isPending ? "Submitting..." : "Submit immutable evidence"}
                </Button>
                <Button variant="outline" onClick={() => { setSelectedProofKey(null); resetForm(); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
