import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { SandboxReadinessAssessmentCard } from "@/components/sandbox/SandboxReadinessAssessmentCard";
import { TdPracticalsCompletion } from "@/components/sandbox/TdPracticalsCompletion";

type CapabilityAssessment = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  status: "unavailable" | "locked" | "available" | "complete";
  stage:
    | "transformation_mastery"
    | "transformation_retrieval"
    | "transformation_transfer"
    | "execution_standards_mastery"
    | "system_intelligence_mastery"
    | "session_infrastructure_mastery"
    | "operating_system_retrieval"
    | "operating_system_transfer";
  bankVersion: number | null;
  attemptCount: number;
  maxAttempts: number | null;
  latestAttempt?: {
    bankVersion: number;
    attemptNumber: number;
    totalQuestions: number;
    correctQuestions: number;
    percent: number;
    hasCriticalFail: boolean;
    passed: boolean;
    completedAt: string | null;
    attemptId?: string;
  } | null;
};

type CapabilityInspectionAttempt = {
  attemptId: string;
  attemptNumber: number;
  bankVersion: number;
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  hasCriticalFail: boolean;
  passed: boolean;
  completedAt: string | null;
  experienceRating: number | null;
  experienceFeedback: string | null;
  experienceFeedbackSubmittedAt: string | null;
  questions: Array<{
    questionKey: string;
    prompt: string;
    questionKind: string;
    selectedOptions: string[];
    correctOptions: string[];
    correct: boolean;
    criticalFail: boolean;
    explanation: string;
    feedback: string;
  }>;
};

type DevelopmentRecord = {
  specialist: {
    id: string;
    name: string;
    email: string;
  };
  assignment: {
    id: string;
    podId: string;
    podName: string;
    operationalMode: string;
    certificationStatus: string;
    createdAt: string | null;
  };
  currentStage:
    | "application"
    | "training"
    | "sandbox"
    | "practicals"
    | "trial"
    | "certification"
    | "certified_live";
  pathway: {
    status: string;
    startedAt: string;
    standardEndsAt: string;
    maximumEndsAt: string;
    extensionApprovedAt: string | null;
    extensionReason: string | null;
    completedAt: string | null;
    timeline: {
      state: string;
      elapsedDays: number;
      daysRemaining: number;
      effectiveEndsAt: string;
      extensionApproved: boolean;
      canContinue: boolean;
    };
  } | null;
  application: {
    id: string;
    status: string;
    reviewedAt: string | null;
    onboardingCompletedAt: string | null;
    documentsComplete: boolean;
    createdAt: string | null;
  } | null;
  training: {
    sandboxReady: boolean;
    assessments: CapabilityAssessment[];
    summary: {
      transformation: { complete: number; total: number };
      cumulative: { complete: number; total: number };
      executionStandards: { complete: number; total: number };
      systemIntelligence: { complete: number; total: number };
      sessionInfrastructure: { complete: number; total: number };
      operatingSystem: { complete: number; total: number };
    };
  };
  sandbox: {
    readiness: {
      policyAvailable: boolean;
      evidenceReady: boolean;
      practicalsReady: boolean;
      earliestUnsupportedCapability: string | null;
      breadthReady: boolean;
      longitudinalReady: boolean;
      reason: string;
      layers: Array<{
        layer: string;
        state: string;
        validOpportunityCount: number;
        minimumValidOpportunities: number;
      }>;
      exposure?: {
        distinctPhases: number;
        distinctSets: number;
        distinctRepPositions: number;
        completedSessions: number;
        stateChangeObserved: boolean;
        breakdownRecoveryObserved: boolean;
      };
    };
    latestAssessment: {
      decision: "passed" | "remediation_required";
      evidenceNote: string;
      assessedAt: string;
      assessedByUserId: string;
    } | null;
  };
  trial: {
    status: string;
    riskState: string;
    startedAt: string;
    familyPlacementCount: number;
    gate: {
      reviewable: boolean;
      blockers: string[];
    };
    placements: Array<{
      id: string;
      familyName: string;
      studentName: string;
      feedbackState: string;
      progress: {
        requiredSessionCount: number;
        qualifyingSessionCount: number;
        reportsComplete: boolean;
        evidenceComplete: boolean;
      };
      review: {
        decision: string;
        outcomeClassification: string;
        evidenceNote: string;
        reviewedAt: string;
      } | null;
    }>;
    certificationDecision: {
      decision: string;
      rationale: string;
      decidedAt: string;
    } | null;
  } | null;
  certification: {
    mode: string;
    updatedAt: string | null;
    lastSyncedAt: string | null;
  } | null;
};

