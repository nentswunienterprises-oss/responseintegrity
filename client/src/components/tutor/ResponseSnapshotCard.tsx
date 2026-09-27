import {
  formatSnapshotEvidenceClassLabel,
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  prepareResponseSnapshotForDisplay,
  summarizeSnapshotEvidenceMix,
  type ResponseSnapshotEvidence,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";

function evidenceClassColor(item: ResponseSnapshotEvidence) {
  if (item.decisionEligible === false) return "text-muted-foreground";
  if (item.evidenceStatus === "not_observed" || item.evidenceClass === "not_observed") return "text-muted-foreground";
  if (item.evidenceStatus === "confounded" || item.evidenceClass === "confounded") return "text-violet-700";
  if (item.evidenceClass === "supported") return "text-green-700";
  if (item.evidenceClass === "near_stable") return "text-yellow-700";
  if (item.evidenceClass === "conditional") return "text-amber-700";
  if (item.evidenceClass === "breakdown") return "text-red-700";
  return "text-muted-foreground";
}

function formatState(phase?: string | null, stability?: string | null) {
  if (!phase && !stability) return null;
  return [phase, stability].filter(Boolean).join(" / ");
}

export function ResponseSnapshotCard({ snapshot }: { snapshot: ResponseSnapshotV1 }) {
  const view = prepareResponseSnapshotForDisplay(snapshot);
  const allEvidence = view.sets.flatMap((set) =>
    set.reps.flatMap((rep) => rep.evidence),
  );
  const beforeState = formatState(
    view.engineOutcomeRef?.phaseBefore,
    view.engineOutcomeRef?.stabilityBefore,
  );
  const afterState = formatState(
    view.engineOutcomeRef?.phaseAfter,
    view.engineOutcomeRef?.stabilityAfter,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
      <div className="flex flex-col gap-1 bg-primary/5 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold">
          Response Snapshot{view.source.topic ? ` - ${view.source.topic}` : ""}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          {afterState || summarizeSnapshotEvidenceMix(allEvidence)}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            What This Drill Tested
          </p>
          <p className="text-foreground">
            {formatSnapshotPurposeText(view.drill.purposeText)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Drill Evidence
          </p>
          <p className="text-muted-foreground">
            {formatSnapshotResultText(view.drill.resultText)}
          </p>
        </div>
        {(beforeState || afterState || view.engineOutcomeRef?.transitionReason) && (
          <div className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Evidence Decision
            </p>
            {beforeState && afterState && (
              <p className="text-xs text-foreground">
                {beforeState === afterState ? `Held at ${afterState}` : `${beforeState} → ${afterState}`}
              </p>
            )}
            {!beforeState && afterState && (
              <p className="text-xs text-foreground">{afterState}</p>
            )}
            {view.engineOutcomeRef?.transitionReason && (
              <p className="mt-1 text-xs text-muted-foreground">
                Decision: {view.engineOutcomeRef.transitionReason}
              </p>
            )}
          </div>
        )}
        <div className="space-y-2 border-t pt-1">
          {view.sets.map((set) => {
            return (
              <div
                key={set.setId}
                className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-foreground">{set.setName}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatSnapshotPurposeText(set.purposeText)}
                </p>
                <p className="mt-1 text-xs text-foreground">
                  {formatSnapshotResultText(set.resultText, set.purposeText)}
                </p>
                <div className="mt-2 space-y-1.5">
                  {set.reps.map((rep) => (
                    <div
                      key={`${set.setId}-${rep.repNumber}`}
                      className="rounded border border-primary/10 bg-background px-2 py-2"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-semibold text-foreground">
                          Rep {rep.repNumber}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {summarizeSnapshotEvidenceMix(rep.evidence)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {formatSnapshotRepResult(rep)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {rep.evidence.map((item) => (
                          <span
                            key={item.evidenceId || `${item.dimensionId}-${item.dimensionLabel}`}
                            className={`text-[11px] font-medium ${evidenceClassColor(item)}`}
                          >
                            {item.dimensionLabel}: {formatSnapshotEvidenceClassLabel(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ResponseSnapshotCard;
