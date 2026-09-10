import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthMode } from "@/lib/authMode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, X } from "lucide-react";

interface CommunicationMessage {
  id: string;
  senderRole: string;
  senderName: string;
  replyToMessageId?: string | null;
  replyTo?: {
    id: string;
    senderName: string;
    message: string;
  } | null;
  message: string;
  createdAt: string;
  readByParentAt?: string | null;
  readByStudentAt?: string | null;
}

interface CommunicationInboxResponse {
  student: { id: string; name: string; grade: string | null };
  tutor: { id: string; name: string } | null;
  parent?: { id: string | null; name: string; available: boolean };
  thread: {
    threadId: string;
    audience: "parent" | "student";
    messages: CommunicationMessage[];
  };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageList({
  messages,
  selfRole,
  onReply,
}: {
  messages: CommunicationMessage[];
  selfRole: "parent" | "student";
  onReply: (message: CommunicationMessage) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
        <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
        <p>No messages yet.</p>
      </div>
    );
  }

  const firstUnreadMessageId = messages.find((message) => {
    if (message.senderRole === selfRole) return false;
    if (selfRole === "parent") return !message.readByParentAt;
    return !message.readByStudentAt;
  })?.id;

  return (
    <div ref={messagesRef} className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="space-y-3">
          {message.id === firstUnreadMessageId && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-destructive/30" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-destructive">
                Unread Messages
              </span>
              <div className="h-px flex-1 bg-destructive/30" />
            </div>
          )}
          <MessageBubble
            message={message}
            own={message.senderRole === selfRole}
            onReply={onReply}
          />
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  own,
  onReply,
}: {
  message: CommunicationMessage;
  own: boolean;
  onReply: (message: CommunicationMessage) => void;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] sm:max-w-[75%] ${own ? "items-end" : "items-start"} flex flex-col gap-1`}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;

          const deltaX = touch.clientX - start.x;
          const deltaY = Math.abs(touch.clientY - start.y);

          if (deltaX > 64 && deltaY < 28) {
            onReply(message);
          }
        }}
      >
        <div
          className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
            own
              ? "bg-primary text-primary-foreground"
              : "border border-border/60 bg-background text-foreground"
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] opacity-80">
            <span className="font-medium">{message.senderName}</span>
            <span>{formatTimestamp(message.createdAt)}</span>
          </div>
          {message.replyTo && (
            <div
              className={`mb-2 rounded-xl border-l-2 px-2 py-1.5 text-xs ${
                own
                  ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground"
                  : "border-primary/40 bg-muted/70 text-muted-foreground"
              }`}
            >
              <p className="font-medium">{message.replyTo.senderName}</p>
              <p className="line-clamp-2 whitespace-pre-wrap break-words">{message.replyTo.message}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{message.message}</p>
        </div>
      </div>
    </div>
  );
}

export function CommunicationInbox({
  audience,
  title,
  description,
  queryKey,
  getPath,
  postPath,
  unreadCountPath,
  updatesContent,
  defaultTab,
}: {
  audience: "parent" | "student";
  title: string;
  description: string;
  queryKey: string[];
  getPath: string;
  postPath: string;
  unreadCountPath?: string;
  updatesContent?: ReactNode;
  defaultTab?: "messages" | "updates";
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"messages" | "updates">(
    defaultTab || (updatesContent ? "updates" : "messages")
  );
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommunicationMessage | null>(null);
  const [emergencyDbMode, setEmergencyDbMode] = useState(false);
  const unreadCountQueryKey = useMemo(
    () => (unreadCountPath ? [unreadCountPath] : []),
    [unreadCountPath]
  );

  useEffect(() => {
    let active = true;
    getAuthMode().then((mode) => {
      if (active) setEmergencyDbMode(mode.emergencyDbMode);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery<{ unreadCount: number }>({
    queryKey: unreadCountQueryKey,
    enabled: !!unreadCountPath,
    queryFn: async () => {
      const res = await apiRequest("GET", unreadCountPath!);
      return res.json();
    },
    refetchInterval: emergencyDbMode ? false : 15000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const unreadCount = Number(unreadCountData?.unreadCount || 0);

  const { data, isLoading, error, refetch: refetchThread } = useQuery<CommunicationInboxResponse>({
    queryKey,
    enabled: activeTab === "messages",
    queryFn: async () => {
      const res = await apiRequest("GET", getPath);
      return res.json();
    },
    refetchInterval: false,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", postPath, {
        message,
        audience,
        replyToMessageId: replyTarget?.id,
      });
      return res.json();
    },
    onSuccess: async () => {
      setDraft("");
      setReplyTarget(null);
      if (unreadCountPath) {
        queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });
      }
      await refetchThread();
      if (unreadCountPath) {
        await refetchUnreadCount();
      }
    },
  });

  useEffect(() => {
    if (activeTab !== "messages") return;

    const syncMessages = async () => {
      await refetchThread();
      if (unreadCountPath) {
        await refetchUnreadCount();
      }
    };

    void syncMessages();
  }, [activeTab, refetchThread, refetchUnreadCount, unreadCountPath]);

  useEffect(() => {
    if (activeTab === "messages" && data && unreadCountPath) {
      void refetchUnreadCount();
    }
  }, [activeTab, data, refetchUnreadCount, unreadCountPath]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "messages" | "updates")}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
          <TabsTrigger
            value="messages"
            className="flex items-center justify-center gap-2 text-xs sm:text-sm py-2 px-2"
          >
            Messages
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="updates" className="text-xs sm:text-sm py-2 px-2">
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>
                {isLoading
                  ? "Loading..."
                  : error
                    ? "Messages unavailable"
                    : !data
                      ? "Messages"
                      : `${data.student.name}${data.student.grade ? ` - ${data.student.grade}` : ""}`}
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Loading communication thread."
                  : error
                    ? error instanceof Error
                      ? error.message
                      : "Unable to load the Response Integrity communication thread."
                    : !data
                      ? "Open this tab to view your Response Integrity communication thread."
                      : `Your Response Integrity communication with ${data.tutor?.name || "the tutor"} stays inside the platform.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-4">
                {activeTab !== "messages" ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                    Open Messages to view your Response Integrity thread.
                  </div>
                ) : isLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                    Loading messages...
                  </div>
                ) : error ? (
                  <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "Unable to load messages."}
                  </div>
                ) : (
                  <MessageList
                    messages={data?.thread.messages || []}
                    selfRole={audience}
                    onReply={(message) => setReplyTarget(message)}
                  />
                )}
              </div>
              <div className="space-y-3">
                {replyTarget && (
                  <div className="rounded-xl border border-primary/20 bg-muted/20 px-3 py-2">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          Replying to {replyTarget.senderName}
                        </p>
                        <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {replyTarget.message}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setReplyTarget(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={replyTarget ? `Reply to ${replyTarget.senderName}...` : "Send a message through the platform..."}
                  className="min-h-[96px] resize-none"
                  disabled={sendMessage.isPending || activeTab !== "messages" || !!error}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Tutor communication stays inside the platform.
                  </p>
                  <Button
                    onClick={() => sendMessage.mutate(draft.trim())}
                    disabled={!draft.trim() || sendMessage.isPending || activeTab !== "messages" || !!error}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendMessage.isPending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates">{updatesContent}</TabsContent>
      </Tabs>
    </div>
  );
}
