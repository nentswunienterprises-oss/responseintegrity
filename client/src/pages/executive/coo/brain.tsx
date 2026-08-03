import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Extension } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, BookOpen, Expand, ExternalLink, FileText, Italic, Lightbulb, List, ListOrdered, Loader2, Plus, Quote, Upload } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ExecutiveCommandRhythmDashboard from "@/pages/executive/command-rhythm-dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BrainLibraryItem = {
  id: string;
  name: string;
  kind: "rich_text" | "pdf";
  content?: string | null;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const FONT_SIZE_OPTIONS = ["12", "14", "16", "18", "24", "32"] as const;
const DEFAULT_FONT_SIZE = "16";

function normalizeFontSizeValue(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace("px", "");
  return FONT_SIZE_OPTIONS.includes(normalized as (typeof FONT_SIZE_OPTIONS)[number])
    ? normalized
    : DEFAULT_FONT_SIZE;
}

const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => any }) =>
          chain()
            .setMark("textStyle", { fontSize: `${normalizeFontSizeValue(fontSize)}px` })
            .run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as Record<string, any>;
  },
});

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  const [currentFontSize, setCurrentFontSize] = useState(
    normalizeFontSizeValue(editor.getAttributes("textStyle")?.fontSize)
  );

  useEffect(() => {
    const syncFontSize = () => {
      setCurrentFontSize(normalizeFontSizeValue(editor.getAttributes("textStyle")?.fontSize));
    };

    syncFontSize();
    editor.on("selectionUpdate", syncFontSize);
    editor.on("transaction", syncFontSize);
    editor.on("update", syncFontSize);

    return () => {
      editor.off("selectionUpdate", syncFontSize);
      editor.off("transaction", syncFontSize);
      editor.off("update", syncFontSize);
    };
  }, [editor]);

  const currentFontSizeIndex = FONT_SIZE_OPTIONS.indexOf(currentFontSize as (typeof FONT_SIZE_OPTIONS)[number]);
  const shrinkTarget =
    FONT_SIZE_OPTIONS[Math.max(0, currentFontSizeIndex - 1)] || DEFAULT_FONT_SIZE;
  const enlargeTarget =
    FONT_SIZE_OPTIONS[Math.min(FONT_SIZE_OPTIONS.length - 1, currentFontSizeIndex + 1)] || DEFAULT_FONT_SIZE;

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-2">
      <Select
        value={currentFontSize}
        onValueChange={(value) => (editor.chain() as any).focus().setFontSize(value).run()}
      >
        <SelectTrigger className="h-8 w-[92px] bg-background text-xs">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={size}>
              {size}px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => (editor.chain() as any).focus().setFontSize(shrinkTarget).run()}
        className="h-8 px-2 text-xs"
      >
        A-
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => (editor.chain() as any).focus().setFontSize(enlargeTarget).run()}
        className="h-8 px-2 text-xs"
      >
        A+
      </Button>
      <div className="mx-1 w-px bg-border" />
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className="h-8 px-2"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="h-8 px-2"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <div className="mx-1 w-px bg-border" />
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className="h-8 px-2"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className="h-8 px-2"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <div className="mx-1 w-px bg-border" />
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("blockquote") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className="h-8 px-2"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <div className="mx-1 w-px bg-border" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          (editor.chain() as any).focus().unsetFontSize().run();
          editor.chain().focus().clearNodes().unsetAllMarks().run();
        }}
        className="h-8 px-2 text-xs"
      >
        Clear
      </Button>
    </div>
  );
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] || "" : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function COOBrain() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"library" | "contribution">("library");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[18rem] w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 prose-p:leading-7 prose-li:leading-7",
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
  }, [authLoading, isAuthenticated, toast]);

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery<BrainLibraryItem[]>({
    queryKey: ["/api/coo/brain/library"],
    enabled: isAuthenticated && !authLoading,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!items.length) {
      setSelectedItemId(null);
      setReaderOpen(false);
      return;
    }

    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    setReaderOpen(false);
  }, [selectedItemId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  const richTextCount = items.filter((item) => item.kind === "rich_text").length;
  const pdfCount = items.filter((item) => item.kind === "pdf").length;

  const resetRichTextComposer = () => {
    setDocumentName("");
    editor?.commands.clearContent();
  };

  const resetPdfUpload = () => {
    setPdfName("");
    setSelectedFile(null);
  };

  const createRichTextItem = useMutation({
    mutationFn: async () => {
      if (!documentName.trim()) {
        throw new Error("Name is required");
      }
      if (!editor?.getText().trim()) {
        throw new Error("Document content is required");
      }

      const response = await apiRequest("POST", "/api/coo/brain/library", {
        name: documentName.trim(),
        content: editor.getHTML(),
      });

      return response.json() as Promise<BrainLibraryItem>;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/brain/library"] });
      setSelectedItemId(item.id);
      setCreateDialogOpen(false);
      resetRichTextComposer();
      toast({
        title: "Library document created",
        description: `${item.name} is now available in the COO Library.`,
      });
    },
    onError: (mutationError) => {
      if (isUnauthorizedError(mutationError)) {
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
        title: "Unable to create document",
        description:
          mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadPdfItem = useMutation({
    mutationFn: async () => {
      if (!pdfName.trim()) {
        throw new Error("Name is required");
      }
      if (!selectedFile) {
        throw new Error("Choose a PDF before uploading");
      }

      const fileData = await readFileAsBase64(selectedFile);
      const response = await apiRequest("POST", "/api/coo/brain/library/upload-pdf", {
        name: pdfName.trim(),
        fileName: selectedFile.name,
        fileType: selectedFile.type || "application/pdf",
        fileData,
      });

      return response.json() as Promise<BrainLibraryItem>;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/brain/library"] });
      setSelectedItemId(item.id);
      setUploadDialogOpen(false);
      resetPdfUpload();
      toast({
        title: "PDF added to Library",
        description: `${item.name} is ready in the COO Library.`,
      });
    },
    onError: (mutationError) => {
      if (isUnauthorizedError(mutationError)) {
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
        title: "Unable to upload PDF",
        description:
          mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-14 w-full max-w-sm" />
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Skeleton className="h-[28rem] w-full" />
            <Skeleton className="h-[28rem] w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Card className="border-destructive/30 p-6">
          <h1 className="text-2xl font-bold tracking-tight">COO Brain</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The Library could not be loaded right now.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">COO Brain</h1>
                <p className="text-sm text-muted-foreground">
                  Central operating memory for named documents, PDFs, and formatted internal references.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{items.length} library items</Badge>
              <Badge variant="outline">{richTextCount} rich text</Badge>
              <Badge variant="outline">{pdfCount} PDFs</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open);
                if (!open) resetRichTextComposer();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Create Library document</DialogTitle>
                  <DialogDescription>
                    Paste and format branded internal copy, then save it under a clear name.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="brain-document-name">Document name</Label>
                    <Input
                      id="brain-document-name"
                      placeholder="e.g. Parent escalation response model"
                      value={documentName}
                      onChange={(event) => setDocumentName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Document body</Label>
                    <EditorToolbar editor={editor} />
                    <EditorContent editor={editor} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => createRichTextItem.mutate()} disabled={createRichTextItem.isPending}>
                    {createRichTextItem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save document
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={uploadDialogOpen}
              onOpenChange={(open) => {
                setUploadDialogOpen(open);
                if (!open) resetPdfUpload();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Add PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add PDF to Library</DialogTitle>
                  <DialogDescription>
                    Upload a named PDF so COO can open it directly from the Brain Library.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="brain-pdf-name">Document name</Label>
                    <Input
                      id="brain-pdf-name"
                      placeholder="e.g. Sandbox parent briefing pack"
                      value={pdfName}
                      onChange={(event) => setPdfName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brain-pdf-file">PDF file</Label>
                    <Input
                      id="brain-pdf-file"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Uploads are limited to PDF format and 25 MB.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => uploadPdfItem.mutate()} disabled={uploadPdfItem.isPending}>
                    {uploadPdfItem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Upload PDF
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-xl border border-primary/15 bg-muted/20 p-1">
            <TabsTrigger value="library" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="contribution" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Contribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <Card className="border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Library index</h2>
                    <p className="text-sm text-muted-foreground">Select a stored item to view it.</p>
                  </div>
                  <Badge variant="outline">{items.length}</Badge>
                </div>

                <div className="mt-4 space-y-2">
                  {!items.length ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No library items yet. Create a formatted document or upload a PDF to start this module.
                    </div>
                  ) : (
                    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => {
                        const isSelected = item.id === selectedItemId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{item.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.kind === "pdf" ? item.pdfFileName || "PDF upload" : "Rich text document"}
                                </p>
                              </div>
                              <Badge variant={item.kind === "pdf" ? "outline" : "default"} className="shrink-0">
                                {item.kind === "pdf" ? "PDF" : "Copy"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a") : "Saved recently"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border p-4 sm:p-6">
                {!selectedItem ? (
                  <div className="flex min-h-[32rem] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-6 text-center">
                    <BookOpen className="h-10 w-10 text-primary" />
                    <h2 className="mt-4 text-xl font-semibold">Library preview</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Select a document from the index, or add the first Library item from the actions above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{selectedItem.name}</h2>
                          <Badge variant={selectedItem.kind === "pdf" ? "outline" : "default"}>
                            {selectedItem.kind === "pdf" ? "PDF" : "Rich text"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {selectedItem.createdAt
                            ? `Added ${format(new Date(selectedItem.createdAt), "MMM d, yyyy 'at' h:mm a")}`
                            : "Saved in the COO Library"}
                        </p>
                      </div>

                      {selectedItem.kind === "pdf" && selectedItem.pdfUrl ? (
                        <Button asChild variant="outline" className="gap-2">
                          <a href={selectedItem.pdfUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Open PDF
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    {selectedItem.kind === "pdf" ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{selectedItem.pdfFileName || "Uploaded PDF"}</span>
                        </div>
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          PDF preview is not shown here. Open the file directly when you want to review it.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF8F4] p-4 sm:p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#1A1A1A]">Document reader</p>
                              <p className="text-sm text-[#6B5B52]">
                                Open this Library document in a dedicated reader, then close it when you are done.
                              </p>
                            </div>
                            <Button
                              type="button"
                              className="w-full bg-[#E63946] text-white hover:bg-[#cf2e3c] sm:w-auto"
                              onClick={() => setReaderOpen(true)}
                            >
                              <Expand className="mr-2 h-4 w-4" />
                              Open document reader
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          The rich-text body stays closed until the reader is opened.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contribution" className="space-y-6">
            <ExecutiveCommandRhythmDashboard hideTabs />
          </TabsContent>
        </Tabs>

        {selectedItem?.kind === "rich_text" ? (
          <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
            <DialogContent className="left-1/2 top-1/2 h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7D5C8] p-0 shadow-2xl sm:h-[88dvh] sm:w-[calc(100vw-3rem)]">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#FFF5ED] text-[#1A1A1A]">
                <DialogHeader className="shrink-0 border-b border-[#E7D5C8] bg-white px-4 py-4 text-left sm:px-6 sm:py-5">
                  <DialogTitle className="pr-8 text-xl sm:text-2xl">{selectedItem.name}</DialogTitle>
                  <p className="text-sm text-[#6B5B52]">
                    COO Library document
                    {selectedItem.createdAt
                      ? ` • Added ${format(new Date(selectedItem.createdAt), "MMM d, yyyy 'at' h:mm a")}`
                      : ""}
                  </p>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FFF5ED] px-3 py-4 touch-pan-y sm:px-6 sm:py-6">
                  <div className="mx-auto max-w-4xl rounded-2xl border border-[#E7D5C8] bg-white px-4 py-6 shadow-[0_18px_50px_rgba(230,57,70,0.08)] sm:px-10 sm:py-10">
                    <div className="border-b border-[#E7D5C8] pb-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E63946]">COO Brain</p>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl">{selectedItem.name}</h1>
                      <p className="mt-2 text-xs text-[#6B5B52] sm:text-sm">Library rich-text document</p>
                    </div>

                    <div
                      className="prose prose-sm sm:prose-base mt-6 max-w-none text-foreground prose-a:text-primary prose-blockquote:border-primary/35 prose-blockquote:text-foreground prose-headings:text-foreground prose-strong:text-foreground"
                      dangerouslySetInnerHTML={{ __html: selectedItem.content || "<p>No content stored.</p>" }}
                    />
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#E7D5C8] bg-white px-4 py-4 sm:px-6">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={() => setReaderOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
