import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  instructionPromptDisplayText,
  instructionPromptLabelFor,
} from "@/lib/instructionPromptLabel";
import {
  LiveObservationField,
  LivePhaseContext,
  LiveRepContextCard,
  LiveRepStage,
  LiveSandboxStudentResponse,
  LiveSupportPanel,
  liveObservationQuestion,
  liveTrainingActiveRules,
  liveTrainingInstruction,
  type LivePhaseLabel,
} from "@/components/tutor/TrainingLiveDeliveryUi";

type EvidenceStatus = "observed" | "not_observed" | "confounded";
type InterventionEvent =
  | "none"
  | "neutral_clarification"
  | "first_step_confirmation"
  | "method_or_step_prompt"
  | "full_rescue_or_teaching"
  | "timer_changed";

type DiagnosisSupportEvent =
  | "none"
  | "neutral_clarification"
  | "first_step_confirmation"
  | "teaching";

type PodData = {
  assignment?: {
    id?: string | null;
    operationalMode?: string | null;
    operational_mode?: string | null;
  } | null;
  students?: Array<{
    id: string;
    name?: string | null;
    grade?: string | null;
  }>;
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
    layer: CapabilityId;
    state: string;
    validOpportunityCount: number;
    supportedCount: number;
    breakdownCount: number;
    recoveredAfterBreakdown: boolean;
    minimumValidOpportunities: number;
    prerequisiteSupported: boolean;
    authoritative: boolean;
  }>;
  breadthReady?: boolean;
  longitudinalReady?: boolean;
  exposure?: {
    distinctPhases: number;
    distinctSets: number;
    distinctRepPositions: number;
    completedSessions: number;
    stateChangeObserved: boolean;
    breakdownRecoveryObserved: boolean;
  };
  reason: string;
};

type SandboxField = {
  fieldKey: string;
  dimensionId: string;
  options: Array<{
    optionId: string;
    label: string;
    requiresPrerequisiteSentinel?: boolean;
  }>;
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
  sandboxStudent: {
    id: string;
    name: string;
    grade: string | null;
  };
  trajectoryId: string;
  sessionNumber: number;
  status:
    | "rep_ready"
    | "targeted_rediagnosis_required"
    | "rediagnosis_probe_ready"
    | "rediagnosis_blocked";
  prescribedPhase: string;
  prescribedStability: string;
  targetPhase?: string | null;
  rediagnosisRunId?: string;
  sequenceNumber?: number;
  turnFormId?: string;
  reason?: string;
  probe?: {
    probeId: string;
    label: string;
    primaryPhase: string;
    evidenceQuestion: string;
    specialistInstruction: string;
    constraints: Record<string, unknown>;
    studentBehavior: string;
    fields: Array<{
      dimensionId: string;
      label: string;
      observationQuestion: string;
      options: Array<{ behaviorId: string; label: string; detail: string }>;
    }>;
    supportOptions: Array<{
      id: DiagnosisSupportEvent;
      label: string;
      detail: string;
    }>;
  };
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
    setIndex: number;
    setCount: number;
    repCount: number;
    constraints: Record<string, unknown>;
    repNumber: number;
    studentBehavior: string;
    fields: SandboxField[];
    interventionOptions: InterventionOption[];
    prerequisiteSentinel: null | {
      targetPhase: string;
      evidenceQuestion: string;
      specialistInstruction: string;
      options: Array<{
        id: "held" | "contradicted" | "not_observed" | "confounded";
        label: string;
      }>;
    };
    inheritedRescueSignal: null | {
      evidenceQuestion: string;
      options: Array<{
        id: "none" | "isolated" | "repeated" | "not_observed" | "confounded";
        label: string;
        detail: string;
      }>;
    };
  };
  readiness: Readiness;
  studentStateAuthoritative: false;
  evidenceScope: "sandbox";
};

