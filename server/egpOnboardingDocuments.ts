import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { sanitizeLegacyOnboardingDocumentText } from "@shared/onboardingDocumentSanitizer";

export interface EgpOnboardingClauseDefinition {
  key: string;
  label: string;
}

export interface EgpOnboardingDocumentDefinition {
  step: number;
  code: string;
  title: string;
  fileName: string;
  version: string;
  requiresAcceptance: boolean;
  requiresUpload: boolean;
  uploadTitle?: string;
  uploadDescription?: string;
  mandatoryClauses: EgpOnboardingClauseDefinition[];
}

const DOC_ROOT = resolve(process.cwd(), "onboarding", "EGP Initiative");

export const EGP_ONBOARDING_DOCUMENTS: EgpOnboardingDocumentDefinition[] = [
  {
    step: 1,
    code: "Response Integrity-EGP-001",
    title: "Education Growth Partner Agreement",
    fileName: "001.md",
    version: "2",
    requiresAcceptance: true,
    requiresUpload: false,
    mandatoryClauses: [
      {
        key: "performance_based_role",
        label: "I acknowledge that this is a performance-based acquisition role with no salary or guaranteed income.",
      },
      {
        key: "independent_operator",
        label: "I understand that I operate as an independent contractor inside the defined system.",
      },
    ],
  },
  {
    step: 2,
    code: "Response Integrity-EGP-002",
    title: "Non-Circumvention & Non-Solicitation Agreement",
    fileName: "002.md",
    version: "1",
    requiresAcceptance: true,
    requiresUpload: false,
    mandatoryClauses: [
      {
        key: "relationships_belong_to_Response Integrity",
        label: "I acknowledge that all client and tutor relationships accessed through the platform remain company property.",
      },
      {
        key: "no_side_channel_deals",
        label: "I may not move platform relationships into private, external, or competing arrangements.",
      },
    ],
  },
  {
    step: 3,
    code: "Response Integrity-EGP-003",
    title: "Confidentiality & System Protection Agreement",
    fileName: "003.md",
    version: "1",
    requiresAcceptance: true,
    requiresUpload: false,
    mandatoryClauses: [
      {
        key: "confidential_systems",
        label: "I acknowledge that the systems, positioning, structures, and operating methods are confidential.",
      },
      {
        key: "no_replication",
        label: "I may not copy, disclose, or recreate the system outside authorized Response Integrity operations.",
      },
    ],
  },
  {
    step: 4,
    code: "Response Integrity-EGP-004",
    title: "Representation & Conduct Agreement",
    fileName: "004.md",
    version: "1",
    requiresAcceptance: true,
    requiresUpload: false,
    mandatoryClauses: [
      {
        key: "need_first_positioning",
        label: "I will only position Response Integrity where real need is present and will disengage when it is not.",
      },
      {
        key: "no_pressure_or_false_promises",
        label: "I may not pressure parents, exaggerate Response Integrity's offer, or promise guaranteed outcomes.",
      },
    ],
  },
  {
    step: 5,
    code: "Response Integrity-EGP-005",
    title: "Certified ID Copy",
    fileName: "",
    version: "1",
    requiresAcceptance: false,
    requiresUpload: true,
    uploadTitle: "Certified ID Copy",
    uploadDescription: "Upload a certified copy of your South African ID document for COO review before gateway completion.",
    mandatoryClauses: [],
  },
];

const DOC_MAP = new Map(EGP_ONBOARDING_DOCUMENTS.map((doc) => [doc.step, doc]));

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜']/g, "'")
    .replace(/[â€“â€”]/g, "-")
    .replace(/\uFFFD/g, "")
    .trim();
}

export function getEgpOnboardingDocumentDefinition(step: number): EgpOnboardingDocumentDefinition {
  const doc = DOC_MAP.get(step);
  if (!doc) {
    throw new Error(`Invalid EGP onboarding document step: ${step}`);
  }

  return doc;
}

export interface LoadedEgpOnboardingDocument extends EgpOnboardingDocumentDefinition {
  content: string;
  contentHash: string;
}

export async function loadEgpOnboardingDocument(step: number): Promise<LoadedEgpOnboardingDocument> {
  const doc = getEgpOnboardingDocumentDefinition(step);
  const content = doc.fileName
    ? sanitizeLegacyOnboardingDocumentText(await readFile(resolve(DOC_ROOT, doc.fileName), "utf8"))
    : "";
  const contentHash = createHash("sha256").update(content, "utf8").digest("hex");

  return {
    ...doc,
    content,
    contentHash,
  };
}
