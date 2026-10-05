import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Bold, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

// Rich text editor toolbar component
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-3 sm:mb-4 p-1.5 sm:p-2 border rounded-lg bg-muted/50">
      <Button
        size="sm"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2"
      >
        <Bold className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
      <Button
        size="sm"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2"
      >
        <Italic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
      <div className="w-px bg-border mx-0.5 sm:mx-1" />
      <Button
        size="sm"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2"
      >
        <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
      <Button
        size="sm"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2"
      >
        <ListOrdered className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
      <div className="w-px bg-border mx-0.5 sm:mx-1" />
      <Button
        size="sm"
        variant={editor.isActive("blockquote") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2"
      >
        <Quote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
      <div className="w-px bg-border mx-0.5 sm:mx-1" />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => editor.chain().focus().clearNodes().run()}
        className="h-7 sm:h-8 px-1.5 sm:px-2 text-xs"
      >
        Clear
      </Button>
    </div>
  );
}

export default function COOBroadcast() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState("all");

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert min-h-48 max-h-96 w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-y-auto",
      },
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const sendBroadcast = useMutation({
    mutationFn: async (data: { subject: string; message: string; visibility: string }) => {
      await apiRequest("POST", "/api/coo/broadcast", {
        subject: data.subject,
        message: data.message,
        visibility: data.visibility,
        senderRole: "coo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      setSubject("");
      editor?.commands.clearContent();
      setVisibility("all");
      toast({
        title: "Broadcast sent",
        description: "Your message has been sent to the selected audience.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send broadcast. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a subject.",
        variant: "destructive",
      });
      return;
    }
    if (!editor?.getText().trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }
    const htmlContent = editor?.getHTML() || "";
    sendBroadcast.mutate({ subject: subject.trim(), message: htmlContent, visibility });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Broadcast Message</h1>

        <Card className="p-4 sm:p-6 border">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base sm:text-lg">Send System-Wide Update</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Communicate important updates with rich formatting
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Audience *</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger data-testid="select-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone (All users)</SelectItem>
                  <SelectItem value="tutors">Specialists Only</SelectItem>
                  <SelectItem value="tds">Territory Directors Only</SelectItem>
                  <SelectItem value="parents">Parents Only</SelectItem>
                  <SelectItem value="students">Students Only</SelectItem>
                  <SelectItem value="affiliates">Affiliates Only</SelectItem>
                  <SelectItem value="od">Outreach Directors Only</SelectItem>
                  <SelectItem value="hr">HR Only</SelectItem>
                  <SelectItem value="ceo">CEO Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <input
                id="subject"
                type="text"
                placeholder="Enter broadcast subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                data-testid="input-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message * (with formatting)</Label>
              <EditorToolbar editor={editor} />
              <EditorContent editor={editor} data-testid="input-message" />
              <p className="text-xs text-muted-foreground mt-2">
                This message will be visible to{" "}
                {visibility === "all"
                  ? "all users"
                  : visibility === "tutors"
                  ? "all Specialists"
                  : visibility === "tds"
                  ? "all territory directors"
                  : visibility === "parents"
                  ? "all parents"
                  : visibility === "students"
                  ? "all students"
                  : visibility === "affiliates"
                  ? "all affiliates"
                  : visibility === "od"
                  ? "all outreach directors"
                  : visibility === "hr"
                  ? "all HR staff"
                  : visibility === "ceo"
                  ? "the CEO"
                  : "selected users"}
                .
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={sendBroadcast.isPending}
              data-testid="button-send-broadcast"
            >
              <Send className="w-4 h-4" />
              {sendBroadcast.isPending ? "Sending..." : "Send Broadcast"}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
