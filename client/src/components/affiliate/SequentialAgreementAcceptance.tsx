import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { CheckCircle2, Download, Expand, FileCheck, FileText, Loader2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type Clause = {
  key: string;
  label: string;
};

type DocumentDefinition = {
  step: number;
  code: string;
  title: string;
  version: string;
  requiresAcceptance: boolean;
  requiresUpload: boolean;
  uploadTitle?: string;
  uploadDescription?: string;
  mandatoryClauses: Clause[];
  content?: string;
  contentHash?: string;
};

type Props = {
  applicationId: string;
  applicationStatus: any;
};

type DocumentStatus = "not_started" | "pending_upload" | "pending_review" | "approved" | "rejected";

type EgpFormData = {
  legalName: string;
  emailAddress: string;
  phoneNumber: string;
  idNumber: string;
  effectiveDate: string;
};

type FieldDefinition = {
  key: keyof EgpFormData;
  label: string;
  placeholder: string;
  readOnly?: boolean;
};

const DEFAULT_STATUSES: Record<string, DocumentStatus> = {
  "1": "pending_upload",
  "2": "not_started",
  "3": "not_started",
  "4": "not_started",
  "5": "not_started",
};

const FORM_FIELDS: FieldDefinition[] = [
  { key: "legalName", label: "Full legal name", placeholder: "Enter your full legal name" },
  { key: "emailAddress", label: "Email address", placeholder: "Loaded from your application", readOnly: true },
  { key: "phoneNumber", label: "Phone number", placeholder: "Loaded from your application" },
  { key: "idNumber", label: "ID number", placeholder: "Loaded from your application" },
];

const EGP_STEP_META: Record<number, { code: string; shortTitle: string }> = {
  1: { code: "Response Integrity-EGP-001", shortTitle: "EGP Agreement" },
  2: { code: "Response Integrity-EGP-002", shortTitle: "Non-Circumvention" },
  3: { code: "Response Integrity-EGP-003", shortTitle: "Confidentiality" },
  4: { code: "Response Integrity-EGP-004", shortTitle: "Representation" },
  5: { code: "Response Integrity-EGP-005", shortTitle: "Certified ID Copy" },
};

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
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

function buildInitialFormData(application: any, acceptance: any): EgpFormData {
  const savedForm = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};

  return {
    legalName: normalizeValue(
      savedForm.legalName ||
      acceptance?.typedFullName ||
      acceptance?.typed_full_name ||
      application?.fullName ||
      application?.full_name
    ),
    emailAddress: normalizeValue(savedForm.emailAddress || application?.email),
    phoneNumber: normalizeValue(savedForm.phoneNumber || application?.phone),
    idNumber: normalizeValue(savedForm.idNumber || application?.idNumber || application?.id_number),
    effectiveDate: normalizeValue(savedForm.effectiveDate || new Date().toLocaleDateString("en-ZA")),
  };
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function normalizeDisplayedVersion(version: string | number | null | undefined) {
  const normalized = String(version ?? "").trim();
  return normalized || "1";
}

function isFieldLocked(fieldKey: keyof EgpFormData, applicationStatus: any, acceptanceAlreadyRecorded: boolean) {
  if (acceptanceAlreadyRecorded) return true;
  if (fieldKey === "effectiveDate") return true;
  if (fieldKey === "emailAddress") return true;

  const lockedValues: Partial<Record<keyof EgpFormData, string>> = {
    legalName: normalizeValue(applicationStatus?.fullName || applicationStatus?.full_name),
    emailAddress: normalizeValue(applicationStatus?.email),
    phoneNumber: normalizeValue(applicationStatus?.phone),
    idNumber: normalizeValue(applicationStatus?.idNumber || applicationStatus?.id_number),
  };

  return Boolean(lockedValues[fieldKey]);
}

function AgreementList({ items, tone = "default" }: { items: ReactNode[]; tone?: "default" | "check" }) {
  return (
    <ul className={`agreement-list ${tone === "check" ? "agreement-list-check" : ""}`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function AgreementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="agreement-section">
      <h2>{title}</h2>
      <div className="agreement-section-body">{children}</div>
    </section>
  );
}

function AgreementSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="agreement-subsection">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function buildAgreementBody(document: DocumentDefinition, formData: EgpFormData) {
  switch (document.code) {
    case "Response Integrity-EGP-001":
      return (
        <>
          <AgreementSection title="1. Purpose">
            <p>This Agreement governs the role of the Education Growth Partner as a distribution operator responsible for sourcing qualified students into the system.</p>
            <p>The EGP is not an employee, advisor, or decision-maker. The EGP operates as a performance-based acquisition operator.</p>
          </AgreementSection>

          <AgreementSection title="2. Role Definition">
            <p>The EGP is responsible for:</p>
            <AgreementList items={[
              "Identifying parents whose children demonstrate real academic performance breakdown",
              "Introducing qualified parents to Response Integrity",
              "Facilitating enrollment into the system",
            ]} />
            <p>The EGP shall not:</p>
            <AgreementList items={[
              "Teach or tutor students",
              "Modify or interpret Response Integrity services",
              "Make guarantees regarding results",
              "Interfere with Response Integrity-OS or tutor operations",
            ]} />
          </AgreementSection>

          <AgreementSection title="3. Independent Contractor Status">
            <p>The EGP operates as an independent contractor.</p>
            <p>The EGP is not entitled to:</p>
            <AgreementList items={["Salary", "Benefits", "Employment protections"]} />
            <p>No employer-employee relationship is created.</p>
          </AgreementSection>

          <AgreementSection title="4. Production Reward Structure (MVP)">
            <p>The EGP participates as a demand contributor in the Response Integrity Production Economy. The EGP is not paid for a lead, inquiry, incomplete enrollment, or capacity contribution.</p>
            <AgreementSubsection title="4.1 Verified Conversion Reward">
              <AgreementList items={[<><strong>R100</strong> is payable for each verified converted student attributed to the contributor's valid Production Link.</>]} />
              <p>The reward unlocks only after a completed trial and paid subscription have been verified.</p>
            </AgreementSubsection>
            <AgreementSubsection title="4.2 Attribution And Payment Conditions">
              <p>The platform records the contributor, campaign, source, ownership, timestamp, and Production Link. Predefined ownership splits apply where contributors share a link.</p>
              <p>No reward is earned for leads, inquiries, incomplete enrollments, unpaid subscriptions, subscriptions without a completed trial, or unattributed organic conversions.</p>
            </AgreementSubsection>
          </AgreementSection>

          <AgreementSection title="5. Production Economy Boundary">
            <p>The reward is tied to verified demand production, not Pod completion or student retention. Pod formation requires separate demand, capacity, and readiness gates.</p>
            <p>The EGP has no claim to the specialist's <strong>R750 monthly service share</strong> or the platform's <strong>R250 production share</strong>. Those allocations are separate from the R100 Production Reward.</p>
          </AgreementSection>

          <AgreementSection title="6. No Entitlement">
            <p>The EGP acknowledges:</p>
            <AgreementList items={["No equity is granted", "No ownership stake is created", "No future claims may be made"]} />
          </AgreementSection>

          <AgreementSection title="7. Territory Assignment">
            <p>The EGP may be assigned specific:</p>
            <AgreementList items={["Schools", "Communities", "Networks"]} />
            <p>The EGP shall not:</p>
            <AgreementList items={["Operate outside assigned territory without approval", "Interfere with other EGPs"]} />
          </AgreementSection>

          <AgreementSection title="8. Representation Limitations">
            <p>The EGP shall not:</p>
            <AgreementList items={["Misrepresent Response Integrity services", "Promise guaranteed results", "Provide academic advice beyond defined positioning"]} />
            <p>All communication must align with Response Integrity positioning.</p>
          </AgreementSection>

          <AgreementSection title="9. Termination">
            <p>Response Integrity may terminate this Agreement at any time:</p>
            <AgreementList items={["Without cause", "Without notice", "Without future obligation"]} />
            <p>Unmet conditions result in no payout.</p>
          </AgreementSection>

          <AgreementSection title="10. Confidentiality & System Protection">
            <p>The EGP agrees not to:</p>
            <AgreementList items={["Share proprietary systems or processes", "Disclose internal structures", "Replicate the model externally"]} />
          </AgreementSection>

          <AgreementSection title="11. Acknowledgement">
            <p>The EGP confirms:</p>
            <AgreementList tone="check" items={[
              "Understanding of performance-based nature",
              "Acceptance of zero-entitlement structure",
              "Alignment with Response Integrity operational boundaries",
            ]} />
          </AgreementSection>
        </>
      );

    case "Response Integrity-EGP-002":
      return (
        <>
          <AgreementSection title="1. Purpose">
            <p>This Agreement protects Response Integrity's client relationships, tutor network, and operational structure.</p>
            <p>The EGP acknowledges that all relationships introduced or accessed through the platform remain the Company's exclusive relationship assets.</p>
          </AgreementSection>

          <AgreementSection title="2. Non-Circumvention">
            <p>The EGP shall not, directly or indirectly:</p>
            <AgreementList items={[
              "Engage platform clients outside approved channels",
              "Offer tutoring or related services privately to platform clients",
              "Redirect parents or students away from Response Integrity",
              "Facilitate third-party services to platform clients",
            ]} />
            <p>All clients introduced remain within the system.</p>
          </AgreementSection>

          <AgreementSection title="3. Non-Solicitation (Clients)">
            <p>The EGP shall not:</p>
            <AgreementList items={[
              "Contact platform parents for personal or external services",
              "Attempt to move platform clients to another service",
              "Re-engage former platform clients outside approved channels",
            ]} />
            <p>This applies during and after the relationship with Response Integrity.</p>
          </AgreementSection>

          <AgreementSection title="4. Non-Solicitation (Tutors)">
            <p>The EGP shall not:</p>
            <AgreementList items={[
              "Recruit or attempt to recruit Response Integrity tutors",
              "Engage Response Integrity tutors for external or private services",
              "Encourage tutors to leave Response Integrity",
            ]} />
          </AgreementSection>

          <AgreementSection title="5. Duration">
            <p>These restrictions apply:</p>
            <AgreementList items={["During the term of engagement", <><strong>For 24 months after termination</strong></>]} />
          </AgreementSection>

          <AgreementSection title="6. Breach">
            <p>Any breach of this Agreement constitutes:</p>
            <AgreementList items={["Immediate termination", "Forfeiture of all unpaid commissions", "Potential legal action"]} />
          </AgreementSection>

          <AgreementSection title="7. No Workarounds">
            <p>The EGP shall not:</p>
            <AgreementList items={["Use intermediaries", "Act through third parties", "Indirectly bypass Response Integrity"]} />
            <p>Circumvention through any means is treated as direct breach.</p>
          </AgreementSection>

          <AgreementSection title="8. Acknowledgement">
            <p>The EGP confirms:</p>
            <AgreementList tone="check" items={[
              "Understanding of Response Integrity ownership of relationships",
              "Agreement not to exploit access gained through Response Integrity",
              "Acceptance of strict non-circumvention enforcement",
            ]} />
          </AgreementSection>
        </>
      );

    case "Response Integrity-EGP-003":
      return (
        <>
          <AgreementSection title="1. Purpose">
            <p>This Agreement protects Response Integrity's proprietary systems, methodologies, and internal structures.</p>
            <p>The EGP acknowledges that Response Integrity operates through a defined system and strategic framework that are confidential and commercially sensitive.</p>
          </AgreementSection>

          <AgreementSection title="2. Confidential Information">
            <p>Confidential Information includes, but is not limited to:</p>
            <AgreementList items={[
              "Response Integrity-OS",
              "Training methods and drill structures",
              "Intake and diagnostic processes",
              "Pricing models and revenue structures",
              "Internal documents, agreements, and frameworks",
              "Tutor management systems and quality control processes",
              "Strategic positioning and messaging",
            ]} />
          </AgreementSection>

          <AgreementSection title="3. Non-Disclosure">
            <p>The EGP shall not:</p>
            <AgreementList items={[
              "Share confidential information with any third party",
              "Disclose proprietary systems or processes externally",
              "Discuss internal operations outside approved channels",
            ]} />
          </AgreementSection>

          <AgreementSection title="4. Non-Reproduction">
            <p>The EGP shall not:</p>
            <AgreementList items={["Copy or replicate proprietary systems", "Recreate Response Integrity-OS in any form", "Train or assist others using platform methodologies"]} />
          </AgreementSection>

          <AgreementSection title="5. Limited Use">
            <p>The EGP may use this information only for the purpose of fulfilling their role within Response Integrity.</p>
            <p>No other use is permitted.</p>
          </AgreementSection>

          <AgreementSection title="6. Data Protection">
            <p>The EGP shall:</p>
            <AgreementList items={["Protect parent and student information", "Not store, export, or misuse client data", "Not retain data after termination"]} />
          </AgreementSection>

          <AgreementSection title="7. Breach">
            <p>Any breach of confidentiality constitutes:</p>
            <AgreementList items={["Immediate termination", "Forfeiture of all unpaid commissions", "Potential legal action"]} />
          </AgreementSection>

          <AgreementSection title="8. Duration">
            <p>Confidentiality obligations apply indefinitely, including after termination.</p>
          </AgreementSection>

          <AgreementSection title="9. Acknowledgement">
            <p>The EGP confirms:</p>
            <AgreementList tone="check" items={[
              "Understanding of Response Integrity's proprietary nature",
              "Agreement to protect all confidential systems",
              "Acceptance of strict confidentiality enforcement",
            ]} />
          </AgreementSection>
        </>
      );

    case "Response Integrity-EGP-004":
      return (
        <>
          <AgreementSection title="1. Purpose">
            <p>This Agreement governs how the EGP represents Response Integrity in all external interactions.</p>
            <p>The EGP is not authorized to interpret, modify, or expand Response Integrity's positioning.</p>
            <p>The EGP must communicate only within defined boundaries.</p>
          </AgreementSection>

          <AgreementSection title="2. Role In Communication">
            <p>The EGP is responsible for:</p>
            <AgreementList items={["Identifying potential need", "Introducing parents to the offer", "Positioning Response Integrity accurately"]} />
            <p>The EGP is not responsible for:</p>
            <AgreementList items={["Explaining technical training methods", "Diagnosing academic issues in detail", "Closing complex decisions"]} />
          </AgreementSection>

          <AgreementSection title="3. Positioning Rule (Non-Negotiable)">
            <p>The EGP must represent Response Integrity as a system that helps students who break under pressure in math, despite understanding the work.</p>
            <p>The EGP shall not position Response Integrity as:</p>
            <AgreementList items={['"Extra lessons"', '"Homework help"', '"Exam tips"', '"Guaranteed marks improvement"']} />
          </AgreementSection>

          <AgreementSection title="4. No False Promises">
            <p>The EGP shall not:</p>
            <AgreementList items={["Guarantee results", "Promise specific marks or outcomes", "Overstate Response Integrity capabilities"]} />
            <p>All outcomes depend on system execution.</p>
          </AgreementSection>

          <AgreementSection title="5. No Pressure Selling">
            <p>The EGP shall not:</p>
            <AgreementList items={["Pressure parents into signing up", "Create artificial urgency", "Mislead parents about availability or results"]} />
            <p>If need is not present, the EGP must disengage.</p>
          </AgreementSection>

          <AgreementSection title="6. Need-First Rule (Power Listening)">
            <p>The EGP must:</p>
            <AgreementList items={["Identify whether a real academic breakdown exists", "Engage only where need is clear"]} />
            <p>If need is absent, the EGP must not push enrollment.</p>
          </AgreementSection>

          <AgreementSection title="7. Communication Standards">
            <p>The EGP shall:</p>
            <AgreementList items={["Speak clearly and accurately", "Avoid exaggeration", "Avoid informal or unprofessional messaging"]} />
            <p>All communication must reflect Response Integrity's standards.</p>
          </AgreementSection>

          <AgreementSection title="8. Social Media & Public Representation">
            <p>The EGP shall not:</p>
            <AgreementList items={["Post misleading content about Response Integrity", "Represent themselves as a tutor or expert", "Create independent branded material"]} />
          </AgreementSection>

          <AgreementSection title="9. Breach">
            <p>Any breach of this Agreement may result in:</p>
            <AgreementList items={["Immediate termination", "Forfeiture of unpaid commissions", "Removal from Response Integrity network"]} />
          </AgreementSection>

          <AgreementSection title="10. Acknowledgement">
            <p>The EGP confirms:</p>
            <AgreementList tone="check" items={[
              "Understanding of representation boundaries",
              "Agreement to communicate within defined positioning",
              "Commitment to protecting Response Integrity's brand integrity",
              "Commitment to engage only where need is clear and genuine",
            ]} />
          </AgreementSection>
        </>
      );

    default:
      return (
        <AgreementSection title={document.title}>
          <p>This agreement records the onboarding acceptance for {formData.legalName || "[Full Name]"}.</p>
        </AgreementSection>
      );
  }
}

export function buildAcceptedCopyHtml(params: {
  document: DocumentDefinition;
  acceptance: any;
  formData: EgpFormData;
}) {
  const { document, acceptance, formData } = params;
  const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at || null;
  const acceptedName = normalizeValue(acceptance?.typedFullName || acceptance?.typed_full_name || formData.legalName) || "Not available";
  const documentHash = normalizeValue(acceptance?.documentChecksum || acceptance?.document_checksum || document.contentHash) || "Not available";
  const documentVersion = normalizeValue(acceptance?.documentVersion || acceptance?.document_version || document.version) || "1";
  const clauseKeys = acceptance?.acceptedClausesJson || acceptance?.accepted_clauses_json || [];
  const detailsRows = [
    ["Full legal name", formData.legalName],
    ["Email address", formData.emailAddress],
    ["Phone number", formData.phoneNumber],
    ["ID number", formData.idNumber],
    ["Effective date", formData.effectiveDate],
  ]
    .filter(([, value]) => normalizeValue(value))
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`)
    .join("");
  const clauseRows = (document.mandatoryClauses || [])
    .filter((clause) => clauseKeys.includes(clause.key))
    .map((clause) => `<li>${escapeHtml(clause.label)}</li>`)
    .join("");
  const agreementBody = renderToStaticMarkup(
    <div className="agreement-reader accepted-copy-body">{buildAgreementBody(document, { ...formData, legalName: acceptedName })}</div>
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.code)} Accepted Copy</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body { margin: 0; padding: 16px; background: #e7e1d7; color: #1f2933; font-family: "Georgia", "Times New Roman", serif; }
    .page { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; background: #fffdf8; padding: 18mm 16mm; }
    .eyebrow { font: 600 11px/1.4 Arial, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #8b2c1f; }
    h1 { margin: 8px 0 6px; font-size: 28px; line-height: 1.15; }
    .subhead { margin: 0; font: 500 13px/1.6 Arial, sans-serif; color: #52606d; }
    .summary { margin-top: 18px; padding: 14px 16px; border: 1px solid #d8cfc2; background: #f8f2e8; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-top: 10px; }
    .summary-label { font: 600 11px/1.4 Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #7b8794; }
    .summary-value { margin-top: 3px; font: 400 14px/1.5 Arial, sans-serif; color: #102a43; }
    .section { margin-top: 22px; }
    .section-title { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d8cfc2; font: 700 14px/1.4 Arial, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #7b341e; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 10px; border: 1px solid #ddd3c5; vertical-align: top; }
    th { width: 34%; background: #f6efe4; text-align: left; font: 600 12px/1.5 Arial, sans-serif; color: #243b53; }
    td { font: 400 13px/1.6 Arial, sans-serif; }
    h1, h2, h3, p, li, th, td, .summary-value, .signature-box, .footer { overflow-wrap: anywhere; word-break: break-word; }
    .clauses { margin: 0; padding-left: 18px; font: 400 13px/1.7 Arial, sans-serif; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd3c5; font: 400 11px/1.5 Arial, sans-serif; color: #7b8794; }
    .signature { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .signature-box { padding-top: 10px; border-top: 1px solid #9fb3c8; font: 400 12px/1.5 Arial, sans-serif; }
    .accepted-copy-body .agreement-section + .agreement-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7d5c8; }
    .accepted-copy-body .agreement-section h2 { margin: 0 0 10px; font: 700 14px/1.4 Arial, sans-serif; color: #7b341e; }
    .accepted-copy-body .agreement-section-body p { margin: 0 0 10px; font: 400 13px/1.7 Arial, sans-serif; color: #243b53; }
    .accepted-copy-body .agreement-subsection + .agreement-subsection { margin-top: 14px; }
    .accepted-copy-body .agreement-subsection h3 { margin: 0 0 8px; font: 700 13px/1.4 Arial, sans-serif; color: #102a43; }
    .accepted-copy-body .agreement-list { margin: 0 0 10px 18px; padding: 0; }
    .accepted-copy-body .agreement-list li { margin-bottom: 5px; font: 400 13px/1.6 Arial, sans-serif; color: #243b53; }
    @media screen and (max-width: 760px) {
      body { padding: 0; background: #fffdf8; }
      .page { width: 100%; min-height: auto; padding: 24px 16px 32px; }
      h1 { font-size: 24px; }
      .summary { padding: 12px; }
      .summary-grid, .signature { grid-template-columns: 1fr; }
      table { display: block; border-collapse: separate; }
      tr { display: grid; grid-template-columns: 1fr; margin-bottom: 10px; }
      th, td { display: block; width: 100%; }
      th { border-bottom: 0; }
      td { border-top: 0; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="eyebrow">Response Integrity Accepted Agreement Copy</div>
    <h1>${escapeHtml(document.title)}</h1>
    <p class="subhead">${escapeHtml(document.code)} | Version ${escapeHtml(documentVersion)} | Accepted in-app against the affiliate's authenticated Response Integrity account</p>

    <section class="summary">
      <div class="summary-label">Acceptance record</div>
      <div class="summary-grid">
        <div><div class="summary-label">Accepted by</div><div class="summary-value">${escapeHtml(acceptedName)}</div></div>
        <div><div class="summary-label">Accepted at</div><div class="summary-value">${escapeHtml(formatAcceptedAt(acceptedAt))}</div></div>
        <div><div class="summary-label">Document hash</div><div class="summary-value">${escapeHtml(documentHash)}</div></div>
        <div><div class="summary-label">Acceptance method</div><div class="summary-value">In-app assent with typed full name and clause acknowledgement</div></div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Parties</h2>
      <table>
        <tr><th>Party A</th><td>Response Integrity (Pty) Ltd ("Response Integrity")</td></tr>
        <tr><th>Party B</th><td>${escapeHtml(acceptedName)} (Education Growth Partner)</td></tr>
      </table>
    </section>

    ${detailsRows ? `<section class="section"><h2 class="section-title">EGP Details Captured At Acceptance</h2><table>${detailsRows}</table></section>` : ""}
    ${clauseRows ? `<section class="section"><h2 class="section-title">Acknowledged Clauses</h2><ul class="clauses">${clauseRows}</ul></section>` : ""}

    <section class="section">
      <h2 class="section-title">Accepted Agreement Text</h2>
      ${agreementBody}
    </section>

    <section class="signature">
      <div class="signature-box">EGP acceptance name: ${escapeHtml(acceptedName)}</div>
      <div class="signature-box">Accepted timestamp: ${escapeHtml(formatAcceptedAt(acceptedAt))}</div>
    </section>

    <div class="footer">
      This accepted copy was generated from Response Integrity's stored affiliate onboarding acceptance record. It reflects the versioned in-app agreement text and acceptance evidence held at the time of assent.
    </div>
  </main>
</body>
</html>`;
}

export function SequentialAgreementAcceptance({ applicationId, applicationStatus }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerSession, setReaderSession] = useState(0);
  const [readerPercent, setReaderPercent] = useState(0);
  const [hasCompletedReading, setHasCompletedReading] = useState(false);
  const [viewStartedAt, setViewStartedAt] = useState<string | null>(null);
  const [viewCompletedAt, setViewCompletedAt] = useState<string | null>(null);
  const [typedFullName, setTypedFullName] = useState("");
  const [generalRead, setGeneralRead] = useState(false);
  const [generalBound, setGeneralBound] = useState(false);
  const [clauseChecks, setClauseChecks] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<EgpFormData>({
    legalName: "",
    emailAddress: "",
    phoneNumber: "",
    idNumber: "",
    effectiveDate: new Date().toLocaleDateString("en-ZA"),
  });

  const { data, isLoading } = useQuery<{ applicationId: string; documents: DocumentDefinition[] }>({
    queryKey: ["/api/affiliate/onboarding-documents", applicationId],
    enabled: Boolean(applicationId),
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/affiliate/onboarding-documents");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to load EGP documents");
      return payload;
    },
  });

  const documentsStatus = useMemo(
    () => ({ ...DEFAULT_STATUSES, ...(applicationStatus?.documentsStatus || applicationStatus?.documents_status || {}) }),
    [applicationStatus]
  );
  const liveApplication = applicationStatus || {};

  const currentStep = useMemo(() => {
    for (const step of [1, 2, 3, 4, 5]) {
      if (documentsStatus[String(step)] !== "approved") return step;
    }
    return 5;
  }, [documentsStatus]);

  const currentDocument = data?.documents?.find((document) => document.step === currentStep);
  const currentAcceptance = applicationStatus?.onboardingAcceptanceMap?.[String(currentStep)];
  const acceptanceMap = applicationStatus?.onboardingAcceptanceMap || {};
  const acceptanceAlreadyRecorded = Boolean(currentAcceptance);
  const currentStatus = documentsStatus[String(currentStep)] || "not_started";
  const isUploadStep = Boolean(currentDocument?.requiresUpload && !currentDocument?.requiresAcceptance);
  const allApproved = ["1", "2", "3", "4", "5"].every((step) => documentsStatus[step] === "approved");
  const isPendingCooReview = isUploadStep && currentStatus === "pending_review";

  const initialFormData = useMemo(
    () => buildInitialFormData(applicationStatus, currentAcceptance),
    [applicationStatus, currentAcceptance]
  );

  const effectiveFormData = useMemo(
    () => ({
      ...initialFormData,
      ...formData,
      legalName: typedFullName || formData.legalName || initialFormData.legalName,
    }),
    [formData, initialFormData, typedFullName]
  );

  const agreementBody = useMemo(
    () => (currentDocument ? buildAgreementBody(currentDocument, effectiveFormData) : null),
    [currentDocument, effectiveFormData]
  );

  const acceptanceResetKey = `${currentStep}:${currentAcceptance?.acceptedAt || currentAcceptance?.accepted_at || "pending"}`;

  useEffect(() => {
    const nextFormData = buildInitialFormData(applicationStatus, currentAcceptance);
    const nextName =
      currentAcceptance?.typedFullName ||
      currentAcceptance?.typed_full_name ||
      nextFormData.legalName ||
      normalizeValue(applicationStatus?.fullName || applicationStatus?.full_name);

    setTypedFullName(nextName);
    setFormData(nextFormData);
    setGeneralRead(false);
    setGeneralBound(false);
    setClauseChecks(Object.fromEntries((currentDocument?.mandatoryClauses || []).map((clause) => [clause.key, false])));
    setSelectedFile(null);
    setReaderPercent(0);
    setHasCompletedReading(Boolean(currentAcceptance));
    setViewStartedAt(null);
    setViewCompletedAt(currentAcceptance ? currentAcceptance?.viewCompletedAt || currentAcceptance?.view_completed_at || null : null);
    setReaderOpen(false);
  }, [acceptanceResetKey, applicationStatus, currentAcceptance, currentDocument]);

  const handleReaderScroll = () => {
    const node = readerRef.current;
    if (!node) return;

    if (node.scrollHeight <= node.clientHeight + 8) {
      setReaderPercent(100);
      setViewCompletedAt((current) => current || new Date().toISOString());
      return;
    }

    const maxScrollTop = node.scrollHeight - node.clientHeight;
    const percent = Math.min(100, Math.max(0, Math.round((node.scrollTop / maxScrollTop) * 100)));
    setReaderPercent(percent);

    if (percent >= 99) {
      setViewCompletedAt((current) => current || new Date().toISOString());
    }
  };

  const resetReaderPosition = () => {
    const node = readerRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.focus({ preventScroll: true });
    handleReaderScroll();
  };

  useEffect(() => {
    if (!readerOpen || viewStartedAt || acceptanceAlreadyRecorded) return;
    setViewStartedAt(new Date().toISOString());
  }, [acceptanceAlreadyRecorded, readerOpen, viewStartedAt]);

  useEffect(() => {
    if (!readerOpen) return;
    const timer = window.setTimeout(resetReaderPosition, 80);
    return () => window.clearTimeout(timer);
  }, [readerOpen, currentDocument?.step, readerSession]);

  useEffect(() => {
    if (!readerOpen) return;

    const rafOne = window.requestAnimationFrame(resetReaderPosition);
    const rafTwo = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resetReaderPosition);
    });
    const timer = window.setTimeout(resetReaderPosition, 220);

    return () => {
      window.cancelAnimationFrame(rafOne);
      window.cancelAnimationFrame(rafTwo);
      window.clearTimeout(timer);
    };
  }, [readerOpen, readerSession]);

  const mandatoryClausesAccepted = (currentDocument?.mandatoryClauses || []).every((clause) => clauseChecks[clause.key]);
  const requiredFieldsComplete =
    typedFullName.trim().length > 1 &&
    effectiveFormData.emailAddress.trim().length > 0 &&
    effectiveFormData.phoneNumber.trim().length > 0 &&
    effectiveFormData.idNumber.trim().length > 0;
  const canAccept =
    !isUploadStep &&
    !acceptanceAlreadyRecorded &&
    hasCompletedReading &&
    generalRead &&
    generalBound &&
    mandatoryClausesAccepted &&
    requiredFieldsComplete;

  const downloadAcceptedCopyFor = (document: DocumentDefinition, acceptance: any) => {
    if (!document || !acceptance) return;
    const storedForm = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
    const html = buildAcceptedCopyHtml({
      document,
      acceptance,
      formData: {
        legalName: normalizeValue(acceptance?.typedFullName || acceptance?.typed_full_name || storedForm.legalName || effectiveFormData.legalName),
        emailAddress: normalizeValue(storedForm.emailAddress || effectiveFormData.emailAddress),
        phoneNumber: normalizeValue(storedForm.phoneNumber || effectiveFormData.phoneNumber),
        idNumber: normalizeValue(storedForm.idNumber || effectiveFormData.idNumber),
        effectiveDate: normalizeValue(storedForm.effectiveDate || effectiveFormData.effectiveDate),
      },
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${document.code}-accepted-copy.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!currentDocument || currentDocument.step !== 5) throw new Error("No upload step is active");
      if (!selectedFile) throw new Error("Select a certified ID copy first");

      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const [, base64 = ""] = result.split(",");
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile);
      });

      const response = await apiRequest(
        "POST",
        "/api/affiliate/onboarding-documents/upload",
        {
          applicationId,
          docStep: currentDocument.step,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileData,
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to upload certified ID copy");
      return payload;
    },
    onSuccess: async () => {
      setSelectedFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/application-status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/gateway-session"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/onboarding-documents", applicationId] }),
      ]);
      toast({
        title: "Certified ID uploaded",
        description: "Your file is now with COO for review.",
      });
      window.requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!currentDocument) throw new Error("No agreement loaded");

      const acceptedClauseKeys = currentDocument.mandatoryClauses
        .filter((clause) => clauseChecks[clause.key])
        .map((clause) => clause.key);

      const response = await apiRequest(
        "POST",
        `/api/affiliate/onboarding-documents/${currentDocument.step}/accept`,
        {
          applicationId,
          documentVersion: currentDocument.version,
          documentHash: currentDocument.contentHash,
          typedFullName: effectiveFormData.legalName,
          acceptedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          platform: "web",
          sourceFlow: `affiliate_onboarding_step_${currentDocument.step}`,
          formData: effectiveFormData,
          acceptedClauseKeys,
          scrollCompletionPercent: readerPercent,
          viewStartedAt,
          viewCompletedAt,
          acceptClickedAt: new Date().toISOString(),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to accept agreement");
      return payload;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/application-status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/gateway-session"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/affiliate/onboarding-documents", applicationId] }),
      ]);
      window.requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      toast({
        title: "Agreement accepted",
        description: "The next agreement is now unlocked.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Acceptance failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (allApproved) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">EGP onboarding complete</h3>
            <p className="text-sm text-muted-foreground">All EGP onboarding steps, including the certified ID review, are complete. You can continue into the affiliate dashboard.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !currentDocument) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">Loading onboarding documents...</CardContent>
      </Card>
    );
  }

  return (
    <>
      <div ref={containerRef}>
      <Card className="border-0 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Step {currentStep} of 5</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{currentDocument.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{currentDocument.code}</Badge>
              <Badge variant="outline">Version {normalizeDisplayedVersion(currentDocument.version)}</Badge>
              <Badge variant="outline">{statusLabel(currentStatus)}</Badge>
            </div>
          </div>
          <Progress value={(currentStep / 5) * 100} />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((step) => {
              const status = documentsStatus[String(step)];
              const meta = EGP_STEP_META[step];
              const tone =
                status === "approved"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : step === currentStep
                    ? "border-[#E63946]/30 bg-[#FFF3F1] text-[#9F1D2B]"
                    : "border-slate-200 bg-white text-slate-600";

              return (
                <div key={step} className={`rounded-xl border p-3 ${tone}`}>
                  <p className="text-[11px] uppercase tracking-wide">{meta.code}</p>
                  <p className="text-sm font-semibold">
                    {status === "approved" ? "Accepted" : step === currentStep ? "Current" : statusLabel(status)}
                  </p>
                  <p className="mt-1 text-xs text-current/80">{meta.shortTitle}</p>
                </div>
              );
            })}
          </div>

          {!isUploadStep ? (
            <>
              <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Agreement review</p>
                    <p className="text-sm text-[#6B5B52]">Open the agreement, review the populated document, scroll the full text, then return here to unlock acceptance.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setReaderSession((current) => current + 1);
                      setReaderOpen(true);
                    }}
                    className="w-full bg-[#E63946] text-white hover:bg-[#cf2e3c] sm:w-auto"
                  >
                    <Expand className="mr-2 h-4 w-4" />
                    Open agreement
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-1 text-xs text-[#6B5B52] sm:flex-row sm:flex-wrap sm:gap-3">
                  <span>Read progress: {readerPercent}%</span>
                  <span>{hasCompletedReading ? "Reader completed" : "Acceptance remains locked until the agreement is fully read"}</span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <p className="font-medium">Acceptance workspace</p>
                    <p className="text-sm text-muted-foreground">This area unlocks only after the agreement reader is completed.</p>
                  </div>

                  <div className="grid gap-3 rounded-xl bg-slate-50 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="typedFullName">Acceptance name</Label>
                      <Input id="typedFullName" value={effectiveFormData.legalName} disabled placeholder="Captured from the agreement record" />
                    </div>

                    {currentDocument.mandatoryClauses.map((clause) => (
                      <label key={clause.key} className="flex items-start gap-3 text-sm">
                        <Checkbox
                          checked={clauseChecks[clause.key] || false}
                          disabled={!hasCompletedReading || acceptanceAlreadyRecorded}
                          onCheckedChange={(value) => setClauseChecks((current) => ({ ...current, [clause.key]: Boolean(value) }))}
                        />
                        <span>{clause.label}</span>
                      </label>
                    ))}

                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={generalRead}
                        disabled={!hasCompletedReading || acceptanceAlreadyRecorded}
                        onCheckedChange={(value) => setGeneralRead(Boolean(value))}
                      />
                      <span>I have read and understood this agreement.</span>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={generalBound}
                        disabled={!hasCompletedReading || acceptanceAlreadyRecorded}
                        onCheckedChange={(value) => setGeneralBound(Boolean(value))}
                      />
                      <span>I agree to be legally bound by these terms and understand Response Integrity will store an audit record of this acceptance.</span>
                    </label>
                  </div>

                  <Button type="button" disabled={!canAccept || acceptMutation.isPending} onClick={() => acceptMutation.mutate()} className="w-full gap-2">
                    {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                    {acceptMutation.isPending ? "Accepting..." : "Accept and continue"}
                  </Button>
                </div>

                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <p className="font-medium">Captured details</p>
                    <p className="text-sm text-muted-foreground">The agreement is populated from the submitted application and stored with the acceptance record.</p>
                  </div>
                  <div className="space-y-3 rounded-xl bg-[#FFF8F4] p-4 text-sm text-[#5A5A5A]">
                    <div>
                      <p className="font-medium text-[#1A1A1A]">Full legal name</p>
                      <p>{effectiveFormData.legalName || "Pending"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">Email address</p>
                      <p>{effectiveFormData.emailAddress || "Pending"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">Phone number</p>
                      <p>{effectiveFormData.phoneNumber || "Pending"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">ID number</p>
                      <p>{effectiveFormData.idNumber || "Pending"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => {
                      setReaderSession((current) => current + 1);
                      setReaderOpen(true);
                    }}>
                      <Expand className="mr-2 h-4 w-4" />
                      Review again
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full whitespace-normal text-left sm:w-auto sm:whitespace-nowrap sm:text-center"
                      disabled={!acceptanceAlreadyRecorded}
                      onClick={() => currentAcceptance && downloadAcceptedCopyFor(currentDocument, currentAcceptance)}
                    >
                      <Download className="mr-2 h-4 w-4 shrink-0" />
                      Download accepted copy
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {isPendingCooReview ? (
                <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">This step is with COO for review</p>
                    <p className="text-sm text-[#6B5B52]">
                      Your certified ID copy is now with COO for review. You do not need to take any further action on this step right now.
                    </p>
                  </div>
                </div>
              ) : null}

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border p-4">
                <div>
                  <p className="font-medium">{currentDocument.uploadTitle || "Required upload"}</p>
                  <p className="text-sm text-muted-foreground">{currentDocument.uploadDescription}</p>
                </div>

                {!isPendingCooReview ? (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground">
                      Choose the certified ID copy, then upload it for COO review. Gateway access opens only after COO approves this file.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        key={`${currentStep}-${currentStatus}-${selectedFile?.name || "empty"}`}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        disabled={currentStatus === "approved" || uploadMutation.isPending}
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#E63946] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={!selectedFile || currentStatus === "approved" || uploadMutation.isPending}
                        onClick={() => uploadMutation.mutate()}
                      >
                        {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload file
                      </Button>
                    </div>
                    {selectedFile ? (
                      <p className="mt-3 text-sm text-[#6B5B52]">
                        Selected file: <span className="font-medium text-[#1A1A1A]">{selectedFile.name}</span>
                      </p>
                    ) : null}
                    {currentStatus === "rejected" ? (
                      <p className="mt-3 text-sm text-red-700">
                        {liveApplication?.doc_5_submission_rejection_reason || "Your certified ID copy was rejected. Review the reason and upload a corrected certified copy."}
                      </p>
                    ) : null}
                    {currentStatus === "approved" ? (
                      <p className="mt-3 text-sm text-green-700">Certified ID copy approved.</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground">Your certified ID copy is with COO for review now.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border p-4">
                <div>
                  <p className="font-medium">Submission record</p>
                  <p className="text-sm text-muted-foreground">This step is evidence-driven and closes only after COO review.</p>
                </div>
                <div className="space-y-3 rounded-xl bg-[#FFF8F4] p-4 text-sm text-[#5A5A5A]">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">Status</p>
                    <p>{statusLabel(currentStatus)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A]">Submitted file</p>
                    {liveApplication?.doc_5_submission_url ? (
                      <a href={liveApplication.doc_5_submission_url} target="_blank" rel="noreferrer" className="text-[#9F1D2B] underline underline-offset-2">
                        Open uploaded certified ID copy
                      </a>
                    ) : (
                      <p>No file uploaded yet.</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A]">Submitted by</p>
                    <p>{effectiveFormData.legalName || "Pending"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A]">ID number</p>
                    <p>{effectiveFormData.idNumber || "Pending"}</p>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {data?.documents?.some((document) => acceptanceMap[String(document.step)]) ? (
            <div className="rounded-2xl border p-4">
              <div className="mb-4">
                <p className="font-medium">Accepted documents</p>
                <p className="text-sm text-muted-foreground">Download a clean accepted copy for any agreement you have already completed.</p>
              </div>
              <div className="space-y-3">
                {data.documents
                  .filter((document) => acceptanceMap[String(document.step)])
                  .map((document) => {
                    const acceptance = acceptanceMap[String(document.step)];
                    const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at;
                    return (
                      <div key={document.step} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{document.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {document.code} • Version {normalizeValue(acceptance?.documentVersion || acceptance?.document_version || document.version)}
                          </p>
                          {acceptedAt ? (
                            <p className="text-xs text-muted-foreground">Accepted {new Date(acceptedAt).toLocaleString()}</p>
                          ) : null}
                        </div>
                        <div className="w-full sm:w-auto">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full whitespace-normal text-left sm:w-auto sm:whitespace-nowrap sm:text-center"
                            onClick={() => downloadAcceptedCopyFor(document, acceptance)}
                          >
                            <Download className="mr-2 h-4 w-4 shrink-0" />
                            Download accepted copy
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>

      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent
          key={`reader-${currentDocument.step}-${readerSession}`}
          className="left-1/2 top-1/2 h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7D5C8] p-0 shadow-2xl sm:h-[88dvh] sm:w-[calc(100vw-3rem)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(resetReaderPosition);
          }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#FFF5ED] text-[#1A1A1A]">
            <DialogHeader className="shrink-0 border-b border-[#E7D5C8] bg-white px-4 py-4 text-left sm:px-6 sm:py-5">
              <DialogTitle className="pr-8 text-xl sm:text-2xl">{currentDocument.title}</DialogTitle>
              <p className="text-sm text-[#6B5B52]">{currentDocument.code} • Version {currentDocument.version}</p>
            </DialogHeader>

            <div
              key={`reader-scroll-${currentDocument.step}-${readerSession}`}
              ref={readerRef}
              tabIndex={-1}
              onScroll={handleReaderScroll}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FFF5ED] px-3 py-4 touch-pan-y sm:px-6 sm:py-6"
            >
              <div className="mx-auto max-w-4xl rounded-2xl border border-[#E7D5C8] bg-white px-4 py-6 text-[#1A1A1A] shadow-[0_18px_50px_rgba(230,57,70,0.08)] sm:px-10 sm:py-10">
                <div className="border-b border-[#E7D5C8] pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E63946]">Response Integrity Agreement</p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl">{currentDocument.title}</h1>
                  <p className="mt-2 text-xs text-[#6B5B52] sm:text-sm">
                    {currentDocument.code} • Version {currentDocument.version}
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 sm:p-5">
                  <div className="mb-4 space-y-1">
                    <p className="text-sm font-semibold text-[#1A1A1A]">Agreement fields</p>
                    <p className="text-sm text-[#6B5B52]">These details are written into the agreement record and stored with the acceptance event.</p>
                  </div>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    {FORM_FIELDS.map((field) => {
                      const fieldValue = field.key === "legalName" ? typedFullName : formData[field.key];
                      const fieldLocked = isFieldLocked(field.key, applicationStatus, acceptanceAlreadyRecorded) || Boolean(field.readOnly);

                      return (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`reader-${field.key}`}>{field.label}</Label>
                          <Input
                            id={`reader-${field.key}`}
                            value={fieldValue}
                            placeholder={field.placeholder}
                            disabled={fieldLocked}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (field.key === "legalName") {
                                setTypedFullName(value);
                                setFormData((current) => ({ ...current, legalName: value }));
                                return;
                              }
                              setFormData((current) => ({ ...current, [field.key]: value }));
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {fieldLocked ? "Locked to the submitted application record." : "This value is written into the stored agreement snapshot."}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mb-4 space-y-1">
                    <p className="text-sm font-semibold text-[#1A1A1A]">Agreement record</p>
                    <p className="text-sm text-[#6B5B52]">The identity details below are written into this agreement and stored with the acceptance event.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">Party A</p>
                      <p className="mt-2 font-semibold text-[#1A1A1A]">Response Integrity (Pty) Ltd</p>
                      <p className="text-sm text-[#6B5B52]">The Company</p>
                    </div>
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">Party B</p>
                      <p className="mt-2 font-semibold text-[#1A1A1A]">{effectiveFormData.legalName || "[Full Name]"}</p>
                      <p className="text-sm text-[#6B5B52]">Education Growth Partner ("EGP")</p>
                    </div>
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">Effective Date</p>
                      <p className="mt-2 text-[#1A1A1A]">{effectiveFormData.effectiveDate}</p>
                    </div>
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">Account Email</p>
                      <p className="mt-2 text-[#1A1A1A]">{effectiveFormData.emailAddress || "Not captured"}</p>
                    </div>
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">Phone Number</p>
                      <p className="mt-2 text-[#1A1A1A]">{effectiveFormData.phoneNumber || "Not captured"}</p>
                    </div>
                    <div className="rounded-xl border border-[#E7D5C8] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9F1D2B]">ID Number</p>
                      <p className="mt-2 text-[#1A1A1A]">{effectiveFormData.idNumber || "Not captured"}</p>
                    </div>
                  </div>
                </div>

                <div className="agreement-reader mt-8">{agreementBody}</div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E7D5C8] bg-white px-4 py-4 sm:px-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">Read progress: {readerPercent}%</p>
                  <p className="text-xs text-[#6B5B52]">Reach the end of the agreement to unlock the acceptance workspace.</p>
                </div>
                <Button
                  type="button"
                  className="w-full bg-[#E63946] text-white hover:bg-[#cf2e3c] sm:w-auto"
                  disabled={readerPercent < 99 || !requiredFieldsComplete}
                  onClick={() => {
                    setHasCompletedReading(true);
                    setViewCompletedAt((current) => current || new Date().toISOString());
                    setReaderOpen(false);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Continue to acceptance
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .agreement-reader .agreement-section + .agreement-section {
          margin-top: 1.6rem;
          padding-top: 1.6rem;
          border-top: 1px solid #e7d5c8;
        }

        .agreement-reader .agreement-section h2 {
          margin: 0 0 0.9rem;
          font-size: 1rem;
          font-weight: 700;
          color: #7c2d12;
        }

        .agreement-reader .agreement-section-body p {
          margin: 0 0 0.85rem;
          font-size: 0.95rem;
          line-height: 1.8;
          color: #243b53;
        }

        .agreement-reader .agreement-subsection + .agreement-subsection {
          margin-top: 1.15rem;
        }

        .agreement-reader .agreement-subsection h3 {
          margin: 0 0 0.6rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: #1a1a1a;
        }

        .agreement-reader .agreement-list {
          margin: 0 0 0.9rem 1.2rem;
          padding: 0;
          list-style-type: disc;
          list-style-position: outside;
        }

        .agreement-reader .agreement-list-check {
          list-style-type: "• ";
        }

        .agreement-reader .agreement-list li {
          margin-bottom: 0.4rem;
          font-size: 0.95rem;
          line-height: 1.75;
          color: #243b53;
        }
      `}</style>
    </>
  );
}
