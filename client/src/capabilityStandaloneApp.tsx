import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Navigate, Route, Routes } from "react-router-dom";
import { queryClient, persister } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { TutorGatewayGuard } from "@/lib/tutorGatewayGuard";
import SpecialistCapabilityAssessment from "@/pages/operational/tutor/capability-assessment";
import SpecialistCapabilityPlan from "@/pages/operational/tutor/capability-plan";
import SpecialistCapabilityPracticals from "@/pages/operational/tutor/capability-practicals";
import SpecialistCapabilitySandboxSimulation from "@/pages/operational/tutor/capability-sandbox-simulation";
import CapabilityPracticalReview from "@/pages/operational/capability-practical-review";
import CapabilityOralDefenseReview from "@/pages/operational/capability-oral-defense-review";

export function CapabilityStandaloneApp() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <TooltipProvider>
        <OfflineIndicator />
        <Toaster />
        <Routes>
          <Route
            path="/operational/specialist/capability-plan"
            element={
              <TutorGatewayGuard>
                <SpecialistCapabilityPlan />
              </TutorGatewayGuard>
            }
          />
          <Route
            path="/operational/specialist/capability/:assessmentKey"
            element={
              <TutorGatewayGuard>
                <SpecialistCapabilityAssessment />
              </TutorGatewayGuard>
            }
          />
          <Route
            path="/operational/specialist/capability-practicals"
            element={
              <TutorGatewayGuard>
                <SpecialistCapabilityPracticals />
              </TutorGatewayGuard>
            }
          />
          <Route
            path="/operational/specialist/capability-sandbox-simulation"
            element={
              <TutorGatewayGuard>
                <SpecialistCapabilitySandboxSimulation />
              </TutorGatewayGuard>
            }
          />
          <Route
            path="/operational/capability-review/practicals"
            element={<CapabilityPracticalReview />}
          />
          <Route
            path="/operational/capability-review/oral-defense"
            element={<CapabilityOralDefenseReview />}
          />
          <Route path="*" element={<Navigate to="/specialist/pod" replace />} />
        </Routes>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
