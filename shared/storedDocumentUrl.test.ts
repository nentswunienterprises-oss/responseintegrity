import test from "node:test";
import assert from "node:assert/strict";
import { resolveStoredDocumentUrl } from "./storedDocumentUrl";

test("protected API document URLs resolve against the configured API origin", () => {
  assert.equal(
    resolveStoredDocumentUrl(
      "/api/tutor/onboarding-documents/2/file?applicationId=abc-123",
      "https://api.responseintegrity.co.za",
    ),
    "https://api.responseintegrity.co.za/api/tutor/onboarding-documents/2/file?applicationId=abc-123",
  );
});

test("configured API origins are normalized before joining protected document paths", () => {
  assert.equal(
    resolveStoredDocumentUrl("/api/tutor/onboarding-documents/6/file?applicationId=abc-123", "https://api.example.com/"),
    "https://api.example.com/api/tutor/onboarding-documents/6/file?applicationId=abc-123",
  );
});

test("absolute stored document URLs remain unchanged", () => {
  assert.equal(
    resolveStoredDocumentUrl("https://storage.example.com/document.pdf", "https://api.responseintegrity.co.za"),
    "https://storage.example.com/document.pdf",
  );
});

test("non-API relative values are left unchanged", () => {
  assert.equal(
    resolveStoredDocumentUrl("/uploads/document.pdf", "https://api.responseintegrity.co.za"),
    "/uploads/document.pdf",
  );
});
