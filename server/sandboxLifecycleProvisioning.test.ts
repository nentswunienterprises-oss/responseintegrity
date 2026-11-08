import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Sandbox lifecycle promotion invokes the existing six-family provisioning reconciler", () => {
  const route = readFileSync(resolve(process.cwd(), "server/routes/capabilityEngine.ts"), "utf8");
  assert.match(route, /ensureVisibleSandboxStudentsForTutor/);
  assert.match(route, /progression\?\.mode === "sandbox"/);
  assert.match(route, /sandboxProvisioning/);
});

test("Sandbox account reconciliation is serialized per Specialist", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  assert.match(source, /withSandboxProvisionLock\s*\(/);
  assert.match(source, /autoProvisionSandboxAccountsForTutorUnlocked/);
  assert.match(source, /export async function ensureVisibleSandboxStudentsForTutor/);
});
