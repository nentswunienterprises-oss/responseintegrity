import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, X } from "lucide-react";

type Audience = "parent" | "student";

interface CommunicationMessage {
  id: string;
  senderRole: "tutor" | "parent" | "student" | string;
  senderName: string;
  replyToMessageId?: string | null;
  replyTo?: {
    id: string;
    senderName: string;
    message: string;
  } | null;
  message: string;
  createdAt: string;
  readByTutorAt?: string | null;
  readByParentAt?: string | null;
  readByStudentAt?: string | null;
}

interface CommunicationThread {
  threadId: string;
  audience: Audience;
  messages: CommunicationMessage[];
}

interface CommunicationBundle {
  student: { id: string; name: string; grade: string | null };
  parent: { id: string | null; name: string; available: boolean };
  tutor: { id: string; name: string } | null;
  threads: Record<Audience, CommunicationThread>;
}

interface StudentCommunicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  apiBasePath?: string;
  readOnly?: boolean;
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

function ThreadPanel({
  title,
  description,
  messages,
  composerValue,
  onComposerChange,
  replyTarget,
  onReply,
  onClearReply,
  onSend,
  isSending,
  readOnly,
  disabled,
}: {
  title: string;
  description: string;
  messages: CommunicationMessage[];
  composerValue: string;
  onComposerChange: (value: string) => void;
  replyTarget: CommunicationMessage | null;
  onReply: (message: CommunicationMessage) => void;
  onClearReply: () => void;
  onSend: () => void;
  isSending: boolean;
  readOnly: boolean;
  disabled?: boolean;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const firstUnreadMessageId = messages.find(
    (message) => message.senderRole !== "tutor" && !message.readByTutorAt
  )?.id;

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  return (
    <Card className="flex h-[68vh] min-h-[440px] flex-col overflow-hidden border border-border/60 bg-background shadow-sm">
      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto bg-muted/10 px-3 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
            <p>No messages yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isTutor = message.senderRole === "tutor";
              const touchStartRef = { current: null as { x: number; y: number } | null };

              return (
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
                  <div
                    className={`flex ${isTutor ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[75%] ${isTutor ? "items-end" : "items-start"} flex flex-col gap-1`}
                      onTouchStart={(event) => {
                        const touch = event.touches[0];
                        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                      }}
                      onTouchEnd={(event) => {
                        const start = touchStartRef.current;
                        const touch = event.changedTouches[0];
                        if (!start || !touch || readOnly) return;

                        const deltaX = touch.clientX - start.x;
                        const deltaY = Math.abs(touch.clientY - start.y);

                        if (deltaX > 64 && deltaY < 28) {
                          onReply(message);
                        }
                      }}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 shadow-sm ${
                          isTutor
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
                              isTutor
                                ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground"
                                : "border-primary/40 bg-muted/70 text-muted-foreground"
                            }`}
                          >
                            <p className="font-medium">{message.replyTo.senderName}</p>
                            <p className="line-clamp-2 whitespace-pre-wrap break-words">{message.replyTo.message}</p>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background px-3 py-3 sm:px-5">
        {readOnly ? (
          <p className="text-xs text-muted-foreground">Read-only COO view.</p>
        ) : (
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
                    onClick={onClearReply}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <Textarea
              value={composerValue}
              onChange={(e) => onComposerChange(e.target.value)}
              placeholder={
                replyTarget
                  ? `Reply to ${replyTarget.senderName}...`
                  : `Type a message for ${title.toLowerCase()}...`
              }
              className="min-h-[88px] resize-none"
              disabled={disabled || isSending}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Communication stays inside the platform.
              </p>
              <Button
                onClick={onSend}
                disabled={disabled || isSending || !composerValue.trim()}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function StudentCommunicationDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  apiBasePath = "/api/tutor",
  readOnly = false,
}: StudentCommunicationDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Audience>("parent");
  const [drafts, setDrafts] = useState<Record<Audience, string>>({
    parent: "",
    student: "",
  });
  const [replyTargets, setReplyTargets] = useState<Record<Audience, CommunicationMessage | null>>({
    parent: null,
    student: null,
  });

  const queryKey = useMemo(
    () => [apiBasePath, "students", studentId, "communications"],
    [apiBasePath, studentId]
  );

  const { data, isLoading, error } = useQuery<CommunicationBundle>({
    queryKey,
    enabled: open && !!studentId,
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiBasePath}/students/${studentId}/communications`);
      return res.json();
    },
  });

  useEffect(() => {
    if (open) {
      setActiveTab("parent");
    }
  }, [open]);

  const sendMessage = useMutation({
    mutationFn: async ({
      audience,
      message,
      replyToMessageId,
    }: {
      audience: Audience;
      message: string;
      replyToMessageId?: string | null;
    }) => {
      const res = await apiRequest("POST", `${apiBasePath}/students/${studentId}/communications`, {
        audience,
        message,
        replyToMessageId,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setDrafts((current) => ({ ...current, [variables.audience]: "" }));
      setReplyTargets((current) => ({ ...current, [variables.audience]: null }));
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const parentThread = data?.threads.parent;
  const studentThread = data?.threads.student;
  const parentUnavailable = data?.parent ? !data.parent.available : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-4 py-4 sm:px-6">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Response Integrity Communication
          </p>
          <DialogTitle>{studentName}</DialogTitle>
          <DialogDescription>
            Parent and student messaging stays inside the platform.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
            Loading communication threads...
          </div>
        ) : error || !data ? (
          <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Unable to load communication threads. If this feature was just deployed, the database migration may still need to be run."}
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as Audience)}
            className="p-3 sm:p-4"
          >
            <TabsList className="grid w-full grid-cols-2 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
              <TabsTrigger value="parent" className="text-xs sm:text-sm py-2 px-2">
                Parent
              </TabsTrigger>
              <TabsTrigger value="student" className="text-xs sm:text-sm py-2 px-2">
                Student
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parent" className="mt-4">
              <ThreadPanel
                title="Parent Chat"
                description={
                  parentUnavailable
                    ? "No parent account is currently linked to this student."
                    : `Messaging ${data.parent.name}`
                }
                messages={parentThread?.messages || []}
                composerValue={drafts.parent}
                onComposerChange={(value) => setDrafts((current) => ({ ...current, parent: value }))}
                replyTarget={replyTargets.parent}
                onReply={(message) =>
                  setReplyTargets((current) => ({ ...current, parent: message }))
                }
                onClearReply={() =>
                  setReplyTargets((current) => ({ ...current, parent: null }))
                }
                onSend={() =>
                  sendMessage.mutate({
                    audience: "parent",
                    message: drafts.parent.trim(),
                    replyToMessageId: replyTargets.parent?.id,
                  })
                }
                isSending={sendMessage.isPending && sendMessage.variables?.audience === "parent"}
                readOnly={readOnly}
                disabled={parentUnavailable}
              />
            </TabsContent>

            <TabsContent value="student" className="mt-4">
              <ThreadPanel
                title="Student Chat"
                description="Direct Response Integrity communication with the student."
                messages={studentThread?.messages || []}
                composerValue={drafts.student}
                onComposerChange={(value) =>
                  setDrafts((current) => ({ ...current, student: value }))
                }
                replyTarget={replyTargets.student}
                onReply={(message) =>
                  setReplyTargets((current) => ({ ...current, student: message }))
                }
                onClearReply={() =>
                  setReplyTargets((current) => ({ ...current, student: null }))
                }
                onSend={() =>
                  sendMessage.mutate({
                    audience: "student",
                    message: drafts.student.trim(),
                    replyToMessageId: replyTargets.student?.id,
                  })
                }
                isSending={sendMessage.isPending && sendMessage.variables?.audience === "student"}
                readOnly={readOnly}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
