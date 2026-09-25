import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  History,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvidenceStatus = "observed" | "not_observed" | "confounded";
type InterventionEvent =
  | "none"
  | "neutral_clarification"
  | "first_step_confirmation"
  | "method_or_step_prompt"
  | "full_rescue_or_teaching"
  | "timer_changed";

type PodData = {
  assignment?: {
    id?: string | null;
    operationalMode?: string | null;
    operational_mode?: string | null;
  } | null;
};

type CapabilityId =
  | "condition_integrity"
  | "observation_integrity"
  | "evidence_integrity"
  | "authority_integrity"
  | "continuity_integrity";

type Readiness = {
  policyAvailable: boolean;
  policyStatus?: "candidate" | "approved";
  evidenceReady: boolean;
  practicalsReady: boolean;
  automaticTransition: false;
  nextStage: "practicals";
  earliestUnsupportedCapability: CapabilityId | null;
  phasesRepresented: string[];
  longitudinalTrajectoryEstablished: boolean;
  layers: Array<{
    capabilityId: CapabilityId;
    rawState: string;
    effectiveState: string;
    prerequisiteCapabilityId: CapabilityId | null;
    validOpportunityCount: number;
    recoveredAfterBreakdown: boolean;
    reason: string;
  }>;
  reason: string;
};

type SandboxField = {
  fieldKey: string;
  dimensionId: string;
  options: Array<{ optionId: string; label: string }>;
};

type InterventionOption = {
  id: InterventionEvent;
  label: string;
  detail: string;
};

type EnvironmentForm = {
  bankKey: string;
  bankVersion: number;
  bankTitle: string;
  trajectoryId: string;
  sessionNumber: number;
  status: "rep_ready" | "targeted_rediagnosis_required";
  prescribedPhase: string;
  prescribedStability: string;
  targetPhase?: string | null;
  sessionProgress?: {
    completedReps: number;
    totalReps: number;
  };
  eventSequence?: number;
  eventFormId?: string;
  rep?: {
    setId: string;
    setName: string;
    setPurpose: string;
    constraints: Record<string, unknown>;
    repNumber: number;
    studentBehavior: string;
    fields: SandboxField[];
    interventionOptions: InterventionOption[];
  };
  readiness: Readiness;
  studentStateAuthoritative: false;
  evidenceScope: "sandbox";
};

type RepResult = {
  eventId: string;
  completedAt: string;
  eventSequence: number;
  sessionNumber: number;
  phase: string;
  setId: string;
  repNumber: number;
  exactObservationCount: number;
  comparableObservationCount: number;
  conditionKept: boolean;
  evidenceStatusExact: boolean;
  sessionCompleted: boolean;
  sessionAuthority: null | {
    specialist: {
      route: string;
      nextPhase: string;
      nextStability: string;
      targetPhase: string | null;
      reason: string;
    };
    authorityAligned: boolean;
    stateTrackAligned: boolean;
  };
  readiness: Readiness;
};

type HistoryData = {
  trajectory: {
    id: string;
    sessionNumber: number;
    prescribedPhase: string;
    prescribedStability: string;
    divergenceActive: boolean;
    route: string;
    targetPhase: string | null;
    completedRepCount: number;
  };
  events: Array<{
    id: string;
    eventSequence: number;
    sessionNumber: number;
    phase: string;
    setId: string;
    repNumber: number;
    conditionKept: boolean | null;
    exactObservationCount: number;
    comparableObservationCount: number;
    evidenceStatusExact: boolean | null;
    completedAt: string;
  }>;
  sessions: Array<{
    id: string;
    sessionNumber: number;
    phase: string;
    authorityAligned: boolean;
    stateTrackAligned: boolean;
    completedAt: string;
  }>;
  readiness: Readiness;
};

type Selection = {
  optionId: string;
  evidenceStatus: EvidenceStatus;
};

const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  condition_integrity: "Condition Integrity",
  observation_integrity: "Observation Integrity",
  evidence_integrity: "Evidence Integrity",
  authority_integrity: "Authority Integrity",
  continuity_integrity: "Continuity Integrity",
};

