import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TrialCaseOverview } from "@shared/trialCertification";

function formatState(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TrialProgressCard({
  trialCase,
  mode,
  audience = "tutor",
}: {
  trialCase: TrialCaseOverview | null;
  mode: string;
  audience?: "tutor" | "coo" | "family";
}) {
  if (mode !== "trial" && !trialCase) return null;

  if (!trialCase) {
    return (
      <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
        <div className="space-y-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-900">Trial Validation</p>
            <Badge className="border-amber-200 bg-amber-100 text-amber-900">0/2 families placed</Badge>
          </div>
          <p className="text-lg font-semibold text-foreground">Preparation is complete. The governed Trial case is waiting to open.</p>
          <p className="text-sm text-muted-foreground">
            A COO must open the case and place two distinct families. Certification cannot be issued by training completion alone.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-900">Trial Validation</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-foreground">
              {trialCase.familyPlacementCount}/2 families placed
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {audience === "family"
                ? "Your specialist is delivering live sessions under supervised validation. Your access remains active while the final review is pending."
                : "Trial is live responsibility under validation: nine qualifying sessions for each of two families, complete evidence, one outcome review per family, then an explicit COO decision."}
            </p>
          </div>
          <Badge className={trialCase.gate.reviewable ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-amber-200 bg-amber-100 text-amber-900"}>
            {trialCase.gate.reviewable ? "Ready for COO decision" : formatState(trialCase.status)}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {trialCase.placements.map((placement, index) => (
            <div key={placement.id} className="rounded-xl border border-amber-200/80 bg-background/90 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Family {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{placement.studentName}</p>
                  {audience !== "family" ? <p className="text-xs text-muted-foreground">{placement.familyName}</p> : null}
                </div>
                <Badge variant="outline">
                  {placement.progress.qualifyingSessionCount}/{placement.progress.requiredSessionCount} sessions
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-muted-foreground">Required logs</p>
                  <p className="mt-1 font-medium text-foreground">
                    {placement.progress.missingLogCount === 0 ? "Complete to date" : `${placement.progress.missingLogCount} missing`}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-muted-foreground">Reports</p>
                  <p className="mt-1 font-medium text-foreground">
                    {placement.progress.reportsComplete ? "Complete" : `${placement.progress.weeklyReportsComplete}/${placement.progress.weeklyReportsRequired} short updates, ${placement.progress.monthlyReportsComplete}/${placement.progress.monthlyReportsRequired} full`}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-muted-foreground">Family feedback</p>
                  <p className="mt-1 font-medium text-foreground">{formatState(placement.feedbackState)}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-muted-foreground">Outcome review</p>
                  <p className="mt-1 font-medium text-foreground">
                    {placement.review ? formatState(placement.review.decision) : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {Array.from({ length: Math.max(0, 2 - trialCase.placements.length) }, (_, index) => (
            <div key={`unplaced-${index}`} className="rounded-xl border border-dashed border-amber-300 bg-background/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Family {trialCase.placements.length + index + 1}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Awaiting governed placement</p>
            </div>
          ))}
        </div>

        {!trialCase.gate.reviewable && trialCase.gate.blockers.length > 0 && audience !== "family" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">Certification blockers</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-950">
              {trialCase.gate.blockers.map((blocker) => <li key={blocker}>- {blocker}</li>)}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Reaching session 18 does not certify automatically. Testimonials remain optional and separate from required family feedback.
        </p>
      </div>
    </Card>
  );
}
