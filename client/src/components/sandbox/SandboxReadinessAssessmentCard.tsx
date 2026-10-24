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
  cleanWindow?: { qualified: boolean; completeCleanSessions: number; requiredCleanSessions: number | null; reason: string };
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

type SandboxDossier = {
  reps: Array<{id:string; sessionNumber:number; phase:string; setId:string; repNumber:number;
    studentBehavior:string; observationExact:boolean|null; evidenceExact:boolean|null;
    conditionKept:boolean|null; truthPresent:boolean; comparisons:Array<{
      fieldKey:string; recorded:{optionId:string;label?:string|null;evidenceStatus?:string}|null;
      expected:{optionId:string;label?:string|null;evidenceStatus?:string}|null; matched:boolean;
    }> }>;
  sessions:Array<{id:string;sessionNumber:number;phase:string;topicKey?:string|null;completedAt?:string|null;
    stateChangeObserved?:boolean|null;authorityAligned:boolean;stateTrackAligned:boolean;truthPresent:boolean;
    specialistAuthority:any;canonicalAuthority:any}>;
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
    .replace(/[._]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReadinessReason(value: string | null | undefined) {
  return String(value || "Readiness is still developing.").replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (token) => humanize(token));
}

function formatOptionId(value: string) {
  const optionMatch = value.match(/(?:^|\.)Option\.(\d+)$/i);
  return optionMatch ? `Option ${optionMatch[1]}` : humanize(value);
}

function formatRecordedValue(value: string) {
  const [rawValue, ...statusParts] = value.split(" · ");
  const optionMatch = rawValue.match(/(?:^|\.)Option[. ](\d+)$/i);
  const readableValue = optionMatch ? `Option ${optionMatch[1]}` : humanize(rawValue);
  return [readableValue, ...statusParts.map((part) => humanize(part))].join(" · ");
}

function formatEvidenceValue(value: unknown): string {
  if (value == null || value === "") return "Not recorded";
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.optionId || record.label || record.evidenceStatus) {
      return [record.label ? String(record.label) : record.optionId ? formatOptionId(String(record.optionId)) : null, record.evidenceStatus ? humanize(String(record.evidenceStatus)) : null]
        .filter(Boolean)
        .join(" · ");
    }
    return Object.entries(record)
      .map(([key, entry]) => humanize(key) + ": " + formatEvidenceValue(entry))
      .join(" · ");
  }
  if (Array.isArray(value)) return value.map((entry) => formatEvidenceValue(entry)).join(", ");
  return formatRecordedValue(String(value));
}

function formatDossierTimestamp(value?: string | null) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : date.toLocaleString();
}

