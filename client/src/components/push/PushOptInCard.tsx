import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";

export function PushOptInCard({
  enabled,
  title,
  description,
}: {
  enabled: boolean;
  title: string;
  description: string;
}) {
  const push = useWebPushSubscription(enabled);
  const dismissKey = "push-opt-in-card-hidden";
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(dismissKey) === "true";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey, "true");
    } catch {
      // Keep the dismissal for this mounted session even if storage is unavailable.
    }
    setHidden(true);
  };

  if (!enabled || !push.supported || !push.resolved || push.subscribed || hidden) {
    return null;
  }

  return (
    <Card className="border border-[#E63946]/20 bg-[#FFF7F4]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-[#E63946]" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          onClick={() => push.enable()}
          disabled={push.loading}
          className="rounded-full"
          style={{ backgroundColor: "#E63946", color: "white" }}
        >
          {push.loading ? "Enabling..." : "Enable browser notifications"}
        </Button>
        {push.permission === "denied" && (
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground">
            Notifications are blocked in this browser. Enable them in browser settings, then reload this page.
          </p>
        )}
        {push.error && (
          <p className="mt-3 text-xs sm:text-sm text-destructive">
            {push.error}
          </p>
        )}
        <Button
          variant="ghost"
          className="mt-4 text-sm"
          onClick={dismiss}
        >
          No thanks.
        </Button>
      </CardContent>
    </Card>
  );
}
