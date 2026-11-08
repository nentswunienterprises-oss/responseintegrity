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
  const requestedTopic = String(searchParams.get("topic") || "").trim();
  const requestedTopicIndex = Number(searchParams.get("topicIndex") || 0);
  const selectedTopics = (() => {
    const raw = String(searchParams.get("topics") || "").trim();
    if (!raw) return requestedTopic ? [requestedTopic] : [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean)),
        ).slice(0, 2);
      }
    } catch {
      // Older launch links may encode selected topics as a comma-separated list.
    }
    return Array.from(new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))).slice(0, 2);
  })();
  const activeDiagnosisTopic =
    selectedTopics[Number.isInteger(requestedTopicIndex) && requestedTopicIndex >= 0
      ? requestedTopicIndex
      : 0] || requestedTopic;

  if (mode === "diagnosis") {
    if (!activeDiagnosisTopic) {
      return <MissingEvidenceDiagnosisContext />;
    }
    return <EvidenceCompleteDiagnosisRunner />;
  }

  return <IntroSessionDrillRunner />;
}
