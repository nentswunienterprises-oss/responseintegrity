import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurrentTutorOnboardingAcceptanceMap,
  selectCurrentTutorOnboardingAcceptance,
  tutorOnboardingAcceptanceMatchesDocument,
} from "./tutorOnboardingAcceptanceVersion";

const currentDoc = { step: 1, version: "2", contentHash: "current-hash" };

test("historical acceptance of an older document version is not current", () => {
  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      { documentStep: 1, documentVersion: "1", documentChecksum: "old-hash" },
      currentDoc,
    ),
    false,
  );
});

test("same version with a stale checksum is not current", () => {
  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      { documentStep: 1, documentVersion: "2", documentChecksum: "stale-hash" },
      currentDoc,
    ),
    false,
  );
});

test("current version and checksum are recognized as the current acceptance", () => {
  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      { documentStep: 1, documentVersion: "2", documentChecksum: "current-hash" },
      currentDoc,
    ),
    true,
  );
});

test("current acceptance selection preserves history and chooses the latest matching current acceptance", () => {
  const rows = [
    { id: "old-version", documentStep: 1, documentVersion: "1", documentChecksum: "old-hash", acceptedAt: "2026-05-07T09:30:29Z" },
    { id: "current-older", documentStep: 1, documentVersion: "2", documentChecksum: "current-hash", acceptedAt: "2026-09-01T09:00:00Z" },
    { id: "current-latest", documentStep: 1, documentVersion: "2", documentChecksum: "current-hash", acceptedAt: "2026-09-28T06:00:00Z" },
  ];

  assert.equal(selectCurrentTutorOnboardingAcceptance(rows, currentDoc)?.id, "current-latest");
  assert.equal(buildCurrentTutorOnboardingAcceptanceMap(rows, [currentDoc])["1"]?.id, "current-latest");
});

test("legacy TCF v2 acceptance remains current after the SCF nomenclature rename", () => {
  const specialistConsentDoc = {
    step: 1,
    code: "Response Integrity-SCF-001",
    version: "2",
    contentHash: "scf-current-hash",
  };

  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      {
        documentStep: 1,
        documentCode: "Response Integrity-TCF-001",
        documentVersion: "2",
        documentChecksum: "tcf-legacy-hash",
        documentSnapshot: "SPECIALIST CONSENT FORM (Response Integrity-TCF-001)",
      },
      specialistConsentDoc,
    ),
    true,
  );
});

test("SCF checksum mismatches are not generally ignored", () => {
  const specialistConsentDoc = {
    step: 1,
    code: "Response Integrity-SCF-001",
    version: "2",
    contentHash: "scf-current-hash",
  };

  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      {
        documentStep: 1,
        documentCode: "Response Integrity-SCF-001",
        documentVersion: "2",
        documentChecksum: "stale-hash",
        documentSnapshot: "SPECIALIST CONSENT FORM (Response Integrity-SCF-001)",
      },
      specialistConsentDoc,
    ),
    false,
  );
});

test("legacy ICA v2 acceptance remains current when only the TCF cross-reference became SCF", () => {
  const contractorDoc = {
    step: 3,
    code: "Response Integrity-ICA-003",
    version: "2",
    contentHash: "ica-current-hash",
  };

  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      {
        documentStep: 3,
        documentCode: "Response Integrity-ICA-003",
        documentVersion: "2",
        documentChecksum: "ica-legacy-hash",
        documentSnapshot:
          "This Agreement forms part of the Response Integrity contractor framework, alongside: Response Integrity-TCF-001 (Specialist Consent Form)",
      },
      contractorDoc,
    ),
    true,
  );
});

test("unrelated ICA checksum drift is still rejected", () => {
  const contractorDoc = {
    step: 3,
    code: "Response Integrity-ICA-003",
    version: "2",
    contentHash: "ica-current-hash",
  };

  assert.equal(
    tutorOnboardingAcceptanceMatchesDocument(
      {
        documentStep: 3,
        documentCode: "Response Integrity-ICA-003",
        documentVersion: "2",
        documentChecksum: "stale-hash",
        documentSnapshot: "An unrelated older ICA snapshot without the renamed consent-form reference.",
      },
      contractorDoc,
    ),
    false,
  );
});
