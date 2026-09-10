import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type TutorSessionResponseInput = {
  action: string;
  newDate?: string;
  newTime?: string;
};

type CreateTrainingSessionInput = {
  scheduledStart: string;
  scheduledEnd?: string;
  timezone: string;
};

type SessionIdInput = {
  sessionId: string;
};

type SubmitScheduledSessionRecordingInput = {
  sessionId: string;
  recordingUrl?: string;
  fileData?: string;
  fileName?: string;
  contentType?: string;
};

type RespondTrainingSessionInput = {
  sessionId: string;
  action: string;
  scheduledStart?: string;
  timezone?: string;
  reasonCodes?: string[];
  reasonNote?: string;
};

export function useScheduledSession(studentId) {
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

export function useTutorRespondToSession(studentId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, newDate, newTime }: TutorSessionResponseInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/intro-session-response`, {
        action,
        newDate,
        newTime,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/intro-session-details", studentId] });
    },
  });
}

export function useTrainingSessions(studentId, enabled = true) {
  return useQuery({
    queryKey: ["/api/tutor/students/training-sessions", studentId],
    queryFn: async () => {
      if (!studentId) return { sessions: [], googleMeetConfigured: false };
      const res = await apiRequest("GET", `/api/tutor/students/${studentId}/training-sessions`);
      return await res.json();
    },
    enabled: !!studentId && enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCreateTrainingSession(studentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduledStart, scheduledEnd, timezone }: CreateTrainingSessionInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/training-sessions`, {
        scheduledStart,
        scheduledEnd,
        timezone,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/training-sessions", studentId] });
    },
  });
}

export function useRetryScheduledSessionMeetSync(studentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: SessionIdInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/scheduled-sessions/${sessionId}/retry-meet-sync`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/intro-session-details", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/training-sessions", studentId] });
    },
  });
}

export function useSubmitScheduledSessionRecording(studentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      recordingUrl,
      fileData,
      fileName,
      contentType,
    }: SubmitScheduledSessionRecordingInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/scheduled-sessions/${sessionId}/submit-recording`, {
        sessionId,
        recordingUrl,
        fileData,
        fileName,
        contentType,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/training-sessions", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/intro-session-details", studentId] });
    },
  });
}

export function useConfirmTrainingSession(studentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: SessionIdInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/training-sessions/${sessionId}/confirm`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/training-sessions", studentId] });
    },
  });
}

export function useRespondTrainingSession(studentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      action,
      scheduledStart,
      timezone,
      reasonCodes,
      reasonNote,
    }: RespondTrainingSessionInput) => {
      const res = await apiRequest("POST", `/api/tutor/students/${studentId}/training-sessions/${sessionId}/respond`, {
        sessionId,
        action,
        scheduledStart,
        timezone,
        reasonCodes,
        reasonNote,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/training-sessions", studentId] });
    },
  });
}
