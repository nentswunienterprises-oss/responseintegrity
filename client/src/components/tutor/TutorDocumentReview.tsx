import React, { ReactNode, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import { CheckCircle2, ChevronDown, Download, ExternalLink, FileCheck, Loader2, ShieldCheck, XCircle } from "lucide-react";

interface TutorDocumentReviewProps {
  application: any;
  onReview?: () => void;
}

type DocumentStatus =
  | "not_started"
  | "pending_upload"
  | "pending_review"
  | "approved"
  | "rejected";

const AGREEMENT_STEPS = [
  { step: 1, code: "Response Integrity-TCF-001", title: "Specialist Consent Form" },
  { step: 2, code: "Response Integrity-EQV-002", title: "Entry Qualification Verification" },
  { step: 3, code: "Response Integrity-ICA-003", title: "Specialist Independent Contractor Agreement" },
  { step: 4, code: "Response Integrity-SCP-004", title: "Specialist Safeguarding and Conduct Policy" },
  { step: 5, code: "Response Integrity-DPC-005", title: "Data Protection / POPIA Consent" },
] as const;

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDisplayedVersion(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "1";
  if (/^Response Integrity-[A-Z]+-\d{3}$/i.test(normalized)) return "1";
  return normalized;
}

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

function formatAcceptedAt(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function normalizeIdTypeChoice(value: unknown): "sa_id" | "passport" | "" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "sa_id" || normalized === "passport") return normalized;
  return "";
}

function getIdentificationNumberLabel(idType: string): string {
  if (idType === "passport") return "Passport Number";
  if (idType === "sa_id") return "SA ID Number";
  return "Identification Number";
}

function getReviewFormFieldLabel(key: string, idType: string): string {
  if (key === "idNumber") return getIdentificationNumberLabel(idType);
  if (key === "idType") return "Identification Type";
  if (key === "legalName") return "Full Legal Name";
  if (key === "dateOfBirth") return "Date of Birth";
  if (key === "emailAddress") return "Email Address";
  if (key === "phoneNumber") return "Phone Number";
  if (key === "schoolName") return "School Name";
  if (key === "currentStatus") return "Current Status";
  if (key === "matricYear") return "Matric Year";
  if (key === "examNumber") return "Exam Number";
  return key;
}

function getReviewFormFieldValue(key: string, value: unknown): string {
  if (key === "idType") {
    const normalized = normalizeIdTypeChoice(value);
    if (normalized === "passport") return "Passport";
    if (normalized === "sa_id") return "SA ID";
  }
  return String(value ?? "").trim();
}

