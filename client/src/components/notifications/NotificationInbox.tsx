import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { getAuthMode } from "@/lib/authMode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, Clock } from "lucide-react";

export interface NotificationItem {
  id: string;
  channel: "action_required" | "informational";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityType?: string | null;
}

function isLegacyRecordingNotification(notification: NotificationItem) {
  const title = String(notification.title || "").toLowerCase();
  const message = String(notification.message || "").toLowerCase();
  return (
    title.includes("recording required") ||
    title.includes("upload the recording") ||
    message.includes("upload the recording") ||
    message.includes("recording for intro") ||
    message.includes("recording required")
  );
}

export function NotificationInbox({
  title,
  description,
  emptyMessage,
  excludeEntityTypes = [],
  showHeader = true,
  autoMarkRead = true,
  hideReadNotifications = false,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  excludeEntityTypes?: string[];
  showHeader?: boolean;
  autoMarkRead?: boolean;
  hideReadNotifications?: boolean;
}) {
  const qc = useQueryClient();
  const initialized = useRef(false);
  const [emergencyDbMode, setEmergencyDbMode] = useState(false);

  useEffect(() => {
    let active = true;
    getAuthMode().then((mode) => {
      if (active) setEmergencyDbMode(mode.emergencyDbMode);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const { data: notifications, isLoading } = useQuery<NotificationItem[] | null>({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchInterval: emergencyDbMode ? false : 30000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
  });
  const notificationList = Array.isArray(notifications) ? notifications : [];
  const markRead = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });
  const visibleNotifications = useMemo(
    () =>
      notificationList.filter((n) => {
        if (excludeEntityTypes.includes(n.entityType || "")) return false;
        if (isLegacyRecordingNotification(n)) return false;
        if (hideReadNotifications && n.isRead) return false;
        return true;
      }),
    [excludeEntityTypes, hideReadNotifications, notificationList]
  );
  const unread = useMemo(() => visibleNotifications.filter((n) => !n.isRead), [visibleNotifications]);
  useEffect(() => {
    if (!autoMarkRead) return;
    if (initialized.current) return;
    initialized.current = true;
    unread.forEach((n) => markRead.mutate(n.id));
  }, [autoMarkRead, unread, markRead]);
  if (isLoading) return <div className="flex items-center justify-center h-48 sm:h-64"><div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  return (
    <div className="space-y-4 sm:space-y-6">
      {showHeader && (
        <div className="mb-4 sm:mb-8 flex items-center justify-between gap-2">
          <div><h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2"><Bell className="w-5 h-5 sm:w-8 sm:h-8" />{title}</h1><p className="text-xs sm:text-base text-muted-foreground">{description}</p></div>
          {unread.length > 0 && <Badge variant="destructive" className="text-sm sm:text-lg px-2 sm:px-4 py-1 sm:py-2">{unread.length} New</Badge>}
        </div>
      )}
      {visibleNotifications.length === 0 ? (
        <Card><CardContent className="p-4 sm:pt-6 text-center text-sm sm:text-base text-muted-foreground"><Bell className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" /><p>{emptyMessage}</p></CardContent></Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {visibleNotifications.map((n) => (
            <Card key={n.id} className={`${!n.isRead ? (n.channel === "action_required" ? "border-l-4 border-l-destructive bg-destructive/5" : "border-l-4 border-l-primary bg-primary/5") : ""}`}>
              <CardHeader className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                      {n.title}
                      <Badge variant={n.channel === "action_required" ? "destructive" : "secondary"} className="text-xs uppercase tracking-wide">
                        {n.channel === "action_required" ? "Action Required" : "Informational"}
                      </Badge>
                      {!n.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-1 sm:gap-3 mt-1 sm:mt-2 text-xs sm:text-sm">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </CardDescription>
                  </div>
                  {n.isRead && <Badge variant="secondary" className="flex items-center gap-1 text-xs w-fit"><CheckCircle2 className="w-3 h-3" />Read</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{n.message}</p>
                {!n.isRead && <Button size="sm" variant="outline" className="mt-4" onClick={() => markRead.mutate(n.id)}>Dismiss</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
