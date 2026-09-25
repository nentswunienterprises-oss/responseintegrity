import assert from "node:assert/strict";
import test from "node:test";
import { resolveTutorOperationalModeAuthority } from "./tutorOperationalModeAuthority";

test("lifecycle mode is authoritative over a stale assignment projection", () => {
  assert.deepEqual(
    resolveTutorOperationalModeAuthority({
      assignmentMode: "training",
      lifecycleMode: "sandbox",
    }),
    {
      mode: "sandbox",
      assignmentMode: "training",
      lifecycleMode: "sandbox",
      drift: true,
    },
  );
});

test("assignment mode remains a fallback when lifecycle state is absent", () => {
  assert.deepEqual(
    resolveTutorOperationalModeAuthority({
      assignmentMode: "sandbox",
      lifecycleMode: null,
    }),
    {
      mode: "sandbox",
      assignmentMode: "sandbox",
      lifecycleMode: null,
      drift: false,
    },
  );
});

test("missing mode data fails closed to training", () => {
  assert.equal(
    resolveTutorOperationalModeAuthority({
      assignmentMode: null,
      lifecycleMode: null,
    }).mode,
    "training",
  );
});
