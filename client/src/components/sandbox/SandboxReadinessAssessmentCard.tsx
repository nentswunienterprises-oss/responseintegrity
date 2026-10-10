import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CapabilityLayer = {
  layer: string;
  state: string;
  validOpportunityCount: number;
  minimumValidOpportunities: number;
  supportedCount?: number;
  breakdownCount?: number;
  recoveredAfterBreakdown?: boolean;
  prerequisiteSupported?: boolean;
  authoritative?: boolean;
};

type CapabilityReadiness = {
  policyAvailable: boolean;
  bankKey?: string | null;
  bankVersion?: number | null;
  policyVersion?: number | null;
  policyStatus?: "candidate" | "approved";
  evidenceReady: boolean;
  practicalsReady: boolean;
  automaticTransition: false;
  nextStage: "practicals";
  earliestUnsupportedCapability: string | null;
  layers: CapabilityLayer[];
  breadthReady: boolean;
  longitudinalReady: boolean;
  reason: string;
  exposure?: {
    distinctPhases: number;
    distinctSets: number;
    distinctRepPositions: number;
    completedSessions: number;
    stateChangeObserved: boolean;
    breakdownRecoveryObserved: boolean;
  };
};

type SandboxReadinessPayload = {
  tutorId: string;
  tutorAssignmentId: string;
  mode: string;
  capabilityReadiness: CapabilityReadiness;
  latestAssessment: {
    decision: "passed" | "remediation_required";
    evidenceNote: string;
    assessedAt: string;
    assessedByUserId: string;
  } | null;
  gate: {
    readyForPracticals: boolean;
    blockers: string[];
    preparationBlockers: string[];
    systemPracticalsReady: boolean;
    tdApproved: boolean;
    nextStage: "practicals";
    automaticTransition: false;
  };
};

const CAPABILITY_LABELS: Record<string, string> = {
  condition_integrity: "Condition Integrity",
  observation_integrity: "Observation Integrity",
  evidence_integrity: "Evidence Integrity",
  authority_integrity: "Authority Integrity",
  continuity_integrity: "Continuity Integrity",
};

