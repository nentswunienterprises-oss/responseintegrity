import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Loader2 } from "lucide-react";
import { ISSUE_CATEGORIES, ISSUE_IMPACTS, type IssueCategory, type IssueImpact } from "@shared/issueReporting";

interface LogDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IssueForm {
  category: IssueCategory | "";
  title: string;
  locationHint: string;
  description: string;
  impact: IssueImpact | "";
  helpRequested: string;
}

const initialForm: IssueForm = {
  category: "",
  title: "",
  locationHint: "",
  description: "",
  impact: "",
  helpRequested: "",
};

const teamLabels = {
  technology: "Technology",
  operations: "Operations",
  people: "People",
} as const;

// Retain the component export while changing the intake from a dispute form to neutral reporting.
export function LogDisputeModal({ open, onOpenChange }: LogDisputeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<IssueForm>({ ...initialForm });

  const reportIssue = useMutation({
    mutationFn: async (data: IssueForm) => {
      if (!data.category || !data.impact) throw new Error("Select an issue category and impact.");
      const response = await apiRequest("POST", "/api/issues", {
        category: data.category,
        title: data.title.trim(),
        locationHint: data.locationHint.trim(),
        description: data.description.trim(),
        impact: data.impact,
        helpRequested: data.helpRequested.trim(),
      });
      return response.json() as Promise<{ id: string; ownerTeam: keyof typeof teamLabels }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues/mine"] });
      onOpenChange(false);
      setFormData({ ...initialForm });
      toast({
        title: "Issue logged",
        description: `Reference ${result.id.slice(0, 8)}. Routed to ${teamLabels[result.ownerTeam]} for review.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Issue not saved",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const wordCount = formData.description.trim().split(/\s+/).filter(Boolean).length;
  const category = ISSUE_CATEGORIES.find((item) => item.value === formData.category);
  const canSubmit =
    Boolean(formData.category && formData.impact) &&
    formData.title.trim().length >= 5 &&
    formData.description.trim().length >= 12 &&
    wordCount <= 300;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || reportIssue.isPending) return;
    reportIssue.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Log an Issue
          </DialogTitle>
          <DialogDescription>
            Report a technical problem, process gap, service concern or people issue.
            Share what you observed; no blame or named parties are required.
            Reports go to the responsible team, not a public feed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issue-category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData((current) => ({ ...current, category: value as IssueCategory }))}>
              <SelectTrigger id="issue-category">
                <SelectValue placeholder="What kind of issue is this?" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <div className="text-left">
                      <p>{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category && (
              <p className="text-xs text-muted-foreground">
                Review team: {teamLabels[category.team]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-title">Short summary *</Label>
            <Input
              id="issue-title"
              value={formData.title}
              onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
              maxLength={160}
              placeholder="e.g. Capability Check progress is missing"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-location">Where did you encounter it? (optional)</Label>
            <Input
              id="issue-location"
              value={formData.locationHint}
              onChange={(event) => setFormData((current) => ({ ...current, locationHint: event.target.value }))}
              maxLength={500}
              placeholder="Page, feature, device, or step"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-description">What happened? *</Label>
            <Textarea
              id="issue-description"
              value={formData.description}
              onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              placeholder="What did you observe? If relevant, what were you expecting to happen? Include an error message or steps to reproduce it."
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">{wordCount} / 300 words</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-impact">Impact *</Label>
            <Select value={formData.impact} onValueChange={(value) => setFormData((current) => ({ ...current, impact: value as IssueImpact }))}>
              <SelectTrigger id="issue-impact">
                <SelectValue placeholder="How is this affecting you?" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_IMPACTS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-help">What would help? (optional)</Label>
            <Textarea
              id="issue-help"
              value={formData.helpRequested}
              onChange={(event) => setFormData((current) => ({ ...current, helpRequested: event.target.value }))}
              maxLength={1000}
              placeholder="e.g. Restore access, check the saved evidence, clarify the process"
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Please don't include passwords, access tokens, or private student details.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={reportIssue.isPending || !canSubmit}>
              {reportIssue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Log Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
