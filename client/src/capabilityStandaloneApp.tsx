import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Navigate, Route, Routes } from "react-router-dom";
import { queryClient, persister } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { TutorGatewayGuard } from "@/lib/tutorGatewayGuard";
import SpecialistCapabilityAssessment from "@/pages/operational/tutor/capability-assessment";

export function CapabilityStandaloneApp() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <TooltipProvider>
        <OfflineIndicator />
        <Toaster />
        <Routes>
          <Route
            path="/operational/specialist/capability/:assessmentKey"
            element={
              <TutorGatewayGuard>
                <SpecialistCapabilityAssessment />
              </TutorGatewayGuard>
            }
          />
          <Route path="*" element={<Navigate to="/specialist/pod" replace />} />
        </Routes>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
