export type TutorOnboardingAcceptanceLike = {
  id?: string | null;
  documentStep?: number | null;
  document_step?: number | null;
  documentVersion?: string | null;
  document_version?: string | null;
  documentChecksum?: string | null;
  document_checksum?: string | null;
  documentCode?: string | null;
  document_code?: string | null;
  documentSnapshot?: string | null;
  document_snapshot?: string | null;
  acceptedAt?: string | Date | null;
  accepted_at?: string | Date | null;
};

export type TutorOnboardingDocumentLike = {
  step: number;
  version: string;
  code?: string | null;
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

function readAcceptanceCode(acceptance: TutorOnboardingAcceptanceLike): string {
  return String(acceptance.documentCode ?? acceptance.document_code ?? "").trim();
}

function readAcceptanceSnapshot(acceptance: TutorOnboardingAcceptanceLike): string {
  return String(acceptance.documentSnapshot ?? acceptance.document_snapshot ?? "");
}

function readDocumentCode(document: TutorOnboardingDocumentLike): string {
  return String(document.code ?? "").trim();
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

function isLegacySpecialistNomenclatureAcceptance(
  acceptance: TutorOnboardingAcceptanceLike,
  document: TutorOnboardingDocumentLike,
): boolean {
  const step = readStep(acceptance);
  const version = readVersion(acceptance);
  const acceptanceCode = readAcceptanceCode(acceptance);
  const currentCode = readDocumentCode(document);
  const snapshot = readAcceptanceSnapshot(acceptance);

  if (
    step === 1 &&
    version === "2" &&
    currentCode === "Response Integrity-SCF-001" &&
    acceptanceCode === "Response Integrity-TCF-001" &&
    snapshot.includes("Response Integrity-TCF-001")
  ) {
    return true;
  }

  if (
    step === 3 &&
    version === "2" &&
    currentCode === "Response Integrity-ICA-003" &&
    acceptanceCode === "Response Integrity-ICA-003" &&
    snapshot.includes("Response Integrity-TCF-001")
  ) {
    return true;
  }

  return false;
}

export function tutorOnboardingAcceptanceMatchesDocument(
  acceptance: TutorOnboardingAcceptanceLike | null | undefined,
  document: TutorOnboardingDocumentLike | null | undefined,
): boolean {
  if (!acceptance || !document) return false;
  if (readStep(acceptance) !== Number(document.step)) return false;
  if (readVersion(acceptance) !== String(document.version ?? "").trim()) return false;

  const currentChecksum = readDocumentChecksum(document);
  if (currentChecksum && readChecksum(acceptance) !== currentChecksum) {
    return isLegacySpecialistNomenclatureAcceptance(acceptance, document);
  }

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
