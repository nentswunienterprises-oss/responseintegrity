import {
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Video } from "lucide-react";

type DeepDiveDeterrentProps = {
  children: ReactNode;
};

type CapabilityAssessmentAvailability = {
  assessmentKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  status: "unavailable" | "locked" | "available" | "complete";
  reason: "bank_unavailable" | "prerequisite_missing" | "spacing_window" | "attempt_limit" | "retry_cooldown" | null;
  unlockAt: string | null;
};

type PodData = {
  assignment?: { id?: string | null } | null;
};

const BLOCKED_SHORTCUT_KEYS = new Set(["c", "x", "s", "p"]);

const MASTERY_BY_ROUTE_SUFFIX: Record<string, string> = {
  "/transformation-phases/topic-conditioning": "topic_conditioning_mastery_v1",
  "/clarity": "clarity_mastery_v1",
  "/transformation-phases/clarity": "clarity_mastery_v1",
  "/structured-execution": "structured_execution_mastery_v1",
  "/transformation-phases/structured-execution": "structured_execution_mastery_v1",
  "/controlled-discomfort": "controlled_discomfort_mastery_v1",
  "/transformation-phases/controlled-discomfort": "controlled_discomfort_mastery_v1",
  "/time-pressure-stability": "time_pressure_stability_mastery_v1",
  "/transformation-phases/time-pressure-stability": "time_pressure_stability_mastery_v1",
  "/session-infrastructure/intro-session-structure": "intro_session_structure_mastery_v1",
  "/session-infrastructure/logging-system": "logging_system_mastery_v1",
  "/session-infrastructure/session-flow-control": "session_flow_control_mastery_v1",
  "/session-infrastructure/drill-library": "drill_library_mastery_v1",
  "/session-infrastructure/handover-verification": "handover_verification_mastery_v1",
  "/session-infrastructure/tools-required": "tools_required_mastery_v1",
};

function capabilityAssessmentForPath(pathname: string) {
  const matchingSuffix = Object.keys(MASTERY_BY_ROUTE_SUFFIX)
    .sort((left, right) => right.length - left.length)
    .find((suffix) => pathname.endsWith(suffix));
  return matchingSuffix ? MASTERY_BY_ROUTE_SUFFIX[matchingSuffix] : null;
}

function capabilityStateCopy(status: CapabilityAssessmentAvailability) {
  if (status.status === "complete") {
    return {
      title: "Mastery evidence complete",
      detail: "Current evidence already satisfies this Deep Dive mastery requirement.",
      icon: ShieldCheck,
    };
  }
  if (status.status === "available") {
    return {
      title: "Prove this capability",
      detail: "The private mastery bank is active and this assessment is available now.",
      icon: CheckCircle2,
    };
  }
  if (status.reason === "spacing_window" || status.reason === "retry_cooldown") {
    return {
      title: "Mastery check locked",
      detail: status.unlockAt
        ? `The next attempt unlocks at ${new Date(status.unlockAt).toLocaleString()}.`
        : "The next attempt is not available yet.",
      icon: Clock3,
    };
  }
  if (status.reason === "attempt_limit") {
    return {
      title: "Mastery check paused",
      detail: "The current bank attempt limit has been reached. Further progression requires review or a later bank version.",
      icon: LockKeyhole,
    };
  }
  if (status.status === "unavailable") {
    return {
      title: "Mastery bank not active yet",
      detail: "This capability is in the approved plan, but no private mastery bank is active yet.",
      icon: LockKeyhole,
    };
  }
  return {
    title: "Mastery check locked",
    detail: "Required capability evidence must be completed before this assessment unlocks.",
    icon: LockKeyhole,
  };
}

export function DeepDiveDeterrent({ children }: DeepDiveDeterrentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const capabilityAssessmentKey = capabilityAssessmentForPath(location.pathname);
  const isSpecialist = String(user?.role || "").toLowerCase() === "tutor";

  const podQuery = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    enabled: isSpecialist && Boolean(capabilityAssessmentKey),
    retry: false,
  });
  const tutorAssignmentId = String(podQuery.data?.assignment?.id || "");

  const planQuery = useQuery<{ assessments: CapabilityAssessmentAvailability[] }>({
    queryKey: ["capability-plan", tutorAssignmentId],
    enabled: isSpecialist && Boolean(capabilityAssessmentKey) && Boolean(tutorAssignmentId),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tutor/capability-plan?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await response.json()) as { assessments: CapabilityAssessmentAvailability[] };
    },
  });

  const capabilityStatus = capabilityAssessmentKey
    ? planQuery.data?.assessments.find((entry) => entry.assessmentKey === capabilityAssessmentKey) || null
    : null;
  const capabilityPresentation = capabilityStatus ? capabilityStateCopy(capabilityStatus) : null;
  const showCapabilityAction = isSpecialist && Boolean(capabilityAssessmentKey) && Boolean(capabilityStatus);

  useEffect(() => {
    const blockEvent = (event: Event) => {
      event.preventDefault();
    };

    const handleCopy = (event: ClipboardEvent) => {
      blockEvent(event);
    };

    const handleContextMenu = (event: MouseEvent) => {
      blockEvent(event);
    };

    const handleDragStart = (event: DragEvent) => {
      blockEvent(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const pressedKey = event.key.toLowerCase();
      const isShortcut = (event.ctrlKey || event.metaKey) && BLOCKED_SHORTCUT_KEYS.has(pressedKey);
      const isPrintScreen = pressedKey === "printscreen";

      if (!isShortcut && !isPrintScreen) {
        return;
      }

      event.preventDefault();
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCopy);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCopy);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleReactCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleReactContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleReactKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pressedKey = event.key.toLowerCase();
    const isShortcut = (event.ctrlKey || event.metaKey) && BLOCKED_SHORTCUT_KEYS.has(pressedKey);
    const isPrintScreen = pressedKey === "printscreen";

    if (!isShortcut && !isPrintScreen) {
      return;
    }

    event.preventDefault();
  };

  return (
    <div
      className="relative overflow-hidden"
      onContextMenu={handleReactContextMenu}
      onCopy={handleReactCopy}
      onCut={handleReactCopy}
      onKeyDown={handleReactKeyDown}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div className="relative z-0">{children}</div>
      {showCapabilityAction && capabilityAssessmentKey && capabilityStatus && capabilityPresentation && (
        <div className="border-t bg-background px-4 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <capabilityPresentation.icon className="h-4 w-4" /> {capabilityPresentation.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {capabilityPresentation.detail} Capability Engine remains shadow evidence and does not certify or open Trial.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {capabilityStatus.status === "available" && (
                <Button
                  onClick={() => navigate(`/operational/specialist/capability/${capabilityAssessmentKey}`)}
                >
                  Take mastery check
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate("/operational/specialist/capability-plan")}
              >
                View capability plan
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/operational/specialist/capability-practicals")}
              >
                <Video className="mr-2 h-4 w-4" /> Practical evidence
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
