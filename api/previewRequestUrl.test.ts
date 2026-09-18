import test from "node:test";
import assert from "node:assert/strict";
import { resolvePreviewRequestUrl } from "./previewRequestUrl";

test("preview rewrite path is recovered from the raw Vercel request URL", () => {
  assert.equal(
    resolvePreviewRequestUrl(
      "/api/index?__previewPath=auth%2Fsignin",
      {},
    ),
    "/api/auth/signin",
  );
});

test("preview rewrite path is recovered from Vercel query metadata", () => {
  assert.equal(
    resolvePreviewRequestUrl(
      "/api/index",
      { __previewPath: "tutor/students/student-1/topic-conditioning" },
    ),
    "/api/tutor/students/student-1/topic-conditioning",
  );
});

test("original query parameters survive path reconstruction", () => {
  assert.equal(
    resolvePreviewRequestUrl(
      "/api/index?__previewPath=tutor%2Fpod&view=map",
      {},
    ),
    "/api/tutor/pod?view=map",
  );
});

test("ordinary direct function requests are left unchanged", () => {
  assert.equal(resolvePreviewRequestUrl("/api/index", {}), null);
});
