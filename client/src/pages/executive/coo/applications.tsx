import { ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, Clock, Download, ExternalLink, FileCheck, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { buildAcceptedCopyHtml as buildStructuredEgpAcceptedCopyHtml } from "@/components/affiliate/SequentialAgreementAcceptance";

const defaultStatuses = {
  "1": "pending_upload",
  "2": "not_started",
  "3": "not_started",
  "4": "not_started",
  "5": "not_started",
};

const egpStepMeta: Record<number, { code: string; shortTitle: string }> = {
  1: { code: "Response Integrity-EGP-001", shortTitle: "EGP Agreement" },
  2: { code: "Response Integrity-EGP-002", shortTitle: "Non-Circumvention" },
  3: { code: "Response Integrity-EGP-003", shortTitle: "Confidentiality" },
  4: { code: "Response Integrity-EGP-004", shortTitle: "Representation" },
  5: { code: "Response Integrity-EGP-005", shortTitle: "Certified ID Copy" },
};

const egpDocumentTitles: Record<number, string> = {
  1: "Education Growth Partner Agreement",
  2: "Non-Circumvention & Non-Solicitation Agreement",
  3: "Confidentiality & System Protection Agreement",
  4: "Representation & Conduct Agreement",
};

function getEgpProgressLabel(step: number, status: string) {
  const normalized = String(status || "not_started");
  if (normalized === "approved") {
    return step === 5 ? "Approved" : "Accepted";
  }
  return normalized.replace(/_/g, " ");
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAcceptedAt(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function buildEgpAcceptedAgreementHtml(step: number, acceptance: any) {
  const formSnapshot = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
  return buildStructuredEgpAcceptedCopyHtml({
    document: {
      step,
      code: egpStepMeta[step].code,
      title: egpDocumentTitles[step] || egpStepMeta[step].shortTitle,
      version: String(acceptance?.documentVersion || acceptance?.document_version || "1"),
      requiresAcceptance: true,
      requiresUpload: false,
      mandatoryClauses: [],
      content: String(acceptance?.documentSnapshot || acceptance?.document_snapshot || ""),
      contentHash: String(acceptance?.documentChecksum || acceptance?.document_checksum || ""),
    },
    acceptance,
    formData: {
      legalName: String(acceptance?.typedFullName || acceptance?.typed_full_name || formSnapshot.legalName || ""),
      emailAddress: String(formSnapshot.emailAddress || ""),
      phoneNumber: String(formSnapshot.phoneNumber || ""),
      idNumber: String(formSnapshot.idNumber || ""),
      effectiveDate: String(formSnapshot.effectiveDate || ""),
    },
  });
}

export function COOAffiliateApplicationsPanel() {
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [docReviewReason, setDocReviewReason] = useState("");
  const [subTab, setSubTab] = useState("pending");

  const { data: applications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/coo/affiliate-applications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === "pending"),
    [applications]
  );
  const approvedApplications = useMemo(
    () => applications.filter((application) => application.status === "approved" || application.status === "confirmed"),
    [applications]
  );
  const rejectedApplications = useMemo(
    () => applications.filter((application) => application.status === "rejected"),
    [applications]
  );
  const reviewQueueApplications = useMemo(
    () =>
      approvedApplications.filter((application) => {
        const statuses = { ...defaultStatuses, ...(application.documents_status || application.documentsStatus || {}) };
        return statuses["5"] === "pending_review";
      }),
    [approvedApplications]
  );
  const waitingOnEgpApplications = useMemo(
    () =>
      approvedApplications.filter((application) => {
        const statuses = { ...defaultStatuses, ...(application.documents_status || application.documentsStatus || {}) };
        const allApproved = ["1", "2", "3", "4", "5"].every((step) => statuses[step] === "approved");
        return !allApproved && statuses["5"] !== "pending_review";
      }),
    [approvedApplications]
  );
  const completedApplications = useMemo(
    () =>
      approvedApplications.filter((application) => {
        const statuses = { ...defaultStatuses, ...(application.documents_status || application.documentsStatus || {}) };
        return ["1", "2", "3", "4", "5"].every((step) => statuses[step] === "approved");
      }),
    [approvedApplications]
  );

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      await apiRequest("POST", `/api/coo/affiliate-applications/${applicationId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/affiliate-applications"] });
      toast({ title: "Application approved", description: "The EGP can now complete the agreement flow." });
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error?.message || "Failed to approve application.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      await apiRequest("POST", `/api/coo/affiliate-applications/${applicationId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/affiliate-applications"] });
      toast({ title: "Application rejected", description: "The EGP application has been rejected." });
      setSelectedApplication(null);
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error?.message || "Failed to reject application.", variant: "destructive" });
    },
  });

  const reviewDocumentMutation = useMutation({
    mutationFn: async ({
      applicationId,
      approved,
      rejectionReason,
    }: {
      applicationId: string;
      approved: boolean;
      rejectionReason?: string;
    }) => {
      await apiRequest("POST", `/api/coo/affiliate-applications/${applicationId}/document/5/review`, {
        approved,
        rejectionReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/affiliate-applications"] });
      toast({ title: "Certified ID review saved", description: "The EGP step 5 status has been updated." });
      setDocReviewReason("");
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast({ title: "Review failed", description: error?.message || "Failed to review certified ID copy.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge className="bg-amber-100 text-amber-900">{pendingApplications.length} Pending</Badge>
      </div>

      {!isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-amber-800">Needs Review</p>
              <p className="mt-1 text-2xl font-semibold text-amber-950">{reviewQueueApplications.length}</p>
              <p className="text-xs text-amber-900/80">COO action required right now</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-700">Waiting On EGP</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{waitingOnEgpApplications.length}</p>
              <p className="text-xs text-slate-600">EGP still needs to upload or finish a step</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-green-800">Complete</p>
              <p className="mt-1 text-2xl font-semibold text-green-950">{completedApplications.length}</p>
              <p className="text-xs text-green-900/80">Ready for the next operational stage</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isLoading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading applications...</p>
        </Card>
      ) : null}

      {!isLoading ? (
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
            <TabsTrigger value="pending" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Pending</span>
              </span>
              {pendingApplications.length > 0 ? (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {pendingApplications.length > 99 ? "99+" : pendingApplications.length}
                </Badge>
              ) : (
                <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger value="rejected" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Rejected</span>
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{rejectedApplications.length}</span>
            </TabsTrigger>

            <TabsTrigger value="review-queue" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Needs Review</span>
              </span>
              {reviewQueueApplications.length > 0 ? (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {reviewQueueApplications.length > 99 ? "99+" : reviewQueueApplications.length}
                </Badge>
              ) : (
                <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger value="waiting-on-egp" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Waiting On EGP</span>
              </span>
              {waitingOnEgpApplications.length > 0 ? (
                <Badge className="h-5 min-w-5 bg-amber-100 px-1.5 text-[10px] text-amber-900 border border-amber-200">
                  {waitingOnEgpApplications.length > 99 ? "99+" : waitingOnEgpApplications.length}
                </Badge>
              ) : (
                <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger value="complete" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2 col-span-2 sm:col-span-1">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Complete</span>
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{completedApplications.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            <ApplicationSection title="Pending Review" applications={pendingApplications} onViewDetails={setSelectedApplication} empty="No pending EGP applications." />
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-4">
            <ApplicationSection title="Rejected" applications={rejectedApplications} onViewDetails={setSelectedApplication} empty="No rejected EGP applications." />
          </TabsContent>

          <TabsContent value="review-queue" className="space-y-4 mt-4">
            <ApplicationSection title="Needs COO Review" applications={reviewQueueApplications} onViewDetails={setSelectedApplication} empty="No EGP uploads currently need COO review." />
          </TabsContent>

          <TabsContent value="waiting-on-egp" className="space-y-4 mt-4">
            <ApplicationSection title="Waiting On EGP" applications={waitingOnEgpApplications} onViewDetails={setSelectedApplication} empty="No EGPs are currently waiting on their own onboarding action." />
          </TabsContent>

          <TabsContent value="complete" className="space-y-4 mt-4">
            {completedApplications.length === 0 ? (
              <Card className="p-12 text-center">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No completed EGP onboarding records yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {completedApplications.map((application) => (
                  <CompletedEgpApplicationCard
                    key={application.id}
                    application={application}
                    onViewDetails={() => setSelectedApplication(application)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {selectedApplication ? (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedApplication.full_name || selectedApplication.fullName}</DialogTitle>
              <DialogDescription>
                Submitted {format(new Date(selectedApplication.created_at || selectedApplication.createdAt), "PPP")}
              </DialogDescription>
            </DialogHeader>

            <AffiliateApplicationDetails application={selectedApplication} />

            {selectedApplication.status === "pending" ? (
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => approveMutation.mutate(selectedApplication.id)} disabled={approveMutation.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </DialogFooter>
            ) : null}

            {(selectedApplication.documents_status?.["5"] || selectedApplication.documentsStatus?.["5"]) === "pending_review" ? (
              <div className="space-y-4 rounded-2xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
                <div>
                  <p className="font-semibold">Response Integrity-EGP-005 review</p>
                  <p className="text-sm text-muted-foreground">Review the certified ID copy and approve or reject the upload.</p>
                </div>
                {selectedApplication.doc_5_submission_url ? (
                  <a
                    href={selectedApplication.doc_5_submission_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-[#9F1D2B] underline underline-offset-2"
                  >
                    Open certified ID copy
                  </a>
                ) : (
                  <p className="text-sm text-red-700">No certified ID upload URL was found for this step.</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="egp-doc-review-reason">Rejection reason</Label>
                  <Textarea
                    id="egp-doc-review-reason"
                    value={docReviewReason}
                    onChange={(event) => setDocReviewReason(event.target.value)}
                    rows={3}
                    placeholder="Required only if you reject the certified ID copy."
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    disabled={reviewDocumentMutation.isPending}
                    onClick={() => reviewDocumentMutation.mutate({ applicationId: selectedApplication.id, approved: true })}
                  >
                    {reviewDocumentMutation.isPending ? "Saving..." : "Approve ID Copy"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!docReviewReason.trim() || reviewDocumentMutation.isPending}
                    onClick={() =>
                      reviewDocumentMutation.mutate({
                        applicationId: selectedApplication.id,
                        approved: false,
                        rejectionReason: docReviewReason.trim(),
                      })
                    }
                  >
                    {reviewDocumentMutation.isPending ? "Saving..." : "Reject ID Copy"}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject EGP Application</DialogTitle>
            <DialogDescription>Provide a clear reason so the applicant understands the decision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="egp-rejection-reason">Reason</Label>
            <Textarea id="egp-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!selectedApplication || !rejectionReason.trim() || rejectMutation.isPending}
              onClick={() => selectedApplication && rejectMutation.mutate({ applicationId: selectedApplication.id, reason: rejectionReason.trim() })}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const tdQuestionPrompts: Array<{ key: string; label: string }> = [
  { key: "systemUnderstandingDifference", label: "Q1. What is the difference between teaching content and training response?" },
  { key: "studentFreezesBreak", label: "Q2. A student understands a topic but freezes during tests. What is actually broken?" },
  { key: "explainingBetterNotEnough", label: "Q3. Why is explaining better often not enough?" },
  { key: "supervisingTutorAction", label: "Q4. A tutor explains too much, helps too early, and avoids struggle. What do you do?" },
  { key: "frustrationResponse", label: "Q5. The tutor says \"I did not want the student to feel frustrated.\" How do you respond?" },
  { key: "adjustSystemAnswer", label: "Q6. Would you allow a tutor to adjust the system to suit their style? Why or why not?" },
  { key: "highToMediumCauses", label: "Q7. A student moves from High to Medium. What are 3 possible causes?" },
  { key: "highScoresNoImprovement", label: "Q8. A tutor gets high session scores but students are not improving long-term. What could be wrong?" },
  { key: "sharedTutorMistakeMeaning", label: "Q9. If multiple tutors show the same mistake, what does that indicate?" },
  { key: "correctOlderTutor", label: "Q10. You must correct someone older than you who is not following the system. How do you handle it?" },
  { key: "pushbackResponse", label: "Q11. A tutor disagrees with your correction and pushes back. What do you do?" },
  { key: "unpopularEnforcementCase", label: "Q12. Describe a situation where you had to enforce something unpopular. What happened?" },
  { key: "noRescueExplanation", label: "Q13. Explain in a structured way: \"Why must a student not be rescued during difficulty?\"" },
  { key: "moreDangerousTutor", label: "Q14. What is more dangerous: a weak tutor, or a slightly wrong tutor who seems good?" },
  { key: "systemDestructionFactors", label: "Q15. What would slowly destroy a system like Response Integrity over time?" },
  { key: "trustReason", label: "Q17. Why should you be trusted to protect a system like this?" },
];

const tdDefaultStatuses: Record<string, string> = {
  "1": "pending_upload",
  "2": "not_started",
  "3": "not_started",
  "4": "not_started",
  "5": "not_started",
  "6": "not_started",
  "7": "not_started",
};

const tdDocumentMeta: Array<{ step: number; code: string; title: string }> = [
  { step: 1, code: "Response Integrity-TDA-001", title: "Territory Director Contractor Agreement" },
  { step: 2, code: "Response Integrity-CEA-002", title: "Response Integrity-OS Compliance & Enforcement Agreement" },
  { step: 3, code: "Response Integrity-AID-003", title: "Audit Integrity Declaration" },
  { step: 4, code: "Response Integrity-HTQ-004", title: "HTQ Track Addendum" },
  { step: 5, code: "Response Integrity-PSA-005", title: "Performance Scorecard Acknowledgement" },
  { step: 6, code: "Response Integrity-CSP-006", title: "Confidentiality & System Protection Agreement" },
  { step: 7, code: "Response Integrity-TDI-007", title: "Certified Identification" },
];

function formatTdBooleanAnswer(value: unknown) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return value ? String(value) : "Not provided";
}

function getTdApplicationResponses(application: any) {
  return application.application_responses || application.applicationResponses || {};
}

function getTdDocumentsStatus(application: any) {
  return {
    ...tdDefaultStatuses,
    ...(application.documents_status || application.documentsStatus || {}),
  };
}

function getTdAcceptanceMap(application: any) {
  return application.onboardingAcceptanceMap || {};
}

function getTdCurrentStep(application: any) {
  const statuses = getTdDocumentsStatus(application);
  for (let step = 1; step <= 7; step += 1) {
    if (String(statuses[String(step)] || "not_started") !== "approved") {
      return step;
    }
  }
  return 7;
}

function isTdCompleted(application: any) {
  const statuses = getTdDocumentsStatus(application);
  const allApproved = tdDocumentMeta.every(({ step }) => String(statuses[String(step)] || "") === "approved");
  return allApproved || Boolean(application.onboarding_completed_at || application.onboardingCompletedAt);
}

function isTdWaitingOnApplicant(application: any) {
  return (application.status === "approved" || application.status === "confirmed") && !isTdCompleted(application);
}

function formatTdStepStatus(status: unknown) {
  return String(status || "not_started").replace(/_/g, " ");
}

function formatTdDateTime(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not available";
  return format(date, "PPP p");
}

export function COOTdApplicationsPanel() {
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [docReviewReason, setDocReviewReason] = useState("");
  const [subTab, setSubTab] = useState("pending");

  const { data: applications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/coo/td-applications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === "pending"),
    [applications]
  );
  const approvedApplications = useMemo(
    () => applications.filter((application) => application.status === "approved"),
    [applications]
  );
  const rejectedApplications = useMemo(
    () => applications.filter((application) => application.status === "rejected"),
    [applications]
  );
  const waitingOnTdApplications = useMemo(
    () => applications.filter((application) => isTdWaitingOnApplicant(application)),
    [applications]
  );
  const tdReviewQueueApplications = useMemo(
    () =>
      applications.filter((application) => {
        const statuses = getTdDocumentsStatus(application);
        return String(statuses["7"] || "") === "pending_review";
      }),
    [applications]
  );
  const completedApplications = useMemo(
    () => applications.filter((application) => isTdCompleted(application)),
    [applications]
  );

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      await apiRequest("POST", `/api/coo/td-applications/${applicationId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/td-applications"] });
      toast({ title: "Application approved", description: "The TD can now complete the onboarding flow." });
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error?.message || "Failed to approve application.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      await apiRequest("POST", `/api/coo/td-applications/${applicationId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/td-applications"] });
      toast({ title: "Application rejected", description: "The TD application has been rejected." });
      setSelectedApplication(null);
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error?.message || "Failed to reject application.", variant: "destructive" });
    },
  });

  const reviewDocumentMutation = useMutation({
    mutationFn: async ({
      applicationId,
      approved,
      rejectionReason,
    }: {
      applicationId: string;
      approved: boolean;
      rejectionReason?: string;
    }) => {
      await apiRequest("POST", `/api/coo/td-applications/${applicationId}/document/7/review`, {
        approved,
        rejectionReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/td-applications"] });
      toast({ title: "Identification review saved", description: "The TD identification step has been updated." });
      setDocReviewReason("");
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast({ title: "Review failed", description: error?.message || "Failed to review TD identification.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge className="bg-amber-100 text-amber-900">{pendingApplications.length} Pending</Badge>
      </div>

      {!isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-amber-800">Needs Review</p>
              <p className="mt-1 text-2xl font-semibold text-amber-950">{tdReviewQueueApplications.length}</p>
              <p className="text-xs text-amber-900/80">COO action required right now</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-700">Waiting On TD</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{waitingOnTdApplications.length}</p>
              <p className="text-xs text-slate-600">Approved but still moving through onboarding</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-green-800">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-green-950">{completedApplications.length}</p>
              <p className="text-xs text-green-900/80">All seven TD onboarding steps completed</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isLoading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading TD applications...</p>
        </Card>
      ) : null}

      {!isLoading ? (
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto rounded-xl border border-primary/15 bg-muted/20 p-1 gap-1">
            <TabsTrigger value="pending" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Pending</span>
              </span>
              {pendingApplications.length > 0 ? (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {pendingApplications.length > 99 ? "99+" : pendingApplications.length}
                </Badge>
              ) : (
                <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger value="waiting-on-td" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Waiting On TD</span>
              </span>
              {waitingOnTdApplications.length > 0 ? (
                <Badge className="h-5 min-w-5 bg-amber-100 px-1.5 text-[10px] text-amber-900 border border-amber-200">
                  {waitingOnTdApplications.length > 99 ? "99+" : waitingOnTdApplications.length}
                </Badge>
              ) : (
                <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger value="completed" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Completed</span>
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{completedApplications.length}</span>
            </TabsTrigger>

            <TabsTrigger value="rejected" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Rejected</span>
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{rejectedApplications.length}</span>
            </TabsTrigger>

            <TabsTrigger value="approved" className="text-xs sm:text-sm py-2 px-2 sm:px-3 justify-between sm:justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Approved</span>
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{approvedApplications.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            <ApplicationSection title="Pending TD Applications" applications={pendingApplications} onViewDetails={setSelectedApplication} empty="No pending TD applications." />
          </TabsContent>

          <TabsContent value="waiting-on-td" className="space-y-4 mt-4">
            <ApplicationSection title="Waiting On TD" applications={waitingOnTdApplications} onViewDetails={setSelectedApplication} empty="No approved TDs are currently mid-onboarding." />
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            <ApplicationSection title="Completed TD Onboarding" applications={completedApplications} onViewDetails={setSelectedApplication} empty="No TDs have completed onboarding yet." />
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            <ApplicationSection title="Approved TD Applications" applications={approvedApplications} onViewDetails={setSelectedApplication} empty="No approved TD applications." />
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-4">
            <ApplicationSection title="Rejected TD Applications" applications={rejectedApplications} onViewDetails={setSelectedApplication} empty="No rejected TD applications." />
          </TabsContent>
        </Tabs>
      ) : null}

      {selectedApplication ? (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedApplication.full_name || selectedApplication.fullName}</DialogTitle>
              <DialogDescription>
                Submitted {format(new Date(selectedApplication.created_at || selectedApplication.createdAt), "PPP")}
              </DialogDescription>
            </DialogHeader>

            <TdApplicationDetails application={selectedApplication} />

            {selectedApplication.status === "pending" ? (
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => approveMutation.mutate(selectedApplication.id)} disabled={approveMutation.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </DialogFooter>
            ) : null}

            {(selectedApplication.documents_status?.["7"] || selectedApplication.documentsStatus?.["7"]) === "pending_review" ? (
              <div className="space-y-4 rounded-2xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
                <div>
                  <p className="font-semibold">Response Integrity-TDI-007 review</p>
                  <p className="text-sm text-muted-foreground">Review the certified identification copy and approve or reject the upload.</p>
                </div>
                {selectedApplication.doc_7_submission_url ? (
                  <a
                    href={selectedApplication.doc_7_submission_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-[#9F1D2B] underline underline-offset-2"
                  >
                    Open certified identification copy
                  </a>
                ) : (
                  <p className="text-sm text-red-700">No identification upload URL was found for this step.</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="td-doc-review-reason">Rejection reason</Label>
                  <Textarea
                    id="td-doc-review-reason"
                    value={docReviewReason}
                    onChange={(event) => setDocReviewReason(event.target.value)}
                    rows={3}
                    placeholder="Required only if you reject the identification copy."
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    disabled={reviewDocumentMutation.isPending}
                    onClick={() => reviewDocumentMutation.mutate({ applicationId: selectedApplication.id, approved: true })}
                  >
                    {reviewDocumentMutation.isPending ? "Saving..." : "Approve Identification"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!docReviewReason.trim() || reviewDocumentMutation.isPending}
                    onClick={() =>
                      reviewDocumentMutation.mutate({
                        applicationId: selectedApplication.id,
                        approved: false,
                        rejectionReason: docReviewReason.trim(),
                      })
                    }
                  >
                    {reviewDocumentMutation.isPending ? "Saving..." : "Reject Identification"}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject TD Application</DialogTitle>
            <DialogDescription>Provide a clear reason so the applicant understands the decision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="td-rejection-reason">Reason</Label>
            <Textarea id="td-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!selectedApplication || !rejectionReason.trim() || rejectMutation.isPending}
              onClick={() => selectedApplication && rejectMutation.mutate({ applicationId: selectedApplication.id, reason: rejectionReason.trim() })}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function COOAffiliateApplications() {
  return <COOAffiliateApplicationsPanel />;
}

function ApplicationSection({
  title,
  applications,
  onViewDetails,
  empty,
}: {
  title: string;
  applications: any[];
  onViewDetails: (application: any) => void;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          applications.map((application) => (
            <div key={application.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{application.full_name || application.fullName}</p>
                  <p className="text-sm text-muted-foreground">{application.email}</p>
                  <p className="text-sm text-muted-foreground">{application.phone}</p>
                </div>
                <Button variant="outline" onClick={() => onViewDetails(application)}>
                  View Full Application
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AffiliateApplicationDetails({ application }: { application: any }) {
  const statuses = { ...defaultStatuses, ...(application.documents_status || application.documentsStatus || {}) };
  const questions = [
    ["Who exactly can you reach within the next 7 days?", application.reach_in_7_days || application.reachIn7Days],
    ["If you had to reach out to a few parents this week, who would come to mind first?", application.first_parents || application.firstParents],
    ["Think of a student you've seen or heard about who struggles with school. What exactly was happening with them?", application.student_breakdown_case || application.studentBreakdownCase],
    ['A parent says: "My child studies, but their marks don’t reflect it." What does this tell you?', application.marks_signal || application.marksSignal],
    ['A parent says: "We just want extra lessons to improve marks." How do you respond? Do you move forward or pause? Why?', application.extra_lessons_response || application.extraLessonsResponse],
    ["When would you NOT recommend a parent to Response Integrity?", application.not_recommend_cases || application.notRecommendCases],
    ["If a parent is interested, but you cannot clearly identify a real problem, what do you do?", application.unclear_problem_response || application.unclearProblemResponse],
    ["You speak to 10 parents. Only 2 clearly need help.", application.ten_parents_filter || application.tenParentsFilter],
    ["If you were speaking to a parent about their child’s academics, what would you want to understand first?", application.first_academic_question || application.firstAcademicQuestion],
    ["You haven’t earned anything in 2 weeks. What changes in your approach?", application.no_earnings_response || application.noEarningsResponse],
    ["In the next 5 days, how would you get 2–3 serious parent conversations?", application.next_five_days_plan || application.nextFiveDaysPlan],
    ["Do you still want to proceed? Why?", application.proceed_reason || application.proceedReason],
    ["Why should Response Integrity trust you with access to parents?", application.trust_reason || application.trustReason],
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Core Details</h3>
        <InfoItem label="Full name" value={application.full_name || application.fullName} />
        <InfoItem label="ID number" value={application.id_number || application.idNumber} />
        <InfoItem label="Email" value={application.email} />
        <InfoItem label="Phone" value={application.phone} />
        <InfoItem label="Status" value={application.status} />
      </section>

      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Application Answers</h3>
        <div className="space-y-4">
          {questions.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
              <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#5A5A5A]">{value || "Not provided"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="border-b pb-2 text-lg font-semibold">Agreement Progress</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{egpStepMeta[step].code}</span>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">{egpStepMeta[step].shortTitle}</p>
              <p className="text-sm text-muted-foreground">{getEgpProgressLabel(step, String(statuses[String(step)] || "not_started"))}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Step 5 Evidence</h3>
        <InfoItem
          label="Certified ID copy"
          value={
            application.doc_5_submission_url ? (
              <a href={application.doc_5_submission_url} target="_blank" rel="noreferrer" className="text-[#9F1D2B] underline underline-offset-2">
                Open uploaded file
              </a>
            ) : "Not uploaded"
          }
        />
        <InfoItem label="Step 5 rejection reason" value={application.doc_5_submission_rejection_reason || "None"} />
      </section>
    </div>
  );
}

function TdApplicationDetails({ application }: { application: any }) {
  const responses = getTdApplicationResponses(application);
  const statuses = getTdDocumentsStatus(application);
  const acceptanceMap = getTdAcceptanceMap(application);
  const currentStep = getTdCurrentStep(application);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Core Details</h3>
        <InfoItem label="Full name" value={application.full_name || application.fullName} />
        <InfoItem label="Age" value={application.age} />
        <InfoItem label="City" value={application.city} />
        <InfoItem label="Email" value={application.email} />
        <InfoItem label="Phone" value={application.phone} />
        <InfoItem label="Identification type" value={application.id_type || application.idType || "Not provided"} />
        <InfoItem label="Identification number" value={application.id_number || application.idNumber || "Not provided"} />
        <InfoItem label="Date of birth" value={application.date_of_birth || application.dateOfBirth || "Not provided"} />
        <InfoItem label="Hours available per week" value={application.hours_available_per_week || application.hoursAvailablePerWeek} />
        <InfoItem label="Taught or mentored before" value={formatTdBooleanAnswer(application.taught_or_mentored_before || application.taughtOrMentoredBefore)} />
        <InfoItem label="Led or supervised others" value={formatTdBooleanAnswer(application.led_or_supervised_others || application.ledOrSupervisedOthers)} />
        <InfoItem label="Commitment to strict standard" value={formatTdBooleanAnswer(responses.commitmentToStandard)} />
        <InfoItem label="Status" value={application.status} />
        <InfoItem label="Current onboarding step" value={isTdCompleted(application) ? "Complete" : `Step ${currentStep} of 7`} />
        <InfoItem label="Onboarding completed at" value={formatTdDateTime(application.onboarding_completed_at || application.onboardingCompletedAt)} />
        {application.rejection_reason ? <InfoItem label="Rejection reason" value={application.rejection_reason} /> : null}
      </section>

      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Onboarding Progress</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {tdDocumentMeta.map((document) => {
            const status = statuses[String(document.step)];
            const acceptance = acceptanceMap[String(document.step)];
            const documentFileUrl = document.step === 7 ? (application.doc_7_submission_url || application.doc7SubmissionUrl) : null;
            return (
              <div key={document.step} className="rounded-xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{document.code}</p>
                    <p className="mt-1 text-sm text-[#5A5A5A]">{document.title}</p>
                  </div>
                  <Badge variant={status === "approved" ? "default" : "secondary"}>
                    {formatTdStepStatus(status)}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[#6B5B52]">
                  <p>Step {document.step} of 7</p>
                  <p>Accepted at: {formatTdDateTime(acceptance?.accepted_at || acceptance?.acceptedAt)}</p>
                  <p>Accepted by: {acceptance?.typed_full_name || acceptance?.typedFullName || "Not yet accepted"}</p>
                  {documentFileUrl ? (
                    <p>
                      File: <a href={String(documentFileUrl)} target="_blank" rel="noreferrer" className="text-[#9F1D2B] underline underline-offset-2">Open upload</a>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Evidence Tracking</h3>
        <div className="space-y-4">
          {tdDocumentMeta.map((document) => {
            const acceptance = acceptanceMap[String(document.step)];
            if (!acceptance) {
              return (
                <div key={document.step} className="rounded-xl border p-4">
                  <p className="font-semibold">{document.code} evidence</p>
                  <p className="mt-2 text-sm text-muted-foreground">No acceptance receipt recorded yet.</p>
                </div>
              );
            }

            const acceptedClauses = acceptance.accepted_clauses_json || acceptance.acceptedClausesJson || [];
            return (
              <div key={document.step} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{document.code} evidence</p>
                    <p className="text-sm text-muted-foreground">{document.title}</p>
                  </div>
                  <Badge>Accepted</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoItem label="Accepted at" value={formatTdDateTime(acceptance.accepted_at || acceptance.acceptedAt)} />
                  <InfoItem label="Typed full name" value={acceptance.typed_full_name || acceptance.typedFullName || "Not available"} />
                  <InfoItem label="Timezone" value={acceptance.accepted_timezone || acceptance.acceptedTimezone || "Not available"} />
                  <InfoItem label="Platform" value={acceptance.platform || "Not available"} />
                  <InfoItem label="Locale" value={acceptance.locale || "Not available"} />
                  <InfoItem label="Source flow" value={acceptance.source_flow || acceptance.sourceFlow || "Not available"} />
                  <InfoItem label="Device type" value={acceptance.device_type || acceptance.deviceType || "Not available"} />
                  <InfoItem label="User agent" value={acceptance.user_agent || acceptance.userAgent || "Not available"} multiline />
                  <InfoItem label="Document version" value={acceptance.document_version || acceptance.documentVersion || "Not available"} />
                  <InfoItem label="Checksum" value={acceptance.document_checksum || acceptance.documentChecksum || "Not available"} multiline />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold">Accepted clauses</p>
                  {Array.isArray(acceptedClauses) && acceptedClauses.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {acceptedClauses.map((clause: string) => (
                        <Badge key={clause} variant="secondary">{clause}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No clause acknowledgements recorded.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="border-b pb-2 text-lg font-semibold">Application Answers</h3>
        <div className="space-y-4">
          {tdQuestionPrompts.map(({ key, label }) => (
            <div key={key} className="rounded-xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
              <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#5A5A5A]">{responses[key] || "Not provided"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoItem({ label, value, multiline = false }: { label: string; value: ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid gap-2 ${multiline ? "grid-cols-1" : "grid-cols-3"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${multiline ? "" : "col-span-2"}`}>{value || "Not provided"}</span>
    </div>
  );
}

function CompletedEgpApplicationCard({
  application,
  onViewDetails,
}: {
  application: any;
  onViewDetails: () => void;
}) {
  const statuses = { ...defaultStatuses, ...(application.documents_status || application.documentsStatus || {}) };
  const completedAt = application.onboarding_completed_at || application.onboardingCompletedAt || application.updated_at || application.updatedAt;
  const acceptanceMap = application.onboardingAcceptanceMap || {};
  const downloadAcceptedAgreement = (step: number) => {
    const acceptance = acceptanceMap[String(step)];
    if (!acceptance) return;
    const html = buildEgpAcceptedAgreementHtml(step, acceptance);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${egpStepMeta[step].code}-accepted-copy.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border border-emerald-200 bg-emerald-50/40">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <span>{application.full_name || application.fullName}</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {application.email} | {application.phone}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-200">Onboarding Complete</Badge>
            <Badge variant="outline">
              Completed {completedAt ? format(new Date(completedAt), "PPP") : "Not available"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="rounded-xl border border-emerald-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-800">{egpStepMeta[step].code}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">{getEgpProgressLabel(step, String(statuses[String(step)] || "not_started"))}</p>
              <p className="mt-1 text-xs text-muted-foreground">{egpStepMeta[step].shortTitle}</p>
            </div>
          ))}
        </div>

        <details className="rounded-xl border border-emerald-200 bg-white p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <div>
                <p className="font-medium text-emerald-950">Evidence</p>
                <p className="text-sm text-muted-foreground">Accepted agreements, timestamps, and uploaded proof.</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((step) => {
              const acceptance = acceptanceMap[String(step)];
              const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at;
              return (
                <div key={step} className="rounded-lg border p-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{egpStepMeta[step].code}</p>
                      <Badge className="bg-green-100 text-green-800 border-green-200">Accepted</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{egpStepMeta[step].shortTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Accepted {formatAcceptedAt(acceptedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version {String(acceptance?.documentVersion || acceptance?.document_version || "1")} • Hash {String(acceptance?.documentChecksum || acceptance?.document_checksum || "").slice(0, 16)}...
                    </p>
                    <div className="pt-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => downloadAcceptedAgreement(step)}>
                        <Download className="mr-2 h-3 w-3" />
                        Download accepted copy
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border p-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Response Integrity-EGP-005</p>
                  <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Certified ID Copy</p>
                {application.doc_5_submission_uploaded_at ? (
                  <p className="text-xs text-muted-foreground">Uploaded {formatAcceptedAt(application.doc_5_submission_uploaded_at)}</p>
                ) : null}
                {application.doc_5_submission_reviewed_at ? (
                  <p className="text-xs text-muted-foreground">Approved {formatAcceptedAt(application.doc_5_submission_reviewed_at)}</p>
                ) : null}
                {application.doc_5_submission_url ? (
                  <a
                    href={application.doc_5_submission_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open certified ID copy
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">No file URL available.</p>
                )}
              </div>
            </div>
          </div>
        </details>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Full five-step EGP onboarding is complete, including COO approval of the certified ID copy.
        </div>
        <Button variant="outline" onClick={onViewDetails}>
          View Full Application
        </Button>
      </CardContent>
    </Card>
  );
}
