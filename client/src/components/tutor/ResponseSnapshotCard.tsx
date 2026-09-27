import {
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";

function responseSnapshotColor(level: string) {
  if (level === "strong") return "text-green-700";
  if (level === "partial") return "text-yellow-700";
  if (level === "weak") return "text-red-700";
  return "text-muted-foreground";
}

export function ResponseSnapshotCard({ snapshot }: { snapshot: ResponseSnapshotV1 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
      <div className="flex flex-col gap-1 bg-primary/5 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold">
          Response Snapshot{snapshot.source.topic ? ` - ${snapshot.source.topic}` : ""}
        </span>
        <span className={`text-sm font-semibold ${responseSnapshotColor(snapshot.drill.responseLevel)}`}>
          {snapshot.drill.responseLabel}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            What This Drill Tested
          </p>
          <p className="text-foreground">
            {formatSnapshotPurposeText(snapshot.drill.purposeText)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Drill Response
          </p>
          <p className="text-muted-foreground">
            {formatSnapshotResultText(snapshot.drill.resultText)}
          </p>
        </div>
        <div className="space-y-2 border-t pt-1">
          {snapshot.sets.map((set) => (
            <div
              key={set.setId}
              className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-foreground">{set.setName}</p>
                <p className={`text-xs font-semibold ${responseSnapshotColor(set.responseLevel)}`}>
                  {set.responseLabel}
                </p>
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
                      <p className={`text-xs font-semibold ${responseSnapshotColor(rep.responseLevel)}`}>
                        {rep.responseLabel}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {formatSnapshotRepResult(rep)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ResponseSnapshotCard;
