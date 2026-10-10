import test from "node:test";
import assert from "node:assert/strict";

/**
 * Safe production smoke test: no credentials, no mutations, no enrollment or
 * Specialist data. Verifies the separate Render API host (not the Vercel SPA)
 * does not leak Practicals or TD records to unauthenticated callers.
 *
 * Run only when invoked explicitly through the bounded Practicals CI job.
 */
const origin="https://api.responseintegrity.co.za";
const endpoints=[
  "/api/tutor/capability-practicals?tutorAssignmentId=synthetic-unauthenticated-acceptance",
  "/api/tutor/capability-practicals/execute-challenge?tutorAssignmentId=synthetic-unauthenticated-acceptance",
  "/api/capability-review/practicals/pending",
  "/api/td/tutors/synthetic-unauthenticated-acceptance/practicals",
];

test("Production Practicals API enforces no-session access on the real Render backend",async(t)=>{
  for(const route of endpoints) {
    await t.test(new URL(route,origin).pathname,async()=>{
      const response=await fetch(new URL(route,origin),{
        method:"GET",
        redirect:"manual",
        headers:{Accept:"application/json"},
        signal:AbortSignal.timeout(25000),
      });
      const contentType=response.headers.get("content-type")||"";
      // Auth middleware can return 401 or 403; neither reveals an assignment.
      assert.ok([401,403].includes(response.status),
        `Expected authorization denial, got HTTP ${response.status} for ${route}`);
      assert.match(contentType,/^application\/json\b/i,
        `API must return JSON (not Vercel SPA HTML) for ${route}`);
      const body=await response.json() as Record<string,unknown>;
      assert.equal(typeof (body.message||body.error),"string",
        "Authorization rejection must be an explicit JSON API response.");
      assert.ok(!("evidence" in body)&&!("queue" in body)&&!("assignment" in body),
        "Unauthenticated caller must not receive a Specialist/TD record.");
    });
  }
});
