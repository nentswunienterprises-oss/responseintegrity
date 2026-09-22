import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

test("Proof persona provisioning is Preview-only, authenticated, and Sandbox-Specialist scoped", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const start = source.indexOf('"/api/proof/personas/provision"');
  const end = source.indexOf('"/api/proof/handover-fixture/reset"', start);
  const route = source.slice(start, end);

  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.match(route, /isAuthenticated/);
  assert.match(route, /requireRole\(\["tutor"\]\)/);
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /operational_mode = 'sandbox'/);
  assert.match(route, /@proof\.responseintegrity\.co\.za/);
  assert.match(route, /setEmergencyCredentialForExistingUser/);
  assert.doesNotMatch(route, /console\.(log|info|warn|error)\([^\n]*password/i);
});

test("Proof COO provisioning also establishes the canonical COO appointment", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const start = source.indexOf('"/api/proof/personas/provision"');
  const end = source.indexOf('"/api/proof/handover-fixture/reset"', start);
  const route = source.slice(start, end);

  assert.match(route, /role === "coo"/);
  assert.match(route, /public\.executive_role_appointments/);
  assert.match(route, /'coo'::public\.executive_department/);
  assert.match(route, /ON CONFLICT \(role\) DO UPDATE/);
});

test("Proof credential setter rotates bcrypt material without storing plaintext", () => {
  const source = readFileSync(resolve(process.cwd(), "server/emergencyAuth.ts"), "utf8");
  const start = source.indexOf("export async function setEmergencyCredentialForExistingUser");
  const end = source.indexOf("export function parseEmergencyDocumentEncryptionKey", start);
  const helper = source.slice(start, end);

  assert.ok(start >= 0);
  assert.ok(end > start);
  assert.match(helper, /bcrypt\.hash\(password, EMERGENCY_BCRYPT_WORK_FACTOR\)/);
  assert.match(helper, /private\.emergency_auth_credentials/);
  assert.match(helper, /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.match(helper, /SET password_hash = EXCLUDED\.password_hash/);
});