function humanize(value: string | null | undefined) {
  return String(value || "unresolved")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SandboxReadinessAssessmentCard({
  tutorId,
  tutorName,
  operationalMode,
}: {
  tutorId: string;
  tutorName: string;
  operationalMode?: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [decision, setDecision] = useState<"passed" | "remediation_required">(
    "remediation_required",
  );
  const [evidenceNote, setEvidenceNote] = useState("");
  const isSandbox = String(operationalMode || "").toLowerCase() === "sandbox";
  const queryKey = ["/api/td/tutors", tutorId, "sandbox-readiness"];

  const { data, isLoading } = useQuery<SandboxReadinessPayload>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/td/tutors/${tutorId}/sandbox-readiness`,
      );
      return response.json();
    },
    enabled: !!tutorId && isSandbox,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!data?.latestAssessment) return;
    setDecision(data.latestAssessment.decision);
    setEvidenceNote(data.latestAssessment.evidenceNote || "");
  }, [data?.latestAssessment]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/td/tutors/${tutorId}/sandbox-readiness-assessment`,
        {
          decision,
          evidenceNote,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/td/pod-overview"] }),
      ]);
      toast({
        title:
          decision === "passed"
            ? "Practicals readiness approved"
            : "Sandbox remediation recorded",
        description:
          decision === "passed"
            ? `${tutorName} is approved for Practicals entry. Sandbox lifecycle permission remains in place until the governed stage transition is executed.`
            : `${tutorName} remains in Sandbox while the identified capability gap is recovered.`,
      });
    },
    onError: (error: any) =>
      toast({
        title: "Readiness decision blocked",
        description:
          error?.message || "Failed to record the Sandbox readiness assessment.",
        variant: "destructive",
      }),
  });

  if (!isSandbox) return null;

  const readiness = data?.capabilityReadiness;
  const latestDecision = data?.latestAssessment?.decision || null;
  const canOpenPracticals =
    readiness?.practicalsReady === true &&
    (data?.gate.preparationBlockers?.length || 0) === 0 &&
    !!evidenceNote.trim();

  return (
    <Card className="border-sky-200 bg-sky-50/30 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-900">
            Sandbox Specialist Evaluation
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            TD Readiness Review
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            The Sandbox engine builds Specialist capability truth continuously.
            The TD reviews that evidence, records remediation where needed, and
            approves Practicals readiness only when the system is ready.
          </p>
          {readiness?.bankKey && readiness?.bankVersion && readiness?.policyVersion ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Evidence lineage: Sandbox bank v{readiness.bankVersion}, capability policy v{readiness.policyVersion} ({readiness.policyStatus || "unapproved"}). TD sign-off applies only to these exact versions.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={readiness?.practicalsReady ? "default" : "outline"}>
            {readiness?.practicalsReady ? "System ready" : "Developing"}
          </Badge>
          {latestDecision ? (
            <Badge
              variant={
                latestDecision === "passed" ? "default" : "destructive"
              }
            >
              {latestDecision === "passed"
                ? "TD signed off"
                : "Remediation active"}
            </Badge>
          ) : (
            <Badge variant="outline">TD review pending</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Loading Sandbox capability evidence...
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(readiness?.layers || []).map((layer) => (
              <div
                key={layer.layer}
                className="rounded-lg border bg-background p-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {CAPABILITY_LABELS[layer.layer] || humanize(layer.layer)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {humanize(layer.state)}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {layer.validOpportunityCount}/{layer.minimumValidOpportunities} valid opportunities
                </p>
              </div>
            ))}
          </div>

          {readiness ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Capability stack</p>
                <p className="mt-1 text-sm font-semibold">
                  {readiness.earliestUnsupportedCapability
                    ? `Developing ${CAPABILITY_LABELS[readiness.earliestUnsupportedCapability] || humanize(readiness.earliestUnsupportedCapability)}`
                    : "All required layers supported"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Breadth</p>
                <p className="mt-1 text-sm font-semibold">
                  {readiness.breadthReady ? "Established" : "Still developing"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Longitudinal proof</p>
                <p className="mt-1 text-sm font-semibold">
                  {readiness.longitudinalReady
                    ? "Established"
                    : "Still developing"}
                </p>
              </div>
            </div>
          ) : null}

          {readiness?.reason ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              {readiness.reason}
            </div>
          ) : null}

          {data?.gate.preparationBlockers?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Preparation blockers
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {data.gate.preparationBlockers.map((blocker) => (
                  <li key={blocker}>- {blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data?.latestAssessment ? (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Latest TD decision
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.latestAssessment.decision === "passed"
                  ? "Ready for Practicals"
                  : "Remediation required"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.latestAssessment.evidenceNote}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {new Date(data.latestAssessment.assessedAt).toLocaleString("en-ZA")}
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor={`sandbox-readiness-note-${tutorId}`}>
              TD evidence note
            </Label>
            <Textarea
              id={`sandbox-readiness-note-${tutorId}`}
              value={evidenceNote}
              onChange={(event) => setEvidenceNote(event.target.value)}
              className="mt-2"
              placeholder="Name the capability evidence, the remaining gap, and the remediation or readiness basis."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={
                decision === "remediation_required" ? "destructive" : "outline"
              }
              onClick={() => setDecision("remediation_required")}
            >
              Remediation required
            </Button>
            <Button
              type="button"
              variant={decision === "passed" ? "default" : "outline"}
              disabled={!canOpenPracticals}
              onClick={() => setDecision("passed")}
            >
              Ready for Practicals
            </Button>
            <Button
              type="button"
              className="sm:ml-auto"
              disabled={
                mutation.isPending ||
                !evidenceNote.trim() ||
                (decision === "passed" && !canOpenPracticals)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? "Saving..."
                : decision === "passed"
                  ? "Approve for Practicals"
                  : "Record remediation"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            This review does not auto-promote the Specialist to Trial. Practicals
            remains the next governed stage, while COO authority is reserved for
            policy, exceptions, and later lifecycle decisions.
          </p>
        </div>
      )}
    </Card>
  );
}

export default SandboxReadinessAssessmentCard;
