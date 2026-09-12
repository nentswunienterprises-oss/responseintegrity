import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dossierSource = fs.readFileSync(new URL("./CapabilityMockDossierCard.tsx", import.meta.url), "utf8");
const mockSource = fs.readFileSync(new URL("./SandboxMockGateCard.tsx", import.meta.url), "utf8");

test("dossier UI is read-only and calls only the GET capability-dossier endpoint", () => {
  assert.match(dossierSource, /apiRequest\(\s*"GET"/);
  assert.match(dossierSource, /capability-dossier/);
  assert.doesNotMatch(dossierSource, /useMutation/);
  assert.doesNotMatch(dossierSource, /apiRequest\(\s*"POST"/);
  assert.doesNotMatch(dossierSource, /apiRequest\(\s*"PUT"/);
  assert.doesNotMatch(dossierSource, /apiRequest\(\s*"PATCH"/);
  assert.doesNotMatch(dossierSource, /apiRequest\(\s*"DELETE"/);
});

test("dossier wording explicitly refuses to score pre-mark or recommend Mock", () => {
  assert.match(dossierSource, /does not score, pre-mark, or recommend the Mock decision/);
  assert.match(dossierSource, /Nothing below can mark those criteria, pass the Mock, open Trial, or replace the reviewer decision/);
  assert.match(dossierSource, /Advisory only/);
  assert.match(dossierSource, /read-only and non-authoritative/);
});

test("dossier does not import render or mutate the human Mock checklist", () => {
  assert.doesNotMatch(dossierSource, /SANDBOX_MOCK_CRITERIA/);
  assert.doesNotMatch(dossierSource, /SandboxMockChecklist/);
  assert.doesNotMatch(dossierSource, /Checkbox/);
  assert.doesNotMatch(dossierSource, /setChecklist/);
  assert.doesNotMatch(dossierSource, /setDecision/);
  assert.doesNotMatch(dossierSource, /Pass Mock/);
  assert.doesNotMatch(dossierSource, /Remediation required/);
});

test("existing Mock card remains the separate human decision surface", () => {
  assert.match(mockSource, /CapabilityMockDossierCard/);
  assert.match(mockSource, /SANDBOX_MOCK_CRITERIA\.map/);
  assert.match(mockSource, /checked=\{checklist\[criterion\.key\]\}/);
  assert.match(mockSource, /Remediation required/);
  assert.match(mockSource, /Pass Mock/);
  assert.match(mockSource, /Record Sandbox Mock decision/);
  assert.match(mockSource, /sandbox-mock-assessment/);
});

test("capability dossier and human Mock are sibling surfaces rather than one inferred checklist", () => {
  assert.match(mockSource, /<>\s*<CapabilityMockDossierCard tutorId=\{tutorId\} \/>\s*<Card/);
});

test("dossier exposes lineage flags and rehearsal evidence without authority claims", () => {
  assert.match(dossierSource, /Evidence cells/);
  assert.match(dossierSource, /16 digital assessment records/);
  assert.match(dossierSource, /Practical evidence/);
  assert.match(dossierSource, /Oral Integrity Defense/);
  assert.match(dossierSource, /Sandbox simulation rehearsal/);
  assert.match(dossierSource, /flag\.kind/);
  assert.match(dossierSource, /Evidence \{assessment\.latestCurrentAttempt\.evidenceId\}/);
  assert.match(dossierSource, /Rehearsal pass/);
});
