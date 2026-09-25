import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";
import { isPreviewProofPersonaEmail, isPreviewSyntheticSandboxPersonaEmail } from "./emergencyAuth";

test("proof personas are restricted to the dedicated Proof identity domain", () => {
  assert.equal(isPreviewProofPersonaEmail("coo@proof.responseintegrity.co.za"), true);
  assert.equal(isPreviewProofPersonaEmail(" COO@PROOF.RESPONSEINTEGRITY.CO.ZA "), true);
  assert.equal(isPreviewProofPersonaEmail("coo@responseintegrity.co.za"), false);
  assert.equal(isPreviewProofPersonaEmail("coo@proof.responseintegrity.co.za.attacker.test"), false);
});

test("Preview synthetic sandbox persona fallback remains Preview-only and credential-backed", () => {
  assert.equal(isPreviewSyntheticSandboxPersonaEmail("coo@proof.responseintegrity.co.za"), true);
  assert.equal(isPreviewSyntheticSandboxPersonaEmail("proof-shadow-a@responseintegrity.test"), true);
  assert.equal(isPreviewSyntheticSandboxPersonaEmail("sandbox-specialist@responseintegrity.test"), true);
  assert.equal(isPreviewSyntheticSandboxPersonaEmail("real.parent@example.com"), false);

  const source = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const fallbackStart = source.indexOf('if (process.env.VERCEL_ENV === "preview")', source.indexOf("Supabase signin error"));
  const fallbackEnd = source.indexOf("const isRateLimited", fallbackStart);
  const fallback = source.slice(fallbackStart, fallbackEnd);

  assert.ok(fallbackStart >= 0);
  assert.ok(fallbackEnd > fallbackStart);
  assert.match(fallback, /authenticateEmergencyUser/);
  assert.match(fallback, /isPreviewSyntheticSandboxPersonaEmail\(normalizedEmail\)/);
  assert.match(fallback, /isProofPersona \|\| isSandboxSpecialist/);
  assert.match(fallback, /emergencyExpectedRoleMatches\(fallbackUser\.role, expectedRole\)/);
  assert.doesNotMatch(fallback, /process\.env\.VERCEL_ENV === "production"/);
});
