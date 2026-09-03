import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SANDBOX_MOCK_CRITERIA,
  SANDBOX_REQUIRED_ACCOUNT_COUNT,
  createEmptySandboxMockChecklist,
  type SandboxMockChecklist,
  type SandboxMockDecision,
  type SandboxReadinessGate,
} from "@shared/sandboxReadiness";
import type { SpecialistDevelopmentPathwayOverview } from "@shared/specialistDevelopmentPathway";

interface SandboxReadinessPayload {
  tutorId: string;
  tutorAssignmentId: string;
  mode: string;
  pathway: SpecialistDevelopmentPathwayOverview | null;
  sandboxAccountCount: number;
  moduleProgress: Array<{ moduleKey: string; title: string; completed: boolean }>;
  latestMockAssessment: {
    decision: SandboxMockDecision;
    checklist: SandboxMockChecklist;
    evidenceNote: string;
    assessedAt: string;
  } | null;
  gate: SandboxReadinessGate;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SandboxMockGateCard({
  tutorId,
  tutorName,
  operationalMode,
}: {
  tutorId: string;
  tutorName: string;
  operationalMode?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<SandboxMockDecision>("passed");
  const [checklist, setChecklist] = useState<SandboxMockChecklist>(createEmptySandboxMockChecklist());
  const [evidenceNote, setEvidenceNote] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const isSandbox = String(operationalMode || "").toLowerCase() === "sandbox";
  const queryKey = ["/api/coo/tutors", tutorId, "sandbox-readiness"];

  const { data, isLoading } = useQuery<SandboxReadinessPayload>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/coo/tutors/${tutorId}/sandbox-readiness`);
      return response.json();
    },
    enabled: !!tutorId && isSandbox,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!data?.latestMockAssessment) return;
    setChecklist(data.latestMockAssessment.checklist);
    setEvidenceNote(data.latestMockAssessment.evidenceNote || "");
    setDecision(data.latestMockAssessment.decision);
  }, [data?.latestMockAssessment]);

  const prerequisiteBlockers = useMemo(
    () => (data?.gate.blockers || []).filter((blocker) => !blocker.startsWith("The Sandbox Mock")),
    [data?.gate.blockers],
  );
  const checklistComplete = SANDBOX_MOCK_CRITERIA.every((criterion) => checklist[criterion.key]);

  const assessmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/coo/tutors/${tutorId}/sandbox-mock-assessment`, {
        decision,
        checklist,
        evidenceNote,
      });
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/coo/pods/operating-overview"] }),
      ]);
      toast({
        title: decision === "passed" ? "Sandbox Mock passed" : "Remediation recorded",
        description: decision === "passed"
          ? `${tutorName} has moved into the governed Trial lifecycle.`
          : "The Specialist remains in Sandbox until a later Mock passes.",
      });
    },
    onError: (error: any) => toast({
      title: "Mock decision blocked",
      description: error?.message || "Failed to save the Sandbox Mock assessment.",
      variant: "destructive",
    }),
  });

  const extensionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/coo/tutors/${tutorId}/pathway-extension`, {
        reason: extensionReason,
      });
      return response.json();
    },
    onSuccess: async () => {
      setExtensionReason("");
      await queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Pathway extension approved",
        description: "The documented exception now runs to the fixed 90-day maximum.",
      });
    },
    onError: (error: any) => toast({
      title: "Extension blocked",
      description: error?.message || "Failed to approve the pathway extension.",
      variant: "destructive",
    }),
  });

  if (!isSandbox) return null;

  return (
    <Card className="border-sky-200 bg-sky-50/30 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-900">Sandbox Exit Gate</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Mock Readiness Assessment</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the final assessment inside Sandbox, not a separate platform mode. Passing it unlocks Trial.
          </p>
        </div>
        <Badge className="border-sky-200 bg-sky-100 text-sky-900">
          {data?.latestMockAssessment?.decision === "passed" ? "Passed" : "Sandbox"}
        </Badge>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading readiness evidence...</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Sandbox accounts</p>
              <p className="mt-1 text-sm font-semibold">
                {data?.sandboxAccountCount || 0}/{SANDBOX_REQUIRED_ACCOUNT_COUNT} available
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Standard deadline</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(data?.pathway?.standardEndsAt)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Effective deadline</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(data?.pathway?.timeline.effectiveEndsAt)}</p>
            </div>
          </div>

          {prerequisiteBlockers.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Prerequisites still blocked</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {prerequisiteBlockers.map((blocker) => <li key={blocker}>- {blocker}</li>)}
              </ul>
            </div>
          ) : null}

          {data?.pathway?.timeline.canApproveExtension && !data.pathway.timeline.canContinue ? (
            <div className="rounded-lg border border-amber-200 bg-background p-3">
              <Label htmlFor={`pathway-extension-${tutorId}`}>Documented 75 to 90 day extension reason</Label>
              <Textarea
                id={`pathway-extension-${tutorId}`}
                value={extensionReason}
                onChange={(event) => setExtensionReason(event.target.value)}
                className="mt-2"
                placeholder="Record the remediable gap and why an exception is justified."
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                disabled={!extensionReason.trim() || extensionMutation.isPending}
                onClick={() => extensionMutation.mutate()}
              >
                {extensionMutation.isPending ? "Approving..." : "Approve extension to day 90"}
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {SANDBOX_MOCK_CRITERIA.map((criterion) => (
              <Label key={criterion.key} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox
                  checked={checklist[criterion.key]}
                  onCheckedChange={(checked) => setChecklist((current) => ({
                    ...current,
                    [criterion.key]: checked === true,
                  }))}
                  className="mt-0.5"
                />
                <span className="text-sm font-normal text-foreground">{criterion.label}</span>
              </Label>
            ))}
          </div>

          <div>
            <Label htmlFor={`mock-evidence-${tutorId}`}>COO evidence note</Label>
            <Textarea
              id={`mock-evidence-${tutorId}`}
              value={evidenceNote}
              onChange={(event) => setEvidenceNote(event.target.value)}
              className="mt-2"
              placeholder="Name the observed execution evidence and any remediation required."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={decision === "remediation_required" ? "destructive" : "outline"}
              onClick={() => setDecision("remediation_required")}
            >
              Remediation required
            </Button>
            <Button
              type="button"
              variant={decision === "passed" ? "default" : "outline"}
              onClick={() => setDecision("passed")}
            >
              Pass Mock
            </Button>
            <Button
              type="button"
              className="sm:ml-auto"
              disabled={
                assessmentMutation.isPending ||
                !evidenceNote.trim() ||
                prerequisiteBlockers.length > 0 ||
                !data?.pathway?.timeline.canContinue ||
                (decision === "passed" && !checklistComplete)
              }
              onClick={() => assessmentMutation.mutate()}
            >
              {assessmentMutation.isPending ? "Saving..." : "Record Sandbox Mock decision"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
