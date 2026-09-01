import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTOR_ONBOARDING_DOCUMENTS,
  loadTutorOnboardingDocument,
} from "./tutorOnboardingDocuments";

test("specialist onboarding documents expose current eligibility and integrity terms", async () => {
  const docsByStep = new Map(TUTOR_ONBOARDING_DOCUMENTS.map((doc) => [doc.step, doc]));

  assert.equal(docsByStep.get(1)?.title, "Specialist Consent Form");
  assert.equal(docsByStep.get(1)?.version, "2");
  assert.equal(docsByStep.get(2)?.version, "2");
  assert.equal(docsByStep.get(3)?.title, "Specialist Independent Contractor Agreement");
  assert.equal(docsByStep.get(4)?.title, "Specialist Safeguarding and Conduct Policy");

  assert.ok(docsByStep.get(1)?.mandatoryClauses.some((clause) => clause.key === "evidence_integrity"));
  assert.ok(docsByStep.get(2)?.mandatoryClauses.some((clause) => clause.key === "matric_required"));
  assert.ok(docsByStep.get(3)?.mandatoryClauses.some((clause) => clause.key === "package_completion_payout"));

  const consent = await loadTutorOnboardingDocument(1);
  const qualification = await loadTutorOnboardingDocument(2);
  const contractor = await loadTutorOnboardingDocument(3);
  const safeguarding = await loadTutorOnboardingDocument(4);
  const dataProtection = await loadTutorOnboardingDocument(5);

  assert.match(consent.content, /SPECIALIST CONSENT FORM/);
  assert.match(consent.content, /record observable facts/i);
  assert.match(consent.content, /Sessions may be recorded and stored where required/i);
  assert.match(consent.content, /package completion payout schedule/i);

  assert.match(qualification.content, /Matric completion is required/i);
  assert.match(qualification.content, /18 years or older unless they completed Matric early/i);

  assert.match(contractor.content, /EVIDENCE INTEGRITY/);
  assert.match(contractor.content, /The Contractor earns per eligible completed session/i);
  assert.match(contractor.content, /package completion payout schedule/i);

  assert.match(safeguarding.content, /All Specialist conduct must remain/i);
  assert.match(safeguarding.content, /Sessions may be recorded where required/i);

  assert.match(dataProtection.content, /Specialist observations and reports/i);
  assert.match(dataProtection.content, /recordings where required/i);
});
