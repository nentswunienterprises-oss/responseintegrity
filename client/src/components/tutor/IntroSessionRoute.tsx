import { useSearchParams } from "react-router-dom";
import IntroSessionDrillRunner from "./IntroSessionDrillRunner";
import EvidenceCompleteDiagnosisRunner from "./EvidenceCompleteDiagnosisRunner";

function MissingEvidenceDiagnosisContext() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Diagnosis setup required
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Evidence-native diagnosis needs a topic before it can start.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Return to the student topic view and start diagnosis from a selected
          topic so the evidence ledger, topic state, and diagnosis decision all
          use the same evidence-native contract.
        </p>
      </div>
    </div>
  );
}

export default function IntroSessionRoute() {
  const [searchParams] = useSearchParams();
  const mode = String(searchParams.get("mode") || "diagnosis").trim().toLowerCase();
  const topic = String(searchParams.get("topic") || "").trim();

  if (mode === "diagnosis") {
    if (!topic) {
      return <MissingEvidenceDiagnosisContext />;
    }
    return <EvidenceCompleteDiagnosisRunner />;
  }

  return <IntroSessionDrillRunner />;
}