const humanize = (value: string) =>
  String(value || "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function SpecialistSandboxSimulation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [interventionEvent, setInterventionEvent] = useState<InterventionEvent>("none");
  const [lastResult, setLastResult] = useState<RepResult | null>(null);

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

  const environmentQuery = useQuery<EnvironmentForm>({
    queryKey: ["sandbox-environment", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId && inSandbox),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-environment?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  const historyQuery = useQuery<HistoryData>({
    queryKey: ["sandbox-environment-history", tutorAssignmentId],
    enabled: Boolean(tutorAssignmentId && inSandbox),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-environment/history?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return response.json();
    },
  });

  const form = environmentQuery.data;
  const rep = form?.status === "rep_ready" ? form.rep : undefined;

  const completedObservationCount = useMemo(() => {
    if (!rep) return 0;
    return rep.fields.filter((field) => selections[field.fieldKey]?.optionId).length;
  }, [rep, selections]);

  const allComplete =
    Boolean(rep) &&
    completedObservationCount === (rep?.fields.length || 0) &&
    (rep?.fields.length || 0) > 0;

  const chooseOption = (fieldKey: string, optionId: string) => {
    setSelections((current) => ({
      ...current,
      [fieldKey]: {
        optionId,
        evidenceStatus: current[fieldKey]?.evidenceStatus || "observed",
      },
    }));
  };

  const chooseStatus = (fieldKey: string, evidenceStatus: EvidenceStatus) => {
    setSelections((current) => {
      const existing = current[fieldKey];
      if (!existing?.optionId) return current;
      return { ...current, [fieldKey]: { ...existing, evidenceStatus } };
    });
  };

  const submitRep = useMutation({
    mutationFn: async () => {
      if (
        !form ||
        form.status !== "rep_ready" ||
        !rep ||
        !form.eventFormId ||
        !form.eventSequence ||
        !allComplete
      ) {
        throw new Error("Record every required observation before submitting this rep.");
      }

      const response = await apiRequest(
        "POST",
        "/api/tutor/sandbox-environment/rep",
        {
          tutorAssignmentId,
          bankVersion: form.bankVersion,
          trajectoryId: form.trajectoryId,
          eventSequence: form.eventSequence,
          eventFormId: form.eventFormId,
          submission: {
            interventionEvent,
            observations: Object.fromEntries(
              rep.fields.map((field) => [
                field.fieldKey,
                {
                  optionId: selections[field.fieldKey].optionId,
                  evidenceStatus: selections[field.fieldKey].evidenceStatus,
                },
              ]),
            ),
          },
        },
      );
      return response.json() as Promise<RepResult>;
    },
    onSuccess: async (result) => {
      setLastResult(result);
      setSelections({});
      setInterventionEvent("none");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment", tutorAssignmentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment-history", tutorAssignmentId],
        }),
      ]);
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
              Sandbox opens only after the Specialist enters Sandbox mode. Training Capability
              Checks remain separate.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (environmentQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Preparing the Sandbox student...
      </div>
    );
  }

  if (environmentQuery.error || !form) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The stateful Sandbox environment is not available yet.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const readiness = form.readiness;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <div className="text-right text-xs text-muted-foreground">
            <p>Sandbox session {form.sessionNumber}</p>
            {form.sessionProgress && (
              <p>
                {form.sessionProgress.completedReps}/{form.sessionProgress.totalReps} reps complete
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  <CardTitle>Stateful Sandbox</CardTitle>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  This is one continuing simulated RI student. The system prescribes the
                  condition, the student responds, you record the evidence, and the trajectory
                  continues from what the evidence earns.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{form.prescribedPhase}</Badge>
                <Badge variant="secondary">{form.prescribedStability}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                The simulated student has hidden canonical truth. Your job is not to make the
                student progress. Preserve the prescribed condition and record what actually
                happened. Sandbox evidence never changes a real student.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Sandbox capability evidence</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Readiness follows the earliest unsupported Specialist capability, not a
                  scenario count or average score.
                </p>
              </div>
              <Badge variant={readiness.practicalsReady ? "default" : "outline"}>
                {readiness.practicalsReady
                  ? "Practicals ready"
                  : readiness.evidenceReady
                    ? "Evidence ready"
                    : "Developing"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness.policyAvailable ? (
              <>
                <div className="grid gap-3 md:grid-cols-5">
                  {readiness.layers.map((layer) => (
                    <div key={layer.capabilityId} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        {CAPABILITY_LABELS[layer.capabilityId]}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {humanize(layer.effectiveState)}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {layer.validOpportunityCount} valid opportunities
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {readiness.earliestUnsupportedCapability
                      ? `Current evidence focus: ${CAPABILITY_LABELS[readiness.earliestUnsupportedCapability]}`
                      : "All capability layers currently supported"}
                  </span>
                  {readiness.policyStatus === "candidate" && (
                    <Badge variant="secondary">Policy under validation</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{readiness.reason}</p>
            )}
          </CardContent>
        </Card>

        {lastResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Rep {lastResult.repNumber} recorded: {lastResult.exactObservationCount}/
              {lastResult.comparableObservationCount} observations aligned
              {lastResult.conditionKept ? " · condition preserved" : " · condition changed"}
              {lastResult.sessionCompleted
                ? lastResult.sessionAuthority?.stateTrackAligned
                  ? " · session state remained aligned"
                  : " · session state diverged"
                : ""}.
            </AlertDescription>
          </Alert>
        )}

        {form.status === "targeted_rediagnosis_required" ? (
          <Card>
            <CardHeader>
              <CardTitle>Targeted re-diagnosis required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The simulated student produced evidence that made an earlier prerequisite
                untrustworthy. Ordinary Training is paused. The RI route now requires targeted
                evidence-complete re-diagnosis
                {form.targetPhase ? ` at ${form.targetPhase}` : ""}.
              </p>
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  The trajectory has been preserved. Training will not silently continue through
                  an unresolved prerequisite.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : rep ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{rep.setName} · Rep {rep.repNumber}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{rep.setPurpose}</p>
                  </div>
                  <Badge variant="outline">
                    {(form.sessionProgress?.completedReps || 0) + 1} / {form.sessionProgress?.totalReps || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(rep.constraints)
                    .map(([key, value]) => `${humanize(key)}: ${humanize(String(value))}`)
                    .join(" · ")}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Simulated student behaviour
                  </p>
                  <p className="mt-2 leading-relaxed">{rep.studentBehavior}</p>
                </div>

                <div>
                  <p className="font-medium">What did you do during this rep?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Record the intervention that actually occurred. The Sandbox will determine
                    whether it preserved the prescribed condition and which evidence remains
                    eligible.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {rep.interventionOptions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant={interventionEvent === option.id ? "default" : "outline"}
                        className="h-auto justify-start whitespace-normal py-3 text-left"
                        onClick={() => setInterventionEvent(option.id)}
                      >
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="mt-1 block text-xs opacity-80">{option.detail}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6">
                  {rep.fields.map((field) => {
                    const selection = selections[field.fieldKey];
                    return (
                      <div key={field.fieldKey} className="rounded-xl border p-4">
                        <p className="font-medium">{humanize(field.dimensionId)}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {field.options.map((option) => (
                            <Button
                              key={option.optionId}
                              type="button"
                              variant={selection?.optionId === option.optionId ? "default" : "outline"}
                              className="h-auto justify-start whitespace-normal py-3 text-left"
                              onClick={() => chooseOption(field.fieldKey, option.optionId)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["observed", "not_observed", "confounded"] as EvidenceStatus[]).map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              type="button"
                              disabled={!selection?.optionId}
                              variant={selection?.evidenceStatus === status ? "secondary" : "ghost"}
                              onClick={() => chooseStatus(field.fieldKey, status)}
                            >
                              {humanize(status)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              disabled={!allComplete || submitRep.isPending}
              onClick={() => submitRep.mutate()}
            >
              {submitRep.isPending ? "Recording rep evidence..." : "Record rep and continue"}
            </Button>

            {submitRep.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {submitRep.error instanceof Error
                    ? submitRep.error.message
                    : "Sandbox rep submission failed."}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Trajectory record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(historyQuery.data?.sessions || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Completed sessions</p>
                {historyQuery.data!.sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        Session {session.sessionNumber} · {session.phase}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        RI authority {session.authorityAligned ? "aligned" : "diverged"} · state{" "}
                        {session.stateTrackAligned ? "aligned" : "diverged"}
                      </p>
                    </div>
                    <Badge variant={session.stateTrackAligned ? "default" : "outline"}>
                      {session.stateTrackAligned ? "Truth preserved" : "Review evidence"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {historyQuery.data?.trajectory.completedRepCount || 0} Sandbox reps have been
              recorded on this persistent trajectory.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
