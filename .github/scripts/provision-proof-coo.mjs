import assert from "node:assert/strict";

const baseUrl = String(process.env.PROOF_BASE_URL || "").replace(/\/$/, "");
const specialistEmail = String(process.env.RI_PROOF_SPECIALIST_EMAIL || "").trim();
const specialistPassword = String(process.env.RI_PROOF_SPECIALIST_PASSWORD || "");
const cooPassword = String(process.env.RI_PROOF_COO_PASSWORD || "");
const bypass = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "").trim();
const expectedCommit = String(process.env.PROOF_EXPECTED_APP_SHA || "").trim();
const cooEmail = "coo@proof.responseintegrity.co.za";

assert.ok(baseUrl, "PROOF_BASE_URL is required");
assert.ok(specialistEmail && specialistPassword, "Proof Specialist credentials are required");
assert.ok(cooPassword, "RI_PROOF_COO_PASSWORD is required");
assert.ok(expectedCommit, "Expected Preview app SHA is required");

const baseHeaders = {
  "content-type": "application/json",
  ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
};

async function request(path, init = {}) {
  return fetch(baseUrl + path, {
    ...init,
    headers: {
      ...baseHeaders,
      ...(init.headers || {}),
    },
  });
}

async function waitForPreview() {
  let last = null;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const response = await request("/api/proof-environment", { method: "GET" }).catch(() => null);
    if (response?.ok) {
      last = await response.json().catch(() => null);
      if (
        last?.vercelEnv === "preview" &&
        last?.supabaseProjectRef === "jftlxeacphvbnhbsbpxc" &&
        last?.commitSha === expectedCommit
      ) {
        console.log("PROOF_COO_PREVIEW_READY=" + JSON.stringify({
          attempt,
          commitSha: last.commitSha,
          supabaseProjectRef: last.supabaseProjectRef,
        }));
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Preview alias did not reach expected app SHA: " + JSON.stringify(last));
}

function sessionCookie(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0].trim();
  assert.ok(cookie.includes("="), "Expected authenticated session cookie");
  return cookie;
}

await waitForPreview();

const specialistLogin = await request("/api/auth/signin", {
  method: "POST",
  body: JSON.stringify({
    email: specialistEmail,
    password: specialistPassword,
    expectedRole: "tutor",
  }),
});
const specialistText = await specialistLogin.text();
assert.ok(
  specialistLogin.ok,
  "Proof Specialist login failed: " + specialistLogin.status + " " + specialistText,
);
const specialistBody = JSON.parse(specialistText);
assert.equal(specialistBody?.dbUser?.role, "tutor");
const specialistCookie = sessionCookie(specialistLogin);

const provision = await request("/api/proof/personas/provision", {
  method: "POST",
  headers: { cookie: specialistCookie },
  body: JSON.stringify({
    email: cooEmail,
    password: cooPassword,
    role: "coo",
    firstName: "Proof",
    lastName: "COO",
  }),
});
const provisionText = await provision.text();
assert.ok(
  provision.ok,
  "COO provisioning failed: " + provision.status + " " + provisionText,
);
const provisionBody = JSON.parse(provisionText);
assert.equal(provisionBody?.user?.email, cooEmail);
assert.equal(provisionBody?.user?.role, "coo");
assert.equal(provisionBody?.credentialProvisioned, true);
assert.equal(provisionBody?.appointedExecutiveRole, "coo");

const cooLogin = await request("/api/auth/signin", {
  method: "POST",
  body: JSON.stringify({
    email: cooEmail,
    password: cooPassword,
    expectedRole: "coo",
  }),
});
const cooText = await cooLogin.text();
assert.ok(
  cooLogin.ok,
  "Proof COO login failed: " + cooLogin.status + " " + cooText,
);
const cooBody = JSON.parse(cooText);
assert.equal(cooBody?.dbUser?.email, cooEmail);
assert.equal(cooBody?.dbUser?.role, "coo");

console.log("PROOF_COO_PROVISIONING=PASS " + JSON.stringify({
  email: cooEmail,
  role: cooBody.dbUser.role,
  credentialProvisioned: true,
  appointedExecutiveRole: provisionBody.appointedExecutiveRole,
}));
