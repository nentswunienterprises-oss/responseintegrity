import test from "node:test";
import assert from "node:assert/strict";
import { isSandboxCrossModeCaptureEnabled } from "./sandboxCrossModeCapture";

test("capture remains disabled unless the explicit capture switch is enabled", () => {
  assert.equal(isSandboxCrossModeCaptureEnabled("thendo", {}), false);
  assert.equal(isSandboxCrossModeCaptureEnabled("thendo", {
    RI_SANDBOX_CROSSMODE_CAPTURE_V1: "false",
    RI_SANDBOX_CROSSMODE_CAPTURE_TUTOR_IDS: "thendo",
  }), false);
});

test("Preview preserves its existing branch-scoped capture behavior", () => {
  assert.equal(isSandboxCrossModeCaptureEnabled("any-preview-specialist", {
    VERCEL_ENV: "preview",
    RI_SANDBOX_CROSSMODE_CAPTURE_V1: "true",
  }), true);
});

test("Production capture requires an exact tutor allowlist match", () => {
  const env = {
    VERCEL_ENV: "production",
    RI_SANDBOX_CROSSMODE_CAPTURE_V1: "true",
    RI_SANDBOX_CROSSMODE_CAPTURE_TUTOR_IDS: "other-specialist, thendo-id ",
  };
  assert.equal(isSandboxCrossModeCaptureEnabled("thendo-id", env), true);
  assert.equal(isSandboxCrossModeCaptureEnabled("other-specialist", env), true);
  assert.equal(isSandboxCrossModeCaptureEnabled("unlisted-specialist", env), false);
  assert.equal(isSandboxCrossModeCaptureEnabled("", env), false);
});

test("non-Preview environments fail closed without an explicit allowlist", () => {
  assert.equal(isSandboxCrossModeCaptureEnabled("thendo-id", {
    VERCEL_ENV: "production",
    RI_SANDBOX_CROSSMODE_CAPTURE_V1: "true",
  }), false);
});
