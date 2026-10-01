import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "@/lib/config";
import { getAuthMode } from "@/lib/authMode";
import { supabase } from "@/lib/supabaseClient";
import SpecialistSandboxSimulation from "@/pages/operational/tutor/sandbox-simulation";
import IntroSessionDrillRunner from "./IntroSessionDrillRunner";
import EvidenceCompleteDiagnosisRunner from "./EvidenceCompleteDiagnosisRunner";

function RuntimeAwareEvidenceDiagnosis() {
  const { studentId = "" } = useParams();
  const {
    data: runtimeMode,
    isLoading,
    isFetching,
    error,
  } = useQuery<{ assignmentId: string | null; operationalMode: string }>({
    queryKey: ["/api/tutor/runtime-mode", "evidence-diagnosis", studentId],
    queryFn: async () => {
      const authMode = await getAuthMode();
      const headers: HeadersInit = {};
      if (!authMode.dbSessionAuthMode) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }
      const response = await fetch(`${API_URL}/api/tutor/runtime-mode`, {
        headers,
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            `Failed to verify Specialist runtime mode (${response.status})`,
        );
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Verifying diagnosis runner...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-destructive">
        The diagnosis runner could not verify the Specialist lifecycle state. Return to the Pod and retry.
      </div>
    );
  }

  const operationalMode = String(runtimeMode?.operationalMode || "training")
    .trim()
    .toLowerCase();

  if (operationalMode === "sandbox" && studentId && runtimeMode?.assignmentId) {
    return (
      <SpecialistSandboxSimulation
        studentIdOverride={String(studentId)}
        tutorAssignmentIdOverride={runtimeMode.assignmentId}
        operationalModeOverride={operationalMode}
        embedded
      />
    );
  }

  if (operationalMode === "sandbox") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-destructive">
        Sandbox is active, but the diagnosis runner is missing its assignment or student identity.
      </div>
    );
  }

  return <EvidenceCompleteDiagnosisRunner />;
}

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
    return <RuntimeAwareEvidenceDiagnosis />;
  }

  return <IntroSessionDrillRunner />;
}
