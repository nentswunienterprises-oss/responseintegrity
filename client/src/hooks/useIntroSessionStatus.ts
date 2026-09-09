// Utility to fetch intro session status for a student
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useIntroSessionStatus(studentId: string) {
  return useQuery({
    queryKey: ["/api/tutor/students/intro-session-details", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const res = await apiRequest("GET", `/api/tutor/students/${studentId}/intro-session-details`);
      return await res.json();
    },
    enabled: !!studentId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
