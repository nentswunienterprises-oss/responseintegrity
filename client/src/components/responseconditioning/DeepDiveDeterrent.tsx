import {
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Video } from "lucide-react";

type DeepDiveDeterrentProps = {
  children: ReactNode;
};

const BLOCKED_SHORTCUT_KEYS = new Set(["c", "x", "s", "p"]);

function capabilityAssessmentForPath(pathname: string) {
  if (pathname.endsWith("/clarity")) return "clarity_mastery_v1";
  if (pathname.endsWith("/structured-execution")) return "structured_execution_mastery_v1";
  return null;
}

export function DeepDiveDeterrent({ children }: DeepDiveDeterrentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const capabilityAssessmentKey = capabilityAssessmentForPath(location.pathname);
  const showCapabilityAction = String(user?.role || "").toLowerCase() === "tutor" && Boolean(capabilityAssessmentKey);

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
      {showCapabilityAction && capabilityAssessmentKey && (
        <div className="border-t bg-background px-4 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Prove this capability
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with the digital mastery check. Practical evidence then shows whether you can carry the method into observable execution. Neither is automatic certification.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                onClick={() => navigate(`/operational/specialist/capability/${capabilityAssessmentKey}`)}
              >
                Take mastery check
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
