import { useSearchParams } from "react-router-dom";
import IntroSessionDrillRunner from "./IntroSessionDrillRunner";
import EvidenceCompleteDiagnosisRunner from "./EvidenceCompleteDiagnosisRunner";

export default function IntroSessionRoute() {
  const [searchParams] = useSearchParams();
  const mode = String(searchParams.get("mode") || "diagnosis").trim().toLowerCase();
  const diagnosisEngine = String(searchParams.get("diagnosisEngine") || "").trim().toLowerCase();

  if (mode === "diagnosis" && diagnosisEngine !== "legacy") {
    return <EvidenceCompleteDiagnosisRunner />;
  }

  return <IntroSessionDrillRunner />;
}
