import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "./queryClient";

interface ProtectedParentRouteProps {
  children: ReactNode;
}

export function ProtectedParentRoute({ children }: ProtectedParentRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch enrollment status
  const { data: enrollmentStatus, isLoading: statusLoading } = useQuery<{
    status: "not_enrolled" | "awaiting_assignment" | "assigned" | "session_booked" | "report_received" | "confirmed";
    step?: string;
  } | null>({
    queryKey: ["/api/parent/enrollment-status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && user?.role === "parent",
    retry: false,
    staleTime: 1000 * 45,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: 60000,
  });

  // Show loading state
  if (isLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    setLocation("/client/signup");
    return null;
  }

  // Redirect if not a parent
  if (user?.role !== "parent") {
    setLocation("/");
    return null;
  }

  // If no enrollment status found (no record yet), redirect to gateway
  if (!enrollmentStatus) {
    setLocation("/client/parent/gateway");
    return null;
  }

  // Only redirect to gateway if enrollment is incomplete
  // Allow access to dashboard once proposal is accepted (session_booked or later)
  const allowedStatuses = ["session_booked", "report_received", "confirmed"];
  if (!allowedStatuses.includes(enrollmentStatus.status)) {
    setLocation("/client/parent/gateway");
    return null;
  }

  // User is authenticated, is a parent, and has accepted the proposal
  return <>{children}</>;
}