function TutorAgreementList({ items, tone = "default" }: { items: ReactNode[]; tone?: "default" | "check" }) {
  return (
    <ul className={`tt-agreement-list ${tone === "check" ? "tt-agreement-list-check" : ""}`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function TutorAgreementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tt-agreement-section">
      <h2>{title}</h2>
      <div className="tt-agreement-section-body">{children}</div>
    </section>
  );
}

function TutorAgreementSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tt-agreement-subsection">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function buildTutorAgreementBody(code: string, formData: Record<string, string>) {
  switch (code) {
    case "Response Integrity-TCF-001":
      return (
        <>
          <TutorAgreementSection title="Contractor Details">
            <div className="tt-inline-detail-grid">
              <div><span>Full Name</span><strong>{formData.legalName || "Not captured"}</strong></div>
              <div><span>Contact Number</span><strong>{formData.phoneNumber || "Not captured"}</strong></div>
              <div><span>Date of Birth</span><strong>{formData.dateOfBirth || "Not captured"}</strong></div>
              <div><span>Email Address</span><strong>{formData.emailAddress || "Not captured"}</strong></div>
              <div><span>{getIdentificationNumberLabel(formData.idType)}</span><strong>{formData.idNumber || "Not captured"}</strong></div>
              <div><span>School Attended (Matric)</span><strong>{formData.schoolName || "Not captured"}</strong></div>
              <div className="tt-inline-detail-span"><span>Current Status</span><strong>{formData.currentStatus || "Not captured"}</strong></div>
            </div>
          </TutorAgreementSection>
          <TutorAgreementSection title="Specialist Development Pathway And Role">
            <p>Response Integrity is not a tutoring service. It is a response-conditioning system delivered through mathematics.</p>
            <p>The purpose of every session is to build reliable learner response under difficulty through phase-appropriate instruction, practice, correction, and pressure progression.</p>
            <p>The Contractor operates as a Response Integrity Specialist: a response-conditioning operator responsible for stabilizing learner execution under pressure.</p>
            <p>Every session is executed strictly under Response Integrity-OS. The required structure depends on the learner&apos;s diagnosed phase, assigned drill, and current stability state.</p>
            <TutorAgreementList items={[
              <><strong>Clarity and concept-entry work:</strong> Use Model -&gt; Apply -&gt; Guide to build recognition, method understanding, and first-step execution</>,
              <><strong>Later conditioning phases:</strong> Prioritize independent execution, controlled friction, pressure exposure, stability checks, and accurate logging</>,
              <><strong>Non-negotiable restraint:</strong> Do not over-model, over-guide, rescue, or turn conditioning sessions into ordinary lessons</>,
            ]} />
            <p>Specialist progression is structured through application, onboarding, training, Battle Tests, Sandbox, Trial, and Certified Live operation. Certification is not automatic and requires demonstrated execution integrity before live responsibility.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Evidence Integrity">
            <p>The Contractor must record observable facts rather than invented psychological interpretations, and may not falsify, soften, exaggerate, or manufacture observations.</p>
            <p>Evidence must remain valid for progression, reporting, audit, and parent-facing claims.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Payment And Recording">
            <p>Payment is earned per eligible completed session and calculated and released on the relevant package completion payout schedule.</p>
            <p>Sessions may be recorded and stored where required for compliance, quality control, and system integrity.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Acceptance">
            <TutorAgreementList tone="check" items={[
              "They have read and understood this document in full",
              "They accept all operational, structural, and performance requirements",
              "They agree to operate strictly within the system",
              "They understand that deviation results in removal from the system",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-EQV-002":
      return (
        <>
          <TutorAgreementSection title="Contractor Details">
            <div className="tt-inline-detail-grid">
              <div><span>Full Name</span><strong>{formData.legalName || "Not captured"}</strong></div>
              <div><span>Date of Birth</span><strong>{formData.dateOfBirth || "Not captured"}</strong></div>
              <div><span>{getIdentificationNumberLabel(formData.idType)}</span><strong>{formData.idNumber || "Not captured"}</strong></div>
              <div><span>Contact Number</span><strong>{formData.phoneNumber || "Not captured"}</strong></div>
              <div><span>Email Address</span><strong>{formData.emailAddress || "Not captured"}</strong></div>
              <div><span>Matric Year</span><strong>{formData.matricYear || "Not captured"}</strong></div>
              <div className="tt-inline-detail-span"><span>School Where Matric Was Completed</span><strong>{formData.schoolName || "Not captured"}</strong></div>
            </div>
          </TutorAgreementSection>
          <TutorAgreementSection title="Matric Certificate Submission">
            <p>The Contractor must submit a certified copy of their official National Senior Certificate issued by the Department of Basic Education.</p>
            <TutorAgreementList items={["Uncertified copies", "Screenshots", "Altered or incomplete documents"]} />
          </TutorAgreementSection>
          <TutorAgreementSection title="Entry Qualification And Onboarding Acknowledgements">
            <TutorAgreementList items={[
              "Matric completion is required for entry into Specialist onboarding.",
              "Applicants must be 18 years or older unless they completed Matric early and can submit the required certified certificate.",
              "This verification confirms entry eligibility only.",
              "Continued participation is governed by conduct, session execution, adherence to the Response Integrity-OS, and operational performance within the platform.",
              "No further academic submissions or qualification reviews are required after this verification.",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-ICA-003":
      return (
        <>
          <TutorAgreementSection title="Nature Of Relationship">
            <p>The Contractor is engaged as an independent contractor. Nothing in this Agreement creates employment, partnership, joint venture, or agency.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Business Model Acknowledgement">
            <p>Response Integrity is a response-conditioning system delivered through mathematics. The Contractor operates within the system, not personal teaching style.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Payment Structure">
            <p>The Contractor earns per eligible completed session. Payment is calculated and released according to the relevant package completion payout schedule.</p>
            <p>Payment is conditional on package completion payout timing, Response Integrity-OS compliance, accurate reporting, and evidence integrity.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Evidence Integrity">
            <p>Session observations are not casual notes. They may feed learner progression, internal audit, operational decisions, and reports to parents or guardians.</p>
            <p>The Contractor must record what occurred, not what they assume occurred, and may not falsify, soften, exaggerate, or manufacture evidence.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Acceptance">
            <TutorAgreementList tone="check" items={[
              "Full understanding of this Agreement",
              "Acceptance of Response Integrity's system and control",
              "Agreement to operate strictly within Response Integrity",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-SCP-004":
      return (
        <>
          <TutorAgreementSection title="Core Principle">
            <p>All Specialist conduct must remain professional, structured, and bounded to the session environment.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Recording">
            <p>Sessions may be recorded where required and reviewed for safeguarding, compliance, and quality control.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Platform-Only Interaction">
            <TutorAgreementList items={[
              "Private messaging with learners is prohibited",
              "External-platform contact is prohibited",
              "Direct communication with parents outside approved channels is prohibited",
            ]} />
          </TutorAgreementSection>
          <TutorAgreementSection title="Zero-Tolerance Conduct">
            <TutorAgreementList items={[
              "Inappropriate or suggestive communication",
              "Harassment, intimidation, or discrimination",
              "Sharing personal contact information",
              "Attempting to meet learners physically",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-DPC-005":
      return (
        <>
          <TutorAgreementSection title="Purpose">
            <p>This agreement records consent for the collection, processing, storage, and use of personal and performance data within the Response Integrity platform.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Types Of Data Collected">
            <TutorAgreementSubsection title="Personal Information">
              <TutorAgreementList items={["Full name", "Contact details", "Identification details", "Bank account details for payment processing only", "Signed consent and contractual documentation"]} />
            </TutorAgreementSubsection>
            <TutorAgreementSubsection title="Session Data">
              <TutorAgreementList items={["Video and audio recordings where required", "Specialist observations and reports", "Interaction logs within the platform"]} />
            </TutorAgreementSubsection>
          </TutorAgreementSection>
          <TutorAgreementSection title="Consent Acknowledgement">
            <TutorAgreementList tone="check" items={[
              "Understanding of the data collected and its purpose",
              "Consent to full session recording where required",
              "Acceptance of data processing as required by the system",
            ]} />
          </TutorAgreementSection>
        </>
      );
    default:
      return <p>No structured agreement template available.</p>;
  }
}

function buildAcceptedAgreementHtml(item: { code: string; title: string }, acceptance: any) {
  const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at || "";
  const acceptedName = acceptance?.typedFullName || acceptance?.typed_full_name || "Unknown";
  const documentVersion = normalizeDisplayedVersion(acceptance?.documentVersion || acceptance?.document_version || "1");
  const documentChecksum = acceptance?.documentChecksum || acceptance?.document_checksum || "";
  const formSnapshot = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
  const idType = normalizeIdTypeChoice(formSnapshot.idType);
  const acceptedClauses = acceptance?.acceptedClausesJson || acceptance?.accepted_clauses_json || [];

  const formRows = Object.entries(formSnapshot)
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => {
      const displayValue = getReviewFormFieldValue(key, value);
      if (!displayValue) return "";
      return `<tr><th>${escapeHtml(getReviewFormFieldLabel(key, idType))}</th><td>${escapeHtml(displayValue)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  const clauseItems = Array.isArray(acceptedClauses)
    ? acceptedClauses.map((value: string) => `<li>${escapeHtml(String(value))}</li>`).join("")
    : "";
  const agreementBody = renderToStaticMarkup(
    <div className="agreement-body-inner">
      {buildTutorAgreementBody(item.code, {
        legalName: normalizeValue(acceptedName || formSnapshot.legalName),
        phoneNumber: normalizeValue(formSnapshot.phoneNumber),
        dateOfBirth: normalizeValue(formSnapshot.dateOfBirth),
        emailAddress: normalizeValue(formSnapshot.emailAddress),
        idType,
        idNumber: normalizeValue(formSnapshot.idNumber),
        schoolName: normalizeValue(formSnapshot.schoolName),
        currentStatus: normalizeValue(formSnapshot.currentStatus),
        matricYear: normalizeValue(formSnapshot.matricYear),
        examNumber: normalizeValue(formSnapshot.examNumber),
      })}
    </div>
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(item.code)} Accepted Copy</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { margin: 0; background: #efe7d8; color: #1f2933; font-family: Georgia, "Times New Roman", serif; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fffdf8; padding: 18mm 16mm; box-sizing: border-box; }
    .eyebrow { font: 600 11px/1.4 Arial, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #8b2c1f; }
    h1 { margin: 8px 0 6px; font-size: 28px; line-height: 1.15; }
    .subhead { margin: 0; font: 500 13px/1.6 Arial, sans-serif; color: #52606d; }
    .section { margin-top: 20px; }
    .section-title { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d8cfc2; font: 700 14px/1.4 Arial, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #7b341e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 10px; border: 1px solid #ddd3c5; vertical-align: top; }
    th { width: 34%; background: #f6efe4; text-align: left; font: 600 12px/1.5 Arial, sans-serif; color: #243b53; }
    td, p, li { font: 400 13px/1.6 Arial, sans-serif; }
    .agreement-body h1 { font-size: 11px; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.02em; }
    .agreement-body h2 { font-size: 11px; margin: 12px 0 6px; }
    ul { margin: 0 0 0 18px; padding: 0; }
    .agreement-body-inner .tt-agreement-section + .tt-agreement-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7d5c8; }
    .agreement-body-inner .tt-agreement-section h2 { margin: 0 0 10px; font: 700 14px/1.4 Arial, sans-serif; color: #7b341e; }
    .agreement-body-inner .tt-agreement-section-body p { margin: 0 0 10px; font: 400 13px/1.7 Arial, sans-serif; color: #243b53; }
    .agreement-body-inner .tt-agreement-subsection + .tt-agreement-subsection { margin-top: 14px; }
    .agreement-body-inner .tt-agreement-subsection h3 { margin: 0 0 8px; font: 700 13px/1.4 Arial, sans-serif; color: #102a43; }
    .agreement-body-inner .tt-agreement-list { margin: 0 0 10px 18px; padding: 0; }
    .agreement-body-inner .tt-agreement-list li { margin-bottom: 5px; font: 400 13px/1.6 Arial, sans-serif; color: #243b53; }
    .agreement-body-inner .tt-agreement-list-check { list-style-type: "• "; }
    .agreement-body-inner .tt-inline-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .agreement-body-inner .tt-inline-detail-grid > div { padding: 10px 12px; border: 1px solid #ddd3c5; border-radius: 12px; background: #f8f2e8; }
    .agreement-body-inner .tt-inline-detail-grid .tt-inline-detail-span { grid-column: span 2; }
    .agreement-body-inner .tt-inline-detail-grid span { display: block; margin-bottom: 4px; font: 700 10px/1.4 Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #9f1d2b; }
    .agreement-body-inner .tt-inline-detail-grid strong { font: 600 13px/1.5 Arial, sans-serif; color: #102a43; }
  </style>
</head>
<body>
  <main class="page">
    <div class="eyebrow">Response Integrity Accepted Agreement Copy</div>
    <h1>${escapeHtml(item.title)}</h1>
    <p class="subhead">${escapeHtml(item.code)} | Version ${escapeHtml(String(documentVersion))}</p>
    <section class="section">
      <h2 class="section-title">Acceptance Record</h2>
      <p>Accepted by: ${escapeHtml(String(acceptedName))}</p>
      <p>Accepted at: ${escapeHtml(String(formatAcceptedAt(acceptedAt)))}</p>
      <p>Document hash: ${escapeHtml(String(documentChecksum))}</p>
    </section>
    <section class="section">
      <h2 class="section-title">Parties</h2>
      <table>
        <tr><th>Party A</th><td>Response Integrity (Pty) Ltd ("Response Integrity")</td></tr>
        <tr><th>Party B</th><td>${escapeHtml(String(acceptedName))} (Contractor)</td></tr>
      </table>
    </section>
    ${formRows ? `<section class="section"><h2 class="section-title">Captured Form Data</h2><table>${formRows}</table></section>` : ""}
    ${clauseItems ? `<section class="section"><h2 class="section-title">Acknowledged Clauses</h2><ul>${clauseItems}</ul></section>` : ""}
    <section class="section">
      <h2 class="section-title">Accepted Agreement Text</h2>
      ${agreementBody}
    </section>
  </main>
</body>
</html>`;
}

function formatDocStatus(value: string) {
  return String(value || "not_started").replace(/_/g, " ");
}

function getReviewStepLabel(step: string) {
  const labels: Record<string, string> = {
    "1": "TCF",
    "2": "EQV",
    "3": "ICA",
    "4": "SCP",
    "5": "DPC",
    "6": "CID",
  };
  return labels[step] || step;
}

function getReviewStepStatusLabel(params: {
  step: string;
  status: DocumentStatus;
  acceptanceMap: Record<string, any>;
}) {
  const { step, status, acceptanceMap } = params;
  const isAgreementOnlyStep = ["1", "3", "4", "5"].includes(step);

  if (isAgreementOnlyStep) {
    if (acceptanceMap[step]) return "Accepted";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  if (step === "2") {
    if (!acceptanceMap["2"]) return "Pending";
    if (status === "approved") return "Approved";
    if (status === "pending_review") return "Review";
    if (status === "rejected") return "Rejected";
    return "Waiting";
  }

  if (step === "6") {
    if (status === "approved") return "Approved";
    if (status === "pending_review") return "Review";
    if (status === "rejected") return "Rejected";
    return "Waiting";
  }

  return formatDocStatus(status);
}

function getCurrentActionSummary(documentsStatus: Record<string, DocumentStatus>, acceptanceMap: Record<string, any>) {
  const matricStatus = documentsStatus["2"];
  const idStatus = documentsStatus["6"];
  const hasDoc2Acceptance = Boolean(acceptanceMap["2"]);

  if (matricStatus === "pending_review") {
    return {
      queueLabel: "Needs review",
      stageTitle: "Certified Matric certificate review",
      stageDescription: "COO review is required now before step 3 can continue.",
    };
  }

  if (idStatus === "pending_review") {
    return {
      queueLabel: "Needs review",
      stageTitle: "Certified ID review",
      stageDescription: "COO review is required now before onboarding can close out.",
    };
  }

  if (["1", "2", "3", "4", "5", "6"].every((step) => documentsStatus[step] === "approved")) {
    return {
      queueLabel: "Complete",
      stageTitle: "Onboarding complete",
      stageDescription: "All agreement and upload steps are verified.",
    };
  }

  if (!acceptanceMap["1"]) {
    return {
      queueLabel: "Waiting on Specialist",
      stageTitle: "Agreement 1 not yet accepted",
      stageDescription: "The Specialist still needs to begin the in-app onboarding agreements.",
    };
  }

  if (hasDoc2Acceptance && matricStatus === "pending_upload") {
    return {
      queueLabel: "Waiting on Specialist",
      stageTitle: "Waiting for certified Matric certificate",
      stageDescription: "The Specialist accepted Response Integrity-EQV-002 but has not uploaded the certified Matric certificate yet.",
    };
  }

  if (["1", "2", "3", "4", "5"].every((step) => documentsStatus[step] === "approved") && idStatus === "pending_upload") {
    return {
      queueLabel: "Waiting on Specialist",
      stageTitle: "Waiting for certified ID copy",
      stageDescription: "All agreements and Matric verification are done. The final certified ID upload is still outstanding.",
    };
  }

  return {
      queueLabel: "Waiting on Specialist",
    stageTitle: "Agreement flow in progress",
      stageDescription: "The Specialist is still working through the in-app onboarding steps.",
  };
}

function tutorApplicationField(application: any, newCamel: string, newSnake: string, oldCamel?: string, oldSnake?: string) {
  return application?.[newCamel]
    ?? (oldCamel ? application?.[oldCamel] : undefined)
    ?? application?.[newSnake]
    ?? (oldSnake ? application?.[oldSnake] : undefined);
}

export function TutorDocumentReview({ application, onReview }: TutorDocumentReviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewStep, setReviewStep] = useState<2 | 6 | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [applicationViewOpen, setApplicationViewOpen] = useState(false);

  const documentsStatus: Record<string, DocumentStatus> = {
    "1": "pending_upload",
    "2": "not_started",
    "3": "not_started",
    "4": "not_started",
    "5": "not_started",
    "6": "not_started",
    ...(application?.documentsStatus || application?.documents_status || {}),
  };

  const acceptanceMap = application?.onboardingAcceptanceMap || {};
  const fullName = application?.fullName || application?.full_name || "Unknown Specialist";
  const email = application?.email || "No email";
  const acceptedCount = ["1", "3", "4", "5"].filter((step) => documentsStatus[step] === "approved").length;
  const matricStatus = documentsStatus["2"];
  const idStatus = documentsStatus["6"];
  const currentAction = getCurrentActionSummary(documentsStatus, acceptanceMap);
  const currentUploadStep = matricStatus === "pending_review" ? 2 : idStatus === "pending_review" ? 6 : null;
  const queueBadgeClass =
    currentAction.queueLabel === "Needs review"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : currentAction.queueLabel === "Complete"
        ? "bg-green-100 text-green-800 border-green-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  const reviewMutation = useMutation({
    mutationFn: async ({ step, approved, rejectionReason: reason }: { step: 2 | 6; approved: boolean; rejectionReason?: string }) => {
      const response = await fetch(`${API_URL}/api/coo/tutor/${application.id}/document/${step}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approved, rejectionReason: reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to review onboarding upload");
      }
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/tutor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/applications"] });
      toast({
        title: "Onboarding Updated",
        description: payload?.message || "Onboarding review saved.",
      });
      setReviewStep(null);
      setRejectionReason("");
      onReview?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Review Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openRejectDialog = (step: 2 | 6) => {
    setReviewStep(step);
    setRejectionReason(
      step === 2
        ? application?.doc2SubmissionRejectionReason || application?.doc_2_submission_rejection_reason || ""
        : application?.doc6SubmissionRejectionReason || application?.doc_6_submission_rejection_reason || ""
    );
  };

  const downloadAcceptedAgreement = (item: (typeof AGREEMENT_STEPS)[number], acceptance: any) => {
    const html = buildAcceptedAgreementHtml(item, acceptance);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.code}-accepted-copy.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl">{fullName}</CardTitle>
              <CardDescription className="break-all">{email}</CardDescription>
              <p className="text-xs text-muted-foreground">Application Ref: {application.id}</p>
              <p className="text-sm font-medium text-foreground">{currentAction.stageTitle}</p>
              <p className="text-sm text-muted-foreground">{currentAction.stageDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={queueBadgeClass}>{currentAction.queueLabel}</Badge>
              <Badge variant="outline">{acceptedCount}/4 agreements accepted</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            {[
              { step: "1", label: "TCF" },
              { step: "2", label: "EQV" },
              { step: "3", label: "ICA" },
              { step: "4", label: "SCP" },
              { step: "5", label: "DPC" },
              { step: "6", label: "CID" },
            ].map((item) => {
              const status = documentsStatus[item.step];
              const tone =
                status === "approved"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : status === "pending_review"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : status === "rejected"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-700";

              return (
                <div key={item.step} className={`rounded-lg border p-3 ${tone}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">Step {item.step}</p>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs capitalize">{getReviewStepStatusLabel({ step: item.step, status, acceptanceMap })}</p>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentUploadStep === 2 || currentUploadStep === 6 || matricStatus === "rejected" || idStatus === "rejected" ? (
            <div className="rounded-xl border p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-slate-600" />
                <p className="font-medium">Current review item</p>
              </div>

              {currentUploadStep === 2 ? (
              <>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Certified Matric certificate</p>
                  <p>Status: {formatDocStatus(matricStatus)}</p>
                  {application?.doc2SubmissionUploadedAt ? (
                    <p>Uploaded {new Date(application.doc2SubmissionUploadedAt).toLocaleString()}</p>
                  ) : null}
                  {application?.doc2SubmissionUrl ? (
                    <a href={application.doc2SubmissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      View certified Matric certificate
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ step: 2, approved: true })}>
                    {reviewMutation.isPending && reviewStep === 2 ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve Matric certificate
                      </>
                    )}
                  </Button>
                  <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => openRejectDialog(2)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject upload
                  </Button>
                </div>
              </>
              ) : currentUploadStep === 6 ? (
              <>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Certified ID copy</p>
                  <p>Status: {formatDocStatus(idStatus)}</p>
                  {application?.doc6SubmissionUploadedAt ? (
                    <p>Uploaded {new Date(application.doc6SubmissionUploadedAt).toLocaleString()}</p>
                  ) : null}
                  {application?.doc6SubmissionUrl ? (
                    <a href={application.doc6SubmissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      View certified ID upload
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ step: 6, approved: true })}>
                    {reviewMutation.isPending && reviewStep === 6 ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve certified ID
                      </>
                    )}
                  </Button>
                  <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => openRejectDialog(6)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject upload
                  </Button>
                </div>
              </>
              ) : null}

              {(matricStatus === "rejected" || idStatus === "rejected") ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {matricStatus === "rejected"
                    ? application?.doc2SubmissionRejectionReason || application?.doc_2_submission_rejection_reason || "The Matric certificate needs correction."
                    : application?.doc6SubmissionRejectionReason || application?.doc_6_submission_rejection_reason || "The certified ID copy needs correction."}
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-xl border p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <div>
                  <p className="font-medium">Agreement evidence</p>
                  <p className="text-sm text-muted-foreground">Accepted agreements, timestamps, and audit summary.</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="mt-4 space-y-3">
              {AGREEMENT_STEPS.map((item) => {
                const acceptance = acceptanceMap[String(item.step)];
                const stepStatus = documentsStatus[String(item.step)];
                const badgeText =
                  item.step === 2
                    ? !acceptance
                      ? "Pending acceptance"
                      : stepStatus === "approved"
                        ? "Accepted and verified"
                        : stepStatus === "pending_review"
                          ? "Certificate pending review"
                          : stepStatus === "rejected"
                            ? "Certificate rejected"
                            : "Accepted - waiting for upload"
                    : stepStatus === "approved"
                      ? "Accepted"
                      : "Pending";

                return (
                  <div key={item.step} className="rounded-lg border p-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">Step {item.step}: {getReviewStepLabel(String(item.step))}</p>
                        <Badge className={stepStatus === "approved" ? "bg-green-100 text-green-800 border-green-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                          {badgeText}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.code}</p>
                      {acceptance ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Accepted {new Date(acceptance.acceptedAt).toLocaleString()} by {acceptance.typedFullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Version {acceptance.documentVersion} • Hash {String(acceptance.documentChecksum || "").slice(0, 16)}...
                          </p>
                          {Array.isArray(acceptance.acceptedClausesJson) && acceptance.acceptedClausesJson.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Clauses acknowledged: {acceptance.acceptedClausesJson.join(", ")}
                            </p>
                          ) : null}
                          <div className="pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => downloadAcceptedAgreement(item, acceptance)}>
                              <Download className="mr-2 h-3 w-3" />
                              Download accepted copy
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No acceptance recorded yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">Step 2: EQV upload</p>
                    <Badge className={matricStatus === "approved" ? "bg-green-100 text-green-800 border-green-200" : matricStatus === "pending_review" ? "bg-amber-100 text-amber-900 border-amber-200" : matricStatus === "rejected" ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                      {getReviewStepStatusLabel({ step: "2", status: matricStatus, acceptanceMap })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Certified Matric certificate</p>
                  {application?.doc2SubmissionUploadedAt ? (
                    <p className="text-xs text-muted-foreground">Uploaded {new Date(application.doc2SubmissionUploadedAt).toLocaleString()}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No upload recorded yet.</p>
                  )}
                  {application?.doc2SubmissionUrl ? (
                    <a href={application.doc2SubmissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      View certified Matric certificate
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">Step 6: CID upload</p>
                    <Badge className={idStatus === "approved" ? "bg-green-100 text-green-800 border-green-200" : idStatus === "pending_review" ? "bg-amber-100 text-amber-900 border-amber-200" : idStatus === "rejected" ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                      {getReviewStepStatusLabel({ step: "6", status: idStatus, acceptanceMap })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Certified ID copy</p>
                  {application?.doc6SubmissionUploadedAt ? (
                    <p className="text-xs text-muted-foreground">Uploaded {new Date(application.doc6SubmissionUploadedAt).toLocaleString()}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No upload recorded yet.</p>
                  )}
                  {application?.doc6SubmissionUrl ? (
                    <a href={application.doc6SubmissionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      View certified ID upload
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </details>

          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-slate-600" />
                <div>
                  <p className="font-medium">Application view</p>
                  <p className="text-sm text-muted-foreground">Original specialist application details and written responses.</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setApplicationViewOpen(true)}>
                View Full Application
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reviewStep !== null} onOpenChange={(open) => !open && setReviewStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewStep === 2 ? "Reject Matric Certificate" : "Reject Certified ID Copy"}</DialogTitle>
            <DialogDescription>Explain exactly what the Specialist must correct before uploading again.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder={reviewStep === 2 ? "Example: Upload a certified copy of the official National Senior Certificate." : "Example: Certification stamp is unclear. Upload a clearer certified copy."}
            className="min-h-24"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewStep(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reviewStep || !rejectionReason.trim() || reviewMutation.isPending}
              onClick={() => reviewStep && reviewMutation.mutate({ step: reviewStep, approved: false, rejectionReason })}
            >
              {reviewMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Back to Specialist"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applicationViewOpen} onOpenChange={setApplicationViewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{fullName}</DialogTitle>
            <DialogDescription>Original specialist application details and written responses.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Basic Information</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewInfoItem label="Full Name" value={tutorApplicationField(application, "fullName", "full_name", "fullNames", "full_names")} />
                <ReviewInfoItem label="Age" value={String(application?.age ?? "")} />
                <ReviewInfoItem label="Email" value={application?.email} />
                <ReviewInfoItem label="Phone" value={tutorApplicationField(application, "phone", "phone", "phoneNumber", "phone_number")} />
                <ReviewInfoItem label="City" value={application?.city} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Academic Background</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewInfoItem label="Completed Matric" value={tutorApplicationField(application, "completedMatric", "completed_matric")} />
                <ReviewInfoItem label="Matric Year" value={tutorApplicationField(application, "matricYear", "matric_year")} />
                <ReviewInfoItem label="Math Level" value={tutorApplicationField(application, "mathLevel", "math_level")} />
                <ReviewInfoItem label="Math Result" value={tutorApplicationField(application, "mathResult", "math_result")} />
                <ReviewInfoItem label="Other Subjects" value={tutorApplicationField(application, "otherSubjects", "other_subjects")} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Current Situation</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewInfoItem
                  label="Current Situation"
                  value={String(tutorApplicationField(application, "currentSituation", "current_situation", "currentStatus", "current_status") || "").replace(/_/g, " ")}
                />
                <ReviewInfoItem label="Other (if applicable)" value={tutorApplicationField(application, "currentSituationOther", "current_situation_other")} />
                <ReviewInfoItem label="Why interested?" value={tutorApplicationField(application, "interestReason", "interest_reason")} multiline />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Teaching & Communication</h4>
              <div className="grid gap-3">
                <ReviewInfoItem label="Helped someone before?" value={tutorApplicationField(application, "helpedBefore", "helped_before")} />
                <ReviewInfoItem label="Explanation" value={tutorApplicationField(application, "helpExplanation", "help_explanation")} multiline />
                <ReviewInfoItem label={`Student says "I don't get this"`} value={tutorApplicationField(application, "studentDontGet", "student_dont_get")} multiline />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Response Under Pressure</h4>
              <div className="grid gap-3">
                <ReviewInfoItem label="Pressure Story" value={tutorApplicationField(application, "pressureStory", "pressure_story")} multiline />
                <ReviewInfoItem
                  label="Pressure Response"
                  value={Array.isArray(tutorApplicationField(application, "pressureResponse", "pressure_response"))
                    ? tutorApplicationField(application, "pressureResponse", "pressure_response").join(", ")
                    : tutorApplicationField(application, "pressureResponse", "pressure_response")}
                  multiline
                />
                <ReviewInfoItem label="Panic Cause" value={tutorApplicationField(application, "panicCause", "panic_cause")} multiline />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Discipline & Responsibility</h4>
              <div className="grid gap-3">
                <ReviewInfoItem label="Discipline Reason" value={tutorApplicationField(application, "disciplineReason", "discipline_reason")} multiline />
                <ReviewInfoItem label="Repeat Mistake Response" value={tutorApplicationField(application, "repeatMistakeResponse", "repeat_mistake_response")} multiline />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Alignment With Response Integrity</h4>
              <div className="grid gap-3">
                <ReviewInfoItem label="Response Integrity Meaning" value={tutorApplicationField(application, "ttMeaning", "tt_meaning")} multiline />
                <ReviewInfoItem label="Structure Preference" value={tutorApplicationField(application, "structurePreference", "structure_preference")} multiline />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Availability</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewInfoItem label="Hours Per Week" value={tutorApplicationField(application, "hoursPerWeek", "hours_per_week")} />
                <ReviewInfoItem label="Available Afternoons?" value={tutorApplicationField(application, "availableAfternoon", "available_afternoon", "bootcampAvailable", "bootcamp_available")} />
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewInfoItem({ label, value, multiline = false }: { label: string; value: any; multiline?: boolean }) {
  return (
    <div className="rounded-xl border border-[#E7D5C8] bg-[#FFF8F4] p-4">
      <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
      <p className={`mt-2 text-sm text-[#5A5A5A] ${multiline ? "whitespace-pre-wrap leading-7" : ""}`}>{value || "Not provided"}</p>
    </div>
  );
}
