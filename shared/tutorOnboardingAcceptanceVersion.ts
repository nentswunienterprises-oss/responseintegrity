export type TutorOnboardingAcceptanceLike = {
  id?: string | null;
  documentStep?: number | null;
  document_step?: number | null;
  documentVersion?: string | null;
  document_version?: string | null;
  documentChecksum?: string | null;
  document_checksum?: string | null;
  acceptedAt?: string | Date | null;
  accepted_at?: string | Date | null;
};

export type TutorOnboardingDocumentLike = {
  step: number;
  version: string;
  contentHash?: string | null;
  content_hash?: string | null;
};

function readStep(acceptance: TutorOnboardingAcceptanceLike): number {
  return Number(acceptance.documentStep ?? acceptance.document_step ?? 0);
}

function readVersion(acceptance: TutorOnboardingAcceptanceLike): string {
  return String(acceptance.documentVersion ?? acceptance.document_version ?? "").trim();
}

function readChecksum(acceptance: TutorOnboardingAcceptanceLike): string {
  return String(acceptance.documentChecksum ?? acceptance.document_checksum ?? "").trim();
}

function readDocumentChecksum(document: TutorOnboardingDocumentLike): string {
  return String(document.contentHash ?? document.content_hash ?? "").trim();
}

function readAcceptedAt(acceptance: TutorOnboardingAcceptanceLike): number {
  const value = acceptance.acceptedAt ?? acceptance.accepted_at ?? null;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function tutorOnboardingAcceptanceMatchesDocument(
  acceptance: TutorOnboardingAcceptanceLike | null | undefined,
  document: TutorOnboardingDocumentLike | null | undefined,
): boolean {
  if (!acceptance || !document) return false;
  if (readStep(acceptance) !== Number(document.step)) return false;
  if (readVersion(acceptance) !== String(document.version ?? "").trim()) return false;

  const currentChecksum = readDocumentChecksum(document);
  if (currentChecksum && readChecksum(acceptance) !== currentChecksum) return false;

  return true;
}

export function selectCurrentTutorOnboardingAcceptance(
  acceptances: TutorOnboardingAcceptanceLike[] | null | undefined,
  document: TutorOnboardingDocumentLike | null | undefined,
): TutorOnboardingAcceptanceLike | undefined {
  if (!document) return undefined;

  return [...(acceptances ?? [])]
    .filter((acceptance) => tutorOnboardingAcceptanceMatchesDocument(acceptance, document))
    .sort((left, right) => readAcceptedAt(right) - readAcceptedAt(left))[0];
}

export function buildCurrentTutorOnboardingAcceptanceMap(
  acceptances: TutorOnboardingAcceptanceLike[] | null | undefined,
  documents: TutorOnboardingDocumentLike[] | null | undefined,
): Record<string, TutorOnboardingAcceptanceLike> {
  const result: Record<string, TutorOnboardingAcceptanceLike> = {};

  for (const document of documents ?? []) {
    const acceptance = selectCurrentTutorOnboardingAcceptance(acceptances, document);
    if (acceptance) result[String(document.step)] = acceptance;
  }

  return result;
}