const PATHWAY = [
  ["application", "Application"],
  ["training", "Training"],
  ["sandbox", "Sandbox"],
  ["practicals", "Practicals"],
  ["trial", "Trial"],
  ["certification", "Certification"],
  ["certified_live", "Certified Live"],
] as const;

function humanize(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stageIndex(stage: DevelopmentRecord["currentStage"]) {
  return PATHWAY.findIndex(([key]) => key === stage);
}

function progressValue(complete: number, total: number) {
  if (!total) return 0;
  return Math.round((complete / total) * 100);
}

function AssessmentSection({
  title,
  detail,
  assessments,
  collapsible = false,
  defaultOpen = true,
  onInspect,
}: {
  title: string;
  detail: string;
  assessments: CapabilityAssessment[];
  collapsible?: boolean;
  defaultOpen?: boolean;
  onInspect: (assessmentKey: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const complete = assessments.filter((entry) => entry.status === "complete").length;
  return (
    <Card className="rounded-none">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {collapsible ? (
              <button
                type="button"
                className="text-left"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                <CardTitle className="text-lg">{title}</CardTitle>
              </button>
            ) : <CardTitle className="text-lg">{title}</CardTitle>}
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{complete}/{assessments.length} complete</Badge>
            {collapsible ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
                {open ? "Hide" : "Show"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {(!collapsible || open) && <CardContent className="space-y-2">
        {assessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active assessments.</p>
        ) : (
          assessments.map((assessment) => (
            <div
              key={assessment.assessmentKey}
              className="grid gap-2 border border-border/70 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-sm font-medium">{assessment.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {assessment.latestAttempt
                    ? `Latest evidence: ${assessment.latestAttempt.correctQuestions}/${assessment.latestAttempt.totalQuestions} · ${assessment.latestAttempt.percent}% · attempt ${assessment.latestAttempt.attemptNumber}`
                    : "No completed attempt recorded on the current pathway."}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant={
                    assessment.status === "complete"
                      ? "default"
                      : assessment.status === "available"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {assessment.status === "complete"
                    ? "Evidenced"
                    : assessment.status === "available"
                      ? "Ready"
                      : assessment.status === "unavailable"
                        ? "Unavailable"
                        : "Locked"}
                </Badge>
                {assessment.status === "complete" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onInspect(assessment.assessmentKey)}>
                    Inspect
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>}
    </Card>
  );
}

export default function SpecialistDevelopmentRecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { podId, tutorId } = useParams<{ podId: string; tutorId: string }>();
  const isCooView =
    location.pathname.startsWith("/executive/coo/") ||
    location.pathname.startsWith("/coo/");
  const isLegacyCooView = location.pathname.startsWith("/coo/");
  const recordApiBase = isCooView ? "/api/coo" : "/api/td";
  const backToPodPath = isCooView
    ? podId
      ? `${isLegacyCooView ? "/coo/pods" : "/executive/coo/pods"}/${podId}`
      : isLegacyCooView
        ? "/coo/pods"
        : "/executive/coo/pods"
    : podId
      ? `/operational/td/my-pods/${podId}`
      : "/operational/td/my-pods";

  const recordQuery = useQuery<DevelopmentRecord>({
    queryKey: [recordApiBase, "tutors", tutorId, "development-record"],
    enabled: Boolean(tutorId),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${recordApiBase}/tutors/${encodeURIComponent(String(tutorId || ""))}/development-record`,
      );
      return response.json();
    },
  });

  if (recordQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-6xl text-sm text-muted-foreground">
          Loading Specialist development record...
        </div>
      </div>
    );
  }

  if (recordQuery.error || !recordQuery.data) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => navigate(backToPodPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>
          <Card className="rounded-none">
            <CardContent className="p-6">
              <p className="font-medium">Development record could not be loaded.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No Specialist development data has been changed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const record = recordQuery.data;
  const currentIndex = stageIndex(record.currentStage);
  const assessments = record.training.assessments;
  const [inspectionKey, setInspectionKey] = useState<string | null>(null);
  const inspectionQuery = useQuery<{ attempts: CapabilityInspectionAttempt[] }>({
    queryKey: [recordApiBase, "tutors", tutorId, "capability-assessment", inspectionKey, "attempts"],
    enabled: Boolean(tutorId && inspectionKey),
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        recordApiBase + "/tutors/" + encodeURIComponent(String(tutorId || "")) + "/capability-assessments/" + encodeURIComponent(String(inspectionKey || "")) + "/attempts",
      );
      return response.json();
    },
  });
  const transformation = assessments.filter(
    (entry) => entry.stage === "transformation_mastery",
  );
  const cumulative = assessments.filter(
    (entry) =>
      entry.stage === "transformation_retrieval" ||
      entry.stage === "transformation_transfer",
  );
  const executionStandards = assessments.filter(
    (entry) => entry.stage === "execution_standards_mastery",
  );
  const systemIntelligence = assessments.filter(
    (entry) => entry.stage === "system_intelligence_mastery",
  );
  const sessionInfrastructure = assessments.filter(
    (entry) => entry.stage === "session_infrastructure_mastery",
  );
  const operatingSystem = assessments.filter(
    (entry) =>
      entry.stage === "operating_system_retrieval" ||
      entry.stage === "operating_system_transfer",
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Button
            variant="ghost"
            className="-ml-3 mb-3"
            onClick={() => navigate(backToPodPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pod
          </Button>

          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Specialist Development
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {record.specialist.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {record.assignment.podName} · {record.specialist.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{humanize(record.currentStage)}</Badge>
              <Badge variant="outline">
                Permission: {humanize(record.assignment.operationalMode)}
              </Badge>
            </div>
          </div>
        </div>

        <Card className="rounded-none">
          <CardContent className="p-5">
            <div className="grid gap-3 md:grid-cols-7">
              {PATHWAY.map(([key, label], index) => {
                const complete = index < currentIndex;
                const current = index === currentIndex;
                return (
                  <div key={key} className="border border-border/70 p-3">
                    <div className="flex items-center gap-2">
                      {complete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : current ? (
                        <Clock3 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {complete ? "Completed" : current ? "Current stage" : "Upcoming"}
                    </p>
                  </div>
                );
              })}
            </div>

            {record.pathway ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Development window</p>
                  <p className="mt-1 text-sm font-medium">
                    Day {record.pathway.timeline.elapsedDays}
                  </p>
                </div>
                <div className="border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Days remaining</p>
                  <p className="mt-1 text-sm font-medium">
                    {record.pathway.timeline.daysRemaining}
                  </p>
                </div>
                <div className="border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Current deadline</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(record.pathway.timeline.effectiveEndsAt)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-none">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Application
              </p>
              <p className="mt-2 text-xl font-semibold">
                {record.application ? humanize(record.application.status) : "No record"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Documents:{" "}
                {record.application?.documentsComplete ? "Complete" : "Incomplete"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reviewed: {formatDate(record.application?.reviewedAt)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Training to Sandbox gate
              </p>
              <p className="mt-2 text-xl font-semibold">
                {record.training.sandboxReady ? "Satisfied" : "Still developing"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Five Transformation Masteries, Retention and Application govern Sandbox entry.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Certification state
              </p>
              <p className="mt-2 text-xl font-semibold">
                {record.certification?.mode
                  ? humanize(record.certification.mode)
                  : humanize(record.assignment.certificationStatus)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Last synced: {formatDate(record.certification?.lastSyncedAt)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Training Evaluation
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Capability evidence
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              This is the Specialist's Training evidence record, not just course completion.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-6">
            {[
              ["Transformation", record.training.summary.transformation],
              ["Transformation Retention + Application", record.training.summary.cumulative],
              ["Execution Standards", record.training.summary.executionStandards],
              ["System Intelligence", record.training.summary.systemIntelligence],
              ["Session Infrastructure", record.training.summary.sessionInfrastructure],
              ["Operating System", record.training.summary.operatingSystem],
            ].map(([label, raw]) => {
              const summary = raw as { complete: number; total: number };
              return (
                <Card key={String(label)} className="rounded-none">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{String(label)}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {summary.complete}/{summary.total}
                    </p>
                    <Progress
                      value={progressValue(summary.complete, summary.total)}
                      className="mt-3 h-2"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <AssessmentSection
            title="Transformation Mastery"
            detail="Five Deep Dive Masteries establish the immediate Transformation operating standard."
            assessments={transformation}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
          <AssessmentSection
            title="Retention + Application"
            detail="Delayed Retention tests retrieval after spacing. Application tests the correct RI response across mixed situations."
            assessments={cumulative}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
          <AssessmentSection
            title="Execution Standards"
            detail="Delivery boundaries, intervention, controlled difficulty and Specialist execution discipline."
            assessments={executionStandards}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
          <AssessmentSection
            title="System Intelligence"
            detail="Diagnosis, prompt interpretation, baselines and uncertainty resolution."
            assessments={systemIntelligence}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
          <AssessmentSection
            title="Session Infrastructure"
            detail="The session system, logging, drill authority, Handover and tools."
            assessments={sessionInfrastructure}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
          <AssessmentSection
            title="Operating System Retention + Application"
            detail="Final cumulative evidence across Execution Standards, System Intelligence and Session Infrastructure after spacing and mixed-situation application."
            assessments={operatingSystem}
            collapsible
            defaultOpen={false}
            onInspect={setInspectionKey}
          />
        </section>

        <Dialog open={Boolean(inspectionKey)} onOpenChange={(open) => { if (!open) setInspectionKey(null); }}>
          <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Capability evidence inspection</DialogTitle>
              <DialogDescription>Read-only view of persisted questions, responses, outcomes, and Specialist feedback.</DialogDescription>
            </DialogHeader>
            {inspectionQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading persisted attempt evidence...</p> : inspectionQuery.error ? <p className="text-sm text-destructive">This evidence could not be loaded.</p> : (
              <div className="space-y-5">
                {(inspectionQuery.data?.attempts || []).map((attempt) => (
                  <section key={attempt.attemptId} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="font-semibold">Attempt {attempt.attemptNumber}</p><p className="text-xs text-muted-foreground">{attempt.correctQuestions}/{attempt.totalQuestions} correct · {attempt.percent}% · {attempt.passed ? "Passed" : "Did not pass"} · {formatDate(attempt.completedAt)}</p></div>
                      <Badge variant={attempt.passed ? "default" : "outline"}>{attempt.hasCriticalFail ? "Critical boundary reached" : "Recorded"}</Badge>
                    </div>
                    {attempt.experienceFeedback || attempt.experienceRating != null ? <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-3 text-sm"><p className="font-medium">Specialist feedback</p><p className="mt-1">{attempt.experienceFeedback || "No written feedback submitted."}</p>{attempt.experienceRating != null ? <p className="mt-1 text-xs text-muted-foreground">Rating: {attempt.experienceRating}/5</p> : null}</div> : null}
                    <div className="space-y-3">
                      {attempt.questions.map((question, index) => (
                        <div key={question.questionKey} className="rounded-md border bg-muted/10 p-3">
                          <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">Question {index + 1}</p><Badge variant={question.correct ? "default" : "destructive"}>{question.correct ? "Correct" : question.criticalFail ? "Critical fail" : "Incorrect"}</Badge></div>
                          <p className="mt-2 text-sm">{question.prompt || question.questionKey}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Specialist response</p><p className="mt-1 text-sm">{question.selectedOptions.join(", ") || "No recorded selection"}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected response</p><p className="mt-1 text-sm">{question.correctOptions.join(", ") || "Not available"}</p></div></div>
                          {question.feedback || question.explanation ? <p className="mt-3 text-xs text-muted-foreground">{question.feedback || question.explanation}</p> : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                {!inspectionQuery.data?.attempts?.length ? <p className="text-sm text-muted-foreground">No persisted attempts were found.</p> : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
        {!isCooView && record.assignment.operationalMode === "sandbox" ? (
          <section className="space-y-4">
            <SandboxReadinessAssessmentCard
              tutorId={record.specialist.id}
              tutorName={record.specialist.name}
              operationalMode={record.assignment.operationalMode}
            />
          </section>
        ) : null}

        <section className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Practicals, Trial and Certification
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Later-stage evidence
            </h2>
          </div>

          {!isCooView ? <TdPracticalsCompletion tutorId={record.specialist.id} /> : null}

          <Card className="rounded-none">
            <CardContent className="p-5">
              {!record.trial ? (
                <p className="text-sm text-muted-foreground">
                  No Trial case has been opened for this Specialist yet.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Trial {humanize(record.trial.status)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Started {formatDate(record.trial.startedAt)}
                      </p>
                    </div>
                    <Badge
                      variant={record.trial.gate.reviewable ? "default" : "outline"}
                    >
                      {record.trial.gate.reviewable
                        ? "Certification reviewable"
                        : "Evidence still building"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {record.trial.placements.map((placement) => (
                      <div
                        key={placement.id}
                        className="border border-border/70 p-4"
                      >
                        <p className="font-medium">{placement.studentName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {placement.familyName}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Qualifying sessions
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {placement.progress.qualifyingSessionCount}/
                              {placement.progress.requiredSessionCount}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Outcome review
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {placement.review
                                ? humanize(placement.review.decision)
                                : "Pending"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {record.trial.gate.blockers?.length ? (
                    <div className="border border-border/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Certification blockers
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {record.trial.gate.blockers.map((blocker) => (
                          <p key={blocker}>{blocker}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {record.trial.certificationDecision ? (
                    <div className="border border-border/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Certification decision
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {humanize(record.trial.certificationDecision.decision)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {record.trial.certificationDecision.rationale}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(record.trial.certificationDecision.decidedAt)}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