type RepResult = {
  studentId: string;
  eventId: string;
  completedAt: string;
  eventSequence: number;
  sessionNumber: number;
  phase: string;
  setId: string;
  repNumber: number;
  matchingObservations: number;
  totalObservations: number;
  observationExact: boolean;
  evidenceExact: boolean;
  conditionKept: boolean | null;
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

type DiagnosisResult = {
  turnId: string;
  completedAt: string;
  sequenceNumber: number;
  probeId: string;
  matchingObservations: number;
  totalObservations: number;
  observationExact: boolean;
  conditionConformed: boolean;
  authorityAligned: boolean;
  diagnosisComplete: boolean;
  blocked: boolean;
  specialistPlacement: null | { phase: string | null; stability: string | null };
  readiness: Readiness;
};

type HistoryData = {
  sandboxStudent: {
    id: string;
    name: string;
    grade: string | null;
  };
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
    matchingObservations: number;
    totalObservations: number;
    observationExact: boolean | null;
    evidenceExact: boolean | null;
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

export default function SpecialistSandboxSimulation({
  studentIdOverride,
  tutorAssignmentIdOverride,
  operationalModeOverride,
  embedded = false,
}: {
  studentIdOverride?: string;
  tutorAssignmentIdOverride?: string;
  operationalModeOverride?: string;
  embedded?: boolean;
} = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [interventionEvent, setInterventionEvent] = useState<InterventionEvent>("none");
  const [lastResult, setLastResult] = useState<RepResult | null>(null);
  const [diagnosisSelections, setDiagnosisSelections] = useState<Record<string, string>>({});
  const [diagnosisSupportEvent, setDiagnosisSupportEvent] =
    useState<DiagnosisSupportEvent>("none");
  const [lastDiagnosisResult, setLastDiagnosisResult] =
    useState<DiagnosisResult | null>(null);
  const [prerequisiteSentinel, setPrerequisiteSentinel] = useState<
    "held" | "contradicted" | "not_observed" | "confounded" | null
  >(null);
  const [inheritedRescueSignal, setInheritedRescueSignal] = useState<
    "none" | "isolated" | "repeated" | "not_observed" | "confounded" | null
  >(null);
  const [repStarted, setRepStarted] = useState(false);
  const [supportPickerOpen, setSupportPickerOpen] = useState(false);
  const [showEvidenceExceptions, setShowEvidenceExceptions] = useState(false);

  const requiresPodData = !(
    embedded &&
    studentIdOverride &&
    tutorAssignmentIdOverride &&
    operationalModeOverride
  );
  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
    enabled: requiresPodData,
  });

  const assignment = podQuery.data?.assignment;
  const tutorAssignmentId = String(
    tutorAssignmentIdOverride || assignment?.id || "",
  );
  const operationalMode = String(
    operationalModeOverride ||
      assignment?.operationalMode ||
      assignment?.operational_mode ||
      "",
  ).toLowerCase();
  const inSandbox = operationalMode === "sandbox";
  const sandboxStudents = (podQuery.data?.students || []).filter(
    (student) => Boolean(student?.id),
  );
  const requestedStudentId = String(
    studentIdOverride || searchParams.get("studentId") || "",
  ).trim();
  const selectedSandboxStudent = studentIdOverride
    ? sandboxStudents.find((student) => String(student.id) === requestedStudentId) || null
    : sandboxStudents.find((student) => String(student.id) === requestedStudentId) ||
      sandboxStudents[0] ||
      null;
  const studentId = String(
    studentIdOverride || selectedSandboxStudent?.id || "",
  );

  useEffect(() => {
    setSelections({});
    setInterventionEvent("none");
    setPrerequisiteSentinel(null);
    setInheritedRescueSignal(null);
    setDiagnosisSelections({});
    setDiagnosisSupportEvent("none");
    setLastResult(null);
    setLastDiagnosisResult(null);
    setRepStarted(false);
    setSupportPickerOpen(false);
    setShowEvidenceExceptions(false);
  }, [studentId]);

  const environmentQuery = useQuery<EnvironmentForm>({
    queryKey: ["sandbox-environment", tutorAssignmentId, studentId],
    enabled: Boolean(tutorAssignmentId && studentId && inSandbox),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-environment?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}&studentId=${encodeURIComponent(studentId)}`,
      );
      return response.json();
    },
  });

  const historyQuery = useQuery<HistoryData>({
    queryKey: ["sandbox-environment-history", tutorAssignmentId, studentId],
    enabled: Boolean(tutorAssignmentId && studentId && inSandbox),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/sandbox-environment/history?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}&studentId=${encodeURIComponent(studentId)}`,
      );
      return response.json();
    },
  });

  const form = environmentQuery.data;
  const rep = form?.status === "rep_ready" ? form.rep : undefined;

  useEffect(() => {
    setRepStarted(false);
    setSupportPickerOpen(false);
    setShowEvidenceExceptions(false);
  }, [form?.eventFormId, form?.turnFormId]);
  const diagnosisProbe =
    form?.status === "rediagnosis_probe_ready" ? form.probe : undefined;

  const completedObservationCount = useMemo(() => {
    if (!rep) return 0;
    return rep.fields.filter((field) => selections[field.fieldKey]?.optionId).length;
  }, [rep, selections]);

  const requiresPrerequisiteSentinel = Boolean(
    rep?.prerequisiteSentinel &&
      rep.fields.some((field) => {
        const selected = selections[field.fieldKey]?.optionId;
        if (!selected) return false;
        return field.options.some(
          (option) =>
            option.optionId === selected && option.requiresPrerequisiteSentinel,
        );
      }),
  );

  const requiresInheritedRescueSignal = Boolean(rep?.inheritedRescueSignal);

  const allComplete =
    Boolean(rep) &&
    completedObservationCount === (rep?.fields.length || 0) &&
    (rep?.fields.length || 0) > 0 &&
    (!requiresPrerequisiteSentinel || Boolean(prerequisiteSentinel)) &&
    (!requiresInheritedRescueSignal || Boolean(inheritedRescueSignal));

  const diagnosisObservationCount = useMemo(() => {
    if (!diagnosisProbe) return 0;
    return diagnosisProbe.fields.filter(
      (field) => diagnosisSelections[field.dimensionId],
    ).length;
  }, [diagnosisProbe, diagnosisSelections]);

  const diagnosisAllComplete =
    Boolean(diagnosisProbe) &&
    diagnosisObservationCount === (diagnosisProbe?.fields.length || 0) &&
    (diagnosisProbe?.fields.length || 0) > 0;

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

  const submitDiagnosisProbe = useMutation({
    mutationFn: async () => {
      if (
        !form ||
        form.status !== "rediagnosis_probe_ready" ||
        !diagnosisProbe ||
        !form.rediagnosisRunId ||
        !form.sequenceNumber ||
        !form.turnFormId ||
        !diagnosisAllComplete
      ) {
        throw new Error("Record every prescribed diagnosis observation before continuing.");
      }

      const response = await apiRequest(
        "POST",
        "/api/tutor/sandbox-environment/rediagnosis",
        {
          tutorAssignmentId,
          studentId,
          bankVersion: form.bankVersion,
          trajectoryId: form.trajectoryId,
          rediagnosisRunId: form.rediagnosisRunId,
          sequenceNumber: form.sequenceNumber,
          turnFormId: form.turnFormId,
          submission: {
            probeId: diagnosisProbe.probeId,
            supportEvent: diagnosisSupportEvent,
            observations: diagnosisProbe.fields.map((field) => ({
              dimensionId: field.dimensionId,
              behaviorId: diagnosisSelections[field.dimensionId],
            })),
          },
        },
      );
      return response.json() as Promise<DiagnosisResult>;
    },
    onSuccess: async (result) => {
      setLastDiagnosisResult(result);
      setDiagnosisSelections({});
      setDiagnosisSupportEvent("none");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment", tutorAssignmentId, studentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment-history", tutorAssignmentId, studentId],
        }),
      ]);
    },
  });

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
          studentId,
          bankVersion: form.bankVersion,
          trajectoryId: form.trajectoryId,
          eventSequence: form.eventSequence,
          eventFormId: form.eventFormId,
          submission: {
            interventionEvent,
            ...(requiresPrerequisiteSentinel && prerequisiteSentinel
              ? { prerequisiteSentinel }
              : {}),
            ...(requiresInheritedRescueSignal && inheritedRescueSignal
              ? { inheritedRescueSignal }
              : {}),
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
      setPrerequisiteSentinel(null);
      setInheritedRescueSignal(null);
      setRepStarted(false);
      setSupportPickerOpen(false);
      setShowEvidenceExceptions(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment", tutorAssignmentId, studentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sandbox-environment-history", tutorAssignmentId, studentId],
        }),
      ]);
    },
  });

  if (requiresPodData && podQuery.isLoading) {
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

  if (inSandbox && !studentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No synthetic Sandbox student is assigned to this Specialist yet.
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
  const routeTopic = String(searchParams.get("topic") || "").trim() || "Sandbox practice";
  const prescribedPhase = (
    ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"].includes(
      form.prescribedPhase,
    )
      ? form.prescribedPhase
      : "Clarity"
  ) as LivePhaseLabel;

  if (embedded) {
    const fallbackRules = rep
      ? Object.entries(rep.constraints).map(
          ([key, value]) => `${humanize(key)}: ${humanize(String(value))}`,
        )
      : [];
    const activeRules = rep
      ? liveTrainingActiveRules(
          form.prescribedPhase,
          rep.setName,
          fallbackRules,
        )
      : [];
    const liveStage =
      rep && !repStarted
        ? "ready"
        : form.status === "rep_ready" && allComplete
          ? "confirm"
          : form.status === "rediagnosis_probe_ready" && diagnosisAllComplete
            ? "confirm"
            : "observe";

    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">
              {form.status === "rediagnosis_probe_ready"
                ? `Targeted Re-Diagnosis - ${form.targetPhase || form.prescribedPhase}`
                : `Training Drill - ${form.prescribedPhase}`}
            </h2>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Diagnostic Topic:</span> {routeTopic}
            </p>
            <p className="mt-4 text-muted-foreground">{form.sandboxStudent.name}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Sandbox session {form.sessionNumber}</p>
            {form.sessionProgress && (
              <p>
                {form.sessionProgress.completedReps}/{form.sessionProgress.totalReps} reps complete
              </p>
            )}
          </div>
        </div>

        {(form.status !== "rep_ready" ||
          !rep ||
          (rep.setIndex === 1 && rep.repNumber === 1)) && (
          <LivePhaseContext
            phase={
              form.status === "rediagnosis_probe_ready" &&
              form.targetPhase &&
              ["Clarity", "Structured Execution", "Controlled Discomfort", "Time Pressure Stability"].includes(form.targetPhase)
                ? (form.targetPhase as LivePhaseLabel)
                : prescribedPhase
            }
          />
        )}

        {!(rep && !repStarted) && (
          <LiveRepStage stage={liveStage} sandbox />
        )}

        {form.status === "rediagnosis_probe_ready" && diagnosisProbe ? (
          <>
            <div className="mb-4 rounded-xl border border-primary/15 bg-background p-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Targeted re-diagnosis · {diagnosisProbe.label}
              </div>
              <div className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                EVIDENCE PROBE
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {diagnosisProbe.evidenceQuestion}
              </p>
              <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2">
                <div className="mb-0.5 text-xs font-semibold text-primary">DO THIS NOW</div>
                <div className="text-xs font-medium text-foreground sm:text-sm">
                  {diagnosisProbe.specialistInstruction}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(diagnosisProbe.constraints).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded border border-primary/15 bg-background px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {humanize(key)}: {humanize(String(value))}
                  </span>
                ))}
              </div>
            </div>

            <LiveSandboxStudentResponse>
              {diagnosisProbe.studentBehavior}
            </LiveSandboxStudentResponse>

            <LiveSupportPanel
              options={diagnosisProbe.supportOptions}
              selectedId={diagnosisSupportEvent}
              open={supportPickerOpen}
              onToggle={() => setSupportPickerOpen((open) => !open)}
              onSelect={(id) =>
                setDiagnosisSupportEvent(id as DiagnosisSupportEvent)
              }
              showEvidenceExceptions={false}
              onToggleEvidenceExceptions={() => {}}
              evidenceExceptionsEnabled={false}
            />

            <div className="space-y-4">
              {diagnosisProbe.fields.map((field) => (
                <LiveObservationField
                  key={field.dimensionId}
                  question={field.observationQuestion}
                  label={field.label}
                  options={field.options.map((option) => ({
                    id: option.behaviorId,
                    label: option.label,
                  }))}
                  selected={diagnosisSelections[field.dimensionId] || null}
                  optionDetails={Object.fromEntries(
                    field.options.map((option) => [
                      option.behaviorId,
                      option.detail,
                    ]),
                  )}
                  onSelect={(behaviorId) =>
                    setDiagnosisSelections((current) => ({
                      ...current,
                      [field.dimensionId]: behaviorId,
                    }))
                  }
                  showEvidenceExceptions={false}
                  evidenceStatus="observed"
                  onEvidenceStatus={() => {}}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                disabled={!diagnosisAllComplete || submitDiagnosisProbe.isPending}
                onClick={() => submitDiagnosisProbe.mutate()}
              >
                {submitDiagnosisProbe.isPending
                  ? "Recording evidence..."
                  : "Verify Phase"}
              </Button>
            </div>

            {submitDiagnosisProbe.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {submitDiagnosisProbe.error instanceof Error
                    ? submitDiagnosisProbe.error.message
                    : "Targeted re-diagnosis submission failed."}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : form.status === "rediagnosis_blocked" ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {form.reason ||
                "The permitted clean diagnosis probes did not resolve the simulated prerequisite. Training remains paused rather than guessing a placement."}
            </AlertDescription>
          </Alert>
        ) : form.status === "targeted_rediagnosis_required" ? (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Earlier prerequisite truth became untrustworthy. The trajectory is preserved and
              ordinary Training is paused while the next targeted re-diagnosis probe is prepared.
            </AlertDescription>
          </Alert>
        ) : rep ? (
          <>


            {!repStarted ? (
              <div className="mb-5 rounded-2xl border border-primary/20 bg-background p-5 shadow-sm">
                <LiveRepStage stage="ready" sandbox />
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Set {rep.setIndex} of {rep.setCount} · {rep.setName}
                </div>
                <div className="mt-1 flex items-end gap-3">
                  <div className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    REP {rep.repNumber}
                  </div>
                  <div className="pb-1 text-sm font-semibold text-muted-foreground">
                    of {rep.repCount}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {rep.setPurpose}
                </p>
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {instructionPromptLabelFor(
                      liveTrainingInstruction(form.prescribedPhase, rep.setName),
                    )}
                  </div>
                  <div className="mt-1 text-base font-semibold text-foreground">
                    {instructionPromptDisplayText(
                      liveTrainingInstruction(form.prescribedPhase, rep.setName),
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeRules.map((rule) => (
                    <span
                      key={rule}
                      className="rounded-full border border-primary/15 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {rule}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Use the problem prepared for this opportunity. Once the rep starts, keep
                  attention on the student's response rather than on form administration.
                </p>
                <div className="mt-5 flex justify-end">
                  <Button onClick={() => setRepStarted(true)}>
                    Begin Rep {rep.repNumber}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <LiveRepContextCard
              setIndex={rep.setIndex}
              setCount={rep.setCount}
              setName={rep.setName}
              repNumber={rep.repNumber}
              repCount={rep.repCount}
              purpose={rep.setPurpose}
              instruction={liveTrainingInstruction(
                form.prescribedPhase,
                rep.setName,
              )}
              activeRules={activeRules}
            />
                <LiveSandboxStudentResponse>
                  {rep.studentBehavior}
                </LiveSandboxStudentResponse>

                <LiveSupportPanel
                  options={rep.interventionOptions}
                  selectedId={interventionEvent}
                  open={supportPickerOpen}
                  onToggle={() => setSupportPickerOpen((open) => !open)}
                  onSelect={(id) => {
                    setInterventionEvent(id as InterventionEvent);
                    setSupportPickerOpen(false);
                  }}
                  showEvidenceExceptions={showEvidenceExceptions}
                  onToggleEvidenceExceptions={() =>
                    setShowEvidenceExceptions((open) => !open)
                  }
                />

                <div className="space-y-4">
                  {rep.fields.map((field) => {
                    const selection = selections[field.fieldKey];
                    return (
                      <LiveObservationField
                        key={field.fieldKey}
                        question={liveObservationQuestion(
                          field.dimensionId,
                          humanize(field.dimensionId),
                        )}
                        label={humanize(field.dimensionId)}
                        options={field.options.map((option) => ({
                          id: option.optionId,
                          label: option.label,
                        }))}
                        selected={selection?.optionId || null}
                        onSelect={(optionId) =>
                          chooseOption(field.fieldKey, optionId)
                        }
                        showEvidenceExceptions={showEvidenceExceptions}
                        evidenceStatus={selection?.evidenceStatus || "observed"}
                        onEvidenceStatus={(status) =>
                          chooseStatus(field.fieldKey, status)
                        }
                      />
                    );
                  })}
                </div>

                {requiresPrerequisiteSentinel && rep.prerequisiteSentinel && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      Prerequisite sentinel required
                    </div>
                    <p className="mt-2 text-sm font-semibold text-amber-950">
                      {rep.prerequisiteSentinel.evidenceQuestion}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                      {rep.prerequisiteSentinel.specialistInstruction}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {rep.prerequisiteSentinel.options.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          variant={
                            prerequisiteSentinel === option.id
                              ? "default"
                              : "outline"
                          }
                          className="h-auto justify-start whitespace-normal py-3 text-left"
                          onClick={() => setPrerequisiteSentinel(option.id)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {rep.inheritedRescueSignal && (
                  <div className="rounded-xl border border-primary/15 bg-background p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Inherited rescue signal
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {rep.inheritedRescueSignal.evidenceQuestion}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {rep.inheritedRescueSignal.options.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          variant={
                            inheritedRescueSignal === option.id
                              ? "default"
                              : "outline"
                          }
                          className="h-auto justify-start whitespace-normal py-3 text-left"
                          onClick={() => setInheritedRescueSignal(option.id)}
                        >
                          <span>
                            <span className="block font-medium">{option.label}</span>
                            <span className="mt-1 block text-xs opacity-80">
                              {option.detail}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    disabled={!allComplete || submitRep.isPending}
                    onClick={() => submitRep.mutate()}
                  >
                    {submitRep.isPending
                      ? "Recording rep evidence..."
                      : rep.repNumber === rep.repCount
                        ? "Confirm Set"
                        : "Confirm Rep"}
                  </Button>
                </div>

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
            )}
          </>
        ) : null}

        <details className="rounded-xl border border-primary/15 bg-background">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
            Sandbox evidence & trajectory
          </summary>
          <div className="space-y-4 border-t border-primary/10 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Capability evidence
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {readiness.earliestUnsupportedCapability
                  ? `Current evidence focus: ${CAPABILITY_LABELS[readiness.earliestUnsupportedCapability]}`
                  : "All currently evaluated capability layers are supported."}
              </p>
              {readiness.policyAvailable && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {readiness.layers.map((layer) => (
                    <div key={layer.layer} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        {CAPABILITY_LABELS[layer.layer]}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {humanize(layer.state)} · {layer.validOpportunityCount}/
                        {layer.minimumValidOpportunities} valid opportunities
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trajectory record
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {historyQuery.data?.trajectory.completedRepCount || 0} Sandbox reps recorded on
                this persistent trajectory.
              </p>
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!embedded ? (
            <Button variant="ghost" onClick={() => navigate("/specialist/pod")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
            </Button>
          ) : (
            <div />
          )}
          <div className="text-right text-xs text-muted-foreground">
            <p>Sandbox session {form.sessionNumber}</p>
            {form.sessionProgress && (
              <p>
                {form.sessionProgress.completedReps}/{form.sessionProgress.totalReps} reps complete
              </p>
            )}
          </div>
        </div>

        {!embedded && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Sandbox student</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each synthetic student keeps an independent RI trajectory, session history, breakdown/recovery history, and hidden simulated state.
                </p>
              </div>
              <Badge variant="secondary">
                {form.sandboxStudent.name}{form.sandboxStudent.grade ? ` · Grade ${form.sandboxStudent.grade}` : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sandboxStudents.map((student) => {
                const active = String(student.id) === studentId;
                return (
                  <Button
                    key={student.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      navigate(
                        `/operational/specialist/sandbox?studentId=${encodeURIComponent(String(student.id))}`,
                      )
                    }
                  >
                    {student.name || "Sandbox Student"}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        )}

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
                    <div key={layer.layer} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        {CAPABILITY_LABELS[layer.layer]}
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
              Rep {lastResult.repNumber} recorded: {lastResult.matchingObservations}/
              {lastResult.totalObservations} observations aligned
              {lastResult.conditionKept === null
                ? ""
                : lastResult.conditionKept
                  ? " · condition preserved"
                  : " · condition changed"}
              {lastResult.sessionCompleted
                ? lastResult.sessionAuthority?.stateTrackAligned
                  ? " · session state remained aligned"
                  : " · session state diverged"
                : ""}.
            </AlertDescription>
          </Alert>
        )}

        {lastDiagnosisResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Targeted diagnosis evidence recorded: {lastDiagnosisResult.matchingObservations}/
              {lastDiagnosisResult.totalObservations} observations aligned
              {lastDiagnosisResult.conditionConformed
                ? " · probe condition preserved"
                : " · probe condition contaminated"}
              {lastDiagnosisResult.diagnosisComplete
                ? lastDiagnosisResult.authorityAligned
                  ? " · RI placement truth restored"
                  : " · RI placement diverged"
                : ""}.
            </AlertDescription>
          </Alert>
        )}

        {form.status === "rediagnosis_probe_ready" && diagnosisProbe ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Targeted re-diagnosis · {diagnosisProbe.label}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {diagnosisProbe.evidenceQuestion}
                    </p>
                  </div>
                  <Badge variant="outline">{form.targetPhase}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    Ordinary Training is paused because earlier prerequisite truth became
                    untrustworthy. Run only the prescribed probe. Evidence decides where the
                    simulated student belongs; do not move them backward manually.
                  </AlertDescription>
                </Alert>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    DO THIS NOW
                  </p>
                  <p className="mt-2 text-sm">{diagnosisProbe.specialistInstruction}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {Object.entries(diagnosisProbe.constraints)
                      .map(([key, value]) => `${humanize(key)}: ${humanize(String(value))}`)
                      .join(" · ")}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Simulated student behaviour
                  </p>
                  <p className="mt-2 leading-relaxed">
                    {diagnosisProbe.studentBehavior}
                  </p>
                </div>

                <div>
                  <p className="font-medium">What support actually occurred?</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {diagnosisProbe.supportOptions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant={diagnosisSupportEvent === option.id ? "default" : "outline"}
                        className="h-auto justify-start whitespace-normal py-3 text-left"
                        onClick={() => setDiagnosisSupportEvent(option.id)}
                      >
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="mt-1 block text-xs opacity-80">{option.detail}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5">
                  {diagnosisProbe.fields.map((field) => (
                    <div key={field.dimensionId} className="rounded-xl border p-4">
                      <p className="font-medium">{field.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {field.observationQuestion}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {field.options.map((option) => (
                          <Button
                            key={option.behaviorId}
                            type="button"
                            variant={
                              diagnosisSelections[field.dimensionId] === option.behaviorId
                                ? "default"
                                : "outline"
                            }
                            className="h-auto justify-start whitespace-normal py-3 text-left"
                            onClick={() =>
                              setDiagnosisSelections((current) => ({
                                ...current,
                                [field.dimensionId]: option.behaviorId,
                              }))
                            }
                          >
                            <span>
                              <span className="block">{option.label}</span>
                              <span className="mt-1 block text-xs opacity-80">{option.detail}</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              disabled={!diagnosisAllComplete || submitDiagnosisProbe.isPending}
              onClick={() => submitDiagnosisProbe.mutate()}
            >
              {submitDiagnosisProbe.isPending
                ? "Recording targeted diagnosis evidence..."
                : "Record probe and continue"}
            </Button>

            {submitDiagnosisProbe.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {submitDiagnosisProbe.error instanceof Error
                    ? submitDiagnosisProbe.error.message
                    : "Targeted re-diagnosis submission failed."}
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : form.status === "rediagnosis_blocked" ? (
          <Card>
            <CardHeader>
              <CardTitle>Targeted re-diagnosis requires evidence review</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {form.reason ||
                    "The permitted clean diagnosis probes did not resolve the simulated prerequisite. Training remains paused rather than guessing a placement."}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : form.status === "targeted_rediagnosis_required" ? (
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

            {requiresPrerequisiteSentinel && rep.prerequisiteSentinel && (
              <Card>
                <CardHeader>
                  <CardTitle>Earlier-layer verification</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rep.prerequisiteSentinel.evidenceQuestion}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      DO THIS NOW
                    </p>
                    <p className="mt-2 text-sm">
                      {rep.prerequisiteSentinel.specialistInstruction}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {rep.prerequisiteSentinel.options.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant={prerequisiteSentinel === option.id ? "default" : "outline"}
                        className="h-auto justify-start whitespace-normal py-3 text-left"
                        onClick={() => setPrerequisiteSentinel(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {rep.inheritedRescueSignal && (
              <Card>
                <CardHeader>
                  <CardTitle>Rescue-seeking evidence</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rep.inheritedRescueSignal.evidenceQuestion}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {rep.inheritedRescueSignal.options.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={inheritedRescueSignal === option.id ? "default" : "outline"}
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => setInheritedRescueSignal(option.id)}
                    >
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="mt-1 block text-xs opacity-80">{option.detail}</span>
                      </span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

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
