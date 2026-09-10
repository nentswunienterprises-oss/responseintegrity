import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthMode } from "@/lib/authMode";
import { useEffect, useState } from "react";

export interface StudentWorkflowState {
  assignmentAccepted: boolean;
  introConfirmed: boolean;
  introCompleted: boolean;
  handoverVerificationRequired: boolean;
  handoverSessionConfirmed: boolean;
  handoverCompleted: boolean;
  identitySaved: boolean;
  proposalSent: boolean;
  proposalAccepted: boolean;
}

export function useStudentWorkflowState(
  studentId: string,
  apiBasePath = "/api/tutor",
  enabled = true,
) {
  const [emergencyDbMode, setEmergencyDbMode] = useState(false);

  useEffect(() => {
    getAuthMode().then((mode) => setEmergencyDbMode(mode.emergencyDbMode));
  }, []);

  return useQuery<StudentWorkflowState>({
    queryKey: [apiBasePath, "students", studentId, "workflow-state"],
    queryFn: async () => {
      if (!studentId) {
        return {
          assignmentAccepted: false,
          introConfirmed: false,
          introCompleted: false,
          handoverVerificationRequired: false,
          handoverSessionConfirmed: false,
          handoverCompleted: false,
          identitySaved: false,
          proposalSent: false,
          proposalAccepted: false,
        };
      }

      const res = await apiRequest("GET", `${apiBasePath}/students/${studentId}/workflow-state`);
      return await res.json();
    },
    enabled: enabled && !!studentId,
    refetchInterval: emergencyDbMode ? false : 10000,
    retry: emergencyDbMode ? false : undefined,
    refetchOnWindowFocus: emergencyDbMode ? false : undefined,
    refetchOnReconnect: emergencyDbMode ? false : undefined,
  });
}

export function useMarkIntroCompleted(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/workflow/intro-completed`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "workflow-state"] });
    },
  });
}

export function useMarkHandoverCompleted(studentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/workflow/handover-completed`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "workflow-state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/intro-session-details", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] });
    },
  });
}

export function useRespondToAssignment(studentId: string, enrollmentId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (decision: "accept" | "decline") => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/workflow/assignment-decision`, {
        decision,
        enrollmentId: enrollmentId || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "workflow-state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] });
    },
  });
}
