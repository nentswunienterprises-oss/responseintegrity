import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, FileSearch, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AssessmentAttempt = {
  evidenceId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  evidenceKind: string;
  coveredDeepDiveKeys: string[];
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  hasCriticalFail: boolean;
  passed: boolean;
  completedAt: string;
};

type AssessmentDossierEntry = {
  assessmentKey: string;
  title: string;
  evidenceKind: string;
  coveredDeepDiveKeys: string[];
  activeBankVersion: number | null;
  latestCurrentAttempt: AssessmentAttempt | null;
  staleAttemptCount: number;
  status: "bank_unavailable" | "not_attempted_current_bank" | "passed" | "failed";
};

type PracticalAttempt = {
  evidenceId: string;
  proofKey: string;
  proofVersion: number;
  rubricVersion: number | null;
  attemptNumber: number;
  outcome: string;
  reasonCode: string | null;
  feedback: string | null;
  counts: { clear: number; partial: number; fail: number; criticalFail: number } | null;
  submittedAt: string;
  reviewedAt: string | null;
};

type PracticalDossierEntry = {
  proofKey: string;
  title: string;
  currentProofVersion: number;
  latestCurrentAttempt: PracticalAttempt | null;
  staleAttemptCount: number;
  status: string;
};

type OralAttempt = {
  evidenceId: string;
  defenseVersion: number;
  attemptNumber: number;
  outcome: string;
  counts: { clear: number; partial: number; fail: number; criticalFail: number };
  feedback: string | null;
  completedAt: string;
};

type SimulationAttempt = {
  evidenceId: string;
  bankKey: string;
  bankVersion: number;
  attemptNumber: number;
  scenarioKey: string;
  scenarioVersion: number;
  totalDecisions: number;
  correctDecisions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  evidenceContaminationCount: number;
  authorityViolationCount: number;
  escalationFailureCount: number;
  authoritative: false;
  completedAt: string;
};

