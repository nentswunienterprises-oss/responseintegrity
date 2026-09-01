import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeLegacyOnboardingDocumentText } from "@shared/onboardingDocumentSanitizer";
import { CheckCircle2, Download, Expand, FileCheck, FileText, Loader2, Upload } from "lucide-react";

type DocumentStatus = "not_started" | "pending_upload" | "pending_review" | "approved" | "rejected";

interface ClauseDefinition {
  key: string;
  label: string;
}

interface OnboardingDocumentDefinition {
  step: number;
  code: string;
  title: string;
  version: string;
  requiresAcceptance: boolean;
  requiresUpload: boolean;
  uploadTitle?: string;
  uploadDescription?: string;
  mandatoryClauses: ClauseDefinition[];
  content?: string;
  contentHash?: string;
}

interface SequentialDocumentSubmissionProps {
  applicationId: string;
  applicationStatus: any;
}

interface FieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  readOnly?: boolean;
  required?: boolean;
}

interface FieldResolution {
  canEdit: boolean;
  helperText: string | null;
  missingRequirement: string | null;
}

const FIELD_CAPTURE_STEP: Record<string, number> = {
  legalName: 1,
  emailAddress: 1,
  phoneNumber: 1,
  idType: 1,
  idNumber: 1,
  dateOfBirth: 1,
  schoolName: 1,
  currentStatus: 1,
  matricYear: 2,
  examNumber: 2,
};

interface DocumentRenderRules {
  nonListColonLines?: RegExp[];
  numberedListIntroLines?: RegExp[];
  plainListIntroLines?: RegExp[];
  listItemLines?: RegExp[];
}

