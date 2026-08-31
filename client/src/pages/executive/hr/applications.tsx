import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExecutivePortalGuard } from "@/lib/portalGuard";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { CheckCircle2, Clock, XCircle, User, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { TutorApplication } from "@shared/schema";
import { format } from "date-fns";

const DOCUMENT_STEPS = 6;

function getField(app: any, newCamel: string, newSnake: string, oldCamel?: string, oldSnake?: string) {
  return app[newCamel] ?? (oldCamel ? app[oldCamel] : undefined) ?? app[newSnake] ?? (oldSnake ? app[oldSnake] : undefined);
}

function getDocumentsStatus(application: any) {
  return {
    "1": "not_started",
    "2": "not_started",
    "3": "not_started",
    "4": "not_started",
    "5": "not_started",
    "6": "not_started",
    ...(application?.documentsStatus || application?.documents_status || {}),
  } as Record<string, string>;
}

function countDocumentStatus(application: any, status: string) {
  const docs = getDocumentsStatus(application);
  return Object.values(docs).filter((value) => String(value || "").toLowerCase() === status.toLowerCase()).length;
}

function getOnboardingStep(application: any) {
  if (application?.onboardingCompletedAt || application?.onboarding_completed_at) {
    return DOCUMENT_STEPS;
  }
  const docs = getDocumentsStatus(application);
  for (let step = 1; step <= DOCUMENT_STEPS; step += 1) {
    if (String(docs[String(step)] || "") !== "approved") {
      return step;
    }
  }
  return DOCUMENT_STEPS;
}

function getOnboardingStatus(application: any) {
  if (application?.onboardingCompletedAt || application?.onboarding_completed_at) {
    return "Completed";
  }

  const pendingReview = countDocumentStatus(application, "pending_review");
  const pendingUpload = countDocumentStatus(application, "pending_upload");
  const approved = countDocumentStatus(application, "approved");

  if (pendingReview > 0) return `Pending review (${pendingReview})`;
  if (pendingUpload > 0) return `Awaiting upload (${pendingUpload})`;
  if (approved > 0) return `In progress (${approved}/${DOCUMENT_STEPS} approved)`;
  return "Not started";
}

function getAssignedPodName(application: any) {
  return getField(application, "assignedPodName", "assigned_pod_name", "podName", "pod_name");
}

export default function HRApplications() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedApplication, setSelectedApplication] = useState<TutorApplication | null>(null);

  // Fetch specialist applications - use the same endpoint as COO
  const { data: applications, isLoading: applicationsLoading } = useQuery<TutorApplication[]>({
    queryKey: ["/api/coo/tutor-applications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated && !!user,
  });

  if (authLoading) {
    return <div>Loading...</div>;
  }

  const userRole = user?.role;

  // Filter applications by status
  const pendingApplications = applications?.filter((app) => app.status === "pending") || [];
  const approvedApplications = applications?.filter((app) => app.status === "approved") || [];
  const rejectedApplications = applications?.filter((app) => app.status === "rejected") || [];

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  const ApplicationCard = ({ application, onViewDetails }: { application: TutorApplication; onViewDetails: () => void }) => {
    const app = application as any;
    const fullNames = app.fullName || app.full_name || app.fullNames || app.full_names;
    const email = app.email;
    const phoneNumber = app.phone || app.phone_number || app.phoneNumber;
    const age = app.age;
    const city = app.city;
    const currentStatus = app.currentSituation || app.current_situation || app.currentStatus || app.current_status || "N/A";
    const gradesEquipped = app.grades_equipped || app.gradesEquipped || [];
    const assignedPod = getAssignedPodName(app);
    const approvedDocCount = countDocumentStatus(app, "approved");
    const pendingUploadCount = countDocumentStatus(app, "pending_upload");
    const pendingReviewCount = countDocumentStatus(app, "pending_review");
    const onboardingStep = getOnboardingStep(app);
    const onboardingStatus = getOnboardingStatus(app);
    const uploadStatus = pendingUploadCount > 0 ? `${pendingUploadCount} pending upload` : pendingReviewCount > 0 ? `${pendingReviewCount} pending review` : "No pending uploads";

    return (
      <Card data-testid={`application-card-${application.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{fullNames}</CardTitle>
              <CardDescription>
                {email} • {phoneNumber}
              </CardDescription>
            </div>
            <Badge className={statusColors[application.status]}>{application.status.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Age</p>
              <p className="font-medium">{age}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{city}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Onboarding</p>
              <p className="font-medium">Step {onboardingStep} / {DOCUMENT_STEPS}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Uploads</p>
              <p className="font-medium">{uploadStatus}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Specialist onboarding</p>
              <p className="font-medium">{onboardingStatus}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pod assignment</p>
              <p className="font-medium">{assignedPod || "Not assigned"}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={onViewDetails}>
              <User className="w-4 h-4" />
              View Full Application
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ExecutivePortalGuard role={userRole}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Specialist Applications</h1>
          <p className="text-muted-foreground">Review specialist applications (read-only)</p>
        </div>

        {applicationsLoading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Loading applications...</p>
          </Card>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                Pending ({pendingApplications.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Approved ({approvedApplications.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="w-4 h-4" />
                Rejected ({rejectedApplications.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingApplications.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No pending applications</p>
                </Card>
              ) : (
                pendingApplications.map((application) => (
                  <ApplicationCard 
                    key={application.id} 
                    application={application} 
                    onViewDetails={() => setSelectedApplication(application)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedApplications.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No approved applications</p>
                </Card>
              ) : (
                approvedApplications.map((application) => (
                  <ApplicationCard 
                    key={application.id} 
                    application={application} 
                    onViewDetails={() => setSelectedApplication(application)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {rejectedApplications.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No rejected applications</p>
                </Card>
              ) : (
                rejectedApplications.map((application) => (
                  <ApplicationCard 
                    key={application.id} 
                    application={application} 
                    onViewDetails={() => setSelectedApplication(application)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Application Details Dialog */}
        {selectedApplication && (() => {
          const selectedName = getField(selectedApplication as any, "fullName", "full_name", "fullNames", "full_names");
          const submittedAt = format(new Date((selectedApplication as any).created_at || selectedApplication.createdAt), "PPP");
          return (
            <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedName}</DialogTitle>
                  <DialogDescription>Submitted on {submittedAt}</DialogDescription>
                </DialogHeader>
                <ApplicationDetails application={selectedApplication} />
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    </ExecutivePortalGuard>
  );
}

// Helper components for application details
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg border-b pb-2">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground text-sm">{label}:</span>
      <span className="col-span-2 text-sm">{value || "Not provided"}</span>
    </div>
  );
}

function getDocumentUploadRows(application: any) {
  const docs = getDocumentsStatus(application);
  return Array.from({ length: DOCUMENT_STEPS }, (_, index) => {
    const step = index + 1;
    const stepStatus = docs[String(step)] || "not_started";
    const uploadUrl = getField(application, `doc${step}SubmissionUrl`, `doc_${step}_submission_url`);
    const uploadedAt = getField(application, `doc${step}SubmissionUploadedAt`, `doc_${step}_submission_uploaded_at`);
    const verified = getField(application, `doc${step}SubmissionVerified`, `doc_${step}_submission_verified`);
    return {
      step,
      status: String(stepStatus),
      uploadUrl,
      uploadedAt,
      verified,
    };
  });
}

function ApplicationDetails({ application }: { application: TutorApplication }) {
  const app = application as any;
  const getField = (newCamel: string, newSnake: string, oldCamel?: string, oldSnake?: string) =>
    app[newCamel] ?? (oldCamel ? app[oldCamel] : undefined) ?? app[newSnake] ?? (oldSnake ? app[oldSnake] : undefined);

  const assignedPod = getAssignedPodName(app);
  const approvedDocCount = countDocumentStatus(app, "approved");
  const onboardingStep = getOnboardingStep(app);
  const onboardingStatus = getOnboardingStatus(app);
  const documentRows = getDocumentUploadRows(app);

  return (
    <div className="space-y-6">
      <Section title="HR Visibility">
        <InfoItem label="Assigned Pod" value={assignedPod || "Not assigned"} />
        <InfoItem label="Onboarding Status" value={onboardingStatus} />
        <InfoItem label="Document Progress" value={`${approvedDocCount} of ${DOCUMENT_STEPS} approved`} />
        <InfoItem label="Current Step" value={`Step ${onboardingStep} / ${DOCUMENT_STEPS}`} />
      </Section>

      <Section title="Document Uploads">
        {documentRows.map((doc) => (
          <div key={doc.step} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Step {doc.step}</p>
                <p className="text-xs text-muted-foreground">{doc.status.replace(/_/g, " ")}</p>
              </div>
              {doc.uploadUrl ? (
                <a
                  href={String(doc.uploadUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline underline-offset-2"
                >
                  View uploaded file
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">No upload</span>
              )}
            </div>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
              {doc.uploadedAt ? <p>Uploaded {format(new Date(doc.uploadedAt), "MMM d, yyyy")}</p> : null}
              {doc.verified != null ? <p>Verified: {doc.verified ? "Yes" : "No"}</p> : null}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Section 1 - Basic Information">
        <InfoItem label="Full Name" value={getField("fullName", "full_name", "fullNames", "full_names")} />
        <InfoItem label="Age" value={String(app.age ?? "")} />
        <InfoItem label="Email" value={app.email} />
        <InfoItem label="Phone" value={getField("phone", "phone", "phoneNumber", "phone_number")} />
        <InfoItem label="City" value={app.city} />
      </Section>

      <Section title="Section 2 - Academic Background">
        <InfoItem label="Completed Matric" value={getField("completedMatric", "completed_matric")} />
        <InfoItem label="Matric Year" value={getField("matricYear", "matric_year")} />
        <InfoItem label="Math Level" value={getField("mathLevel", "math_level")} />
        <InfoItem label="Math Result" value={getField("mathResult", "math_result")} />
        <InfoItem label="Other Subjects" value={getField("otherSubjects", "other_subjects")} />
      </Section>

      <Section title="Section 3 - Current Situation">
        <InfoItem label="Current Situation" value={(getField("currentSituation", "current_situation", "currentStatus", "current_status") || "").replace(/_/g, " ")} />
        <InfoItem label="Other (if applicable)" value={getField("currentSituationOther", "current_situation_other")} />
        <InfoItem label="Why interested?" value={getField("interestReason", "interest_reason")} />
      </Section>

      <Section title="Section 4 - Teaching & Communication">
        <InfoItem label="Helped someone before?" value={getField("helpedBefore", "helped_before")} />
        <InfoItem label="Explanation" value={getField("helpExplanation", "help_explanation")} />
        <InfoItem label="Student says 'I don't get this'" value={getField("studentDontGet", "student_dont_get")} />
      </Section>

      <Section title="Section 5 - Response Under Pressure">
        <InfoItem label="Pressure Story" value={getField("pressureStory", "pressure_story")} />
        <InfoItem label="Pressure Response" value={(getField("pressureResponse", "pressure_response") || []).join(", ")} />
        <InfoItem label="Panic Cause" value={getField("panicCause", "panic_cause")} />
      </Section>

      <Section title="Section 6 - Discipline & Responsibility">
        <InfoItem label="Discipline Reason" value={getField("disciplineReason", "discipline_reason")} />
        <InfoItem label="Repeat Mistake Response" value={getField("repeatMistakeResponse", "repeat_mistake_response")} />
      </Section>

      <Section title="Section 7 - Alignment With Response Integrity">
        <InfoItem label="Response Integrity Meaning" value={getField("ttMeaning", "tt_meaning")} />
        <InfoItem label="Structure Preference" value={getField("structurePreference", "structure_preference")} />
      </Section>

      <Section title="Section 8 - Availability">
        <InfoItem label="Hours Per Week" value={getField("hoursPerWeek", "hours_per_week")} />
        <InfoItem label="Available Afternoons?" value={getField("availableAfternoon", "available_afternoon", "bootcampAvailable", "bootcamp_available")} />
      </Section>

      <Section title="Section 9 - Final Filter">
        <InfoItem label="Why should you be considered?" value={getField("finalReason", "final_reason")} />
      </Section>

      <Section title="Section 10 - Commitment">
        <InfoItem label="Committed to training & protocols?" value={getField("commitment", "commitment", "commitToTrial", "commit_to_trial") === true ? "yes" : getField("commitment", "commitment", "commitToTrial", "commit_to_trial")} />
      </Section>
    </div>
  );
}
