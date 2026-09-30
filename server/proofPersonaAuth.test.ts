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


test("Preview Specialist signup bypasses email delivery with a confirmed password identity", () => {
  const source = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const signupStart = source.indexOf('app.post("/api/auth/signup"');
  const signinStart = source.indexOf('app.post("/api/auth/signin"', signupStart);
  const signup = source.slice(signupStart, signinStart);

  assert.match(signup, /const isPreviewSpecialistSignup =[\s\S]*?process\.env\.VERCEL_ENV === "preview"[\s\S]*?role === "tutor"/);
  assert.match(signup, /if \(isPreviewSpecialistSignup\) \{[\s\S]*?serverSupabase\.auth\.admin\.createUser\(\{/);
  assert.match(signup, /serverSupabase\.auth\.admin\.createUser\(\{[\s\S]*?password,[\s\S]*?email_confirm:\s*true/);
  assert.match(signup, /\} else if \(isPreviewSmokeIdentity\) \{/);
  assert.match(signup, /\} else \{[\s\S]*?supabase\.auth\.signUp\(\{/);
});

test("signin surfaces unconfirmed email instead of reporting a bad password", () => {
  const source = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const signinStart = source.indexOf('app.post("/api/auth/signin"');
  const signin = source.slice(signinStart);

  assert.match(signin, /authError\.code === "email_not_confirmed"/);
  assert.match(signin, /Email confirmation is required before you can log in\./);
  assert.match(signin, /authError\.code === "over_request_rate_limit"/);
});
