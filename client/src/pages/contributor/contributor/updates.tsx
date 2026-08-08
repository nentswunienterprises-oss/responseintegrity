import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Mail } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authorizedGetJson } from "@/lib/api";

export default function ContributorUpdates() {
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<Map<string, boolean>>(new Map());

  const { data: readData } = useQuery<{ readBroadcasts: string[] }>({
    queryKey: ["/api/broadcasts/read-list"],
  });

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      // MVP compatibility: contributor UI still reads affiliate broadcast lane.
      const data = await authorizedGetJson("/api/broadcasts?role=affiliate");
      setBroadcasts(data);
    } catch (error) {
      console.error("Error fetching contributor broadcasts:", error);
      toast({
        title: "Error",
        description: "Failed to load contributor updates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (broadcastId: string) => {
    setMarkingIds((prev) => new Map(prev).set(broadcastId, true));
    try {
      await apiRequest("POST", `/api/broadcasts/${broadcastId}/read`, {});

      queryClient.setQueryData<{ readBroadcasts: string[] }>(
        ["/api/broadcasts/read-list"],
        (old) => ({
          readBroadcasts: [...(old?.readBroadcasts || []), broadcastId],
        }),
      );

      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts/unread-count"] });

      toast({
        title: "Success",
        description: "Contributor update marked as read",
      });

      fetchBroadcasts();
    } catch (error: any) {
      console.error("Error marking contributor broadcast as read:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark contributor update as read",
        variant: "destructive",
      });
    } finally {
      setMarkingIds((prev) => {
        const newMap = new Map(prev);
        newMap.delete(broadcastId);
        return newMap;
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight mb-1 sm:mb-2">Contributor Updates</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Stay informed with production notices, standards updates, and leadership broadcasts.
          </p>
        </div>

        {loading ? (
          <Card className="p-6 sm:p-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">Loading contributor updates...</p>
          </Card>
        ) : broadcasts.length === 0 ? (
          <Card className="p-6 sm:p-12 text-center">
            <Mail className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-2 sm:mb-3" />
            <p className="text-sm sm:text-base text-muted-foreground">No contributor updates yet</p>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {broadcasts.map((broadcast: any) => {
              const isExpanded = expandedId === broadcast.id;
              const isRead = readData?.readBroadcasts?.includes(broadcast.id);
              const isMarking = markingIds.get(broadcast.id);

              return (
                <Card
                  key={broadcast.id}
                  className={`p-3 sm:p-6 transition-all hover:shadow-md cursor-pointer border-l-4 ${
                    isRead
                      ? "border-l-muted opacity-75 bg-card"
                      : "border-l-primary bg-primary/5"
                  }`}
                >
                  <div
                    className="space-y-3 sm:space-y-4"
                    onClick={() => setExpandedId(isExpanded ? null : broadcast.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {!isRead && <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary flex-shrink-0" />}
                          <h3 className="font-bold text-sm sm:text-lg text-foreground break-words">
                            {broadcast.subject || "No Subject"}
                          </h3>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                          {new Date(broadcast.createdAt).toLocaleDateString()} at{" "}
                          {new Date(broadcast.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {!isRead && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(broadcast.id);
                          }}
                          disabled={isMarking}
                          className="gap-2 flex-shrink-0 text-xs sm:text-sm w-full sm:w-auto"
                        >
                          <Eye className="w-4 h-4" />
                          {isMarking ? "Marking..." : "Mark Read"}
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-muted">
                        <div
                          className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: broadcast.message || "No message" }}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
