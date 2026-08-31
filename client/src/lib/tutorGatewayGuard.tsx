import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

type TutorGatewaySession = {
  applicationStatus?: {
    status?: string;
  } | null;
  assignment?: unknown;
};

export function TutorGatewayGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const currentPath = location.pathname;
  const isGatewayRoute = currentPath === "/operational/tutor/gateway" || currentPath === "/operational/specialist/gateway";

  const { data: gatewaySession, isLoading: gatewayLoading } = useQuery<TutorGatewaySession>({
    queryKey: ["/api/tutor/gateway-session"],
    enabled: isAuthenticated && isGatewayRoute,
    retry: false,
  });

  if (authLoading || (isGatewayRoute && isAuthenticated && gatewayLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading specialist access...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/operational/signup?role=tutor&mode=login&lock=login&returnTo=/operational/specialist/intake" replace />;
  }

  if (!isGatewayRoute) {
    return <>{children}</>;
  }

  const status = String(gatewaySession?.applicationStatus?.status || "").toLowerCase();
  const hasPodAssignment = Boolean(gatewaySession?.assignment);
  const hasTutorAccess = status === "confirmed" && hasPodAssignment;

  if (!hasTutorAccess && !isGatewayRoute) {
    return <Navigate to="/operational/specialist/gateway" replace />;
  }

  if (hasTutorAccess && isGatewayRoute) {
    return <Navigate to="/specialist/pod" replace />;
  }

  return <>{children}</>;
}