function authorityParts(value: unknown) {
  const labelMap: Record<string, string> = {
    Route: "Next step",
    Reason: "Why",
    "Next Phase": "Phase",
    "Next Stability": "Stability",
    "Transition Reason": "Change",
  };
  return formatEvidenceValue(value)
    .split(" · ")
    .map((part) => {
      const separator = part.indexOf(":");
      const rawLabel = separator > 0 ? part.slice(0, separator).trim() : "Decision";
      return separator > 0
        ? { label: labelMap[rawLabel] || rawLabel, value: part.slice(separator + 1).trim() }
        : { label: "Decision", value: part.trim() };
    })
    .filter((part) => part.value && part.value.toLowerCase() !== "not recorded");
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

  const [showTrainingEvidence, setShowTrainingEvidence] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const { data: dossier, isFetching: dossierLoading, isError: dossierError } = useQuery<SandboxDossier>({
    queryKey: ["/api/td/tutors", tutorId, "sandbox-evidence-dossier"],
    enabled: !!tutorId && showDossier && isSandbox,
    gcTime: 0,
    staleTime: 0,
    networkMode: "always",
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/td/tutors/${encodeURIComponent(tutorId)}/sandbox-evidence-dossier`);
      return response.json();
    },
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
          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Training evidence</p>
                <p className="text-xs text-muted-foreground">Deep Dive and qualification details are available when needed.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowTrainingEvidence(value => !value)}>
                {showTrainingEvidence ? "Hide evidence" : "Inspect evidence"}
              </Button>
            </div>
            {showTrainingEvidence ? (
              <div className="space-y-4 border-t border-border/60 pt-3">
                {readiness ? <p className="text-sm text-muted-foreground">{formatReadinessReason(readiness.reason)}</p> : null}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Coverage: {readiness?.breadthReady ? "Established" : "Developing"}</span>
                  <span>Consistency: {readiness?.longitudinalReady ? "Established" : "Developing"}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Sandbox evidence</p>
                <p className="text-xs text-muted-foreground">Compare the Specialist’s decisions with the expected decisions and resulting state.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDossier(value => !value)}>
                {showDossier ? "Hide evidence" : "Inspect evidence"}
              </Button>
            </div>
            {showDossier && dossierLoading ? <p className="text-sm">Loading committed Sandbox evidence...</p> : null}
            {showDossier && dossierError ? <p className="text-sm text-destructive">Evidence unavailable; readiness must not be inferred.</p> : null}
            {showDossier && !dossierLoading && !dossierError && dossier ? (
              <div className="space-y-4 max-h-[700px] overflow-y-auto">
                <div className="rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  Completed Sandbox sessions and rep evidence are shown below. Open a session to review its sets and reps.
                </div>
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sessions and evidence</p>
                    <Badge variant="outline">{dossier.sessions.length} sessions · {dossier.reps.length} reps</Badge>
                  </div>
                  {[...dossier.sessions].sort((a, b) => a.sessionNumber - b.sessionNumber).map(session => {
                    const sessionReps = dossier.reps
                      .filter(rep => rep.sessionNumber === session.sessionNumber)
                      .sort((a, b) => a.repNumber - b.repNumber);
                    const setIds = Array.from(new Set(sessionReps.map(rep => rep.setId)));
                    return (
                      <details key={session.id} className="rounded-lg border bg-background p-3">
                        <summary className="cursor-pointer list-none text-sm font-medium">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>Session {session.sessionNumber} · {humanize(session.phase)}{session.topicKey ? " · " + humanize(session.topicKey) : ""}</span>
                            <Badge variant={session.authorityAligned && session.stateTrackAligned ? "default" : "destructive"}>{session.authorityAligned && session.stateTrackAligned ? "Evidence aligned" : "Review required"}</Badge>
                          </div>
                        </summary>
                        <div className="mt-3 space-y-3 border-t pt-3 text-xs">
                          <p className="text-muted-foreground">Completed {formatDossierTimestamp(session.completedAt)} · Decision: {session.authorityAligned ? "Aligned" : "Needs review"} · State: {session.stateTrackAligned ? "Aligned" : "Diverged"} · State change observed: {session.stateChangeObserved == null ? "Not recorded" : session.stateChangeObserved ? "Yes" : "No"}</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            {[{ title: "Recorded decision", value: session.specialistAuthority }, { title: "Expected decision", value: session.canonicalAuthority }].map((decision) => (
                              <div key={decision.title} className="rounded-md border bg-muted/20 p-3">
                                <p className="font-semibold text-foreground">{decision.title}</p>
                                <dl className="mt-2 space-y-1.5">
                                  {authorityParts(decision.value).map((part) => (
                                    <div key={`${decision.title}-${part.label}`} className="grid grid-cols-[auto_1fr] gap-2 text-xs">
                                      <dt className="font-medium text-muted-foreground">{part.label}</dt>
                                      <dd className="text-foreground">{part.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sets</p>{setIds.map((setId, setIndex) => { const setReps = sessionReps.filter(rep => rep.setId === setId); return <details key={setId} className="rounded-md border bg-muted/10 p-3"><summary className="cursor-pointer list-none font-medium">Set {setIndex + 1} · {setReps.length} reps</summary><div className="mt-3 space-y-2">{setReps.map(rep => <details key={rep.id} className="rounded-md border bg-background p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-2"><span>Rep {rep.repNumber}</span><Badge variant={rep.truthPresent && rep.observationExact && rep.evidenceExact && rep.conditionKept === true ? "default" : "destructive"}>{rep.truthPresent && rep.observationExact && rep.evidenceExact && rep.conditionKept === true ? "Evidence aligned" : "Review required"}</Badge></div></summary><div className="mt-3 space-y-3 border-t pt-3"><p><span className="font-semibold text-foreground">Student behaviour:</span> <span className="text-muted-foreground">{rep.studentBehavior}</span></p><p className="text-muted-foreground">Condition preserved: {rep.conditionKept == null ? "Not recorded" : rep.conditionKept ? "Yes" : "No"} · Canonical evidence: {rep.truthPresent ? "Available" : "Unavailable"}</p><div className="space-y-2">{rep.comparisons.map(c => <div key={c.fieldKey} className="rounded-md border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-foreground">{humanize(c.fieldKey)}</p><Badge variant={c.matched ? "default" : "destructive"}>{c.matched ? "Aligned" : "Diverged"}</Badge></div><div className="mt-2 grid gap-2 md:grid-cols-2"><p className="text-muted-foreground"><span className="font-medium text-foreground">Recorded:</span> {formatEvidenceValue(c.recorded)}</p><p className="text-muted-foreground"><span className="font-medium text-foreground">Expected:</span> {formatEvidenceValue(c.expected)}</p></div></div>)}</div></div></details>)}</div></details>; })}</div>
                        </div>
                      </details>
                    );
                  })}
                  {dossier.sessions.length === 0 ? <p className="text-sm text-muted-foreground">No completed Sandbox sessions recorded.</p> : null}
                </section>
              </div>
            ) : null}
          </div>

          {readiness?.cleanWindow ? (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm font-semibold">Zero-divergence graduation gate</p>
              <p className="mt-1 text-sm">
                {readiness.cleanWindow.qualified ? "Qualifying evidence established" : "Not yet qualified"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {readiness.cleanWindow.requiredCleanSessions === null
                  ? "Consecutive clean-session requirement awaits Founder-approved calibration."
                  : `${readiness.cleanWindow.completeCleanSessions}/${readiness.cleanWindow.requiredCleanSessions} consecutive clean sessions`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{readiness.cleanWindow.reason}</p>
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



