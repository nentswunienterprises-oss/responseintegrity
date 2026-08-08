import { Button } from "@/components/ui/button";
import { useScheduledSession, useTutorRespondToSession } from "@/hooks/useScheduledSession";
import { useParentIntroSessionStatus } from "@/hooks/useParentIntroSessionStatus";
import { useState } from "react";

type TutorIntroSessionActionsProps = {
  studentId?: number | string | null;
  parentId?: number | string | null;
  tutorId?: number | string | null;
  sessionLabelOverride?: string;
};

export function TutorIntroSessionActions({ studentId, parentId, tutorId, sessionLabelOverride }: TutorIntroSessionActionsProps) {
  // Use parent/tutor-based hook if no studentId yet
  const { data, isLoading, error } = studentId
    ? useScheduledSession(studentId)
    : useParentIntroSessionStatus(parentId, tutorId);
  const respond = studentId
    ? useTutorRespondToSession(studentId)
    : { mutate: () => {}, isPending: false, isError: false, isSuccess: false, error: null };
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const sessionLabel = data?.type === "handover" ? "continuity check" : (sessionLabelOverride || "intro session");

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-xs text-red-600">Error loading session</div>;
  if (!data || !data.scheduled_time) {
    return <div className="text-xs text-muted-foreground">No {sessionLabel} proposed.</div>;
  }

  const proposed = new Date(data.scheduled_time);
  const formatted = proposed.toLocaleString();

  return (
    <div className="space-y-1">
      <div className="text-xs">
        <span className="font-semibold">Proposed:</span> {formatted}
      </div>
      {data.status === "pending_tutor_confirmation" && (
        <div className="flex gap-1 items-center">
          <Button size="sm" onClick={() => respond.mutate({ action: "accept" })} disabled={respond.isPending}>
            Confirm
          </Button>
          <span className="mx-1 text-muted-foreground">or</span>
          <button
            type="button"
            className="border rounded px-1 py-0.5 text-xs w-[110px] bg-white"
            onClick={() => setShowDatePicker(true)}
          >
            {newDate || "Pick date"}
          </button>
          {showDatePicker && (
            <input
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setShowDatePicker(false);
              }}
              className="absolute z-10"
              style={{ left: 0 }}
              autoFocus
            />
          )}
          <button
            type="button"
            className="border rounded px-1 py-0.5 text-xs w-[90px] bg-white"
            onClick={() => setShowTimePicker(true)}
          >
            {newTime || "Pick time"}
          </button>
          {showTimePicker && (
            <input
              type="time"
              value={newTime}
              onChange={(e) => {
                setNewTime(e.target.value);
                setShowTimePicker(false);
              }}
              className="absolute z-10"
              style={{ left: 120 }}
              autoFocus
            />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => respond.mutate({ action: "propose_adjustment", newDate, newTime })}
            disabled={respond.isPending || !newDate || !newTime}
          >
            Adjust
          </Button>
        </div>
      )}
      {newDate && newTime && data.status === "pending_tutor_confirmation" && (
        <div className="text-[11px] text-muted-foreground">New: {newDate} {newTime}</div>
      )}
      {data.status === "pending_parent_confirmation" && (
        <div className="text-[11px] text-yellow-700">Waiting for parent confirmation...</div>
      )}
      {["confirmed", "ready", "live", "completed"].includes(String(data.status || "")) && (
        <div className="space-y-1">
          <div className="text-[11px] text-green-700">Session confirmed!</div>
          <div className="text-[11px] text-muted-foreground">
            {sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1)} is confirmed. Open the next Response Integrity step when you are ready.
          </div>
        </div>
      )}
      {respond.isError && <div className="text-[11px] text-red-600">{respond.error instanceof Error ? respond.error.message : "Failed to send response"}</div>}
      {respond.isSuccess && <div className="text-[11px] text-green-600">Response sent!</div>}
    </div>
  );
}