type CapabilityMockDossier = {
  authoritative: false;
  purpose: string;
  mockRecommendation: null;
  tutorId: string;
  tutorAssignmentId: string;
  operationalMode: string;
  generatedAt: string;
  evidenceCellSummary: {
    satisfied: number;
    required: number;
    cells: Array<{ code: string; satisfied: boolean }>;
  };
  assessments: AssessmentDossierEntry[];
  practicals: PracticalDossierEntry[];
  oralDefense: {
    currentDefenseVersion: number;
    latestCurrentAttempt: OralAttempt | null;
    staleAttemptCount: number;
  };
  sandboxSimulation: {
    bankKey: string;
    activeBankVersion: number | null;
    currentVersionAttempts: SimulationAttempt[];
    staleAttemptCount: number;
    authoritative: false;
  };
  flags: Array<{ code: string; detail: string; kind: "missing" | "stale" | "conflict" }>;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CapabilityMockDossierCard({ tutorId }: { tutorId: string }) {
  const dossierQuery = useQuery<{ dossier: CapabilityMockDossier }>({
    queryKey: ["capability-mock-dossier", tutorId],
    enabled: Boolean(tutorId),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/coo/tutors/${encodeURIComponent(tutorId)}/capability-dossier`,
      );
      return (await response.json()) as { dossier: CapabilityMockDossier };
    },
  });

  const dossier = dossierQuery.data?.dossier || null;
  const digitalPassed = useMemo(
    () => dossier?.assessments.filter((assessment) => assessment.status === "passed").length || 0,
    [dossier?.assessments],
  );
  const practicalApproved = useMemo(
    () => dossier?.practicals.filter((practical) => practical.status === "approved").length || 0,
    [dossier?.practicals],
  );

  if (dossierQuery.isLoading) {
    return <Card className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">Loading capability evidence dossier...</p></Card>;
  }

  if (dossierQuery.error || !dossier) {
    return (
      <Card className="p-4 sm:p-5">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Capability evidence dossier could not be loaded. The Sandbox Mock assessment remains separate and unchanged.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  const oral = dossier.oralDefense.latestCurrentAttempt;
  const simulations = dossier.sandboxSimulation.currentVersionAttempts;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Capability Engine - reviewer context</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileSearch className="h-5 w-5" /> Capability evidence dossier
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Current-version evidence context for the human Sandbox Mock reviewer. This dossier does not score, pre-mark, or recommend the Mock decision.
          </p>
        </div>
        <Badge variant="outline">Advisory only</Badge>
      </div>

      <Alert className="mt-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          The five Sandbox Mock criteria are judged separately from the live Mock. Nothing below can mark those criteria, pass the Mock, open Trial, or replace the reviewer decision.
        </AlertDescription>
      </Alert>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Evidence cells</p><p className="mt-1 text-xl font-semibold">{dossier.evidenceCellSummary.satisfied}/{dossier.evidenceCellSummary.required}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Digital checks</p><p className="mt-1 text-xl font-semibold">{digitalPassed}/{dossier.assessments.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Practicals</p><p className="mt-1 text-xl font-semibold">{practicalApproved}/{dossier.practicals.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Oral Defense V{dossier.oralDefense.currentDefenseVersion}</p><p className="mt-1 text-sm font-semibold">{oral ? statusLabel(oral.outcome) : "No current evidence"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Simulation attempts</p><p className="mt-1 text-xl font-semibold">{simulations.length}</p></div>
      </div>

      {dossier.flags.length > 0 ? (
        <div className="mt-5 rounded-lg border p-4">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><p className="text-sm font-semibold">Evidence lineage flags ({dossier.flags.length})</p></div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {dossier.flags.map((flag) => (
              <li key={flag.code} className="flex gap-2">
                <Badge variant="outline" className="h-fit shrink-0">{statusLabel(flag.kind)}</Badge>
                <span>{flag.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 rounded-lg border p-4 text-sm">
          <CheckCircle2 className="h-4 w-4" /> No stale, missing, or conflicting current-version lineage flags were detected.
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">16 digital assessment records</summary>
          <div className="mt-4 space-y-3">
            {dossier.assessments.map((assessment) => (
              <div key={assessment.assessmentKey} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium">{assessment.title}</p><p className="text-xs text-muted-foreground">{assessment.evidenceKind} - active bank {assessment.activeBankVersion ?? "none"}</p></div>
                  <Badge variant="outline">{statusLabel(assessment.status)}</Badge>
                </div>
                {assessment.latestCurrentAttempt ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Evidence {assessment.latestCurrentAttempt.evidenceId} - attempt {assessment.latestCurrentAttempt.attemptNumber} - {assessment.latestCurrentAttempt.percent}% - {formatDateTime(assessment.latestCurrentAttempt.completedAt)}
                    {assessment.latestCurrentAttempt.hasCriticalFail ? " - critical fail recorded" : ""}
                  </div>
                ) : null}
                {assessment.staleAttemptCount > 0 ? <p className="mt-1 text-xs text-muted-foreground">{assessment.staleAttemptCount} stale historical attempt(s).</p> : null}
              </div>
            ))}
          </div>
        </details>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">Practical evidence</summary>
          <div className="mt-4 space-y-3">
            {dossier.practicals.map((practical) => (
              <div key={practical.proofKey} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium">{practical.title}</p><p className="text-xs text-muted-foreground">Proof v{practical.currentProofVersion}</p></div>
                  <Badge variant="outline">{statusLabel(practical.status)}</Badge>
                </div>
                {practical.latestCurrentAttempt ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Evidence {practical.latestCurrentAttempt.evidenceId} - attempt {practical.latestCurrentAttempt.attemptNumber} - rubric v{practical.latestCurrentAttempt.rubricVersion ?? "legacy"}</p>
                    {practical.latestCurrentAttempt.counts ? <p>Clear {practical.latestCurrentAttempt.counts.clear}, Partial {practical.latestCurrentAttempt.counts.partial}, Fail {practical.latestCurrentAttempt.counts.fail}, Critical Fail {practical.latestCurrentAttempt.counts.criticalFail}</p> : null}
                    <p>Reviewed {formatDateTime(practical.latestCurrentAttempt.reviewedAt)}</p>
                    {practical.latestCurrentAttempt.feedback ? <p>Reviewer feedback: {practical.latestCurrentAttempt.feedback}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </details>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">Oral Integrity Defense</summary>
          {oral ? (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium">Defense V{oral.defenseVersion} - attempt {oral.attemptNumber}</p><p className="text-xs text-muted-foreground">Evidence {oral.evidenceId}</p></div>
                <Badge variant="outline">{statusLabel(oral.outcome)}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Clear {oral.counts.clear}, Partial {oral.counts.partial}, Fail {oral.counts.fail}, Critical Fail {oral.counts.criticalFail}</p>
              <p className="mt-1 text-xs text-muted-foreground">Completed {formatDateTime(oral.completedAt)}</p>
              {oral.feedback ? <p className="mt-2 text-sm">Reviewer feedback: {oral.feedback}</p> : null}
            </div>
          ) : <p className="mt-4 text-sm text-muted-foreground">No current Oral Defense evidence.</p>}
        </details>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">Sandbox simulation rehearsal</summary>
          <div className="mt-4 space-y-3">
            {simulations.length === 0 ? <p className="text-sm text-muted-foreground">No attempts on the active simulation bank.</p> : null}
            {simulations.map((attempt) => (
              <div key={attempt.evidenceId} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium">Attempt {attempt.attemptNumber} - {attempt.scenarioKey}</p><p className="text-xs text-muted-foreground">Evidence {attempt.evidenceId} - bank v{attempt.bankVersion} - scenario v{attempt.scenarioVersion}</p></div>
                  <Badge variant="outline">{attempt.passed ? "Rehearsal pass" : "Rehearsal not passed"}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{attempt.correctDecisions}/{attempt.totalDecisions} decisions - {attempt.percent}% - {formatDateTime(attempt.completedAt)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Critical fail {attempt.hasCriticalFail ? "yes" : "no"}; contamination {attempt.evidenceContaminationCount}; authority {attempt.authorityViolationCount}; escalation {attempt.escalationFailureCount}.</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" /> Generated {formatDateTime(dossier.generatedAt)}. This evidence packet is read-only and non-authoritative.
      </p>
    </Card>
  );
}
