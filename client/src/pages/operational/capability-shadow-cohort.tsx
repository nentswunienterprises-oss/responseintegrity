import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  filterShadowCohortReviewMembers,
  type ShadowCohortClassificationFilter,
  type ShadowCohortCompletenessFilter,
  type ShadowCohortReview,
} from "@shared/capabilityShadowCohort";
import type { ShadowConcordanceClassification } from "@shared/capabilityShadowConcordance";

const CLASSIFICATIONS: ShadowConcordanceClassification[] = [
  "agree_ready",
  "agree_not_ready",
  "agree_integrity_block",
  "battle_test_only_ready",
  "capability_only_ready",
  "missing_comparison_evidence",
  "integrity_disagreement",
  "other_disagreement",
];

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percentage(value: number | null) {
  return value === null ? "Not available" : `${Math.round(value * 100)}%`;
}

function yesNo(value: boolean) {
  return value ? "Present" : "Missing";
}

function classificationTone(value: ShadowConcordanceClassification) {
  if (value.startsWith("agree_")) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value === "missing_comparison_evidence") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-rose-200 bg-rose-50 text-rose-900";
}

export default function CapabilityShadowCohortReview() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const authorized = new Set(["td", "coo", "hr"]).has(role);
  const [completeness, setCompleteness] = useState<ShadowCohortCompletenessFilter>("all");
  const [classification, setClassification] = useState<ShadowCohortClassificationFilter>("all");
  const [query, setQuery] = useState("");

  const cohortQuery = useQuery<{ cohort: ShadowCohortReview }>({
    queryKey: ["capability-shadow-cohort"],
    enabled: Boolean(!authLoading && authorized),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capability-review/shadow-cohort");
      return (await response.json()) as { cohort: ShadowCohortReview };
    },
  });

  const cohort = cohortQuery.data?.cohort || null;
  const visibleMembers = useMemo(
    () => filterShadowCohortReviewMembers({
      members: cohort?.members || [],
      completeness,
      classification,
      query,
    }),
    [cohort?.members, completeness, classification, query],
  );

  if (authLoading) {
    return <div className="min-h-screen bg-background p-6 text-sm text-muted-foreground">Checking reviewer access...</div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Alert variant="destructive" className="mx-auto max-w-3xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            This shadow cohort review surface is restricted to authorised TD, COO, and HR Capability reviewers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button type="button" variant="ghost" className="mb-2 -ml-3" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Capability Engine - shadow evidence
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Shadow cohort review</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Review paired Battle Test and Capability evidence without changing either pathway. Missing evidence remains visible in the cohort denominator.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">Read-only - descriptive only</Badge>
        </div>

        <Alert>
          <CircleHelp className="h-4 w-4" />
          <AlertDescription>
            This surface does not recommend cutover, rank Specialists, or change readiness. Filters only change the visible rows; the cohort denominators below remain fixed.
          </AlertDescription>
        </Alert>

        {cohortQuery.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading shadow cohort evidence...</Card>
        ) : cohortQuery.error || !cohort ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Shadow cohort evidence could not be loaded. No pathway state has been changed.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Candidate assignments</p>
                <p className="mt-1 text-2xl font-semibold">{cohort.summary.candidateAssignments}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Comparable</p>
                <p className="mt-1 text-2xl font-semibold">{cohort.summary.comparableAssignments}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Incomplete</p>
                <p className="mt-1 text-2xl font-semibold">{cohort.summary.incompleteAssignments}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Agreement among comparable</p>
                <p className="mt-1 text-2xl font-semibold">{percentage(cohort.summary.overallAgreementRate)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Mock outcomes observed</p>
                <p className="mt-1 text-2xl font-semibold">{cohort.summary.mockOutcomeObservedCount}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Trial decisions observed</p>
                <p className="mt-1 text-2xl font-semibold">{cohort.summary.trialOutcomeObservedCount}</p>
              </Card>
            </div>

            <Card className="p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px_260px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search Specialist, pod, email, or assignment ID"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <select
                  aria-label="Evidence completeness filter"
                  value={completeness}
                  onChange={(event) => setCompleteness(event.target.value as ShadowCohortCompletenessFilter)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All evidence states</option>
                  <option value="comparable">Comparable only</option>
                  <option value="incomplete">Incomplete only</option>
                </select>
                <select
                  aria-label="Concordance classification filter"
                  value={classification}
                  onChange={(event) => setClassification(event.target.value as ShadowCohortClassificationFilter)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All classifications</option>
                  {CLASSIFICATIONS.map((value) => (
                    <option key={value} value={value}>{humanize(value)}</option>
                  ))}
                </select>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Showing {visibleMembers.length} of {cohort.summary.candidateAssignments} candidate assignments. Filters do not alter the headline denominator.
              </p>
            </Card>

            <div className="space-y-3">
              {visibleMembers.length === 0 ? (
                <Card className="p-6 text-sm text-muted-foreground">No assignments match the current filters.</Card>
              ) : visibleMembers.map((member) => (
                <Card key={member.tutorAssignmentId} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{member.specialistName}</h2>
                        <Badge variant="outline" className={classificationTone(member.overallClassification)}>
                          {humanize(member.overallClassification)}
                        </Badge>
                        <Badge variant="outline">{member.comparable ? "Comparable" : "Incomplete"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.podName || "No pod"} - {member.operationalMode || "mode unknown"} - assignment {member.tutorAssignmentId}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">Battle Test</p>
                        <p className="mt-1 font-medium">{humanize(member.battleTestOverallState)}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">Capability</p>
                        <p className="mt-1 font-medium">{humanize(member.capabilityOverallState)}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">Deep-Dive agreement</p>
                        <p className="mt-1 font-medium">{member.deepDiveSummary.agreeing}/{member.deepDiveSummary.comparable}</p>
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <p className="text-xs text-muted-foreground">Missing Deep Dives</p>
                        <p className="mt-1 font-medium">{member.deepDiveSummary.missing}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Battle evidence</p>
                      <p className="mt-1 font-medium">{member.evidenceCompleteness.battleTestDeepDivesObserved}/11 Deep Dives</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Capability observed</p>
                      <p className="mt-1 font-medium">{member.evidenceCompleteness.capabilityCellsObserved}/33 cells</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Capability satisfied</p>
                      <p className="mt-1 font-medium">{member.evidenceCompleteness.capabilityCellsSatisfied}/33 cells</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Practicals</p>
                      <p className="mt-1 font-medium">{member.evidenceCompleteness.practicalCurrentStateCount}/3 observed</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Oral V2</p>
                      <p className="mt-1 font-medium">{yesNo(member.evidenceCompleteness.oralDefensePresent)}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Simulation</p>
                      <p className="mt-1 font-medium">{yesNo(member.evidenceCompleteness.sandboxSimulationPresent)}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Mock outcome</p>
                      <p className="mt-1 font-medium">{yesNo(member.evidenceCompleteness.sandboxMockOutcomePresent)}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Trial decision</p>
                      <p className="mt-1 font-medium">{yesNo(member.evidenceCompleteness.trialDecisionPresent)}</p>
                    </div>
                  </div>

                  {member.deepDiveSummary.disagreements > 0 || member.deepDiveSummary.integrityDisagreements > 0 ? (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {member.deepDiveSummary.disagreements} comparable Deep-Dive disagreement(s), including {member.deepDiveSummary.integrityDisagreements} integrity asymmetry signal(s). This is evidence to inspect, not a decision recommendation.
                      </span>
                    </div>
                  ) : member.comparable ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" /> No Deep-Dive disagreement is recorded in the current comparable snapshot.
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>

            <p className="pb-4 text-xs text-muted-foreground">
              Generated {new Date(cohort.generatedAt).toLocaleString("en-ZA")}. Descriptive shadow evidence only. No statistical analysis plan or authority migration is implied.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