const DOCUMENT_RENDER_RULES: Record<string, DocumentRenderRules> = {
  "Response Integrity-TCF-001": {
    nonListColonLines: [/^Document Reference:/i],
    numberedListIntroLines: [],
    plainListIntroLines: [/^[A-Z][A-Za-z0-9'().,\s/-]+:$/],
    listItemLines: [/^[A-Za-z0-9][A-Za-z0-9'()\-/,.\s]+$/],
  },
  "Response Integrity-EQV-002": {
    nonListColonLines: [/^Document Reference:/i],
    numberedListIntroLines: [],
    plainListIntroLines: [
      /^Once verified and accepted, the Contractor's continued participation is governed by:$/i,
      /^The following are not accepted:$/i,
      /^By accepting this form, the Contractor confirms all of the following:$/i,
      /^I understand that once my entry qualification is verified and accepted, my continued participation in the Response Integrity (Leadership Programme|Specialist Development Pathway) is governed by:$/i,
      /^By accepting this form in the Response Integrity platform, the Contractor confirms:$/i,
    ],
    listItemLines: [/^[A-Za-z0-9][A-Za-z0-9'()\-/,.\s]+$/],
  },
  "Response Integrity-ICA-003": {
    nonListColonLines: [/^This Agreement is entered into between:$/i, /^Document Reference:/i],
    numberedListIntroLines: [/^\d+\.\d+\s+.+:$/],
    plainListIntroLines: [/^By accepting this Agreement in the Response Integrity platform, the Contractor confirms:$/i],
    listItemLines: [/^[A-Za-z0-9][A-Za-z0-9'()\-/,.\s]+$/],
  },
  "Response Integrity-SCP-004": {
    nonListColonLines: [/^Document Reference:/i],
    numberedListIntroLines: [/^\d+\.\d+\s+.+:$/],
    plainListIntroLines: [
      /^All conduct must prioritize:$/i,
      /^All (tutor|Specialist) conduct must remain:$/i,
      /^Tutors are not:$/i,
      /^The following are strictly prohibited:$/i,
      /^The following are not permitted:$/i,
      /^This includes:$/i,
      /^The following are prohibited during sessions:$/i,
      /^Tutors must:$/i,
      /^Tutors may not:$/i,
      /^The following result in immediate suspension or termination:$/i,
      /^By accepting this policy in the Response Integrity platform, the Contractor confirms:$/i,
    ],
    listItemLines: [/^[A-Za-z0-9][A-Za-z0-9'()\-/,.\s]+$/],
  },
  "Response Integrity-DPC-005": {
    nonListColonLines: [/^Document Reference:/i],
    numberedListIntroLines: [
      /^\d+\.\d+\s+(Personal Information|Learner Data|Session Data|Technical Data)$/i,
      /^\d+\.\d+\s+.+:$/i,
    ],
    plainListIntroLines: [
      /^(tt|Response Integrity) collects and processes the following:$/i,
      /^Data is collected and used strictly to:$/i,
      /^Users have the right to:$/i,
      /^Requests may be submitted to:$/i,
      /^Note:$/i,
      /^Users may not:$/i,
      /^By accepting this agreement in the Response Integrity platform, the user confirms:$/i,
    ],
    listItemLines: [/^[A-Za-z0-9][A-Za-z0-9'()\-/,.\s:.]+$/],
  },
};

function formatCurrentSituation(value: string) {
  const normalized = String(value || "").trim();
  const labels: Record<string, string> = {
    gap_year: "Gap Year",
    waiting_uni: "Waiting For University",
    studying: "Currently Studying",
    working: "Working",
    other: "Other",
  };
  return labels[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveDateOfBirthFromSouthAfricanId(idNumber: string) {
  const digits = String(idNumber || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";

  const now = new Date();
  const currentTwoDigitYear = now.getFullYear() % 100;
  const fullYear = yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy;
  const date = new Date(fullYear, mm - 1, dd);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== fullYear ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return "";
  }

  return `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function deriveDateOfBirthConditional(idType: string, idNumber: string) {
  // Only derive date of birth from SA ID numbers
  if (idType === "sa_id" || idType === "" || !idType) {
    return deriveDateOfBirthFromSouthAfricanId(idNumber);
  }
  // For passports and other ID types, date of birth must be entered manually
  return "";
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

function normalizeAgreementContent(content: string) {
  return sanitizeLegacyOnboardingDocumentText(content)
    .replace(/\r\n/g, "\n")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜']/g, "'")
    .replace(/[â€“â€”]/g, "-")
    .replace(/â†’/g, " -> ")
    .replace(/\uFFFD/g, "")
    .replace(/Grade Level Preference:\s*[\s\S]*?(?=\nSECTION B:)/i, "")
    .replace(/\nFOR OFFICIAL USE ONLY[\s\S]*$/i, "")
    .replace(/\n(?:SECTION [A-Z]:\s*FINAL DECLARATION|[0-9]+\.\s*DECLARATION)[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getStep6UploadDescription(idType: string): string {
  if (idType === "passport") {
    return "Upload a certified copy of your passport. This is the only remaining file upload step.";
  }
  return "Upload a certified copy of your South African ID. This is the only remaining file upload step.";
}

function tokenizeAgreementLines(content: string) {
  const rawLines = normalizeAgreementContent(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];

  for (let index = 0; index < rawLines.length; index += 1) {
    const current = rawLines[index];
    const next = rawLines[index + 1];

    if (/^SECTION [A-Z]:$/i.test(current) && next && /^[A-Z][A-Z\s()/-]+$/.test(next)) {
      lines.push(`${current} ${next}`);
      index += 1;
      continue;
    }

    if (/^[A-Z][A-Z\s()/-]+$/.test(current) && next && /^[A-Z][A-Z\s()/-]+$/.test(next) && !/^SECTION [A-Z]:/i.test(next)) {
      lines.push(`${current} ${next}`);
      index += 1;
      continue;
    }

    lines.push(current);
  }

  return lines;
}

function renderAgreementHtml(content: string) {
  const lines = tokenizeAgreementLines(content);
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  let listMode = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^(SECTION [A-Z]|[0-9]+\.)/.test(line) || /^[A-Z][A-Z0-9\s/&(),.-]{8,}$/.test(line)) {
      flushList();
      const tag = /^(SECTION [A-Z]|[0-9]+\.)/.test(line) ? "h2" : "h1";
      blocks.push(`<${tag}>${escapeHtml(line)}</${tag}>`);
      listMode = false;
      continue;
    }

    const cleanedCheckboxLine = line.replace(/^\[[^\]]*\]\s*/, "");
    if (/^\[.\]/.test(line)) {
      listItems.push(line.replace(/^\[[^\]]*\]\s*/, ""));
      listMode = true;
      continue;
    }

    const isLikelyListItem =
      listMode ||
      /^[A-Z][a-z][^.!?]{0,95}$/.test(cleanedCheckboxLine) ||
      /^(employment|partnership|joint venture|agency|conduct|session execution|platform discipline|non-compliance|platform violations|session integrity issues|copy|reproduce|distribute|teach outside Response Integrity|income|student allocation|session volume|withhold payment|reverse payment|adjust payment|audit sessions|review recordings|evaluate performance|compliance|quality control|system integrity|accurate|honest|complete|placement|earnings|references|long-term engagement)$/i.test(cleanedCheckboxLine) ||
      /^(deliver|conduct|maintain|execute|record|model|apply|guide|top-down camera|clear, step-by-step visual execution|conditioning phases|stability states|Response Integrity drill system|no private communication|no acceptance of payment|consistent execution|Response Integrity-OS compliance|platform discipline|session quality failure|structural violations|misreporting or dishonest observation|platform misuse|conduct issues|may occur without prior notice|immediately halts all payment eligibility|all Response Integrity decisions regarding compliance are final|may affect payment eligibility|compliance decisions are made by Response Integrity under this policy|contractor income stability|academic or career outcomes|personal financial obligations|all tax obligations \(including sars compliance\)|placement|earnings|references|long-term engagement)$/i.test(cleanedCheckboxLine);

    if (/:$/.test(line)) {
      flushList();
      blocks.push(`<p>${escapeHtml(line)}</p>`);
      listMode = true;
      continue;
    }

    if (isLikelyListItem) {
      listItems.push(cleanedCheckboxLine);
      listMode = true;
      continue;
    }

    flushList();
    listMode = false;
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();

  return blocks.join("");
}

function normalizeAgreementContentStrict(content: string) {
  return sanitizeLegacyOnboardingDocumentText(content)
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/Grade Level Preference:\s*[\s\S]*?(?=\nSECTION B:)/i, "")
    .replace(/\nFOR OFFICIAL USE ONLY[\s\S]*$/i, "")
    .replace(/\n(?:SECTION [A-Z]:\s*FINAL DECLARATION|[0-9]+\.\s*DECLARATION)[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeAgreementLinesStrict(content: string) {
  const rawLines = normalizeAgreementContentStrict(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];
  let pendingSectionHeading: string | null = null;

  const isAllCapsHeadingFragment = (value: string) => /^[A-Z][A-Z\s()/-]+$/.test(value);

  const flushPendingHeading = () => {
    if (!pendingSectionHeading) return;
    lines.push(pendingSectionHeading);
    pendingSectionHeading = null;
  };

  for (let index = 0; index < rawLines.length; index += 1) {
    let current = rawLines[index];
    const next = rawLines[index + 1];

    if (/^SECTION [A-Z]:/i.test(current) && (!/[.!?]$/.test(current) || /[:,-]$/.test(current))) {
      pendingSectionHeading = current;
      continue;
    }

    if (pendingSectionHeading) {
      if (isAllCapsHeadingFragment(current)) {
        pendingSectionHeading = `${pendingSectionHeading} ${current}`;
        continue;
      }

      flushPendingHeading();
    }

    if (/^SECTION [A-Z]:$/i.test(current) && next && isAllCapsHeadingFragment(next)) {
      pendingSectionHeading = `${current} ${next}`;
      index += 1;
      continue;
    }

    if (isAllCapsHeadingFragment(current) && next && isAllCapsHeadingFragment(next) && !/^SECTION [A-Z]:/i.test(next)) {
      pendingSectionHeading = `${current} ${next}`;
      index += 1;
      continue;
    }

    if (
      next &&
      current.length >= 90 &&
      !/:$/.test(current) &&
      !/^(SECTION [A-Z]|\d+\.)/i.test(current) &&
      !/^[A-Z][A-Z0-9\s/&(),.-]{8,}$/.test(next) &&
      /^[a-z(]/.test(next)
    ) {
      current = `${current} ${next}`;
      index += 1;
    }

    lines.push(current);
  }

  flushPendingHeading();

  return lines;
}

export function renderAgreementHtmlStrict(content: string, documentCode?: string) {
  const lines = tokenizeAgreementLinesStrict(content);
  const blocks: string[] = [];
  let listItems: string[] = [];
  let listMode = false;
  const rules = DOCUMENT_RENDER_RULES[documentCode || ""] || {};
  const isDocumentHeading = (value: string) => /^SECTION [A-Z]/.test(value) || /^\d+\.\s+[A-Z]/.test(value);
  const isNumberedClauseLine = (value: string) => /^\d+\.\d+\s+/.test(value);
  const matchesAny = (value: string, patterns: RegExp[] | undefined) => (patterns || []).some((pattern) => pattern.test(value));
  const isPotentialListItem = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return false;
    if (/^(and|or)$/i.test(cleaned)) return false;
    if (/[.!?]$/.test(cleaned)) return false;
    if (isNumberedClauseLine(cleaned)) return false;
    if (protectedFieldLine.test(cleaned)) return false;
    if (cleaned.length > 110) return false;
    if (matchesAny(cleaned, rules.listItemLines)) return true;
    return false;
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const protectedFieldLine =
    /^(Full Name:|Contact Number:|Date of Birth:|Email Address:|ID Type:|Identification Type|Identification Number:|ID Number:|School Attended \(Matric\):|Current Status|Matric Year:|School Where Matric Was Completed:|Print Name:|Document Reference:)/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const isProtectedFieldLine = protectedFieldLine.test(line);

    if (isDocumentHeading(line) || /^[A-Z][A-Z0-9\s/&(),.-]{8,}$/.test(line)) {
      flushList();
      const tag = isDocumentHeading(line) ? "h2" : "h1";
      blocks.push(`<${tag}>${escapeHtml(line)}</${tag}>`);
      listMode = false;
      continue;
    }

    if (isProtectedFieldLine) {
      flushList();
      listMode = false;
      blocks.push(`<p>${escapeHtml(line)}</p>`);
      continue;
    }

    if (isNumberedClauseLine(line) && !matchesAny(line, rules.numberedListIntroLines)) {
      flushList();
      listMode = false;
      blocks.push(`<p>${escapeHtml(line)}</p>`);
      continue;
    }

    const inlineColonMatch = line.match(/^([A-Z][A-Za-z0-9\s()/-]{2,48}:)\s+(.+)$/);
    if (inlineColonMatch && !isProtectedFieldLine) {
      flushList();
      blocks.push(`<p>${escapeHtml(inlineColonMatch[1])}</p>`);
      listItems.push(inlineColonMatch[2]);
      listMode = true;
      continue;
    }

    if (matchesAny(line, rules.numberedListIntroLines)) {
      flushList();
      blocks.push(`<p>${escapeHtml(line)}</p>`);
      listMode = true;
      continue;
    }

    const cleanedCheckboxLine = line.replace(/^\[[^\]]*\]\s*/, "");
    if (/^\[.\]/.test(line)) {
      listItems.push(cleanedCheckboxLine);
      listMode = true;
      continue;
    }

    if (matchesAny(line, rules.plainListIntroLines)) {
      flushList();
      blocks.push(`<p>${escapeHtml(line)}</p>`);
      listMode = true;
      continue;
    }

    if (listMode) {
      if (isPotentialListItem(cleanedCheckboxLine)) {
        listItems.push(cleanedCheckboxLine);
        continue;
      }
      flushList();
      listMode = false;
    }

    flushList();
    listMode = false;
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();
  return blocks.join("");
}

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDisplayedVersion(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "1";
  if (/^tt-[A-Z]+-\d{3}$/i.test(normalized)) return "1";
  return normalized;
}

function buildInitialFormData(fields: FieldDefinition[], application: any, acceptance: any) {
  const savedForm = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
  const applicationIdType = normalizeValue(application?.idType || application?.id_type || "sa_id");
  const applicationIdNumber = normalizeValue(application?.idNumber || application?.id_number);
  const applicationCurrentSituation = normalizeValue(
    application?.currentSituationOther ||
    application?.current_situation_other ||
    formatCurrentSituation(application?.currentSituation || application?.current_situation)
  );
  const applicationSchool = normalizeValue(
    application?.schoolAttended ||
    application?.school_attended ||
    application?.school ||
    application?.schoolName ||
    application?.school_name
  );
  const initial: Record<string, string> = {
    legalName: normalizeValue(
      acceptance?.typedFullName ||
      acceptance?.typed_full_name ||
      application?.fullName ||
      application?.full_name
    ),
    emailAddress: normalizeValue(application?.email),
    phoneNumber: normalizeValue(application?.phone),
    idType: applicationIdType,
    idNumber: applicationIdNumber,
    dateOfBirth: deriveDateOfBirthConditional(applicationIdType, applicationIdNumber),
    matricYear: normalizeValue(application?.matricYear || application?.matric_year),
    schoolName: applicationSchool,
    currentStatus: applicationCurrentSituation,
    examNumber: normalizeValue(application?.examNumber || application?.exam_number),
  };

  for (const field of fields) {
    const savedValue = normalizeValue(savedForm[field.key]);
    if (savedValue) {
      initial[field.key] = savedValue;
    }
  }

  return Object.fromEntries(fields.map((field) => [field.key, initial[field.key] || ""]));
}

function buildAcceptanceDerivedFormData(acceptance: any) {
  const savedForm = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
  const idType = normalizeValue(savedForm.idType || "sa_id");
  return {
    legalName: normalizeValue(acceptance?.typedFullName || acceptance?.typed_full_name || savedForm.legalName),
    emailAddress: normalizeValue(savedForm.emailAddress),
    phoneNumber: normalizeValue(savedForm.phoneNumber),
    idType: idType,
    idNumber: normalizeValue(savedForm.idNumber),
    dateOfBirth: normalizeValue(savedForm.dateOfBirth),
    matricYear: normalizeValue(savedForm.matricYear),
    schoolName: normalizeValue(savedForm.schoolName),
    currentStatus: normalizeValue(savedForm.currentStatus),
    examNumber: normalizeValue(savedForm.examNumber),
  };
}

function buildApplicationLockedFormData(application: any) {
  const applicationIdType = normalizeValue(application?.idType || application?.id_type || "sa_id");
  const applicationIdNumber = normalizeValue(application?.idNumber || application?.id_number);
  return {
    legalName: normalizeValue(application?.fullName || application?.full_name),
    emailAddress: normalizeValue(application?.email),
    phoneNumber: normalizeValue(application?.phone),
    idType: applicationIdType,
    idNumber: applicationIdNumber,
    dateOfBirth: deriveDateOfBirthConditional(applicationIdType, applicationIdNumber),
    matricYear: normalizeValue(application?.matricYear || application?.matric_year),
    schoolName: normalizeValue(
      application?.schoolAttended ||
      application?.school_attended ||
      application?.school ||
      application?.schoolName ||
      application?.school_name
    ),
    currentStatus: normalizeValue(
      application?.currentSituationOther ||
      application?.current_situation_other ||
      formatCurrentSituation(application?.currentSituation || application?.current_situation)
    ),
    examNumber: normalizeValue(application?.examNumber || application?.exam_number),
  };
}

export function hydrateDocumentContent(content: string, fieldValues: Record<string, string>) {
  const sanitizedContent = sanitizeLegacyOnboardingDocumentText(content);
  const idTypeLabel = fieldValues.idType === "passport" ? "Passport" : "South African ID";
  const replacements: Array<[RegExp, string]> = [
    [/Full Name:\s*_+/i, `Full Name: ${fieldValues.legalName || "______________________________"}`],
    [/Contact Number:\s*_+/i, `Contact Number: ${fieldValues.phoneNumber || "______________________________"}`],
    [/Date of Birth:\s*_+/i, `Date of Birth: ${fieldValues.dateOfBirth || "______________________________"}`],
    [/Email Address:\s*_+/i, `Email Address: ${fieldValues.emailAddress || "______________________________"}`],
    [/Identification Type \(SA ID \/ Passport\):\s*_+/i, `Identification Type (SA ID / Passport): ${idTypeLabel || "______________________________"}`],
    [/ID Type:\s*_+/i, `ID Type: ${idTypeLabel || "______________________________"}`],
    [/Identification Number:\s*_+/i, `Identification Number: ${fieldValues.idNumber || "______________________________"}`],
    [/ID Number:\s*_+/i, `ID Number: ${fieldValues.idNumber || "______________________________"}`],
    [/School Attended \(Matric\):\s*_+/i, `School Attended (Matric): ${fieldValues.schoolName || "______________________________"}`],
    [/Current Status \(e\.g\.\s*Gap Year,\s*University Student,\s*Graduate\):\s*_*\s*/i, `Current Status (e.g. Gap Year, University Student, Graduate): ${fieldValues.currentStatus || "______________________________"}\n`],
    [/Matric Year:\s*_+/i, `Matric Year: ${fieldValues.matricYear || "______________________________"}`],
    [/School Where Matric Was Completed:\s*_+/i, `School Where Matric Was Completed: ${fieldValues.schoolName || "______________________________"}`],
    [/Print Name:\s*_+/i, `Print Name: ${fieldValues.legalName || "______________________________"}`],
  ];

  let next = sanitizedContent;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
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

function buildTutorAgreementBody(document: OnboardingDocumentDefinition, formData: Record<string, string>) {
  switch (document.code) {
    case "Response Integrity-TCF-001":
      return (
        <>
          <TutorAgreementSection title="Contractor Details">
            <p>This in-app agreement must be completed before participation begins.</p>
            <div className="tt-inline-detail-grid">
              <div><span>Full Name</span><strong>{formData.legalName || "Not captured"}</strong></div>
              <div><span>Contact Number</span><strong>{formData.phoneNumber || "Not captured"}</strong></div>
              <div><span>Date of Birth</span><strong>{formData.dateOfBirth || "Not captured"}</strong></div>
              <div><span>Email Address</span><strong>{formData.emailAddress || "Not captured"}</strong></div>
              <div><span>ID Number</span><strong>{formData.idNumber || "Not captured"}</strong></div>
              <div><span>School Attended (Matric)</span><strong>{formData.schoolName || "Not captured"}</strong></div>
              <div className="tt-inline-detail-span"><span>Current Status</span><strong>{formData.currentStatus || "Not captured"}</strong></div>
            </div>
          </TutorAgreementSection>

          <TutorAgreementSection title="Specialist Development Pathway And Role">
            <p>By accepting this form, the Contractor acknowledges and accepts the following:</p>
            <TutorAgreementList items={[
              "Response Integrity is not a tutoring service.",
              "It is a response-conditioning system delivered through mathematics.",
              "The purpose of every session is to build reliable learner response under difficulty through phase-appropriate instruction, practice, correction, and pressure progression.",
              "The Contractor operates as a Response Integrity Specialist: a response-conditioning operator responsible for stabilizing learner execution under pressure.",
            ]} />
            <p>Every session is executed strictly under the Response Integrity Operating System (Response Integrity-OS). The required structure depends on the learner&apos;s diagnosed phase, assigned drill, and current stability state.</p>
            <TutorAgreementList items={[
              <><strong>Clarity and concept-entry work:</strong> Use Model -&gt; Apply -&gt; Guide to build recognition, method understanding, and first-step execution</>,
              <><strong>Later conditioning phases:</strong> Prioritize independent execution, controlled friction, pressure exposure, stability checks, and accurate logging</>,
              <><strong>Non-negotiable restraint:</strong> Do not over-model, over-guide, rescue, or turn conditioning sessions into ordinary lessons</>,
            ]} />
            <p>The Contractor does not fix answers. The Contractor fixes how the learner behaves when answers are unclear.</p>
            <p>Specialist progression is structured through application, onboarding, training, Battle Tests, Sandbox, Trial, and Certified Live operation. Certification is not automatic and requires demonstrated execution integrity before live responsibility.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Session Structure And Delivery">
            <p>The Contractor agrees to the following operational requirements:</p>
            <TutorAgreementList items={[
              "Deliver 1-on-1 online sessions to assigned learners",
              "Deliver assigned sessions under Response Integrity family packages unless otherwise instructed by Response Integrity",
              "Conduct all sessions through the Response Integrity platform only",
            ]} />
            <p>Maintain required setup:</p>
            <TutorAgreementList items={[
              "Smartphone or camera capable of showing a clear top-down view of written work",
              "Mini ring light or equivalent lighting",
              "Earphones or headset suitable for clear online instruction",
              "Clear, step-by-step visual execution",
              "Gooseneck or stable top-down stand recommended where needed to preserve visibility",
            ]} />
            <p>Execute structured drill-based sessions aligned with:</p>
            <TutorAgreementList items={["Conditioning phases", "Stability states", "Response Integrity drill system"]} />
            <p>Record accurate session observations within the platform. Observation integrity is mandatory, not optional.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Operating Standards">
            <p>The Contractor agrees to the following:</p>
            <TutorAgreementList items={["All sessions must follow the phase-appropriate Response Integrity-OS requirements without tutor improvisation"]} />
            <p>The following are not permitted:</p>
            <TutorAgreementList items={[
              "Explaining instead of training",
              "Skipping structure",
              "Rescuing learners",
              "Feeding answers",
              "Advancing learners without required stability",
            ]} />
            <p>Phase progression is controlled by demonstrated stability, not Specialist judgment alone.</p>
            <p>All session data, drill execution, and observations must be accurate, honest, complete, and evidence-based.</p>
            <p>The Contractor must record observable facts rather than invented psychological interpretations, and may not falsify, soften, exaggerate, or manufacture observations.</p>
            <p>The Contractor must preserve drill conditions so learner evidence remains valid for progression, reporting, audit, and parent-facing claims. Any deviation from the Response Integrity-OS is considered non-compliance.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Platform And Communication Control">
            <p>The Contractor agrees:</p>
            <TutorAgreementList items={[
              "All sessions, communication, and operations must occur within the Response Integrity platform",
              "No private communication with learners or parents outside approved platform channels is permitted",
              "No acceptance of payment outside the platform is permitted",
            ]} />
            <p>Sessions may be recorded and stored where required for compliance, quality control, and system integrity.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Contractor Status And Payment">
            <p>The Contractor acknowledges:</p>
            <TutorAgreementList items={[
              "They are engaged as an independent contractor, not an employee",
              "No employment relationship, benefits, or protections apply",
            ]} />
            <p>Payment is earned per eligible completed session and is calculated and released on the relevant package completion payout schedule, subject to Response Integrity&apos;s current rate structure.</p>
            <p>There is no guaranteed income, minimum earnings, or guaranteed session volume, and incomplete or non-compliant sessions may not be eligible for payment.</p>
            <p>Payment may be adjusted or withheld in cases of non-compliance, platform violations, session integrity issues, or evidence integrity breaches.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Performance, Suspension, And Termination">
            <p>Participation is conditional on consistent execution, Response Integrity-OS compliance, and platform discipline.</p>
            <p>Response Integrity may suspend or terminate participation at its discretion, including but not limited to:</p>
            <TutorAgreementList items={[
              "Session quality failure",
              "Structural violations",
              "Misreporting or dishonest observation",
              "Platform misuse",
              "Conduct issues",
            ]} />
            <p>Suspension or termination may occur without prior notice where necessary and may affect payment eligibility. Compliance decisions are made by Response Integrity under this policy.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Risk And Liability">
            <p>The Contractor accepts:</p>
            <TutorAgreementList items={[
              "Response Integrity is not responsible for contractor income stability, academic or career outcomes, or personal financial obligations",
              "The Contractor is responsible for all tax obligations (including SARS compliance)",
            ]} />
            <p>Participation does not guarantee placement, earnings, references, or long-term engagement.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Governing Law And Dispute Resolution">
            <p>This agreement is governed by the laws of the Republic of South Africa.</p>
            <p>Disputes must first be referred to mediation before further legal action. The Contractor consents to the jurisdiction of South African courts.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Acceptance">
            <p>By accepting this form in the Response Integrity platform, the Contractor confirms:</p>
            <TutorAgreementList tone="check" items={[
              "They have read and understood this document in full",
              "They accept all operational, structural, and performance requirements",
              "They agree to operate strictly within the system",
              "They understand that continued deviation may lead to removal from the system",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-EQV-002":
      return (
        <>
          <TutorAgreementSection title="Purpose Of This Form">
            <p>This in-app agreement is completed once at onboarding to verify that the Contractor meets Response Integrity&apos;s minimum entry qualification requirement through submission of an official Matric certificate.</p>
            <p>Matric completion is required for entry into Specialist onboarding. Applicants must be 18 years or older unless they completed Matric early and can submit the required certified certificate.</p>
            <p>This verification is an entry threshold only. It confirms eligibility to enter the Specialist Development Pathway and does not qualify the Contractor to operate independently of the training, operating system, or session standards.</p>
            <p>Once verified and accepted, continued participation is governed by conduct, session execution, Response Integrity-OS compliance, and operational performance within the platform.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Contractor Details">
            <div className="tt-inline-detail-grid">
              <div><span>Full Name</span><strong>{formData.legalName || "Not captured"}</strong></div>
              <div><span>Identification Type</span><strong>{formData.idType === "passport" ? "Passport" : "SA ID"}</strong></div>
              <div><span>Identification Number</span><strong>{formData.idNumber || "Not captured"}</strong></div>
              {formData.dateOfBirth && <div><span>Date of Birth</span><strong>{formData.dateOfBirth}</strong></div>}
              <div><span>Contact Number</span><strong>{formData.phoneNumber || "Not captured"}</strong></div>
              <div><span>Email Address</span><strong>{formData.emailAddress || "Not captured"}</strong></div>
              <div><span>Matric Year</span><strong>{formData.matricYear || "Not captured"}</strong></div>
              <div className="tt-inline-detail-span"><span>School Where Matric Was Completed</span><strong>{formData.schoolName || "Not captured"}</strong></div>
            </div>
          </TutorAgreementSection>

          <TutorAgreementSection title="Matric Certificate Submission">
            <p>The Contractor must submit a certified copy of their official National Senior Certificate issued by the Department of Basic Education.</p>
            <p>The following are not accepted:</p>
            <TutorAgreementList items={["Uncertified copies", "Screenshots", "Altered or incomplete documents"]} />
            <p>Response Integrity reserves the right to verify submitted results directly with the relevant examining authority.</p>
          </TutorAgreementSection>

          <TutorAgreementSection title="Entry Qualification And Onboarding Acknowledgements">
            <p>By accepting this form, the Contractor confirms all of the following:</p>
            <TutorAgreementList items={[
              "The Contractor has completed Matric.",
              "Applicants must be 18 years or older unless they completed Matric early and can submit the required certified certificate.",
              "The Matric certificate submitted is an official, complete, and accurate National Senior Certificate issued by the Department of Basic Education.",
              "This verification confirms entry eligibility only and does not by itself qualify the Contractor to operate as a Specialist without compliance with the training system and session standards.",
              "Specialist performance is defined by execution within Response Integrity-OS, not by academic credentials alone.",
              "Once entry qualification is verified and accepted, continued participation in the Specialist Development Pathway is governed by conduct, session execution, adherence to Response Integrity-OS, and operational performance within the platform.",
              "No further academic submissions or qualification reviews will be required after this verification.",
              "Submission of a falsified, altered, or misrepresented Matric certificate constitutes a material breach of the Independent Contractor Agreement (Response Integrity-ICA-003) and may result in immediate termination.",
              "All personal and contact details submitted to Response Integrity are accurate and correct.",
            ]} />
          </TutorAgreementSection>

          <TutorAgreementSection title="Acceptance">
            <p>By accepting this form in the Response Integrity platform, the Contractor confirms:</p>
            <TutorAgreementList tone="check" items={[
              "All information provided in this form is true and correct",
              "They have submitted a certified copy of their official Matric certificate",
              "They understand the role of this verification as an entry requirement only",
              "They understand that continued participation is governed by Response Integrity's operational standards, not academic re-evaluation",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-ICA-003":
      return (
        <>
          <TutorAgreementSection title="Parties">
            <p>This Agreement is entered into between Response Integrity (Pty) Ltd ("Response Integrity" or "the Company") and the Contractor as identified in onboarding documentation.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Nature Of Relationship">
            <TutorAgreementSubsection title="2.1 - 2.4">
              <p>The Contractor is engaged as an independent contractor.</p>
              <p>Nothing in this Agreement creates employment, partnership, joint venture, or agency.</p>
            <p>The Contractor operates independently, controls their own tax obligations, is not entitled to employee benefits, and provides services only within the platform environment and defined operating systems.</p>
            </TutorAgreementSubsection>
          </TutorAgreementSection>
          <TutorAgreementSection title="Business Model Acknowledgement">
            <p>The Contractor acknowledges that Response Integrity is not a tutoring company; it is a response-conditioning system delivered through mathematics.</p>
            <p>The Contractor&apos;s role is to execute structured response-conditioning sessions, train learner behavior under difficulty, preserve valid drill conditions, record evidence with integrity, and operate within Response Integrity&apos;s system rather than personal teaching style.</p>
            <p>Response Integrity-OS governs all sessions, defines how they are executed, and treats deviation from the operating system as a compliance issue.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Scope Of Services">
            <p>The Contractor agrees to:</p>
            <TutorAgreementList items={[
              "Deliver 1-on-1 online sessions to assigned learners",
              "Execute all sessions in accordance with Response Integrity-OS",
              "Record accurate session observations",
              "Maintain required technical setup, including a clear top-down view of written work, suitable lighting, and clear audio",
            ]} />
            <p>The Contractor may not:</p>
            <TutorAgreementList items={[
              "Provide off-platform services to assigned learners or through platform relationships",
              "Communicate with assigned learners or parents outside the platform",
              "Modify session structure",
            ]} />
          </TutorAgreementSection>
          <TutorAgreementSection title="Platform Control">
            <p>All services must occur within the Response Integrity platform.</p>
            <p>The Contractor agrees that Response Integrity owns the platform environment and controls access, scheduling, and assignment.</p>
            <p>Response Integrity may assign or remove learners, adjust schedules, and manage platform access based on operational requirements.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Payment Structure">
            <p>The Contractor earns per eligible completed session.</p>
            <p>Payment structure is defined by Response Integrity and may be updated at any time with notice.</p>
            <p>Payment is calculated and released according to the relevant package completion payout schedule.</p>
            <p>Payment is conditional on eligible completed sessions, package completion payout timing, Response Integrity-OS compliance, accurate reporting, and evidence integrity.</p>
            <p>Response Integrity may adjust or withhold payment where sessions are non-compliant, reporting is inaccurate, evidence is falsified, softened, exaggerated, or manufactured, or platform rules are violated.</p>
            <p>There are no guarantees regarding income, student allocation, or session volume.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Performance And Compliance">
            <p>The Contractor must follow Response Integrity-OS strictly, maintain session integrity, comply with platform rules, record observable evidence truthfully, distinguish observed behaviour from interpretation, and preserve phase, drill, set, and repetition conditions.</p>
            <p>The following constitute breaches:</p>
            <TutorAgreementList items={[
              "Rescuing learners",
              "Skipping structure",
              "Misreporting observations",
              "Falsifying, softening, exaggerating, or manufacturing evidence",
              "Advancing learners incorrectly",
              "Operating outside approved platform channels",
            ]} />
            <p>Response Integrity may audit sessions, review recordings where required, evaluate performance, and use recorded evidence for progression, reporting, audit, and parent-facing claims.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Evidence Integrity">
            <p>Session observations are not casual notes. Evidence captured by the Contractor may feed learner progression, internal audit, operational decisions, and reports to parents or guardians.</p>
            <p>The Contractor must record what occurred, not what they assume occurred. The Contractor may not invent psychological explanations, alter the record to make a session appear stronger, or report a learner response that did not happen.</p>
            <p>Breach of evidence integrity is a material breach of this Agreement.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Intellectual Property">
            <p>All Response Integrity materials are proprietary, including:</p>
            <TutorAgreementList items={[
              "Response Integrity Operating System (Response Integrity-OS)",
              "Drill structures",
              "Session frameworks",
              "Stability progression logic",
              "Reporting systems",
            ]} />
            <p>The Contractor may not copy, reproduce, distribute, or teach these systems or materials outside authorized platform use.</p>
            <p>All session data, recordings, and learner information remain company property.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Confidentiality">
            <p>The Contractor agrees to maintain confidentiality over company systems, learner data, and operational processes. This obligation continues after termination.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Restriction On Circumvention">
            <p>The Contractor may not engage assigned learners privately, solicit assigned parents, or redirect platform relationships into private arrangements. Any attempt to circumvent the platform constitutes a material breach.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Suspension And Termination">
            <p>Response Integrity may suspend or terminate this Agreement at its discretion, with notice where appropriate or immediately in serious cases.</p>
            <p>Grounds include non-compliance, performance failure, platform violations, and conduct issues.</p>
            <p>Upon termination, platform access may end immediately and payment eligibility may cease.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Liability">
            <p>Response Integrity does not guarantee income, results, or continued engagement.</p>
            <p>The Contractor assumes full responsibility for tax obligations and personal financial matters.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Governing Law">
            <p>This Agreement is governed by the laws of South Africa. Disputes must first go to mediation before legal action.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Entire Agreement">
            <p>This Agreement forms part of the contractor framework governing work on the platform, alongside Response Integrity-TCF-001, Response Integrity-EQV-002, and the Response Integrity Terms of Use. In case of conflict, the Company&apos;s operational interpretation prevails.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Acceptance">
            <p>By accepting this Agreement in the Response Integrity platform, the Contractor confirms:</p>
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
          <TutorAgreementSection title="Purpose">
            <p>This policy defines the safeguarding standards, conduct rules, and interaction boundaries required of all Specialists operating within the Response Integrity platform.</p>
            <p>Response Integrity operates with minor learners in a controlled online environment. This policy applies as a condition of platform access.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Core Principle">
            <p>All Specialist conduct must remain professional, structured, and bounded to the session environment.</p>
            <p>Specialists are operators within a controlled system, not friends, mentors outside scope, or personal contacts.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Platform-Only Interaction">
            <p>All interaction must occur within the Response Integrity platform.</p>
            <p>The following are not permitted:</p>
            <TutorAgreementList items={[
              "Private messaging with learners",
              "Contact via WhatsApp, Instagram, SMS, or any external platform",
              "Direct communication with parents outside approved channels",
            ]} />
            <p>Specialists may not exchange personal contact details, accept contact requests, or initiate communication outside the platform.</p>
            <p>Any attempt by a learner or parent to move communication outside the platform must be declined immediately and reported to Response Integrity.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Session Environment Requirements">
            <p>All sessions must be conducted through approved systems, be recorded in full where required, and follow Response Integrity-OS structure.</p>
            <p>Specialists must maintain a clear visual setup, an appropriate environment, and a distraction-free session setting.</p>
            <p>The following are prohibited during sessions:</p>
            <TutorAgreementList items={[
              "Inappropriate background environments",
              "Presence of unrelated individuals",
              "Multitasking unrelated to session execution",
            ]} />
          </TutorAgreementSection>
          <TutorAgreementSection title="Professional Conduct With Learners">
            <p>Specialists must communicate clearly and respectfully, maintain emotional neutrality, and enforce structure during sessions.</p>
            <p>Specialists may not engage in casual or personal conversations unrelated to the session, discuss personal life or sensitive topics, or form emotional dependency or familiarity with learners.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Serious Conduct Violations">
            <p>The following result in immediate suspension or termination:</p>
            <TutorAgreementList items={[
              "Any inappropriate or suggestive communication",
              "Any form of harassment, intimidation, or discrimination",
              "Sharing personal contact information",
              "Attempting to meet learners physically",
              "Any conduct that places a learner at risk",
            ]} />
            <p>Serious breaches may lead to immediate action, including suspension or termination.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Boundary Enforcement">
            <p>Specialists must maintain strict boundaries at all times.</p>
            <TutorAgreementList items={[
              "No personal favors",
              "No gifts",
              "No off-platform assistance",
              "No extended communication beyond scheduled sessions",
            ]} />
            <p>Specialists must not position themselves as a personal support system, provide advice outside academic scope, or engage in private tutoring outside the platform.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Session Recording And Monitoring">
            <p>Sessions may be recorded where required and may be reviewed for safeguarding, compliance, and quality control.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Reporting Obligations">
            <p>Specialists must report immediately:</p>
            <TutorAgreementList items={[
              "Boundary violations",
              "Inappropriate learner behavior",
              "Attempts to move communication off-platform",
              "Any safeguarding concerns",
            ]} />
            <p>Failure to report may be treated as non-compliance.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Data And Confidentiality">
            <p>Specialists must protect learner data, not store or share recordings externally, and not disclose learner information. All learner data remains company property.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Digital Conduct And Presence">
            <p>Specialists must present professionally on camera and use appropriate language at all times.</p>
            <p>The following are prohibited:</p>
            <TutorAgreementList items={["Offensive language", "Inappropriate attire", "Disruptive or unprofessional behavior"]} />
          </TutorAgreementSection>
          <TutorAgreementSection title="Enforcement">
            <p>Response Integrity applies this policy consistently.</p>
            <p>Violations may result in suspension, termination, or payment impact under this policy.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Acceptance">
            <p>By accepting this policy in the Response Integrity platform, the Contractor confirms:</p>
            <TutorAgreementList tone="check" items={[
              "Understanding of all safeguarding requirements",
              "Agreement to operate within strict boundaries",
              "Acceptance of this enforcement standard",
            ]} />
          </TutorAgreementSection>
        </>
      );
    case "Response Integrity-DPC-005":
      return (
        <>
          <TutorAgreementSection title="Purpose">
            <p>This agreement records consent for the collection, processing, storage, and use of personal and performance data within the Response Integrity platform.</p>
            <p>Response Integrity operates a data-driven response-conditioning system. Recording may be required where it is part of the active programme flow. Data is required for the system to function.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Types Of Data Collected">
            <TutorAgreementSubsection title="2.1 Personal Information">
              <TutorAgreementList items={["Full name", "Contact details", "Identification details (where required)", "Bank account details for payment processing only", "Signed consent and contractual documentation"]} />
            </TutorAgreementSubsection>
            <TutorAgreementSubsection title="2.2 Learner Data">
              <TutorAgreementList items={["Academic performance data", "Session results and progression", "Stability states and phase tracking"]} />
            </TutorAgreementSubsection>
            <TutorAgreementSubsection title="2.3 Session Data">
              <TutorAgreementList items={["Video and audio recordings where required", "Specialist observations and reports", "Interaction logs within the platform"]} />
            </TutorAgreementSubsection>
            <TutorAgreementSubsection title="2.4 Technical Data">
              <TutorAgreementList items={["Device and access information", "Platform usage data"]} />
            </TutorAgreementSubsection>
          </TutorAgreementSection>
          <TutorAgreementSection title="Purpose Of Data Processing">
            <p>Data is collected and used strictly to:</p>
            <TutorAgreementList items={[
              "Deliver Response Integrity's response-conditioning system",
              "Track learner progression through phases and stability states",
              "Maintain session integrity and auditability",
              "Monitor Specialist compliance with Response Integrity-OS",
              "Generate reports for parents or guardians",
              "Ensure safeguarding and platform security",
              "Comply with POPIA, tax legislation, and any mandatory reporting requirements",
            ]} />
            <p>Data is not collected for unrelated purposes.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Session Recording Consent">
            <p>Sessions may be recorded in full where required and stored securely within platform systems.</p>
            <p>Recordings are used for quality control, safeguarding, compliance audits, and performance verification.</p>
            <p>By participating, the user consents to being recorded during required sessions, and to storage and review of those recordings. Participation may not be possible without recording consent where recording is part of the active programme flow.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Data Storage And Security">
            <p>Response Integrity implements reasonable technical and organisational measures to protect data against loss, prevent unauthorized access, and ensure data integrity.</p>
            <p>Data is stored on secure systems and accessed only by authorized Response Integrity personnel.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Data Sharing">
            <p>Response Integrity does not sell personal data.</p>
            <p>Data may be shared only internally within Response Integrity for operational purposes, with service providers required to operate the platform, or where required by law.</p>
            <p>No external sharing occurs for marketing or unrelated purposes.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Data Retention">
            <p>Data is retained for as long as necessary to operate the platform, maintain historical performance records, and meet legal and compliance obligations.</p>
            <p>Response Integrity may retain anonymized data for system improvement and internal analysis.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="User Rights (POPIA)">
            <p>Users have the right to request access to their personal data, request correction of inaccurate data, request deletion where legally permissible, and lodge a complaint with the Information Regulator of South Africa.</p>
            <p>Requests may be submitted to legal@responseintegrity.co.za.</p>
            <p>Deletion requests may be limited where data is required for compliance, safeguarding, or dispute resolution.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Data Use Limitations">
            <p>Users may not record sessions independently without approval, distribute session recordings, or share learner data outside the platform. All data remains under company control.</p>
          </TutorAgreementSection>
          <TutorAgreementSection title="Consent Acknowledgement">
            <p>By accepting this agreement in the Response Integrity platform, the user confirms:</p>
            <TutorAgreementList tone="check" items={[
              "Understanding of the data collected and its purpose",
              "Consent to full session recording where required",
              "Acceptance of data processing as required by the system",
              "Understanding that participation requires data processing",
            ]} />
          </TutorAgreementSection>
        </>
      );
    default:
      return <div dangerouslySetInnerHTML={{ __html: renderAgreementHtmlStrict(hydrateDocumentContent(document.content || "", formData), document.code) }} />;
  }
}

function buildAcceptedCopyHtml(params: {
  document: OnboardingDocumentDefinition;
  acceptance: any;
  typedFullName: string;
  formData: Record<string, string>;
  fields: FieldDefinition[];
}) {
  const { document, acceptance, typedFullName, formData, fields } = params;
  const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at || null;
  const acceptedName = acceptance?.typedFullName || acceptance?.typed_full_name || typedFullName || "Not available";
  const documentHash = acceptance?.documentChecksum || acceptance?.document_checksum || document.contentHash || "Not available";
  const documentVersion = normalizeDisplayedVersion(acceptance?.documentVersion || acceptance?.document_version || document.version);
  const clauseKeys = acceptance?.acceptedClausesJson || acceptance?.accepted_clauses_json || [];
  const tutorDetailsRows = fields
    .map((field) => {
      const value = String(formData[field.key] || "").trim();
      if (!value) return "";
      return `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(value)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");
  const clauseRows = (document.mandatoryClauses || [])
    .filter((clause) => clauseKeys.includes(clause.key))
    .map((clause) => `<li>${escapeHtml(clause.label)}</li>`)
    .join("");
  const acceptedAgreementBody = renderToStaticMarkup(
    <div className="agreement-body">
      {buildTutorAgreementBody(document, { ...formData, legalName: acceptedName })}
    </div>
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
    .agreement-body { margin-top: 12px; }
    .agreement-body h1, .agreement-body h2 { font-family: Arial, sans-serif; color: #102a43; }
    .agreement-body h1 { font-size: 11px; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.02em; }
    .agreement-body h2 { font-size: 11px; margin: 12px 0 6px; }
    .agreement-body p { margin: 0 0 10px; font: 400 13px/1.7 Arial, sans-serif; }
    .agreement-body ul { margin: 0 0 10px 18px; padding: 0; }
    .agreement-body li { margin-bottom: 5px; font: 400 13px/1.6 Arial, sans-serif; }
    .agreement-body .tt-agreement-section + .tt-agreement-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7d5c8; }
    .agreement-body .tt-agreement-section h2 { margin: 0 0 10px; font: 700 14px/1.4 Arial, sans-serif; color: #7b341e; }
    .agreement-body .tt-agreement-section-body p { margin: 0 0 10px; font: 400 13px/1.7 Arial, sans-serif; color: #243b53; }
    .agreement-body .tt-agreement-subsection + .tt-agreement-subsection { margin-top: 14px; }
    .agreement-body .tt-agreement-subsection h3 { margin: 0 0 8px; font: 700 13px/1.4 Arial, sans-serif; color: #102a43; }
    .agreement-body .tt-agreement-list { margin: 0 0 10px 18px; padding: 0; }
    .agreement-body .tt-agreement-list li { margin-bottom: 5px; font: 400 13px/1.6 Arial, sans-serif; color: #243b53; }
    .agreement-body .tt-agreement-list-check { list-style-type: "• "; }
    .agreement-body .tt-inline-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .agreement-body .tt-inline-detail-grid > div { padding: 10px 12px; border: 1px solid #ddd3c5; border-radius: 12px; background: #f8f2e8; }
    .agreement-body .tt-inline-detail-grid .tt-inline-detail-span { grid-column: span 2; }
    .agreement-body .tt-inline-detail-grid span { display: block; margin-bottom: 4px; font: 700 10px/1.4 Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #9f1d2b; }
    .agreement-body .tt-inline-detail-grid strong { font: 600 13px/1.5 Arial, sans-serif; color: #102a43; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd3c5; font: 400 11px/1.5 Arial, sans-serif; color: #7b8794; }
    .signature { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .signature-box { padding-top: 10px; border-top: 1px solid #9fb3c8; font: 400 12px/1.5 Arial, sans-serif; }
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
    <p class="subhead">${escapeHtml(document.code)} | Version ${escapeHtml(documentVersion)} | Accepted in-app against the Specialist's authenticated Response Integrity account</p>

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
        <tr><th>Party B</th><td>${escapeHtml(acceptedName)} (Contractor)</td></tr>
      </table>
    </section>

    ${tutorDetailsRows ? `<section class="section"><h2 class="section-title">Specialist Details Captured At Acceptance</h2><table>${tutorDetailsRows}</table></section>` : ""}
    ${clauseRows ? `<section class="section"><h2 class="section-title">Acknowledged Clauses</h2><ul class="clauses">${clauseRows}</ul></section>` : ""}

    <section class="section">
      <h2 class="section-title">Accepted Agreement Text</h2>
      ${acceptedAgreementBody}
    </section>

    <section class="signature">
      <div class="signature-box">Specialist acceptance name: ${escapeHtml(acceptedName)}</div>
      <div class="signature-box">Accepted timestamp: ${escapeHtml(formatAcceptedAt(acceptedAt))}</div>
    </section>

    <div class="footer">
      This accepted copy was generated from Response Integrity's stored onboarding acceptance record and the in-app agreement renderer used for this document flow.
    </div>
  </main>
</body>
</html>`;
}

const DEFAULT_DOCUMENT_STATUSES: Record<string, DocumentStatus> = {
  "1": "pending_upload",
  "2": "not_started",
  "3": "not_started",
  "4": "not_started",
  "5": "not_started",
  "6": "not_started",
};

const DOCUMENT_FORM_FIELDS: Record<number, FieldDefinition[]> = {
  1: [
    { key: "legalName", label: "Full legal name", placeholder: "Enter your full legal name" },
    { key: "idType", label: "Identification type", placeholder: "SA ID or Passport" },
    { key: "idNumber", label: "Identification number", placeholder: "Enter your SA ID or passport number" },
    { key: "dateOfBirth", label: "Date of birth", placeholder: "Auto-filled for SA ID, or enter manually", readOnly: false },
    { key: "emailAddress", label: "Email address", placeholder: "Loaded from your Response Integrity account", readOnly: true },
    { key: "phoneNumber", label: "Phone number", placeholder: "Enter your contact number" },
    { key: "schoolName", label: "School attended (Matric)", placeholder: "Enter the school you attended for Matric" },
    { key: "currentStatus", label: "Current status", placeholder: "Gap year, waiting uni, studying, working, etc." },
  ],
  2: [
    { key: "legalName", label: "Full legal name", placeholder: "Enter your full legal name" },
    { key: "idType", label: "Identification type", placeholder: "SA ID or Passport" },
    { key: "idNumber", label: "Identification number", placeholder: "Enter your SA ID or passport number" },
    { key: "dateOfBirth", label: "Date of birth", placeholder: "Auto-filled for SA ID, or enter manually", readOnly: false },
    { key: "emailAddress", label: "Email address", placeholder: "Loaded from your Response Integrity account", readOnly: true },
    { key: "phoneNumber", label: "Phone number", placeholder: "Enter your contact number" },
    { key: "matricYear", label: "Matric year", placeholder: "Enter the year you completed Matric" },
    { key: "schoolName", label: "School name", placeholder: "Enter the school where you completed Matric" },
    { key: "examNumber", label: "Exam number", placeholder: "Enter your exam or candidate number if shown", required: false },
  ],
};

function normalizeDocumentStatuses(raw: any): Record<string, DocumentStatus> {
  return { ...DEFAULT_DOCUMENT_STATUSES, ...(raw && typeof raw === "object" ? raw : {}) };
}

function getCurrentStep(statuses: Record<string, DocumentStatus>) {
  for (const step of [1, 2, 3, 4, 5, 6]) {
    if (statuses[String(step)] !== "approved") return step;
  }
  return 6;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
      resolve(result || "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function resolveFieldBehavior(params: {
  field: FieldDefinition;
  currentStep: number;
  acceptanceAlreadyRecorded: boolean;
  fieldValue: string;
  lockedValue: string;
  allFieldValues?: Record<string, string>;
}) {
  const { field, currentStep, acceptanceAlreadyRecorded, fieldValue, lockedValue, allFieldValues } = params;
  const captureStep = FIELD_CAPTURE_STEP[field.key] || currentStep;

  if (acceptanceAlreadyRecorded) {
    return {
      canEdit: false,
      helperText: null,
      missingRequirement: null,
    } satisfies FieldResolution;
  }

  if (field.key === "dateOfBirth") {
    const idType = allFieldValues?.idType || "sa_id";
    const isSaId = idType === "sa_id" || idType === "" || !idType;
    
    if (isSaId) {
      return {
        canEdit: false,
        helperText: fieldValue ? "Auto-derived from your SA ID number." : "Enter your SA ID number to auto-fill date of birth.",
        missingRequirement: fieldValue ? null : "Enter your SA ID number to auto-fill date of birth.",
      } satisfies FieldResolution;
    } else {
      // For passports, allow manual entry
      return {
        canEdit: true,
        helperText: "Enter your date of birth manually.",
        missingRequirement: fieldValue ? null : "Enter your date of birth.",
      } satisfies FieldResolution;
    }
  }

  if (lockedValue) {
    return {
      canEdit: false,
      helperText: currentStep > captureStep ? `Locked from the earlier onboarding step where this detail was first captured.` : "Locked to the existing onboarding record.",
      missingRequirement: null,
    } satisfies FieldResolution;
  }

  if (field.readOnly && !lockedValue) {
    return {
      canEdit: false,
      helperText: "This field is system-filled when available.",
      missingRequirement: null,
    } satisfies FieldResolution;
  }

  return {
    canEdit: true,
    helperText: captureStep < currentStep ? `Complete this once here if it was missing earlier. Later steps will inherit and lock it.` : null,
    missingRequirement:
      field.required === false || fieldValue
        ? null
        : `Complete ${field.label.toLowerCase()}.`,
  } satisfies FieldResolution;
}

export function SequentialDocumentSubmission({ applicationId, applicationStatus }: SequentialDocumentSubmissionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const readerRef = useRef<HTMLDivElement | null>(null);
  const [liveApplication, setLiveApplication] = useState<any>(applicationStatus);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerPercent, setReaderPercent] = useState(0);
  const [hasCompletedReading, setHasCompletedReading] = useState(false);
  const [viewStartedAt, setViewStartedAt] = useState<string | null>(null);
  const [viewCompletedAt, setViewCompletedAt] = useState<string | null>(null);
  const [typedFullName, setTypedFullName] = useState("");
  const [generalRead, setGeneralRead] = useState(false);
  const [generalBound, setGeneralBound] = useState(false);
  const [clauseChecks, setClauseChecks] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setLiveApplication(applicationStatus);
  }, [applicationStatus]);

  const { data, isLoading } = useQuery<{ applicationId: string; documents: OnboardingDocumentDefinition[] }>({
    queryKey: ["/api/tutor/onboarding-documents", applicationId],
    enabled: Boolean(applicationId),
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tutor/onboarding-documents");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to load onboarding documents");
      return payload;
    },
  });

  const documentsStatus = useMemo(
    () => normalizeDocumentStatuses(liveApplication?.documentsStatus || liveApplication?.documents_status),
    [liveApplication]
  );
  const acceptanceMap = liveApplication?.onboardingAcceptanceMap || {};
  const doc1Acceptance = acceptanceMap["1"];
  const currentStep = getCurrentStep(documentsStatus);
  const currentDocument = data?.documents?.find((entry) => entry.step === currentStep);
  const currentAcceptance = acceptanceMap[String(currentStep)];
  const currentFormFields = DOCUMENT_FORM_FIELDS[currentStep] || [];
  const currentStatus = documentsStatus[String(currentStep)] as DocumentStatus | undefined;
  const uploadReady = currentStep === 6 || Boolean(acceptanceMap["2"]);
  const isUploadStep = currentStep === 2 || currentStep === 6;
  const isAcceptanceStep = Boolean(currentDocument?.requiresAcceptance);
  const acceptanceAlreadyRecorded = Boolean(currentAcceptance);
  const isPendingCooReview = currentStatus === "pending_review";
  const allApproved = Object.values(documentsStatus).every((value) => value === "approved");

  const statusLabel =
    currentStep === 2 && currentStatus === "pending_upload" && currentAcceptance
      ? "Accepted - Waiting For Certificate Upload"
      : currentStep !== 6 && currentStatus === "pending_upload"
        ? "Awaiting Acceptance"
        : String(currentStatus).replace(/_/g, " ");

  const initialFormData = useMemo(
    () => buildInitialFormData(currentFormFields, liveApplication, currentAcceptance),
    [currentFormFields, liveApplication, currentAcceptance]
  );
  const previousAcceptanceDerivedFormData = useMemo(
    () => buildAcceptanceDerivedFormData(currentStep === 2 ? doc1Acceptance : null),
    [currentStep, doc1Acceptance]
  );
  const applicationLockedFormData = useMemo(
    () => buildApplicationLockedFormData(liveApplication),
    [liveApplication]
  );
  const canonicalLockedFormData = useMemo(
    () => ({
      ...applicationLockedFormData,
      ...(currentStep === 2
        ? Object.fromEntries(
            Object.entries(previousAcceptanceDerivedFormData).filter(([, value]) => Boolean(String(value || "").trim()))
          )
        : {}),
    }),
    [applicationLockedFormData, currentStep, previousAcceptanceDerivedFormData]
  );
  const effectiveInitialFormData = useMemo(
    () => ({
      ...initialFormData,
      ...(currentStep === 2
        ? Object.fromEntries(
            Object.entries(previousAcceptanceDerivedFormData).filter(([, value]) => Boolean(String(value || "").trim()))
          )
        : {}),
    }),
    [initialFormData, currentStep, previousAcceptanceDerivedFormData]
  );
  const hydratedDocumentContent = useMemo(
    () => hydrateDocumentContent(currentDocument?.content || "", { ...effectiveInitialFormData, ...formData, legalName: typedFullName || effectiveInitialFormData.legalName || "" }),
    [currentDocument, effectiveInitialFormData, formData, typedFullName]
  );
  const acceptanceResetKey = `${currentStep}:${currentAcceptance?.acceptedAt || currentAcceptance?.accepted_at || "pending"}`;
  const fieldResolutions = useMemo(() => {
    return Object.fromEntries(
      currentFormFields.map((field) => {
        const fieldValue = field.key === "legalName" ? typedFullName.trim() : String(formData[field.key] || "").trim();
        const lockedValue =
          field.key === "legalName"
            ? String(canonicalLockedFormData.legalName || "").trim()
            : String(canonicalLockedFormData[field.key as keyof typeof canonicalLockedFormData] || "").trim();
        return [
          field.key,
          resolveFieldBehavior({
            field,
            currentStep,
            acceptanceAlreadyRecorded,
            fieldValue,
            lockedValue,
          }),
        ];
      })
    ) as Record<string, FieldResolution>;
  }, [acceptanceAlreadyRecorded, canonicalLockedFormData, currentFormFields, currentStep, formData, typedFullName]);

  useEffect(() => {
    const fallbackName = liveApplication?.fullName || liveApplication?.full_name || "";
    setTypedFullName(currentAcceptance?.typedFullName || currentAcceptance?.typed_full_name || effectiveInitialFormData.legalName || fallbackName);
    setFormData(effectiveInitialFormData);
    setGeneralRead(false);
    setGeneralBound(false);
    setClauseChecks(
      Object.fromEntries((currentDocument?.mandatoryClauses || []).map((clause) => [clause.key, false]))
    );
    setReaderPercent(0);
    setHasCompletedReading(Boolean(currentAcceptance));
    setViewStartedAt(null);
    setViewCompletedAt(null);
  }, [acceptanceResetKey, currentDocument?.step]);

  useEffect(() => {
    setSelectedFile(null);
  }, [currentStep]);

  useEffect(() => {
    setReaderOpen(false);
  }, [currentStep]);

  useEffect(() => {
    if (currentStatus === "pending_review" || currentStatus === "approved") {
      setSelectedFile(null);
    }
  }, [currentStatus]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!currentDocument) throw new Error("No document loaded");
      const response = await apiRequest(
        "POST",
        `/api/tutor/onboarding-documents/${currentDocument.step}/accept`,
        {
          applicationId,
          documentVersion: currentDocument.version,
          documentHash: currentDocument.contentHash,
          typedFullName,
          acceptedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          platform: "web",
          sourceFlow: `tutor_onboarding_step_${currentDocument.step}`,
          formData,
          acceptedClauseKeys: Object.entries(clauseChecks).filter(([, value]) => value).map(([key]) => key),
          scrollCompletionPercent: readerPercent,
          viewStartedAt,
          viewCompletedAt,
          acceptClickedAt: new Date().toISOString(),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Failed to accept document");
      return payload;
    },
    onSuccess: (payload) => {
      setLiveApplication(payload.application);
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/gateway-session"] });
      toast({ title: "Agreement accepted", description: `${currentDocument?.code} has been recorded.` });
    },
    onError: (error: Error) => {
      if (/(already been accepted|already accepted|current acceptance step|pending review)/i.test(error.message)) {
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/gateway-session"] });
        toast({
          title: "Agreement status updated",
          description: "Your onboarding state has been refreshed.",
        });
        return;
      }
      toast({ title: "Acceptance failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !currentDocument) throw new Error("Choose a file first");
      const fileData = await readFileAsBase64(selectedFile);
      const response = await apiRequest(
        "POST",
        "/api/tutor/onboarding-documents/upload",
        {
          applicationId,
          docStep: currentDocument.step,
          fileName: `${applicationId}/doc_${currentDocument.step}_${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
          fileData,
          fileType: selectedFile.type,
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Upload failed");
      return payload;
    },
    onSuccess: (payload) => {
      setLiveApplication(payload.application);
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/gateway-session"] });
      toast({ title: "Upload received", description: "Your file is now in the COO review queue." });
    },
    onError: (error: Error) => {
      if (/(pending review|already approved|already accepted)/i.test(error.message)) {
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/gateway-session"] });
        toast({
          title: "Upload status updated",
          description: "Your onboarding state has been refreshed.",
        });
        return;
      }
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const mandatoryClausesAccepted = (currentDocument?.mandatoryClauses || []).every((clause) => clauseChecks[clause.key]);
  const missingFieldRequirements = useMemo(() => {
    return currentFormFields.flatMap((field) => {
      const resolution = fieldResolutions[field.key];
      return resolution?.missingRequirement ? [resolution.missingRequirement] : [];
    });
  }, [currentFormFields, fieldResolutions]);
  const requiredFieldsComplete = missingFieldRequirements.length === 0;
  const canAccept = hasCompletedReading && generalRead && generalBound && mandatoryClausesAccepted && typedFullName.trim() && requiredFieldsComplete;

  const openReader = () => {
    setReaderOpen(true);
  };

  const handleReaderScroll = () => {
    const node = readerRef.current;
    if (!node) return;
    if (node.scrollHeight <= node.clientHeight + 8) {
      setReaderPercent(100);
      setViewCompletedAt((current) => current || new Date().toISOString());
      return;
    }
    const visibleBottom = node.scrollTop + node.clientHeight;
    const reachedEnd = visibleBottom >= node.scrollHeight - 24;
    const percent = reachedEnd
      ? 100
      : Math.min(99, Math.max(1, Math.round((visibleBottom / node.scrollHeight) * 100)));
    setReaderPercent(percent);
    if (reachedEnd) setViewCompletedAt((current) => current || new Date().toISOString());
  };

  useEffect(() => {
    if (!readerOpen || viewStartedAt) return;
    setViewStartedAt(new Date().toISOString());
  }, [readerOpen, viewStartedAt]);

  useEffect(() => {
    if (!readerOpen) return;
    const timer = window.setTimeout(handleReaderScroll, 50);
    return () => window.clearTimeout(timer);
  }, [readerOpen, currentDocument]);

  const downloadCopy = () => {
    if (!currentDocument?.content || !currentAcceptance) return;
    const storedFormData = currentAcceptance?.formSnapshotJson || currentAcceptance?.form_snapshot_json || formData;
    const html = buildAcceptedCopyHtml({
      document: currentDocument,
      acceptance: currentAcceptance,
      typedFullName,
      formData: storedFormData,
      fields: currentFormFields,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentDocument.code}-accepted-copy.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadAcceptedCopyFor = (docDefinition: OnboardingDocumentDefinition, acceptance: any) => {
    if (!docDefinition?.content || !acceptance) return;
    const storedFormData = acceptance?.formSnapshotJson || acceptance?.form_snapshot_json || {};
    const html = buildAcceptedCopyHtml({
      document: docDefinition,
      acceptance,
      typedFullName: acceptance?.typedFullName || acceptance?.typed_full_name || "",
      formData: storedFormData,
      fields: DOCUMENT_FORM_FIELDS[docDefinition.step] || [],
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${docDefinition.code}-accepted-copy.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !currentDocument) {
    return <Card><CardContent className="py-10 text-sm text-muted-foreground">Loading onboarding documents...</CardContent></Card>;
  }

  if (allApproved) {
    return <Card className="border-green-200 bg-green-50"><CardContent className="py-8 text-sm text-green-800">All onboarding steps are complete. Response Integrity is matching you to a pod.</CardContent></Card>;
  }

  return (
    <>
      <Card className="border-[#E7D5C8] bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Step {currentStep} of 6</CardTitle>
              <CardDescription>{currentDocument.title}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{currentDocument.code}</Badge>
              <Badge variant="outline">Version {normalizeDisplayedVersion(currentDocument.version)}</Badge>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>
          </div>
          <Progress value={(currentStep / 6) * 100} />
        </CardHeader>

        <CardContent className="space-y-6">
          {isPendingCooReview ? (
            <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">This step is with COO for review</p>
                <p className="text-sm text-[#6B5B52]">
                  {currentStep === 2
                    ? "Your accepted Response Integrity-EQV-002 record and certified Matric certificate are now with COO. Step 3 will open after the certificate is approved."
                    : "Your certified ID copy is now with COO for review. You do not need to take any further action on this step right now."}
                </p>
              </div>
            </div>
          ) : null}

          {isAcceptanceStep && !isPendingCooReview ? (
            <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Read the full document first</p>
                  <p className="text-sm text-[#6B5B52]">Open the document reader, review the agreement in-app, complete any document fields there, then return here to confirm acceptance.</p>
                </div>
                <Button type="button" onClick={openReader} className="w-full bg-[#E63946] text-white hover:bg-[#cf2e3c] sm:w-auto sm:self-start">
                  <Expand className="mr-2 h-4 w-4" />
                  Open document reader
                </Button>
              </div>
              <div className="mt-4 flex flex-col gap-1 text-xs text-[#6B5B52] sm:flex-row sm:flex-wrap sm:gap-3">
                <span>Read progress: {readerPercent}%</span>
                <span>{hasCompletedReading ? "Review complete" : "Acceptance remains locked until you finish reading"}</span>
              </div>
            </div>
          ) : null}

          {isAcceptanceStep && !isPendingCooReview ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border p-4">
                <div>
                  <p className="font-medium">Acceptance workspace</p>
                  <p className="text-sm text-muted-foreground">Complete only the inputs that belong to this document. The agreement text stays read-only inside the full-screen reader.</p>
                </div>
                {acceptanceAlreadyRecorded ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    Acceptance already recorded for this step.
                    {currentAcceptance?.acceptedAt || currentAcceptance?.accepted_at
                      ? ` Accepted ${new Date(currentAcceptance?.acceptedAt || currentAcceptance?.accepted_at).toLocaleString()}.`
                      : ""}
                    {currentStep === 2 ? " Upload your certified Matric certificate below to move this step into COO review." : ""}
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Review the document fields inside the reader, then return here only to confirm assent and complete acceptance.
                </p>
                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={generalRead} disabled={!hasCompletedReading || acceptanceAlreadyRecorded} onCheckedChange={(value) => setGeneralRead(Boolean(value))} /><span>I have read and understood this document.</span></label>
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={generalBound} disabled={!hasCompletedReading || acceptanceAlreadyRecorded} onCheckedChange={(value) => setGeneralBound(Boolean(value))} /><span>I agree to be legally bound by these terms and understand Response Integrity will store an audit record of this acceptance.</span></label>
                  {currentDocument.mandatoryClauses.map((clause) => (
                    <label key={clause.key} className="flex items-start gap-3 text-sm">
                      <Checkbox checked={clauseChecks[clause.key] || false} disabled={!hasCompletedReading || acceptanceAlreadyRecorded} onCheckedChange={(value) => setClauseChecks((current) => ({ ...current, [clause.key]: Boolean(value) }))} />
                      <span>{clause.label}</span>
                    </label>
                  ))}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Acceptance name</label>
                    <Input value={typedFullName} disabled placeholder="Complete your legal name in the reader above" />
                    <p className="text-xs text-muted-foreground">This mirrors the legal name captured inside the document and is the name used on the acceptance record.</p>
                  </div>
                </div>
                <Button type="button" disabled={!canAccept || acceptMutation.isPending || acceptanceAlreadyRecorded} onClick={() => acceptMutation.mutate()} className="w-full">
                  {acceptMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                  Accept and continue
                </Button>
                {!acceptanceAlreadyRecorded && missingFieldRequirements.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Still required before acceptance:</p>
                    <ul className="mt-2 list-disc pl-5">
                      {missingFieldRequirements.map((requirement) => (
                        <li key={requirement}>{requirement}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border p-4">
                <div>
                  <p className="font-medium">Step summary</p>
                  <p className="text-sm text-muted-foreground">Version-locked acceptance record tied to your Response Integrity account.</p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Document: {currentDocument.code}</p>
                  <p>Version: {currentDocument.version}</p>
                  <p>Hash: {String(currentDocument.contentHash || "").slice(0, 16)}...</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={openReader}><FileText className="mr-2 h-4 w-4" />Review again</Button>
                  <Button type="button" variant="outline" className="w-full sm:w-auto whitespace-normal text-left sm:whitespace-nowrap sm:text-center" disabled={!acceptanceAlreadyRecorded} onClick={downloadCopy}><Download className="mr-2 h-4 w-4 shrink-0" />Download accepted copy</Button>
                </div>
              </div>
            </div>
          ) : null}

          {isUploadStep ? (
            <div className="rounded-2xl border p-4">
              <p className="font-medium">{currentDocument.uploadTitle || "Required upload"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentStep === 6 ? getStep6UploadDescription(formData.idType || "sa_id") : currentDocument.uploadDescription}</p>
              {currentStep === 2 && !uploadReady ? <p className="mt-3 text-sm text-amber-700">Accept Response Integrity-EQV-002 first. The certified Matric certificate upload unlocks immediately after acceptance.</p> : null}
              {currentStep === 2 && uploadReady && currentStatus !== "pending_review" ? (
                <p className="mt-3 text-sm text-muted-foreground">Choose the certified Matric certificate, then upload it for COO review. Step 3 opens only after COO approves this certificate.</p>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={!uploadReady || uploadMutation.isPending || currentStatus === "pending_review"} onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                <Button type="button" className="w-full sm:w-auto" disabled={!selectedFile || !uploadReady || uploadMutation.isPending || currentStatus === "pending_review"} onClick={() => uploadMutation.mutate()}>
                  {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload file
                </Button>
              </div>
              {selectedFile ? (
                <p className="mt-3 text-sm text-[#6B5B52]">
                  Selected file: <span className="font-medium text-[#1A1A1A]">{selectedFile.name}</span>
                </p>
              ) : null}
              {currentStatus === "pending_review" ? <p className="mt-3 text-sm text-muted-foreground">Your upload is with COO for review now.</p> : null}
              {currentStatus === "rejected" ? <p className="mt-3 text-sm text-red-700">{liveApplication?.[`doc${currentStep}SubmissionRejectionReason`] || liveApplication?.[`doc_${currentStep}_submission_rejection_reason`] || "Your upload was rejected. Review the reason and upload a corrected file."}</p> : null}
            </div>
          ) : null}

          {data?.documents?.some((document) => document.requiresAcceptance && acceptanceMap[String(document.step)]) ? (
            <div className="rounded-2xl border p-4">
              <div className="mb-4">
                <p className="font-medium">Accepted documents</p>
                <p className="text-sm text-muted-foreground">Download a clean accepted copy for any agreement you have already completed.</p>
              </div>
              <div className="space-y-3">
                {data.documents
                  .filter((document) => document.requiresAcceptance && acceptanceMap[String(document.step)])
                  .map((document) => {
                    const acceptance = acceptanceMap[String(document.step)];
                    const acceptedAt = acceptance?.acceptedAt || acceptance?.accepted_at;
                    return (
                      <div key={document.step} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{document.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {document.code} • Version {normalizeDisplayedVersion(acceptance?.documentVersion || acceptance?.document_version || document.version)}
                          </p>
                          {acceptedAt ? (
                            <p className="text-xs text-muted-foreground">Accepted {new Date(acceptedAt).toLocaleString()}</p>
                          ) : null}
                        </div>
                        <div className="w-full sm:w-auto">
                          <Button type="button" variant="outline" className="w-full whitespace-normal text-left sm:w-auto sm:whitespace-nowrap sm:text-center" onClick={() => downloadAcceptedCopyFor(document, acceptance)}>
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

      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="left-1/2 top-1/2 h-[92dvh] w-[calc(100vw-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7D5C8] p-0 shadow-2xl sm:h-[88dvh] sm:w-[calc(100vw-3rem)]">
          <style>{`
            .agreement-reader h1,
            .agreement-reader h2 {
              font-family: Arial, sans-serif;
              color: #102a43;
            }

            .agreement-reader h1 {
              margin: 1.25rem 0 0.65rem;
              font-size: 1rem;
              line-height: 1.5;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .agreement-reader h2 {
              margin: 1rem 0 0.55rem;
              font-size: 0.9rem;
              line-height: 1.5;
              font-weight: 700;
            }

            .agreement-reader p {
              margin: 0 0 0.7rem;
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              line-height: 1.8;
              color: #243b53;
            }

            .agreement-reader ul {
              margin: 0 0 0.8rem 1.2rem;
              padding: 0;
              list-style-type: disc;
              list-style-position: outside;
            }

            .agreement-reader li {
              display: list-item;
              margin-bottom: 0.35rem;
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              line-height: 1.7;
              color: #243b53;
            }

            .agreement-reader .tt-agreement-section + .tt-agreement-section {
              margin-top: 1.6rem;
              padding-top: 1.6rem;
              border-top: 1px solid #e7d5c8;
            }

            .agreement-reader .tt-agreement-section h2 {
              margin: 0 0 0.9rem;
              font-family: Arial, sans-serif;
              font-size: 1rem;
              font-weight: 700;
              color: #7c2d12;
            }

            .agreement-reader .tt-agreement-section-body p {
              margin: 0 0 0.85rem;
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              line-height: 1.8;
              color: #243b53;
            }

            .agreement-reader .tt-agreement-subsection + .tt-agreement-subsection {
              margin-top: 1.1rem;
            }

            .agreement-reader .tt-agreement-subsection h3 {
              margin: 0 0 0.6rem;
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              font-weight: 700;
              color: #102a43;
            }

            .agreement-reader .tt-agreement-list {
              margin: 0 0 0.9rem 1.2rem;
              padding: 0;
              list-style-type: disc;
              list-style-position: outside;
            }

            .agreement-reader .tt-agreement-list-check {
              list-style-type: "• ";
            }

            .agreement-reader .tt-agreement-list li {
              margin-bottom: 0.4rem;
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              line-height: 1.75;
              color: #243b53;
            }

            .agreement-reader .tt-inline-detail-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.75rem;
              margin-bottom: 0.25rem;
            }

            .agreement-reader .tt-inline-detail-grid > div {
              padding: 0.85rem 1rem;
              border: 1px solid #e7d5c8;
              border-radius: 0.9rem;
              background: #fff8f4;
            }

            .agreement-reader .tt-inline-detail-grid .tt-inline-detail-span {
              grid-column: span 2;
            }

            .agreement-reader .tt-inline-detail-grid span {
              display: block;
              margin-bottom: 0.25rem;
              font-family: Arial, sans-serif;
              font-size: 0.72rem;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #9f1d2b;
            }

            .agreement-reader .tt-inline-detail-grid strong {
              font-family: Arial, sans-serif;
              font-size: 0.95rem;
              color: #1a1a1a;
            }

            @media (max-width: 640px) {
              .agreement-reader .tt-inline-detail-grid {
                grid-template-columns: 1fr;
              }

              .agreement-reader .tt-inline-detail-grid .tt-inline-detail-span {
                grid-column: span 1;
              }
            }
          `}</style>
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#FFF5ED] text-[#1A1A1A]">
            <DialogHeader className="shrink-0 border-b border-[#E7D5C8] bg-white px-4 py-4 text-left sm:px-6 sm:py-5">
              <DialogTitle className="pr-8 text-xl sm:text-2xl">{currentDocument.title}</DialogTitle>
              <DialogDescription className="text-[#6B5B52]">{currentDocument.code} • version {normalizeDisplayedVersion(currentDocument.version)}</DialogDescription>
            </DialogHeader>
            <div ref={readerRef} onScroll={handleReaderScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FFF5ED] px-3 py-4 touch-pan-y sm:px-6 sm:py-6">
              <div className="mx-auto max-w-4xl rounded-2xl border border-[#E7D5C8] bg-white px-4 py-6 text-[#1A1A1A] shadow-[0_18px_50px_rgba(230,57,70,0.08)] sm:px-10 sm:py-10">
                <div className="border-b border-[#E7D5C8] pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E63946]">Response Integrity Onboarding Document</p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl">{currentDocument.title}</h1>
                  <p className="mt-2 text-xs text-[#6B5B52] sm:text-sm">
                    {currentDocument.code} • Version {normalizeDisplayedVersion(currentDocument.version)}
                  </p>
                </div>
                {currentFormFields.length > 0 ? (
                  <div className="mt-6 rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 sm:p-5">
                    <div className="mb-4 space-y-1">
                      <p className="text-sm font-semibold text-[#1A1A1A]">Document fields</p>
                      <p className="text-sm text-[#6B5B52]">Complete the Specialist details that belong to this document here. Response Integrity account fields are prefilled automatically.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {currentFormFields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-sm font-medium text-[#1A1A1A]">{field.label}</label>
                          {(() => {
                            const fieldValue = field.key === "legalName" ? typedFullName : formData[field.key] || "";
                            const resolution = fieldResolutions[field.key];
                            const isDisabled = !resolution?.canEdit;

                            return (
                          <Input
                            value={fieldValue}
                            disabled={isDisabled}
                            onChange={(event) => {
                              if (field.key === "legalName") {
                                setTypedFullName(event.target.value);
                                setFormData((value) => ({ ...value, legalName: event.target.value }));
                                return;
                              }
                              if (field.key === "idNumber") {
                                const nextId = event.target.value;
                                setFormData((value) => ({
                                  ...value,
                                  idNumber: nextId,
                                  dateOfBirth: deriveDateOfBirthFromSouthAfricanId(nextId),
                                }));
                                return;
                              }
                              setFormData((value) => ({ ...value, [field.key]: event.target.value }));
                            }}
                            placeholder={field.placeholder}
                            className={isDisabled ? "border-[#E7D5C8] bg-[#F7EFE7] text-[#8A7A70]" : "border-[#E7D5C8] bg-white"}
                          />
                            );
                          })()}
                          {fieldResolutions[field.key]?.helperText ? (
                            <p className="text-xs text-[#8A7A70]">{fieldResolutions[field.key]?.helperText}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="agreement-reader mt-8">
                  {buildTutorAgreementBody(currentDocument, { ...effectiveInitialFormData, ...formData, legalName: typedFullName || effectiveInitialFormData.legalName || "" })}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-[#E7D5C8] bg-white px-4 py-4 sm:px-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">Read progress: {readerPercent}%</p>
                  <p className="text-xs text-[#6B5B52]">Reach the end of the document to unlock the acceptance workspace.</p>
                </div>
                <Button type="button" className="w-full bg-[#E63946] text-white hover:bg-[#cf2e3c] sm:w-auto" disabled={readerPercent < 99} onClick={() => { setHasCompletedReading(true); setReaderOpen(false); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Continue to acceptance
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
